import React, { useState, useEffect } from 'react';
import { 
  Palette, Bot, Server, Info, X, Check, Eye, EyeOff, 
  RefreshCw, Sliders, Sparkles, Sun, Moon, AlertCircle, 
  CheckCircle2, Key, HardDrive, RotateCcw, Terminal, Undo2, ArrowRight,
  SpellCheck, Plus, BookOpen, ScanText, Mic
} from 'lucide-react';
import './SettingsModal.css';
import { 
  getSettings, saveSettings, applyTheme, testAIConnection, testLanguageToolConnection, testWhisperConnection,
  THEMES, ACCENT_COLORS, AI_PROVIDERS, DEFAULT_PROMPTS,
  addToCustomDictionary, removeFromCustomDictionary, syncServerAIConfig
} from '../../store/settingsStore';
import { getServerUrl, setServerUrl, checkServerStatus } from '../../store/documentStore';

const SettingsModal = ({ isOpen, onClose, initialTab = 'appearance' }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'appearance'); // 'appearance' | 'ai' | 'imt' | 'languagetool' | 'prompts' | 'server' | 'about'
  const [settings, setSettings] = useState(getSettings());
  const [serverUrlInput, setServerUrlInput] = useState(getServerUrl());
  
  // Show / hide password states for each provider
  const [showKeys, setShowKeys] = useState({});
  
  // Test connection states: { [providerId]: { loading: boolean, success: boolean, message: string } }
  const [testStates, setTestStates] = useState({});
  const [serverTestState, setServerTestState] = useState(null);
  const [ltTestState, setLtTestState] = useState(null);
  const [whisperTestState, setWhisperTestState] = useState(null);
  const [savedFeedback, setSavedFeedback] = useState(false);
  
  // Active selected provider sub-tab in AI settings
  const [selectedAIProvider, setSelectedAIProvider] = useState('gemini');

  // Custom dictionary input
  const [dictWordInput, setDictWordInput] = useState('');

  // Auto-updater state
  const [updateState, setUpdateState] = useState({
    status: 'idle', // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
    message: '',
    progress: 0,
    versionInfo: null
  });

  // Server AI configuration state
  const [serverAIConfig, setServerAIConfig] = useState(null);
  const [serverAITestState, setServerAITestState] = useState(null);
  const [serverAISaveFeedback, setServerAISaveFeedback] = useState(null);
  const [showServerKey, setShowServerKey] = useState(false);

  useEffect(() => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const onChecking = () => setUpdateState({ status: 'checking', message: 'Søger efter nye opdateringer...', progress: 0, versionInfo: null });
        const onAvailable = (_e, info) => setUpdateState({ status: 'available', message: `Ny version v${info?.version || ''} fundet! Downloader...`, progress: 0, versionInfo: info });
        const onNotAvailable = () => setUpdateState({ status: 'not-available', message: 'Du bruger allerede den nyeste version (v1.0.0).', progress: 0, versionInfo: null });
        const onProgress = (_e, progress) => setUpdateState(prev => ({ ...prev, status: 'downloading', message: `Downloader opdatering: ${Math.round(progress.percent)}%`, progress: Math.round(progress.percent) }));
        const onDownloaded = (_e, info) => setUpdateState({ status: 'downloaded', message: `Version v${info?.version || ''} er downloadet og klar til installation!`, progress: 100, versionInfo: info });
        const onError = (_e, err) => setUpdateState({ status: 'error', message: `Fejl ved opdateringstjek: ${err}`, progress: 0, versionInfo: null });

        ipcRenderer.on('updater:checking', onChecking);
        ipcRenderer.on('updater:available', onAvailable);
        ipcRenderer.on('updater:not-available', onNotAvailable);
        ipcRenderer.on('updater:progress', onProgress);
        ipcRenderer.on('updater:downloaded', onDownloaded);
        ipcRenderer.on('updater:error', onError);

        return () => {
          ipcRenderer.removeListener('updater:checking', onChecking);
          ipcRenderer.removeListener('updater:available', onAvailable);
          ipcRenderer.removeListener('updater:not-available', onNotAvailable);
          ipcRenderer.removeListener('updater:progress', onProgress);
          ipcRenderer.removeListener('updater:downloaded', onDownloaded);
          ipcRenderer.removeListener('updater:error', onError);
        };
      } catch {}
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        setUpdateState({ status: 'checking', message: 'Kontrollerer serveren for nye versioner...', progress: 0, versionInfo: null });
        await ipcRenderer.invoke('set-update-url', serverUrlInput);
        const res = await ipcRenderer.invoke('check-for-updates');
        if (res.status === 'dev') {
          setUpdateState({ status: 'idle', message: 'Opdateringstjek er deaktiveret i udviklingstilstand (fungerer i den installerede .exe).', progress: 0, versionInfo: null });
        }
      } catch (err) {
        setUpdateState({ status: 'error', message: err.message, progress: 0, versionInfo: null });
      }
    } else {
      setUpdateState({ status: 'idle', message: 'Kører i webbrowser. Auto-updates fungerer i skrivebordsappen (.exe).', progress: 0, versionInfo: null });
    }
  };

  const handleInstallUpdate = () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('quit-and-install-update');
      } catch {}
    }
  };

  useEffect(() => {
    if (isOpen) {
      const current = getSettings();
      setSettings(current);
      setSelectedAIProvider(current.aiProvider || 'gemini');
      setServerUrlInput(getServerUrl());
      setSavedFeedback(false);
      setTestStates({});
      setServerTestState(null);
      setLtTestState(null);
      setDictWordInput('');
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleOpenSettingsEvent = (e) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener('openSettings', handleOpenSettingsEvent);
    return () => window.removeEventListener('openSettings', handleOpenSettingsEvent);
  }, []);

  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdated);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdated);
  }, []);

  // Hent serverens AI konfiguration når server-fanen er aktiv
  useEffect(() => {
    if (isOpen && activeTab === 'server' && serverUrlInput) {
      const cleanUrl = serverUrlInput.replace(/\/+$/, '');
      fetch(`${cleanUrl}/api/ai/config`, { signal: AbortSignal.timeout(3000) })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.config) {
            setServerAIConfig(d.config);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, activeTab, serverUrlInput]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleShowKey = (providerId) => {
    setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const updateSetting = (key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      
      // Live preview of theme or accent color changes
      if (key === 'theme' || key === 'accentColor') {
        applyTheme(updated.theme, updated.accentColor);
      }
      
      // Gem automatisk med det samme i localStorage og udsend event
      saveSettings(updated);
      
      return updated;
    });
  };

  const handleTestAI = async (providerId) => {
    setTestStates(prev => ({
      ...prev,
      [providerId]: { loading: true, message: 'Tester forbindelse...' }
    }));

    const res = await testAIConnection(providerId, settings);
    
    setTestStates(prev => ({
      ...prev,
      [providerId]: { 
        loading: false, 
        success: res.success, 
        message: res.message, 
        models: res.models || [] 
      }
    }));
  };

  const handleTestServer = async () => {
    setServerTestState({ loading: true, message: 'Tester serverforbindelse...' });
    setServerUrl(serverUrlInput);
    try {
      const cleanUrl = serverUrlInput.replace(/\/+$/, '');
      const docOk = await checkServerStatus();
      if (!docOk) {
        setServerTestState({ loading: false, success: false, message: `Kunne ikke forbinde til ${cleanUrl}. Tjek at serveren kører på din Server-PC.` });
        return;
      }

      // Hent serverens AI konfiguration
      try {
        const confRes = await fetch(`${cleanUrl}/api/ai/config`, { signal: AbortSignal.timeout(3000) });
        if (confRes.ok) {
          const confData = await confRes.json();
          if (confData.success && confData.config) {
            setServerAIConfig(confData.config);
          }
        }
      } catch {}

      let aiDetails = '';
      try {
        const aiRes = await fetch(`${cleanUrl}/api/ai/status`, { signal: AbortSignal.timeout(3000) });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.status === 'online') {
            const name = aiData.providerName || aiData.activeProvider;
            const model = aiData.model ? ` (${aiData.model})` : '';
            aiDetails = ` • AI: Klar [${name}${model}]`;
          } else {
            aiDetails = ` • AI: ${aiData.message || 'Offline'}`;
          }
        }
      } catch {}

      setServerTestState({
        loading: false,
        success: true,
        message: `Forbindelse oprettet til Server Hub! Dokumenter: OK${aiDetails}`
      });
    } catch (err) {
      setServerTestState({ loading: false, success: false, message: `Fejl: ${err.message}` });
    }
  };

  const handleTestServerAI = async () => {
    if (!serverAIConfig) return;
    setServerAITestState({ loading: true, message: 'Tester valgte server AI...' });
    try {
      const cleanUrl = serverUrlInput.replace(/\/+$/, '');
      const active = serverAIConfig.activeProvider;
      const res = await fetch(`${cleanUrl}/api/ai/test-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: active,
          settings: serverAIConfig.providers[active]
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      setServerAITestState({
        loading: false,
        success: data.success,
        message: data.message || (data.success ? 'Forbindelse OK!' : 'Fejl ved forbindelse')
      });
    } catch (err) {
      setServerAITestState({
        loading: false,
        success: false,
        message: `Fejl: ${err.message}`
      });
    }
  };

  const handleSaveServerAIConfig = async () => {
    if (!serverAIConfig) return;
    setServerAISaveFeedback({ loading: true, message: 'Gemmer på serveren...' });
    try {
      const cleanUrl = serverUrlInput.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/ai/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverAIConfig),
        signal: AbortSignal.timeout(5000)
      });
      const data = await res.json();
      if (data.success) {
        setServerAISaveFeedback({ loading: false, success: true, message: 'Indstillinger er gemt på Server-PC!' });
        setTimeout(() => setServerAISaveFeedback(null), 3500);
        syncServerAIConfig();
      } else {
        setServerAISaveFeedback({ loading: false, success: false, message: data.error || 'Kunne ikke gemme' });
      }
    } catch (err) {
      setServerAISaveFeedback({ loading: false, success: false, message: `Fejl: ${err.message}` });
    }
  };

  const handleTestLanguageTool = async () => {
    setLtTestState({ loading: true, message: 'Tester forbindelse til LanguageTool...' });
    const res = await testLanguageToolConnection(settings.languageToolUrl, settings.languageToolLanguage);
    setLtTestState({
      loading: false,
      success: res.success,
      message: res.message,
      count: res.count
    });
  };

  const handleTestWhisper = async () => {
    setWhisperTestState({ loading: true, message: 'Tester forbindelse til Faster Whisper...' });
    const res = await testWhisperConnection(settings.whisperApiUrl, settings.whisperApiKey);
    setWhisperTestState({
      loading: false,
      success: res.success,
      message: res.message
    });
  };

  const handleResetSettings = () => {
    if (window.confirm('Er du sikker på, at du vil nulstille alle indstillinger til standard?')) {
      localStorage.removeItem('mitEgetWord_settings');
      const defaults = getSettings();
      setSettings(defaults);
      applyTheme(defaults.theme, defaults.accentColor);
      setServerUrlInput('http://localhost:3000');
      setServerUrl('http://localhost:3000');
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    }
  };

  const handleResetAllPrompts = () => {
    if (window.confirm('Er du sikker på, at du vil nulstille alle prompts til standardindstillingerne?')) {
      setSettings(prev => {
        const updated = {
          ...prev,
          ...DEFAULT_PROMPTS
        };
        saveSettings(updated);
        return updated;
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    }
  };

  const handleSave = () => {
    setServerUrl(serverUrlInput);
    saveSettings(settings);
    setSavedFeedback(true);
    
    // Give user visual confirmation before closing
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 600);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-title">
            <div className="settings-title-icon">
              <Sliders size={18} />
            </div>
            <div>
              <h3>Indstillinger</h3>
              <p>Tilpas udseende, AI assistenter og netværk</p>
            </div>
          </div>
          <button className="settings-close-btn" onClick={onClose} title="Luk (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Navigation Sidebar + Content */}
        <div className="settings-modal-body">
          {/* Tabs Navigation */}
          <div className="settings-sidebar">
            <button 
              className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              <Palette size={16} />
              <span>Udseende & Tema</span>
            </button>

            <button 
              className={`settings-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <Bot size={16} />
              <span>AI Assistent</span>
              <span className="settings-tab-badge">
                {settings.aiProvider === 'gemini' ? 'Gemini' : settings.aiProvider === 'local' ? 'Lokal AI' : settings.aiProvider}
              </span>
            </button>

            <button 
              className={`settings-tab-btn ${activeTab === 'imt' ? 'active' : ''}`}
              onClick={() => setActiveTab('imt')}
            >
              <ScanText size={16} />
              <span>ImT (Billede til Tekst)</span>
              <span className="settings-tab-badge" style={{ color: '#38bdf8' }}>Server AI</span>
            </button>

            <button 
              className={`settings-tab-btn ${activeTab === 'languagetool' ? 'active' : ''}`}
              onClick={() => setActiveTab('languagetool')}
            >
              <SpellCheck size={16} />
              <span>Sprog & Korrektur</span>
              {settings.languageToolEnabled ? (
                <span className="settings-tab-badge" style={{ color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>Aktiv</span>
              ) : (
                <span className="settings-tab-badge">Fra</span>
              )}
            </button>

            <button 
              className={`settings-tab-btn ${activeTab === 'whisper' ? 'active' : ''}`}
              onClick={() => setActiveTab('whisper')}
            >
              <Mic size={16} />
              <span>Tale til Tekst (Whisper)</span>
              <span className="settings-tab-badge" style={{ color: '#38bdf8' }}>AltGr</span>
            </button>

            <button 
              className={`settings-tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
              onClick={() => setActiveTab('prompts')}
            >
              <Terminal size={16} />
              <span>Prompts & Regler</span>
            </button>

            <button 
              className={`settings-tab-btn ${activeTab === 'server' ? 'active' : ''}`}
              onClick={() => setActiveTab('server')}
            >
              <Server size={16} />
              <span>Netværk & Server</span>
            </button>

            <button 
              className={`settings-tab-btn ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <Info size={16} />
              <span>Om & Nulstil</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="settings-content-area">
            
            {/* ================= TAB 1: UDSEENDE & TEMA ================= */}
            {activeTab === 'appearance' && (
              <div className="settings-tab-pane">
                <div className="settings-section">
                  <h4 className="settings-section-title">Farvetema</h4>
                  <p className="settings-section-desc">Vælg et overordnet tema for MitEgetWord brugerfladen.</p>

                  <div className="theme-grid">
                    {THEMES.map(theme => {
                      const isSelected = settings.theme === theme.id;
                      return (
                        <div 
                          key={theme.id}
                          className={`theme-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => updateSetting('theme', theme.id)}
                        >
                          <div 
                            className="theme-card-preview" 
                            style={{ backgroundColor: theme.preview, color: theme.text }}
                          >
                            <div className="theme-card-preview-bar"></div>
                            <div className="theme-card-preview-body">
                              <div className="theme-card-preview-line long"></div>
                              <div className="theme-card-preview-line short"></div>
                            </div>
                            {isSelected && (
                              <div className="theme-selected-check">
                                <Check size={14} />
                              </div>
                            )}
                          </div>
                          <div className="theme-card-info">
                            <span className="theme-card-name">{theme.name}</span>
                            <span className="theme-card-desc">{theme.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="settings-section">
                  <h4 className="settings-section-title">Accentfarve</h4>
                  <p className="settings-section-desc">Farven på knapper, markeringer og aktive ikoner.</p>

                  <div className="accent-color-list">
                    {ACCENT_COLORS.map(color => {
                      const isSelected = (settings.accentColor || '#2b579a').toLowerCase() === color.value.toLowerCase();
                      return (
                        <button
                          key={color.value}
                          className={`accent-color-btn ${isSelected ? 'selected' : ''}`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => updateSetting('accentColor', color.value)}
                          title={color.name}
                        >
                          {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="settings-section">
                  <h4 className="settings-section-title">Standard Word-dokument Lærred</h4>
                  <p className="settings-section-desc">Vælg om nye eller åbnede Word dokumenter som udgangspunkt følger det valgte farvetema eller altid vises med klassisk hvidt papir.</p>

                  <div className="canvas-mode-toggle">
                    <button
                      className={`canvas-mode-btn ${settings.defaultWordCanvas === 'dark' ? 'active' : ''}`}
                      onClick={() => updateSetting('defaultWordCanvas', 'dark')}
                    >
                      <Moon size={16} />
                      <span>Følg Valgt Tema (Standard)</span>
                    </button>
                    <button
                      className={`canvas-mode-btn ${settings.defaultWordCanvas === 'light' ? 'active' : ''}`}
                      onClick={() => updateSetting('defaultWordCanvas', 'light')}
                    >
                      <Sun size={16} />
                      <span>Klassisk Hvidt Papir</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 2: AI ASSISTENT ================= */}
            {activeTab === 'ai' && (
              <div className="settings-tab-pane">
                {/* Vælg Aktiv AI Udbyder */}
                <div className="settings-section">
                  <h4 className="settings-section-title">Vælg Aktiv AI Assistent</h4>
                  <p className="settings-section-desc">
                    Vælg hvilken AI der skal assistere dig under skrivning og i prompt-baren i Word.
                    Alle API-nøgler, modeller og serverforbindelser håndteres automatisk af Server Central.
                  </p>

                  <div className="ai-engines-grid">
                    {AI_PROVIDERS.map(provider => {
                      const isActive = settings.aiProvider === provider.id;

                      return (
                        <div
                          key={provider.id}
                          className={`ai-engine-card ${isActive ? 'is-active' : ''}`}
                          onClick={() => {
                            updateSetting('aiProvider', provider.id);
                            setSelectedAIProvider(provider.id);
                          }}
                        >
                          <div className="ai-engine-top">
                            <div className={`ai-engine-icon ${provider.id}`}>
                              {provider.id === 'gemini' && <Sparkles size={18} />}
                              {provider.id === 'local' && <HardDrive size={18} />}
                              {['openai', 'anthropic', 'deepseek', 'openrouter'].includes(provider.id) && <Bot size={18} />}
                              {provider.id === 'groq' && <Sparkles size={18} />}
                            </div>
                            {isActive ? (
                              <span className="ai-badge-active">
                                <CheckCircle2 size={12} /> AKTIV
                              </span>
                            ) : (
                              <span className="ai-badge-inactive">Vælg</span>
                            )}
                          </div>
                          <div className="ai-engine-details">
                            <span className="ai-engine-name">{provider.name}</span>
                            <span className="ai-engine-sub">
                              {provider.id === 'gemini' 
                                ? 'Sky-AI (Lynhurtig via Server)' 
                                : provider.id === 'local'
                                ? '100% Offline (Ollama via Server)'
                                : 'Styres af Server Central'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Aktiv AI Information og Test */}
                <div className="settings-section">
                  <div className="provider-config-box">
                    <div className="provider-header">
                      {settings.aiProvider === 'gemini' ? (
                        <Sparkles size={22} className="provider-icon gemini" />
                      ) : settings.aiProvider === 'local' ? (
                        <HardDrive size={22} className="provider-icon local" />
                      ) : (
                        <Bot size={22} className="provider-icon" />
                      )}
                      <div>
                        <h5 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                          {AI_PROVIDERS.find(p => p.id === settings.aiProvider)?.name || settings.aiProvider}
                        </h5>
                        <p style={{ margin: '3px 0 0 0', fontSize: 12, color: 'var(--text-secondary, #888888)' }}>
                          {settings.aiProvider === 'gemini' 
                            ? 'Kører via Google Gemini API gennem Server Central. Lynhurtig responstid og høj sproglig intelligens.' 
                            : settings.aiProvider === 'local'
                            ? 'Kører 100% offline og privat på dit eget netværk (Main PC via Tailscale). Ingen data forlader dine egne computere.'
                            : 'Kører gennem Server Central. Serveren håndterer automatisk API-nøgler og modeller.'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 8, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#bae6fd' }}>
                        <Server size={15} />
                        <span>Server Central: <strong>{serverUrlInput}</strong> (Nøglefri på denne maskine)</span>
                      </div>
                    </div>

                    <div className="provider-test-row">
                      <button 
                        type="button"
                        className="test-btn" 
                        disabled={testStates[settings.aiProvider]?.loading}
                        onClick={() => handleTestAI(settings.aiProvider)}
                      >
                        {testStates[settings.aiProvider]?.loading ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                        <span>Test AI Forbindelse</span>
                      </button>
                      {testStates[settings.aiProvider] && (
                        <div className={`test-result ${testStates[settings.aiProvider].success ? 'success' : 'error'}`}>
                          {testStates[settings.aiProvider].success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          <span>{testStates[settings.aiProvider].message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* System Persona / Skrivestil */}
                <div className="settings-section">
                  <div className="prompts-nav-callout">
                    <div>
                      <h4 className="settings-section-title" style={{ margin: 0 }}>System Persona & Skrivestil</h4>
                      <p className="settings-section-desc" style={{ marginBottom: 0 }}>
                        Tilpas assistentens instruktioner, sprog og personlighed for svar i Word og i prompt-baren.
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className="switch-tab-btn"
                      onClick={() => setActiveTab('prompts')}
                    >
                      <span>Åbn Prompts & Regler</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="settings-group" style={{ marginTop: 14 }}>
                    <textarea 
                      rows={3}
                      value={settings.systemInstructions || ''}
                      onChange={(e) => updateSetting('systemInstructions', e.target.value)}
                      placeholder="Du er en hjælpsom og professionel skriveassistent. Svar altid på dansk..."
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB: IMT (BILLEDE TIL TEKST) ================= */}
            {activeTab === 'imt' && (
              <div className="settings-tab-pane">
                <div className="settings-section">
                  <h4 className="settings-section-title">ImT - Billedgenkendelse (Vision AI)</h4>
                  <p className="settings-section-desc">
                    Udtræk tekst automatisk fra billeder, noter og screenshots direkte ind på dit lærred.
                  </p>

                  <div className="provider-config-box" style={{ marginTop: 8 }}>
                    <div className="provider-header">
                      <ScanText size={22} className="provider-icon" style={{ color: '#38bdf8' }} />
                      <div>
                        <h5 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Central Billed-AI (Vision)</h5>
                        <p style={{ margin: '3px 0 0 0', fontSize: 12, color: 'var(--text-secondary, #888888)' }}>
                          Billed-AI styres 100% af Server Central. Klienten behøver ingen API-nøgler eller lokal installation.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-secondary, #888888)' }}>Billed-AI Server:</span>
                        <code style={{ color: '#38bdf8' }}>{serverUrlInput}</code>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-secondary, #888888)' }}>Aktiv Vision-motor på server:</span>
                        <span style={{ fontWeight: 600, color: '#34d399' }}>Automatisk styret af serveren</span>
                      </div>
                    </div>

                    <div className="provider-test-row">
                      <button 
                        type="button"
                        className="test-btn" 
                        disabled={testStates.imt?.loading}
                        onClick={() => handleTestAI('imt')}
                      >
                        {testStates.imt?.loading ? <RefreshCw size={14} className="spin" /> : <ScanText size={14} />}
                        <span>Test Billed-AI Forbindelse</span>
                      </button>
                      {testStates.imt && (
                        <div className={`test-result ${testStates.imt.success ? 'success' : 'error'}`}>
                          {testStates.imt.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          <span>{testStates.imt.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <h4 className="settings-section-title">Instruktion til Billed-AI</h4>
                  <p className="settings-section-desc">Instruks som serverens vision-model modtager sammen med dit billede.</p>

                  <div className="settings-group">
                    <textarea 
                      rows={3}
                      value={settings.imtPrompt || 'Uddrag al tekst fra dette billede præcist som det står skrevet. Svar udelukkende med den udtrukne tekst uden ekstra forklaringer eller kommentarer.'}
                      onChange={(e) => updateSetting('imtPrompt', e.target.value)}
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <small>Standardinstruksen sikrer at al synlig tekst på billedet overføres rent til dit kanvas.</small>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB: SPROG & KORREKTUR (LANGUAGETOOL) ================= */}
            {activeTab === 'languagetool' && (
              <div className="settings-tab-pane">
                <div className="settings-section">
                  <div className="section-title-row">
                    <div>
                      <h4 className="settings-section-title">LanguageTool Stave- & Grammatikkontrol</h4>
                      <p className="settings-section-desc">
                        Forbind til din selv-hostede LanguageTool API på din egen server eller PC for avanceret dansk og flersproget stave- og grammatikkontrol.
                      </p>
                    </div>
                  </div>

                  {/* Enable / Disable Toggle Card */}
                  <div className="prompt-toggles-container" style={{ marginTop: 12 }}>
                    <label className="prompt-toggle-item">
                      <input 
                        type="checkbox" 
                        checked={settings.languageToolEnabled !== false}
                        onChange={(e) => updateSetting('languageToolEnabled', e.target.checked)}
                      />
                      <div>
                        <strong>Aktivér LanguageTool i MitEgetWord</strong>
                        <span>
                          Giver adgang til stave- og grammatikkontrol i Word. Rettelser og forslag vises automatisk i sidemargenen.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* API Server URL */}
                  <div className="settings-group" style={{ marginTop: 16 }}>
                    <label>LanguageTool API URL / Adresse</label>
                    <input 
                      type="text" 
                      value={settings.languageToolUrl || ''} 
                      onChange={(e) => updateSetting('languageToolUrl', e.target.value)}
                      placeholder="http://192.168.1.50:8010/v2 eller http://localhost:8010/v2"
                      disabled={settings.languageToolEnabled === false}
                    />
                    <small>
                      Indtast adressen til din LanguageTool server-PC. F.eks. <code>http://localhost:8010/v2</code> eller <code>http://192.168.1.x:8010/v2</code> på dit lokale netværk.
                    </small>
                  </div>

                  {/* Test Connection Button and Status */}
                  <div className="provider-test-row" style={{ marginTop: 12 }}>
                    <button 
                      type="button"
                      className="test-btn" 
                      disabled={ltTestState?.loading || settings.languageToolEnabled === false || !settings.languageToolUrl}
                      onClick={handleTestLanguageTool}
                    >
                      {ltTestState?.loading ? <RefreshCw size={14} className="spin" /> : <SpellCheck size={14} />}
                      <span>Test Forbindelse</span>
                    </button>
                    {ltTestState && (
                      <div className={`test-result ${ltTestState.success ? 'success' : 'error'}`}>
                        {ltTestState.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <span>{ltTestState.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Language Selector */}
                  <div className="settings-group" style={{ marginTop: 20 }}>
                    <label>Standard Sprog</label>
                    <select 
                      className="settings-select"
                      value={settings.languageToolLanguage || 'da-DK'}
                      onChange={(e) => updateSetting('languageToolLanguage', e.target.value)}
                      disabled={settings.languageToolEnabled === false}
                    >
                      <option value="da-DK">Dansk (Danmark) - da-DK</option>
                      <option value="auto">Automatisk detektering (auto)</option>
                      <option value="en-US">Engelsk (US) - en-US</option>
                      <option value="en-GB">Engelsk (UK) - en-GB</option>
                      <option value="de-DE">Tysk (Tyskland) - de-DE</option>
                      <option value="es">Spansk - es</option>
                      <option value="fr">Fransk - fr</option>
                      <option value="sv-SE">Svensk - sv-SE</option>
                      <option value="nb-NO">Norsk (Bokmål) - nb-NO</option>
                    </select>
                    <small>Sproget der anvendes som udgangspunkt ved korrekturkontrol.</small>
                  </div>

                  {/* Checking Level */}
                  <div className="settings-group" style={{ marginTop: 16 }}>
                    <label>Korrekturniveau</label>
                    <select 
                      className="settings-select"
                      value={settings.languageToolLevel || 'default'}
                      onChange={(e) => updateSetting('languageToolLevel', e.target.value)}
                      disabled={settings.languageToolEnabled === false}
                    >
                      <option value="default">Standard (Stavefejl og almindelig grammatik)</option>
                      <option value="picky">Grundig / Picky (Inkluderer stilistiske forslag, kommaer og typografi)</option>
                    </select>
                    <small>Vælg "Grundig" hvis du ønsker mere dybdegående stil- og kommateringsforslag.</small>
                  </div>

                  {/* Smart Filter Options */}
                  <div className="prompt-toggles-container" style={{ marginTop: 20 }}>
                    <label className="prompt-toggle-item">
                      <input 
                        type="checkbox" 
                        checked={settings.languageToolAutoCheck !== false}
                        onChange={(e) => updateSetting('languageToolAutoCheck', e.target.checked)}
                        disabled={settings.languageToolEnabled === false}
                      />
                      <div>
                        <strong>Løbende automatisk baggrundskontrol (Anbefalet)</strong>
                        <span>
                          Tjekker automatisk dokumentet i baggrunden, når du holder en kort pause med at skrive. Bruger intelligent afsnits-caching, så din server-PC ikke overbelastes.
                        </span>
                      </div>
                    </label>

                    <label className="prompt-toggle-item">
                      <input 
                        type="checkbox" 
                        checked={settings.languageToolRecognizeEnglish !== false}
                        onChange={(e) => updateSetting('languageToolRecognizeEnglish', e.target.checked)}
                        disabled={settings.languageToolEnabled === false}
                      />
                      <div>
                        <strong>Genkend engelske ord i danske tekster (Anbefalet)</strong>
                        <span>
                          Undgår at engelske fagtermer som "task", "feature" og "rework" markeres som stavefejl i dansk tekst. Ord valideres automatisk mod en engelsk ordbog.
                        </span>
                      </div>
                    </label>

                    <label className="prompt-toggle-item">
                      <input 
                        type="checkbox" 
                        checked={settings.languageToolIgnoreCamelCase !== false}
                        onChange={(e) => updateSetting('languageToolIgnoreCamelCase', e.target.checked)}
                        disabled={settings.languageToolEnabled === false}
                      />
                      <div>
                        <strong>Ignorér produktnavne og akronymer (CamelCase)</strong>
                        <span>
                          Springer automatisk over ord som "MitEgetWord", "JavaScript", "QoL", "API", "HTML" og andre CamelCase- og akronym-ord.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Custom Dictionary */}
                  <div className="settings-dict-section">
                    <div className="settings-dict-header">
                      <div className="settings-dict-title">
                        <BookOpen size={15} />
                        <span>Brugerens Ordbog</span>
                      </div>
                      {Array.isArray(settings.customDictionary) && settings.customDictionary.length > 0 && (
                        <span className="settings-dict-count">
                          {settings.customDictionary.length} {settings.customDictionary.length === 1 ? 'ord' : 'ord'}
                        </span>
                      )}
                    </div>
                    <small style={{ display: 'block', marginBottom: 10, color: 'var(--text-secondary, #999999)', fontSize: 12 }}>
                      Ord du tilføjer her ignoreres altid under korrekturkontrol. Du kan også tilføje ord direkte fra højrekliksmenuen i editoren.
                    </small>
                    <div className="settings-dict-input-form">
                      <input
                        type="text"
                        className="settings-dict-input"
                        placeholder="Skriv et ord og tryk Tilføj..."
                        value={dictWordInput}
                        onChange={(e) => setDictWordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && dictWordInput.trim()) {
                            addToCustomDictionary(dictWordInput.trim());
                            setSettings(prev => ({
                              ...prev,
                              customDictionary: [...(prev.customDictionary || []), dictWordInput.trim()]
                            }));
                            setDictWordInput('');
                          }
                        }}
                        disabled={settings.languageToolEnabled === false}
                      />
                      <button
                        type="button"
                        className="settings-dict-add-btn"
                        disabled={!dictWordInput.trim() || settings.languageToolEnabled === false}
                        onClick={() => {
                          if (dictWordInput.trim()) {
                            addToCustomDictionary(dictWordInput.trim());
                            setSettings(prev => ({
                              ...prev,
                              customDictionary: [...(prev.customDictionary || []), dictWordInput.trim()]
                            }));
                            setDictWordInput('');
                          }
                        }}
                      >
                        <Plus size={14} />
                        <span>Tilføj</span>
                      </button>
                    </div>
                    <div className="settings-dict-chips">
                      {Array.isArray(settings.customDictionary) && settings.customDictionary.length > 0 ? (
                        settings.customDictionary.map((word, idx) => (
                          <div key={`${word}-${idx}`} className="settings-dict-chip">
                            <span>{word}</span>
                            <button
                              type="button"
                              className="settings-dict-chip-del"
                              title={`Fjern "${word}" fra ordbogen`}
                              onClick={() => {
                                removeFromCustomDictionary(word);
                                setSettings(prev => ({
                                  ...prev,
                                  customDictionary: (prev.customDictionary || []).filter(
                                    (w, i) => !(w.toLowerCase() === word.toLowerCase() && i === idx)
                                  )
                                }));
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="settings-dict-empty">Ingen ord tilføjet endnu.</div>
                      )}
                    </div>
                  </div>

                  {/* Helpful Quick Tip Callout */}
                  <div className="prompts-nav-callout" style={{ marginTop: 24, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <strong style={{ fontSize: 13, color: 'var(--text-primary, #ffffff)' }}>💡 Sådan kører du LanguageTool på din server-PC</strong>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaaaaa)', lineHeight: 1.5 }}>
                      Hvis du bruger Docker på din server-pc, kan du starte LanguageTool med en enkelt kommando:<br />
                      <code style={{ display: 'inline-block', marginTop: 4, background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: 4, color: '#38bdf8' }}>
                        docker run -d -p 8010:8010 --name languagetool erikvl87/languagetool
                      </code><br />
                      Sørg for at port 8010 er åben i din server-pc's firewall på lokalnetværket.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB: TALE TIL TEKST (FASTER WHISPER) ================= */}
            {activeTab === 'whisper' && (
              <div className="settings-tab-pane">
                <div className="settings-section">
                  <div className="section-title-row">
                    <div>
                      <h4 className="settings-section-title">Faster Whisper Tale-til-Tekst (Diktering)</h4>
                      <p className="settings-section-desc">
                        Optag din stemme og få den transskriberet direkte til tekst ved din cursor i dokumentet via din Faster Whisper AI-server.
                      </p>
                    </div>
                  </div>

                  {/* Genvejstast & Sikkerhedsinfo Card */}
                  <div className="prompts-nav-callout" style={{ marginTop: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Mic size={16} color="#38bdf8" />
                      <strong style={{ fontSize: 13, color: 'var(--text-primary, #ffffff)' }}>Tastatursikret optagelse med AltGr</strong>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaaaaa)', lineHeight: 1.6 }}>
                      • Tryk <strong>AltGr</strong> for at starte optagelse, og tryk igen (eller slip hvis du holdt den nede) for at indsætte teksten hvor end din markør står.<br />
                      • Du kan også bruge den visuelle mikrofonknap i AI-pillen forneden.<br />
                      • <strong>Privatliv:</strong> Lydoptagelsen gemmes aldrig som en fil på din computer. Den behandles udelukkende i hukommelsen (RAM) og slettes straks efter afsendelse.<br />
                      • <strong>Tastatursikret:</strong> Specialtegn som <code>@</code>, <code>€</code>, <code>{'{'}</code>, <code>{'}'}</code>, <code>[</code>, <code>]</code> virker uforstyrret som normalt.
                    </span>
                  </div>

                  {/* Whisper API URL */}
                  <div className="settings-group" style={{ marginTop: 18 }}>
                    <label>Whisper API URL / Endepunkt</label>
                    <input 
                      type="text" 
                      value={settings.whisperApiUrl || ''} 
                      onChange={(e) => updateSetting('whisperApiUrl', e.target.value)}
                      placeholder="http://100.67.46.116:8000/v1/audio/transcriptions"
                    />
                    <small>
                      Den fulde URL til transskriptioner, f.eks. <code>http://100.67.46.116:8000/v1/audio/transcriptions</code>
                    </small>
                  </div>

                  {/* Whisper API Key */}
                  <div className="settings-group">
                    <label>API Nøgle (Bearer Token)</label>
                    <div className="settings-input-with-action">
                      <input 
                        type={showKeys['whisper'] ? 'text' : 'password'}
                        value={settings.whisperApiKey || ''} 
                        onChange={(e) => updateSetting('whisperApiKey', e.target.value)}
                        placeholder="f.eks. min-hemmelige-api-noegle-123"
                      />
                      <button 
                        type="button" 
                        className="input-eye-btn"
                        onClick={() => setShowKeys(prev => ({ ...prev, whisper: !prev.whisper }))}
                        title={showKeys['whisper'] ? 'Skjul API nøgle' : 'Vis API nøgle'}
                      >
                        {showKeys['whisper'] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <small>Autorisationsnøgle der sendes med i Authorization-headeren.</small>
                  </div>
                  {/* Whisper Model & Language */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                    <div className="settings-group">
                      <label>Model</label>
                      <input 
                        type="text" 
                        value={settings.whisperModel || ''} 
                        onChange={(e) => updateSetting('whisperModel', e.target.value)}
                        placeholder="small"
                      />
                      <small>f.eks. <code>small</code>, <code>base</code>, <code>medium</code>, <code>large-v3</code></small>
                    </div>

                    <div className="settings-group">
                      <label>Sprogkode</label>
                      <input 
                        type="text" 
                        value={settings.whisperLanguage || ''} 
                        onChange={(e) => updateSetting('whisperLanguage', e.target.value)}
                        placeholder="da"
                      />
                      <small>f.eks. <code>da</code> for dansk eller <code>en</code> for engelsk</small>
                    </div>
                  </div>

                  {/* Whisper Prompt */}
                  <div className="settings-group" style={{ marginTop: 14 }}>
                    <label>Initial Prompt (Vejledning til tegnsætning)</label>
                    <textarea 
                      rows={2}
                      value={settings.whisperPrompt || ''} 
                      onChange={(e) => updateSetting('whisperPrompt', e.target.value)}
                      placeholder="Dette er en samtale på dansk. Her bruges komma, punktum og store bogstaver."
                    />
                    <small>Whisper bruger denne prompt til at guide modellens tegnsætning, store bogstaver og sprogtone.</small>
                  </div>

                  {/* Test Connection Button and Status */}
                  <div className="provider-test-row" style={{ marginTop: 16 }}>
                    <button 
                      type="button" 
                      className="test-btn" 
                      disabled={whisperTestState?.loading || !settings.whisperApiUrl}
                      onClick={handleTestWhisper}
                    >
                      {whisperTestState?.loading ? <RefreshCw size={14} className="spin" /> : <Mic size={14} />}
                      <span>Test Forbindelse til Whisper</span>
                    </button>
                    {whisperTestState && (
                      <div className={`test-result ${whisperTestState.success ? 'success' : 'error'}`}>
                        {whisperTestState.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <span>{whisperTestState.message}</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* ================= TAB 3: PROMPTS & REGLER ================= */}
            {activeTab === 'prompts' && (
              <div className="settings-tab-pane">
                <div className="prompt-top-banner">
                  <div>
                    <h4 className="settings-section-title" style={{ margin: 0 }}>Prompts & Systeminstruktioner</h4>
                    <p className="settings-section-desc" style={{ marginBottom: 0 }}>
                      Her kan du styre og tilpasse samtlige tekster og instrukser, som sendes til AI assistenten.
                    </p>
                  </div>
                  <button 
                    type="button" 
                    className="prompt-reset-all-btn"
                    onClick={handleResetAllPrompts}
                    title="Gendan alle prompts til standardindstillinger"
                  >
                    <RotateCcw size={13} />
                    <span>Gendan alle standardprompts</span>
                  </button>
                </div>

                {/* Sektion 1: System Persona */}
                <div className="settings-section prompt-card">
                  <div className="prompt-header-row">
                    <div>
                      <h5 className="prompt-card-title">1. Assistent Persona & Grundinstruktion</h5>
                      <p className="prompt-card-desc">
                        Sendes altid med som system-instruktion for alle forespørgsler (styrer sprog, tone og adfærd).
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className="prompt-single-reset-btn"
                      onClick={() => updateSetting('systemInstructions', DEFAULT_PROMPTS.systemInstructions)}
                      title="Nulstil denne prompt til standard"
                    >
                      <Undo2 size={13} /> Gendan
                    </button>
                  </div>
                  <div className="settings-group">
                    <textarea 
                      className="prompt-code-textarea"
                      rows={3}
                      value={settings.systemInstructions || ''}
                      onChange={(e) => updateSetting('systemInstructions', e.target.value)}
                      placeholder="Du er en hjælpsom og professionel skriveassistent..."
                    />
                  </div>
                </div>

                {/* Sektion 2: Erstat Tekst Værktøj */}
                <div className="settings-section prompt-card">
                  <div className="prompt-header-row">
                    <div>
                      <h5 className="prompt-card-title">2. Erstat Tekst Værktøj (Direkte i Word)</h5>
                      <p className="prompt-card-desc">
                        Instruktioner der gør AI'en i stand til at overskrive den markerede tekst i dokumentet med HTML.
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className="prompt-single-reset-btn"
                      onClick={() => {
                        updateSetting('toolInstructions', DEFAULT_PROMPTS.toolInstructions);
                        updateSetting('enableToolInstructions', DEFAULT_PROMPTS.enableToolInstructions);
                        updateSetting('smartToolAttachment', DEFAULT_PROMPTS.smartToolAttachment);
                      }}
                      title="Nulstil værktøjsindstillinger og prompt til standard"
                    >
                      <Undo2 size={13} /> Gendan
                    </button>
                  </div>

                  <div className="prompt-toggles-container">
                    <label className="prompt-toggle-item">
                      <input 
                        type="checkbox" 
                        checked={settings.enableToolInstructions !== false}
                        onChange={(e) => updateSetting('enableToolInstructions', e.target.checked)}
                      />
                      <div>
                        <strong>Aktivér Erstat Tekst Værktøj</strong>
                        <span>Tillad at AI'en kan indsætte direkte i dit åbne dokument ved omskrivning.</span>
                      </div>
                    </label>

                    <label className="prompt-toggle-item">
                      <input 
                        type="checkbox" 
                        checked={settings.smartToolAttachment !== false}
                        onChange={(e) => updateSetting('smartToolAttachment', e.target.checked)}
                      />
                      <div>
                        <strong>Smart Værktøjsvedhæftning (Anbefalet)</strong>
                        <span>
                          Vedhæft kun værktøjsprompten, når der er markeret tekst eller anmodet om omskrivning. Forhindrer at AI'en vrøvler om værktøjet, når du skriver nye tekster fra bunden.
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="settings-group" style={{ marginTop: 12 }}>
                    <label>Værktøjets Systemprompt:</label>
                    <textarea 
                      className="prompt-code-textarea"
                      rows={8}
                      value={settings.toolInstructions || ''}
                      onChange={(e) => updateSetting('toolInstructions', e.target.value)}
                      placeholder="[VÆRKTØJ: ERSTAT TEKST]..."
                    />
                  </div>
                </div>

                {/* Sektion 3: Forside & Dokumentsøgning */}
                <div className="settings-section prompt-card">
                  <div className="prompt-header-row">
                    <div>
                      <h5 className="prompt-card-title">3. Dokumentsøgning på Forsiden (Dashboard)</h5>
                      <p className="prompt-card-desc">
                        Anvendes når du skriver i AI-pillen på forsiden. AI'en modtager en oversigt over dine dokumenter.
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className="prompt-single-reset-btn"
                      onClick={() => updateSetting('dashboardPromptTemplate', DEFAULT_PROMPTS.dashboardPromptTemplate)}
                      title="Nulstil dashboard prompt til standard"
                    >
                      <Undo2 size={13} /> Gendan
                    </button>
                  </div>

                  <div className="prompt-var-tags">
                    <span>Tilgængelige variabler:</span>
                    <code>{'{DOCS_LIST}'}</code>
                    <code>{'{USER_QUERY}'}</code>
                  </div>

                  <div className="settings-group">
                    <textarea 
                      className="prompt-code-textarea"
                      rows={6}
                      value={settings.dashboardPromptTemplate || ''}
                      onChange={(e) => updateSetting('dashboardPromptTemplate', e.target.value)}
                    />
                  </div>
                </div>

                {/* Sektion 4: Dokument Kontekst */}
                <div className="settings-section prompt-card">
                  <div className="prompt-header-row">
                    <div>
                      <h5 className="prompt-card-title">4. Markeret Tekst Kontekst (Editor)</h5>
                      <p className="prompt-card-desc">
                        Hvordan markeret tekst fra dokumentet præsenteres for modellen, når du stiller et spørgsmål i Word.
                      </p>
                    </div>
                    <button 
                      type="button" 
                      className="prompt-single-reset-btn"
                      onClick={() => updateSetting('contextPromptTemplate', DEFAULT_PROMPTS.contextPromptTemplate)}
                      title="Nulstil kontekst prompt til standard"
                    >
                      <Undo2 size={13} /> Gendan
                    </button>
                  </div>

                  <div className="prompt-var-tags">
                    <span>Tilgængelige variabler:</span>
                    <code>{'{CONTEXT}'}</code>
                    <code>{'{USER_QUERY}'}</code>
                  </div>

                  <div className="settings-group">
                    <textarea 
                      className="prompt-code-textarea"
                      rows={4}
                      value={settings.contextPromptTemplate || ''}
                      onChange={(e) => updateSetting('contextPromptTemplate', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 3: SERVER & NETVÆRK ================= */}
            {activeTab === 'server' && (
              <div className="settings-tab-pane">
                <div className="settings-section">
                  <h4 className="settings-section-title">MitEgetWord Backend Server</h4>
                  <p className="settings-section-desc">
                    Adressen på computeren eller serveren hvor backend-tjenesten til synkronisering og dokumentlagring kører.
                  </p>

                  <div className="settings-group">
                    <label>Server IP / URL</label>
                    <input 
                      type="text" 
                      value={serverUrlInput} 
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      placeholder="http://localhost:3000 eller http://192.168.1.100:3000"
                    />
                    <small>Standard for lokal brug er <code>http://localhost:3000</code>.</small>
                  </div>

                  <div className="provider-test-row">
                    <button 
                      className="test-btn" 
                      disabled={serverTestState?.loading}
                      onClick={handleTestServer}
                    >
                      {serverTestState?.loading ? <RefreshCw size={14} className="spin" /> : <Server size={14} />}
                      <span>Test Serverforbindelse</span>
                    </button>
                    {serverTestState && (
                      <div className={`test-result ${serverTestState.success ? 'success' : 'error'}`}>
                        {serverTestState.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        <span>{serverTestState.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Server Hosting Quick Guide */}
                  <div className="prompts-nav-callout" style={{ marginTop: 24, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                    <strong style={{ fontSize: 13, color: 'var(--text-primary, #ffffff)' }}>💡 Sådan hoster du alt på din Server-PC</strong>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #aaaaaa)', lineHeight: 1.6 }}>
                      1. Start serveren på din Server-PC ved at dobbeltklikke på filen <code>start-server.bat</code>.<br />
                      2. Vinduet viser din lokale IP-adresse (f.eks. <code>http://192.168.1.50:3000</code>).<br />
                      3. Indtast den her på alle computere, og klik <strong>Gem & Luk</strong>.<br />
                      4. Alle dokumenter, AI-anmodninger og ImT-billeder håndteres nu centralt af din Server-PC!
                    </div>
                    {settings.aiProvider !== 'server' && (
                      <button
                        type="button"
                        className="test-btn"
                        style={{ marginTop: 6, background: '#2563eb', borderColor: '#3b82f6', color: '#ffffff' }}
                        onClick={() => {
                          updateSetting('aiProvider', 'server');
                          alert('Aktiv AI motor er nu skiftet til Server PC (Central AI)!');
                        }}
                      >
                        <Bot size={14} />
                        <span>Skift aktiv AI til Server PC</span>
                      </button>
                    )}
                  </div>

                  {/* Serverens AI & API Konfiguration */}
                  <div className="settings-section" style={{ marginTop: 24, borderTop: '1px solid var(--border-color, rgba(255,255,255,0.1))', paddingTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <h4 className="settings-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bot size={18} style={{ color: 'var(--primary-accent, #3b82f6)' }} />
                        Serverens AI & API Konfiguration
                      </h4>
                      {serverAIConfig && (
                        <span className="badge" style={{ fontSize: 11, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(59,130,246,0.3)' }}>
                          Aktiv: {serverAIConfig.providers?.[serverAIConfig.activeProvider]?.name || serverAIConfig.activeProvider}
                        </span>
                      )}
                    </div>
                    <p className="settings-section-desc">
                      Bestem hvilke API&apos;er og AI-modeller din Server-PC skal bruge. Klienterne forbinder blot til serveren uden at skulle have egne API-nøgler.
                    </p>

                    {!serverAIConfig ? (
                      <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>
                        Opret forbindelse til serveren ovenfor (klik &quot;Test Serverforbindelse&quot;) for at hente og ændre serverens API-indstillinger direkte herfra.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                        {/* Vælg API Udbyder */}
                        <div className="settings-group">
                          <label>Hvilken AI API skal serveren bruge?</label>
                          <select 
                            value={serverAIConfig.activeProvider || 'ollama'}
                            onChange={(e) => setServerAIConfig(prev => ({ ...prev, activeProvider: e.target.value }))}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: 'var(--bg-input, #1a1a1a)', color: 'inherit', border: '1px solid var(--border-color, #333)' }}
                          >
                            <option value="ollama">🦙 Lokal Ollama (Kører direkte på Server-PC)</option>
                            <option value="gemini">✨ Google Gemini API</option>
                            <option value="openai">🧠 OpenAI (ChatGPT - GPT-4o / Mini)</option>
                            <option value="anthropic">🎭 Anthropic Claude (Claude 3.5 Sonnet)</option>
                            <option value="groq">⚡ Groq (Super hurtig Llama 3.3)</option>
                            <option value="deepseek">🔍 DeepSeek API</option>
                            <option value="custom">🔌 Brugerdefineret API (LM Studio, LocalAI mv.)</option>
                          </select>
                        </div>

                        {/* Felter til den valgte udbyder */}
                        {(() => {
                          const pKey = serverAIConfig.activeProvider || 'ollama';
                          const currentP = serverAIConfig.providers?.[pKey] || {};
                          const updateCurrentP = (fields) => {
                            setServerAIConfig(prev => ({
                              ...prev,
                              providers: {
                                ...prev.providers,
                                [pKey]: { ...(prev.providers?.[pKey] || {}), ...fields }
                              }
                            }));
                          };

                          return (
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                              <strong style={{ fontSize: 13, color: 'var(--text-primary, #fff)' }}>
                                API Indstillinger for {currentP.name || pKey}
                              </strong>

                              {/* API Nøgle for skytjenester */}
                              {pKey !== 'ollama' && (
                                <div className="settings-group">
                                  <label>Serverens API-nøgle ({currentP.name || pKey})</label>
                                  <div style={{ position: 'relative' }}>
                                    <input 
                                      type={showServerKey ? 'text' : 'password'}
                                      value={currentP.apiKey || ''}
                                      onChange={(e) => updateCurrentP({ apiKey: e.target.value })}
                                      placeholder={`Indsæt ${currentP.name || pKey} API-nøgle...`}
                                      style={{ width: '100%', paddingRight: 40 }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowServerKey(!showServerKey)}
                                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
                                    >
                                      {showServerKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                  </div>
                                  <small style={{ color: '#888' }}>Gemmes sikkert på Server-PC i <code>server/config.json</code>.</small>
                                </div>
                              )}

                              {/* Host / Base URL */}
                              {pKey === 'ollama' && (
                                <div className="settings-group">
                                  <label>Ollama Host URL (på Server-PC)</label>
                                  <input 
                                    type="text"
                                    value={currentP.host || 'http://127.0.0.1:11434'}
                                    onChange={(e) => updateCurrentP({ host: e.target.value })}
                                    placeholder="http://127.0.0.1:11434"
                                  />
                                </div>
                              )}

                              {['openai', 'groq', 'deepseek', 'custom'].includes(pKey) && (
                                <div className="settings-group">
                                  <label>API Base URL</label>
                                  <input 
                                    type="text"
                                    value={currentP.baseUrl || ''}
                                    onChange={(e) => updateCurrentP({ baseUrl: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                  />
                                </div>
                              )}

                              {/* Modelnavn */}
                              <div className="settings-group">
                                <label>Modelnavn</label>
                                <input 
                                  type="text"
                                  value={currentP.model || ''}
                                  onChange={(e) => updateCurrentP({ model: e.target.value })}
                                  placeholder="f.eks. llama3, gemini-1.5-flash, gpt-4o-mini, claude-3-5-sonnet-20241022"
                                />
                              </div>

                              {/* Test & Gem knapper */}
                              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                                <button 
                                  type="button"
                                  className="test-btn"
                                  disabled={serverAITestState?.loading}
                                  onClick={handleTestServerAI}
                                >
                                  {serverAITestState?.loading ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                                  <span>Test denne API på Serveren</span>
                                </button>

                                <button 
                                  type="button"
                                  className="test-btn"
                                  style={{ background: '#16a34a', borderColor: '#22c55e', color: '#ffffff' }}
                                  disabled={serverAISaveFeedback?.loading}
                                  onClick={handleSaveServerAIConfig}
                                >
                                  <Check size={14} />
                                  <span>Gem på Server-PC</span>
                                </button>
                              </div>

                              {serverAITestState && (
                                <div className={`test-result ${serverAITestState.success ? 'success' : 'error'}`}>
                                  {serverAITestState.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                  <span>{serverAITestState.message}</span>
                                </div>
                              )}

                              {serverAISaveFeedback && (
                                <div className={`test-result ${serverAISaveFeedback.success ? 'success' : 'error'}`}>
                                  {serverAISaveFeedback.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                  <span>{serverAISaveFeedback.message}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 4: OM & NULSTIL ================= */}
            {activeTab === 'about' && (
              <div className="settings-tab-pane">
                <div className="settings-section">
                  <h4 className="settings-section-title">Om MitEgetWord</h4>
                  <div className="about-card">
                    <div className="about-header">
                      <div className="about-logo">W</div>
                      <div>
                        <h5>MitEgetWord</h5>
                        <span className="about-version">Version 1.0.0</span>
                      </div>
                    </div>
                    <p className="about-desc">
                      Et moderne, lynhurtigt og lokalt tekstbehandlingsprogram med integreret AI-assistent, versionshistorik, tabs og rig formatering.
                    </p>
                    <div className="about-privacy-note">
                      <CheckCircle2 size={14} className="privacy-icon" />
                      <span>Dine dokumenter og AI API-nøgler gemmes lokalt eller på din egen server-pc og deles aldrig med tredjeparter.</span>
                    </div>
                  </div>
                </div>

                {/* Auto-Update Sektion */}
                <div className="settings-section">
                  <h4 className="settings-section-title">Programopdateringer</h4>
                  <p className="settings-section-desc">
                    Hold MitEgetWord opdateret. Programmet kan automatisk hente nye versioner fra din Server-PC eller GitHub.
                  </p>

                  <div className="provider-test-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                      <button 
                        type="button"
                        className="test-btn"
                        disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
                        onClick={handleCheckForUpdates}
                      >
                        {updateState.status === 'checking' || updateState.status === 'downloading' ? (
                          <RefreshCw size={14} className="spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        <span>{updateState.status === 'downloading' ? 'Downloader opdatering...' : 'Søg efter opdateringer'}</span>
                      </button>

                      {updateState.status === 'downloaded' && (
                        <button
                          type="button"
                          className="test-btn"
                          style={{ background: '#16a34a', borderColor: '#22c55e', color: '#ffffff' }}
                          onClick={handleInstallUpdate}
                        >
                          <Check size={14} />
                          <span>Genstart og installer nu</span>
                        </button>
                      )}
                    </div>

                    {updateState.message && (
                      <div className={`test-result ${updateState.status === 'error' ? 'error' : updateState.status === 'downloaded' ? 'success' : 'info'}`} style={{ width: '100%', boxSizing: 'border-box' }}>
                        {updateState.status === 'downloaded' ? (
                          <CheckCircle2 size={14} color="#22c55e" />
                        ) : updateState.status === 'error' ? (
                          <AlertCircle size={14} color="#f87171" />
                        ) : (
                          <Info size={14} color="#38bdf8" />
                        )}
                        <span>{updateState.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="settings-section danger-zone">
                  <h4 className="settings-section-title">Nulstil Indstillinger</h4>
                  <p className="settings-section-desc">
                    Hvis noget driller, kan du nulstille alle gemte brugerindstillinger (tema, AI-konfiguration og server URL) til fabriksindstillingerne.
                  </p>
                  <button className="reset-settings-btn" onClick={handleResetSettings}>
                    <RotateCcw size={14} />
                    <span>Nulstil til Fabriksindstillinger</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="settings-modal-footer">
          <div className="settings-footer-left">
            <span className="settings-shortcuts-tip">Tip: Tryk <code>Esc</code> for at lukke uden at gemme.</span>
          </div>
          <div className="settings-footer-right">
            <button className="settings-btn cancel" onClick={onClose}>
              Annuller
            </button>
            <button className={`settings-btn save ${savedFeedback ? 'saved' : ''}`} onClick={handleSave}>
              {savedFeedback ? (
                <>
                  <Check size={16} />
                  <span>Gemt!</span>
                </>
              ) : (
                <span>Gem & Luk</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
