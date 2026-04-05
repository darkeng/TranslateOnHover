# Translate On Hover 🌐

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/)

A sleek, lightweight, and modern Chromium browser extension that allows you to instantly translate selected text or the sentence you are hovering over by just pressing a modifier key (like `Ctrl` or `Shift`).

Designed with a rich, dark-mode minimalist aesthetic—no heavy borders, zero lag, and no forced dependencies.

## ✨ Features

- **Blazing Fast On-Hover Translation**: Detects your mouse position and automatically captures the context of the sentence under your pointer by accurately traversing DOM elements (or translates your active selection).
- **Customizable Triggers**: Configure whether translation requires you to hold `Ctrl`, `Shift`, `Alt`, a combination, or no key at all.
- **Support for Multiple Providers**:
  - **Google Translate**: Built-in free endpoints with virtually zero configuration required.
  - **Microsoft Translator**: Built-in support for Azure Cognitive Services Translator API (Free F0 Tier). Requires your Azure Key and Region.
  - **DeepL API**: Top-tier translation quality if you provide your personal DeepL Authentication Key.
  - **Custom API**: Power-user feature to hook your own private API gateway natively using URL placeholders (e.g. `https://myapi.dev/?lang={targetLang}&q={text}`).
- **Beautiful Glassmorphism UI**: A native, highly-optimized floating tooltip that integrates flawlessly over any webpage with absolutely zero visual noise.
- **Built-in Internationalization (i18n)**: Automatically adapts the interface based on your web browser's language.

## 🚀 Building & Installation

Since this is an optimized project, it uses `Node.js` and `esbuild` to compress everything and bundle it for production. 

### 1. Compile the Extension
1. Clone or download this repository.
2. Ensure you have Node.js installed. Open your terminal in the root folder.
3. Run `npm install` to download build dependencies (esbuild, archiver, sharp).
4. Run `npm run build`.
   - *This will minify JavaScript/CSS, automatically generate premium resized icons, and output everything perfectly into the `dist/` folder and `TranslateOnHover_Production.zip`.*

### 2. Install on Browser
1. Navigate to your browser's extensions page (`chrome://extensions/` or `edge://extensions/`).
2. Turn on the **Developer mode** toggle in the top-right corner.
3. Click on **Load unpacked** (Cargar extensión sin empaquetar).
4. Select the **`dist/`** folder of this repository (or drag and drop the zip).

## 🛠️ Testing Environment (Windows only)
We provide a standalone testing script for developers to rapidly boot a clean instance of Microsoft Edge without cluttering their main session.

1. Right click `test.ps1` and select **Run with PowerShell**.
2. Assuming you already ran `npm run build`, Edge will boot up isolated with the compiled extension already loaded.
3. It will automatically load the English Wikipedia. Test by holding `Ctrl` over the text!

## 🧩 Tech Stack
* Vanilla JS / ES Modules
* Vanilla CSS / Variables & Glassmorphism filters
* Chromium Manifest V3 Compatibility Blueprint
* Node.js, `esbuild` for minification, and `sharp` for precise AI-image asset processing.

## 📄 License & Credits
Authored by **[darkeng](https://github.com/darkeng)**.  
Released under the **[MIT License](LICENSE)**.
