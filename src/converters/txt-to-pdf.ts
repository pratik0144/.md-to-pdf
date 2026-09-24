/**
 * MicroConvert - Plain Text to PDF Converter Module (Extensibility Demonstration)
 * Proves that new converters can be added cleanly into the registry without altering the UI shell.
 */

import type { Converter, ConversionContext, ConversionResult, ValidationResult } from './types';

export const txtToPdfConverter: Converter = {
  id: 'txt-to-pdf',
  name: 'Plain Text to PDF',
  description: 'Convert plain text files (.txt) into clean, monospaced or proportional PDF documents',
  inputLabel: 'Text File (.txt)',
  outputLabel: 'PDF Document (.pdf)',
  acceptExtensions: ['.txt', '.text', '.log'],
  acceptMimeTypes: ['text/plain'],
  outputExtension: '.pdf',
  outputMimeType: 'application/pdf',
  maxFileSize: 5 * 1024 * 1024,

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

  validate(file: File | null, content: string): ValidationResult {
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

    if (!content || content.trim().length === 0) {
      return {
        valid: false,
        error: 'Text document is empty. Please provide text content.'
      };
    }

    return { valid: true };
  },

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

    // Render plain text with preserved whitespace inside styled monospace container
    previewEl.innerHTML = `
      <div style="white-space: pre-wrap; font-family: ui-monospace, Menlo, Monaco, monospace; font-size: 0.9rem; line-height: 1.6;">
        ${escapeHtml(content)}
      </div>
    `;
  },

  async convert(
    context: ConversionContext,
    onProgress?: (percent: number, message: string) => void
  ): Promise<ConversionResult> {
    const { filename, previewEl, options } = context;

    if (!window.html2pdf) {
      throw new Error('PDF generator engine is not loaded.');
    }

    onProgress?.(25, 'Formatting plain text output...');

    let pdfFilename = filename || 'document.pdf';
    if (!pdfFilename.toLowerCase().endsWith('.pdf')) {
      const lastDot = pdfFilename.lastIndexOf('.');
      if (lastDot > 0) {
        pdfFilename = pdfFilename.substring(0, lastDot);
      }
      pdfFilename = `${pdfFilename}.pdf`;
    }

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
