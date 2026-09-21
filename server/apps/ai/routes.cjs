const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../../config.json');

const DEFAULT_CONFIG = {
  activeProvider: 'ollama',
  providers: {
    ollama: {
      name: 'Lokal Ollama',
      host: 'http://127.0.0.1:11434',
      model: 'llama3'
    },
    gemini: {
      name: 'Google Gemini',
      apiKey: '',
      model: 'gemini-1.5-flash'
    },
    openai: {
      name: 'OpenAI (ChatGPT)',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini'
    },
    anthropic: {
      name: 'Anthropic (Claude)',
      apiKey: '',
      model: 'claude-3-5-sonnet-20241022'
    },
    groq: {
      name: 'Groq (Hurtig Llama)',
      apiKey: '',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile'
    },
    deepseek: {
      name: 'DeepSeek',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat'
    },
    custom: {
      name: 'Brugerdefineret API (LM Studio, LocalAI mv.)',
      baseUrl: 'http://127.0.0.1:1234/v1',
      apiKey: '',
      model: ''
    }
  },
  languagetool: {
    url: 'http://127.0.0.1:8010/v2',
    language: 'da-DK'
  }
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        providers: {
          ...DEFAULT_CONFIG.providers,
          ...(parsed.providers || {})
        }
      };
    }
  } catch (err) {
    console.error('Fejl ved indlæsning af server/config.json:', err.message);
  }
  return DEFAULT_CONFIG;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Fejl ved skrivning til server/config.json:', err.message);
    return false;
  }
}

// ================= NORMALISERING AF TOOLS TIL OPENAI FORMAT =================
function normalizeToolsToOpenAI(tools) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) return null;

  const fixSchemaTypes = (schema) => {
    if (!schema || typeof schema !== 'object') return schema;
    if (Array.isArray(schema)) return schema.map(fixSchemaTypes);
    const copy = { ...schema };
    if (typeof copy.type === 'string') {
      copy.type = copy.type.toLowerCase();
    }
    if (copy.properties && typeof copy.properties === 'object') {
      const props = {};
      for (const [k, v] of Object.entries(copy.properties)) {
        props[k] = fixSchemaTypes(v);
      }
      copy.properties = props;
    }
    if (copy.items) {
      copy.items = fixSchemaTypes(copy.items);
    }
    return copy;
  };

  return tools.map(t => {
    if (!t || typeof t !== 'object') return t;
    if (t.type === 'function' && t.function) {
      return {
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description || '',
          parameters: fixSchemaTypes(t.function.parameters) || { type: 'object', properties: {} }
        }
      };
    }
    if (t.name) {
      return {
        type: 'function',
        function: {
          name: t.name,
          description: t.description || '',
          parameters: fixSchemaTypes(t.parameters) || { type: 'object', properties: {} }
        }
      };
    }
    return t;
  });
}

// ================= TEST FORBINDELSE TIL UDBYDERE =================
async function testProviderConnection(providerKey, conf) {
  const pKey = providerKey === 'local' ? 'ollama' : providerKey;
  const serverCfg = (loadConfig().providers || {})[pKey] || {};
  const cfg = {
    ...serverCfg,
    ...(conf || {})
  };
  if (!cfg.apiKey && serverCfg.apiKey) {
    cfg.apiKey = serverCfg.apiKey;
  }
  if (!cfg.host && serverCfg.host) {
    cfg.host = serverCfg.host;
  }

  try {
    if (providerKey === 'ollama') {
      const host = (cfg.host || 'http://127.0.0.1:11434').replace(/\/+$/, '');
      const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) return { success: false, message: `Ollama svarede med status ${res.status}` };
      const data = await res.json();
      const models = (data.models || []).map(m => m.name || m.model);
      return { success: true, message: `Oprettede forbindelse til Ollama (${models.length} modeller fundet)`, models };
    }

    if (providerKey === 'gemini') {
      const apiKey = (cfg.apiKey || '').trim();
      if (!apiKey) return { success: false, message: 'Ingen Gemini API-nøgle angivet på serveren.' };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `Gemini fejl (${res.status})` };
      }
      const data = await res.json();
      const models = (data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace('models/', ''));
      return { success: true, message: 'Gemini API-forbindelse verificeret!', models };
    }

    if (providerKey === 'openai') {
      const apiKey = (cfg.apiKey || '').trim();
      if (!apiKey) return { success: false, message: 'Ingen OpenAI API-nøgle angivet på serveren.' };
      const baseUrl = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `OpenAI fejl (${res.status})` };
      }
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(id => id.includes('gpt') || id.includes('o1') || id.includes('o3'));
      return { success: true, message: 'OpenAI API-forbindelse verificeret!', models };
    }

    if (providerKey === 'anthropic') {
      const apiKey = (cfg.apiKey || '').trim();
      if (!apiKey) return { success: false, message: 'Ingen Anthropic API-nøgle angivet på serveren.' };
      // Test med en minimal 1-token anmodning
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: cfg.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }]
        }),
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `Anthropic fejl (${res.status})` };
      }
      return { success: true, message: 'Anthropic Claude API-forbindelse verificeret!', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] };
    }

    if (providerKey === 'groq') {
      const apiKey = (cfg.apiKey || '').trim();
      if (!apiKey) return { success: false, message: 'Ingen Groq API-nøgle angivet på serveren.' };
      const baseUrl = (cfg.baseUrl || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `Groq fejl (${res.status})` };
      }
      const data = await res.json();
      const models = (data.data || []).map(m => m.id);
      return { success: true, message: 'Groq API-forbindelse verificeret!', models };
    }

    if (providerKey === 'deepseek') {
      const apiKey = (cfg.apiKey || '').trim();
      if (!apiKey) return { success: false, message: 'Ingen DeepSeek API-nøgle angivet på serveren.' };
      const baseUrl = (cfg.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `DeepSeek fejl (${res.status})` };
      }
      const data = await res.json();
      const models = (data.data || []).map(m => m.id);
      return { success: true, message: 'DeepSeek API-forbindelse verificeret!', models };
    }

    if (providerKey === 'custom') {
      const baseUrl = (cfg.baseUrl || 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey.trim()}`;
      const res = await fetch(`${baseUrl}/models`, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { success: false, message: `Brugerdefineret endpoint svarede med kode ${res.status}` };
      const data = await res.json();
      const models = (data.data || data.models || []).map(m => m.id || m.name);
      return { success: true, message: 'Brugerdefineret API-forbindelse verificeret!', models };
    }

    return { success: false, message: `Ukendt udbyder: ${providerKey}` };
  } catch (err) {
    return { success: false, message: `Kunne ikke forbinde til ${providerKey}: ${err.message}` };
  }
}

// ================= API ENDPOINTS =================

// GET /api/ai/config - Henter serverens nuværende API konfiguration
router.get('/config', (req, res) => {
  const config = loadConfig();
  res.json({
    success: true,
    config
  });
});

// POST /api/ai/config - Opdaterer serverens API konfiguration
router.post('/config', (req, res) => {
  try {
    const current = loadConfig();
    const { activeProvider, providers, languagetool } = req.body;

    if (activeProvider && current.providers[activeProvider]) {
      current.activeProvider = activeProvider;
    }

    if (providers && typeof providers === 'object') {
      for (const [pKey, pVal] of Object.entries(providers)) {
        if (current.providers[pKey]) {
          current.providers[pKey] = {
            ...current.providers[pKey],
            ...pVal
          };
        }
      }
    }

    if (languagetool && typeof languagetool === 'object') {
      current.languagetool = {
        ...current.languagetool,
        ...languagetool
      };
    }

    const saved = saveConfig(current);
    if (!saved) {
      return res.status(500).json({ success: false, error: 'Kunne ikke gemme konfigurationen i server/config.json' });
    }

    res.json({
      success: true,
      message: 'Server API-konfiguration gemt!',
      config: current
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai/test-config - Tester en bestemt udbyder
router.post('/test-config', async (req, res) => {
  const { provider, settings } = req.body;
  const targetProvider = provider || loadConfig().activeProvider;
  const result = await testProviderConnection(targetProvider, settings);
  res.json(result);
});

// GET /api/ai/status - Tjekker status på serverens aktive AI
router.get('/status', async (req, res) => {
  const config = loadConfig();
  const active = config.activeProvider || 'ollama';
  const providerConfig = config.providers[active] || {};

  const testResult = await testProviderConnection(active, providerConfig);
  res.json({
    status: testResult.success ? 'online' : 'offline',
    activeProvider: active,
    providerName: providerConfig.name || active,
    model: providerConfig.model || 'standard',
    availableModels: testResult.models || [],
    message: testResult.message
  });
});

// GET /api/ai/models - Returnerer modeller for aktiv udbyder
router.get('/models', async (req, res) => {
  const config = loadConfig();
  const active = config.activeProvider || 'ollama';
  const providerConfig = config.providers[active] || {};

  const testResult = await testProviderConnection(active, providerConfig);
  res.json({
    success: testResult.success,
    activeProvider: active,
    models: testResult.models || []
  });
});

// POST /api/ai/chat - Centralt chat endpoint til dokumentredigering og assistent
router.post('/chat', async (req, res) => {
  try {
    const config = loadConfig();
    const {
      provider: requestedProvider,
      model: requestedModel,
      messages,
      prompt,
      systemInstruction = '',
      tools = null,
      temperature = 0.6,
      contextSize = 8192
    } = req.body;

    let activeProvider = requestedProvider || '';
    if (activeProvider === 'local') activeProvider = 'ollama';

    if (!activeProvider || activeProvider === 'server') {
      if (requestedModel && requestedModel.includes('gemini')) {
        activeProvider = 'gemini';
      } else if (requestedModel && (requestedModel.includes('gpt') || requestedModel.includes('o1') || requestedModel.includes('o3'))) {
        activeProvider = 'openai';
      } else if (requestedModel && requestedModel.includes('claude')) {
        activeProvider = 'anthropic';
      } else {
        activeProvider = config.activeProvider || 'ollama';
      }
    }

    const providerConfig = config.providers[activeProvider] || {};
    const model = requestedModel || providerConfig.model;

    // Normaliser chatbeskeder
    let chatMessages = [];
    if (Array.isArray(messages) && messages.length > 0) {
      chatMessages = [...messages];
      if (systemInstruction && !chatMessages.some(m => m.role === 'system')) {
        chatMessages.unshift({ role: 'system', content: systemInstruction });
      }
    } else if (prompt) {
      if (systemInstruction) {
        chatMessages.push({ role: 'system', content: systemInstruction });
      }
      chatMessages.push({ role: 'user', content: prompt });
    } else {
      return res.status(400).json({ success: false, error: 'Mangler prompt eller messages.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const normalizedTools = normalizeToolsToOpenAI(tools);
    let finalResponseData = null;

    try {
      // 1. OLLAMA
      if (activeProvider === 'ollama') {
        const host = (providerConfig.host || 'http://127.0.0.1:11434').replace(/\/+$/, '');
        const payload = {
          model: model || 'llama3',
          messages: chatMessages,
          temperature,
          options: { num_ctx: parseInt(contextSize, 10) || 8192 }
        };
        if (normalizedTools && normalizedTools.length > 0) {
          payload.tools = normalizedTools;
        }

        const ollamaRes = await fetch(`${host}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          throw new Error(`Ollama fejl (${ollamaRes.status}): ${errText}`);
        }
        finalResponseData = await ollamaRes.json();
      }

      // 2. OPENAI / GROQ / DEEPSEEK / CUSTOM (OpenAI kompatible)
      else if (['openai', 'groq', 'deepseek', 'custom'].includes(activeProvider)) {
        let baseUrl = providerConfig.baseUrl || 'https://api.openai.com/v1';
        if (activeProvider === 'groq' && !providerConfig.baseUrl) baseUrl = 'https://api.groq.com/openai/v1';
        if (activeProvider === 'deepseek' && !providerConfig.baseUrl) baseUrl = 'https://api.deepseek.com/v1';
        baseUrl = baseUrl.replace(/\/+$/, '');

        const apiKey = (providerConfig.apiKey || '').trim();
        if (!apiKey && activeProvider !== 'custom') {
          throw new Error(`Serveren mangler API-nøgle for ${activeProvider}. Konfigurer den via Indstillinger > Server.`);
        }

        const payload = {
          model: model || providerConfig.model,
          messages: chatMessages,
          temperature
        };
        if (normalizedTools && normalizedTools.length > 0) {
          payload.tools = normalizedTools;
        }

        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const apiRes = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!apiRes.ok) {
          const errText = await apiRes.text();
          throw new Error(`${activeProvider.toUpperCase()} API fejl (${apiRes.status}): ${errText}`);
        }
        finalResponseData = await apiRes.json();
      }

      // 3. GOOGLE GEMINI
      else if (activeProvider === 'gemini') {
        const apiKey = (providerConfig.apiKey || '').trim();
        if (!apiKey) {
          throw new Error('Serveren mangler Gemini API-nøgle. Konfigurer den under Indstillinger > Server.');
        }

        // Google Gemini OpenAI-kompatibelt endpoint
        let gemModel = (model || providerConfig.model || 'gemini-2.5-flash').trim();
        if (gemModel.includes('light')) gemModel = gemModel.replace(/light/gi, 'lite');
        if (gemModel === 'gemini-1.5-flash' || gemModel === 'gemini-1.5-pro' || gemModel === 'gemini-1.0') gemModel = 'gemini-2.5-flash';

        const payload = {
          model: gemModel,
          messages: chatMessages,
          temperature
        };
        if (normalizedTools && normalizedTools.length > 0) {
          payload.tools = normalizedTools;
        }

        const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          throw new Error(`Gemini API fejl (${geminiRes.status}): ${errText}`);
        }
        finalResponseData = await geminiRes.json();
      }

      // 4. ANTHROPIC CLAUDE
      else if (activeProvider === 'anthropic') {
        const apiKey = (providerConfig.apiKey || '').trim();
        if (!apiKey) {
          throw new Error('Serveren mangler Anthropic API-nøgle. Konfigurer den under Indstillinger > Server.');
        }

        // Anthropic adskiller system instruction fra almindelige messages
        let claudeSystem = '';
        const claudeMessages = [];
        for (const m of chatMessages) {
          if (m.role === 'system') {
            claudeSystem += (claudeSystem ? '\n' : '') + m.content;
          } else {
            claudeMessages.push({ role: m.role, content: m.content });
          }
        }

        const payload = {
          model: model || providerConfig.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: claudeMessages,
          temperature
        };
        if (claudeSystem) payload.system = claudeSystem;

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!claudeRes.ok) {
          const errText = await claudeRes.text();
          throw new Error(`Anthropic fejl (${claudeRes.status}): ${errText}`);
        }

        const cData = await claudeRes.json();
        const textPart = (cData.content || []).find(c => c.type === 'text');
        finalResponseData = {
          choices: [
            {
              message: {
                role: 'assistant',
                content: textPart ? textPart.text : ''
              }
            }
          ],
          usage: {
            prompt_tokens: cData.usage?.input_tokens || 0,
            completion_tokens: cData.usage?.output_tokens || 0
          }
        };
      } else {
        throw new Error(`Ikke-understøttet udbyder på serveren: ${activeProvider}`);
      }
    } finally {
      clearTimeout(timeout);
    }

    return res.json({
      success: true,
      provider: activeProvider,
      data: finalResponseData
    });
  } catch (err) {
    console.error('Server AI Chat fejl:', err);
    return res.status(500).json({
      success: false,
      error: `Server AI fejl: ${err.message}`
    });
  }
});

module.exports = router;
