import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Plus, Search, Star, Trash2, Edit2, Clock, 
  RotateCw, X, FileText, AlertCircle,
  Folder, FolderPlus, FolderInput, ArrowLeft, ChevronRight, Check,
  Printer, FileDown, Globe, FileCode, Eye,
  Copy, Tag, RotateCcw, Trash, Palette, Users, Briefcase, Mail, FileCheck, Sparkles,
  MoreVertical, ExternalLink, Archive, History,
  HardDrive, FolderOpen, CheckCircle2, CloudOff, Cloud
} from 'lucide-react';
import { 
  getDocuments, getDocument, createDocument, deleteDocument, 
  renameDocument, toggleFavorite, checkServerStatus,
  getFolders, createFolder, renameFolder, deleteFolder, moveDocumentToFolder,
  duplicateDocument, moveToTrash, restoreDocument, emptyTrash, updateDocumentTags,
  restoreDocumentVersion, toggleSaveLocally, syncPendingDocumentsToServer,
  openDocumentInExplorer, openDocumentsFolderInExplorer, openDocumentInSystem,
  saveDocumentLocallyToDisk, listDiskDocuments, resolveLocalDocumentsDirAsync,
  isTitleRecentlyDeleted
} from '../../store/documentStore';
import { DOCUMENT_TEMPLATES, DocumentTemplate } from './templates';
import { exportAllAsZip } from './backupUtils';
import VersionHistoryModal from './VersionHistoryModal';
import { printDocument, exportToWord, exportToHtml, exportToText, exportToPdfFromHtml } from './exportUtils';
import PrintPreviewModal from './PrintPreviewModal';
import { parseLocalFile, parseDocxArrayBuffer } from './localFileUtils';
import styles from './WordDashboard.module.css';

export interface FolderItem {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  createdAt?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  thumbnail?: string | null;
  isFavorite?: boolean;
  folderId?: string | null;
  tags?: string[];
  color?: string | null;
  inTrash?: boolean;
  deletedAt?: string | null;
  updatedAt?: string;
  isSavedLocally?: boolean;
  syncStatus?: 'synced' | 'pending_upload' | 'local_only';
}

interface WordDashboardProps {
  onOpenDocument: (doc: DocumentItem) => void;
  panelId?: string;
}

export const WordDashboard: React.FC<WordDashboardProps> = ({ onOpenDocument, panelId }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'recent' | 'trash' | 'local'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
  
  // Local files and offline sync states
  const localFileInputRef = useRef<HTMLInputElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [localDocsDirPath, setLocalDocsDirPath] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'info' | 'success' | 'warning' } | null>(null);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ text, type });
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);
  
  // Document modal states
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [docToPermanentDelete, setDocToPermanentDelete] = useState<DocumentItem | null>(null);
  const [isEmptyTrashModalOpen, setIsEmptyTrashModalOpen] = useState(false);
  const [docForTags, setDocForTags] = useState<DocumentItem | null>(null);
  const [docToRename, setDocToRename] = useState<DocumentItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [docToMove, setDocToMove] = useState<DocumentItem | null>(null);
  const [docToExport, setDocToExport] = useState<DocumentItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; doc: DocumentItem } | null>(null);
  const [versionHistoryDoc, setVersionHistoryDoc] = useState<DocumentItem | null>(null);
  const [isExportingBackup, setIsExportingBackup] = useState(false);

  // Folder modal states
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);

  // Drag-and-drop state
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Lyt på Tilbage-kommando (museknap på siden, Alt+Venstre pil eller panel overskrift)
  useEffect(() => {
    const handleNavigateBack = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail?.panelId && panelId && customEv.detail.panelId !== panelId) {
        return;
      }

      // 1. Luk åbne modaler/menuer i dashboardet hvis nogen er åbne
      if (contextMenu) {
        setContextMenu(null);
        e.preventDefault();
        return;
      }
      if (previewDoc) {
        setPreviewDoc(null);
        e.preventDefault();
        return;
      }
      if (versionHistoryDoc) {
        setVersionHistoryDoc(null);
        e.preventDefault();
        return;
      }
      if (docForTags) {
        setDocForTags(null);
        e.preventDefault();
        return;
      }
      if (docToRename) {
        setDocToRename(null);
        e.preventDefault();
        return;
      }
      if (docToMove) {
        setDocToMove(null);
        e.preventDefault();
        return;
      }
      if (docToExport) {
        setDocToExport(null);
        e.preventDefault();
        return;
      }
      if (docToDelete) {
        setDocToDelete(null);
        e.preventDefault();
        return;
      }
      if (docToPermanentDelete) {
        setDocToPermanentDelete(null);
        e.preventDefault();
        return;
      }
      if (isEmptyTrashModalOpen) {
        setIsEmptyTrashModalOpen(false);
        e.preventDefault();
        return;
      }
      if (isCreateFolderOpen) {
        setIsCreateFolderOpen(false);
        e.preventDefault();
        return;
      }
      if (folderToRename) {
        setFolderToRename(null);
        e.preventDefault();
        return;
      }
      if (folderToDelete) {
        setFolderToDelete(null);
        e.preventDefault();
        return;
      }

      // 2. Hvis vi er inde i en undermappe, gå et niveau op i mappehierarkiet
      if (currentFolderId !== null) {
        const currFolder = folders.find(f => f.id === currentFolderId);
        setCurrentFolderId(currFolder?.parentId || null);
        e.preventDefault();
        return;
      }

      // Hvis vi er i roden og ingen modaler er åbne, kaldes e.preventDefault() IKKE,
      // så App.jsx kan poppe stakken og navigere tilbage til f.eks. Skrivebordet.
    };

    window.addEventListener('os:navigate-back', handleNavigateBack);
    return () => {
      window.removeEventListener('os:navigate-back', handleNavigateBack);
    };
  }, [
    panelId, contextMenu, previewDoc, versionHistoryDoc, docForTags, docToRename,
    docToMove, docToExport, docToDelete, docToPermanentDelete, isEmptyTrashModalOpen,
    isCreateFolderOpen, folderToRename, folderToDelete, currentFolderId, folders
  ]);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const isOnline = await checkServerStatus();
      setIsServerOnline(isOnline);

      const [docs, fldrs] = await Promise.all([
        getDocuments(),
        getFolders()
      ]);

      if (Array.isArray(docs)) {
        setDocuments(prevDocs => {
          // Undgå unødvendige re-renders hvis listen af dokumenter ikke har ændret sig
          if (
            prevDocs.length === docs.length &&
            prevDocs.every((d, i) => 
              d.id === docs[i].id && 
              d.title === docs[i].title && 
              d.updatedAt === docs[i].updatedAt && 
              d.inTrash === docs[i].inTrash && 
              d.isSavedLocally === docs[i].isSavedLocally &&
              d.syncStatus === docs[i].syncStatus
            )
          ) {
            return prevDocs;
          }
          return docs;
        });

        // Sørg for at alle eksisterende lokale dokumenter findes som .docx på computerens disk
        const locals = docs.filter(d => !d.inTrash && (d.isSavedLocally || d.syncStatus === 'pending_upload'));
        for (const loc of locals) {
          if (!isTitleRecentlyDeleted(loc.title)) {
            saveDocumentLocallyToDisk(loc).catch(() => {});
          }
        }
      } else {
        setDocuments([]);
      }

      if (Array.isArray(fldrs)) {
        setFolders(fldrs);
      } else {
        setFolders([]);
      }

      // Hent dokumentmappens placering
      resolveLocalDocumentsDirAsync().then(dir => {
        if (dir) setLocalDocsDirPath(dir);
      });

      // Auto-importer eventuelle ukendte .docx filer fra mappen på disken
      try {
        const diskFiles = await listDiskDocuments();
        if (Array.isArray(diskFiles) && diskFiles.length > 0) {
          const electron = (typeof window !== 'undefined' && window.require) ? window.require('electron') : null;
          for (const df of diskFiles) {
            const cleanTitle = df.baseName || df.name.replace(/\.[^/.]+$/, '');
            const isRecentlyDeleted = isTitleRecentlyDeleted(cleanTitle);
            const normalizeTitle = (t: string) => (t || '').normalize('NFC').toLowerCase().replace(/[\s\-_]+/g, '').trim();
            const matchingDoc = (docs || []).find(d => !d.inTrash && (
              normalizeTitle(d.title) === normalizeTitle(cleanTitle) ||
              d.title.toLowerCase().trim() === cleanTitle.toLowerCase().trim()
            ));

            // Hvis filen matcher et eksisterende server-dokument, men brugeren har fravalgt lokal lagring:
            if (matchingDoc && !matchingDoc.isSavedLocally && matchingDoc.syncStatus !== 'pending_upload') {
              // Dette er en overskydende lokal fil på disken; ryd op så den ikke spøger
              deleteDocumentFromDisk(cleanTitle, df.path).catch(() => {});
              continue;
            }

            if (!matchingDoc && !isRecentlyDeleted && df.ext === '.docx' && electron?.ipcRenderer?.invoke) {
              try {
                const readRes = await electron.ipcRenderer.invoke('read-local-file', df.path);
                if (readRes?.success && readRes.data) {
                  const rawData = readRes.data;
                  const arrayBuffer = rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength);
                  const parsed = await parseDocxArrayBuffer(arrayBuffer, df.name);
                  const imported = await createDocument(parsed.title || cleanTitle, parsed.content || '<p></p>', null, [], null, true);
                  if (imported) {
                    setDocuments(prev => [imported, ...prev.filter(p => p.id !== imported.id)]);
                  }
                }
              } catch (e) {
                console.warn('Kunne ikke importere disk-fil:', df.name, e);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Fejl ved scanning af diskfiler:', err);
      }
    } catch (err) {
      console.error('Kunne ikke hente data:', err);
      setIsServerOnline(false);
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Automatisk synkronisering i baggrunden uden at nulstille skærmen eller vise loade-spinner
  useEffect(() => {
    let isRunning = false;
    const runBackgroundSync = async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        const online = await checkServerStatus();
        setIsServerOnline(online);
        if (online) {
          const res = await syncPendingDocumentsToServer();
          if (res && res.synced > 0) {
            showToast(`${res.synced} lokal(e) fil(er) blev automatisk synkroniseret med serveren.`, 'success');
          }
          // Hent de nyeste dokumenter i baggrunden (silent refresh, intet loade-ikon)
          await loadData(true);
        }
      } catch (err) {
        console.warn('Baggrundssynkronisering fejlede:', err);
      } finally {
        isRunning = false;
      }
    };

    const handleOnline = () => runBackgroundSync();
    window.addEventListener('online', handleOnline);

    const interval = setInterval(runBackgroundSync, 15000);
    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [loadData, showToast]);

  const handleTriggerOpenLocalFile = () => {
    localFileInputRef.current?.click();
  };

  const handleLocalFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const parsed = await parseLocalFile(file);
      // Opret dokument med isSavedLocally sat til true
      const newDoc = await createDocument(
        parsed.title,
        parsed.content,
        currentFolderId,
        [],
        null,
        true // Gem lokalt
      );
      showToast(`"${parsed.title}" blev åbnet og gemt lokalt!`, 'success');
      await loadData();
      if (newDoc) {
        onOpenDocument(newDoc);
      }
    } catch (err) {
      console.error('Fejl ved åbning af lokal fil:', err);
      showToast('Kunne ikke åbne filen. Tjek filformatet og prøv igen.', 'warning');
    } finally {
      setIsLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleOpenDocSafely = async (doc: DocumentItem) => {
    if (doc.inTrash) return;
    let targetDoc = doc;
    if (doc.id && (!doc.content || doc.content.trim() === '' || doc.content === '<p></p>')) {
      try {
        const fullDoc = await getDocument(doc.id);
        if (fullDoc && fullDoc.content) {
          targetDoc = fullDoc;
        }
      } catch (err) {
        console.warn('Kunne ikke hente fuldt dokument i dashboard:', err);
      }
    }
    onOpenDocument(targetDoc);
  };

  const handleToggleSaveLocally = async (doc: DocumentItem) => {
    try {
      const updated = await toggleSaveLocally(doc.id);
      if (updated) {
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, isSavedLocally: updated.isSavedLocally } : d));
        if (updated.isSavedLocally) {
          showToast(`"${doc.title}" er nu gemt lokalt på denne computer (offline-adgang).`, 'success');
        } else {
          showToast(`"${doc.title}" er fjernet fra computeren (ligger fortsat sikkert på serveren).`, 'info');
        }
      }
    } catch (err) {
      console.error('Fejl ved skift af lokal gemning:', err);
      showToast('Der opstod en fejl ved ændring af lokal gemning.', 'warning');
    }
  };

  const handleOpenInExplorer = async (doc: DocumentItem) => {
    try {
      showToast(`Finder "${doc.title}" i File Explorer...`, 'info');
      const res = await openDocumentInExplorer(doc.id, doc);
      if (res && res.success === false) {
        showToast('Kunne ikke åbne i File Explorer.', 'warning');
      }
    } catch (err) {
      console.error('Fejl ved åbning i File Explorer:', err);
      showToast('Kunne ikke åbne mappen i File Explorer.', 'warning');
    }
  };

  const handleOpenInSystem = async (doc: DocumentItem) => {
    try {
      showToast(`Åbner "${doc.title}" i Word / standardprogram...`, 'info');
      const res = await openDocumentInSystem(doc.id, doc);
      if (res && res.success === false) {
        showToast(res.error || 'Kunne ikke åbne filen. Kontroller at Word er installeret.', 'warning');
      }
    } catch (err) {
      console.error('Fejl ved åbning i systemprogram:', err);
      showToast('Kunne ikke åbne filen i standardprogram.', 'warning');
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncPendingDocumentsToServer();
      if (res && res.synced > 0) {
        showToast(`${res.synced} lokal(e) fil(er) blev synkroniseret med serveren!`, 'success');
        await loadData();
      } else if (res && !res.online) {
        showToast('Serveren er offline. Ændringerne forbliver gemt lokalt på computeren.', 'warning');
      } else {
        showToast('Alle lokale filer er allerede synkroniseret med serveren.', 'info');
      }
    } catch (err) {
      showToast('Kunne ikke gennemføre synkronisering.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      const newDoc = await createDocument('Nyt dokument', '<p></p>', currentFolderId);
      if (newDoc) {
        onOpenDocument(newDoc);
      }
    } catch (err) {
      console.error('Fejl ved oprettelse af nyt dokument:', err);
      onOpenDocument({
        id: `doc-${Date.now()}`,
        title: 'Nyt dokument',
        content: '<p></p>',
        folderId: currentFolderId,
        isSavedLocally: false
      });
    }
  };

  const handleCreateFolderSubmit = async () => {
    if (!newFolderName.trim()) return;
    try {
      const folder = await createFolder(newFolderName.trim(), '#4a90e2', createFolderParentId);
      if (folder) {
        setFolders(prev => [...prev, folder]);
      }
    } catch (err) {
      console.error('Fejl ved oprettelse af mappe:', err);
    } finally {
      setIsCreateFolderOpen(false);
      setNewFolderName('');
      setCreateFolderParentId(null);
    }
  };

  const handleConfirmRenameFolder = async () => {
    if (!folderToRename || !renameFolderValue.trim()) return;
    try {
      const updated = await renameFolder(folderToRename.id, renameFolderValue.trim());
      if (updated) {
        setFolders(prev => prev.map(f => f.id === folderToRename.id ? updated : f));
      }
    } catch (err) {
      console.error('Fejl ved omdøbning af mappe:', err);
    } finally {
      setFolderToRename(null);
      setRenameFolderValue('');
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    const parentFallback = folderToDelete.parentId || null;
    try {
      const success = await deleteFolder(folderToDelete.id);
      if (success) {
        setFolders(prev => 
          prev
            .filter(f => f.id !== folderToDelete.id)
            .map(f => f.parentId === folderToDelete.id ? { ...f, parentId: parentFallback } : f)
        );
        setDocuments(prev => 
          prev.map(d => d.folderId === folderToDelete.id ? { ...d, folderId: parentFallback } : d)
        );
        if (currentFolderId === folderToDelete.id) {
          setCurrentFolderId(parentFallback);
        }
      }
    } catch (err) {
      console.error('Fejl ved sletning af mappe:', err);
    } finally {
      setFolderToDelete(null);
    }
  };

  const handleMoveDoc = async (docId: string, targetFolderId: string | null) => {
    try {
      const updated = await moveDocumentToFolder(docId, targetFolderId);
      if (updated) {
        setDocuments(prev => prev.map(d => d.id === docId ? updated : d));
      } else {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, folderId: targetFolderId } : d));
      }
    } catch (err) {
      console.error('Fejl ved flytning af dokument:', err);
    } finally {
      setDocToMove(null);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    try {
      const updated = await toggleFavorite(docId);
      if (updated) {
        setDocuments(prev => prev.map(d => d.id === docId ? updated : d));
      } else {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, isFavorite: !d.isFavorite } : d));
      }
    } catch (err) {
      console.error('Fejl ved ændring af favorit:', err);
    }
  };

  const handleStartRename = (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    setDocToRename(doc);
    setRenameValue(doc.title);
  };

  const handleConfirmRename = async () => {
    if (!docToRename || !renameValue.trim()) return;
    try {
      const updated = await renameDocument(docToRename.id, renameValue.trim());
      if (updated) {
        setDocuments(prev => prev.map(d => d.id === docToRename.id ? updated : d));
      } else {
        setDocuments(prev => prev.map(d => d.id === docToRename.id ? { ...d, title: renameValue.trim() } : d));
      }
    } catch (err) {
      console.error('Fejl ved omdøbning af dokument:', err);
    } finally {
      setDocToRename(null);
      setRenameValue('');
    }
  };

  const handleStartDelete = (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    setDocToDelete(doc);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    const target = docToDelete;
    try {
      await deleteDocument(target.id, target.title);
      setDocuments(prev => prev.filter(d => d.id !== target.id));
      showToast(`"${target.title}" er slettet permanent fra computeren og serveren.`, 'success');
    } catch (err) {
      console.error('Fejl ved sletning af dokument:', err);
      showToast('Kunne ikke slette dokumentet.', 'warning');
    } finally {
      setDocToDelete(null);
    }
  };

  const handleDuplicateDoc = async (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    try {
      const duplicate = await duplicateDocument(doc.id);
      if (duplicate) {
        setDocuments(prev => [duplicate, ...prev]);
      }
    } catch (err) {
      console.error('Fejl ved duplikering af dokument:', err);
    }
  };

  const handleRestoreDoc = async (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    try {
      await restoreDocument(doc.id);
      setDocuments(prev => 
        prev.map(d => d.id === doc.id ? { ...d, inTrash: false, deletedAt: null } : d)
      );
    } catch (err) {
      console.error('Fejl ved gendannelse af dokument:', err);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!docToPermanentDelete) return;
    const target = docToPermanentDelete;
    try {
      const success = await deleteDocument(target.id, target.title);
      if (success) {
        setDocuments(prev => prev.filter(d => d.id !== target.id));
        showToast(`"${target.title}" er slettet permanent fra computeren og serveren.`, 'success');
      }
    } catch (err) {
      console.error('Fejl ved permanent sletning:', err);
      showToast('Kunne ikke slette dokumentet permanent.', 'warning');
    } finally {
      setDocToPermanentDelete(null);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    try {
      const success = await emptyTrash();
      if (success) {
        setDocuments(prev => prev.filter(d => !d.inTrash));
      }
    } catch (err) {
      console.error('Fejl ved tømning af papirkurv:', err);
    } finally {
      setIsEmptyTrashModalOpen(false);
    }
  };

  const handleCreateFromTemplate = async (tmpl: DocumentTemplate) => {
    try {
      const newDoc = await createDocument(
        tmpl.defaultTitle,
        tmpl.content,
        currentFolderId,
        tmpl.tags,
        tmpl.color
      );
      if (newDoc) {
        onOpenDocument(newDoc);
      }
    } catch (err) {
      console.error('Fejl ved oprettelse fra skabelon:', err);
      onOpenDocument({
        id: `doc-${Date.now()}`,
        title: tmpl.defaultTitle,
        content: tmpl.content,
        folderId: currentFolderId,
        tags: tmpl.tags,
        color: tmpl.color,
      });
    }
  };

  const handleSaveTags = async (tags: string[], color: string | null) => {
    if (!docForTags) return;
    try {
      await updateDocumentTags(docForTags.id, tags, color);
      setDocuments(prev => prev.map(d => d.id === docForTags.id ? { ...d, tags, color } : d));
    } catch (err) {
      console.error('Fejl ved opdatering af tags:', err);
    } finally {
      setDocForTags(null);
    }
  };

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
      await exportAllAsZip(documents, folders);
    } catch (err) {
      console.error('Fejl ved eksport af backup zip:', err);
      alert('Der opstod en fejl under dannelsen af backup zip-filen.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleDocContextMenu = (e: React.MouseEvent, doc: DocumentItem) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    const menuHeight = doc.inTrash ? 130 : 320;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = Math.max(10, window.innerWidth - menuWidth - 10);
    }
    if (y + menuHeight > window.innerHeight) {
      y = Math.max(10, window.innerHeight - menuHeight - 10);
    }

    setContextMenu({ x, y, doc });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Format date helper
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Ukendt';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('da-DK', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getFolderName = (fId?: string | null) => {
    if (!fId) return null;
    const f = folders.find(folder => folder.id === fId);
    return f ? f.name : null;
  };

  const getFolderFullPath = (fId?: string | null): string | null => {
    if (!fId) return null;
    const names: string[] = [];
    let curr: FolderItem | undefined = folders.find(f => f.id === fId);
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      names.unshift(curr.name);
      if (!curr.parentId) break;
      curr = folders.find(f => f.id === curr!.parentId);
    }
    return names.length > 0 ? names.join(' / ') : null;
  };

  // Breadcrumbs trail for currentFolderId
  const breadcrumbs = useMemo(() => {
    if (!currentFolderId) return [];
    const trail: FolderItem[] = [];
    let curr: FolderItem | undefined = folders.find(f => f.id === currentFolderId);
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      trail.unshift(curr);
      if (!curr.parentId) break;
      curr = folders.find(f => f.id === curr!.parentId);
    }
    return trail;
  }, [currentFolderId, folders]);

  // Hierarchical folders tree for move modal
  const hierarchicalFolders = useMemo(() => {
    const result: { folder: FolderItem; level: number }[] = [];
    const buildTree = (parentId: string | null = null, level = 0) => {
      const children = folders.filter(f => (f.parentId || null) === parentId);
      for (const child of children) {
        result.push({ folder: child, level });
        buildTree(child.id, level + 1);
      }
    };
    buildTree(null, 0);
    return result;
  }, [folders]);

  // Separate active documents from trash and local documents
  const activeDocs = useMemo(() => documents.filter(d => !d.inTrash), [documents]);
  const trashDocs = useMemo(() => documents.filter(d => !!d.inTrash), [documents]);
  const localDocuments = useMemo(() => activeDocs.filter(d => !!d.isSavedLocally || d.syncStatus === 'pending_upload'), [activeDocs]);
  const pendingSyncDocs = useMemo(() => localDocuments.filter(d => d.syncStatus === 'pending_upload'), [localDocuments]);

  // Extract all unique tags present across active documents
  const availableTags = useMemo(() => {
    const defaultTags = ['Arbejde', 'Skole', 'Privat', 'Vigtigt'];
    const tagsSet = new Set<string>(defaultTags);
    activeDocs.forEach(d => {
      if (Array.isArray(d.tags)) {
        d.tags.forEach(t => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet);
  }, [activeDocs]);

  // Target base documents depending on tab
  const baseDocs = activeTab === 'trash' 
    ? trashDocs 
    : activeTab === 'local' 
    ? localDocuments 
    : activeDocs;

  // Filter and sort all documents
  const allFilteredDocuments = useMemo(() => {
    return baseDocs
      .filter(doc => {
        const matchesQuery = (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = !selectedTagFilter || (Array.isArray(doc.tags) && doc.tags.includes(selectedTagFilter));
        return matchesQuery && matchesTag;
      })
      .sort((a, b) => {
        if (activeTab === 'trash') {
          const timeA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
          const timeB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
          return timeB - timeA;
        }
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [baseDocs, searchQuery, selectedTagFilter, activeTab]);

  // Folders depending on view / search
  const filteredSearchFolders = folders.filter(f => 
    (f.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Root folders (no parent)
  const rootFolders = folders.filter(f => !f.parentId);
  const filteredRootFolders = rootFolders.filter(f => 
    (f.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Subfolders of current folder
  const currentSubfolders = folders.filter(f => f.parentId === currentFolderId);
  const filteredCurrentSubfolders = currentSubfolders.filter(f => 
    (f.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const totalFavoritesCount = activeDocs.filter(d => d.isFavorite).length;

  // Split documents based on location and favorite status
  const favoriteDocuments = allFilteredDocuments.filter(doc => !!doc.isFavorite);
  
  // When searching, show ALL matching non-favorite documents regardless of folder!
  // When not searching, only show documents that are at the root level (no folderId)
  const displayedRootOrSearchDocuments = searchQuery.trim()
    ? allFilteredDocuments.filter(doc => !doc.isFavorite)
    : allFilteredDocuments.filter(doc => !doc.folderId && !doc.isFavorite);

  const folderDocuments = allFilteredDocuments.filter(doc => doc.folderId === currentFolderId);
  const folderFavorites = folderDocuments.filter(doc => !!doc.isFavorite);
  const folderNonFavorites = folderDocuments.filter(doc => !doc.isFavorite);

  // Render document card with drag support
  const renderDocCard = (doc: DocumentItem, keyPrefix = '') => {
    const isDragging = draggedDocId === doc.id;
    const fName = getFolderName(doc.folderId);
    const isInTrash = !!doc.inTrash;

    return (
      <div 
        key={keyPrefix ? `${keyPrefix}-${doc.id}` : doc.id} 
        className={`${styles.docCard} ${isDragging ? styles.isDragging : ''} ${isInTrash ? styles.docCardInTrash : ''}`}
        onClick={() => {
          handleOpenDocSafely(doc);
        }}
        onContextMenu={(e) => handleDocContextMenu(e, doc)}
        style={{
          borderTop: doc.color ? `3px solid ${doc.color}` : undefined,
        }}
        draggable={!isInTrash}
        onDragStart={(e) => {
          if (isInTrash) return;
          e.dataTransfer.setData('text/plain', doc.id);
          e.dataTransfer.effectAllowed = 'move';
          setDraggedDocId(doc.id);
        }}
        onDragEnd={() => {
          setDraggedDocId(null);
          setDragOverFolderId(null);
        }}
        title={isInTrash ? `"${doc.title}" (Højreklik for valgmuligheder)` : `Åbn "${doc.title || 'Navnløst dokument'}" (Højreklik for indstillinger)`}
      >
        {/* Thumbnail Preview Area */}
        <div className={styles.docThumbnailArea}>
          {doc.thumbnail ? (
            <img src={doc.thumbnail} alt={doc.title} className={styles.docThumbImg} />
          ) : (
            <div className={styles.docCanvasPlaceholder}>
              <FileText size={20} color={doc.color || "#4a90e2"} />
              <div className={styles.docLinesSkeleton}>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} />
                <div className={`${styles.skeletonLine} ${styles.short}`} />
              </div>
            </div>
          )}

          {/* Folder pill badge top-left (shown outside this folder OR when searching) */}
          {fName && !isInTrash && (currentFolderId !== doc.folderId || !!searchQuery.trim()) && (
            <div className={styles.docFolderTopBadge} title={`Placeret i mappen "${getFolderFullPath(doc.folderId)}"`}>
              <Folder size={11} color="#4a90e2" />
              <span>{fName}</span>
            </div>
          )}

          {/* Favorite Toggle Button (only if not in trash) */}
          {!isInTrash && (
            <button 
              className={`${styles.favBadgeBtn} ${doc.isFavorite ? styles.isFav : ''}`}
              onClick={(e) => handleToggleFavorite(e, doc.id)}
              title={doc.isFavorite ? 'Fjern fra favoritter' : 'Marker som favorit'}
            >
              <Star 
                size={14} 
                fill={doc.isFavorite ? '#f1c40f' : 'none'} 
                stroke={doc.isFavorite ? '#f1c40f' : 'currentColor'} 
              />
            </button>
          )}
        </div>

        {/* Information & Actions */}
        <div className={styles.docInfo}>
          <div className={styles.docHeaderRow}>
            <h4 className={styles.docTitle} title={doc.title || 'Navnløst dokument'}>
              {doc.title || 'Navnløst dokument'}
            </h4>
          </div>

          {/* Tags row on card */}
          {Array.isArray(doc.tags) && doc.tags.filter(t => t.toLowerCase() !== 'lokal').length > 0 && !isInTrash && (
            <div className={styles.cardTagsRow}>
              {doc.tags.filter(t => t.toLowerCase() !== 'lokal').map(tag => (
                <span 
                  key={tag} 
                  className={styles.cardTagPill}
                  style={{
                    backgroundColor: doc.color ? `${doc.color}22` : undefined,
                    borderColor: doc.color ? `${doc.color}55` : undefined,
                    color: doc.color || undefined
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className={styles.docMeta}>
            <span className={styles.docDate}>
              <Clock size={11} />
              {isInTrash ? `Slettet ${formatDate(doc.deletedAt)}` : formatDate(doc.updatedAt)}
            </span>

            {/* Hurtig-ikon/knap til lokal hentning eller fjernelse */}
            {!isInTrash && (
              doc.syncStatus === 'pending_upload' ? (
                <span className={styles.docStorageIcon} title="Afventer synkronisering med serveren">
                  <RotateCw size={12} className={styles.spinningSyncIcon} color="#f59e0b" />
                </span>
              ) : doc.isSavedLocally ? (
                <button
                  className={styles.docStorageBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSaveLocally(doc);
                  }}
                  title="Gemt lokalt på computeren. Klik for at fjerne fra computeren (forbliver sikkert på serveren)"
                >
                  <HardDrive size={12} color="#10b981" />
                </button>
              ) : (
                <button
                  className={styles.docStorageBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSaveLocally(doc);
                  }}
                  title="Gemt på serveren. Klik for at hente en lokal kopi til computeren (offline-adgang)"
                >
                  <Cloud size={12} color="#94a3b8" />
                </button>
              )
            )}

            {/* Hurtigknap i Lokale filer fanen til at fjerne lokal kopi */}
            {activeTab === 'local' && !isInTrash && (
              <button
                className={styles.removeLocalBadgeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSaveLocally(doc);
                }}
                title="Fjern fra denne computer (dokumentet forbliver 100% sikkert på serveren)"
              >
                <CloudOff size={11} color="#f87171" />
                <span>Fjern fra PC</span>
              </button>
            )}

            <button
              className={styles.cardMoreBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleDocContextMenu(e, doc);
              }}
              title="Indstillinger (eller højreklik)"
            >
              <MoreVertical size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render folder card with drop support
  const renderFolderCard = (folder: FolderItem) => {
    const docCount = documents.filter(d => d.folderId === folder.id).length;
    const subfolderCount = folders.filter(f => f.parentId === folder.id).length;
    const isDragOver = dragOverFolderId === folder.id;

    const countParts: string[] = [];
    countParts.push(`${docCount} ${docCount === 1 ? 'dokument' : 'dokumenter'}`);
    if (subfolderCount > 0) {
      countParts.push(`${subfolderCount} ${subfolderCount === 1 ? 'undermappe' : 'undermapper'}`);
    }
    const countText = countParts.join(', ');

    return (
      <div 
        key={folder.id}
        className={`${styles.folderCard} ${isDragOver ? styles.dragOver : ''}`}
        onClick={() => setCurrentFolderId(folder.id)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverFolderId !== folder.id) {
            setDragOverFolderId(folder.id);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          if (dragOverFolderId === folder.id) {
            setDragOverFolderId(null);
          }
        }}
        onDrop={async (e) => {
          e.preventDefault();
          const docId = e.dataTransfer.getData('text/plain') || draggedDocId;
          if (docId) {
            await handleMoveDoc(docId, folder.id);
          }
          setDragOverFolderId(null);
          setDraggedDocId(null);
        }}
        title={`Åbn mappen "${folder.name}" (${countText}) - Træk et dokument herhen for at flytte det hertil`}
      >
        <div className={styles.folderIconCircle}>
          <Folder size={18} />
        </div>

        <div className={styles.folderDetails}>
          <h4 className={styles.folderTitle}>{folder.name}</h4>
          <span className={styles.folderCount}>
            {countText}
          </span>
        </div>

        <div className={styles.folderActions} onClick={(e) => e.stopPropagation()}>
          <button 
            className={styles.cardActionBtn}
            onClick={() => {
              setFolderToRename(folder);
              setRenameFolderValue(folder.name);
            }}
            title="Omdøb mappe"
          >
            <Edit2 size={12} />
          </button>
          <button 
            className={`${styles.cardActionBtn} ${styles.deleteBtn}`}
            onClick={() => setFolderToDelete(folder)}
            title="Slet mappe"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  const renderTemplateIcon = (iconName: string, color: string) => {
    switch (iconName) {
      case 'Users':
        return <Users size={22} color={color} />;
      case 'Briefcase':
        return <Briefcase size={22} color={color} />;
      case 'Mail':
        return <Mail size={22} color={color} />;
      case 'FileCheck':
        return <FileCheck size={22} color={color} />;
      default:
        return <FileText size={22} color={color} />;
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Sleek Sub-Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.tabsGroup}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'all' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('all');
              setCurrentFolderId(null);
            }}
          >
            <span>Alle</span>
            <span className={styles.tabBadge}>({activeDocs.length})</span>
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'favorites' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('favorites');
              setCurrentFolderId(null);
            }}
          >
            <span>Favoritter</span>
            <span className={styles.tabBadge}>({totalFavoritesCount})</span>
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'recent' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('recent');
              setCurrentFolderId(null);
            }}
          >
            <span>Seneste</span>
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'local' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('local');
              setCurrentFolderId(null);
            }}
            title="Dokumenter gemt lokalt på denne computer"
          >
            <HardDrive size={13} />
            <span>Lokale filer</span>
            {localDocuments.length > 0 && (
              <span className={styles.tabBadge}>({localDocuments.length})</span>
            )}
          </button>
          <button 
            className={`${styles.tabBtn} ${styles.trashTabBtn} ${activeTab === 'trash' ? styles.activeTab : ''}`}
            onClick={() => {
              setActiveTab('trash');
              setCurrentFolderId(null);
            }}
          >
            <Trash2 size={13} />
            <span>Papirkurv</span>
            {trashDocs.length > 0 && (
              <span className={`${styles.tabBadge} ${styles.trashBadge}`}>
                ({trashDocs.length})
              </span>
            )}
          </button>
        </div>

        <div className={styles.toolbarControls}>
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input 
              type="text"
              className={styles.searchInput}
              placeholder="Søg i dokumenter og mapper..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery('')}
                title="Ryd søgning"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button 
            className={styles.refreshBtn} 
            onClick={loadData} 
            title="Genindlæs dokumenter og mapper"
          >
            <RotateCw size={14} />
          </button>

          <input
            type="file"
            ref={localFileInputRef}
            style={{ display: 'none' }}
            accept=".docx,.doc,.html,.htm,.txt,.md,.json,.mew"
            onChange={handleLocalFileSelected}
          />

          <button 
            className={styles.openLocalBtn}
            onClick={handleTriggerOpenLocalFile}
            title="Åbn fil fra computeren (.docx, .html, .txt, .md, .json, .mew)"
          >
            <FolderOpen size={14} />
            <span>Åbn lokal fil</span>
          </button>

          <button 
            className={styles.backupBtn}
            onClick={handleExportBackup}
            disabled={isExportingBackup}
            title="Download komplet backup af alle mapper og dokumenter (.zip)"
          >
            <Archive size={14} />
            <span>{isExportingBackup ? 'Laver backup...' : 'Backup (.zip)'}</span>
          </button>

          <button 
            className={styles.newFolderBtn} 
            onClick={() => {
              setCreateFolderParentId(currentFolderId);
              setIsCreateFolderOpen(true);
            }}
            title={currentFolderId ? `Opret undermappe i "${currentFolder?.name || 'mappen'}"` : "Opret en ny mappe"}
          >
            <FolderPlus size={15} />
            <span>{currentFolderId ? 'Ny undermappe' : 'Ny mappe'}</span>
          </button>

          <button className={styles.newDocBtn} onClick={handleCreateNew}>
            <Plus size={16} />
            <span>Nyt dokument</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {isLoading ? (
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner} />
            <span>Indlæser dokumenter og mapper...</span>
          </div>
        ) : activeTab === 'favorites' ? (
          /* FAVORITTER TAB VIEW */
          <div className={styles.sectionBlock}>
            <div className={styles.contentHeader}>
              <div className={styles.sectionTitleWithIcon}>
                <Star size={14} fill="#f1c40f" stroke="#f1c40f" />
                <h2 className={styles.sectionTitle}>Favoritter</h2>
              </div>
              <span className={styles.docCount}>
                {favoriteDocuments.length} {favoriteDocuments.length === 1 ? 'dokument' : 'dokumenter'}
              </span>
            </div>

            {favoriteDocuments.length > 0 ? (
              <div className={styles.docsGrid}>
                {favoriteDocuments.map(doc => renderDocCard(doc, 'fav-only'))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <AlertCircle size={36} color="#666666" />
                <h3>Ingen favoritter fundet</h3>
                <p>
                  {searchQuery 
                    ? `Der er ingen favoritdokumenter, der matcher "${searchQuery}".` 
                    : 'Du har ingen favoritter endnu. Klik på stjernen på et dokument for at føje det til favoritter.'}
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'recent' ? (
          /* SENESTE TAB VIEW */
          <div className={styles.sectionBlock}>
            <div className={styles.contentHeader}>
              <div className={styles.sectionTitleWithIcon}>
                <Clock size={14} color="#888888" />
                <h2 className={styles.sectionTitle}>Senest redigerede</h2>
              </div>
              <span className={styles.docCount}>
                {allFilteredDocuments.length} {allFilteredDocuments.length === 1 ? 'dokument' : 'dokumenter'}
              </span>
            </div>

            {allFilteredDocuments.length > 0 ? (
              <div className={styles.docsGrid}>
                {allFilteredDocuments.map(doc => renderDocCard(doc, 'recent'))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <AlertCircle size={36} color="#666666" />
                <h3>Ingen dokumenter fundet</h3>
                <p>
                  {searchQuery 
                    ? `Der er ingen dokumenter, der matcher "${searchQuery}".` 
                    : 'Der er ingen dokumenter endnu.'}
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'trash' ? (
          /* PAPIRKURV TAB VIEW */
          <div className={styles.sectionBlock}>
            <div className={styles.contentHeader}>
              <div className={styles.sectionTitleWithIcon}>
                <Trash2 size={16} color="#ef4444" />
                <h2 className={styles.sectionTitle}>Papirkurv</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={styles.docCount}>
                  {trashDocs.length} {trashDocs.length === 1 ? 'slettet dokument' : 'slettede dokumenter'}
                </span>
                {trashDocs.length > 0 && (
                  <button 
                    className={styles.emptyTrashBtn}
                    onClick={() => setIsEmptyTrashModalOpen(true)}
                    title="Slet alle dokumenter i papirkurven permanent"
                  >
                    <Trash size={13} />
                    <span>Tøm papirkurv</span>
                  </button>
                )}
              </div>
            </div>

            {trashDocs.length > 0 ? (
              <div className={styles.docsGrid}>
                {allFilteredDocuments.map(doc => renderDocCard(doc, 'trash-tab'))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Trash2 size={40} color="#666666" />
                <h3>Papirkurven er tom</h3>
                <p>Når du sletter et dokument, lander det her. Du kan altid gendanne det igen.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'local' ? (
          /* LOKALE FILER TAB VIEW */
          <div className={styles.sectionBlock}>
            <div className={styles.contentHeader}>
              <div className={styles.sectionTitleWithIcon}>
                <HardDrive size={16} color="#10b981" />
                <h2 className={styles.sectionTitle}>Lokale filer på computeren</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={styles.docCount}>
                  {allFilteredDocuments.length} {allFilteredDocuments.length === 1 ? 'lokalt dokument' : 'lokale dokumenter'}
                </span>
                <button
                  className={styles.syncNowBtn}
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  title="Synkroniser lokale ændringer med serveren"
                >
                  <RotateCw size={13} className={isSyncing ? styles.spinningSyncIcon : ''} />
                  <span>{isSyncing ? 'Synkroniserer...' : 'Synkroniser'}</span>
                </button>
                <button
                  className={styles.openLocalTabBtn}
                  onClick={handleTriggerOpenLocalFile}
                  title="Åbn en fil fra computeren (.docx, .txt, .html, .md)"
                >
                  <FolderOpen size={13} />
                  <span>Åbn lokal fil</span>
                </button>
                <button
                  className={styles.openLocalTabBtn}
                  onClick={async () => {
                    try {
                      showToast('Åbner mappen i File Explorer...', 'info');
                      await openDocumentsFolderInExplorer();
                    } catch {
                      showToast('Kunne ikke åbne mappen i File Explorer.', 'warning');
                    }
                  }}
                  title="Gå til mappen i File Explorer og se alle dokumenterne der"
                >
                  <FolderOpen size={13} color="#f59e0b" />
                  <span>Åbn i File Explorer</span>
                </button>
              </div>
            </div>

            {/* Offline-First Information Box */}
            <div className={styles.localInfoBanner}>
              <div className={styles.localInfoIcon}>
                <HardDrive size={18} color="#10b981" />
              </div>
              <div className={styles.localInfoText}>
                <strong>Lokale Word-dokumenter (.docx) på denne computer</strong>
                <span>
                  Dokumenter her gemmes som rigtige Word-filer på din computer{localDocsDirPath ? ` i "${localDocsDirPath}"` : ' i Dokumenter\\MitEgetWord'}. De kan tilgås offline og åbnes direkte i Stifinder eller Microsoft Word.
                  {pendingSyncDocs.length > 0 
                    ? ` Der er ${pendingSyncDocs.length} dokument(er), der afventer synkronisering med serveren.` 
                    : ' Alle dine lokale dokumenter er synkroniseret med serveren.'}
                </span>
              </div>
            </div>

            {allFilteredDocuments.length > 0 ? (
              <div className={styles.docsGrid}>
                {allFilteredDocuments.map(doc => renderDocCard(doc, 'local-tab'))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <HardDrive size={40} color="#666666" />
                <h3>Ingen lokale filer endnu</h3>
                <p>
                  {searchQuery
                    ? `Der er ingen lokale dokumenter, der matcher "${searchQuery}".`
                    : 'Du har ingen dokumenter gemt lokalt på denne computer endnu. Højreklik på et vilkårligt dokument og vælg "Gem lokalt (Offline adgang)", eller åbn en fil direkte fra din computer.'}
                </p>
                <button 
                  className={styles.emptyActionBtn}
                  onClick={handleTriggerOpenLocalFile}
                >
                  <FolderOpen size={15} />
                  <span>Åbn lokal fil fra computeren</span>
                </button>
              </div>
            )}
          </div>
        ) : currentFolderId !== null && currentFolder && !searchQuery.trim() ? (
          /* INSIDE A FOLDER VIEW (when not searching) */
          <>
            {/* Breadcrumbs Navigation with Drop to Unfolder / Ancestors */}
            <div className={styles.breadcrumbBar}>
              <div className={styles.breadcrumbNav}>
                <button 
                  className={`${styles.breadcrumbBtn} ${dragOverFolderId === 'root' ? styles.dragOverBreadcrumb : ''}`}
                  onClick={() => setCurrentFolderId(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverFolderId !== 'root') setDragOverFolderId('root');
                  }}
                  onDragLeave={() => {
                    if (dragOverFolderId === 'root') setDragOverFolderId(null);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const docId = e.dataTransfer.getData('text/plain') || draggedDocId;
                    if (docId) {
                      await handleMoveDoc(docId, null);
                    }
                    setDragOverFolderId(null);
                    setDraggedDocId(null);
                  }}
                  title="Gå tilbage til overblikket (eller slip et dokument her for at flytte ud i roden)"
                >
                  <ArrowLeft size={13} />
                  <span>Dokumenter</span>
                </button>

                {breadcrumbs.map((crumb, idx) => {
                  const isCurrentCrumb = idx === breadcrumbs.length - 1;
                  const isDragOver = dragOverFolderId === crumb.id;

                  return (
                    <React.Fragment key={crumb.id}>
                      <span className={styles.breadcrumbSeparator}>
                        <ChevronRight size={13} />
                      </span>
                      {isCurrentCrumb ? (
                        <div className={styles.breadcrumbCurrent}>
                          <Folder size={14} color="#4a90e2" />
                          <span>{crumb.name}</span>
                        </div>
                      ) : (
                        <button
                          className={`${styles.breadcrumbBtn} ${isDragOver ? styles.dragOverBreadcrumb : ''}`}
                          onClick={() => setCurrentFolderId(crumb.id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverFolderId !== crumb.id) setDragOverFolderId(crumb.id);
                          }}
                          onDragLeave={() => {
                            if (dragOverFolderId === crumb.id) setDragOverFolderId(null);
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            const docId = e.dataTransfer.getData('text/plain') || draggedDocId;
                            if (docId) {
                              await handleMoveDoc(docId, crumb.id);
                            }
                            setDragOverFolderId(null);
                            setDraggedDocId(null);
                          }}
                          title={`Gå til "${crumb.name}" (eller slip et dokument her for at flytte det hertil)`}
                        >
                          <Folder size={13} color="#4a90e2" />
                          <span>{crumb.name}</span>
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className={styles.folderHeaderActions}>
                <button 
                  className={styles.cardActionBtn}
                  onClick={() => {
                    setFolderToRename(currentFolder);
                    setRenameFolderValue(currentFolder.name);
                  }}
                  title="Omdøb denne mappe"
                >
                  <Edit2 size={13} />
                </button>
                <button 
                  className={`${styles.cardActionBtn} ${styles.deleteBtn}`}
                  onClick={() => setFolderToDelete(currentFolder)}
                  title="Slet denne mappe"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Subfolders Section */}
            {(filteredCurrentSubfolders.length > 0 || !searchQuery) && (
              <div className={styles.sectionBlock}>
                <div className={styles.contentHeader}>
                  <div className={styles.sectionTitleWithIcon}>
                    <Folder size={14} color="#4a90e2" />
                    <h2 className={styles.sectionTitle}>Undermapper</h2>
                  </div>
                  <span className={styles.docCount}>
                    {filteredCurrentSubfolders.length} {filteredCurrentSubfolders.length === 1 ? 'undermappe' : 'undermapper'}
                  </span>
                </div>

                <div className={styles.foldersGrid}>
                  {!searchQuery && (
                    <div 
                      className={styles.createFolderCard}
                      onClick={() => {
                        setCreateFolderParentId(currentFolderId);
                        setIsCreateFolderOpen(true);
                      }}
                      title={`Opret en ny undermappe i "${currentFolder.name}"`}
                    >
                      <div className={styles.createFolderIconCircle}>
                        <FolderPlus size={18} />
                      </div>
                      <span className={styles.createFolderTitle}>+ Opret undermappe</span>
                    </div>
                  )}

                  {filteredCurrentSubfolders.map(folder => renderFolderCard(folder))}
                </div>
              </div>
            )}

            {/* Folder Favorites if any */}
            {folderFavorites.length > 0 && (
              <div className={styles.sectionBlock}>
                <div className={styles.contentHeader}>
                  <div className={styles.sectionTitleWithIcon}>
                    <Star size={14} fill="#f1c40f" stroke="#f1c40f" />
                    <h2 className={styles.sectionTitle}>Favoritter i mappen</h2>
                  </div>
                  <span className={styles.docCount}>
                    {folderFavorites.length} {folderFavorites.length === 1 ? 'dokument' : 'dokumenter'}
                  </span>
                </div>
                <div className={styles.docsGrid}>
                  {folderFavorites.map(doc => renderDocCard(doc, 'folder-fav'))}
                </div>
              </div>
            )}

            {/* Folder Documents */}
            <div className={styles.sectionBlock}>
              <div className={styles.contentHeader}>
                <h2 className={styles.sectionTitle}>Dokumenter i mappen</h2>
                <span className={styles.docCount}>
                  {folderNonFavorites.length} {folderNonFavorites.length === 1 ? 'dokument' : 'dokumenter'}
                </span>
              </div>

              <div className={styles.docsGrid}>
                {!searchQuery && (
                  <div 
                    className={styles.createCard} 
                    onClick={handleCreateNew}
                    title="Opret et nyt tomt dokument i denne mappe"
                  >
                    <div className={styles.createIconCircle}>
                      <Plus size={22} />
                    </div>
                    <span className={styles.createCardTitle}>Nyt tomt dokument</span>
                  </div>
                )}

                {folderNonFavorites.map(doc => renderDocCard(doc, 'folder-doc'))}

                {folderDocuments.length === 0 && filteredCurrentSubfolders.length === 0 && (
                  <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
                    <Folder size={36} color="#666666" />
                    <h3>Denne mappe er tom</h3>
                    <p>
                      {searchQuery 
                        ? `Der er ingen dokumenter eller undermapper, der matcher "${searchQuery}".` 
                        : 'Klik på "+ Opret undermappe" eller "Nyt tomt dokument" for at komme i gang.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ROOT / OVERBLIK VIEW */
          <>
            {/* TEMPLATES GALLERY */}
            {activeTab === 'all' && !searchQuery.trim() && (
              <div className={styles.templatesSection}>
                <div className={styles.templatesHeader}>
                  <div className={styles.sectionTitleWithIcon}>
                    <Sparkles size={16} color="#4a90e2" />
                    <h2 className={styles.sectionTitle}>Start et nyt dokument</h2>
                  </div>
                  <span className={styles.docCount}>Vælg en skabelon</span>
                </div>

                <div className={styles.templatesGrid}>
                  {DOCUMENT_TEMPLATES.map(tmpl => (
                    <div 
                      key={tmpl.id}
                      className={styles.templateCard}
                      onClick={() => handleCreateFromTemplate(tmpl)}
                      title={`Opret ${tmpl.name} - ${tmpl.description}`}
                    >
                      <div className={styles.templateThumbnail} style={{ borderTop: `3px solid ${tmpl.color}` }}>
                        {renderTemplateIcon(tmpl.iconName, tmpl.color)}
                        {tmpl.badge && <span className={styles.templateBadge}>{tmpl.badge}</span>}
                      </div>
                      <div className={styles.templateInfo}>
                        <h4 className={styles.templateName}>{tmpl.name}</h4>
                        <p className={styles.templateDesc}>{tmpl.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAG FILTER BAR */}
            {availableTags.length > 0 && (
              <div className={styles.tagFilterBar}>
                <span className={styles.tagFilterLabel}>
                  <Tag size={12} color="#4a90e2" />
                  <span>Filtrér tags:</span>
                </span>
                <button 
                  className={`${styles.tagFilterPill} ${selectedTagFilter === null ? styles.activeTagFilter : ''}`}
                  onClick={() => setSelectedTagFilter(null)}
                >
                  Alle
                </button>
                {availableTags.map(tag => (
                  <button 
                    key={tag}
                    className={`${styles.tagFilterPill} ${selectedTagFilter === tag ? styles.activeTagFilter : ''}`}
                    onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* DYNAMIC FAVORITTER SECTION: Shown when there are favorite documents! */}
            {favoriteDocuments.length > 0 && (
              <div className={styles.sectionBlock}>
                <div className={styles.contentHeader}>
                  <div className={styles.sectionTitleWithIcon}>
                    <Star size={14} fill="#f1c40f" stroke="#f1c40f" />
                    <h2 className={styles.sectionTitle}>Favoritter</h2>
                  </div>
                  <span className={styles.docCount}>
                    {favoriteDocuments.length} {favoriteDocuments.length === 1 ? 'dokument' : 'dokumenter'}
                  </span>
                </div>
                <div className={styles.docsGrid}>
                  {favoriteDocuments.map(doc => renderDocCard(doc, 'fav-section'))}
                </div>
              </div>
            )}

            {/* MAPPER (FOLDERS) SECTION */}
            {((searchQuery ? filteredSearchFolders : filteredRootFolders).length > 0 || !searchQuery) && (
              <div className={styles.sectionBlock}>
                <div className={styles.contentHeader}>
                  <div className={styles.sectionTitleWithIcon}>
                    <Folder size={14} color="#4a90e2" />
                    <h2 className={styles.sectionTitle}>Mapper</h2>
                  </div>
                  <span className={styles.docCount}>
                    {(searchQuery ? filteredSearchFolders : filteredRootFolders).length} {(searchQuery ? filteredSearchFolders : filteredRootFolders).length === 1 ? 'mappe' : 'mapper'}
                  </span>
                </div>

                <div className={styles.foldersGrid}>
                  {/* Create Folder Card */}
                  {!searchQuery && (
                    <div 
                      className={styles.createFolderCard}
                      onClick={() => {
                        setCreateFolderParentId(null);
                        setIsCreateFolderOpen(true);
                      }}
                      title="Opret en ny mappe"
                    >
                      <div className={styles.createFolderIconCircle}>
                        <FolderPlus size={18} />
                      </div>
                      <span className={styles.createFolderTitle}>+ Opret ny mappe</span>
                    </div>
                  )}

                  {(searchQuery ? filteredSearchFolders : filteredRootFolders).map(folder => renderFolderCard(folder))}
                </div>
              </div>
            )}

            {/* DOKUMENTER SECTION */}
            <div className={styles.sectionBlock}>
              <div className={styles.contentHeader}>
                <h2 className={styles.sectionTitle}>
                  {searchQuery ? 'Matchende dokumenter' : 'Dokumenter'}
                </h2>
                <span className={styles.docCount}>
                  {displayedRootOrSearchDocuments.length} {displayedRootOrSearchDocuments.length === 1 ? 'dokument' : 'dokumenter'}
                </span>
              </div>

              <div className={styles.docsGrid}>
                {/* "Nyt tomt dokument" Card as first item if not searching */}
                {!searchQuery && (
                  <div 
                    className={styles.createCard} 
                    onClick={handleCreateNew}
                    title="Opret et nyt tomt dokument"
                  >
                    <div className={styles.createIconCircle}>
                      <Plus size={22} />
                    </div>
                    <span className={styles.createCardTitle}>Nyt tomt dokument</span>
                  </div>
                )}

                {displayedRootOrSearchDocuments.map(doc => renderDocCard(doc, 'doc-section'))}

                {/* Show empty state only if there are no documents matching search or no documents at all */}
                {allFilteredDocuments.length === 0 && filteredSearchFolders.length === 0 && (
                  <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
                    <AlertCircle size={36} color="#666666" />
                    <h3>Ingen resultater fundet</h3>
                    <p>
                      {searchQuery 
                        ? `Der er ingen dokumenter eller mapper, der matcher "${searchQuery}".` 
                        : 'Der er ingen dokumenter endnu. Klik på "Nyt tomt dokument" for at komme i gang.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCreateFolderOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>
              {createFolderParentId 
                ? `Opret undermappe i "${folders.find(f => f.id === createFolderParentId)?.name || 'mappen'}"` 
                : 'Opret ny mappe'}
            </h3>
            <input
              type="text"
              className={styles.modalInput}
              placeholder={createFolderParentId ? "F.eks. Dansk, Matematik, Opgaver..." : "F.eks. Skole, Arbejde, Noter..."}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolderSubmit();
                if (e.key === 'Escape') setIsCreateFolderOpen(false);
              }}
              autoFocus
            />
            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={() => setIsCreateFolderOpen(false)}>
                Annuller
              </button>
              <button className={styles.confirmBtn} onClick={handleCreateFolderSubmit}>
                {createFolderParentId ? 'Opret undermappe' : 'Opret mappe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {folderToRename && (
        <div className={styles.modalOverlay} onClick={() => setFolderToRename(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>Omdøb mappe</h3>
            <input
              type="text"
              className={styles.modalInput}
              value={renameFolderValue}
              onChange={(e) => setRenameFolderValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRenameFolder();
                if (e.key === 'Escape') setFolderToRename(null);
              }}
              autoFocus
            />
            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={() => setFolderToRename(null)}>
                Annuller
              </button>
              <button className={styles.confirmBtn} onClick={handleConfirmRenameFolder}>
                Gem navn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {folderToDelete && (
        <div className={styles.modalOverlay} onClick={() => setFolderToDelete(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>Slet mappe</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#aaaaaa', lineHeight: 1.5 }}>
              Er du sikker på, at du vil slette mappen &quot;<strong>{folderToDelete.name}</strong>&quot;?
              <br />
              Undermapper og dokumenter slettes ikke, men flyttes automatisk op til {folderToDelete.parentId ? 'den overliggende mappe.' : 'roden.'}
            </p>
            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={() => setFolderToDelete(null)}>
                Annuller
              </button>
              <button className={styles.dangerBtn} onClick={handleConfirmDeleteFolder}>
                Slet mappe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Document Modal */}
      {docToMove && (
        <div className={styles.modalOverlay} onClick={() => setDocToMove(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>Flyt dokument</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#888888' }}>
              Vælg hvilken mappe &quot;<strong>{docToMove.title}</strong>&quot; skal flyttes til:
            </p>

            <div className={styles.moveModalList}>
              <button 
                className={`${styles.moveModalItem} ${!docToMove.folderId ? styles.activeDestination : ''}`}
                onClick={() => handleMoveDoc(docToMove.id, null)}
              >
                <div className={styles.moveModalItemLeft}>
                  <FileText size={16} color="#888888" />
                  <span>Rod (Ingen mappe)</span>
                </div>
                {!docToMove.folderId && <Check size={14} color="#4a90e2" />}
              </button>

              {hierarchicalFolders.map(({ folder: f, level }) => {
                const isCurrent = docToMove.folderId === f.id;
                const count = documents.filter(d => d.folderId === f.id).length;
                return (
                  <button 
                    key={f.id}
                    className={`${styles.moveModalItem} ${isCurrent ? styles.activeDestination : ''}`}
                    style={{ paddingLeft: `${14 + level * 16}px` }}
                    onClick={() => handleMoveDoc(docToMove.id, f.id)}
                  >
                    <div className={styles.moveModalItemLeft}>
                      {level > 0 && <span style={{ color: '#666666', marginRight: '4px', fontSize: '11px' }}>└</span>}
                      <Folder size={16} color="#4a90e2" />
                      <span>{f.name}</span>
                      <span style={{ fontSize: '11px', color: '#666666' }}>({count})</span>
                    </div>
                    {isCurrent && <Check size={14} color="#4a90e2" />}
                  </button>
                );
              })}
            </div>

            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={() => setDocToMove(null)}>
                Luk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Document Modal */}
      {docToRename && (
        <div className={styles.modalOverlay} onClick={() => setDocToRename(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>Omdøb dokument</h3>
            <input
              type="text"
              className={styles.modalInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') setDocToRename(null);
              }}
              autoFocus
            />
            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={() => setDocToRename(null)}>
                Annuller
              </button>
              <button className={styles.confirmBtn} onClick={handleConfirmRename}>
                Gem navn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slet dokument modal */}
      {docToDelete && (
        <div className={styles.modalOverlay} onClick={() => setDocToDelete(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>Slet dokument</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#aaaaaa' }}>
              Vil du slette &quot;<strong>{docToDelete.title}</strong>&quot;? Dokumentet slettes permanent fra både denne computer og serveren.
            </p>
            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={() => setDocToDelete(null)}>
                Annuller
              </button>
              <button className={styles.dangerBtn} onClick={handleConfirmDelete}>
                Slet permanent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {docToPermanentDelete && (
        <div className={styles.modalOverlay} onClick={() => setDocToPermanentDelete(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>Slet permanent</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#ef4444' }}>
              Er du sikker på, at du vil slette &quot;<strong>{docToPermanentDelete.title}</strong>&quot; permanent?
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#aaaaaa' }}>
              Dette fjerner dokumentet fuldstændigt fra databasen og handlingen kan ikke fortrydes.
            </p>
            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={() => setDocToPermanentDelete(null)}>
                Annuller
              </button>
              <button className={styles.dangerBtn} onClick={handleConfirmPermanentDelete}>
                Slet for altid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Modal */}
      {isEmptyTrashModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsEmptyTrashModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>Tøm papirkurv</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#ef4444' }}>
              Er du sikker på, at du vil slette alle dokumenter i papirkurven permanent?
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#aaaaaa' }}>
              Denne handling sletter alle elementer i papirkurven for altid. Handlingen kan ikke fortrydes.
            </p>
            <div className={styles.modalButtons}>
              <button className={styles.cancelBtn} onClick={() => setIsEmptyTrashModalOpen(false)}>
                Annuller
              </button>
              <button className={styles.dangerBtn} onClick={handleConfirmEmptyTrash}>
                Tøm papirkurv nu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags and Color Modal */}
      {docForTags && (
        <TagsAndColorModal
          doc={docForTags}
          onClose={() => setDocForTags(null)}
          onSave={handleSaveTags}
        />
      )}

      {/* Export Document Modal */}
      {docToExport && (
        <div className={styles.modalOverlay} onClick={() => setDocToExport(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3>Eksportér &quot;{docToExport.title}&quot;</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#aaaaaa' }}>
              Vælg det ønskede format til udskrift eller download:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <button 
                className={styles.exportModalOptionBtn}
                onClick={() => {
                  setPreviewDoc(docToExport);
                  setDocToExport(null);
                }}
              >
                <Eye size={16} color="#4a90e2" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Vis udskrift (A4)</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Se siden på A4 papir & download PDF/Word</div>
                </div>
              </button>

              <button 
                className={styles.exportModalOptionBtn}
                onClick={async () => {
                  const target = docToExport;
                  setDocToExport(null);
                  await exportToPdfFromHtml(target.title, target.content);
                }}
              >
                <FileDown size={16} color="#2563eb" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Download PDF (.pdf)</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Gem direkte som PDF-fil</div>
                </div>
              </button>

              <button 
                className={styles.exportModalOptionBtn}
                onClick={() => {
                  exportToWord(docToExport.title, docToExport.content);
                  setDocToExport(null);
                }}
              >
                <FileText size={16} color="#3b82f6" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Word-dokument (.doc)</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Åbnes direkte i Microsoft Word</div>
                </div>
              </button>

              <button 
                className={styles.exportModalOptionBtn}
                onClick={() => {
                  printDocument(docToExport.title, docToExport.content);
                  setDocToExport(null);
                }}
              >
                <Printer size={16} color="#888888" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Send til printer</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Åbn systemets udskriftsdialog</div>
                </div>
              </button>

              <button 
                className={styles.exportModalOptionBtn}
                onClick={() => {
                  exportToHtml(docToExport.title, docToExport.content);
                  setDocToExport(null);
                }}
              >
                <Globe size={16} color="#10b981" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Webside (.html)</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Selvstændigt HTML-dokument</div>
                </div>
              </button>

              <button 
                className={styles.exportModalOptionBtn}
                onClick={() => {
                  const tempEl = document.createElement('div');
                  tempEl.innerHTML = docToExport.content || '';
                  const text = tempEl.textContent || tempEl.innerText || '';
                  exportToText(docToExport.title, text);
                  setDocToExport(null);
                }}
              >
                <FileCode size={16} color="#f59e0b" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Ren tekst (.txt)</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>Uformateret råtekst</div>
                </div>
              </button>
            </div>

            <div className={styles.modalButtons} style={{ marginTop: '16px' }}>
              <button className={styles.cancelBtn} onClick={() => setDocToExport(null)}>
                Luk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div 
          className={styles.contextMenuBackdrop}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div 
            className={styles.contextMenu}
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.contextMenuHeader} title={contextMenu.doc.title}>
              {contextMenu.doc.title || 'Dokument'}
            </div>

            {!contextMenu.doc.inTrash ? (
              <>
                <button 
                  className={`${styles.contextMenuItem} ${styles.contextMenuItemPrimary}`}
                  onClick={() => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    handleOpenDocSafely(d);
                  }}
                >
                  <ExternalLink size={14} color="#4a90e2" />
                  <span>Åbn dokument</span>
                </button>

                <button 
                  className={styles.contextMenuItem}
                  onClick={() => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    handleToggleSaveLocally(d);
                  }}
                  title={contextMenu.doc.isSavedLocally 
                    ? "Sletter den lokale .docx fil fra computeren. Dokumentet forbliver 100% intakt på serveren." 
                    : "Henter det fulde dokument ned på computeren til lynhurtig offline adgang."}
                >
                  {contextMenu.doc.isSavedLocally ? (
                    <>
                      <CloudOff size={14} color="#f59e0b" />
                      <span>Fjern fra denne PC (behold på server)</span>
                    </>
                  ) : (
                    <>
                      <FileDown size={14} color="#3b82f6" />
                      <span>Hent til denne PC (Offline adgang)</span>
                    </>
                  )}
                </button>

                {/* Vis KUN knappen for dokumenter der faktisk er hentet ned / gemt lokalt */}
                {(contextMenu.doc.isSavedLocally || contextMenu.doc.syncStatus === 'pending_upload' || contextMenu.doc.syncStatus === 'local_only') && (
                  <>
                    <button 
                      className={styles.contextMenuItem}
                      onClick={() => {
                        const d = contextMenu.doc;
                        setContextMenu(null);
                        handleOpenInExplorer(d);
                      }}
                      title="Gå til mappen i File Explorer (Stifinder) og se dokumentfilen på computeren"
                    >
                      <FolderOpen size={14} color="#f59e0b" />
                      <span>Vis i File Explorer (Stifinder)</span>
                    </button>

                    <button 
                      className={styles.contextMenuItem}
                      onClick={() => {
                        const d = contextMenu.doc;
                        setContextMenu(null);
                        handleOpenInSystem(d);
                      }}
                      title="Åbn .docx filen direkte i Microsoft Word eller computerens standardprogram"
                    >
                      <ExternalLink size={14} color="#3b82f6" />
                      <span>Åbn i Word / standardprogram</span>
                    </button>
                  </>
                )}

                <div className={styles.contextMenuDivider} />

                <button 
                  className={styles.contextMenuItem}
                  onClick={(e) => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    handleDuplicateDoc(e, d);
                  }}
                >
                  <Copy size={14} color="#a0aec0" />
                  <span>Opret kopi</span>
                </button>

                <button 
                  className={styles.contextMenuItem}
                  onClick={() => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    setDocForTags(d);
                  }}
                >
                  <Tag size={14} color="#a0aec0" />
                  <span>Tags og farvekode...</span>
                </button>

                <button 
                  className={styles.contextMenuItem}
                  onClick={() => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    setVersionHistoryDoc(d);
                  }}
                >
                  <History size={14} color="#a0aec0" />
                  <span>Versionshistorik...</span>
                </button>

                <button 
                  className={styles.contextMenuItem}
                  onClick={() => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    setDocToExport(d);
                  }}
                >
                  <FileDown size={14} color="#a0aec0" />
                  <span>Eksportér & udskriv...</span>
                </button>

                <button 
                  className={styles.contextMenuItem}
                  onClick={() => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    setDocToMove(d);
                  }}
                >
                  <FolderInput size={14} color="#a0aec0" />
                  <span>Flyt til mappe...</span>
                </button>

                <button 
                  className={styles.contextMenuItem}
                  onClick={(e) => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    handleStartRename(e, d);
                  }}
                >
                  <Edit2 size={14} color="#a0aec0" />
                  <span>Omdøb dokument...</span>
                </button>

                <div className={styles.contextMenuDivider} />

                <button 
                  className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`}
                  onClick={(e) => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    handleStartDelete(e, d);
                  }}
                >
                  <Trash2 size={14} />
                  <span>Flyt til papirkurv</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  className={`${styles.contextMenuItem} ${styles.contextMenuItemSuccess}`}
                  onClick={(e) => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    handleRestoreDoc(e, d);
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Gendan dokument</span>
                </button>

                <div className={styles.contextMenuDivider} />

                <button 
                  className={`${styles.contextMenuItem} ${styles.contextMenuItemDanger}`}
                  onClick={() => {
                    const d = contextMenu.doc;
                    setContextMenu(null);
                    setDocToPermanentDelete(d);
                  }}
                >
                  <Trash2 size={14} />
                  <span>Slet permanent</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Version History Modal in Dashboard */}
      {versionHistoryDoc && (
        <VersionHistoryModal 
          isOpen={!!versionHistoryDoc}
          onClose={() => setVersionHistoryDoc(null)}
          docId={versionHistoryDoc.id}
          currentTitle={versionHistoryDoc.title}
          currentContent={versionHistoryDoc.content}
          onRestoreVersion={async (ver) => {
            await restoreDocumentVersion(ver.docId, ver.id);
            await loadData();
          }}
          onCreateCopyFromVersion={async (ver) => {
            const copyTitle = `${ver.title || 'Dokument'} (Kopi af version)`;
            await createDocument(copyTitle, ver.content);
            await loadData();
          }}
        />
      )}

      {/* Visual Print & Page Preview Modal */}
      {previewDoc && (
        <PrintPreviewModal 
          isOpen={!!previewDoc} 
          onClose={() => setPreviewDoc(null)} 
          title={previewDoc.title} 
          contentHtml={previewDoc.content} 
        />
      )}

      {/* Sleek in-app Toast Notification */}
      {toastMessage && (
        <div className={`${styles.toast} ${styles[`toast_${toastMessage.type || 'info'}`]}`}>
          {toastMessage.type === 'success' && <CheckCircle2 size={16} color="#10b981" />}
          {toastMessage.type === 'warning' && <AlertCircle size={16} color="#f59e0b" />}
          {(!toastMessage.type || toastMessage.type === 'info') && <HardDrive size={16} color="#4a90e2" />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};

interface TagsAndColorModalProps {
  doc: DocumentItem;
  onClose: () => void;
  onSave: (tags: string[], color: string | null) => void;
}

const PRESET_TAGS = ['Arbejde', 'Skole', 'Privat', 'Vigtigt', 'Kladde', 'Projekt'];
const COLOR_SWATCHES = [
  { label: 'Standard (Ingen farve)', value: null },
  { label: 'Blå', value: '#4a90e2' },
  { label: 'Grøn', value: '#10b981' },
  { label: 'Orange', value: '#f59e0b' },
  { label: 'Rød', value: '#ef4444' },
  { label: 'Lilla', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Cyan', value: '#06b6d4' },
];

const TagsAndColorModal: React.FC<TagsAndColorModalProps> = ({ doc, onClose, onSave }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(doc.tags || []);
  const [selectedColor, setSelectedColor] = useState<string | null>(doc.color || null);
  const [customTagInput, setCustomTagInput] = useState('');

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags([...selectedTags, trimmed]);
      setCustomTagInput('');
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <h3>Tags og farvekode</h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#aaaaaa' }}>
          Tilpas mærkater og farvekode for &quot;<strong>{doc.title}</strong>&quot;:
        </p>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cccccc', marginBottom: '8px' }}>
            Vælg farvetema:
          </label>
          <div className={styles.colorPalette}>
            {COLOR_SWATCHES.map(swatch => {
              const isActive = selectedColor === swatch.value;
              return (
                <button
                  key={swatch.value ?? 'none'}
                  type="button"
                  className={`${styles.colorSwatch} ${isActive ? styles.activeSwatch : ''}`}
                  style={{
                    backgroundColor: swatch.value || '#242b35',
                    border: isActive ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                  onClick={() => setSelectedColor(swatch.value)}
                  title={swatch.label}
                >
                  {isActive && <Check size={12} color={swatch.value ? '#ffffff' : '#4a90e2'} />}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cccccc', marginBottom: '8px' }}>
            Hurtige tags:
          </label>
          <div className={styles.tagChipsList}>
            {PRESET_TAGS.map(t => {
              const isSelected = selectedTags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={`${styles.tagChip} ${isSelected ? styles.activeTagChip : ''}`}
                  onClick={() => toggleTag(t)}
                  style={{
                    borderColor: isSelected && selectedColor ? selectedColor : undefined,
                    backgroundColor: isSelected && selectedColor ? `${selectedColor}33` : undefined,
                    color: isSelected && selectedColor ? selectedColor : undefined,
                  }}
                >
                  {isSelected && <Check size={11} style={{ marginRight: '4px' }} />}
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cccccc', marginBottom: '8px' }}>
            Tilføj et eget tag:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className={styles.modalInput}
              placeholder="Fx Biologi, Aflevering, Budget..."
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomTag();
                }
              }}
              style={{ flex: 1, margin: 0 }}
            />
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleAddCustomTag}
              disabled={!customTagInput.trim()}
              style={{ whiteSpace: 'nowrap', padding: '0 16px', opacity: customTagInput.trim() ? 1 : 0.6 }}
            >
              Tilføj
            </button>
          </div>
        </div>

        {selectedTags.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#888888', marginBottom: '6px' }}>
              Tildelte tags ({selectedTags.length}):
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selectedTags.map(t => (
                <span
                  key={t}
                  className={styles.selectedTagItem}
                  style={{
                    backgroundColor: selectedColor ? `${selectedColor}22` : 'rgba(255, 255, 255, 0.08)',
                    borderColor: selectedColor ? `${selectedColor}66` : 'rgba(255, 255, 255, 0.2)',
                    color: selectedColor || '#e0e0e0'
                  }}
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => toggleTag(t)}
                    title={`Fjern tag "${t}"`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 6, display: 'inline-flex', color: 'inherit' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.modalButtons} style={{ marginTop: '22px' }}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Annuller
          </button>
          <button className={styles.confirmBtn} onClick={() => onSave(selectedTags, selectedColor)}>
            Gem ændringer
          </button>
        </div>
      </div>
    </div>
  );
};

export default WordDashboard;

