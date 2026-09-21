import React from 'react';
import { Editor } from '@tiptap/react';
import { 
  BarChart2, 
  X, 
  FileText, 
  AlignLeft, 
  Clock, 
  Mic, 
  Layers, 
  CheckSquare 
} from 'lucide-react';
import styles from './WordApplication.module.css';

interface DocumentStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
}

export const DocumentStatsModal: React.FC<DocumentStatsModalProps> = ({
  isOpen,
  onClose,
  editor,
}) => {
  if (!isOpen || !editor) return null;

  const fullText = editor.getText();
  
  // Selection
  const { from, to } = editor.state.selection;
  const hasSelection = !editor.state.selection.empty;
  const selectedText = hasSelection ? editor.state.doc.textBetween(from, to, ' ') : '';

  // Helpers
  const countWords = (str: string) => {
    const trimmed = str.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

  const countCharsWithoutSpaces = (str: string) => {
    return str.replace(/\s/g, '').length;
  };

  const countParagraphs = (editorInstance: Editor) => {
    let pCount = 0;
    editorInstance.state.doc.descendants((node) => {
      if (node.type.name === 'paragraph' || node.type.name.startsWith('heading')) {
        pCount++;
      }
    });
    return Math.max(1, pCount);
  };

  const countSentences = (str: string) => {
    const trimmed = str.trim();
    if (!trimmed) return 0;
    const matches = trimmed.match(/[^.!?]+[.!?]+(\s|$)/g);
    return matches ? matches.length : (trimmed ? 1 : 0);
  };

  // Full document counts
  const totalWords = countWords(fullText);
  const totalCharsWithSpaces = fullText.length;
  const totalCharsWithoutSpaces = countCharsWithoutSpaces(fullText);
  const totalParagraphs = countParagraphs(editor);
  const totalSentences = countSentences(fullText);

  // Estimates
  const readingTimeMin = Math.ceil(totalWords / 200);
  const speakingTimeMin = Math.ceil(totalWords / 130);
  const estimatedPages = Math.max(1, Math.ceil(totalWords / 350));

  // Selection counts
  const selWords = hasSelection ? countWords(selectedText) : 0;
  const selCharsWithSpaces = hasSelection ? selectedText.length : 0;
  const selCharsWithoutSpaces = hasSelection ? countCharsWithoutSpaces(selectedText) : 0;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.statsModalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.statsModalHeader}>
          <div className={styles.statsModalTitle}>
            <BarChart2 size={18} color="#4a90e2" />
            <span>Dokumentstatistik</span>
          </div>
          <button 
            type="button" 
            className={styles.iconBtnSmall} 
            onClick={onClose}
            title="Luk (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Selection Banner */}
        {hasSelection && (
          <div className={styles.statsSelectionBanner}>
            <CheckSquare size={14} color="#4a90e2" />
            <span>
              Viser statistik for den valgte tekst samt hele dokumentet
            </span>
          </div>
        )}

        {/* Statistics Table */}
        <div className={styles.statsGrid}>
          <div className={styles.statsRow}>
            <span className={styles.statsLabel}>Sider (estimeret A4)</span>
            <span className={styles.statsValue}>{estimatedPages}</span>
          </div>
          <div className={styles.statsRow}>
            <span className={styles.statsLabel}>Ord</span>
            <span className={styles.statsValue}>
              {hasSelection ? `${selWords} (af ${totalWords})` : totalWords}
            </span>
          </div>
          <div className={styles.statsRow}>
            <span className={styles.statsLabel}>Tegn (uden mellemrum)</span>
            <span className={styles.statsValue}>
              {hasSelection 
                ? `${selCharsWithoutSpaces} (af ${totalCharsWithoutSpaces})` 
                : totalCharsWithoutSpaces}
            </span>
          </div>
          <div className={styles.statsRow}>
            <span className={styles.statsLabel}>Tegn (med mellemrum)</span>
            <span className={styles.statsValue}>
              {hasSelection 
                ? `${selCharsWithSpaces} (af ${totalCharsWithSpaces})` 
                : totalCharsWithSpaces}
            </span>
          </div>
          <div className={styles.statsRow}>
            <span className={styles.statsLabel}>Afsnit & overskrifter</span>
            <span className={styles.statsValue}>{totalParagraphs}</span>
          </div>
          <div className={styles.statsRow}>
            <span className={styles.statsLabel}>Sætninger</span>
            <span className={styles.statsValue}>{totalSentences}</span>
          </div>
        </div>

        <div className={styles.statsDivider} />

        {/* Time Estimates */}
        <div className={styles.statsTimeSection}>
          <div className={styles.statsTimeCard}>
            <Clock size={16} color="#10b981" />
            <div>
              <div className={styles.statsTimeVal}>~{readingTimeMin} min</div>
              <div className={styles.statsTimeLabel}>Estimeret læsetid (200 ord/min)</div>
            </div>
          </div>
          <div className={styles.statsTimeCard}>
            <Mic size={16} color="#f59e0b" />
            <div>
              <div className={styles.statsTimeVal}>~{speakingTimeMin} min</div>
              <div className={styles.statsTimeLabel}>Estimeret taletid (130 ord/min)</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.statsModalFooter}>
          <button 
            type="button" 
            className={styles.actionBtnPrimary} 
            onClick={onClose}
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentStatsModal;
