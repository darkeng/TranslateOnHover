# Translate On Hover 🌐

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/)

A sleek, lightweight, and modern Chromium browser extension that allows you to instantly translate selected text or the sentence you are hovering over by just pressing a modifier key (like `Ctrl` or `Shift`).

Designed with a rich, dark-mode minimalist aesthetic—no heavy borders, zero lag, and no forced dependencies.

## ✨ Features

- **Blazing Fast On-Hover Translation**: Detects your mouse position and automatically captures the context of the sentence under your pointer (or translates your active selection).
- **Customizable Triggers**: Configure whether translation requires you to hold `Ctrl`, `Shift`, `Alt`, a combination, or no key at all.
- **Support for Multiple Providers**:
  - **Google Translate**: Built-in free endpoints with virtually zero configuration required.
  - **DeepL API**: Top-tier translation quality if you provide your personal DeepL Authentication Key.
  - **Custom API**: Power-user feature to hook your own private API gateway natively using URL placeholders (e.g. `https://myapi.dev/?lang={targetLang}&q={text}`).
- **Beautiful Glassmorphism UI**: A native, highly-optimized floating tooltip that integrates flawlessly over any webpage with absolutely zero visual noise.
- **Built-in Internationalization (i18n)**: Automatically adapts the interface based on your web browser's language.

## 🚀 Installation 

Since this extension is not yet published exclusively to the Google Chrome Web Store or Edge Add-ons, you can load it in Developer Mode.

1. Clone or download this repository.
2. Navigate to your browser's extensions page (`chrome://extensions/` or `edge://extensions/`).
3. Turn on the **Developer mode** toggle in the top-right corner.
4. Click on **Load unpacked** (Cargar extensión sin empaquetar).
5. Select the root folder of this repository (`TranslateOnHover`).

## 🛠️ Testing Environment (Windows only)
We provide a standalone testing script for developers to rapidly boot a clean instance of Microsoft Edge without cluttering their main session.

1. Right click `test.ps1` and select **Run with PowerShell**.
2. Edge will boot up isolated, with the extension already loaded.
3. Test by opening an article and holding `Ctrl` over the text.

## 🧩 Tech Stack
* Vanilla JS / ES Modules
* Vanilla CSS / Variables & Glassmorphism filters
* Chromium Manifest V3 Compatibility Blueprint
* Python (Strictly used for static icon generation)
