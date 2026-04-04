// Handle UI logic and saving/loading settings

const defaultSettings = {
  modifier: 'ctrl',
  targetLang: 'es',
  provider: 'google',
  deeplKey: '',
  customUrl: ''
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
  const saveStatus = document.getElementById('save-status');

  // Load saved settings
  chrome.storage.sync.get(defaultSettings, (items) => {
    document.getElementById('modifier').value = items.modifier;
    document.getElementById('targetLang').value = items.targetLang;
    document.querySelector(`input[name="provider"][value="${items.provider}"]`).checked = true;
    document.getElementById('deeplKey').value = items.deeplKey;
    document.getElementById('customUrl').value = items.customUrl;
    
    updateProviderUI(items.provider);
  });

  // Handle provider UI toggling
  providerRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateProviderUI(e.target.value);
    });
  });

  function updateProviderUI(provider) {
    if (provider === 'deepl') {
      deeplSettings.classList.remove('hidden');
      customSettings.classList.add('hidden');
    } else if (provider === 'custom') {
      customSettings.classList.remove('hidden');
      deeplSettings.classList.add('hidden');
    } else {
      deeplSettings.classList.add('hidden');
      customSettings.classList.add('hidden');
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
      customUrl: document.getElementById('customUrl').value
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
