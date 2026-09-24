/**
 * ============================================================================
 * CONVERTER ARCHITECTURE - TYPE DEFINITIONS (`types.ts`)
 * ============================================================================
 * 
 * DESIGN PATTERN: STRATEGY PATTERN & INTERFACE SEGREGATION
 * 
 * Why does this file exist?
 * If you write a web tool that only converts Markdown to PDF, it is tempting to
 * just hardcode everything in one giant file. But that makes the code rigid and
 * hard to maintain or expand.
 * 
 * Instead, this project uses the STRATEGY PATTERN:
 * 1. We define a contract (`Converter` interface below) for what ANY converter
 *    must look like and what methods it must provide.
 * 2. `mdToPdfConverter` and `txtToPdfConverter` are interchangeable "Strategies"
 *    that implement this contract.
 * 3. The user interface (UI) does NOT need to know how PDF conversion works.
 *    It only knows how to talk to this interface!
 * 
 * As a learner, notice how TypeScript interfaces help us specify the shapes of
 * objects before we write the implementation.
 */

/**
 * Options configurable by the user via the UI toolbar dropdowns.
 * These are passed into the converter when the user initiates conversion.
 */
export interface ConverterOptions {
  /** Target physical paper size: 'a4' (international standard), 'letter' (US standard), or 'legal' */
  paperFormat?: 'a4' | 'letter' | 'legal';

  /** Page layout orientation: 'portrait' (vertical) or 'landscape' (horizontal) */
  orientation?: 'portrait' | 'landscape';

  /** Page margin sizes: 'compact' (10mm), 'normal' (14mm), or 'spacious' (18mm) */
  margin?: 'compact' | 'normal' | 'spacious';

  /**
   * Index signature allowing future converters to pass custom options
   * (e.g., custom theme, fontSize, watermark) without modifying this interface.
   */
  [key: string]: any;
}

/**
 * The outcome of running pre-flight checks on a user-provided file or text content.
 * Returning structured validation data allows the UI to show distinct banners:
 * - Red banner for fatal errors (`valid: false`)
 * - Yellow banner for non-fatal warnings (`warning: '...'`)
 */
export interface ValidationResult {
  /** True if the document can proceed to rendering / conversion; false if rejected */
  valid: boolean;

  /** Explanatory message when validation fails (e.g., "File is empty", "Invalid extension") */
  error?: string;

  /** Non-fatal advisory message (e.g., "File is over 5MB, rendering may take time") */
  warning?: string;
}

/**
 * The final output produced after a successful conversion.
 */
export interface ConversionResult {
  /**
   * The binary data of the generated file as a browser Blob (Binary Large Object).
   * In-browser memory representation of raw bytes.
   */
  blob: Blob;

  /** Suggested filename for saving to the user's hard drive (e.g., "document.pdf") */
  filename: string;

  /** Optional object URL (created via `URL.createObjectURL(blob)`) for direct downloads */
  downloadUrl?: string;
}

/**
 * The full context and state passed to a converter during execution.
 * Bundles the source file, extracted text, the DOM preview element, and user settings.
 */
export interface ConversionContext {
  /** The original browser `File` object (null if the user typed directly into the editor) */
  file: File | null;

  /** The document's name, used to name the output file */
  filename: string;

  /** The raw textual content of the document */
  content: string;

  /**
   * Reference to the live HTML preview container (`#document-sheet`).
   * The converter can clone or read this DOM element to generate print output.
   */
  previewEl: HTMLElement;

  /** User-selected settings (format, orientation, margins) */
  options?: ConverterOptions;
}

/**
 * The Core Converter Interface ("The Contract").
 * 
 * Every conversion engine (Markdown-to-PDF, Text-to-PDF, etc.) MUST implement
 * this interface. This guarantees that the UI controller (`app.ts`) can treat
 * all converters identically.
 */
export interface Converter {
  /** Unique machine-readable identifier (e.g., 'md-to-pdf', 'txt-to-pdf') */
  id: string;

  /** Human-readable display name shown in the UI switcher (e.g., 'Markdown to PDF') */
  name: string;

  /** Detailed description of what this converter does */
  description: string;

  /** UI label describing expected input (e.g., 'Markdown (.md)') */
  inputLabel: string;

  /** UI label describing generated output (e.g., 'PDF Document (.pdf)') */
  outputLabel: string;

  /** File extensions this converter accepts (e.g., ['.md', '.markdown']) */
  acceptExtensions: string[];

  /** MIME types this converter accepts (e.g., ['text/markdown', 'text/plain']) */
  acceptMimeTypes: string[];

  /** Output file extension appended to downloaded files (e.g., '.pdf') */
  outputExtension: string;

  /** Output MIME type (e.g., 'application/pdf') */
  outputMimeType: string;

  /** Maximum recommended file size in bytes before showing a performance warning */
  maxFileSize: number;

  /** Default filename for the built-in sample document */
  sampleFilename: string;

  /** Built-in demo content loaded when clicking the "Load Sample" button */
  sampleContent: string;

  /**
   * Phase 1: Pre-Flight Validation
   * Checks file extension, empty content, and size limits before attempting to process.
   * 
   * @param file The browser File object (or null if manual text entry)
   * @param content The raw string content of the document
   * @returns ValidationResult with valid boolean and optional error/warning strings
   */
  validate(file: File | null, content: string): ValidationResult;

  /**
   * Phase 2: Live Preview Rendering
   * Converts raw content into formatted HTML and updates the given preview DOM element.
   * Supports async operations (e.g., if a parser uses WebAssembly or web workers).
   * 
   * @param content The raw text to parse and display
   * @param previewEl The HTML container where rendered output should be mounted
   */
  parseAndRender(content: string, previewEl: HTMLElement): Promise<void> | void;

  /**
   * Phase 3: Export Execution
   * Converts the document into the target output format and triggers the file save.
   * 
   * @param context Complete conversion context including settings and preview DOM
   * @param onProgress Optional callback to update the UI progress bar / loading message
   * @returns Promise resolving to the final ConversionResult (Blob + filename)
   */
  convert(
    context: ConversionContext,
    onProgress?: (percent: number, message: string) => void
  ): Promise<ConversionResult>;
}
