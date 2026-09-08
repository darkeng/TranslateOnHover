# Privacy Policy for "Translate On Hover"

**Effective Date:** September 7, 2026

Thank you for choosing to use **Translate On Hover** ("the Extension"). Your privacy and security are incredibly important to us. This Privacy Policy outlines what information the Extension accesses, how it is handled, and your rights regarding your data.

## 1. Information Collection and Usage

**Translate On Hover does NOT collect, store, or transmit your personal data to the developer.** 

The Extension operates locally in your browser and strictly requires access to the text on the webpages you visit (`<all_urls>` permission) in order to function properly. However, it only interacts with webpage content under the following specific condition:
- You actively press your configured modifier key (e.g., `Ctrl` or `Shift`) and hover your mouse over a specific sentence, OR you explicitly highlight text using your mouse.

Only the exact string of text currently under your cursor is temporarily captured by your local machine in order to process the translation.

## 2. On-Device Translation (Browser engine)

When the **Browser** provider is selected, translation is performed entirely by your browser's built-in Translator API on your own machine. **No text ever leaves your device**, no network request is made, and no third party is involved. Language packs are downloaded once by the browser itself, directly from your browser vendor, and translation then works offline.

Detection of the source language in this mode also runs locally, through your browser's own language detection.

## 3. Third-Party Translation Services

If you select any provider other than **Browser**, the text string captured by the Extension is transmitted securely via HTTPS directly to the Translation Provider you have chosen in your settings.

We currently support the following third-party APIs:
- **Google Translate API (Public Endpoint)**
- **Microsoft Azure Cognitive Services** (Requires your personal API Key)
- **DeepL API** (Requires your personal API Key)
- **Custom APIs** (User-defined endpoints)

**We do not middleman or route your data.** Requests are sent directly from your browser to these providers. By using one of these providers, your translated text is subject to the privacy policies of the respective service you select.

Translations are cached locally so that repeating the same hover does not repeat the request.

## 4. Storage of API Keys and Preferences

Any authentication keys (such as DeepL or Microsoft Azure API Keys) and configuration preferences you input into the Extension are stored locally on your device or synced strictly via your browser's official secured synchronization infrastructure (via `chrome.storage.sync`). 

We do not have access to your API keys, nor do we track your translation history.

## 5. Analytics and Tracking

**We do not track you.** The Extension contains no analytics, no telemetry, no background tracking, and no invasive scripts. 

## 6. Changes to this Privacy Policy
We may update our Privacy Policy occasionally to reflect changes in our practices or for operational, legal, or regulatory reasons. 

If you have any questions or concerns about this privacy policy, please consult our official repository on GitHub: [https://github.com/darkeng/TranslateOnHover](https://github.com/darkeng/TranslateOnHover).
