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
  const { provider, targetLang, deeplKey, customUrl } = settings;

  if (provider === 'google') {
    return await translateGoogle(text, targetLang);
  } else if (provider === 'deepl') {
    if (!deeplKey) throw new Error('DeepL API key is missing. Please set it in options.');
    return await translateDeepL(text, targetLang, deeplKey);
  } else if (provider === 'custom') {
    if (!customUrl) throw new Error('Custom URL is missing. Please set it in options.');
    return await translateCustom(text, targetLang, customUrl);
  }
  
  throw new Error('Unknown translation provider.');
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
