import { getServerUrl } from './documentStore.js';

export const THEMES = [
  { id: 'dark', name: 'Mørkt (Standard)', preview: '#0f0f0f', text: '#ffffff', desc: 'Klassisk mørkt tema, behageligt for øjnene' },
  { id: 'light', name: 'Lyst (Office)', preview: '#f3f4f6', text: '#111827', desc: 'Rent og lyst kontortema' },
  { id: 'word-blue', name: 'Word Blå', preview: '#0c192c', text: '#e2e8f0', desc: 'Klassisk Microsoft Word mørkeblåt look' },
  { id: 'midnight', name: 'Midnat OLED', preview: '#000000', text: '#ffffff', desc: 'Ren 100% dyb sort til OLED skærme' },
  { id: 'slate', name: 'Skifer / Nord', preview: '#1e2029', text: '#f8f8f2', desc: 'Moderne skifergråt med afdæmpede kontraster' },
  { id: 'sepia', name: 'Varm Sepia', preview: '#f4ede2', text: '#2d261e', desc: 'Varmt pergament-look til langvarig læsning' },
];

export const ACCENT_COLORS = [
  { name: 'Word Blå', value: '#2b579a' },
  { name: 'Himmelblå', value: '#2563eb' },
  { name: 'Smaragdgrøn', value: '#10b981' },
  { name: 'Kongelilla', value: '#8b5cf6' },
  { name: 'Koralrød', value: '#ef4444' },
  { name: 'Solorange', value: '#f59e0b' },
  { name: 'Pink / Rosa', value: '#ec4899' },
  { name: 'Teal / Cyan', value: '#06b6d4' },
];

export const AI_PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', defaultModel: 'gemini-2.5-flash', popularModels: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-pro'] },
  { id: 'openai', name: 'OpenAI (ChatGPT)', defaultModel: 'gpt-4o-mini', popularModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-mini', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'claude-3-5-sonnet-20241022', popularModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
  { id: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-chat', popularModels: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'groq', name: 'Groq (Ultra Hurtig)', defaultModel: 'llama-3.3-70b-versatile', popularModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'openrouter', name: 'OpenRouter', defaultModel: 'meta-llama/llama-3.3-70b-instruct', popularModels: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-r1', 'google/gemini-2.0-flash-001'] },
  { id: 'server', name: 'Server PC (Central AI)', defaultModel: 'gemini-2.5-flash', popularModels: ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'qwen3.5:9b', 'llama3.1:8b'] },
  { id: 'local', name: 'Lokal AI (Ollama)', defaultModel: 'qwen3.5:9b', popularModels: ['qwen3.5:9b', 'llama3.1:8b', 'deepseek-r1:8b', 'qwen2.5vl:3b'] },
];

export const DEFAULT_PROMPTS = {
  systemInstructions: 'Du er en hjælpsom og professionel skriveassistent. Svar altid på dansk. Gå altid direkte til sagen uden indledende meta-kommentarer, snik-snak eller forklaringer af dine interne regler og værktøjer.',
  enableToolInstructions: true,
  smartToolAttachment: false,
  toolInstructions: `[VÆRKTØJER TIL DOKUMENTREDIGERING]
Du har adgang til følgende værktøjer til at redigere i det åbne Word-dokument. Dokumentets indhold leveres til dig som struktureret Markdown med overskrifter (#, ##, ###), afsnit adskilt med tomme linjer, fed (**tekst**), kursiv (*tekst*) og lister (- punkt):

VIGTIG REGEL FOR FORMATERING:
Når du opretter eller retter lister (fx punktlister eller nummererede lister), skal du analysere dokumentet og altid bruge præcis samme form for punktliste (fx - eller *) og listetype, som brugeren allerede anvender!

1. replace_entire_document:
   - new_content: Det fulde, opdaterede dokumentindhold i struktureret format (med overskrifter '#' / '##', afsnit adskilt med tomme linjer, punkttegn osv.).
   * BRUG DETTE VÆRKTØJ når der IKKE er markeret tekst, og brugeren beder om at:
     - Slette eller fjerne et specifikt afsnit, en overskrift eller en del af dokumentet (f.eks. "slet det første afsnit...", "fjern afsnittet om historie"): Sæt 'new_content' til hele dokumentet UDEN det slettede afsnit.
     - Fjerne eller ændre specifikke tegn i hele dokumentet (f.eks. "fjern * og -", "fjern stjerner og bindestreger", "slet alle hashtags").
     - Omskrive, forbedre, oversætte, formatere eller rette sprogfejl i hele dokumentet.
     - Udskifte eller reorganisere hele dokumentet.
   * VIGTIG REGEL: 'new_content' skal indeholde hele det opdaterede dokument. 'new_content' må ALDRIG være tom!

2. replace_selected_text:
   - new_text: Den fulde reviderede tekst, som skal erstatte den markerede tekst i dokumentet.
   * BRUG DETTE VÆRKTØJ HVER GANG brugeren har markeret tekst og beder om at:
     - Fjerne eller ændre specifikke tegn, symboler eller ord i den markerede del.
     - Rette, forbedre, oversætte eller tilpasse tonen i den markerede tekst.
   * VIGTIG REGEL: 'new_text' skal indeholde hele den reviderede tekst med ændringerne udført. 'new_text' må ALDRIG være tom!

3. clear_formatting:
   - Ingen parametre.
   * BRUG DETTE VÆRKTØJ NÅR brugeren beder om at:
     - Fjerne, rydde eller nulstille formatering (f.eks. "fjern formatering", "ryd typografi", "fjern al fed og kursiv og lad teksten blive").
   * Hvis der er markeret tekst, ryddes formatering for markeringen. Hvis intet er markeret, ryddes formatering for hele dokumentet.
   * Dette værktøj bevarer al tekst uændret og fjerner udelukkende formatering/styling.

4. delete_selected_text:
   - Ingen parametre.
   * BRUG DETTE VÆRKTØJ HVIS brugeren udtrykkeligt beder om at slette/fjerne tekst, OG brugeren HAR markeret teksten i forvejen (f.eks. "slet markeringen", "slet dette", "fjern den markerede tekst").
   * VIGTIGT KRAV: Virker KUN hvis brugeren har en aktiv markering! Hvis brugeren IKKE har markeret noget, må du ALDRIG bruge delete_selected_text. Brug i stedet 'replace_text' med new_text: "" eller 'replace_entire_document'!

5. replace_text:
   - exact_text_to_replace: Nøjagtig tekststreng i dokumentet, der skal findes og erstattes eller slettes.
   - new_text: Den nye tekst, der skal indsættes. Hvis et afsnit eller en sætning skal slettes, angives en tom streng "" i 'new_text'.
   * BRUG DETTE VÆRKTØJ til at:
     - Slette et specifikt afsnit eller en sætning i dokumentet, når der ikke er en aktiv markering (f.eks. "Du skal slette det første afsnit der handler om historie og tæmning"): Angiv afsnittets fulde ordlyd i 'exact_text_to_replace' og sæt 'new_text' til "".
     - Søge og erstatte enkelte ord eller sætninger i dokumentet.

6. append_text:
   - text_to_add: Tekst der skal tilføjes til slutningen af dokumentet.

7. insert_text:
   - text: Tekst der skal indsættes i det aktive dokument ved markørens position.

8. reply_to_user:
   - message: Det direkte, skriftlige svar til brugeren.
   * BRUG DETTE VÆRKTØJ når du har brug for at tale direkte til brugeren (fx for at besvare et spørgsmål) UDEN at indsætte eller ændre noget i selve dokumentet. Svaret vises som en talebobel på skærmen.

Hvis værktøjskald ikke er direkte tilgængelige som API-funktioner, returner en JSON-blok:
\`\`\`json
{"tool": "replace_text", "args": {"exact_text_to_replace": "tekst der skal slettes", "new_text": ""}}
\`\`\`
eller
\`\`\`json
{"tool": "reply_to_user", "args": {"message": "Dette er mit skriftlige svar til dig."}}
\`\`\``,
  dashboardPromptTemplate: `Du er en hjælpsom AI-assistent i et tekstbehandlingsprogram. Brugeren er på forsiden og leder efter et dokument.
Her er en liste over alle brugerens dokumenter:
{DOCS_LIST}

Brugerens spørgsmål: {USER_QUERY}

VIGTIGT: Hvis du finder et relevant dokument, SKAL du give brugeren et link til det på præcis denne form: [Dokumentets Titel](/doc/ID). Hvis intet dokument matcher, svar venligt på brugerens spørgsmål.`,
  contextPromptTemplate: `Kontekst fra mit dokument:
"{CONTEXT}"

Min forespørgsel: {USER_QUERY}`
};

const DEFAULT_SETTINGS = {
  // Tema & Udseende
  theme: 'dark',
  accentColor: '#2b579a',
  defaultWordCanvas: 'dark', // 'dark' eller 'light'

  // Aktiv AI Assistent
  aiProvider: 'gemini', // 'gemini', 'openai', 'anthropic', 'deepseek', 'groq', 'openrouter', 'local'
  
  // Google Gemini
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  
  // OpenAI
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openaiApiUrl: 'https://api.openai.com/v1',

  // Anthropic Claude
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-sonnet-20241022',

  // DeepSeek
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  deepseekApiUrl: 'https://api.deepseek.com/v1',

  // Groq
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  groqApiUrl: 'https://api.groq.com/openai/v1',

  // OpenRouter
  openrouterApiKey: '',
  openrouterModel: 'meta-llama/llama-3.3-70b-instruct',
  openrouterApiUrl: 'https://openrouter.ai/api/v1',

  // Server PC AI
  serverModelName: 'gemini-2.5-flash',

  // Lokal AI (Ollama / LM Studio)
  localApiUrl: 'http://127.0.0.1:11434/v1',
  localModelName: 'qwen3.5:9b',
  localContextSize: 8192,

  // ImT (Billede til Tekst)
  imtApiUrl: 'http://127.0.0.1:11434/v1',
  imtModel: 'qwen2.5vl:3b',
  imtApiKey: '',
  imtPrompt: 'Uddrag al tekst fra dette billede præcist som det står skrevet. Svar udelukkende med den udtrukne tekst uden ekstra forklaringer eller kommentarer.',

  // LanguageTool (Korrektur & Grammatik)
  languageToolEnabled: true,
  languageToolAutoCheck: true, // Løbende automatisk baggrundskontrol
  languageToolDebounceMs: 1200, // Pause i ms før baggrundskontrol udføres
  languageToolUrl: 'http://localhost:8010/v2',
  languageToolLanguage: 'da-DK',
  languageToolLevel: 'default', // 'default' eller 'picky'
  languageToolRecognizeEnglish: true, // Genkend engelske ord i danske tekster
  languageToolIgnoreCamelCase: true, // Ignorér CamelCase & akronymer (f.eks. MitEgetWord, QoL)
  customDictionary: [], // Liste over brugerens egne godkendte ord

  // Faster Whisper (Tale-til-tekst / Lydfiler til stemme)
  whisperApiUrl: 'http://100.67.46.116:8000/v1/audio/transcriptions',
  whisperApiKey: 'min-hemmelige-api-noegle-123',
  whisperModel: 'small',
  whisperLanguage: 'da',
  whisperPrompt: 'Dette er en samtale på dansk. Her bruges komma, punktum og store bogstaver.',

  // Prompts & Systeminstruktioner
  ...DEFAULT_PROMPTS
};

export const syncServerAIConfig = async () => {
  try {
    const serverUrl = getServerUrl().replace(/\/+$/, '');
    const res = await fetch(`${serverUrl}/api/ai/config`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        const srvConfig = data.config;
        const current = getSettings();
        let changed = false;

        // Opdater modeller fra serverens config
        if (srvConfig.providers) {
          if (srvConfig.providers.gemini?.model && current.geminiModel !== srvConfig.providers.gemini.model) {
            current.geminiModel = srvConfig.providers.gemini.model;
            current.serverModelName = srvConfig.providers.gemini.model;
            changed = true;
          }
          if (srvConfig.providers.openai?.model && current.openaiModel !== srvConfig.providers.openai.model) {
            current.openaiModel = srvConfig.providers.openai.model;
            changed = true;
          }
          if (srvConfig.providers.ollama?.model && current.localModelName !== srvConfig.providers.ollama.model) {
            current.localModelName = srvConfig.providers.ollama.model;
            changed = true;
          }
        }

        if (srvConfig.whisper) {
          if (srvConfig.whisper.url && current.whisperApiUrl !== srvConfig.whisper.url) {
            current.whisperApiUrl = srvConfig.whisper.url;
            changed = true;
          }
          if (srvConfig.whisper.apiKey && current.whisperApiKey !== srvConfig.whisper.apiKey) {
            current.whisperApiKey = srvConfig.whisper.apiKey;
            changed = true;
          }
          if (srvConfig.whisper.model && current.whisperModel !== srvConfig.whisper.model) {
            current.whisperModel = srvConfig.whisper.model;
            changed = true;
          }
          if (srvConfig.whisper.language && current.whisperLanguage !== srvConfig.whisper.language) {
            current.whisperLanguage = srvConfig.whisper.language;
            changed = true;
          }
          if (srvConfig.whisper.prompt && current.whisperPrompt !== srvConfig.whisper.prompt) {
            current.whisperPrompt = srvConfig.whisper.prompt;
            changed = true;
          }
        }

        // Hvis serveren angiver en aktiv provider, afspejl den
        if (srvConfig.activeProvider) {
          const mapped = srvConfig.activeProvider === 'ollama' ? 'local' : srvConfig.activeProvider;
          if (current.aiProvider !== mapped) {
            current.aiProvider = mapped;
            changed = true;
          }
        }

        if (changed) {
          localStorage.setItem('mitEgetWord_settings', JSON.stringify(current));
          window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: current }));
          console.log('[AIConfig] Synkroniseret AI model fra server:', {
            activeProvider: current.aiProvider,
            geminiModel: current.geminiModel,
            localModel: current.localModelName
          });
        }
        return current;
      }
    }
  } catch (err) {
    // Server ikke tilgængelig / offline
  }
  return null;
};

export const getSettings = () => {
  try {
    const saved = localStorage.getItem('mitEgetWord_settings');
    const legacyKey = localStorage.getItem('mitEgetWord_aiKey');
    
    let current = DEFAULT_SETTINGS;
    if (saved) {
      current = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      // Opgrader legacy system prompt hvis den var uændret fra gammel standard
      if (current.systemInstructions === 'Du er en hjælpsom og professionel skriveassistent. Svar altid på dansk.') {
        current.systemInstructions = DEFAULT_PROMPTS.systemInstructions;
      }
      // Opgrader legacy toolInstructions
      if (!current.toolInstructions || current.toolInstructions.includes('[VÆRKTØJ: SKRIV I DOKUMENT]') || !current.toolInstructions.includes('replace_selected_text') || !current.toolInstructions.includes('replace_entire_document') || !current.toolInstructions.includes('VIGTIGT KRAV: Virker KUN') || !current.toolInstructions.includes('reply_to_user')) {
        current.toolInstructions = DEFAULT_PROMPTS.toolInstructions;
      }
    }
    
    // Migrer legacy API key hvis den fandtes
    if (legacyKey && !current.openaiApiKey && !current.geminiApiKey) {
      if (legacyKey.startsWith('AIza')) {
        current.geminiApiKey = legacyKey;
      } else {
        current.openaiApiKey = legacyKey;
      }
    }
    
    return current;
  } catch (e) {
    console.error('Fejl ved indlæsning af indstillinger:', e);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (newSettings) => {
  const current = getSettings();
  const updated = { ...current, ...newSettings };
  
  // Sikr os at vi ikke gemmer uvedkommende eller enorme felter (for at undgå QuotaExceededError)
  const allowedKeys = Object.keys(DEFAULT_SETTINGS);
  const sanitized = {};
  for (const key of allowedKeys) {
    if (updated[key] !== undefined) {
      sanitized[key] = updated[key];
    }
  }

  // Tjek for ekstremt store data for at undgå QuotaExceededError
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 100000) {
      console.warn(`Indstillingen ${key} var for stor og er blevet nulstillet for at spare plads.`);
      sanitized[key] = DEFAULT_SETTINGS[key] !== undefined ? DEFAULT_SETTINGS[key] : '';
    }
  }

  try {
    localStorage.setItem('mitEgetWord_settings', JSON.stringify(sanitized));
  } catch (err) {
    console.error('Kunne ikke gemme indstillinger:', err);
    if (err.name === 'QuotaExceededError') {
      // Hvis det stadig fejler, ryd customDictionary som sidste udvej
      sanitized.customDictionary = [];
      try {
        localStorage.setItem('mitEgetWord_settings', JSON.stringify(sanitized));
      } catch (e) {
        console.error('Stadig QuotaExceededError efter rydning af ordbog');
      }
    }
  }
  
  // Opdater også tema med det samme
  if (sanitized.theme || sanitized.accentColor) {
    applyTheme(sanitized.theme, sanitized.accentColor);
  }

  // Synkroniser med ImT specifikke indstillinger
  if (newSettings.imtApiUrl !== undefined || newSettings.imtModel !== undefined || newSettings.imtApiKey !== undefined || newSettings.imtPrompt !== undefined) {
    const imtSettings = {
      apiUrl: sanitized.imtApiUrl,
      model: sanitized.imtModel,
      apiKey: sanitized.imtApiKey,
      prompt: sanitized.imtPrompt
    };
    try {
      localStorage.setItem('imt_local_ai_settings', JSON.stringify(imtSettings));
    } catch(e) {}
    window.dispatchEvent(new CustomEvent('imt:settings-updated', { detail: imtSettings }));
  }

  // Udsend event så andre komponenter kan opdatere deres tilstand
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: sanitized }));
  return sanitized;
};

// Hjælpefunktion til at påføre tema og farver på dokumentet
export const applyTheme = (themeName, accentColor) => {
  const root = document.documentElement;
  const theme = themeName || 'dark';
  const accent = accentColor || '#2b579a';

  root.setAttribute('data-theme', theme);
  root.style.setProperty('--primary-accent', accent);
  
  // Beregn let hover-tone af accentfarven
  root.style.setProperty('--primary-accent-glow', `${accent}40`);

  // Tilføj en klasse til body for optimal CSS styling
  document.body.className = `theme-${theme}`;
};

// ================= LANGUAGETOOL HJÆLPEFUNKTIONER =================
export const normalizeLanguageToolUrl = (inputUrl) => {
  if (!inputUrl) return 'http://localhost:8010/v2';
  let url = inputUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/v2')) {
    url = `${url}/v2`;
  }
  return url;
};

export const testLanguageToolConnection = async (url, language = 'da-DK') => {
  const normalizedUrl = normalizeLanguageToolUrl(url);

  // 1. Forsøg først via server-proxy for at undgå lokale CORS-udfordringer
  try {
    const serverUrl = getServerUrl();
    const proxyRes = await fetch(`${serverUrl}/api/languagetool/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl, language }),
      signal: AbortSignal.timeout(7000)
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return {
        success: data.success,
        message: data.message || `Forbindelse oprettet! Serveren understøtter ${data.count || 0} sprog.`,
        count: data.count,
        languages: data.languages,
        normalizedUrl: data.normalizedUrl || normalizedUrl
      };
    } else {
      const errData = await proxyRes.json().catch(() => null);
      if (errData?.message) {
        return { success: false, message: errData.message };
      }
    }
  } catch (proxyErr) {
    // Fortsæt til direkte fetch fallback
  }

  // 2. Fallback: Direkte fetch fra browser
  try {
    const directRes = await fetch(`${normalizedUrl}/languages`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });

    if (!directRes.ok) {
      throw new Error(`Serveren svarede med HTTP-status ${directRes.status}`);
    }

    const languages = await directRes.json();
    return {
      success: true,
      message: `Forbindelse oprettet! Serveren understøtter ${Array.isArray(languages) ? languages.length : 0} sprog.`,
      count: Array.isArray(languages) ? languages.length : 0,
      languages: Array.isArray(languages) ? languages : [],
      normalizedUrl
    };
  } catch (err) {
    return {
      success: false,
      message: `Kunne ikke forbinde til LanguageTool på ${normalizedUrl}. Sørg for at din server-pc kører og er tilgængelig på netværket.`
    };
  }
};
export const testWhisperConnection = async (customConfig = null) => {
  const serverUrl = getServerUrl().replace(/\/+$/, '');
  try {
    const res = await fetch(`${serverUrl}/api/ai/test-whisper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customConfig || {}),
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message: data.message || 'Forbindelse til Faster Whisper er verificeret via Server-PC!'
      };
    } else {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message: err.message || `Server svarede med status ${res.status}`
      };
    }
  } catch (err) {
    return {
      success: false,
      message: `Kunne ikke kontakte Server-PC (${serverUrl}): ${err.message}`
    };
  }
};


// Cache til hurtig tjek af LanguageTool tilgængelighed
let lastLtHealthCheck = 0;
let lastLtHealthResult = false;
let isCheckingLtHealth = false;

export const isLanguageToolAvailable = async (force = false) => {
  const now = Date.now();
  if (!force && (now - lastLtHealthCheck < 45000)) {
    return lastLtHealthResult;
  }
  if (isCheckingLtHealth) {
    return lastLtHealthResult;
  }
  isCheckingLtHealth = true;
  lastLtHealthCheck = now;
  try {
    const res = await testLanguageToolConnection();
    lastLtHealthResult = !!res.success;
    return lastLtHealthResult;
  } catch {
    lastLtHealthResult = false;
    return false;
  } finally {
    isCheckingLtHealth = false;
  }
};

export const checkTextWithLanguageTool = async (text, options = {}) => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { success: true, matches: [] };
  }

  // Hvis LanguageTool er kendt offline og det er et baggrundstjek, spar netværkskald
  if (options.checkOnline !== false) {
    const isOnline = await isLanguageToolAvailable();
    if (!isOnline && options.silent) {
      return { success: false, matches: [], offline: true };
    }
  }

  const currentSettings = getSettings();
  const rawUrl = options.url || currentSettings.languageToolUrl || 'http://localhost:8010/v2';
  const language = options.language || currentSettings.languageToolLanguage || 'da-DK';
  const level = options.level || currentSettings.languageToolLevel || 'default';
  const normalizedUrl = normalizeLanguageToolUrl(rawUrl);
  const fetchSignal = options.signal 
    ? (typeof AbortSignal !== 'undefined' && AbortSignal.any ? AbortSignal.any([options.signal, AbortSignal.timeout(4000)]) : options.signal)
    : AbortSignal.timeout(4000);

  // 1. Forsøg først via backend-proxy
  try {
    const serverUrl = getServerUrl();
    const proxyRes = await fetch(`${serverUrl}/api/languagetool/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl, text, language, level }),
      signal: fetchSignal
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      lastLtHealthResult = true;
      lastLtHealthCheck = Date.now();
      return { success: true, matches: data.matches || [], raw: data };
    }
  } catch (proxyErr) {
    if (options.signal?.aborted) throw proxyErr;
    // Fortsæt til direkte fallback
  }

  // 2. Fallback: Direkte fetch
  try {
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('language', language);
    if (level && level !== 'default') {
      params.append('level', level);
    }

    const res = await fetch(`${normalizedUrl}/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
      signal: fetchSignal
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`LanguageTool fejl (${res.status}): ${txt}`);
    }

    const data = await res.json();
    return { success: true, matches: data.matches || [], raw: data };
  } catch (err) {
    throw new Error(`Kunne ikke tjekke tekst med LanguageTool: ${err.message}`);
  }
};

// Tjek om et ord er CamelCase eller et akronym/forkortelse (f.eks. MitEgetWord, QoL, API)
export const isCamelCaseOrAcronym = (rawWord) => {
  if (!rawWord || typeof rawWord !== 'string') return false;
  const word = rawWord.trim().replace(/^[.,!?:;("'{[]+|[.,!?:;)"'}\]]+$/g, '');
  if (word.length < 2) return false;

  // CamelCase: f.eks. MitEgetWord, iPhone, JavaScript, TypeScript
  if (/[a-z][A-Z]/.test(word)) return true;

  // Akronymer med blandet casing: f.eks. QoL, MoU, ToS, SaaS
  if (/^[A-Z]+[a-z]+[A-Z]+/.test(word) || /^[A-Z][a-z][A-Z]+/.test(word)) return true;

  // All-caps forkortelser/akronymer (2+ tegn): f.eks. HTML, PDF, API, UI, AI, CSS
  if (/^[A-Z0-9_-]{2,}$/.test(word)) return true;

  return false;
};

// Håndtering af brugerens personlige ordbog
export const getCustomDictionary = () => {
  const settings = getSettings();
  return Array.isArray(settings.customDictionary) ? settings.customDictionary : [];
};

export const isInCustomDictionary = (word) => {
  if (!word) return false;
  const dict = getCustomDictionary();
  const clean = word.trim().toLowerCase().replace(/^[.,!?:;("'{[]+|[.,!?:;)"'}\]]+$/g, '');
  return dict.some(w => w.toLowerCase() === clean);
};

export const addToCustomDictionary = (rawWord) => {
  if (!rawWord) return;
  const word = rawWord.trim().replace(/^[.,!?:;("'{[]+|[.,!?:;)"'}\]]+$/g, '');
  if (!word) return;

  const currentSettings = getSettings();
  const list = Array.isArray(currentSettings.customDictionary) ? [...currentSettings.customDictionary] : [];
  if (!list.some(w => w.toLowerCase() === word.toLowerCase())) {
    list.push(word);
    saveSettings({ ...currentSettings, customDictionary: list });
  }
};

export const removeFromCustomDictionary = (rawWord) => {
  if (!rawWord) return;
  const word = rawWord.trim().toLowerCase();
  const currentSettings = getSettings();
  const list = Array.isArray(currentSettings.customDictionary) ? currentSettings.customDictionary : [];
  const updated = list.filter(w => w.trim().toLowerCase() !== word);
  saveSettings({ ...currentSettings, customDictionary: updated });
};

// Tjek kandidatord mod LanguageTools engelske ordbog
export const filterValidEnglishWords = async (words, options = {}) => {
  if (!words || !Array.isArray(words) || words.length === 0) return new Set();

  const cleanedWords = words
    .map(w => (typeof w === 'string' ? w.trim().replace(/^[.,!?:;("'{[]+|[.,!?:;)"'}\]]+$/g, '') : ''))
    .filter(w => w.length > 1);

  const uniqueWords = Array.from(new Set(cleanedWords));
  if (uniqueWords.length === 0) return new Set();

  try {
    const testText = uniqueWords.join(' ');
    const res = await checkTextWithLanguageTool(testText, {
      ...options,
      language: 'en-US',
      level: 'default'
    });

    const matches = res.matches || [];
    const invalidEnglishWords = new Set();

    matches.forEach(m => {
      // Ignorer grammatiske regler (f.eks. UPPERCASE_SENTENCE_START), fokusér kun på deciderede stavefejl
      const isSpelling = 
        !m.rule?.id ||
        m.rule.id.includes('MORFOLOGIK') ||
        m.rule.id.includes('SPELL') ||
        m.rule.issueType === 'misspelling' ||
        m.rule.category?.id === 'TYPOS' ||
        (m.shortMessage && m.shortMessage.toLowerCase().includes('spell'));

      if (isSpelling) {
        const flagged = testText.slice(m.offset, m.offset + m.length).trim();
        if (flagged) {
          invalidEnglishWords.add(flagged.toLowerCase());
        }
      }
    });

    const validEnglishWords = new Set();
    uniqueWords.forEach(w => {
      if (!invalidEnglishWords.has(w.toLowerCase())) {
        validEnglishWords.add(w.toLowerCase());
      }
    });

    return validEnglishWords;
  } catch (err) {
    console.warn('Kunne ikke validere ord mod engelsk ordbog:', err);
    return new Set();
  }
};

// Helper til at teste AI via Server Central
const testServerProxyConnection = async (provider, modelName) => {
  const serverUrl = getServerUrl().replace(/\/+$/, '');
  const res = await fetch(`${serverUrl}/api/ai/test-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: provider === 'local' ? 'ollama' : provider })
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || `Server Central kunne ikke forbinde til ${provider}`);
  }
  return {
    success: true,
    message: `${data.message || 'Forbindelse verificeret!'} (via Server Central)`,
    models: data.models || []
  };
};

// Test forbindelse til en specifik AI udbyder via Server Central
export const testAIConnection = async (provider) => {
  if (provider === 'imt') {
    try {
      const serverUrl = getServerUrl().replace(/\/+$/, '');
      const res = await fetch(`${serverUrl}/api/imt/status`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data.status === 'ok') {
        return {
          success: true,
          message: `ImT Billed-AI er klar på Server Central (Model: ${data.configuredModel || 'Vision AI'})`
        };
      }
      return { success: false, message: data.message || 'ImT er ikke klar på serveren' };
    } catch (err) {
      return { success: false, message: `Kunne ikke kontakte Server Central: ${err.message}` };
    }
  }

  const target = (provider === 'local' || provider === 'ollama') ? 'ollama' : provider;
  try {
    return await testServerProxyConnection(target);
  } catch (err) {
    return {
      success: false,
      message: err.message || `Kunne ikke forbinde til ${provider} via Server Central.`
    };
  }
};

const extractUsage = (data, provider = 'gemini') => {
  if (!data) return null;
  if (data.usage) {
    const promptTokens = data.usage.prompt_tokens || data.usage.promptTokenCount || 0;
    const completionTokens = data.usage.completion_tokens || data.usage.candidatesTokenCount || 0;
    const totalTokens = data.usage.total_tokens || data.usage.totalTokenCount || (promptTokens + completionTokens);
    return { promptTokens, completionTokens, totalTokens };
  }
  if (data.usageMetadata) {
    const promptTokens = data.usageMetadata.promptTokenCount || 0;
    const completionTokens = data.usageMetadata.candidatesTokenCount || 0;
    const totalTokens = data.usageMetadata.totalTokenCount || (promptTokens + completionTokens);
    return { promptTokens, completionTokens, totalTokens };
  }
  if (data.prompt_eval_count != null || data.eval_count != null) {
    const promptTokens = data.prompt_eval_count || 0;
    const completionTokens = data.eval_count || 0;
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
  }
  return null;
};

export class AIResponse {
  constructor(text = '', toolCall = null, usage = null) {
    this.text = text || '';
    this.toolCall = toolCall;
    this.usage = usage;
  }
  toString() {
    return this.text;
  }
}

// Helper til at sende AI forespørgsler via Server Central (nøglefri på klienten)
export const callServerProxy = async ({ provider, model, prompt, fullSystemInstruction, tools, signal, contextSize }) => {
  const serverUrl = getServerUrl().replace(/\/+$/, '');
  const messages = [];
  if (fullSystemInstruction) {
    messages.push({ role: 'system', content: fullSystemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await fetch(`${serverUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: (provider === 'local' || provider === 'ollama') ? 'ollama' : provider,
        model,
        messages,
        tools,
        contextSize: contextSize || 8192
      }),
      signal
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Server AI fejl (${res.status})`);
    }

    const data = json.data;
    const usage = extractUsage(data, provider === 'gemini' ? 'gemini' : 'local');
    const message = data.choices?.[0]?.message;
    if (message?.tool_calls?.[0]) {
      const tc = message.tool_calls[0];
      let parsedArgs = tc.function?.arguments;
      if (typeof parsedArgs === 'string') {
        try { parsedArgs = JSON.parse(parsedArgs); } catch {}
      }
      return new AIResponse('', {
        name: tc.function?.name,
        args: parsedArgs || {}
      }, usage);
    }
    if (!message?.content) {
      throw new Error(`${(provider || 'AI').toUpperCase()} returnerede et tomt svar fra Server Central.`);
    }
    return new AIResponse(message.content, null, usage);
  } catch (err) {
    if (err.message?.includes('Failed to fetch') || err.name === 'TypeError') {
      throw new Error(`Kunne ikke forbinde til Server Central på ${serverUrl}. Tjek at Server-PC'en er tændt.`);
    }
    throw err;
  }
};

// Fælles funktion til at kalde den aktive AI motor via Server Central
export const callAI = async ({ prompt, systemInstruction = '', tools = null, signal }) => {
  const settings = getSettings();
  const provider = settings.aiProvider || 'gemini';
  const fullSystemInstruction = `${settings.systemInstructions || ''}\n${systemInstruction}`.trim();
  const targetProvider = (provider === 'local' || provider === 'ollama') ? 'ollama' : provider;

  return await callServerProxy({
    provider: targetProvider,
    prompt,
    fullSystemInstruction,
    tools,
    signal
  });
};



