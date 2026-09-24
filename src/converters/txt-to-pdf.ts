/**
 * ============================================================================
 * CONVERTER IMPLEMENTATION - PLAIN TEXT TO PDF (`txt-to-pdf.ts`)
 * ============================================================================
 * 
 * WHY THIS FILE EXISTS (EXTENSIBILITY DEMONSTRATION):
 * This module proves that the architectural pattern of MicroConvert works!
 * 
 * By defining this second converter according to the `Converter` interface
 * and registering it with `converterRegistry.register(txtToPdfConverter)`,
 * the entire user interface automatically gains the ability to:
 * 1. Switch between tools in the header dropdown.
 * 2. Accept `.txt`, `.text`, and `.log` files via drag-and-drop.
 * 3. Render clean monospaced plain text previews.
 * 4. Generate formatted PDF documents from server logs, notes, or code dumps.
 * 
 * ALL WITHOUT CHANGING A SINGLE LINE OF HTML IN THE UI COMPONENTS!
 */

import type { Converter, ConversionContext, ConversionResult, ValidationResult } from './types';

export const txtToPdfConverter: Converter = {
  // Unique tool ID
  id: 'txt-to-pdf',
  name: 'Plain Text to PDF',
  description: 'Convert plain text files (.txt) into clean, monospaced or proportional PDF documents',
  inputLabel: 'Text File (.txt)',
  outputLabel: 'PDF Document (.pdf)',

  // Supported extensions and MIME types
  acceptExtensions: ['.txt', '.text', '.log'],
  acceptMimeTypes: ['text/plain'],

  outputExtension: '.pdf',
  outputMimeType: 'application/pdf',
  maxFileSize: 5 * 1024 * 1024, // 5MB limit

  // Built-in sample text document
  sampleFilename: 'SampleLog.txt',
  sampleContent: `MICROCONVERT SYSTEM AUDIT LOG
=============================
Date: 2026-09-03
Platform: 100% In-Browser Execution
Status: OPERATIONAL

[INFO] Initialized local converter registry.
[INFO] Loaded marked.js and DOMPurify engines into sandbox.
[INFO] Zero remote telemetry configured.
[INFO] All memory buffers wiped on tab closure.

Summary:
Extensible architecture successfully registered both Markdown to PDF and Plain Text to PDF converters.
`,

  /**
   * Pre-flight validation for plain text files
   */
  validate(file: File | null, content: string): ValidationResult {
    // 1. Check file extension if a file was provided
    if (file) {
      const name = file.name.toLowerCase();
      const hasExt = this.acceptExtensions.some((ext) => name.endsWith(ext));
      if (!hasExt) {
        return {
          valid: false,
          error: `Invalid file format: "${file.name}". Expected text format (${this.acceptExtensions.join(', ')}).`
        };
      }
    }

    // 2. Reject empty documents
    if (!content || content.trim().length === 0) {
      return {
        valid: false,
        error: 'Text document is empty. Please provide text content.'
      };
    }

    return { valid: true };
  },

  /**
   * Render plain text into the preview container.
   * Notice how different this is from Markdown:
   * Instead of running `marked.js` and `highlight.js`, plain text simply needs
   * HTML escaping and `white-space: pre-wrap` with a monospaced font!
   */
  async parseAndRender(content: string, previewEl: HTMLElement): Promise<void> {
    if (!content || content.trim().length === 0) {
      previewEl.innerHTML = `
        <div class="preview-empty-state">
          <h3>Text Document Preview</h3>
          <p>Drop a <code>.txt</code> file to preview.</p>
        </div>
      `;
      return;
    }

    // Render plain text with preserved whitespace inside a styled monospace container
    previewEl.innerHTML = `
      <div style="white-space: pre-wrap; font-family: ui-monospace, Menlo, Monaco, monospace; font-size: 0.9rem; line-height: 1.6; color: #1e293b;">
        ${escapeHtml(content)}
      </div>
    `;
  },

  /**
   * Convert plain text to PDF using html2pdf.js
   */
  async convert(
    context: ConversionContext,
    onProgress?: (percent: number, message: string) => void
  ): Promise<ConversionResult> {
    const { filename, previewEl, options } = context;

    if (!window.html2pdf) {
      throw new Error('PDF generator engine is not loaded.');
    }

    onProgress?.(25, 'Formatting plain text output...');

    // Ensure output ends with .pdf
    let pdfFilename = filename || 'document.pdf';
    if (!pdfFilename.toLowerCase().endsWith('.pdf')) {
      const lastDot = pdfFilename.lastIndexOf('.');
      if (lastDot > 0) {
        pdfFilename = pdfFilename.substring(0, lastDot);
      }
      pdfFilename = `${pdfFilename}.pdf`;
    }

    // Standard layout options
    const opt = {
      margin: [15, 15, 15, 15],
      filename: pdfFilename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: 'mm',
        format: options?.paperFormat || 'a4',
        orientation: options?.orientation || 'portrait'
      }
    };

    onProgress?.(60, 'Generating PDF...');

    try {
      // Offscreen clone to prevent viewport scroll clipping
      const clone = previewEl.cloneNode(true) as HTMLElement;
      clone.style.maxWidth = '800px';
      clone.style.margin = '0 auto';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
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
        const blob = await worker.output('blob');
        await worker.save();
        onProgress?.(100, 'Complete');
        return { blob, filename: pdfFilename };
      } finally {
        if (offscreen.parentNode) {
          offscreen.parentNode.removeChild(offscreen);
        }
      }
    } catch (err: any) {
      console.error('[MicroConvert] Text PDF conversion failed:', err);
      throw new Error(`PDF generation failed: ${err?.message || 'Unknown error'}`);
    }
  }
};

/**
 * Basic HTML escaping helper to prevent XSS in plain text preview
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
