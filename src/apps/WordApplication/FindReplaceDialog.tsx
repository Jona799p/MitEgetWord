import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Replace, 
  CheckCheck, 
  CaseSensitive as CaseSensitiveIcon,
  ChevronRight
} from 'lucide-react';
import styles from './WordApplication.module.css';

interface FindReplaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
}

export const FindReplaceDialog: React.FC<FindReplaceDialogProps> = ({
  isOpen,
  onClose,
  editor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isReplaceExpanded, setIsReplaceExpanded] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Storage data from extension
  const storage = (editor?.storage as any)?.searchAndReplace;
  const matchCount = storage?.results?.length || 0;
  const currentIndex = (storage?.currentIndex ?? -1) + 1;

  // Sync initial selection or focus when opened
  useEffect(() => {
    if (isOpen && editor) {
      const { from, to } = editor.state.selection;
      if (!editor.state.selection.empty && to - from < 100) {
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        if (selectedText && selectedText.trim() !== '') {
          setSearchTerm(selectedText);
          editor.commands.setSearchTerm(selectedText);
        }
      }
      setTimeout(() => {
        searchInputRef.current?.select();
        searchInputRef.current?.focus();
      }, 50);
    } else if (!isOpen && editor) {
      editor.commands.clearSearch();
    }
  }, [isOpen, editor]);

  // Handle Search Input Change
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (editor) {
      editor.commands.setSearchTerm(val);
    }
  };

  // Handle Replace Input Change
  const handleReplaceChange = (val: string) => {
    setReplaceTerm(val);
    if (editor) {
      editor.commands.setReplaceTerm(val);
    }
  };

  // Toggle Case Sensitivity
  const handleToggleCase = () => {
    const nextCase = !caseSensitive;
    setCaseSensitive(nextCase);
    if (editor) {
      editor.commands.setCaseSensitive(nextCase);
    }
  };

  // Navigation
  const handleFindNext = () => {
    editor?.commands.findNext();
  };

  const handleFindPrev = () => {
    editor?.commands.findPrevious();
  };

  // Replace
  const handleReplaceOne = () => {
    editor?.commands.replaceCurrent();
  };

  const handleReplaceAll = () => {
    editor?.commands.replaceAll();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleFindPrev();
      } else {
        handleFindNext();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.findReplaceCard} onKeyDown={handleKeyDown}>
      {/* Header Bar */}
      <div className={styles.findReplaceHeader}>
        <div className={styles.findReplaceTitle}>
          <Search size={14} color="#4a90e2" />
          <span>Find og erstat</span>
        </div>
        <div className={styles.findReplaceActions}>
          <button 
            type="button"
            className={`${styles.iconBtnSmall} ${caseSensitive ? styles.activeOptionBtn : ''}`}
            onClick={handleToggleCase}
            title={caseSensitive ? 'Forskel på store/små bogstaver: Til' : 'Forskel på store/små bogstaver: Fra'}
          >
            <CaseSensitiveIcon size={14} />
          </button>
          <button 
            type="button"
            className={styles.iconBtnSmall}
            onClick={() => setIsReplaceExpanded(prev => !prev)}
            title={isReplaceExpanded ? 'Skjul erstat-felt' : 'Vis erstat-felt'}
          >
            <Replace size={14} color={isReplaceExpanded ? '#4a90e2' : undefined} />
          </button>
          <button 
            type="button"
            className={styles.iconBtnSmall}
            onClick={onClose}
            title="Luk (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search Input Row */}
      <div className={styles.findInputRow}>
        <div className={styles.inputWrapper}>
          <input
            ref={searchInputRef}
            type="text"
            className={styles.findInput}
            placeholder="Find i dokumentet..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchTerm && (
            <span className={styles.matchBadge}>
              {matchCount > 0 ? `${currentIndex} af ${matchCount}` : 'Ingen'}
            </span>
          )}
        </div>

        <button
          type="button"
          className={styles.navBtn}
          onClick={handleFindPrev}
          disabled={matchCount === 0}
          title="Find forrige (Shift + Enter)"
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={handleFindNext}
          disabled={matchCount === 0}
          title="Find næste (Enter)"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Replace Row (Expandable) */}
      {isReplaceExpanded && (
        <div className={styles.replaceSection}>
          <div className={styles.replaceInputRow}>
            <input
              type="text"
              className={styles.findInput}
              placeholder="Erstat med..."
              value={replaceTerm}
              onChange={(e) => handleReplaceChange(e.target.value)}
            />
          </div>
          <div className={styles.replaceBtnRow}>
            <button
              type="button"
              className={styles.actionBtnSecondary}
              onClick={handleReplaceOne}
              disabled={matchCount === 0}
              title="Erstat aktuelt fundne ord"
            >
              <Replace size={13} />
              <span>Erstat</span>
            </button>
            <button
              type="button"
              className={styles.actionBtnPrimary}
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              title="Erstat alle forekomster i dokumentet"
            >
              <CheckCheck size={13} />
              <span>Erstat alle ({matchCount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindReplaceDialog;
