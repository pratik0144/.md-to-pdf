/**
 * ============================================================================
 * STANDALONE SCRIPT (`standalone/script.js`)
 * ============================================================================
 *
 * WHAT IS THIS FILE?
 * This is a ZERO-BUILD, ZERO-BUNDLER, self-contained copy of the entire
 * MicroConvert application, written in plain vanilla JavaScript (ES2020+).
 * You can open `standalone/index.html` directly in a browser from your file
 * system — no Node.js, no npm, no Astro, no Vite required!
 *
 * HOW DOES IT RELATE TO THE ASTRO VERSION?
 * The logic here is functionally identical to the modular Astro-based source
 * code in `src/`. The Astro version splits the code into clean modules:
 *   - Converter types & interfaces  →  src/converters/types.ts
 *   - Registry (Singleton/Map)       →  src/converters/registry.ts
 *   - Markdown-to-PDF engine         →  src/converters/md-to-pdf.ts
 *   - Plain Text-to-PDF engine       →  src/converters/txt-to-pdf.ts
 *   - UI Controller & state          →  src/scripts/app.ts
 *
 * This standalone script merges ALL of those modules into a single IIFE
 * (Immediately Invoked Function Expression) so it runs without any build step.
 *
 * FOR LEARNERS:
 * If you want to understand the architecture and design patterns, read the
 * heavily-commented Astro source files in `src/` first (see learn.md for the
 * ordered reading guide). Then come back here to see how the same patterns
 * look without TypeScript types and module imports.
 *
 * KEY STRUCTURAL SECTIONS INSIDE THIS FILE:
 *   Section 1 (line ~45):   ConverterRegistry class (Registry + Singleton Pattern)
 *   Section 2 (line ~100):  Markdown-to-PDF converter object (Strategy Pattern)
 *   Section 3 (line ~365):  Plain Text-to-PDF converter object (Extensibility demo)
 *   Section 4 (line ~440):  Application state, notifications, and UI controller
 *   Section 5 (line ~660):  init() — DOM queries, event listeners, drag-and-drop
 * ============================================================================
 */

(function () {
  'use strict';

  // --- 1. Converter Registry ---
  class ConverterRegistry {
    constructor() {
      this.converters = new Map();
      this.activeConverterId = 'md-to-pdf';
    }

    register(converter) {
      this.converters.set(converter.id, converter);
    }

    get(id) {
      return this.converters.get(id);
    }

    getAll() {
      return Array.from(this.converters.values());
    }

    getActive() {
      return this.converters.get(this.activeConverterId) || this.converters.values().next().value;
    }

    setActive(id) {
      if (this.converters.has(id)) {
        this.activeConverterId = id;
        return true;
      }
      return false;
    }

    findForFile(file) {
      const name = file.name.toLowerCase();
      const mime = (file.type || '').toLowerCase();

      for (const converter of this.converters.values()) {
        const extMatch = converter.acceptExtensions.some((ext) => name.endsWith(ext.toLowerCase()));
        const mimeMatch = converter.acceptMimeTypes.some((m) => mime && m.toLowerCase() === mime);
        if (extMatch || mimeMatch) {
          return converter;
        }
      }
      return undefined;
    }
  }

  const registry = new ConverterRegistry();

  // Helper: HTML Escaping
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- 2. Markdown to PDF Converter Module ---
  const mdToPdfConverter = {
    id: 'md-to-pdf',
    name: 'Markdown to PDF',
    description: 'Convert CommonMark and GitHub Flavored Markdown into print-ready PDF documents',
    inputLabel: 'Markdown (.md)',
    outputLabel: 'PDF Document (.pdf)',
    acceptExtensions: ['.md', '.markdown'],
    acceptMimeTypes: ['text/markdown', 'text/x-markdown', 'text/plain'],
    outputExtension: '.pdf',
    outputMimeType: 'application/pdf',
    maxFileSize: 5 * 1024 * 1024,

    sampleFilename: 'MicroConvert-QuickStart.md',
    sampleContent: `# MicroConvert: Professional Document Export

Welcome to **MicroConvert**, the zero-knowledge, 100% client-side document converter. Everything you view and convert runs entirely within your browser memory.

---

## 1. Key Features & Privacy Guarantees

> "Privacy is not an afterthought — client-side conversion means your proprietary data, legal agreements, and personal notes never touch a third-party server."

* **100% Client-Side:** Powered by standard Web APIs (\`FileReader\`, \`Blob\`, \`html2pdf.js\`).
* **Zero Tracking:** No telemetry, analytics, tracking pixels, or remote database storage.
* **Full CommonMark & GFM Support:** Headings, tables, checklists, blockquotes, and code blocks.
* **Smart Page Breaks:** Automatically prevents awkward page breaks inside code blocks and tables.

---

## 2. GitHub Flavored Markdown (GFM) Syntax

### Task Lists & Organization
- [x] Configure client-side marked.js and DOMPurify pipeline
- [x] Implement robust page-break prevention for print output
- [ ] Explore future extensible converter modules

### Feature Comparison Matrix

| Capability | MicroConvert (Client-Side) | Cloud Converters | Legacy Desktop Tools |
| :--- | :---: | :---: | :---: |
| **Data Privacy** | 100% Local / Safe | Transmitted to Server | Local |
| **Installation** | Zero (Runs in Browser) | Zero | Heavy Install |
| **Offline Ready** | Yes (Service Worker) | No | Yes |
| **Speed** | Instant | Network Dependent | Fast |

---

## 3. Code Block Syntax Highlighting

Here is an example demonstrating the modular converter registry pattern:

\`\`\`javascript
// Register a converter module with a unified contract
converterRegistry.register({
  id: 'md-to-pdf',
  name: 'Markdown to PDF',
  acceptExtensions: ['.md', '.markdown'],
  outputExtension: '.pdf',
  convert: async ({ previewEl, filename }) => {
    const worker = window.html2pdf().from(previewEl);
    return await worker.save(filename);
  }
});
\`\`\`

And Python syntax highlighting:

\`\`\`python
def convert_document(filepath: str) -> str:
    """Process document purely in client memory."""
    print(f"Converting {filepath} with zero remote requests.")
    return "document.pdf"
\`\`\`

---

## 4. Typography & Blockquote Hierarchies

### Heading Level 3
#### Heading Level 4
##### Heading Level 5 (Capitalized Label)

You can use *italic emphasis*, **bold weight**, ~~strikethrough text~~, or \`inline monospace code\`.

---

*Generated by MicroConvert • Ready for PDF Export*
`,

    validate(file, content) {
      if (file) {
        const name = file.name.toLowerCase();
        const hasValidExt = this.acceptExtensions.some((ext) => name.endsWith(ext));
        if (!hasValidExt) {
          return {
            valid: false,
            error: `Invalid file format: "${file.name}". MicroConvert expects a Markdown file (${this.acceptExtensions.join(', ')}).`
          };
        }

        if (file.size > this.maxFileSize) {
          const mb = (file.size / (1024 * 1024)).toFixed(1);
          return {
            valid: true,
            warning: `Large document detected (${mb} MB). Rendering and PDF generation may take a few extra moments.`
          };
        }
      }

      if (!content || content.trim().length === 0) {
        return {
          valid: false,
          error: 'The document is currently empty. Please drop a Markdown file or enter text to preview.'
        };
      }

      return { valid: true };
    },

    async parseAndRender(content, previewEl) {
      if (!content || content.trim().length === 0) {
        previewEl.innerHTML = `
          <div class="preview-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h3>Document Preview</h3>
            <p>Drop a <code>.md</code> file above, or type markdown on the left to see the live print-ready preview.</p>
          </div>
        `;
        return;
      }

      try {
        // Normalize whitespace
        const normalized = content
          .replace(/^\uFEFF/, '')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/[\t ]+$/gm, '')
          .replace(/\u00A0/g, ' ');

        let rawHtml = '';
        if (window.marked && typeof window.marked.parse === 'function') {
          rawHtml = window.marked.parse(normalized, { gfm: true, breaks: true });
        } else {
          rawHtml = `<pre>${escapeHtml(content)}</pre>`;
        }

        let cleanHtml = rawHtml;
        if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
          cleanHtml = window.DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target', 'rel'] });
        }

        previewEl.innerHTML = cleanHtml;

        if (window.hljs && typeof window.hljs.highlightElement === 'function') {
          previewEl.querySelectorAll('pre code').forEach((block) => {
            try {
              window.hljs.highlightElement(block);
            } catch (e) {
              console.warn('[MicroConvert] hljs block error:', e);
            }
          });
        }
      } catch (err) {
        console.error('[MicroConvert] Markdown render error:', err);
        throw new Error(`Markdown Parsing Error: ${err.message || 'Unknown error'}`);
      }
    },

    async convert(context, onProgress) {
      const { filename, previewEl, options } = context;

      if (!window.html2pdf) {
        throw new Error('PDF generator engine (html2pdf.js) is not loaded.');
      }

      onProgress?.(15, 'Preparing document layout...');

      let pdfFilename = filename || 'document.pdf';
      if (!pdfFilename.toLowerCase().endsWith('.pdf')) {
        const lastDot = pdfFilename.lastIndexOf('.');
        if (lastDot > 0) {
          pdfFilename = pdfFilename.substring(0, lastDot);
        }
        pdfFilename = `${pdfFilename}.pdf`;
      }

      const paperFormat = options?.paperFormat || 'a4';
      const orientation = options?.orientation || 'portrait';

      let marginConfig = [14, 14, 14, 14];
      if (options?.margin === 'compact') marginConfig = [10, 10, 10, 10];
      else if (options?.margin === 'spacious') marginConfig = [18, 18, 18, 18];

      onProgress?.(35, 'Rasterizing high-resolution pages...');

      const opt = {
        margin: marginConfig,
        filename: pdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false
        },
        jsPDF: {
          unit: 'mm',
          format: paperFormat,
          orientation: orientation
        },
        pagebreak: {
          mode: ['avoid-all', 'css', 'legacy'],
          avoid: ['table', 'tr', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'figure']
        }
      };

      onProgress?.(60, 'Assembling PDF vector document...');

      const clone = previewEl.cloneNode(true);
      clone.style.maxWidth = '800px';
      clone.style.margin = '0 auto';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      clone.style.color = '#1e293b';
      clone.style.background = '#ffffff';

      const offscreen = document.createElement('div');
      offscreen.style.position = 'fixed';
      offscreen.style.left = '-9999px';
      offscreen.style.top = '0';
      offscreen.style.width = '800px';
      offscreen.style.background = '#ffffff';
      offscreen.appendChild(clone);
      document.body.appendChild(offscreen);

      try {
        const worker = window.html2pdf().set(opt).from(clone);
        onProgress?.(85, 'Finalizing download blob...');
        const blob = await worker.output('blob');
        await worker.save();
        onProgress?.(100, 'PDF Download Complete!');

        return { blob, filename: pdfFilename };
      } finally {
        if (offscreen.parentNode) {
          offscreen.parentNode.removeChild(offscreen);
        }
      }
    }
  };

  // --- 3. Plain Text to PDF Converter Module (Demonstrates Extensibility) ---
  const txtToPdfConverter = {
    id: 'txt-to-pdf',
    name: 'Plain Text to PDF',
    description: 'Convert plain text files into clean PDF documents',
    inputLabel: 'Text File (.txt)',
    outputLabel: 'PDF Document (.pdf)',
    acceptExtensions: ['.txt', '.text', '.log'],
    acceptMimeTypes: ['text/plain'],
    outputExtension: '.pdf',
    outputMimeType: 'application/pdf',
    maxFileSize: 5 * 1024 * 1024,
    sampleFilename: 'SampleLog.txt',
    sampleContent: `MICROCONVERT SYSTEM LOG\nStatus: Operational\nPlatform: 100% In-Browser\nZero backend, zero data tracking.\n`,

    validate(file, content) {
      if (file) {
        const name = file.name.toLowerCase();
        if (!this.acceptExtensions.some((ext) => name.endsWith(ext))) {
          return { valid: false, error: `Invalid file format: "${file.name}". Expected plain text format.` };
        }
      }
      if (!content || !content.trim()) {
        return { valid: false, error: 'Document is empty.' };
      }
      return { valid: true };
    },

    async parseAndRender(content, previewEl) {
      if (!content || !content.trim()) {
        previewEl.innerHTML = '<div class="preview-empty-state"><h3>Plain Text Preview</h3><p>Drop a text file.</p></div>';
        return;
      }
      previewEl.innerHTML = `<div style="white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 0.9rem; line-height: 1.6;">${escapeHtml(content)}</div>`;
    },

    async convert(context, onProgress) {
      const { filename, previewEl, options } = context;

      if (!window.html2pdf) {
        throw new Error('PDF generator engine (html2pdf.js) is not loaded.');
      }

      onProgress?.(30, 'Formatting text...');

      let pdfFilename = filename || 'document.pdf';
      if (!pdfFilename.toLowerCase().endsWith('.pdf')) {
        const lastDot = pdfFilename.lastIndexOf('.');
        if (lastDot > 0) pdfFilename = pdfFilename.substring(0, lastDot);
        pdfFilename = `${pdfFilename}.pdf`;
      }

      const opt = {
        margin: [15, 15, 15, 15],
        filename: pdfFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: options?.paperFormat || 'a4', orientation: options?.orientation || 'portrait' }
      };

      try {
        const worker = window.html2pdf().set(opt).from(previewEl);
        const blob = await worker.output('blob');
        await worker.save();
        onProgress?.(100, 'Complete');
        return { blob, filename: pdfFilename };
      } catch (err) {
        console.error('[MicroConvert] Text PDF conversion failed:', err);
        throw new Error(`PDF generation failed: ${err.message || 'Unknown error'}`);
      }
    }
  };

  registry.register(mdToPdfConverter);
  registry.register(txtToPdfConverter);

  // --- 4. Application UI Controller ---
  const state = {
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

  let debounceTimer = null;

  function showNotification(type, message, autoDismissMs = 6000) {
    const container = document.getElementById('notifications-area');
    if (!container) return;

    const banner = document.createElement('div');
    banner.className = `notification-banner ${type}`;

    let iconSvg = '';
    if (type === 'danger') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    } else if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
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

    banner.querySelector('.notification-close').addEventListener('click', () => banner.remove());
    container.appendChild(banner);

    if (autoDismissMs > 0) {
      setTimeout(() => banner.remove(), autoDismissMs);
    }
  }

  function clearNotifications() {
    const container = document.getElementById('notifications-area');
    if (container) container.innerHTML = '';
  }

  function updateStatusIndicators() {
    const fileTag = document.getElementById('current-file-name');
    const wordCountTag = document.getElementById('stat-word-count');
    const charCountTag = document.getElementById('stat-char-count');
    const lineCountTag = document.getElementById('stat-line-count');

    if (fileTag) fileTag.textContent = state.currentFilename || 'untitled.md';

    const text = state.currentContent;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 0;

    if (wordCountTag) wordCountTag.textContent = `${words} words`;
    if (charCountTag) charCountTag.textContent = `${chars} chars`;
    if (lineCountTag) lineCountTag.textContent = `${lines} lines`;
  }

  async function renderCurrentContent() {
    const previewSheet = document.getElementById('document-sheet');
    const downloadBtn = document.getElementById('download-btn');
    if (!previewSheet) return;

    const converter = registry.getActive();
    try {
      await converter.parseAndRender(state.currentContent, previewSheet);
      const hasContent = state.currentContent.trim().length > 0;
      if (downloadBtn) {
        downloadBtn.disabled = !hasContent || state.isConverting;
      }
    } catch (err) {
      showNotification('danger', `Syntax / Rendering Warning: ${err.message || 'Failed to parse'}`);
      if (downloadBtn) downloadBtn.disabled = true;
    }
  }

  function handleFileSelection(file) {
    const activeConverter = registry.getActive();
    const validation = activeConverter.validate(file, 'non-empty-check');

    if (!validation.valid) {
      const alt = registry.findForFile(file);
      if (alt) {
        registry.setActive(alt.id);
        const sel = document.getElementById('converter-select');
        if (sel) sel.value = alt.id;
        showNotification('info', `Automatically switched to ${alt.name} for this file format.`);
      } else {
        showNotification('danger', validation.error || `File format "${file.name}" is not supported.`);
        return;
      }
    }

    if (validation.warning) {
      showNotification('warning', validation.warning);
    } else {
      clearNotifications();
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result || '';
        if (text.trim().length === 0) {
          showNotification('warning', `File "${file.name}" is empty. Please select a file with content.`);
          state.currentContent = '';
          state.currentFilename = file.name;
          state.currentFile = file;
          const textarea = document.getElementById('raw-editor');
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

        const textarea = document.getElementById('raw-editor');
        if (textarea) textarea.value = text;

        updateStatusIndicators();
        renderCurrentContent();
        showNotification('success', `Loaded "${file.name}" successfully.`, 3000);
      } catch (err) {
        showNotification('danger', `Failed to read file: ${err.message}`);
      }
    };
    reader.onerror = () => {
      showNotification('danger', `Error reading file "${file.name}". Please try again.`);
    };
    reader.readAsText(file);
  }

  async function executeConversion() {
    if (state.isConverting) return;

    const previewSheet = document.getElementById('document-sheet');
    const downloadBtn = document.getElementById('download-btn');
    const overlay = document.getElementById('converting-overlay');
    const converter = registry.getActive();

    if (!previewSheet || !state.currentContent.trim()) {
      showNotification('warning', 'Please provide document content before converting.');
      return;
    }

    const validation = converter.validate(state.currentFile, state.currentContent);
    if (!validation.valid) {
      showNotification('danger', validation.error || 'Document validation failed.');
      return;
    }

    state.isConverting = true;
    if (downloadBtn) {
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = '<div class="spinner"></div><span>Generating PDF...</span>';
    }
    if (overlay) overlay.classList.add('active');

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
          const msg = document.getElementById('converting-message');
          if (msg) msg.textContent = message;
        }
      );
      showNotification('success', `PDF successfully generated: "${result.filename}"`, 5000);
    } catch (err) {
      console.error('[MicroConvert] Conversion error:', err);
      showNotification('danger', `Conversion failed: ${err.message || 'Unknown PDF error'}`);
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
      if (overlay) overlay.classList.remove('active');
    }
  }

  function init() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const textarea = document.getElementById('raw-editor');
    const previewSheet = document.getElementById('document-sheet');
    const downloadBtn = document.getElementById('download-btn');
    const loadSampleBtn = document.getElementById('load-sample-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const converterSelect = document.getElementById('converter-select');

    const formatSelect = document.getElementById('paper-format-select');
    const orientationSelect = document.getElementById('orientation-select');
    const marginSelect = document.getElementById('margin-select');

    const tabEditorBtn = document.getElementById('tab-editor-btn');
    const tabPreviewBtn = document.getElementById('tab-preview-btn');
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');

    if (converterSelect) {
      converterSelect.addEventListener('change', (e) => {
        registry.setActive(e.target.value);
        if (fileInput) fileInput.accept = registry.getActive().acceptExtensions.join(',');
        renderCurrentContent();
        showNotification('info', `Active tool: ${registry.getActive().name}`, 3000);
      });
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach((name) => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('drag-active');
        });
      });

      ['dragleave', 'dragend'].forEach((name) => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('drag-active');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-active');
        if (e.dataTransfer?.files?.length > 0) {
          handleFileSelection(e.dataTransfer.files[0]);
        }
      });

      window.addEventListener('dragover', (e) => e.preventDefault(), false);
      window.addEventListener('drop', (e) => e.preventDefault(), false);
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files?.length > 0) {
          handleFileSelection(fileInput.files[0]);
        }
      });
    }

    if (textarea) {
      textarea.addEventListener('input', () => {
        state.currentContent = textarea.value;
        updateStatusIndicators();
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderCurrentContent, 150);
      });
    }

    if (formatSelect) {
      formatSelect.addEventListener('change', () => {
        state.options.paperFormat = formatSelect.value;
      });
    }

    if (orientationSelect) {
      orientationSelect.addEventListener('change', () => {
        state.options.orientation = orientationSelect.value;
      });
    }

    if (marginSelect) {
      marginSelect.addEventListener('change', () => {
        state.options.margin = marginSelect.value;
        previewSheet.classList.remove('margin-compact', 'margin-spacious');
        if (state.options.margin === 'compact') previewSheet.classList.add('margin-compact');
        else if (state.options.margin === 'spacious') previewSheet.classList.add('margin-spacious');
      });
    }

    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', () => {
        const active = registry.getActive();
        state.currentFile = null;
        state.currentFilename = active.sampleFilename;
        state.currentContent = active.sampleContent;
        if (textarea) textarea.value = state.currentContent;
        clearNotifications();
        updateStatusIndicators();
        renderCurrentContent();
        showNotification('success', `Loaded sample document (${active.sampleFilename})`, 4000);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        state.currentFile = null;
        state.currentFilename = 'untitled.md';
        state.currentContent = '';
        if (textarea) textarea.value = '';
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
          showNotification('success', 'Copied markdown to clipboard!', 3000);
        } catch (err) {
          showNotification('warning', 'Could not copy to clipboard automatically.');
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', executeConversion);
    }

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

    renderCurrentContent();
    updateStatusIndicators();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
