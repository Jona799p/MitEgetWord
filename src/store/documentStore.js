export const DEFAULT_SERVER_URL = 'http://100.126.133.31:3000';

// Denne funktion henter serverens IP-adresse fra localStorage (indstillet af brugeren)
export const getServerUrl = () => {
  const saved = localStorage.getItem('mitEgetWord_serverUrl');
  if (!saved || saved === 'http://localhost:3000' || saved === 'http://127.0.0.1:3000') {
    return DEFAULT_SERVER_URL;
  }
  return saved;
};

export const setServerUrl = (url) => {
  localStorage.setItem('mitEgetWord_serverUrl', url);
  if (typeof window !== 'undefined' && window.require) {
    try {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('set-update-url', url);
    } catch {}
  }
};

export const checkServerStatus = async () => {
  try {
    const res = await fetch(`${getServerUrl()}/api/server-info`, { method: 'GET', signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
};

export const LOCAL_DOCS_KEY = 'mitEgetWord_local_docs';
export const SYNC_QUEUE_KEY = 'mitEgetWord_sync_queue';
export const SERVER_CACHE_KEY = 'mitEgetWord_server_cache_docs';

let inMemoryLocalDocs = null;
let inMemoryServerCache = null;

export const safeSetServerCache = (docs) => {
  if (!Array.isArray(docs)) return;
  inMemoryServerCache = docs;
  try {
    // Preserve metadata, titles and preview snippets while keeping localStorage write super fast (sub-millisecond)
    const lightweight = docs.map(d => {
      if (d.content && d.content.length > 2000) {
        return { ...d, content: d.content.slice(0, 2000) };
      }
      return d;
    });
    localStorage.setItem(SERVER_CACHE_KEY, JSON.stringify(lightweight));
  } catch (err) {
    try {
      const minimal = docs.map(({ id, title, folderId, updatedAt, isFavorite, tags, color, inTrash, isSavedLocally }) => ({
        id, title, folderId, updatedAt, isFavorite, tags, color, inTrash, isSavedLocally, content: ''
      }));
      localStorage.setItem(SERVER_CACHE_KEY, JSON.stringify(minimal));
    } catch {}
  }
};

export const getServerCache = () => {
  if (inMemoryServerCache !== null) return inMemoryServerCache;
  try {
    inMemoryServerCache = JSON.parse(localStorage.getItem(SERVER_CACHE_KEY) || '[]');
    return inMemoryServerCache;
  } catch {
    return [];
  }
};

export const getLocalDocs = () => {
  if (inMemoryLocalDocs !== null) return inMemoryLocalDocs;
  try {
    inMemoryLocalDocs = JSON.parse(localStorage.getItem(LOCAL_DOCS_KEY) || '[]');
    return inMemoryLocalDocs;
  } catch {
    return [];
  }
};

export const setLocalDocs = (docs) => {
  inMemoryLocalDocs = docs;
  try {
    localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs));
  } catch (err) {
    console.warn('Kunne ikke gemme lokale dokumenter i localStorage:', err);
  }
};

export const getSyncQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const addToSyncQueue = (id) => {
  try {
    const queue = getSyncQueue();
    if (!queue.includes(id)) {
      queue.push(id);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {}
};

export const removeFromSyncQueue = (id) => {
  try {
    const queue = getSyncQueue().filter(item => item !== id);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

export const getElectron = () => {
  if (typeof window !== 'undefined' && window.require) {
    try {
      return window.require('electron');
    } catch {}
  }
  return null;
};

let cachedLocalDocsDir = null;

const recentlyDeletedTitles = new Set();

export const markTitleAsDeleted = (title) => {
  if (title) {
    recentlyDeletedTitles.add(title.toLowerCase().trim());
    setTimeout(() => {
      recentlyDeletedTitles.delete(title.toLowerCase().trim());
    }, 60000);
  }
};

export const isTitleRecentlyDeleted = (title) => {
  if (!title) return false;
  return recentlyDeletedTitles.has(title.toLowerCase().trim());
};

export const resolveLocalDocumentsDir = () => {
  if (cachedLocalDocsDir) return cachedLocalDocsDir;
  if (typeof window !== 'undefined' && window.require) {
    try {
      const path = window.require('path');
      const os = window.require('os');
      const fs = window.require('fs');
      // Sikker lokal mappe pr. pc helt uden for OneDrive (AppData/Local eller AppData/Roaming)
      const userProfile = (window.process && window.process.env && window.process.env.USERPROFILE) || os.homedir();
      const localAppData = (window.process && window.process.env && window.process.env.LOCALAPPDATA) || path.join(userProfile, 'AppData', 'Local');
      const candidates = [
        path.join(userProfile, 'AppData', 'Roaming', 'MitEgetWord', 'documents'),
        path.join(localAppData, 'MitEgetWord', 'documents'),
        path.join(userProfile, 'MitEgetWord', 'documents')
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          cachedLocalDocsDir = cand;
          return cand;
        }
      }
      const target = candidates[0];
      try {
        if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
        cachedLocalDocsDir = target;
        return target;
      } catch {}
      return candidates[1];
    } catch {}
  }
  return null;
};

export const resolveLocalDocumentsDirAsync = async () => {
  const electron = getElectron();
  if (electron?.ipcRenderer?.invoke) {
    try {
      const dir = await electron.ipcRenderer.invoke('get-documents-dir');
      if (dir) {
        cachedLocalDocsDir = dir;
        return dir;
      }
    } catch {}
  }
  return resolveLocalDocumentsDir();
};

export const saveDocumentLocallyToDisk = async (doc, oldTitle = null) => {
  if (doc?.title && isTitleRecentlyDeleted(doc.title)) {
    return { success: false, reason: 'recently_deleted' };
  }
  const electron = getElectron();
  if (electron?.ipcRenderer?.invoke) {
    try {
      const res = await electron.ipcRenderer.invoke('save-local-document', {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        oldTitle: oldTitle && oldTitle !== doc.title ? oldTitle : undefined
      });
      return res;
    } catch (err) {
      console.warn('IPC save-local-document fejlede:', err);
    }
  }
  return { success: false };
};

export const deleteDocumentFromDisk = async (title) => {
  const electron = getElectron();
  if (electron?.ipcRenderer?.invoke) {
    try {
      return await electron.ipcRenderer.invoke('delete-local-document', { title });
    } catch (err) {
      console.warn('IPC delete-local-document fejlede:', err);
    }
  }
  return { success: false };
};

export const listDiskDocuments = async () => {
  const electron = getElectron();
  if (electron?.ipcRenderer?.invoke) {
    try {
      const res = await electron.ipcRenderer.invoke('list-local-files');
      if (res && res.success && Array.isArray(res.files)) {
        return res.files;
      }
    } catch (e) {
      console.warn('Fejl ved scanning af lokale filer:', e);
    }
  }
  return [];
};

export const cleanupLocalHtmlFiles = () => {
  if (typeof window !== 'undefined' && window.require) {
    try {
      const path = window.require('path');
      const fs = window.require('fs');
      const docsDir = resolveLocalDocumentsDir();
      if (docsDir && fs.existsSync(docsDir)) {
        const files = fs.readdirSync(docsDir);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.html') || file.toLowerCase().endsWith('.htm')) {
            try { fs.unlinkSync(path.join(docsDir, file)); } catch {}
          }
        }
      }
    } catch {}
  }
};

export const getLocalDocumentsCount = () => {
  cleanupLocalHtmlFiles();
  const local = getLocalDocs();
  return local.filter(d => !d.inTrash && (d.isSavedLocally || d.syncStatus === 'pending_upload')).length;
};

export const getDocuments = async (options = {}) => {
  cleanupLocalHtmlFiles();
  const localDocs = getLocalDocs();
  let serverDocs = null;

  try {
    const query = options.includeContent ? '' : '?meta=1';
    const res = await fetch(`${getServerUrl()}/api/docs${query}`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      serverDocs = await res.json();
      if (Array.isArray(serverDocs)) {
        safeSetServerCache(serverDocs);
      }
    }
  } catch (error) {
    console.warn('Kunne ikke hente dokumenter fra server (offline eller utilgængelig):', error);
  }

  // Hvis serveren er online og returnerede dokumenter
  if (Array.isArray(serverDocs)) {
    const localMap = new Map(localDocs.map(d => [d.id, d]));
    const syncQueue = new Set(getSyncQueue());

    const merged = serverDocs.map(serverDoc => {
      const localDoc = localMap.get(serverDoc.id);
      if (localDoc) {
        localMap.delete(serverDoc.id);
        // Hvis lokalt dokument afventer synkronisering, behold de lokale offline ændringer
        if (syncQueue.has(localDoc.id) || localDoc.syncStatus === 'pending_upload') {
          return {
            ...localDoc,
            syncStatus: 'pending_upload'
          };
        }
        // Ellers brug nyeste data fra server, men bevar isSavedLocally-flaget
        return {
          ...serverDoc,
          isSavedLocally: localDoc.isSavedLocally ?? serverDoc.isSavedLocally ?? false,
          syncStatus: 'synced'
        };
      }
      return {
        ...serverDoc,
        isSavedLocally: serverDoc.isSavedLocally ?? false,
        syncStatus: 'synced'
      };
    });

    // Tilføj dokumenter der er oprettet offline og kun eksisterer lokalt
    for (const [, localDoc] of localMap.entries()) {
      merged.unshift(localDoc);
    }

    // Opdater den lokale backup for dokumenter gemt lokalt
    const updatedLocals = merged.filter(d => !!d.isSavedLocally || d.syncStatus === 'pending_upload');
    setLocalDocs(updatedLocals);

    return merged;
  }

  // Offline Fallback: Serveren er nede eller enheden er offline
  let cachedDocs = [];
  try {
    cachedDocs = JSON.parse(localStorage.getItem(SERVER_CACHE_KEY) || '[]');
  } catch {}

  const mergedOfflineMap = new Map();
  cachedDocs.forEach(d => mergedOfflineMap.set(d.id, d));
  localDocs.forEach(d => mergedOfflineMap.set(d.id, d));

  return Array.from(mergedOfflineMap.values());
};

export const getDocument = async (id) => {
  const localDocs = getLocalDocs();
  const localDoc = localDocs.find(d => d.id === id);

  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${id}`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const serverDoc = await res.json();
      if (localDoc && (localDoc.syncStatus === 'pending_upload')) {
        return localDoc;
      }
      return {
        ...serverDoc,
        isSavedLocally: localDoc ? !!localDoc.isSavedLocally : !!serverDoc.isSavedLocally,
        syncStatus: 'synced'
      };
    }
  } catch (error) {
    console.warn('Fejl ved hentning af dokument fra server, bruger lokal kopi:', error);
  }

  if (localDoc) return localDoc;

  try {
    const cachedDocs = JSON.parse(localStorage.getItem(SERVER_CACHE_KEY) || '[]');
    const cached = cachedDocs.find(d => d.id === id);
    if (cached) return cached;
  } catch {}

  return null;
};

const LOCAL_FOLDERS_KEY = 'mitEgetWord_local_folders';
const getLocalFolders = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FOLDERS_KEY) || '[]');
  } catch {
    return [];
  }
};
const setLocalFolders = (folders) => {
  try {
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  } catch {}
};

export const getFolders = async () => {
  try {
    const res = await fetch(`${getServerUrl()}/api/folders`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        setLocalFolders(data);
        return data;
      }
    }
  } catch (error) {
    console.warn('Kunne ikke hente mapper fra server, henter lokale:', error);
  }
  return getLocalFolders();
};

export const createFolder = async (name, color = '#4a90e2', parentId = null) => {
  const newFolder = {
    id: `folder-${Date.now()}`,
    name: name.trim(),
    color,
    parentId,
    createdAt: new Date().toISOString()
  };

  try {
    const res = await fetch(`${getServerUrl()}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, parentId })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.folder) {
        const local = getLocalFolders().filter(f => f.id !== data.folder.id);
        local.push(data.folder);
        setLocalFolders(local);
        return data.folder;
      }
    }
  } catch (error) {
    console.warn('Fejl ved oprettelse af mappe på server, gemmer lokalt:', error);
  }

  // Fallback so it is never lost or blocked
  const local = getLocalFolders().filter(f => f.id !== newFolder.id);
  local.push(newFolder);
  setLocalFolders(local);
  return newFolder;
};

export const renameFolder = async (id, newName) => {
  try {
    const res = await fetch(`${getServerUrl()}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newName })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.folder) {
        const local = getLocalFolders().map(f => f.id === id ? data.folder : f);
        setLocalFolders(local);
        return data.folder;
      }
    }
  } catch (error) {
    console.warn('Fejl ved omdøbning af mappe på server, omdøber lokalt:', error);
  }

  const local = getLocalFolders();
  const index = local.findIndex(f => f.id === id);
  if (index >= 0) {
    local[index].name = newName;
    setLocalFolders(local);
    return local[index];
  }
  return { id, name: newName };
};

export const deleteFolder = async (id) => {
  try {
    await fetch(`${getServerUrl()}/api/folders/${id}`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.warn('Kunne ikke slette mappe på server, sletter lokalt:', error);
  }

  const local = getLocalFolders().filter(f => f.id !== id);
  setLocalFolders(local);
  return true;
};

export const moveDocumentToFolder = async (docId, folderId) => {
  // 1. Opdater omgående det lokale cache og lokale dokumenter så UI og næste saves med det samme kender mappen
  try {
    const currentCached = JSON.parse(localStorage.getItem(SERVER_CACHE_KEY) || '[]');
    const nextCached = currentCached.map(d => d.id === docId ? { ...d, folderId, updatedAt: new Date().toISOString() } : d);
    safeSetServerCache(nextCached);
  } catch {}

  const currentLocals = getLocalDocs();
  const nextLocals = currentLocals.map(d => d.id === docId ? { ...d, folderId, updatedAt: new Date().toISOString() } : d);
  setLocalDocs(nextLocals);

  // 2. Send ændringen til serveren
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${docId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error('Kunne ikke flytte dokument');
    const data = await res.json();
    if (data && data.doc) {
      try {
        const currentCached = JSON.parse(localStorage.getItem(SERVER_CACHE_KEY) || '[]');
        safeSetServerCache(currentCached.map(d => d.id === docId ? { ...data.doc } : d));
      } catch {}
      return data.doc;
    }
  } catch (error) {
    console.warn('Fejl ved flytning af dokument på server (opdateret lokalt):', error);
  }
  return { id: docId, folderId };
};

export const saveDocument = async (id, title, content, thumbnail, isFavorite, folderId, tags, color, inTrash, deletedAt, isSavedLocally) => {
  const localDocs = getLocalDocs();
  const cachedDocs = getServerCache();

  const existingLocal = localDocs.find(d => d.id === id);
  const existingCached = cachedDocs.find(d => d.id === id);
  const existing = existingLocal || existingCached || {};
  const existingIndex = localDocs.findIndex(d => d.id === id);

  const docIsSavedLocally = isSavedLocally !== undefined ? isSavedLocally : (existing.isSavedLocally ?? false);

  // Bevar altid eksisterende værdier hvis intet specifikt sendes (undefined)
  const resolvedFolderId = folderId !== undefined ? folderId : (existing.folderId !== undefined ? existing.folderId : null);
  const resolvedFavorite = isFavorite !== undefined ? isFavorite : (existing.isFavorite ?? false);
  const resolvedTags = tags !== undefined ? tags : (existing.tags || []);
  const resolvedColor = color !== undefined ? color : (existing.color || null);
  const resolvedInTrash = inTrash !== undefined ? inTrash : (existing.inTrash ?? false);
  const resolvedDeletedAt = deletedAt !== undefined ? deletedAt : (existing.deletedAt || null);

  const docToSave = {
    ...existing,
    id,
    title: title !== undefined ? title : (existing.title || 'Navnløst dokument'),
    content: content !== undefined ? content : (existing.content || ''),
    thumbnail: thumbnail !== undefined ? thumbnail : (existing.thumbnail || null),
    isFavorite: resolvedFavorite,
    folderId: resolvedFolderId,
    tags: resolvedTags,
    color: resolvedColor,
    inTrash: resolvedInTrash,
    deletedAt: resolvedDeletedAt,
    isSavedLocally: docIsSavedLocally,
    updatedAt: new Date().toISOString()
  };

  // Gem altid straks i in-memory cache og lokalt hvis relevant så data aldrig mistes
  if (docIsSavedLocally || existingIndex >= 0) {
    const nextLocals = [...localDocs];
    if (existingIndex >= 0) {
      nextLocals[existingIndex] = docToSave;
    } else {
      nextLocals.unshift(docToSave);
    }
    setLocalDocs(nextLocals);
  }

  // Opdater hurtigt in-memory server cache
  const nextCached = cachedDocs.some(d => d.id === id)
    ? cachedDocs.map(d => d.id === id ? { ...d, ...docToSave } : d)
    : [docToSave, ...cachedDocs];
  safeSetServerCache(nextCached);

  // Hvis dokumentet er gemt lokalt, gem det fysisk på computerens disk som en ægte .docx fil
  if (docIsSavedLocally && !docToSave.inTrash) {
    saveDocumentLocallyToDisk(docToSave, existing.title).catch(err => {
      console.warn('Fejl ved skrivning af lokal fil til disk:', err);
    });
  } else if (docToSave.inTrash && existing.isSavedLocally) {
    deleteDocumentFromDisk(docToSave.title || existing.title).catch(() => {});
  }

  // Prøv at sende til serveren
  try {
    const body = {
      id: docToSave.id,
      title: docToSave.title,
      content: docToSave.content,
      thumbnail: docToSave.thumbnail,
      isFavorite: docToSave.isFavorite,
      folderId: docToSave.folderId,
      tags: docToSave.tags,
      color: docToSave.color,
      inTrash: docToSave.inTrash,
      deletedAt: docToSave.deletedAt,
      isSavedLocally: docToSave.isSavedLocally
    };

    const res = await fetch(`${getServerUrl()}/api/docs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });

    if (res.ok) {
      const data = await res.json();
      removeFromSyncQueue(id);
      const syncedDoc = {
        ...data.doc,
        isSavedLocally: docToSave.isSavedLocally,
        syncStatus: 'synced'
      };

      if (docToSave.isSavedLocally) {
        const refreshedLocals = getLocalDocs().map(d => d.id === id ? syncedDoc : d);
        if (!refreshedLocals.some(d => d.id === id)) {
          refreshedLocals.unshift(syncedDoc);
        }
        setLocalDocs(refreshedLocals);
      }

      const currentCached = getServerCache();
      const updatedCached = currentCached.some(d => d.id === id)
        ? currentCached.map(d => d.id === id ? syncedDoc : d)
        : [syncedDoc, ...currentCached];
      safeSetServerCache(updatedCached);

      return syncedDoc;
    }
  } catch (error) {
    console.warn('Server utilgængelig under gemning, dokument gemt lokalt og afventer synkronisering:', error);
  }

  // Server utilgængelig / offline: marker som afventer synkronisering
  docToSave.syncStatus = 'pending_upload';
  addToSyncQueue(id);

  const currentLocals = getLocalDocs();
  const idx = currentLocals.findIndex(d => d.id === id);
  if (idx >= 0) {
    currentLocals[idx] = docToSave;
  } else {
    currentLocals.unshift(docToSave);
  }
  setLocalDocs(currentLocals);

  return docToSave;
};

export const createDocument = async (title = 'Navnløst dokument', content = '<p></p>', folderId = null, tags = [], color = null, isSavedLocally = false) => {
  const newId = `doc-${Date.now()}`;
  return await saveDocument(newId, title, content, null, false, folderId, tags, color, false, null, isSavedLocally);
};

export const toggleSaveLocally = async (id, forceState) => {
  const doc = await getDocument(id);
  if (!doc) return null;

  const newIsSaved = forceState !== undefined ? forceState : !doc.isSavedLocally;
  const localDocs = getLocalDocs();

  if (newIsSaved) {
    const updated = {
      ...doc,
      isSavedLocally: true,
      syncStatus: doc.syncStatus || 'synced'
    };
    const nextLocals = localDocs.filter(d => d.id !== id);
    nextLocals.unshift(updated);
    setLocalDocs(nextLocals);

    // Gem dokumentet fysisk på disken i den lokale Dokumenter/MitEgetWord mappe som .docx
    try {
      await saveDocumentLocallyToDisk(updated);
    } catch (e) {
      console.warn('Kunne ikke skrive lokal fil til disk:', e);
    }

    try {
      await fetch(`${getServerUrl()}/api/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, title: doc.title, content: doc.content, isSavedLocally: true }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {}

    return updated;
  } else {
    const nextLocals = localDocs.filter(d => d.id !== id);
    setLocalDocs(nextLocals);
    removeFromSyncQueue(id);

    // Slet fysisk fra disken
    try {
      await deleteDocumentFromDisk(doc.title);
    } catch (e) {
      console.warn('Kunne ikke fjerne lokal fil fra disk:', e);
    }

    try {
      await fetch(`${getServerUrl()}/api/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, isSavedLocally: false }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {}

    return { ...doc, isSavedLocally: false };
  }
};

export const syncPendingDocumentsToServer = async () => {
  const isOnline = await checkServerStatus();
  if (!isOnline) {
    return { synced: 0, pending: getSyncQueue().length, online: false };
  }

  const localDocs = getLocalDocs();
  const queue = new Set(getSyncQueue());
  const pendingDocs = localDocs.filter(d => queue.has(d.id) || d.syncStatus === 'pending_upload');

  if (pendingDocs.length === 0) {
    return { synced: 0, pending: 0, online: true };
  }

  let syncedCount = 0;
  for (const doc of pendingDocs) {
    try {
      const res = await fetch(`${getServerUrl()}/api/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          thumbnail: doc.thumbnail,
          isFavorite: doc.isFavorite,
          folderId: doc.folderId,
          tags: doc.tags,
          color: doc.color,
          inTrash: doc.inTrash,
          deletedAt: doc.deletedAt,
          isSavedLocally: doc.isSavedLocally ?? true
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (res.ok) {
        removeFromSyncQueue(doc.id);
        doc.syncStatus = 'synced';
        syncedCount++;
      }
    } catch (err) {
      console.warn(`Kunne ikke synkronisere dokument ${doc.id}:`, err);
    }
  }

  setLocalDocs(localDocs);
  return { synced: syncedCount, pending: getSyncQueue().length, online: true };
};

export const duplicateDocument = async (id) => {
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${id}/duplicate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Kunne ikke duplikere dokument');
    const data = await res.json();
    return data.doc;
  } catch (error) {
    console.error('Fejl ved duplikering af dokument:', error);
    // Fallback: manual copy
    const orig = await getDocument(id);
    if (orig) {
      return await createDocument(`${orig.title || 'Dokument'} (Kopi)`, orig.content, orig.folderId, orig.tags || [], orig.color);
    }
    throw error;
  }
};

export const moveToTrash = async (id) => {
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${id}/trash`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Kunne ikke flytte til papirkurv');
    const data = await res.json();
    return data.doc;
  } catch (error) {
    console.error('Fejl ved flytning til papirkurv:', error);
    return await saveDocument(id, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true, new Date().toISOString());
  }
};

export const restoreDocument = async (id) => {
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${id}/restore`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Kunne ikke gendanne dokument');
    const data = await res.json();
    return data.doc;
  } catch (error) {
    console.error('Fejl ved gendannelse:', error);
    return await saveDocument(id, undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, null);
  }
};

export const emptyTrash = async () => {
  try {
    const all = [...getLocalDocs(), ...getServerCache()];
    const trashDocs = all.filter(d => d.inTrash);
    for (const d of trashDocs) {
      if (d.title) {
        markTitleAsDeleted(d.title);
        deleteDocumentFromDisk(d.title).catch(() => {});
      }
    }
    const res = await fetch(`${getServerUrl()}/api/docs/trash/empty`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Kunne ikke tømme papirkurv');
    return true;
  } catch (error) {
    console.error('Fejl ved tømning af papirkurv:', error);
    return false;
  }
};

export const updateDocumentTags = async (id, tags, color) => {
  return await saveDocument(id, undefined, undefined, undefined, undefined, undefined, tags, color);
};

export const renameDocument = async (id, newTitle) => {
  return await saveDocument(id, newTitle, undefined, undefined);
};

export const deleteDocument = async (id, title = null) => {
  try {
    let docTitle = title;
    if (!docTitle) {
      const all = [...getLocalDocs(), ...getServerCache()];
      const found = all.find(d => d.id === id);
      if (found?.title) docTitle = found.title;
    }

    if (docTitle) {
      markTitleAsDeleted(docTitle);
      try {
        await deleteDocumentFromDisk(docTitle);
      } catch (e) {
        console.warn('Kunne ikke fjerne lokal diskfil ved sletning:', e);
      }
    }

    localStorage.removeItem(`word_doc_versions_${id}`);
    removeFromSyncQueue(id);
    const local = getLocalDocs().filter(d => d.id !== id);
    setLocalDocs(local);

    // Rens også fra server fallback cache
    try {
      const cached = JSON.parse(localStorage.getItem(SERVER_CACHE_KEY) || '[]');
      const filteredCached = cached.filter(d => d.id !== id);
      localStorage.setItem(SERVER_CACHE_KEY, JSON.stringify(filteredCached));
    } catch {}

    const res = await fetch(`${getServerUrl()}/api/docs/${id}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(4000)
    });
    return res.ok;
  } catch (error) {
    console.warn('Fejl ved sletning af dokument på server (slettet lokalt):', error);
    return true;
  }
};

export const toggleFavorite = async (id) => {
  try {
    const doc = await getDocument(id);
    if (doc) {
      const updated = await saveDocument(id, doc.title, doc.content, doc.thumbnail, !doc.isFavorite, doc.folderId);
      return updated;
    }
    return null;
  } catch (error) {
    console.error('Fejl ved favorisering:', error);
    return null;
  }
};

export const openDocumentInExplorer = async (docId, docData = null) => {
  // 1. Direct Electron handling
  const electron = getElectron();
  if (electron?.ipcRenderer?.invoke) {
    try {
      let targetDoc = docData;
      if (!targetDoc) {
        targetDoc = await getDocument(docId);
      }

      // Sørg for at den lokale .docx fil findes og er opdateret på disken
      let targetFilePath = null;
      if (targetDoc) {
        if (targetDoc.isSavedLocally) {
          const saveRes = await saveDocumentLocallyToDisk(targetDoc);
          if (saveRes && saveRes.filePath) {
            targetFilePath = saveRes.filePath;
          }
        }

        if (!targetFilePath) {
          const docsDir = await resolveLocalDocumentsDirAsync();
          const sanitize = (name) => (name || 'Dokument').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'Dokument';
          const baseName = sanitize(targetDoc.title);
          if (docsDir) {
            targetFilePath = `${docsDir}\\${baseName}.docx`;
          }
        }
      }

      const docsDir = await resolveLocalDocumentsDirAsync();
      const res = await electron.ipcRenderer.invoke('open-item-in-explorer', targetFilePath || docsDir);
      if (res && res.success) {
        return { success: true, filePath: res.path || targetFilePath || docsDir };
      }
    } catch (e) {
      console.warn('Fejl ved åbning i File Explorer via Electron:', e);
    }
  }

  // 2. Server API fallback
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${docId}/open-in-explorer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Kunne ikke åbne dokument i File Explorer via server:', err);
  }

  return { success: false };
};

export const openDocumentInSystem = async (docId, docData = null) => {
  const electron = getElectron();
  if (electron?.ipcRenderer?.invoke) {
    try {
      let targetDoc = docData;
      if (!targetDoc) {
        targetDoc = await getDocument(docId);
      }
      if (targetDoc) {
        const saveRes = await saveDocumentLocallyToDisk(targetDoc);
        if (saveRes && saveRes.filePath) {
          return await electron.ipcRenderer.invoke('open-file-in-system', saveRes.filePath);
        }
      }
    } catch (e) {
      console.warn('Fejl ved åbning i eksternt program via Electron:', e);
    }
  }
  return { success: false };
};

export const openDocumentsFolderInExplorer = async () => {
  // 1. Direct Electron handling
  const electron = getElectron();
  if (electron?.ipcRenderer?.invoke) {
    try {
      const res = await electron.ipcRenderer.invoke('open-documents-folder');
      if (res && res.success) {
        return { success: true, folder: res.folder };
      }
    } catch (e) {
      console.warn('Fejl ved åbning af mappe via Electron:', e);
    }
  }

  // 2. Server API fallback
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/open-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Kunne ikke åbne dokumentmappe i File Explorer via server:', err);
  }

  return { success: false };
};

// ================= VERSIONS STORE =================

const getLocalVersions = (docId) => {
  try {
    const raw = localStorage.getItem(`word_doc_versions_${docId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setLocalVersions = (docId, versions) => {
  try {
    localStorage.setItem(`word_doc_versions_${docId}`, JSON.stringify(versions));
  } catch (err) {
    console.warn('Kunne ikke gemme versioner i localStorage:', err);
  }
};

export const getDocumentVersions = async (docId) => {
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${docId}/versions`);
    if (res.ok) {
      const versions = await res.json();
      if (Array.isArray(versions)) {
        setLocalVersions(docId, versions);
        return versions;
      }
    }
  } catch (error) {
    console.warn('Fejl ved hentning af versioner fra server, bruger lokal historik:', error);
  }
  return getLocalVersions(docId);
};

export const createVersionSnapshot = async (docId, title, content, label = 'Snapshot', wordCount = 0, charCount = 0) => {
  const newVer = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    docId,
    title: title || 'Navnløst dokument',
    content: content || '',
    label,
    wordCount,
    charCount,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${docId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, label, wordCount, charCount })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        const local = getLocalVersions(docId);
        setLocalVersions(docId, [data.version, ...local.filter(v => v.id !== data.version.id)].slice(0, 50));
        return data.version;
      }
    }
  } catch (error) {
    console.warn('Fejl ved oprettelse af version på server, gemmer lokalt:', error);
  }

  // Fallback to local storage
  const local = getLocalVersions(docId);
  const updated = [newVer, ...local].slice(0, 50);
  setLocalVersions(docId, updated);
  return newVer;
};

export const restoreDocumentVersion = async (docId, verId) => {
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/${docId}/versions/${verId}/restore`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.doc) {
        return data.doc;
      }
    }
  } catch (error) {
    console.warn('Fejl ved gendannelse af version på server:', error);
  }

  // Fallback: restore from local versions
  const local = getLocalVersions(docId);
  const targetVer = local.find(v => v.id === verId);
  if (targetVer) {
    return await saveDocument(docId, targetVer.title, targetVer.content);
  }
  return null;
};

export const deleteDocumentVersion = async (docId, verId) => {
  try {
    await fetch(`${getServerUrl()}/api/docs/${docId}/versions/${verId}`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.warn('Fejl ved sletning af version på server:', error);
  }
  const local = getLocalVersions(docId).filter(v => v.id !== verId);
  setLocalVersions(docId, local);
  return true;
};

export const getDocumentsFolderPath = async () => {
  try {
    const res = await fetch(`${getServerUrl()}/api/docs/folder-path`);
    if (res.ok) {
      const data = await res.json();
      return data.folder || null;
    }
  } catch {}
  return null;
};




