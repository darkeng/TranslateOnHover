let settings = {
  modifier: 'ctrl',
  targetLang: 'es',
  provider: 'google',
  deeplKey: '',
  azureKey: '',
  azureRegion: 'global',
  customUrl: '',
  autoReverse: false,
  altLang: 'en'
};

let tooltipElement = null;
let tooltipContent = null;
let currentText = '';
let isHoveringSelection = false;
let mouseX = 0;
let mouseY = 0;
let lockedX = 0;
let lockedY = 0;
let hideTimeout = null;
let loadingDelayTimer = null;
let isPinned = false; // tooltip is holding an action the user must click

// ---------------------------------------------------------------------------
// Native on-device engine (Translator API, Chrome 138+ / Edge 148+)
// It lives here and not in the service worker because the Translator API is
// unavailable in workers, so every native translation is resolved in-page.
// ---------------------------------------------------------------------------

const nativeTranslators = new Map(); // "src>tgt" -> Promise<Translator>
const nativeCache = new Map();       // "src>tgt|text" -> translated string
let nativeQueue = Promise.resolve(); // the API rejects overlapping translate() calls

function msg(key, fallback, subs) {
  try {
    return chrome.i18n.getMessage(key, subs) || fallback;
  } catch (e) {
    return fallback;
  }
}

function nativeAvailable() {
  return typeof Translator !== 'undefined' && typeof Translator.availability === 'function';
}

// The Translator API speaks short BCP 47 codes; our UI carries a few regional ones.
function toNativeLang(code) {
  if (!code) return '';
  const lower = code.toLowerCase();
  if (lower === 'zh-tw' || lower === 'zh-hant') return 'zh-Hant';
  if (lower.startsWith('zh')) return 'zh';
  return lower.split('-')[0];
}

// What the page says it is written in, used whenever detection comes up empty.
function declaredPageLang() {
  const meta = document.querySelector('meta[http-equiv="content-language"]');
  return (document.documentElement.lang || (meta && meta.content) || '').trim();
}

// Detection order: CLD through chrome.i18n (no model download), then the page's
// own declaration. CLD legitimately answers "und" on the short snippets hovering
// produces, and "und" is not a language - it must never reach the Translator.
function detectSourceLang(text) {
  return new Promise((resolve) => {
    const fallback = () => resolve(declaredPageLang());

    if (!chrome.i18n || !chrome.i18n.detectLanguage) return fallback();

    try {
      chrome.i18n.detectLanguage(text, (detection) => {
        if (chrome.runtime.lastError || !detection || !detection.languages) return fallback();
        const hit = detection.languages.find((l) => l.language && l.language !== 'und');
        resolve(hit ? hit.language : declaredPageLang());
      });
    } catch (e) {
      fallback();
    }
  });
}

async function getNativeTranslator(sourceLanguage, targetLanguage) {
  const key = `${sourceLanguage}>${targetLanguage}`;
  if (nativeTranslators.has(key)) return nativeTranslators.get(key);

  const pending = (async () => {
    const status = await Translator.availability({ sourceLanguage, targetLanguage });

    if (status === 'unavailable') {
      throw new Error(msg('errorNativePair', 'This language pair is not supported on-device.'));
    }

    // Every other state is worth an attempt: availability can lag behind a pack
    // that is already usable, and create() reports the real problem.
    try {
      return await Translator.create({ sourceLanguage, targetLanguage });
    } catch (e) {
      if (status === 'available') throw e;
      // Hovering grants no user activation, so the download cannot start here.
      // Hand the caller something it can turn into a one-click offer instead.
      const err = new Error(msg('errorNativeDownload', 'This language pack is not installed yet.'));
      err.tohDownload = { sourceLanguage, targetLanguage };
      throw err;
    }
  })();

  nativeTranslators.set(key, pending);
  pending.catch(() => nativeTranslators.delete(key));
  return pending;
}

async function translateNative(text) {
  if (!nativeAvailable()) {
    throw new Error(msg('errorNativeUnsupported', 'On-device translation needs Chrome 138+ or Edge 148+ on desktop.'));
  }

  const source = toNativeLang(await detectSourceLang(text));
  if (!source) {
    throw new Error(msg('errorNativeSource', 'Could not detect the source language of this text.'));
  }

  let target = toNativeLang(settings.targetLang);
  if (settings.autoReverse && source === target) {
    target = toNativeLang(settings.altLang || 'en');
  }
  if (source === target) return text;

  const cacheKey = `${source}>${target}|${text}`;
  if (nativeCache.has(cacheKey)) return nativeCache.get(cacheKey);

  const translator = await getNativeTranslator(source, target);

  // Serialize: the engine blocks on concurrent requests, and hovering fires fast.
  nativeQueue = nativeQueue.catch(() => {}).then(() => translator.translate(text));
  const result = await nativeQueue;

  if (nativeCache.size > 300) nativeCache.clear();
  nativeCache.set(cacheKey, result);
  return result;
}

// Initialization
function init() {
  // Load settings
  chrome.storage.sync.get(settings, (loadedSettings) => {
    settings = { ...settings, ...loadedSettings };
  });

  // Listen for setting changes
  chrome.storage.onChanged.addListener((changes) => {
    for (let [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
  });

  // Create tooltip DOM
  createTooltip();

  // Event Listeners
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('selectionchange', handleSelectionChange);
  document.addEventListener('mousedown', (e) => {
    if (isPinned && tooltipElement.contains(e.target)) return;
    hideTooltip();
  });
  document.addEventListener('keyup', handleKeyUp);
  // A pinned offer would otherwise sit there until the user clicks something
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPinned) hideTooltip();
  });
}

function createTooltip() {
  tooltipElement = document.createElement('div');
  tooltipElement.className = 'toh-tooltip-wrapper';
  
  const tooltipInner = document.createElement('div');
  tooltipInner.className = 'toh-tooltip';
  
  tooltipContent = document.createElement('div');
  tooltipContent.className = 'toh-tooltip-content';
  
  tooltipInner.appendChild(tooltipContent);
  tooltipElement.appendChild(tooltipInner);
  
  document.body.appendChild(tooltipElement);
}

// Logic to check modifiers
function checkModifier(e) {
  if (settings.modifier === 'none') return true;
  if (settings.modifier === 'ctrl') return e.ctrlKey;
  if (settings.modifier === 'shift') return e.shiftKey;
  if (settings.modifier === 'alt') return e.altKey;
  if (settings.modifier === 'ctrl+shift') return e.ctrlKey && e.shiftKey;
  return false;
}

// Get text under cursor (either selected text or nearest sentence)
function getHoverText(x, y) {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && selection.toString().trim() !== '') {
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const padding = 5;
      if (
        x >= rect.left - padding && x <= rect.right + padding &&
        y >= rect.top - padding && y <= rect.bottom + padding
      ) {
        return { isHovering: true, text: selection.toString().trim() };
      }
    }
  }
  
  // No active selection hovered, look for text under cursor
  let range;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    let pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }

  if (range && range.startContainer) {
    const node = range.startContainer;
    
    // Find the enclosing block element to extract the full logical sentence
    let blockParent = node;
    while (blockParent && blockParent.parentNode && blockParent !== document.body) {
      if (blockParent.nodeType === 1) {
        const display = window.getComputedStyle(blockParent).display;
        // Stop going up if we hit a non-inline element (like p, div, li)
        if (!display.includes('inline') && display !== 'contents') {
          break;
        }
      }
      blockParent = blockParent.parentNode;
    }

    if (blockParent) {
      let fullText = '';
      let globalOffset = -1;

      function walk(n) {
        if (n.nodeType === 3) { // TEXT_NODE
          if (n === node) {
            globalOffset = fullText.length + range.startOffset;
          }
          fullText += n.nodeValue;
        } else if (n.nodeType === 1) { // ELEMENT_NODE
          // Do not extract text from scripts or styles
          if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
          for (let child = n.firstChild; child; child = child.nextSibling) {
            walk(child);
          }
        }
      }
      walk(blockParent);

      if (globalOffset !== -1) {
        const regex = /[\.\n;!\?]/g;
        let match;
        let start = 0;
        let end = fullText.length;

        while ((match = regex.exec(fullText)) !== null) {
          if (match.index < globalOffset) {
            start = match.index + 1;
          } else if (match.index >= globalOffset && end === fullText.length) {
            end = match.index + 1;
            break;
          }
        }

        const sentence = fullText.substring(start, end).trim();
        // Prevent huge translations if block parent is massive
        if (sentence.length > 0 && sentence.length < 800) {
          return { isHovering: true, text: sentence };
        }
      }
    }
  }
  
  return { isHovering: false, text: '' };
}

function handleKeyUp(e) {
  if (settings.modifier === 'none' || isPinned) return;
  if (tooltipElement && tooltipElement.classList.contains('toh-visible')) {
    if (!checkModifier(e)) {
      hideTooltip();
    }
  }
}

function handleMouseMove(e) {
  mouseX = e.clientX;
  mouseY = e.clientY;

  // While an offer is on screen the tooltip stays put until it is clicked or
  // dismissed, otherwise it would vanish on the way to the button.
  if (isPinned) return;

  // Optimization: Only compute caret range if modifier is pressed
  if (!checkModifier(e)) {
    if (tooltipElement.classList.contains('toh-visible')) {
      hideTooltipDebounced();
    }
    return;
  }

  const hoverState = getHoverText(mouseX, mouseY);
  isHoveringSelection = hoverState.isHovering;

  if (isHoveringSelection) {
    if (hoverState.text !== currentText) {
      // Prevent rapid re-firing
      if (tooltipElement.classList.contains('toh-visible') && hoverState.text === currentText) return;
      
      currentText = hoverState.text;
      lockedX = e.pageX;
      lockedY = e.pageY;
      showLoading(lockedX, lockedY, currentText);
      requestTranslation(currentText);
    }
  } else {
    // Moved cursor away from selection/text
    if (tooltipElement.classList.contains('toh-visible')) {
      hideTooltipDebounced();
    }
  }
}

function handleSelectionChange() {
  if (isPinned) return;
  const selection = window.getSelection();
  if (!selection || selection.toString().trim() === '') {
    hideTooltip();
    currentText = '';
  }
}

function showLoading(x, y, textToWrap) {
  clearTimeout(hideTimeout);
  clearTimeout(loadingDelayTimer);
  
  loadingDelayTimer = setTimeout(() => {
    tooltipContent.innerHTML = `<span class="toh-skeleton"></span>`;
    tooltipContent.querySelector('.toh-skeleton').textContent = textToWrap;
    positionTooltip(x, y);
    tooltipElement.classList.add('toh-visible');
  }, 100);
}

function positionTooltip(x, y) {
  // x, y are absolute document coordinates (pageX, pageY)
  // Ensure we don't bleed off screen
  const rect = tooltipElement.getBoundingClientRect();
  let left = x + 15; // Offset from cursor
  let top = y + 20;

  // Horizontal bounds
  if (left + rect.width > window.innerWidth + window.scrollX - 20) {
    left = window.innerWidth + window.scrollX - rect.width - 20;
  }
  
  // Vertical bounds
  if (top + rect.height > window.innerHeight + window.scrollY - 20) {
    // Show above cursor
    top = y - rect.height - 15;
  }

  tooltipElement.style.left = `${left}px`;
  tooltipElement.style.top = `${top}px`;
}

function hideTooltip() {
  clearTimeout(loadingDelayTimer);
  unpinTooltip();
  tooltipElement.classList.remove('toh-visible');
  currentText = ''; // Allow re-translation of same text later
}

function hideTooltipDebounced() {
  if (isPinned) return;
  // Add a small delay so moving mouse off selection by 1 pixel doesn't immediately hide
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    if (!isHoveringSelection) hideTooltip();
  }, 400); 
}

function requestTranslation(text) {
  // The browser engine never touches the network, so it bypasses the service worker.
  if (settings.provider === 'browser') {
    translateNative(text).then(
      (result) => {
        if (currentText !== text) return;
        showResult(result);
        positionTooltip(lockedX, lockedY);
      },
      (error) => {
        // Surfaced in the page console too, since the tooltip has room for one line.
        console.warn('[Translate On Hover] on-device translation failed:', error);
        if (currentText !== text) return;
        if (error.tohDownload) {
          offerLanguagePack(error.tohDownload, text);
          return;
        }
        showError(error.message);
      }
    );
    return;
  }

  chrome.runtime.sendMessage(
    { action: 'translate', text: text, settings: settings },
    (response) => {
      // Check if user has already moved on
      if (currentText !== text) return;
      
      if (!response) {
        showError(chrome.i18n.getMessage('errorContext') || 'Extension context invalidated. Refresh page.');
        return;
      }

      if (response.success) {
        showResult(response.result);
        // Reposition after content loads since size may change, strictly anchored to locked coords
        positionTooltip(lockedX, lockedY);
      } else {
        showError(response.error);
      }
    }
  );
}

// A missing language pack is a one-click fix, not an error the user has to go
// hunt down in a settings screen. The click is also what supplies the user
// activation the Translator API requires before it will download anything.
function languageName(code) {
  try {
    return new Intl.DisplayNames([navigator.language], { type: 'language' }).of(code) || code;
  } catch (e) {
    return code;
  }
}

function offerLanguagePack(pair, text) {
  clearTimeout(loadingDelayTimer);
  clearTimeout(hideTimeout);

  const label = languageName(pair.sourceLanguage) + ' → ' + languageName(pair.targetLanguage);

  tooltipContent.className = 'toh-tooltip-content';
  tooltipContent.textContent = '';

  const button = document.createElement('button');
  button.className = 'toh-action';
  button.textContent = msg('tooltipDownload', 'Download') + ' ' + label;

  const note = document.createElement('span');
  note.className = 'toh-note';
  note.textContent = msg('tooltipOneTime', 'One-time download, then it works offline');

  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    button.disabled = true;
    button.textContent = msg('tooltipDownloading', 'Downloading') + ' 0%';

    const create = () => Translator.create({
      ...pair,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          button.textContent = msg('tooltipDownloading', 'Downloading') + ' ' + Math.round(e.loaded * 100) + '%';
        });
      }
    });

    try {
      let translator;
      try {
        translator = await create();
      } catch (first) {
        // The first ever create() in a profile fails with NotSupportedError
        // while the browser installs its shared translation component. Observed
        // on Chrome; a second attempt moments later succeeds.
        if (first.name !== 'NotSupportedError') throw first;
        button.textContent = msg('tooltipPreparing', 'Preparing engine...');
        await new Promise((r) => setTimeout(r, 2500));
        translator = await create();
      }

      nativeTranslators.set(pair.sourceLanguage + '>' + pair.targetLanguage, Promise.resolve(translator));
      unpinTooltip();
      showResult(await translateNative(text));
    } catch (e) {
      console.warn('[Translate On Hover] language pack download failed:', e);
      unpinTooltip();
      showError(msg('errorNativeDownloadFailed', 'The language pack could not be downloaded.'));
    }
  });

  tooltipContent.appendChild(button);
  tooltipContent.appendChild(note);

  isPinned = true;
  tooltipElement.classList.add('toh-actionable', 'toh-visible');
  positionTooltip(lockedX, lockedY);
}

function unpinTooltip() {
  isPinned = false;
  tooltipElement.classList.remove('toh-actionable');
}

function showResult(text) {
  clearTimeout(loadingDelayTimer);
  // Providers echo markup back verbatim (the on-device engine keeps tags intact),
  // so the translated string is rendered as plain text, never as HTML.
  tooltipContent.textContent = text;
  tooltipContent.className = 'toh-tooltip-content';
  tooltipElement.classList.add('toh-visible');
}

function showError(errText) {
  clearTimeout(loadingDelayTimer);
  tooltipContent.innerHTML = errText;
  tooltipContent.className = 'toh-tooltip-content toh-tooltip-error';
  tooltipElement.classList.add('toh-visible');
}

// Ensure init doesn't break if placed in `<head>`
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
