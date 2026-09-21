import React, { useState, useEffect } from 'react';
import { getImTSettings, saveImTSettings, DEFAULT_IMT_SETTINGS, ImTSettings } from './imtSettingsStore';
import { getServerUrl } from '../../store/documentStore';
import styles from './ImTApplication.module.css';

interface ImTSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImTSettingsModal: React.FC<ImTSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<ImTSettings>(getImTSettings());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(getImTSettings());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveImTSettings(settings);
    onClose();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const serverUrl = getServerUrl().replace(/\/+$/, '');
      const res = await fetch(`${serverUrl}/api/imt/status`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();

      if (res.ok && data.status === 'ok') {
        setTestResult({
          success: true,
          message: `Forbindelse til ImT Billed-AI er OK via Server Central! (Aktiv server-model: ${data.configuredModel || 'Vision AI'})`
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || 'Serveren svarede, men ImT backend er ikke klar.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Kunne ikke kontakte Server Central (${getServerUrl()}): ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            ImT - Billed-AI Indstillinger
          </div>
          <button className={styles.iconButton} onClick={onClose} title="Luk indstillinger">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Central Billed-AI (Vision)</label>
            <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 8, fontSize: 13, lineHeight: 1.5, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: 6 }}>
                <strong>Server Central:</strong> <code style={{ color: '#38bdf8' }}>{getServerUrl()}</code>
              </div>
              <div style={{ color: 'var(--text-secondary, #aaaaaa)', fontSize: 12 }}>
                Billeder behandles automatisk af Server Central. Du behøver ikke indtaste API-nøgler eller lokale adresser på denne computer.
              </div>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.fieldLabel}>Ekstraktionsprompt (Instruks til AI)</label>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setSettings({ ...settings, prompt: DEFAULT_IMT_SETTINGS.prompt })}
              >
                Nulstil prompt
              </button>
            </div>
            <textarea
              className={styles.textAreaInput}
              rows={3}
              value={settings.prompt}
              onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
              placeholder="Instruks til hvordan billedteksten skal udtrækkes..."
            />
            <span className={styles.fieldHint}>
              Denne instruks sendes til serverens vision-model sammen med billedet.
            </span>
          </div>

          {/* Test Forbindelse */}
          <div className={styles.testSection}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? 'Tester forbindelse...' : 'Test Forbindelse til Billed-AI'}
            </button>

            {testResult && (
              <div className={`${styles.testFeedback} ${testResult.success ? styles.testSuccess : styles.testError}`}>
                <div style={{ fontWeight: 600 }}>{testResult.message}</div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Annuller
          </button>
          <button type="button" className={styles.primaryButton} onClick={handleSave}>
            Gem Indstillinger
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImTSettingsModal;
