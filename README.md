# MicroConvert 📄➡️📑

**MicroConvert** is a single-page, 100% client-side web utility engineered for Markdown (.md) to print-ready PDF conversion. It is built with an extensible, modular architecture allowing future converters to be added without rewriting or touching the UI shell.

---

## 🔒 Strict Privacy & Client-Side Guarantees

* **100% In-Browser:** All file reading (`FileReader`), Markdown parsing (`marked.js`), HTML sanitization (`DOMPurify`), code highlighting (`highlight.js`), and PDF rendering (`html2pdf.js`) happen purely in local browser memory.
* **Zero Backend, Zero Database:** Nothing about your files, content, or metadata ever leaves your machine.
* **No Telemetry / Tracking:** Zero tracking scripts, zero analytics, zero cookies, and zero `localStorage` of document contents.
* **Offline Ready:** Includes a Service Worker (`public/sw.js`) that caches CDN assets on first load, enabling complete offline functionality.

---

## 🚀 Quick Start

### Option A: Modern Astro Development Server
```bash
# Start Astro dev server in background mode (per project guidelines)
npx astro dev --background

# Check status
npx astro dev status

# View logs
npx astro dev logs

# Stop server
npx astro dev stop
```
Open **[http://localhost:4321](http://localhost:4321)** in your browser.

### Option B: Build Static Production Site
```bash
npm run build
```
The static site is generated in `dist/`.

### Option C: Standalone Vanilla Files (Zero Node.js Required)
Double-click `standalone/index.html` directly in Finder or file manager, or serve via any static file server:
```bash
python3 -m http.server 8000 --directory standalone
```

---

## ✨ Features

1. **Drag-and-Drop / Browse:**
   - Drop any `.md` or `.markdown` file directly into the drop zone.
   - Click to browse files.
   - Or paste/edit markdown directly in the left-hand editor pane.

2. **CommonMark & GitHub Flavored Markdown (GFM):**
   - Headings (H1 to H6) with clean typography.
   - Fenced code blocks with language tags and syntax highlighting via `highlight.js`.
   - Tables with bordered headers and alternating rows.
   - Blockquotes, bold, italic, strikethrough, and nested lists.
   - Task lists with checkboxes (`- [x]`, `- [ ]`).

3. **Smart PDF Page Breaks:**
   - Automatically avoids awkward breaks inside code blocks (`pre`), tables (`table`, `tr`), headings (`h1`–`h6`), and blockquotes (`blockquote`).
   - Customizable page settings:
     - **Format:** A4, Letter, Legal
     - **Orientation:** Portrait, Landscape
     - **Margins:** Normal (14mm), Compact (10mm), Spacious (18mm)

4. **Edge Case Resilience:**
   - **Empty file:** Warning banner shown; conversion button disabled.
   - **Non-.md file:** Immediate rejection with clear alert banner.
   - **Large file (>5MB):** Warning notification displayed while still allowing conversion.
   - **Malformed syntax / error:** Conversion wrapped in `try/catch` with a friendly error banner instead of a blank screen or crash.

5. **Extensible Architecture:**
   - Converters implement a standard `Converter` contract (`src/converters/types.ts`):
     - `validate(file, content)`
     - `parseAndRender(content, previewEl)`
     - `convert(context, onProgress)`
   - Registered into `ConverterRegistry` (`src/converters/registry.ts`).
   - Adding a new tool (e.g., `txtToPdf`, `mdToDocx`, `csvToJson`) requires only defining the converter and registering it with `converterRegistry.register(...)`.

---

## 📁 Project Structure

```text
proj- md to pdf/
├── public/
│   ├── sample.md           # Sample GFM document for 1-click testing
│   └── sw.js               # Service worker for offline caching
├── src/
│   ├── components/
│   │   ├── Header.astro              # Header with logo, privacy badge & tool switcher
│   │   ├── DropZone.astro            # Drag & drop upload target
│   │   ├── Toolbar.astro             # Metadata counters & PDF settings
│   │   ├── EditorPreview.astro       # Two-pane editor + printed page preview
│   │   ├── NotificationBanner.astro  # Alert banner area
│   │   └── Footer.astro              # Privacy guarantees & offline badge
│   ├── converters/
│   │   ├── types.ts                  # Converter interface definitions
│   │   ├── registry.ts               # Registry & router for file converters
│   │   ├── md-to-pdf.ts              # Markdown to PDF converter module
│   │   └── txt-to-pdf.ts             # Plain Text to PDF converter (extensibility demo)
│   ├── layouts/
│   │   └── Layout.astro              # HTML shell & CDN scripts
│   ├── pages/
│   │   └── index.astro               # Main page assembly
│   ├── scripts/
│   │   └── app.ts                    # UI controller connecting UI & converters
│   └── styles/
│       ├── global.css                # App layout, dropzone, and UI styling
│       └── preview.css               # Printed page simulation & PDF print rules
├── standalone/                       # Zero-build standalone distribution
│   ├── index.html
│   ├── style.css
│   └── script.js
├── astro.config.mjs
└── package.json
```
