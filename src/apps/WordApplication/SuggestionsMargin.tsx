import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Check, X, Lightbulb, MessageSquare, SpellCheck, Sparkles } from 'lucide-react';
import styles from './SuggestionsMargin.module.css';

export interface SuggestionItem {
  id: string;
  originalText: string;
  suggestedText: string;
  comment: string;
  createdAt: string;
  author?: string;
  type?: 'replacement' | 'deletion' | 'addition';
}

interface SuggestionsMarginProps {
  suggestions: SuggestionItem[];
  activeSuggestionId?: string | null;
  canvasRef: React.RefObject<HTMLDivElement>;
  zoomLevel?: number;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSelect: (id: string) => void;
}

export const SuggestionsMargin: React.FC<SuggestionsMarginProps> = ({
  suggestions,
  activeSuggestionId,
  canvasRef,
  zoomLevel = 100,
  onAccept,
  onReject,
  onSelect,
}) => {
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const calculatePositions = useCallback(() => {
    if (!canvasRef.current || !suggestions || suggestions.length === 0) return;

    const canvasEl = canvasRef.current;
    const canvasRect = canvasEl.getBoundingClientRect();
    const zoom = (zoomLevel || 100) / 100;

    // 1. Calculate desired top for each suggestion
    const items = suggestions.map(sug => {
      const spanEl = canvasEl.querySelector(`[data-suggestion-id="${sug.id}"]`) as HTMLElement | null;
      let desiredTop = 40;
      if (spanEl) {
        const spanRect = spanEl.getBoundingClientRect();
        desiredTop = (spanRect.top - canvasRect.top) / zoom;
      }
      return {
        id: sug.id,
        desiredTop: Math.max(20, desiredTop - 8),
      };
    });

    // 2. Sort by desiredTop
    items.sort((a, b) => a.desiredTop - b.desiredTop);

    // 3. Collision avoidance
    const newPositions: Record<string, number> = {};
    let lastBottom = 0;

    items.forEach(item => {
      const cardEl = cardRefs.current[item.id];
      const cardHeight = cardEl ? cardEl.offsetHeight : 170;
      const actualTop = Math.max(item.desiredTop, lastBottom + 12);
      newPositions[item.id] = actualTop;
      lastBottom = actualTop + cardHeight;
    });

    setPositions(newPositions);
    setContainerHeight(lastBottom + 80);
  }, [suggestions, canvasRef, zoomLevel]);

  // Recalculate on suggestions change or zoom
  useEffect(() => {
    calculatePositions();
    const timer = setTimeout(calculatePositions, 50);
    const timer2 = setTimeout(calculatePositions, 200);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [calculatePositions]);

  // Recalculate on window resize
  useEffect(() => {
    window.addEventListener('resize', calculatePositions);
    return () => window.removeEventListener('resize', calculatePositions);
  }, [calculatePositions]);

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const formatTimestamp = (dateStr: string) => {
    if (!dateStr) return 'Lige nu';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Lige nu';
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Lige nu';
      if (diffMin < 60) return `${diffMin} min siden`;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Lige nu';
    }
  };

  const handleMouseEnter = (id: string) => {
    const el = document.querySelector(`[data-suggestion-id="${id}"]`);
    if (el) {
      el.classList.add('document-suggestion-hover');
    }
  };

  const handleMouseLeave = (id: string) => {
    const el = document.querySelector(`[data-suggestion-id="${id}"]`);
    if (el) {
      el.classList.remove('document-suggestion-hover');
    }
  };

  return (
    <aside
      className={styles.marginContainer}
      data-suggestion-ui="true"
      aria-label="Dokumentforslag"
      style={{
        minHeight: containerHeight ? `${containerHeight}px` : undefined,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {suggestions.map((sug) => {
        const hasChange = sug.suggestedText && sug.suggestedText.trim() !== sug.originalText.trim();
        const isActive = activeSuggestionId === sug.id;
        const topPos = positions[sug.id] ?? 40;

        return (
          <div
            key={sug.id}
            ref={el => { cardRefs.current[sug.id] = el; }}
            className={`${styles.suggestionCard} ${isActive ? styles.active : ''}`}
            style={{
              position: 'absolute',
              top: `${topPos}px`,
              left: 0,
              width: '340px',
            }}
            onClick={() => onSelect(sug.id)}
            onMouseEnter={() => handleMouseEnter(sug.id)}
            onMouseLeave={() => handleMouseLeave(sug.id)}
          >
            {/* Header */}
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleGroup}>
                {sug.author === 'LanguageTool' ? (
                  <SpellCheck size={14} className={styles.headerIcon} style={{ color: '#38bdf8' }} />
                ) : sug.author === 'AI Assistent' ? (
                  <Sparkles size={14} className={styles.headerIcon} style={{ color: '#a78bfa' }} />
                ) : (
                  <Lightbulb size={14} className={styles.headerIcon} />
                )}
                <span className={styles.headerTitle}>
                  {sug.author || 'Forslag'}
                </span>
              </div>
              <span className={styles.timestamp}>{formatTimestamp(sug.createdAt)}</span>
            </div>

            {/* Before / After Difference or Quote */}
            {sug.type === 'deletion' ? (
              <div className={styles.diffContainer}>
                <div className={styles.diffOriginal}>
                  <span className={styles.diffLabel} style={{ color: '#ef4444' }}>Sletning</span>
                  <del>{sug.originalText}</del>
                </div>
              </div>
            ) : sug.type === 'addition' ? (
              <div className={styles.diffContainer}>
                <div className={styles.diffSuggested}>
                  <span className={styles.diffLabel} style={{ color: '#22c55e' }}>Tilføjelse</span>
                  <ins>{sug.suggestedText}</ins>
                </div>
              </div>
            ) : hasChange ? (
              <div className={styles.diffContainer}>
                {sug.originalText && (
                  <div className={styles.diffOriginal}>
                    <span className={styles.diffLabel}>Før</span>
                    <del>{sug.originalText}</del>
                  </div>
                )}
                {sug.suggestedText && (
                  <div className={styles.diffSuggested}>
                    <span className={styles.diffLabel}>Ny</span>
                    <ins>{sug.suggestedText}</ins>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.quoteBox}>
                "{sug.originalText}"
              </div>
            )}

            {/* Comment if provided */}
            {sug.comment && (
              <div className={styles.commentBox}>
                <MessageSquare size={15} className={styles.commentIcon} />
                <span className={styles.commentText}>{sug.comment}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
              <button
                type="button"
                className={styles.acceptBtn}
                onClick={() => onAccept(sug.id)}
                title="Godkend forslag og opdater dokumentet"
              >
                <Check size={15} />
                <span>Godkend</span>
              </button>
              <button
                type="button"
                className={styles.rejectBtn}
                onClick={() => onReject(sug.id)}
                title="Afvis forslag og behold den oprindelige tekst"
              >
                <X size={15} />
                <span>Afvis</span>
              </button>
            </div>
          </div>
        );
      })}
    </aside>
  );
};

export default SuggestionsMargin;
