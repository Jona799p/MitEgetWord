import React, { useEffect, useRef } from 'react';
import { SpellCheck, Check, EyeOff, CheckCheck, Plus } from 'lucide-react';
import styles from './SpellCheckContextMenu.module.css';

export interface SpellCheckMenuData {
  x: number;
  y: number;
  errorId: string;
  originalText: string;
  replacements: string[];
  message: string;
}

interface SpellCheckContextMenuProps {
  data: SpellCheckMenuData;
  onSelectReplacement: (errorId: string, replacement: string, originalText?: string) => void;
  onIgnore: (errorId: string, originalText?: string) => void;
  onIgnoreAll: () => void;
  onAddToDictionary?: (word: string) => void;
  onClose: () => void;
}

export const SpellCheckContextMenu: React.FC<SpellCheckContextMenuProps> = ({
  data,
  onSelectReplacement,
  onIgnore,
  onIgnoreAll,
  onAddToDictionary,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Viewport boundary clamping
  const menuWidth = 240;
  const menuEstimatedHeight = 220;
  const posX = Math.min(Math.max(10, data.x), window.innerWidth - menuWidth - 15);
  const posY = Math.min(Math.max(10, data.y), window.innerHeight - menuEstimatedHeight - 15);

  return (
    <>
      <div 
        className={styles.contextMenuBackdrop} 
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div 
        ref={menuRef}
        className={styles.menuContainer}
        style={{ left: `${posX}px`, top: `${posY}px` }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className={styles.menuHeader}>
          <div className={styles.headerTop}>
            <SpellCheck size={14} className={styles.headerIcon} />
            <span className={styles.headerTitle}>{data.originalText}</span>
          </div>
          {data.message && (
            <span className={styles.headerMessage}>{data.message}</span>
          )}
        </div>

        <div className={styles.divider} />

        {/* Replacements / Suggestions */}
        <div className={styles.suggestionsSection}>
          <div className={styles.sectionLabel}>Forslag</div>
          {data.replacements && data.replacements.length > 0 ? (
            data.replacements.map((rep, idx) => (
              <button
                key={`${rep}-${idx}`}
                type="button"
                className={styles.replacementItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectReplacement(data.errorId, rep, data.originalText);
                  onClose();
                }}
              >
                <Check size={14} className={styles.replacementIcon} />
                <span className={styles.replacementText}>{rep}</span>
              </button>
            ))
          ) : (
            <div className={styles.noReplacements}>Ingen forslag tilgængelige</div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Actions (Ignore, Ignore All) */}
        <div className={styles.actionsSection}>
          {onAddToDictionary && (
            <button
              type="button"
              className={styles.actionItem}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onAddToDictionary(data.originalText);
                onClose();
              }}
            >
              <Plus size={14} />
              <span>Tilføj "{data.originalText}" til ordbog</span>
            </button>
          )}
          <button
            type="button"
            className={styles.actionItem}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onIgnore(data.errorId, data.originalText);
              onClose();
            }}
          >
            <EyeOff size={14} />
            <span>Ignorer fejl</span>
          </button>
          <button
            type="button"
            className={styles.actionItem}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onIgnoreAll();
              onClose();
            }}
          >
            <CheckCheck size={14} />
            <span>Ignorer alle stavefejl</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default SpellCheckContextMenu;
