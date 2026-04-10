// Background script / Service Worker
// Handles translation API requests to bypass CORS

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request.text, request.settings)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

async function handleTranslation(text, settings) {
  const { provider, targetLang, deeplKey, customUrl, azureKey, azureRegion, autoReverse, altLang } = settings;

  let finalTargetLang = targetLang;

  // 0. Auto-Reverse Bi-Directional Detection
  if (autoReverse && chrome.i18n && chrome.i18n.detectLanguage) {
    try {
      const detection = await new Promise(resolve => chrome.i18n.detectLanguage(text, resolve));
      if (detection && detection.isReliable && detection.languages && detection.languages.length > 0) {
        const detected = detection.languages[0].language; // e.g. "es", "en", "zh"
        // If detected language matches the primary target language, flip to the alternative language
        if (targetLang.toLowerCase().startsWith(detected.toLowerCase())) {
          finalTargetLang = altLang || 'en';
        }
      }
    } catch(e) {}
  }

  // 1. Storage Cache interception
  // Sanitize for chrome local storage key format
  const safeText = text.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
  const cacheKey = `tc_${provider}_${finalTargetLang}_${safeText}_${text.length}`;
  
  try {
    const data = await chrome.storage.local.get(cacheKey);
    if (data && data[cacheKey] && data[cacheKey].originalText === text) {
      return data[cacheKey].translatedText;
    }
  } catch(e) {}

  // 2. Perform Network Translation
  let result = null;
  if (provider === 'google') {
    result = await translateGoogle(text, finalTargetLang);
  } else if (provider === 'microsoft') {
    if (!azureKey) throw new Error('Azure API key is missing. Please set it in options.');
    result = await translateMicrosoft(text, finalTargetLang, azureKey, azureRegion);
  } else if (provider === 'deepl') {
    if (!deeplKey) throw new Error('DeepL API key is missing. Please set it in options.');
    result = await translateDeepL(text, finalTargetLang, deeplKey);
  } else if (provider === 'custom') {
    if (!customUrl) throw new Error('Custom URL is missing. Please set it in options.');
    result = await translateCustom(text, finalTargetLang, customUrl);
  } else {
    throw new Error('Unknown translation provider.');
  }

  // 3. Storing it asynchronously for next hover execution
  if (result) {
    try {
      await chrome.storage.local.set({ [cacheKey]: { originalText: text, translatedText: result }});
    } catch (e) {}
  }

  return result;
}

async function translateGoogle(text, targetLang) {
  // Using the free public Google Translate API endpoint
  // Note: This is an undocumented endpoint often used in scripts, but subject to rate limits.
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Translate API error: ${response.status}`);
  
  const data = await response.json();
  // The response is an array where the first item contains array(s) of translated segments.
  if (data && data[0] && data[0].length > 0) {
    let translatedText = '';
    for (let i = 0; i < data[0].length; i++) {
        translatedText += data[0][i][0];
    }
    return translatedText;
  }
  throw new Error('Failed to parse Google Translate response.');
}

async function translateDeepL(text, targetLang, apiKey) {
  // DeepL Free API URL vs Pro API URL
  const isFree = apiKey.endsWith(':fx');
  const baseUrl = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
  
  const body = new URLSearchParams({
    text: text,
    target_lang: targetLang.toUpperCase()
  });

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    if (response.status === 403) throw new Error('DeepL authentication failed. Check your API key.');
    if (response.status === 456) throw new Error('DeepL quota exceeded.');
    throw new Error(`DeepL API error: ${response.status}`);
  }

  const data = await response.json();
  if (data && data.translations && data.translations.length > 0) {
    return data.translations[0].text;
  }
  throw new Error('Failed to parse DeepL response.');
}

async function translateMicrosoft(text, targetLang, apiKey, region) {
  const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLang}`;
  
  const headers = {
    'Ocp-Apim-Subscription-Key': apiKey,
    'Content-type': 'application/json'
  };
  if (region && region !== 'global') {
    headers['Ocp-Apim-Subscription-Region'] = region;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify([{ text: text }])
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Microsoft authentication failed. Check your API key and region.');
    throw new Error(`Microsoft API error: ${response.status}`);
  }

  const data = await response.json();
  if (data && data[0] && data[0].translations && data[0].translations[0]) {
    return data[0].translations[0].text;
  }
  throw new Error('Failed to parse Microsoft Translator response.');
}

async function translateCustom(text, targetLang, customUrl) {
  // Replace {text} and {targetLang} in the user's custom URL
  const finalUrl = customUrl
    .replace('{text}', encodeURIComponent(text))
    .replace('{targetLang}', encodeURIComponent(targetLang));

  // We assume a simple GET request for the custom provider that returns plain text,
  // or a simple JSON with a standard format. For robustness, if we return directly,
  // we might just return the raw text or the `translatedText` key.
  const response = await fetch(finalUrl);
  if (!response.ok) throw new Error(`Custom API error: ${response.status}`);
  
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    return data.translatedText || data.translation || data.text || JSON.stringify(data);
  } else {
    return await response.text();
  }
}
