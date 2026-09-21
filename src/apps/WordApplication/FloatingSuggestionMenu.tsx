import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { MessageSquarePlus, Lightbulb, Send, X } from 'lucide-react';
import styles from './FloatingSuggestionMenu.module.css';

export interface SuggestionSubmitData {
  originalText: string;
  suggestedText: string;
  comment: string;
  range: { from: number; to: number };
}

interface FloatingSuggestionMenuProps {
  editor: Editor | null;
  canvasRef?: React.RefObject<HTMLDivElement>;
  onSubmitSuggestion: (data: SuggestionSubmitData) => void;
  onClose?: () => void;
}

export const FloatingSuggestionMenu: React.FC<FloatingSuggestionMenuProps> = ({
  editor,
  canvasRef,
  onSubmitSuggestion,
  onClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [suggestedText, setSuggestedText] = useState('');
  const [comment, setComment] = useState('');
  const [currentRange, setCurrentRange] = useState<{ from: number; to: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Update selection position and active range
  const updatePosition = useCallback(() => {
    if (!editor || !editor.view) {
      if (!isExpanded) setIsOpen(false);
      return;
    }

    const { state } = editor;
    const { from, to, empty } = state.selection;

    if (empty || from === to) {
      // Don't close if currently editing the expanded form
      if (!isExpanded) {
        setIsOpen(false);
      }
      return;
    }

    const text = state.doc.textBetween(from, to, ' ', ' ');
    if (!text || text.trim().length === 0) {
      if (!isExpanded) setIsOpen(false);
      return;
    }

    // Only update range and prefilled text if not currently in the middle of editing the form
    if (!isExpanded) {
      setSelectedText(text);
      setSuggestedText(text);
      setCurrentRange({ from, to });
    }

    // Measure viewport position of selection and place out on the right side
    try {
      const startCoords = editor.view.coordsAtPos(from);
      const canvasEl = canvasRef?.current;
      const canvasRect = canvasEl?.getBoundingClientRect();
      const editorDom = editor.view.dom as HTMLElement;
      const editorRect = editorDom.getBoundingClientRect();

      // Vertically align directly level with the selection
      const top = Math.max(16, Math.min(window.innerHeight - (isExpanded ? 340 : 45), startCoords.top - 4));

      // Horizontally place in the right margin ("ude foran")
      const targetRight = canvasRect ? canvasRect.right : editorRect.right;
      let left: number;

      if (isExpanded) {
        const formWidth = 340;
        left = Math.max(16, Math.min(window.innerWidth - formWidth - 16, targetRight + 12));
      } else {
        left = Math.max(16, Math.min(window.innerWidth - 44, targetRight + 12));
      }

      setPosition({ top, left });
      setIsOpen(true);
    } catch {
      // Fallback with window selection
      const domSel = window.getSelection();
      if (domSel && domSel.rangeCount > 0 && !domSel.isCollapsed) {
        const rect = domSel.getRangeAt(0).getBoundingClientRect();
        const top = Math.max(16, Math.min(window.innerHeight - (isExpanded ? 340 : 45), rect.top - 4));
        const formWidth = isExpanded ? 340 : 36;
        const left = Math.max(16, Math.min(window.innerWidth - formWidth - 16, rect.right + 12));
        setPosition({ top, left });
        setIsOpen(true);
      }
    }
  }, [editor, isExpanded]);

  // Listen to editor selection updates
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      if (!isExpanded) {
        updatePosition();
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [editor, isExpanded, updatePosition]);

  // Focus input when expanding
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isExpanded]);

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsExpanded(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setIsOpen(false);
    setComment('');
    onClose?.();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRange || !selectedText) return;

    onSubmitSuggestion({
      originalText: selectedText,
      suggestedText: suggestedText.trim(),
      comment: comment.trim(),
      range: currentRange,
    });

    handleClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !position) return null;

  return (
    <div
      ref={containerRef}
      className={styles.floatingContainer}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      data-suggestion-ui="true"
      onMouseDown={e => e.stopPropagation()}
    >
      {!isExpanded ? (
        <button
          type="button"
          className={styles.triggerIconBtn}
          onClick={handleExpand}
          title="Foreslå ændring"
          aria-label="Foreslå ændring"
        >
          <MessageSquarePlus size={16} />
        </button>
      ) : (
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderTitle}>
              <Lightbulb size={15} className={styles.cardHeaderIcon} />
              <span>Foreslå ændring</span>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={handleClose}
              title="Luk"
            >
              <X size={14} />
            </button>
          </div>

          <div className={styles.originalPreview} title={selectedText}>
            "{selectedText}"
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Foreslået ny tekst</label>
            <textarea
              ref={inputRef}
              className={styles.textArea}
              rows={2}
              value={suggestedText}
              onChange={e => setSuggestedText(e.target.value)}
              placeholder="Skriv hvad teksten skal ændres til..."
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Kommentar / begrundelse (valgfri)</label>
            <input
              type="text"
              className={styles.textInput}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Hvorfor foreslås denne ændring?..."
            />
          </div>

          <div className={styles.cardActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleClose}
            >
              Annuller
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={suggestedText.trim() === selectedText.trim() && comment.trim() === ''}
            >
              <Send size={13} />
              <span>Opret forslag</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default FloatingSuggestionMenu;
