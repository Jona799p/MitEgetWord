import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  PanelRightClose, 
  MessageSquare, 
  SpellCheck, 
  Navigation, 
  CheckCheck,
  CheckCircle2
} from 'lucide-react';
import styles from './SuggestionsMargin.module.css';

export interface SuggestionItem {
  id: string;
  originalText: string;
  suggestedText: string;
  comment: string;
  createdAt: string;
  author?: string;
  type?: 'replacement' | 'deletion' | 'addition';
  from?: number;
  to?: number;
}

interface SuggestionsMarginProps {
  suggestions: SuggestionItem[];
  activeSuggestionId?: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSelect: (id: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export const SuggestionsMargin: React.FC<SuggestionsMarginProps> = ({
  suggestions,
  activeSuggestionId,
  isOpen,
  onToggle,
  onAccept,
  onReject,
  onSelect,
  onAcceptAll,
  onRejectAll,
}) => {
  // Find current index based on activeSuggestionId
  const activeIndex = suggestions.findIndex(s => s.id === activeSuggestionId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const currentSug = suggestions[currentIndex];

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelect(suggestions[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < suggestions.length - 1) {
      onSelect(suggestions[currentIndex + 1].id);
    }
  };

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

  // If sidebar is closed, render the floating open button on the right edge
  if (!isOpen) {
    return (
      <button
        className={styles.openSidebarBtn}
        onClick={onToggle}
        title="Åbn forslag til ændringer (Alt + W)"
        aria-label="Åbn forslag"
      >
        <Sparkles size={15} className={styles.openSidebarIcon} />
        <span className={styles.openSidebarLabel}>Forslag</span>
        {suggestions.length > 0 && (
          <span className={styles.openCountBadge}>{suggestions.length}</span>
        )}
        <kbd className={styles.kbd}>Alt + W</kbd>
      </button>
    );
  }

  return (
    <aside className={styles.sidebarContainer} data-suggestion-ui="true">
      {/* Header with Title, Stepper Navigation and Close Button */}
      <div className={styles.sidebarHeader}>
        <div className={styles.headerTitleGroup}>
          <Sparkles size={16} className={styles.headerIcon} />
          <h3 className={styles.headerTitle}>Forslag</h3>
        </div>

        {suggestions.length > 0 && (
          <div className={styles.stepperGroup}>
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={handlePrev}
              disabled={currentIndex === 0}
              title="Forrige forslag (←)"
              aria-label="Forrige forslag"
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.counterBadge}>
              {currentIndex + 1} af {suggestions.length}
            </span>
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={handleNext}
              disabled={currentIndex === suggestions.length - 1}
              title="Næste forslag (→)"
              aria-label="Næste forslag"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <button
          type="button"
          className={styles.closeSidebarBtn}
          onClick={onToggle}
          title="Luk forslagspanel (Alt + W)"
          aria-label="Luk forslagspanel"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      {/* Main Body */}
      <div className={styles.sidebarBody}>
        {suggestions.length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircle2 size={36} className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>Ingen ventende forslag</div>
            <div className={styles.emptyText}>
              Du har gennemgået alle forslag. Få AI-assistenten til at gennemgå eller forbedre din tekst, eller tryk <kbd className={styles.kbd}>Alt + W</kbd> for at lukke panelet.
            </div>
          </div>
        ) : (
          <>
            {/* Primary Review Card ("Tage dem en ad gangen") */}
            {currentSug && (
              <div 
                className={styles.activeCard}
                onClick={() => onSelect(currentSug.id)}
              >
                <div className={styles.activeCardMeta}>
                  <div className={styles.authorGroup}>
                    {currentSug.author === 'LanguageTool' ? (
                      <SpellCheck size={14} className={styles.authorIcon} style={{ color: '#38bdf8' }} />
                    ) : (
                      <Sparkles size={14} className={styles.authorIcon} />
                    )}
                    <span className={styles.authorName}>
                      {currentSug.author || 'AI Assistent'}
                    </span>
                  </div>

                  <span className={`${styles.typeBadge} ${
                    currentSug.type === 'deletion'
                      ? styles.typeDeletion
                      : currentSug.type === 'addition'
                      ? styles.typeAddition
                      : styles.typeReplacement
                  }`}>
                    {currentSug.type === 'deletion'
                      ? 'Sletning'
                      : currentSug.type === 'addition'
                      ? 'Tilføjelse'
                      : 'Erstatning'}
                  </span>
                </div>

                {/* Diff Comparison Block */}
                {currentSug.type === 'deletion' ? (
                  <div className={styles.diffContainer}>
                    <div className={styles.diffOriginal}>
                      <span className={styles.diffLabel}>Sletning</span>
                      <del>{currentSug.originalText}</del>
                    </div>
                  </div>
                ) : currentSug.type === 'addition' ? (
                  <div className={styles.diffContainer}>
                    <div className={styles.diffSuggested}>
                      <span className={styles.diffLabel}>Tilføjelse</span>
                      <ins>{currentSug.suggestedText}</ins>
                    </div>
                  </div>
                ) : (
                  <div className={styles.diffContainer}>
                    {currentSug.originalText && (
                      <div className={styles.diffOriginal}>
                        <span className={styles.diffLabel}>Før</span>
                        <del>{currentSug.originalText}</del>
                      </div>
                    )}
                    {currentSug.suggestedText && (
                      <div className={styles.diffSuggested}>
                        <span className={styles.diffLabel}>Ny</span>
                        <ins>{currentSug.suggestedText}</ins>
                      </div>
                    )}
                  </div>
                )}

                {/* Optional Comment / Explanation */}
                {currentSug.comment && (
                  <div className={styles.commentBox}>
                    <MessageSquare size={13} className={styles.commentIcon} />
                    <span>{currentSug.comment}</span>
                  </div>
                )}

                {/* Reference jump button */}
                <button
                  type="button"
                  className={styles.referenceBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(currentSug.id);
                  }}
                  title="Vis og fremhæv denne tekst i dokumentet"
                >
                  <Navigation size={12} className={styles.referenceBtnIcon} />
                  <span>Henvis til tekst i dokument</span>
                </button>

                {/* Actions: Godkend, Afvis, Spring over */}
                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.acceptBtn}
                    onClick={() => onAccept(currentSug.id)}
                    title="Godkend ændring og opdater dokumentet"
                  >
                    <Check size={14} />
                    <span>Godkend</span>
                  </button>

                  <button
                    type="button"
                    className={styles.rejectBtn}
                    onClick={() => onReject(currentSug.id)}
                    title="Afvis forslag og behold original tekst"
                  >
                    <X size={14} />
                    <span>Afvis</span>
                  </button>

                  {suggestions.length > 1 && (
                    <button
                      type="button"
                      className={styles.skipBtn}
                      onClick={handleNext}
                      title="Spring over og gå til næste"
                    >
                      <span>Spring over</span>
                      <ChevronRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Overview List of All Suggestions */}
            {suggestions.length > 1 && (
              <div className={styles.overviewSection}>
                <div className={styles.overviewHeader}>
                  <span className={styles.overviewTitle}>
                    Alle forslag ({suggestions.length})
                  </span>
                </div>
                <div className={styles.overviewList}>
                  {suggestions.map((sug, idx) => {
                    const isSelected = sug.id === (currentSug?.id || activeSuggestionId);
                    const snippet = sug.suggestedText || sug.originalText;
                    return (
                      <div
                        key={sug.id}
                        className={`${styles.miniCard} ${isSelected ? styles.active : ''}`}
                        onClick={() => onSelect(sug.id)}
                        title={`Forslag ${idx + 1}: Klik for at gå til tekst`}
                      >
                        <span className={styles.miniCardIndex}>#{idx + 1}</span>
                        <span className={styles.miniCardPreview}>
                          {sug.originalText && sug.suggestedText 
                            ? `${sug.originalText} → ${sug.suggestedText}`
                            : snippet}
                        </span>
                        <span className={`${styles.miniCardType} ${
                          sug.type === 'deletion'
                            ? styles.typeDeletion
                            : sug.type === 'addition'
                            ? styles.typeAddition
                            : styles.typeReplacement
                        }`}>
                          {sug.type === 'deletion' ? 'Slet' : sug.type === 'addition' ? 'Tilføj' : 'Skift'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Actions at bottom if multiple suggestions exist */}
      {suggestions.length > 1 && (
        <div className={styles.bulkActionsFooter}>
          {onAcceptAll && (
            <button
              type="button"
              className={styles.acceptAllBtn}
              onClick={onAcceptAll}
              title="Godkend alle forslag på én gang"
            >
              <CheckCheck size={14} />
              <span>Godkend alle ({suggestions.length})</span>
            </button>
          )}
          {onRejectAll && (
            <button
              type="button"
              className={styles.rejectAllBtn}
              onClick={onRejectAll}
              title="Afvis alle forslag"
            >
              <X size={14} />
              <span>Afvis alle</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};

export default SuggestionsMargin;
