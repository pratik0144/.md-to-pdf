/**
 * ============================================================================
 * CONVERTER ARCHITECTURE - REGISTRY PATTERN (`registry.ts`)
 * ============================================================================
 * 
 * DESIGN PATTERN: REGISTRY PATTERN & SINGLETON
 * 
 * What is a Registry?
 * Think of a Registry as a phone book or service directory for our application.
 * Instead of hardcoding `if (file.endsWith('.md')) { runMarkdown(); } else if ...`,
 * we create a central registry where converter modules introduce themselves.
 * 
 * Key Advantages:
 * 1. Open/Closed Principle (SOLID): Open for extension, closed for modification.
 *    To add a new converter (e.g. CSV-to-PDF), you NEVER touch `app.ts` or `index.astro`.
 *    You just call `converterRegistry.register(myNewConverter)`.
 * 2. Automatic File-Type Routing:
 *    When a user drops an unknown file onto the drop zone, the registry scans all
 *    registered converters to find which one can handle that file extension or MIME type.
 * 3. Singleton Pattern:
 *    We instantiate exactly ONE global instance (`export const converterRegistry = new ConverterRegistry()`).
 *    All parts of the application share this same instance so they stay synchronized.
 */

import type { Converter } from './types';

class ConverterRegistry {
  /**
   * Internal storage mapping unique IDs (e.g. 'md-to-pdf') to their Converter implementation.
   * We use a JavaScript `Map` because it provides fast O(1) lookups and preserves insertion order.
   */
  private converters: Map<string, Converter> = new Map();

  /**
   * Tracks which converter is currently selected by the user.
   * Defaults to 'md-to-pdf' as the primary hero tool of MicroConvert.
   */
  private activeConverterId: string = 'md-to-pdf';

  /**
   * Registers a new converter into the system.
   * If a converter with the same ID already exists, it warns the developer in the console.
   * 
   * @param converter An object fulfilling the `Converter` interface
   */
  register(converter: Converter): void {
    if (this.converters.has(converter.id)) {
      console.warn(`[ConverterRegistry] Overwriting existing converter: ${converter.id}`);
    }
    this.converters.set(converter.id, converter);
  }

  /**
   * Retrieves a specific converter by its unique identifier.
   * 
   * @param id The converter ID string (e.g., 'md-to-pdf')
   * @returns The Converter instance if found, or `undefined`
   */
  get(id: string): Converter | undefined {
    return this.converters.get(id);
  }

  /**
   * Returns a list of all currently registered converters.
   * Used by the UI controller to populate the dropdown `<select>` element dynamically.
   * 
   * @returns Array of Converter objects
   */
  getAll(): Converter[] {
    return Array.from(this.converters.values());
  }

  /**
   * Retrieves the currently active converter selected in the UI.
   * 
   * Fallback Behavior:
   * If the active ID doesn't exist, it safely falls back to the first registered converter.
   * If no converters are registered at all, it throws a descriptive error.
   * 
   * @returns The active Converter object
   */
  getActive(): Converter {
    const active = this.converters.get(this.activeConverterId);
    if (!active) {
      // Graceful fallback to whatever first converter was registered
      const first = this.converters.values().next().value;
      if (!first) {
        throw new Error('[ConverterRegistry] No converters registered in system.');
      }
      return first;
    }
    return active;
  }

  /**
   * Changes the active converter.
   * Returns true if successful, or false if the requested converter ID was not found.
   * 
   * @param id The converter ID to activate
   * @returns boolean indicating success
   */
  setActive(id: string): boolean {
    if (this.converters.has(id)) {
      this.activeConverterId = id;
      return true;
    }
    return false;
  }

  /**
   * Smart Auto-Detection Router:
   * Inspects a user's dropped/selected file and determines which converter can handle it.
   * Checks both:
   * 1. Filename extension (e.g. `.md`, `.markdown`, `.txt`)
   * 2. Browser-detected MIME type (e.g. `text/markdown`, `text/plain`)
   * 
   * Why check both?
   * Operating systems and browsers often guess MIME types incorrectly or leave them blank,
   * especially for developer formats like Markdown. Checking the file extension acts as a reliable fallback.
   * 
   * @param file The browser File object
   * @returns The matching Converter, or undefined if unsupported
   */
  findForFile(file: File): Converter | undefined {
    const name = file.name.toLowerCase();
    const mime = file.type.toLowerCase();

    for (const converter of this.converters.values()) {
      // Check if file name ends with any of the converter's accepted extensions
      const extMatch = converter.acceptExtensions.some((ext) => name.endsWith(ext.toLowerCase()));
      // Check if browser MIME type matches any of the converter's accepted MIME types
      const mimeMatch = converter.acceptMimeTypes.some((m) => mime && m.toLowerCase() === mime);
      
      if (extMatch || mimeMatch) {
        return converter;
      }
    }
    return undefined;
  }
}

/**
 * Global Singleton Export.
 * By exporting this single instance, every module in the application accesses
 * the exact same registry state without needing a complicated state-management library.
 */
export const converterRegistry = new ConverterRegistry();
