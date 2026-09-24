/**
 * ============================================================================
 * CLIENT APPLICATION CONTROLLER (`app.ts`)
 * ============================================================================
 * 
 * ROLE OF THIS FILE:
 * This script is the central "Brain" and Orchestrator of the client-side UI.
 * It connects user interactions in the DOM (drag-and-drop, typing, button clicks)
 * to the underlying Converter Registry.
 * 
 * CORE ARCHITECTURAL PRINCIPLES APPLIED:
 * 1. 100% In-Memory State:
 *    No data is ever saved to `localStorage`, `sessionStorage`, cookies, or remote
 *    servers. When the browser tab is closed, all document data disappears forever.
 * 2. Event-Driven Architecture:
 *    Listens for user actions (drops, keypresses, select changes) and triggers
 *    re-renders and updates status pills.
 * 3. Debounced UI Updates:
 *    Typing in the editor delays markdown parsing by 150ms so the user's keystrokes
 *    remain fast and fluid without lag.
 * 4. Extensible Tool Binding:
 *    Dynamically populates the tool dropdown and configures file filters based on
 *    whatever converters are registered in the registry.
 */

import { converterRegistry } from '../converters/registry';
import { mdToPdfConverter } from '../converters/md-to-pdf';
import { txtToPdfConverter } from '../converters/txt-to-pdf';
import type { Converter, ConverterOptions } from '../converters/types';

// ============================================================================
// 1. TOOL REGISTRATION
// ============================================================================
// Register the built-in converters into our singleton registry.
// To add a 3rd or 4th converter in the future, simply import it and call register() here!
converterRegistry.register(mdToPdfConverter);
converterRegistry.register(txtToPdfConverter);

// ============================================================================
// 2. IN-MEMORY APPLICATION STATE
// ============================================================================
/**
 * Interface defining all state variables used while this browser tab is open.
 */
interface AppState {
  /** The File object if loaded from disk; null if written manually in editor */
  currentFile: File | null;
  /** Active document filename (e.g. "my-notes.md"), used to name the output PDF */
  currentFilename: string;
  /** The raw text content currently loaded or typed in the editor */
  currentContent: string;
  /** Boolean flag locking UI during an active PDF conversion to prevent double clicks */
  isConverting: boolean;
  /** Current print settings selected in the toolbar */
  options: ConverterOptions;
}

/**
 * Global in-memory state object.
 * Strictly stored in volatile RAM.
 */
const state: AppState = {
  currentFile: null,
  currentFilename: 'document.md',
  currentContent: '',
  isConverting: false,
  options: {
    paperFormat: 'a4',
    orientation: 'portrait',
    margin: 'normal'
  }
};

/**
 * Timer ID used to debounce live typing in the editor.
 * Prevents running heavy markdown parsing on every single keystroke.
 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// 3. APPLICATION INITIALIZATION (`initApp`)
// ============================================================================
/**
 * Boots the application after the DOM is fully constructed.
 * Queries all needed HTML elements, attaches event listeners, and runs initial render.
 */
export function initApp(): void {
  // Query Core DOM Elements
  const dropzone = document.getElementById('dropzone') as HTMLElement | null;
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  const textarea = document.getElementById('raw-editor') as HTMLTextAreaElement | null;
  const previewSheet = document.getElementById('document-sheet') as HTMLElement | null;
  const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement | null;
  const loadSampleBtn = document.getElementById('load-sample-btn') as HTMLButtonElement | null;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement | null;
  const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement | null;
  const converterSelect = document.getElementById('converter-select') as HTMLSelectElement | null;
  
  // Query PDF Configuration Dropdowns
  const formatSelect = document.getElementById('paper-format-select') as HTMLSelectElement | null;
  const orientationSelect = document.getElementById('orientation-select') as HTMLSelectElement | null;
  const marginSelect = document.getElementById('margin-select') as HTMLSelectElement | null;

  // Query Mobile Tab Toggle Buttons
  const tabEditorBtn = document.getElementById('tab-editor-btn') as HTMLButtonElement | null;
  const tabPreviewBtn = document.getElementById('tab-preview-btn') as HTMLButtonElement | null;
  const editorPane = document.getElementById('editor-pane') as HTMLElement | null;
  const previewPane = document.getElementById('preview-pane') as HTMLElement | null;

  // Safety check: ensure critical UI elements exist before continuing
  if (!previewSheet || !textarea || !downloadBtn) {
    console.error('[MicroConvert] Critical DOM elements missing. Check component templates.');
    return;
  }

  // --------------------------------------------------------------------------
  // A. Dynamically Populate Converter Selector
  // --------------------------------------------------------------------------
  if (converterSelect) {
    converterSelect.innerHTML = '';
    // Query registry for all available converters and render `<option>` tags
    converterRegistry.getAll().forEach((conv) => {
      const option = document.createElement('option');
      option.value = conv.id;
      option.textContent = conv.name;
      converterSelect.appendChild(option);
    });

    // Listen for tool changes (e.g. user selects "Plain Text to PDF")
    converterSelect.addEventListener('change', (e) => {
      const selectedId = (e.target as HTMLSelectElement).value;
      converterRegistry.setActive(selectedId);
      updateAcceptAttributes(fileInput);
      renderCurrentContent();
      showNotification('info', `Active tool: ${converterRegistry.getActive().name}`, 3000);
    });
  }

  // Sync file input's `accept` attribute (e.g. ".md,.markdown") with active converter
  updateAcceptAttributes(fileInput);

  // --------------------------------------------------------------------------
  // B. HTML5 Drag and Drop Handlers
  // --------------------------------------------------------------------------
  if (dropzone) {
    // When a dragged file enters or hovers over the dropzone, add highlight class
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        // e.preventDefault() is MANDATORY in HTML5: without it, the browser
        // will open the dropped file directly in the browser tab!
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-active');
      });
    });

    // When the dragged file leaves the dropzone, remove highlight class
    ['dragleave', 'dragend'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-active');
      });
    });

    // When the user releases the file inside the dropzone
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }
    });

    // Global dragover & drop prevention:
    // If user accidentally misses the dropzone and drops anywhere on the window,
    // prevent the browser from navigating away or opening the file as raw text.
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);
  }

  // --------------------------------------------------------------------------
  // C. Traditional File Picker Input Handler
  // --------------------------------------------------------------------------
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelection(fileInput.files[0]);
      }
    });
  }

  // --------------------------------------------------------------------------
  // D. Live Text Editor Input with Debouncing
  // --------------------------------------------------------------------------
  textarea.addEventListener('input', () => {
    state.currentContent = textarea.value;
    updateStatusIndicators();

    /**
     * DEBOUNCING PATTERN:
     * When the user types quickly, an `input` event fires on every single character.
     * Parsing markdown, sanitizing HTML, and syntax highlighting on every character
     * can freeze low-powered devices.
     * We cancel any pending timer and set a new one for 150 milliseconds.
     * The preview updates only after the user stops typing for 150ms!
     */
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderCurrentContent();
    }, 150);
  });

  // --------------------------------------------------------------------------
  // E. PDF Setting Controls (Format, Orientation, Margins)
  // --------------------------------------------------------------------------
  if (formatSelect) {
    formatSelect.addEventListener('change', () => {
      state.options.paperFormat = formatSelect.value as any;
    });
  }

  if (orientationSelect) {
    orientationSelect.addEventListener('change', () => {
      state.options.orientation = orientationSelect.value as any;
    });
  }

  if (marginSelect) {
    marginSelect.addEventListener('change', () => {
      state.options.margin = marginSelect.value as any;
      // Visually reflect margin changes in the live preview sheet CSS
      previewSheet.classList.remove('margin-compact', 'margin-spacious');
      if (state.options.margin === 'compact') {
        previewSheet.classList.add('margin-compact');
      } else if (state.options.margin === 'spacious') {
        previewSheet.classList.add('margin-spacious');
      }
    });
  }

  // --------------------------------------------------------------------------
  // F. Toolbar Action Buttons
  // --------------------------------------------------------------------------
  // "Load Sample" button: fills editor with converter's built-in demo text
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', () => {
      const activeConverter = converterRegistry.getActive();
      state.currentFile = null;
      state.currentFilename = activeConverter.sampleFilename;
      state.currentContent = activeConverter.sampleContent;
      textarea.value = state.currentContent;
      clearNotifications();
      updateStatusIndicators();
      renderCurrentContent();
      showNotification('success', `Loaded sample document (${activeConverter.sampleFilename})`, 4000);
    });
  }

  // "Clear" button: resets state and clears editor & preview
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.currentFile = null;
      state.currentFilename = 'untitled.md';
      state.currentContent = '';
      textarea.value = '';
      if (fileInput) fileInput.value = '';
      clearNotifications();
      updateStatusIndicators();
      renderCurrentContent();
      showNotification('info', 'Document cleared.', 2500);
    });
  }

  // "Copy" button: copies editor text to system clipboard via Clipboard API
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!state.currentContent) return;
      try {
        await navigator.clipboard.writeText(state.currentContent);
        showNotification('success', 'Copied document markdown to clipboard!', 3000);
      } catch (err) {
        showNotification('warning', 'Could not copy to clipboard automatically.');
      }
    });
  }

  // "Download PDF" button: triggers the PDF compilation pipeline
  downloadBtn.addEventListener('click', async () => {
    await executeConversion();
  });

  // --------------------------------------------------------------------------
  // G. Mobile Tab Switcher
  // --------------------------------------------------------------------------
  // On smartphones and tablets, the 2-pane side-by-side view collapses into tabs
  if (tabEditorBtn && tabPreviewBtn && editorPane && previewPane) {
    tabEditorBtn.addEventListener('click', () => {
      tabEditorBtn.classList.add('active');
      tabPreviewBtn.classList.remove('active');
      editorPane.classList.remove('hidden-on-mobile');
      previewPane.classList.add('hidden-on-mobile');
    });

    tabPreviewBtn.addEventListener('click', () => {
      tabPreviewBtn.classList.add('active');
      tabEditorBtn.classList.remove('active');
      previewPane.classList.remove('hidden-on-mobile');
      editorPane.classList.add('hidden-on-mobile');
    });
  }

  // Initial render when the page loads
  renderCurrentContent();
  updateStatusIndicators();
}

// ============================================================================
// 4. FILE INGESTION & PROCESSING (`handleFileSelection`)
// ============================================================================
/**
 * Processes a File selected via drag-and-drop or file picker.
 * 
 * STEP-BY-STEP FLOW:
 * 1. Validate file format against active converter.
 * 2. If mismatch, check if another registered converter can handle it (Smart Routing).
 * 3. Check for size warnings (e.g., >5MB).
 * 4. Read file content strictly in-browser via standard `FileReader` API.
 * 5. Update editor textarea, status indicators, and live preview.
 */
function handleFileSelection(file: File): void {
  const activeConverter = converterRegistry.getActive();
  
  // Step 1: Pre-flight validation
  const validation = activeConverter.validate(file, 'non-empty-check');

  if (!validation.valid) {
    // Check if another registered converter matches this file type
    const altConverter = converterRegistry.findForFile(file);
    if (altConverter) {
      // Auto-switch to the compatible converter!
      converterRegistry.setActive(altConverter.id);
      const select = document.getElementById('converter-select') as HTMLSelectElement | null;
      if (select) select.value = altConverter.id;
      showNotification('info', `Automatically switched to ${altConverter.name} for this file format.`);
    } else {
      // If no converter supports this file, reject with a red danger notification
      showNotification('danger', validation.error || `File format "${file.name}" is not supported.`);
      return;
    }
  }

  // Check for large file warning
  if (validation.warning) {
    showNotification('warning', validation.warning);
  } else {
    clearNotifications();
  }

  /**
   * Step 2: In-Browser File Reading via FileReader
   * The `FileReader` object lets web applications asynchronously read the contents
   * of files stored on the user's computer, using File or Blob objects.
   * Crucially, this stays 100% inside browser memory; NO HTTP request is made!
   */
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = (e.target?.result as string) || '';

      // Check for 0 bytes / empty file
      if (text.trim().length === 0) {
        showNotification('warning', `File "${file.name}" is empty. Please select a file with content.`);
        state.currentContent = '';
        state.currentFilename = file.name;
        state.currentFile = file;
        const textarea = document.getElementById('raw-editor') as HTMLTextAreaElement | null;
        if (textarea) textarea.value = '';
        updateStatusIndicators();
        renderCurrentContent();
        return;
      }

      state.currentFile = file;
      state.currentFilename = file.name;
      
      // Normalize line endings and strip BOM
      state.currentContent = text
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

      const textarea = document.getElementById('raw-editor') as HTMLTextAreaElement | null;
      if (textarea) textarea.value = text;

      updateStatusIndicators();
      renderCurrentContent();
      showNotification('success', `Loaded "${file.name}" successfully.`, 3000);
    } catch (err: any) {
      showNotification('danger', `Failed to read file content: ${err?.message || 'Unknown error'}`);
    }
  };

  reader.onerror = () => {
    showNotification('danger', `Error reading file "${file.name}". Please try again.`);
  };

  // Begin reading file as UTF-8 plain text
  reader.readAsText(file);
}

// ============================================================================
// 5. LIVE PREVIEW RENDERING (`renderCurrentContent`)
// ============================================================================
/**
 * Delegates parsing and HTML generation to the currently active converter,
 * then updates the live preview sheet and toggles the Download button state.
 */
async function renderCurrentContent(): Promise<void> {
  const previewSheet = document.getElementById('document-sheet');
  const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement | null;
  if (!previewSheet) return;

  const converter = converterRegistry.getActive();

  try {
    // Run converter's rendering logic (marked.js + DOMPurify + highlight.js)
    await converter.parseAndRender(state.currentContent, previewSheet);

    // Enable or disable Download button based on whether content exists
    const hasContent = state.currentContent.trim().length > 0;
    if (downloadBtn) {
      downloadBtn.disabled = !hasContent || state.isConverting;
    }
  } catch (err: any) {
    showNotification('danger', `Syntax / Rendering Warning: ${err?.message || 'Failed to parse'}`);
    if (downloadBtn) {
      downloadBtn.disabled = true;
    }
  }
}

// ============================================================================
// 6. PDF GENERATION PIPELINE (`executeConversion`)
// ============================================================================
/**
 * Initiates the PDF generation process.
 * 
 * WORKFLOW:
 * 1. Concurrency guard: checks if conversion is already running.
 * 2. Pre-conversion validation check.
 * 3. Shows full-screen loading spinner overlay and disables download button.
 * 4. Calls converter's `convert()` method with progress listener.
 * 5. Restores UI state and displays success notification on completion.
 */
async function executeConversion(): Promise<void> {
  // Prevent duplicate execution if user rapidly clicks the button
  if (state.isConverting) return;

  const previewSheet = document.getElementById('document-sheet');
  const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement | null;
  const overlay = document.getElementById('converting-overlay');
  const converter = converterRegistry.getActive();

  if (!previewSheet || !state.currentContent.trim()) {
    showNotification('warning', 'Please provide document content before converting.');
    return;
  }

  // Pre-conversion validation
  const validation = converter.validate(state.currentFile, state.currentContent);
  if (!validation.valid) {
    showNotification('danger', validation.error || 'Document validation failed.');
    return;
  }

  // Lock conversion state and show loading indicators
  state.isConverting = true;
  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = `
      <div class="spinner"></div>
      <span>Generating PDF...</span>
    `;
  }

  if (overlay) {
    overlay.classList.add('active');
  }

  try {
    // Execute conversion through active converter
    const result = await converter.convert(
      {
        file: state.currentFile,
        filename: state.currentFilename,
        content: state.currentContent,
        previewEl: previewSheet,
        options: state.options
      },
      // Real-time progress callback
      (percent, message) => {
        const overlayText = document.getElementById('converting-message');
        if (overlayText) overlayText.textContent = message;
      }
    );

    showNotification('success', `PDF successfully generated: "${result.filename}"`, 5000);
  } catch (err: any) {
    console.error('[MicroConvert] Conversion error:', err);
    showNotification('danger', `Conversion failed: ${err?.message || 'Unknown PDF error'}`);
  } finally {
    // ALWAYS reset UI state in `finally`, even if an error occurred!
    state.isConverting = false;
    if (downloadBtn) {
      downloadBtn.disabled = !state.currentContent.trim();
      downloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download PDF</span>
      `;
    }
    if (overlay) {
      overlay.classList.remove('active');
    }
  }
}

// ============================================================================
// 7. STATUS & METADATA INDICATORS
// ============================================================================
/**
 * Calculates live word count, character count, and line count,
 * updating the badges in the toolbar.
 */
function updateStatusIndicators(): void {
  const fileTag = document.getElementById('current-file-name');
  const wordCountTag = document.getElementById('stat-word-count');
  const charCountTag = document.getElementById('stat-char-count');
  const lineCountTag = document.getElementById('stat-line-count');

  if (fileTag) {
    fileTag.textContent = state.currentFilename || 'untitled.md';
  }

  const text = state.currentContent;
  const chars = text.length;
  // Split on whitespace regex `/\s+/` to accurately count words
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  // Split on newlines to count lines
  const lines = text ? text.split('\n').length : 0;

  if (wordCountTag) wordCountTag.textContent = `${words} words`;
  if (charCountTag) charCountTag.textContent = `${chars} chars`;
  if (lineCountTag) lineCountTag.textContent = `${lines} lines`;
}

/**
 * Updates the file picker input's `accept` attribute based on active converter.
 * (e.g., switches between ".md,.markdown" and ".txt,.text,.log")
 */
function updateAcceptAttributes(fileInput: HTMLInputElement | null): void {
  if (!fileInput) return;
  const active = converterRegistry.getActive();
  fileInput.accept = active.acceptExtensions.join(',');
}

// ============================================================================
// 8. NOTIFICATION MANAGEMENT SYSTEM
// ============================================================================
/**
 * Displays an accessible, dismissible alert banner at the top of the interface.
 * 
 * @param type 'warning' (yellow), 'danger' (red), 'info' (blue), or 'success' (green)
 * @param message The text message to display
 * @param autoDismissMs Auto-dismiss duration in milliseconds (0 to keep until manually closed)
 */
export function showNotification(
  type: 'warning' | 'danger' | 'info' | 'success',
  message: string,
  autoDismissMs: number = 6000
): void {
  const container = document.getElementById('notifications-area');
  if (!container) return;

  const banner = document.createElement('div');
  banner.className = `notification-banner ${type}`;

  // SVG icons for each alert level
  let iconSvg = '';
  if (type === 'danger') {
    iconSvg = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
  } else if (type === 'warning') {
    iconSvg = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `;
  } else if (type === 'success') {
    iconSvg = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
  } else {
    iconSvg = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `;
  }

  // Construct banner DOM safely escaping message text
  banner.innerHTML = `
    <div class="notification-content">
      ${iconSvg}
      <span>${escapeHtml(message)}</span>
    </div>
    <button class="notification-close" title="Dismiss">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // Attach close button click handler
  const closeBtn = banner.querySelector('.notification-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      banner.remove();
    });
  }

  container.appendChild(banner);

  // Auto-remove banner after timeout
  if (autoDismissMs > 0) {
    setTimeout(() => {
      banner.remove();
    }, autoDismissMs);
  }
}

/**
 * Removes all active notification banners
 */
export function clearNotifications(): void {
  const container = document.getElementById('notifications-area');
  if (container) container.innerHTML = '';
}

/**
 * Helper: basic character escaping for safely injecting dynamic strings into HTML
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
