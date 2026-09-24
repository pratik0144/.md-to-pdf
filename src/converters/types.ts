/**
 * MicroConvert - Extensible Converter Architecture
 * Type definitions and contract for file converters
 */

export interface ConverterOptions {
  paperFormat?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  margin?: 'compact' | 'normal' | 'spacious';
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

export interface ConversionResult {
  blob: Blob;
  filename: string;
  downloadUrl?: string;
}

export interface ConversionContext {
  file: File | null;
  filename: string;
  content: string;
  previewEl: HTMLElement;
  options?: ConverterOptions;
}

export interface Converter {
  id: string;
  name: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  acceptExtensions: string[];
  acceptMimeTypes: string[];
  outputExtension: string;
  outputMimeType: string;
  maxFileSize: number;
  sampleFilename: string;
  sampleContent: string;

  /**
   * Validate uploaded file metadata and raw content
   */
  validate(file: File | null, content: string): ValidationResult;

  /**
   * Parse raw content and render it into the preview element
   */
  parseAndRender(content: string, previewEl: HTMLElement): Promise<void> | void;

  /**
   * Convert the parsed representation or raw content into the output format
   */
  convert(
    context: ConversionContext,
    onProgress?: (percent: number, message: string) => void
  ): Promise<ConversionResult>;
}
