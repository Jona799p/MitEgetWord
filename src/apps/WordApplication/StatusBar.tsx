import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { CloudCheck, Cloud, CloudOff, RotateCw, Sun, Moon, BarChart2, Maximize2, Minimize2 } from 'lucide-react';
import { ThemeMode } from './LayoutSettings';
import styles from './WordApplication.module.css';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface StatusBarProps {
  editor: Editor;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  saveStatus?: SaveStatus;
  onManualSave?: () => void;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  onOpenStats?: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  editor, 
  zoomLevel, 
  setZoomLevel, 
  saveStatus = 'saved',
  onManualSave,
  themeMode = 'dark',
  onToggleTheme,
  onOpenStats,
  isFocusMode,
  onToggleFocusMode,
}) => {
  // Throttled / debounced statistics to avoid running heavy getText() and regex on every single keystroke
  const [stats, setStats] = useState({ charCount: 0, wordCount: 0, readingTimeMin: 1 });
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!editor) return;

    const calculateStats = () => {
      if (!editor || editor.isDestroyed) return;
      try {
        const text = editor.getText();
        const charCount = text.length;
        let wordCount = 0;
        if (charCount > 0) {
          const matches = text.match(/\S+/g);
          wordCount = matches ? matches.length : 0;
        }
        const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));
        setStats({ charCount, wordCount, readingTimeMin });
      } catch {}
    };

    // Calculate once on load
    calculateStats();

    const handleTransaction = ({ transaction }: any) => {
      // Only recalculate when the document content actually changed (skip cursor moves/selections)
      if (!transaction || !transaction.docChanged) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(calculateStats, 800);
    };

    editor.on('transaction', handleTransaction);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);

  if (!editor) return null;

  const { charCount, wordCount, readingTimeMin } = stats;

  const handleZoomOut = () => {
    setZoomLevel(Math.max(50, zoomLevel - 10));
  };

  const handleZoomIn = () => {
    setZoomLevel(Math.min(200, zoomLevel + 10));
  };

  const renderSaveBadge = () => {
    switch (saveStatus) {
      case 'saved':
        return (
          <div 
            className={`${styles.saveStatusBadge} ${styles.saved}`} 
            title="Alle ændringer er gemt automatisk"
            onClick={onManualSave}
          >
            <CloudCheck size={16} />
          </div>
        );
      case 'saving':
        return (
          <div 
            className={`${styles.saveStatusBadge} ${styles.saving}`} 
            title="Gemmer automatisk..."
          >
            <RotateCw size={14} className={styles.spinIcon} />
          </div>
        );
      case 'unsaved':
        return (
          <div 
            className={`${styles.saveStatusBadge} ${styles.unsaved}`} 
            title="Gemmer automatisk om et øjeblik..."
            onClick={onManualSave}
          >
            <Cloud size={16} />
          </div>
        );
      case 'error':
        return (
          <div 
            className={`${styles.saveStatusBadge} ${styles.saveError}`} 
            title="Kunne ikke gemme på serveren (klik for at prøve igen)"
            onClick={onManualSave}
            style={{ cursor: 'pointer' }}
          >
            <CloudOff size={16} />
          </div>
        );
    }
  };

  return (
    <div className={styles.statusBar}>
      <div className={styles.statusLeft}>
        <button 
          type="button" 
          className={styles.statusStatsBtn}
          onClick={onOpenStats}
          title="Klik for at se detaljeret dokumentstatistik"
        >
          <BarChart2 size={13} className={styles.statusStatsIcon} />
          <span>{wordCount} {wordCount === 1 ? 'ord' : 'ord'}</span>
          <span className={styles.statusDot}>·</span>
          <span>{charCount} tegn</span>
          <span className={styles.statusDot}>·</span>
          <span>~{readingTimeMin} min læsetid</span>
        </button>
      </div>

      <div className={styles.statusCenter}>
        {renderSaveBadge()}
      </div>
      
      <div className={styles.statusRight}>
        {/* Focus Mode Toggle */}
        {onToggleFocusMode && (
          <button 
            type="button"
            onClick={onToggleFocusMode} 
            className={styles.zoomBtn} 
            title={isFocusMode ? 'Afslut fokustilstand (F11 / Esc)' : 'Fuldskærm / Fokustilstand (F11)'}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {isFocusMode ? <Minimize2 size={13} color="#4a90e2" /> : <Maximize2 size={13} />}
          </button>
        )}

        {/* Quick Theme Toggle */}
        <button 
          onClick={onToggleTheme} 
          className={styles.zoomBtn} 
          title={themeMode === 'dark' ? 'Skift til Lyst tema' : 'Skift til Mørkt tema'}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          {themeMode === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <div className={styles.ribbonDivider} style={{ height: 14, margin: '0 4px' }} />

        {/* Zoom Controls */}
        <div className={styles.zoomControl}>
          <button onClick={handleZoomOut} className={styles.zoomBtn} title="Zoom ud">-</button>
          <span className={styles.zoomLabel}>{zoomLevel}%</span>
          <button onClick={handleZoomIn} className={styles.zoomBtn} title="Zoom ind">+</button>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
