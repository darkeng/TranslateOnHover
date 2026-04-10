// State and Settings
let settings = {
  modifier: 'ctrl',
  targetLang: 'es',
  provider: 'google',
  deeplKey: '',
  customUrl: ''
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
  document.addEventListener('mousedown', () => hideTooltip());
  document.addEventListener('keyup', handleKeyUp);
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
  if (settings.modifier === 'none') return;
  if (tooltipElement && tooltipElement.classList.contains('toh-visible')) {
    if (!checkModifier(e)) {
      hideTooltip();
    }
  }
}

function handleMouseMove(e) {
  mouseX = e.clientX;
  mouseY = e.clientY;

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
  tooltipElement.classList.remove('toh-visible');
  currentText = ''; // Allow re-translation of same text later
}

function hideTooltipDebounced() {
  // Add a small delay so moving mouse off selection by 1 pixel doesn't immediately hide
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    if (!isHoveringSelection) hideTooltip();
  }, 400); 
}

function requestTranslation(text) {
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

function showResult(text) {
  clearTimeout(loadingDelayTimer);
  tooltipContent.innerHTML = text;
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
