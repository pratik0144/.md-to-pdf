/**
 * MicroConvert - Converter Registry
 * Manages registered converters and provides lookup / routing functions
 */

import type { Converter } from './types';

class ConverterRegistry {
  private converters: Map<string, Converter> = new Map();
  private activeConverterId: string = 'md-to-pdf';

  /**
   * Register a new converter
   */
  register(converter: Converter): void {
    if (this.converters.has(converter.id)) {
      console.warn(`[ConverterRegistry] Overwriting existing converter: ${converter.id}`);
    }
    this.converters.set(converter.id, converter);
  }

  /**
   * Get converter by ID
   */
  get(id: string): Converter | undefined {
    return this.converters.get(id);
  }

  /**
   * List all registered converters
   */
  getAll(): Converter[] {
    return Array.from(this.converters.values());
  }

  /**
   * Get the currently active converter
   */
  getActive(): Converter {
    const active = this.converters.get(this.activeConverterId);
    if (!active) {
      const first = this.converters.values().next().value;
      if (!first) {
        throw new Error('[ConverterRegistry] No converters registered in system.');
      }
      return first;
    }
    return active;
  }

  /**
   * Set active converter by ID
   */
  setActive(id: string): boolean {
    if (this.converters.has(id)) {
      this.activeConverterId = id;
      return true;
    }
    return false;
  }

  /**
   * Find suitable converter for an uploaded file
   */
  findForFile(file: File): Converter | undefined {
    const name = file.name.toLowerCase();
    const mime = file.type.toLowerCase();

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

export const converterRegistry = new ConverterRegistry();
