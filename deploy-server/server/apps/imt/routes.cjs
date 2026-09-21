const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../../config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

// Helper: Normaliserer base64-billede til data URL og rå base64
function normalizeImage(base64Input) {
  if (!base64Input) return { dataUrl: '', rawBase64: '' };
  if (base64Input.startsWith('data:')) {
    const raw = base64Input.split(',')[1] || '';
    return { dataUrl: base64Input, rawBase64: raw };
  }
  return {
    dataUrl: `data:image/png;base64,${base64Input}`,
    rawBase64: base64Input
  };
}

// Status endpoint
router.get('/status', (req, res) => {
  const cfg = loadConfig();
  res.json({
    status: 'ok',
    app: 'ImT',
    message: 'ImT Backend er klar',
    configuredProvider: cfg.imt?.provider || 'ollama',
    configuredModel: cfg.imt?.model || 'qwen2.5vl:3b'
  });
});

// Test forbindelse til vision AI
router.post('/test', async (req, res) => {
  try {
    const cfg = loadConfig();
    const { apiUrl, apiKey, provider } = req.body;
    const targetProvider = provider || cfg.imt?.provider || (cfg.activeProvider === 'gemini' ? 'gemini' : 'ollama');

    // Test Gemini Vision
    if (targetProvider === 'gemini') {
      const gKey = apiKey || cfg.providers?.gemini?.apiKey;
      if (!gKey) return res.status(400).json({ success: false, error: 'Ingen Gemini API-nøgle fundet på serveren.' });
      const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${gKey}`, { signal: AbortSignal.timeout(5000) });
      if (!testRes.ok) return res.status(400).json({ success: false, error: 'Gemini API-nøgle er ugyldig.' });
      return res.json({ success: true, message: 'Gemini Vision er klar!', models: ['gemini-1.5-flash', 'gemini-2.0-flash'] });
    }

    // Test Ollama Vision
    const defaultHost = cfg.providers?.ollama?.host || 'http://127.0.0.1:11434';
    let url = (apiUrl || defaultHost).trim().replace(/\/+$/, '').replace('//localhost', '//127.0.0.1');

    let testUrl = `${url.replace(/\/v1$/, '')}/api/tags`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(testUrl, { headers, signal: controller.signal }).finally(() => clearTimeout(timeout));
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `Server svarede med status ${response.status} (${response.statusText})`
      });
    }

    const data = await response.json();
    const models = (data.models || []).map(m => m.name || m.model);
    const visionModels = models.filter(m => m.includes('vl') || m.includes('vision') || m.includes('llava') || m.includes('minicpm'));

    return res.json({
      success: true,
      message: visionModels.length > 0 
        ? `Forbindelse OK! Vision-modeller fundet: ${visionModels.join(', ')}` 
        : `Forbindelse OK! Bemærk: Ingen dedikeret vision-model fundet i Ollama endnu (kør f.eks. 'ollama run qwen2.5vl:3b').`,
      models: models.filter(Boolean)
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: `Kunne ikke forbinde til AI: ${err.message}`
    });
  }
});

// Ekstraher tekst fra billede vha. AI (ImT OCR)
router.post('/extract', async (req, res) => {
  try {
    const cfg = loadConfig();
    const { imageBase64, apiUrl, model, apiKey, prompt } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'Mangler billede (imageBase64).' });
    }

    const { dataUrl, rawBase64 } = normalizeImage(imageBase64);
    const userPrompt = (prompt || cfg.imt?.prompt || 'Uddrag al tekst fra dette billede præcist som det står. Svar udelukkende med teksten uden introduktion eller kommentarer.').trim();

    // Tjek om brugeren eller serveren vil bruge Gemini Vision
    const isGemini = model?.includes('gemini') || cfg.imt?.provider === 'gemini' || (cfg.activeProvider === 'gemini' && !model?.includes('qwen') && !model?.includes('ollama'));

    if (isGemini) {
      const gKey = apiKey || cfg.providers?.gemini?.apiKey;
      const gModel = (model && model.includes('gemini')) ? model : (cfg.providers?.gemini?.model || 'gemini-1.5-flash');

      if (!gKey) {
        return res.status(400).json({
          success: false,
          error: 'Gemini API-nøgle mangler for billedgenkendelse (ImT). Indtast nøglen i server/config.json.'
        });
      }

      console.log(`[ImT] Udfører OCR via Google Gemini Vision (${gModel})...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gKey}`
        },
        body: JSON.stringify({
          model: gModel === 'gemini-3.5-flash-light' ? 'gemini-1.5-flash' : gModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: dataUrl } }
              ]
            }
          ],
          temperature: 0.1
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        return res.status(geminiRes.status).json({ success: false, error: `Gemini fejl (${geminiRes.status}): ${errText}` });
      }

      const gData = await geminiRes.json();
      const extracted = gData.choices?.[0]?.message?.content || '';
      return res.json({ success: true, text: extracted.trim(), provider: 'gemini', model: gModel });
    }

    // Ellers brug lokal Ollama Vision
    let targetModel = (model || cfg.imt?.model || 'qwen2.5vl:3b').trim();

    // Advarsel hvis brugeren har valgt llama3 til billeder
    if (targetModel.toLowerCase() === 'llama3' || targetModel.toLowerCase().startsWith('llama3:')) {
      return res.status(400).json({
        success: false,
        error: "Llama 3 er en ren tekst-model og kan ikke læse billeder. Hent venligst en vision-model i Ollama (kør f.eks. 'ollama run qwen2.5vl:3b' på serveren), eller brug Google Gemini 1.5 Flash."
      });
    }

    const defaultOllamaHost = cfg.providers?.ollama?.host || 'http://127.0.0.1:11434';
    let url = (apiUrl || defaultOllamaHost).trim().replace(/\/+$/, '').replace('//localhost', '//127.0.0.1');

    let endpoint = url.endsWith('/v1') ? `${url}/chat/completions` : (url.includes('/chat/completions') ? url : `${url}/v1/chat/completions`);

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const requestBody = {
      model: targetModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0.1
    };

    console.log(`[ImT] Udfører OCR via Lokal AI på ${endpoint} (model: ${targetModel})...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      return res.status(aiRes.status).json({
        success: false,
        error: `Lokal AI svarede med fejl ${aiRes.status}: ${errorText}`
      });
    }

    const data = await aiRes.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    return res.json({
      success: true,
      text: extractedText.trim(),
      provider: 'ollama',
      model: targetModel
    });
  } catch (err) {
    console.error('ImT Extract fejl:', err);
    return res.status(500).json({
      success: false,
      error: `Fejl under tekstekstrahering: ${err.message}`
    });
  }
});

module.exports = router;
