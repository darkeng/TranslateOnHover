// Handle UI logic and saving/loading settings

const defaultSettings = {
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

document.addEventListener('DOMContentLoaded', () => {
  // Localize UI
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = chrome.i18n.getMessage(el.getAttribute('data-i18n-placeholder'));
  });

  const form = document.getElementById('settings-form');
  const providerRadios = document.querySelectorAll('input[name="provider"]');
  const deeplSettings = document.getElementById('deepl-settings');
  const customSettings = document.getElementById('custom-settings');
  const microsoftSettings = document.getElementById('microsoft-settings');
  const browserSettings = document.getElementById('browser-settings');
  const saveStatus = document.getElementById('save-status');
  const nativeSource = document.getElementById('nativeSource');
  const nativeStatus = document.getElementById('native-status');
  const nativeDownload = document.getElementById('native-download');
  const nativeOpenTab = document.getElementById('native-open-tab');
  const nativeDiagnose = document.getElementById('native-diagnose');
  const nativeReport = document.getElementById('native-report');

  // A toolbar popup is torn down the moment it loses focus, which kills a
  // multi-megabyte language pack download halfway through. Downloads therefore
  // only run when this page is a real tab.
  let inPopup = true;
  try {
    chrome.tabs.getCurrent((tab) => {
      inPopup = !tab;
      const checked = document.querySelector('input[name="provider"]:checked');
      if (checked && checked.value === 'browser') refreshNativeStatus();
    });
  } catch (e) { inPopup = false; }

  // Load saved settings
  chrome.storage.sync.get(defaultSettings, (items) => {
    document.getElementById('modifier').value = items.modifier;
    document.getElementById('targetLang').value = items.targetLang;
    document.querySelector(`input[name="provider"][value="${items.provider}"]`).checked = true;
    document.getElementById('deeplKey').value = items.deeplKey;
    document.getElementById('azureKey').value = items.azureKey;
    document.getElementById('azureRegion').value = items.azureRegion;
    document.getElementById('customUrl').value = items.customUrl;
    
    // Auto-Reverse settings
    const autoReverseCheckbox = document.getElementById('autoReverse');
    const altLangGroup = document.getElementById('altLang-group');
    
    autoReverseCheckbox.checked = items.autoReverse;
    document.getElementById('altLang').value = items.altLang;
    altLangGroup.style.display = items.autoReverse ? 'block' : 'none';
    
    autoReverseCheckbox.addEventListener('change', (e) => {
      altLangGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    updateProviderUI(items.provider);
  });

  document.getElementById('targetLang').addEventListener('change', refreshNativeStatus);
  nativeSource.addEventListener('change', refreshNativeStatus);
  nativeDownload.addEventListener('click', downloadLanguagePack);
  nativeDiagnose.addEventListener('click', runDiagnostics);
  nativeOpenTab.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') });
    window.close();
  });

  // Handle provider UI toggling
  providerRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateProviderUI(e.target.value);
    });
  });

  function updateProviderUI(provider) {
    deeplSettings.classList.add('hidden');
    customSettings.classList.add('hidden');
    microsoftSettings.classList.add('hidden');
    browserSettings.classList.add('hidden');

    if (provider === 'deepl') {
      deeplSettings.classList.remove('hidden');
    } else if (provider === 'custom') {
      customSettings.classList.remove('hidden');
    } else if (provider === 'microsoft') {
      microsoftSettings.classList.remove('hidden');
    } else if (provider === 'browser') {
      browserSettings.classList.remove('hidden');
      refreshNativeStatus();
    }
  }

  // --- Built-in Translator API (Chrome 138+ / Edge 148+) ---

  function msg(key, fallback, subs) {
    return chrome.i18n.getMessage(key, subs) || fallback;
  }

  // The Translator API speaks short BCP 47 codes; our UI carries a few regional ones.
  function toNativeLang(code) {
    if (!code) return '';
    const lower = code.toLowerCase();
    if (lower === 'zh-tw' || lower === 'zh-hant') return 'zh-Hant';
    if (lower.startsWith('zh')) return 'zh';
    return lower.split('-')[0];
  }

  function currentPair() {
    return {
      sourceLanguage: toNativeLang(nativeSource.value),
      targetLanguage: toNativeLang(document.getElementById('targetLang').value)
    };
  }

  function setNativeStatus(text, state) {
    nativeStatus.textContent = text;
    nativeStatus.className = 'native-status' + (state ? ' ' + state : '');
  }

  async function refreshNativeStatus() {
    if (typeof Translator === 'undefined' || typeof Translator.availability !== 'function') {
      setNativeStatus(msg('nativeUnsupported', 'Not available in this browser. Requires Chrome 138+ or Edge 148+ on desktop.'), 'error');
      nativeDownload.classList.add('hidden');
      return;
    }

    const pair = currentPair();
    if (pair.sourceLanguage === pair.targetLanguage) {
      setNativeStatus(msg('nativeSamePair', 'Source and target are the same language.'), '');
      nativeDownload.classList.add('hidden');
      return;
    }

    nativeDownload.classList.add('hidden');
    nativeOpenTab.classList.add('hidden');
    setNativeStatus(msg('nativeChecking', 'Checking...'), '');

    let availability;
    try {
      availability = await Translator.availability(pair);
    } catch (e) {
      setNativeStatus(e.message, 'error');
      return;
    }

    if (availability === 'available') {
      setNativeStatus(msg('nativeReady', 'Ready. This pair is installed and works offline.'), 'success');
    } else if (availability === 'downloading') {
      setNativeStatus(msg('nativeDownloading', 'Downloading language pack...'), '');
    } else if (availability === 'downloadable') {
      if (inPopup) {
        setNativeStatus(msg('nativeNeedsTab', 'The language pack must be downloaded from a full tab: this popup closes as soon as it loses focus.'), '');
        nativeOpenTab.classList.remove('hidden');
      } else {
        setNativeStatus(msg('nativeDownloadable', 'Supported, but the language pack is not installed yet.'), '');
        nativeDownload.classList.remove('hidden');
      }
    } else {
      setNativeStatus(msg('nativeUnavailablePair', 'This language pair is not supported on-device.'), 'error');
    }
  }

  // create() has been observed to stay pending after downloadprogress reaches
  // 100%, while the pack does finish installing. Polling availability alongside
  // it lets whichever signal arrives first decide the outcome.
  async function pollUntilAvailable(pair, ms) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      let state;
      try {
        state = await Translator.availability(pair);
      } catch (e) {
        continue;
      }
      if (state === 'available') return 'available';
    }
    throw new Error(msg('nativeTimeout', 'The download did not respond. Check your connection and try again.'));
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(msg('nativeTimeout', 'The download did not respond. Check your connection and try again.'))), ms)),
    ]);
  }

  function createWithProgress(pair) {
    return Translator.create({
      ...pair,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          setNativeStatus(msg('nativeDownloading', 'Downloading language pack...') + ' ' + Math.round(e.loaded * 100) + '%', '');
        });
      }
    });
  }

  // One-click report so a failure can be described precisely instead of guessed at.
  async function runDiagnostics() {
    nativeReport.classList.remove('hidden');
    nativeReport.textContent = msg('nativeChecking', 'Checking...');

    const pair = currentPair();
    const lines = [];
    const add = (k, v) => lines.push(k.padEnd(22) + ': ' + v);

    add('user agent', navigator.userAgent.replace(/^Mozilla\/5.0 /, ''));
    add('page context', inPopup ? 'POPUP (downloads blocked)' : 'full tab');
    add('Translator API', typeof Translator);
    add('LanguageDetector API', typeof LanguageDetector);
    add('pair', pair.sourceLanguage + ' -> ' + pair.targetLanguage);

    if (typeof Translator !== 'undefined') {
      try {
        add('availability', await Translator.availability(pair));
      } catch (e) {
        add('availability', 'THREW ' + e.name + ': ' + e.message);
      }
    }

    const stored = await new Promise((r) => chrome.storage.sync.get(defaultSettings, r));
    add('saved provider', stored.provider);
    add('saved target', stored.targetLang);
    add('saved modifier', stored.modifier);
    add('auto-reverse', stored.autoReverse ? 'on -> ' + stored.altLang : 'off');

    nativeReport.textContent = lines.join('\n');
  }

  async function downloadLanguagePack() {
    // Called from a click so the API has the user activation it needs to download.
    const pair = currentPair();
    nativeDownload.disabled = true;
    setNativeStatus(msg('nativeDownloading', 'Downloading language pack...'), '');

    try {
      const attempt = async () => Promise.race([
        createWithProgress(pair).then((t) => { t.destroy(); return 'created'; }),
        pollUntilAvailable(pair, 180000),
      ]);

      try {
        await attempt();
      } catch (first) {
        // The very first create() in a profile can fail with NotSupportedError
        // while the browser installs the shared translation component. Give it
        // a moment and try once more before reporting failure.
        if (first.name !== 'NotSupportedError') throw first;
        setNativeStatus(msg('nativePreparing', 'Preparing the browser translation engine...'), '');
        await new Promise((r) => setTimeout(r, 2000));
        await attempt();
      }

      nativeDownload.classList.add('hidden');
      setNativeStatus(msg('nativeReady', 'Ready. This pair is installed and works offline.'), 'success');
    } catch (e) {
      const hint = e.name === 'NotSupportedError'
        ? msg('nativeRetryHint', 'The browser is still setting up its translation engine. Wait a minute and try again.')
        : e.message;
      setNativeStatus(hint, 'error');
    } finally {
      nativeDownload.disabled = false;
    }
  }

  // Handle form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const settings = {
      modifier: document.getElementById('modifier').value,
      targetLang: document.getElementById('targetLang').value,
      provider: document.querySelector('input[name="provider"]:checked').value,
      deeplKey: document.getElementById('deeplKey').value,
      azureKey: document.getElementById('azureKey').value,
      azureRegion: document.getElementById('azureRegion').value,
      customUrl: document.getElementById('customUrl').value,
      autoReverse: document.getElementById('autoReverse').checked,
      altLang: document.getElementById('altLang').value
    };

    chrome.storage.sync.set(settings, () => {
      saveStatus.textContent = chrome.i18n.getMessage('savedMsg') || 'Settings saved!';
      saveStatus.className = 'status-msg success show';
      
      setTimeout(() => {
        saveStatus.classList.remove('show');
      }, 2500);
    });
  });
});
