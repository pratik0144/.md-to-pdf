/**
 * MicroConvert - Client Application Controller
 * Connects UI interactions (drag & drop, live editor, preview) with the converter registry
 */

import { converterRegistry } from '../converters/registry';
import { mdToPdfConverter } from '../converters/md-to-pdf';
import { txtToPdfConverter } from '../converters/txt-to-pdf';
import type { Converter, ConverterOptions } from '../converters/types';

// Register standard converters
converterRegistry.register(mdToPdfConverter);
converterRegistry.register(txtToPdfConverter);

// Application State (Purely in-memory, never persisted)
interface AppState {
  currentFile: File | null;
  currentFilename: string;
  currentContent: string;
  isConverting: boolean;
  options: ConverterOptions;
}

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

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize application after DOM is ready
 */
export function initApp(): void {
  // DOM Elements
  const dropzone = document.getElementById('dropzone') as HTMLElement | null;
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  const textarea = document.getElementById('raw-editor') as HTMLTextAreaElement | null;
  const previewSheet = document.getElementById('document-sheet') as HTMLElement | null;
  const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement | null;
  const loadSampleBtn = document.getElementById('load-sample-btn') as HTMLButtonElement | null;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement | null;
  const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement | null;
  const converterSelect = document.getElementById('converter-select') as HTMLSelectElement | null;
  
  // Settings Selects
  const formatSelect = document.getElementById('paper-format-select') as HTMLSelectElement | null;
  const orientationSelect = document.getElementById('orientation-select') as HTMLSelectElement | null;
  const marginSelect = document.getElementById('margin-select') as HTMLSelectElement | null;

  // Mobile Tab Buttons
  const tabEditorBtn = document.getElementById('tab-editor-btn') as HTMLButtonElement | null;
  const tabPreviewBtn = document.getElementById('tab-preview-btn') as HTMLButtonElement | null;
  const editorPane = document.getElementById('editor-pane') as HTMLElement | null;
  const previewPane = document.getElementById('preview-pane') as HTMLElement | null;

  if (!previewSheet || !textarea || !downloadBtn) {
    console.error('[MicroConvert] Critical DOM elements missing.');
    return;
  }

  // 1. Setup Converter Selector
  if (converterSelect) {
    converterSelect.innerHTML = '';
    converterRegistry.getAll().forEach((conv) => {
      const option = document.createElement('option');
      option.value = conv.id;
      option.textContent = conv.name;
      converterSelect.appendChild(option);
    });

    converterSelect.addEventListener('change', (e) => {
      const selectedId = (e.target as HTMLSelectElement).value;
      converterRegistry.setActive(selectedId);
      updateAcceptAttributes(fileInput);
      renderCurrentContent();
      showNotification('info', `Active tool: ${converterRegistry.getActive().name}`, 3000);
    });
  }

  updateAcceptAttributes(fileInput);

  // 2. Drag and Drop Handling
  if (dropzone) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-active');
      });
    });

    ['dragleave', 'dragend'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-active');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }
    });

    // Also handle window dragover prevention
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);
  }

  // 3. File Input Change
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelection(fileInput.files[0]);
      }
    });
  }

  // 4. Live Text Editor Input
  textarea.addEventListener('input', () => {
    state.currentContent = textarea.value;
    updateStatusIndicators();

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderCurrentContent();
    }, 150);
  });

  // 5. Settings Changes
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
      // Adjust sheet visual preview margin class
      previewSheet.classList.remove('margin-compact', 'margin-spacious');
      if (state.options.margin === 'compact') {
        previewSheet.classList.add('margin-compact');
      } else if (state.options.margin === 'spacious') {
        previewSheet.classList.add('margin-spacious');
      }
    });
  }

  // 6. Action Buttons
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

  // 7. Download PDF Button
  downloadBtn.addEventListener('click', async () => {
    await executeConversion();
  });

  // 8. Mobile Tabs
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

  // Initial empty render
  renderCurrentContent();
  updateStatusIndicators();
}

/**
 * Handle user file selection (via drop or picker)
 */
function handleFileSelection(file: File): void {
  const activeConverter = converterRegistry.getActive();
  
  // Step 1: Validate file with active converter
  const validation = activeConverter.validate(file, 'non-empty-check');

  if (!validation.valid) {
    // Check if another registered converter matches this file type
    const altConverter = converterRegistry.findForFile(file);
    if (altConverter) {
      converterRegistry.setActive(altConverter.id);
      const select = document.getElementById('converter-select') as HTMLSelectElement | null;
      if (select) select.value = altConverter.id;
      showNotification('info', `Automatically switched to ${altConverter.name} for this file format.`);
    } else {
      // Reject file with clear message
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

  // Step 2: Read file via FileReader (100% client-side memory)
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
      // Normalize whitespace: strip BOM, normalize line endings
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

  reader.readAsText(file);
}

/**
 * Render current text content in preview sheet
 */
async function renderCurrentContent(): Promise<void> {
  const previewSheet = document.getElementById('document-sheet');
  const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement | null;
  if (!previewSheet) return;

  const converter = converterRegistry.getActive();

  try {
    await converter.parseAndRender(state.currentContent, previewSheet);

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

/**
 * Perform PDF conversion
 */
async function executeConversion(): Promise<void> {
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
    const result = await converter.convert(
      {
        file: state.currentFile,
        filename: state.currentFilename,
        content: state.currentContent,
        previewEl: previewSheet,
        options: state.options
      },
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

/**
 * Update stats (words, characters, lines, filename)
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
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split('\n').length : 0;

  if (wordCountTag) wordCountTag.textContent = `${words} words`;
  if (charCountTag) charCountTag.textContent = `${chars} chars`;
  if (lineCountTag) lineCountTag.textContent = `${lines} lines`;
}

/**
 * Update HTML input accept attributes based on active converter
 */
function updateAcceptAttributes(fileInput: HTMLInputElement | null): void {
  if (!fileInput) return;
  const active = converterRegistry.getActive();
  fileInput.accept = active.acceptExtensions.join(',');
}

/**
 * Notification Banner Manager
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

  const closeBtn = banner.querySelector('.notification-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      banner.remove();
    });
  }

  container.appendChild(banner);

  if (autoDismissMs > 0) {
    setTimeout(() => {
      banner.remove();
    }, autoDismissMs);
  }
}

export function clearNotifications(): void {
  const container = document.getElementById('notifications-area');
  if (container) container.innerHTML = '';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
