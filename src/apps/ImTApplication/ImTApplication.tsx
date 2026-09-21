import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getImTSettings, ImTSettings } from './imtSettingsStore';
import { getImTCanvasText, setImTCanvasText, setImTOpen, clearImTCanvas } from './imtStateStore';
import { getServerUrl } from '../../store/documentStore';
import styles from './ImTApplication.module.css';

export interface ImTApplicationProps {
  panelId?: string;
  onClose?: () => void;
}

interface ProcessedImage {
  id: string;
  name: string;
  previewUrl: string;
  status: 'processing' | 'done' | 'error';
  error?: string;
}

export const ImTApplication: React.FC<ImTApplicationProps> = ({ panelId, onClose }) => {
  const [canvasText, setCanvasText] = useState<string>(() => getImTCanvasText());
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [settings, setSettings] = useState<ImTSettings>(getImTSettings());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLTextAreaElement | null>(null);

  // Marker ImT som åbent ved mount og lukket ved unmount
  useEffect(() => {
    setImTOpen(true);
    return () => {
      setImTOpen(false);
    };
  }, []);

  // Lyt efter opdateringer i ImT indstillinger
  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettings(getImTSettings());
    };
    window.addEventListener('imt:settings-updated', handleSettingsUpdate);
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('imt:settings-updated', handleSettingsUpdate);
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Behandl et billede gennem lokal AI
  const processImage = useCallback(async (fileOrBlob: Blob, filename = 'billede.png') => {
    const imageId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const previewUrl = URL.createObjectURL(fileOrBlob);

    // Tilføj til billedlisten med status 'processing'
    setImages(prev => [
      ...prev,
      {
        id: imageId,
        name: filename,
        previewUrl,
        status: 'processing'
      }
    ]);

    try {
      // Konvertér blob til base64 data URL
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrBlob);
      });

      const currentSettings = getImTSettings();
      const serverUrl = getServerUrl();
      let extractedText = '';

      // Behandl billede via Server Central
      const response = await fetch(`${serverUrl}/api/imt/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          prompt: currentSettings.prompt
        })
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Serveren svarede med en fejl (status ${response.status})`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Uventet fejl under AI-behandling.');
      }

      extractedText = data.text || '';

      // Tilføj den udtrukne tekst helt løst på kanvasset
      setCanvasText(prev => {
        const trimmed = prev.trim();
        const next = !trimmed ? extractedText.trim() : `${trimmed}\n\n${extractedText.trim()}`;
        setImTCanvasText(next);
        return next;
      });

      // Marker billedet som færdigt
      setImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, status: 'done' } : img
      ));

    } catch (err: any) {
      console.error('[ImT] Behandling fejlede:', err);
      setImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, status: 'error', error: err.message } : img
      ));
    }
  }, []);

  // Håndter clipboard paste (Ctrl+V) for screenshots
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            processImage(blob, `Screenshot-${new Date().toLocaleTimeString('da-DK')}.png`);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processImage]);

  // Håndter drag and drop på hele vinduet
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          processImage(file, file.name);
        }
      });
    }
  };

  // Håndter filvælger
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          processImage(file, file.name);
        }
      });
      e.target.value = '';
    }
  };

  // Kopiér alt tekst til udklipsholder
  const handleCopyAll = async () => {
    if (!canvasText) return;
    try {
      await navigator.clipboard.writeText(canvasText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Kopiering fejlede:', err);
    }
  };

  // Ryd kanvas
  const handleClearCanvas = () => {
    if (!canvasText && images.length === 0) return;
    setCanvasText('');
    clearImTCanvas();
    setImages([]);
  };

  // Status og statistik
  const isProcessing = images.some(img => img.status === 'processing');
  const wordCount = canvasText.trim() ? canvasText.trim().split(/\s+/).length : 0;
  const charCount = canvasText.length;

  return (
    <div 
      className={`${styles.container} ${isDragging ? styles.containerDragging : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.leftGroup}>
          <div className={styles.brand}>
            <svg className={styles.brandIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
              <path d="M7 8h10"></path>
              <path d="M12 8v8"></path>
              <path d="M9 16h6"></path>
            </svg>
            <span>ImT</span>
          </div>

          <div className={styles.modelBadge} title={`Aktiv lokal AI: ${settings.apiUrl}`}>
            <span className={styles.liveDot}></span>
            <span>{settings.model || 'qwen2.5vl:3b'}</span>
          </div>

          {isProcessing && (
            <div className={styles.processingBadge}>
              <span className={styles.spinDot}></span>
              <span>Behandler billede...</span>
            </div>
          )}
        </div>

        <div className={styles.rightGroup}>
          {/* Vælg billede(r) knap rykket op ved siden af Kopiér */}
          <label className={styles.fileInputLabel} title="Vælg billede(r) fra din computer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Vælg billede</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </label>

          <button 
            type="button" 
            className={styles.actionButton}
            onClick={handleCopyAll}
            disabled={!canvasText}
            title="Kopiér alt tekst på kanvasset"
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span style={{ color: '#34d399' }}>Kopieret!</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Kopiér</span>
              </>
            )}
          </button>

          <button 
            type="button" 
            className={`${styles.actionButton} ${styles.dangerBtn}`}
            onClick={handleClearCanvas}
            disabled={!canvasText && images.length === 0}
            title="Ryd kanvas og billeder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Ryd</span>
          </button>
        </div>
      </div>

      {/* Simpelt Kanvas (Helt Løst og Åbent) */}
      <div className={styles.canvasArea}>
        <div className={styles.canvasWrapper}>
          <textarea
            ref={canvasRef}
            className={styles.simpleCanvas}
            value={canvasText}
            onChange={(e) => {
              const val = e.target.value;
              setCanvasText(val);
              setImTCanvasText(val);
            }}
            placeholder="Her dukker teksten op helt løst. Klik 'Vælg billede', træk billeder hertil eller tryk Ctrl+V for screenshot..."
            spellCheck={false}
          />
        </div>

        {/* Bund statusbjælke */}
        <div className={styles.bottomStatusBar}>
          <div className={styles.statusStats}>
            <span>{wordCount} ord</span>
            <span>•</span>
            <span>{charCount} tegn</span>
            {images.length > 0 && (
              <>
                <span>•</span>
                <span>{images.length} {images.length === 1 ? 'billede' : 'billeder'} tilføjet</span>
              </>
            )}
            {isProcessing && (
              <>
                <span>•</span>
                <span style={{ color: 'var(--primary-accent, #2b579a)', fontWeight: 600 }}>Behandler...</span>
              </>
            )}
          </div>
          <div>Simpelt Kanvas</div>
        </div>
      </div>
    </div>
  );
};

export default ImTApplication;
