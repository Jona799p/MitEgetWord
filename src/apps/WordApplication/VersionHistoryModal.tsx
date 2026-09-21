import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  History, RotateCcw, Copy, X, Clock, Calendar, 
  FileText, Check, Plus, AlertCircle, ArrowLeft, Download
} from 'lucide-react';
import { 
  getDocumentVersions, createVersionSnapshot, deleteDocumentVersion 
} from '../../store/documentStore';
import { exportToWord, exportToHtml } from './exportUtils';
import styles from './WordApplication.module.css';

export interface DocumentVersion {
  id: string;
  docId: string;
  timestamp: string;
  title: string;
  content: string;
  label?: string;
  wordCount?: number;
  charCount?: number;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  currentTitle: string;
  currentContent: string;
  onRestoreVersion: (version: DocumentVersion) => void;
  onCreateCopyFromVersion?: (version: DocumentVersion) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  docId,
  currentTitle,
  currentContent,
  onRestoreVersion,
  onCreateCopyFromVersion,
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('current');
  const [isLoading, setIsLoading] = useState(true);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [confirmRestoreVersion, setConfirmRestoreVersion] = useState<DocumentVersion | null>(null);

  // Beregn ord og tegn for den aktuelle version
  const currentStats = useMemo(() => {
    const temp = document.createElement('div');
    temp.innerHTML = currentContent || '';
    const text = temp.textContent || temp.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return {
      wordCount: words,
      charCount: text.length,
    };
  }, [currentContent]);

  // Hent versioner ved åbning
  const loadVersions = useCallback(async () => {
    if (!docId) return;
    setIsLoading(true);
    try {
      const vers = await getDocumentVersions(docId);
      if (Array.isArray(vers)) {
        setVersions(vers);
      }
    } catch (err) {
      console.error('Fejl ved indlæsning af versionshistorik:', err);
    } finally {
      setIsLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
      setSelectedVersionId('current');
      setConfirmRestoreVersion(null);
    }
  }, [isOpen, loadVersions]);

  // Escape genvej
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmRestoreVersion) {
          setConfirmRestoreVersion(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, confirmRestoreVersion, onClose]);

  // Manuel snapshot oprettelse
  const handleCreateManualSnapshot = async () => {
    const label = newSnapshotName.trim() || 'Manuelt gemt version';
    try {
      const created = await createVersionSnapshot(
        docId,
        currentTitle,
        currentContent,
        label,
        currentStats.wordCount,
        currentStats.charCount
      );
      if (created) {
        setVersions(prev => [created, ...prev]);
        setSelectedVersionId(created.id);
        setNewSnapshotName('');
        setIsCreatingSnapshot(false);
      }
    } catch (err) {
      console.error('Fejl ved oprettelse af snapshot:', err);
    }
  };

  // Nuværende "virtuelle" version som altid vises øverst
  const currentVersionItem: DocumentVersion = useMemo(() => ({
    id: 'current',
    docId,
    timestamp: new Date().toISOString(),
    title: currentTitle,
    content: currentContent,
    label: 'Aktuel tilstand (nu)',
    wordCount: currentStats.wordCount,
    charCount: currentStats.charCount,
  }), [docId, currentTitle, currentContent, currentStats]);

  // Den aktuelt valgte version til forhåndsvisning
  const activeVersion = useMemo(() => {
    if (selectedVersionId === 'current') {
      return currentVersionItem;
    }
    return versions.find(v => v.id === selectedVersionId) || currentVersionItem;
  }, [selectedVersionId, currentVersionItem, versions]);

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 30) return 'Lige nu';
      if (diffSec < 60) return `For ${diffSec} sek. siden`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `For ${diffMin} min. siden`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `For ${diffHours} timer siden`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'I går';
      if (diffDays < 7) return `For ${diffDays} dage siden`;
      return new Date(isoString).toLocaleDateString('da-DK', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return '';
    }
  };

  const formatFullTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleString('da-DK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.versionModalBackdrop} onClick={onClose}>
      <div 
        className={styles.versionModalContainer} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className={styles.versionModalHeader}>
          <div className={styles.versionModalTitleGroup}>
            <History size={20} color="#4a90e2" />
            <div>
              <h2 className={styles.versionModalHeading}>Versionshistorik</h2>
              <span className={styles.versionModalSubheading}>
                &quot;{currentTitle}&quot; &middot; {versions.length} gemte {versions.length === 1 ? 'version' : 'versioner'}
              </span>
            </div>
          </div>

          <button 
            className={styles.versionModalCloseBtn}
            onClick={onClose}
            title="Luk versionshistorik (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Split-View Body */}
        <div className={styles.versionModalBody}>
          {/* Left Sidebar: Version List */}
          <div className={styles.versionSidebar}>
            {/* Create Snapshot Bar */}
            <div className={styles.createSnapshotBar}>
              {!isCreatingSnapshot ? (
                <button 
                  className={styles.createSnapshotToggleBtn}
                  onClick={() => setIsCreatingSnapshot(true)}
                  title="Gem et navngivet øjebliksbillede af dokumentet"
                >
                  <Plus size={14} />
                  <span>Opret navngivet snapshot</span>
                </button>
              ) : (
                <div className={styles.createSnapshotInputGroup}>
                  <input
                    type="text"
                    className={styles.createSnapshotInput}
                    placeholder="Fx 'Før omskrivning'..."
                    value={newSnapshotName}
                    onChange={(e) => setNewSnapshotName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateManualSnapshot();
                      if (e.key === 'Escape') setIsCreatingSnapshot(false);
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      className={styles.createSnapshotConfirmBtn}
                      onClick={handleCreateManualSnapshot}
                      title="Gem snapshot"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      className={styles.createSnapshotCancelBtn}
                      onClick={() => {
                        setIsCreatingSnapshot(false);
                        setNewSnapshotName('');
                      }}
                      title="Annuller"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List of Version Cards */}
            <div className={styles.versionList}>
              {/* 1. Current Working Version */}
              <div 
                className={`${styles.versionCard} ${selectedVersionId === 'current' ? styles.activeVersionCard : ''}`}
                onClick={() => setSelectedVersionId('current')}
              >
                <div className={styles.versionCardHeader}>
                  <span className={styles.currentVersionBadge}>
                    Aktuel version
                  </span>
                  <span className={styles.versionRelativeTime}>Lige nu</span>
                </div>
                <div className={styles.versionCardTitle}>
                  {currentTitle || 'Navnløst dokument'}
                </div>
                <div className={styles.versionCardMeta}>
                  <span>{currentStats.wordCount} ord</span>
                  <span>&middot;</span>
                  <span>{currentStats.charCount} tegn</span>
                </div>
              </div>

              {/* 2. Historical Snapshots */}
              {isLoading && (
                <div className={styles.versionLoadingState}>
                  <Clock size={16} className={styles.spinningIcon} />
                  <span>Henter tidligere versioner...</span>
                </div>
              )}

              {!isLoading && versions.length === 0 && (
                <div className={styles.emptyVersionsMessage}>
                  <AlertCircle size={18} color="#888888" />
                  <p>Ingen tidligere versioner endnu.</p>
                  <span>Nye snapshots oprettes automatisk når du gemmer eller laver større rettelser.</span>
                </div>
              )}

              {versions.map((ver, idx) => {
                const isSelected = selectedVersionId === ver.id;
                return (
                  <div 
                    key={ver.id}
                    className={`${styles.versionCard} ${isSelected ? styles.activeVersionCard : ''}`}
                    onClick={() => setSelectedVersionId(ver.id)}
                  >
                    <div className={styles.versionCardHeader}>
                      <span className={styles.versionLabelBadge}>
                        {ver.label || `Snapshot #${versions.length - idx}`}
                      </span>
                      <span className={styles.versionRelativeTime}>
                        {formatRelativeTime(ver.timestamp)}
                      </span>
                    </div>

                    <div className={styles.versionCardTitle}>
                      {ver.title || 'Navnløst dokument'}
                    </div>

                    <div className={styles.versionCardMeta}>
                      <span title={formatFullTime(ver.timestamp)}>
                        <Calendar size={11} style={{ marginRight: 3, display: 'inline' }} />
                        {new Date(ver.timestamp).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {typeof ver.wordCount === 'number' && (
                        <>
                          <span>&middot;</span>
                          <span>{ver.wordCount} ord</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Preview Panel */}
          <div className={styles.versionPreviewPane}>
            {/* Version Detail Action Bar */}
            <div className={styles.versionPreviewActionBar}>
              <div className={styles.versionDetails}>
                <div className={styles.versionDetailTitle}>
                  {activeVersion.title}
                  {selectedVersionId === 'current' && (
                    <span className={styles.currentPill}>Aktuel</span>
                  )}
                </div>
                <div className={styles.versionDetailMeta}>
                  <span>{formatFullTime(activeVersion.timestamp)}</span>
                  <span>&middot;</span>
                  <span>{activeVersion.label || 'Snapshot'}</span>
                  {typeof activeVersion.wordCount === 'number' && (
                    <>
                      <span>&middot;</span>
                      <span>{activeVersion.wordCount} ord &middot; {activeVersion.charCount} tegn</span>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.versionActionsGroup}>
                {selectedVersionId !== 'current' && (
                  <button 
                    className={styles.restoreVersionBtn}
                    onClick={() => setConfirmRestoreVersion(activeVersion)}
                    title="Gendan denne version og overskriv det nuværende indhold"
                  >
                    <RotateCcw size={14} />
                    <span>Gendan denne version</span>
                  </button>
                )}

                {onCreateCopyFromVersion && (
                  <button 
                    className={styles.copyVersionBtn}
                    onClick={() => onCreateCopyFromVersion(activeVersion)}
                    title="Opret et helt nyt dokument baseret på denne version"
                  >
                    <Copy size={13} />
                    <span>Opret kopi</span>
                  </button>
                )}

                <button 
                  className={styles.copyVersionBtn}
                  onClick={() => exportToWord(`${activeVersion.title} (${new Date(activeVersion.timestamp).toLocaleDateString('da-DK')})`, activeVersion.content)}
                  title="Download denne version som Word (.doc)"
                >
                  <Download size={13} />
                  <span>Word</span>
                </button>
              </div>
            </div>

            {/* Document Content Paper View */}
            <div className={styles.versionPreviewPaperContainer}>
              <div className={styles.versionPreviewPaper}>
                <h1 className={styles.versionPreviewDocTitle}>
                  {activeVersion.title || 'Navnløst dokument'}
                </h1>
                <div 
                  className={styles.versionPreviewDocBody}
                  dangerouslySetInnerHTML={{ __html: activeVersion.content || '<p><em>(Ingen tekst i denne version)</em></p>' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Restore Confirmation Dialog */}
        {confirmRestoreVersion && (
          <div 
            className={styles.restoreConfirmOverlay}
            onClick={() => setConfirmRestoreVersion(null)}
          >
            <div 
              className={styles.restoreConfirmBox}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Gendan version?</h3>
              <p>
                Er du sikker på, at du vil rulle &quot;<strong>{currentTitle}</strong>&quot; tilbage til versionen fra <strong>{formatFullTime(confirmRestoreVersion.timestamp)}</strong>?
              </p>
              <p style={{ fontSize: '12px', color: '#888888', margin: '4px 0 0' }}>
                Et sikkerhedssnapshot af din nuværende tilstand oprettes automatisk, så du altid kan fortryde igen.
              </p>

              <div className={styles.restoreConfirmButtons}>
                <button 
                  className={styles.cancelBtn}
                  onClick={() => setConfirmRestoreVersion(null)}
                >
                  Annuller
                </button>
                <button 
                  className={styles.restoreConfirmExecuteBtn}
                  onClick={() => {
                    const target = confirmRestoreVersion;
                    setConfirmRestoreVersion(null);
                    onRestoreVersion(target);
                    onClose();
                  }}
                >
                  <RotateCcw size={14} style={{ marginRight: 6 }} />
                  Gendan nu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VersionHistoryModal;
