import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, FileDown, Printer, X, ZoomIn, ZoomOut, RotateCcw, Check
} from 'lucide-react';
import { exportToPdf, exportToWord, printDocument } from './exportUtils';
import styles from './PrintPreviewModal.module.css';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  contentHtml: string;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  contentHtml
}) => {
  const [zoomLevel, setZoomLevel] = useState(85); // Default comfortable preview scale
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [wordSuccess, setWordSuccess] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const docTitle = title?.trim() || 'Dokument';

  const handleDownloadPdf = async () => {
    if (!sheetRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await exportToPdf(docTitle, sheetRef.current);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 2500);
    } catch (err) {
      console.error('Fejl ved generering af PDF:', err);
      alert('Der opstod en fejl under PDF-generering.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadWord = () => {
    try {
      exportToWord(docTitle, contentHtml);
      setWordSuccess(true);
      setTimeout(() => setWordSuccess(false), 2500);
    } catch (err) {
      console.error('Fejl ved eksport til Word:', err);
      alert('Der opstod en fejl under eksport til Word.');
    }
  };

  const handlePrint = () => {
    printDocument(docTitle, contentHtml);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 15, 150));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 15, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(85);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      {/* Top action & controls bar */}
      <div className={styles.topBar} onClick={(e) => e.stopPropagation()}>
        <div className={styles.titleSection}>
          <FileText size={18} className={styles.titleIcon} />
          <h2 className={styles.docTitle} title={docTitle}>
            {docTitle}
          </h2>
          <span className={styles.pageBadge}>A4 Forhåndsvisning</span>
        </div>

        <div className={styles.controlsSection}>
          {/* Zoom controls */}
          <div className={styles.zoomControls}>
            <button className={styles.zoomBtn} onClick={handleZoomOut} title="Zoom ud">
              <ZoomOut size={14} />
            </button>
            <span className={styles.zoomText} onClick={handleResetZoom} style={{ cursor: 'pointer' }} title="Nulstil zoom">
              {zoomLevel}%
            </span>
            <button className={styles.zoomBtn} onClick={handleZoomIn} title="Zoom ind">
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Download PDF Button */}
          <button 
            className={`${styles.actionBtn} ${styles.pdfBtn}`}
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            title="Download dokument som PDF (.pdf)"
          >
            {isGeneratingPdf ? (
              <>
                <div className={styles.btnSpinner} />
                <span>Genererer PDF...</span>
              </>
            ) : pdfSuccess ? (
              <>
                <Check size={15} />
                <span>PDF Downloadet!</span>
              </>
            ) : (
              <>
                <FileDown size={15} />
                <span>Download PDF</span>
              </>
            )}
          </button>

          {/* Download Word Button */}
          <button 
            className={`${styles.actionBtn} ${styles.wordBtn}`}
            onClick={handleDownloadWord}
            title="Download som Word (.doc)"
          >
            {wordSuccess ? (
              <>
                <Check size={15} />
                <span>Word Gemt!</span>
              </>
            ) : (
              <>
                <FileText size={15} />
                <span>Download Word</span>
              </>
            )}
          </button>

          {/* Print Button */}
          <button 
            className={`${styles.actionBtn} ${styles.printBtn}`}
            onClick={handlePrint}
            title="Send direkte til printer"
          >
            <Printer size={15} />
            <span>Udskriv</span>
          </button>

          {/* Close button */}
          <button className={styles.closeBtn} onClick={onClose} title="Luk forhåndsvisning (Esc)">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main preview viewport with centered A4 Sheet */}
      <div className={styles.previewViewport} onClick={onClose}>
        <div 
          className={styles.zoomContainer} 
          style={{ transform: `scale(${zoomLevel / 100})` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div ref={sheetRef} className={styles.a4Sheet}>
            <div 
              className={styles.a4Content}
              dangerouslySetInnerHTML={{ __html: contentHtml || '<p></p>' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
