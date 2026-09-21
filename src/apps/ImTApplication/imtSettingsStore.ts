import { getSettings, saveSettings } from '../../store/settingsStore';

export interface ImTSettings {
  apiUrl: string;
  model: string;
  apiKey: string;
  prompt: string;
}

export const DEFAULT_IMT_SETTINGS: ImTSettings = {
  apiUrl: 'http://127.0.0.1:11434/v1',
  model: 'qwen2.5vl:3b',
  apiKey: '',
  prompt: 'Uddrag al tekst fra dette billede præcist som det står skrevet. Svar udelukkende med den udtrukne tekst uden ekstra forklaringer eller kommentarer.'
};

const STORAGE_KEY = 'imt_local_ai_settings';

export const getImTSettings = (): ImTSettings => {
  try {
    const globalSettings = getSettings();
    if (globalSettings.imtApiUrl || globalSettings.imtModel) {
      return {
        apiUrl: globalSettings.imtApiUrl || DEFAULT_IMT_SETTINGS.apiUrl,
        model: globalSettings.imtModel || DEFAULT_IMT_SETTINGS.model,
        apiKey: globalSettings.imtApiKey || '',
        prompt: globalSettings.imtPrompt || DEFAULT_IMT_SETTINGS.prompt,
      };
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_IMT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('Kunne ikke hente ImT indstillinger:', err);
  }
  return { ...DEFAULT_IMT_SETTINGS };
};

export const saveImTSettings = (settings: Partial<ImTSettings>): ImTSettings => {
  try {
    const current = getImTSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Opdater også globale indstillinger
    saveSettings({
      imtApiUrl: updated.apiUrl,
      imtModel: updated.model,
      imtApiKey: updated.apiKey,
      imtPrompt: updated.prompt,
    });

    window.dispatchEvent(new CustomEvent('imt:settings-updated', { detail: updated }));
    return updated;
  } catch (err) {
    console.error('Kunne ikke gemme ImT indstillinger:', err);
    return getImTSettings();
  }
};
