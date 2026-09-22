const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const JSZip = require('jszip');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'docs.json');
const FOLDERS_FILE = path.join(DATA_DIR, 'folders.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'versions.json');

// Mappe til fysiske dokumentfiler i programmet (altid i serverens/projektets 'documents' mappe)
const DOCUMENTS_DIR = path.join(path.dirname(DATA_DIR), 'documents');
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

// Ryd op i eventuelle gamle .html filer, så mappen kun indeholder rene .docx Word-filer
try {
  const existingFiles = fs.readdirSync(DOCUMENTS_DIR);
  for (const f of existingFiles) {
    if (f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm')) {
      try { fs.unlinkSync(path.join(DOCUMENTS_DIR, f)); } catch {}
    }
  }
} catch {}

const sanitizeFilename = (name, fallback = 'Dokument') => {
  if (!name || !name.trim()) return fallback;
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : fallback;
};

const escapeXml = (str) => {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const stripHtmlTags = (str) => {
  return (str || '').replace(/<[^>]*>/g, '').trim();
};

async function createDocxBuffer(title, contentHtml) {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', 
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file('_rels/.rels',
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  const cleanText = (contentHtml || '')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '===H1===$1===END===')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '===H2===$1===END===')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '===H3===$1===END===')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '===P===$1===END===')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '===LI===$1===END===')
    .replace(/<br\s*\/?>/gi, '\n');

  let bodyXml = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${escapeXml(title || 'Dokument')}</w:t></w:r></w:p>`;

  const blocks = cleanText.split('===END===');
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('===H1===')) {
      const text = stripHtmlTags(trimmed.replace('===H1===', ''));
      bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    } else if (trimmed.startsWith('===H2===')) {
      const text = stripHtmlTags(trimmed.replace('===H2===', ''));
      bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    } else if (trimmed.startsWith('===H3===')) {
      const text = stripHtmlTags(trimmed.replace('===H3===', ''));
      bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    } else if (trimmed.startsWith('===LI===')) {
      const text = stripHtmlTags(trimmed.replace('===LI===', ''));
      bodyXml += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">• ${escapeXml(text)}</w:t></w:r></w:p>`;
    } else {
      const text = stripHtmlTags(trimmed.replace('===P===', ''));
      if (text.trim()) {
        bodyXml += `<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
      }
    }
  }

  const documentXml = 
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);
  return await zip.generateAsync({ type: 'nodebuffer' });
}

function createHtmlFileContent(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <title>${escapeXml(title || 'Dokument')}</title>
  <style>
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #f8fafc;
      margin: 0;
      padding: 40px 20px;
    }
    .page {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 60px 70px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    h1.title {
      font-size: 26px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-top: 0;
      color: #0f172a;
    }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; }
    img { max-width: 100%; height: auto; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="page">
    <h1 class="title">${escapeXml(title || 'Dokument')}</h1>
    ${contentHtml || '<p></p>'}
  </div>
</body>
</html>`;
}

async function saveDocumentFilesToDisk(doc) {
  try {
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    }

    const baseName = sanitizeFilename(doc.title || 'Dokument');
    const docxPath = path.join(DOCUMENTS_DIR, `${baseName}.docx`);
    const htmlPath = path.join(DOCUMENTS_DIR, `${baseName}.html`);

    // Slet altid eventuel gammel html fil
    if (fs.existsSync(htmlPath)) {
      try { fs.unlinkSync(htmlPath); } catch {}
    }

    // Slet hvis i papirkurv
    if (doc.inTrash) {
      if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
      return DOCUMENTS_DIR;
    }

    const docxBuffer = await createDocxBuffer(doc.title, doc.content);
    fs.writeFileSync(docxPath, docxBuffer);

    return docxPath;
  } catch (err) {
    console.error('Fejl ved skrivning af dokumentfil til disk:', err);
    return DOCUMENTS_DIR;
  }
}

function removeDocFilesFromDisk(doc) {
  try {
    const baseName = sanitizeFilename(doc.title || 'Dokument');
    const docxPath = path.join(DOCUMENTS_DIR, `${baseName}.docx`);
    const htmlPath = path.join(DOCUMENTS_DIR, `${baseName}.html`);
    if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
  } catch {}
}

const pendingWrites = new Map();
const pendingDocxWrites = new Map();

function queueWrite(filePath, data, pretty = false, delay = 1500) {
  if (pendingWrites.has(filePath)) {
    clearTimeout(pendingWrites.get(filePath).timer);
  }

  const writeFn = async () => {
    try {
      const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
      await fs.promises.writeFile(filePath, content, 'utf8');
      pendingWrites.delete(filePath);
    } catch (err) {
      console.error(`Fejl ved asynkron skrivning til ${filePath}:`, err);
    }
  };

  const timer = setTimeout(writeFn, delay);
  pendingWrites.set(filePath, { timer, writeFn, data, pretty });
}

function queueDocxWrite(doc, delay = 5000) {
  if (pendingDocxWrites.has(doc.id)) {
    clearTimeout(pendingDocxWrites.get(doc.id));
  }
  const timer = setTimeout(() => {
    saveDocumentFilesToDisk(doc);
    pendingDocxWrites.delete(doc.id);
  }, delay);
  pendingDocxWrites.set(doc.id, timer);
}

function flushPendingWrites() {
  for (const [filePath, item] of pendingWrites.entries()) {
    clearTimeout(item.timer);
    try {
      const content = item.pretty ? JSON.stringify(item.data, null, 2) : JSON.stringify(item.data);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[Flush] Synkront gemt ${filePath} ved nedlukning.`);
    } catch (err) {
      console.error(`[Flush] Fejl ved skrivning til ${filePath} under nedlukning:`, err);
    }
  }
  pendingWrites.clear();

  for (const [docId, timer] of pendingDocxWrites.entries()) {
    clearTimeout(timer);
  }
  pendingDocxWrites.clear();
}

// Registrer process exit handlers
process.on('exit', flushPendingWrites);
process.on('SIGINT', () => {
  flushPendingWrites();
  process.exit(0);
});
process.on('SIGTERM', () => {
  flushPendingWrites();
  process.exit(0);
});

async function syncAllDocsToDisk() {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  for (const doc of inMemoryDocs) {
    if (!doc.inTrash) {
      await saveDocumentFilesToDisk(doc);
    } else {
      removeDocFilesFromDisk(doc);
    }
  }
}

function openInFileExplorer(targetPath, isFile = false) {
  return new Promise((resolve) => {
    try {
      const cleanPath = path.resolve(targetPath);
      if (process.platform === 'win32') {
        if (isFile && fs.existsSync(cleanPath)) {
          const child = spawn('explorer.exe', ['/select,', cleanPath], { detached: true, stdio: 'ignore' });
          child.unref();
        } else {
          const dirToOpen = fs.existsSync(cleanPath) ? cleanPath : DOCUMENTS_DIR;
          const child = spawn('explorer.exe', [dirToOpen], { detached: true, stdio: 'ignore' });
          child.unref();
        }
      } else if (process.platform === 'darwin') {
        const cmd = isFile ? `open -R "${cleanPath}"` : `open "${cleanPath}"`;
        exec(cmd, () => {});
      } else {
        const cmd = isFile ? `xdg-open "${path.dirname(cleanPath)}"` : `xdg-open "${cleanPath}"`;
        exec(cmd, () => {});
      }
    } catch (err) {
      console.error('Fejl i openInFileExplorer:', err);
    }
    resolve(true);
  });
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}
if (!fs.existsSync(FOLDERS_FILE)) {
  fs.writeFileSync(FOLDERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(VERSIONS_FILE)) {
  fs.writeFileSync(VERSIONS_FILE, JSON.stringify([]));
}

const readSafeJson = (filePath, fallback = []) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    let data = fs.readFileSync(filePath, 'utf8');
    if (data.charCodeAt(0) === 0xFEFF) {
      data = data.slice(1);
    }
    return JSON.parse(data);
  } catch (error) {
    console.error(`Fejl ved læsning af ${filePath}:`, error);
    return fallback;
  }
};

let inMemoryVersions = null;
const readVersions = () => readSafeJson(VERSIONS_FILE, []);

const writeVersions = (versions) => {
  inMemoryVersions = versions;
  queueWrite(VERSIONS_FILE, versions, false, 1500);
};

let inMemoryDocs = null;
const readDocs = () => readSafeJson(DATA_FILE, []);

const writeDocs = (docs) => {
  inMemoryDocs = docs;
  queueWrite(DATA_FILE, docs, false, 1500);
};

let inMemoryFolders = null;
const readFolders = () => readSafeJson(FOLDERS_FILE, []);

const writeFolders = (folders) => {
  inMemoryFolders = folders;
  queueWrite(FOLDERS_FILE, folders, true, 1500);
};

// ================= FOLDERS API =================

router.get('/folders', (req, res) => {
  if (!inMemoryFolders) inMemoryFolders = readFolders();
  res.json(inMemoryFolders);
});

router.post('/folders', (req, res) => {
  const { id, name, color, parentId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Manglende mappenavn' });
  }

  if (!inMemoryFolders) inMemoryFolders = readFolders();
  const folderId = id || `folder-${Date.now()}`;
  const index = inMemoryFolders.findIndex(f => f.id === folderId);
  const existing = index >= 0 ? inMemoryFolders[index] : {};

  const folder = {
    ...existing,
    id: folderId,
    name: name.trim(),
    color: color || existing.color || '#4a90e2',
    parentId: parentId !== undefined ? parentId : (existing.parentId || null),
    createdAt: existing.createdAt || new Date().toISOString()
  };

  if (index >= 0) inMemoryFolders[index] = folder;
  else inMemoryFolders.push(folder);

  writeFolders(inMemoryFolders);
  res.json({ success: true, folder });
});

router.delete('/folders/:id', (req, res) => {
  const folderId = req.params.id;
  if (!inMemoryFolders) inMemoryFolders = readFolders();
  const folderToDelete = inMemoryFolders.find(f => f.id === folderId);
  const fallbackParentId = folderToDelete ? folderToDelete.parentId || null : null;

  // Move any child subfolders up to the deleted folder's parent
  inMemoryFolders = inMemoryFolders
    .filter(f => f.id !== folderId)
    .map(f => {
      if (f.parentId === folderId) {
        return { ...f, parentId: fallbackParentId };
      }
      return f;
    });
  writeFolders(inMemoryFolders);

  // Move any documents in this folder up to the deleted folder's parent (or null)
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  let hasChanged = false;
  inMemoryDocs = inMemoryDocs.map(d => {
    if (d.folderId === folderId) {
      hasChanged = true;
      return { ...d, folderId: fallbackParentId, updatedAt: new Date().toISOString() };
    }
    return d;
  });
  if (hasChanged) writeDocs(inMemoryDocs);

  res.json({ success: true });
});

// ================= DOCUMENTS API =================

router.get('/docs', (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  if (req.query.meta === '1') {
    // Returner letvægts metadata uden det tunge HTML content til lister og dashboard
    const metaList = inMemoryDocs.map(d => ({
      id: d.id,
      title: d.title,
      thumbnail: d.thumbnail,
      isFavorite: d.isFavorite,
      folderId: d.folderId,
      tags: d.tags,
      color: d.color,
      inTrash: d.inTrash,
      deletedAt: d.deletedAt,
      updatedAt: d.updatedAt,
      isSavedLocally: false,
      content: ''
    }));
    return res.json(metaList);
  }
  res.json(inMemoryDocs);
});

// ================= FILE EXPLORER API =================

// Hent stien til dokumentmappen (SKAL ligge før /docs/:id)
router.get('/docs/folder-path', (req, res) => {
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
  res.json({ folder: DOCUMENTS_DIR });
});

// Åbn dokumentmappen i File Explorer (Stifinder)
router.post('/docs/open-folder', async (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
  await syncAllDocsToDisk();
  await openInFileExplorer(DOCUMENTS_DIR, false);
  res.json({ success: true, folder: DOCUMENTS_DIR });
});

// Åbn mappen og marker et specifikt lokalt dokument i File Explorer (Stifinder)
router.post('/docs/:id/open-in-explorer', async (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
  const doc = inMemoryDocs.find(d => d.id === req.params.id);
  if (!doc) {
    await openInFileExplorer(DOCUMENTS_DIR, false);
    return res.json({ success: true, folder: DOCUMENTS_DIR });
  }

  // Gem hvis lokalt
  const filePath = await saveDocumentFilesToDisk({ ...doc, isSavedLocally: true });
  await openInFileExplorer(filePath, true);
  res.json({ success: true, filePath, folder: DOCUMENTS_DIR });
});

router.get('/docs/:id', (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  const docs = inMemoryDocs;
  const doc = docs.find(d => d.id === req.params.id);
  if (doc) res.json(doc);
  else res.status(404).json({ error: 'Dokument ikke fundet' });
});

router.post('/docs', (req, res) => {
  const { id, title, content, thumbnail, isFavorite, folderId, tags, color, inTrash, deletedAt, isSavedLocally } = req.body;
  
  if (!id) return res.status(400).json({ error: 'Manglende id' });

  if (!inMemoryDocs) inMemoryDocs = readDocs();
  const docs = inMemoryDocs;
  const index = docs.findIndex(d => d.id === id);
  const existingDoc = index >= 0 ? docs[index] : {};

  const doc = {
    ...existingDoc,
    id,
    title: title !== undefined ? title : (existingDoc.title || 'Navnløst dokument'),
    content: content !== undefined ? content : (existingDoc.content || ''),
    thumbnail: thumbnail !== undefined ? thumbnail : (existingDoc.thumbnail || null),
    isFavorite: isFavorite !== undefined ? isFavorite : (existingDoc.isFavorite || false),
    folderId: folderId !== undefined ? folderId : (existingDoc.folderId || null),
    tags: tags !== undefined ? tags : (existingDoc.tags || []),
    color: color !== undefined ? color : (existingDoc.color || null),
    inTrash: inTrash !== undefined ? inTrash : (existingDoc.inTrash || false),
    deletedAt: deletedAt !== undefined ? deletedAt : (existingDoc.deletedAt || null),
    isSavedLocally: false,
    updatedAt: new Date().toISOString()
  };

  if (index >= 0) docs[index] = doc;
  else docs.push(doc);

  writeDocs(docs);
  queueDocxWrite(doc);
  res.json({ success: true, doc });
});

router.post('/docs/:id/move', (req, res) => {
  const { folderId } = req.body;
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  const doc = inMemoryDocs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Dokument ikke fundet' });
  
  doc.folderId = folderId !== undefined ? folderId : null;
  doc.updatedAt = new Date().toISOString();
  writeDocs(inMemoryDocs);
  res.json({ success: true, doc });
});

// Flyt til papirkurv
router.post('/docs/:id/trash', (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  const doc = inMemoryDocs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Dokument ikke fundet' });

  doc.inTrash = true;
  doc.deletedAt = new Date().toISOString();
  doc.updatedAt = new Date().toISOString();
  writeDocs(inMemoryDocs);
  removeDocFilesFromDisk(doc);
  res.json({ success: true, doc });
});

// Gendan fra papirkurv
router.post('/docs/:id/restore', (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  const doc = inMemoryDocs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Dokument ikke fundet' });

  doc.inTrash = false;
  doc.deletedAt = null;
  doc.updatedAt = new Date().toISOString();
  writeDocs(inMemoryDocs);
  saveDocumentFilesToDisk(doc);
  res.json({ success: true, doc });
});

// Duplikér dokument
router.post('/docs/:id/duplicate', (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  const original = inMemoryDocs.find(d => d.id === req.params.id);
  if (!original) return res.status(404).json({ error: 'Dokument ikke fundet' });

  const newId = `doc-${Date.now()}`;
  const duplicate = {
    ...original,
    id: newId,
    title: `${original.title} (Kopi)`,
    isFavorite: false,
    inTrash: false,
    deletedAt: null,
    updatedAt: new Date().toISOString()
  };

  inMemoryDocs.push(duplicate);
  writeDocs(inMemoryDocs);
  saveDocumentFilesToDisk(duplicate);
  res.json({ success: true, doc: duplicate });
});

// Tøm papirkurv
router.delete('/docs/trash/empty', (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  inMemoryDocs.forEach(d => {
    if (d.inTrash) removeDocFilesFromDisk(d);
  });
  inMemoryDocs = inMemoryDocs.filter(d => !d.inTrash);
  writeDocs(inMemoryDocs);
  res.json({ success: true });
});

// Permanent sletning af enkelt dokument
router.delete('/docs/:id', (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  const targetDoc = inMemoryDocs.find(d => d.id === req.params.id);
  if (targetDoc) removeDocFilesFromDisk(targetDoc);

  inMemoryDocs = inMemoryDocs.filter(d => d.id !== req.params.id);
  writeDocs(inMemoryDocs);

  if (!inMemoryVersions) inMemoryVersions = readVersions();
  inMemoryVersions = inMemoryVersions.filter(v => v.docId !== req.params.id);
  writeVersions(inMemoryVersions);

  res.json({ success: true });
});


// ================= VERSIONS API =================

// Hent versionshistorik for et dokument (sorteret nyeste først)
router.get('/docs/:id/versions', (req, res) => {
  const docId = req.params.id;
  if (!inMemoryVersions) inMemoryVersions = readVersions();
  const versions = inMemoryVersions
    .filter(v => v.docId === docId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(versions);
});

// Opret et nyt version snapshot
router.post('/docs/:id/versions', (req, res) => {
  const docId = req.params.id;
  const { title, content, label, wordCount, charCount } = req.body;
  if (!inMemoryVersions) inMemoryVersions = readVersions();

  const newVersion = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    docId,
    title: title || 'Navnløst dokument',
    content: content || '',
    label: label || 'Snapshot',
    wordCount: typeof wordCount === 'number' ? wordCount : 0,
    charCount: typeof charCount === 'number' ? charCount : 0,
    timestamp: new Date().toISOString()
  };

  inMemoryVersions.unshift(newVersion);

  // Bevar op til 20 versioner per dokument for at holde hukommelsen let
  const docVersions = inMemoryVersions.filter(v => v.docId === docId);
  if (docVersions.length > 20) {
    const excessIds = new Set(docVersions.slice(20).map(v => v.id));
    inMemoryVersions = inMemoryVersions.filter(v => !excessIds.has(v.id));
  }
  writeVersions(inMemoryVersions);

  res.json({ success: true, version: newVersion });
});

// Gendan en version
router.post('/docs/:id/versions/:verId/restore', (req, res) => {
  const { id: docId, verId } = req.params;
  if (!inMemoryVersions) inMemoryVersions = readVersions();
  const version = inMemoryVersions.find(v => v.docId === docId && v.id === verId);
  if (!version) return res.status(404).json({ error: 'Version ikke fundet' });

  if (!inMemoryDocs) inMemoryDocs = readDocs();
  const doc = inMemoryDocs.find(d => d.id === docId);
  if (!doc) return res.status(404).json({ error: 'Dokument ikke fundet' });

  // Opdater dokument
  doc.content = version.content;
  doc.title = version.title;
  doc.updatedAt = new Date().toISOString();
  writeDocs(inMemoryDocs);

  // Opret samtidig et snapshot af gendannelsen
  const restoreSnapshot = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    docId,
    title: doc.title,
    content: doc.content,
    label: `Gendannet version`,
    wordCount: version.wordCount,
    charCount: version.charCount,
    timestamp: new Date().toISOString()
  };
  inMemoryVersions.unshift(restoreSnapshot);
  writeVersions(inMemoryVersions);

  res.json({ success: true, doc, version: restoreSnapshot });
});

// Slet en enkelt version
router.delete('/docs/:id/versions/:verId', (req, res) => {
  const { id: docId, verId } = req.params;
  if (!inMemoryVersions) inMemoryVersions = readVersions();
  inMemoryVersions = inMemoryVersions.filter(v => !(v.docId === docId && v.id === verId));
  writeVersions(inMemoryVersions);
  res.json({ success: true });
});

// ================= LANGUAGETOOL PROXY API =================
const normalizeLtUrl = (inputUrl) => {
  if (!inputUrl) return 'http://localhost:8010/v2';
  let url = inputUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/v2')) {
    url = `${url}/v2`;
  }
  return url;
};

router.post('/languagetool/test', async (req, res) => {
  const { url: rawUrl, language } = req.body;
  if (!rawUrl) {
    return res.status(400).json({ success: false, message: 'URL mangler' });
  }

  const normalized = normalizeLtUrl(rawUrl);
  try {
    let targetUrl = `${normalized}/languages`;
    let response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok && !rawUrl.includes('/v2')) {
      const fallbackUrl = `${rawUrl.trim().replace(/\/+$/, '')}/languages`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `LanguageTool server svarede med status ${response.status} (${response.statusText})`
      });
    }

    const languages = await response.json();
    return res.json({
      success: true,
      count: Array.isArray(languages) ? languages.length : 0,
      languages: Array.isArray(languages) ? languages : [],
      normalizedUrl: normalized,
      message: `Forbindelse oprettet! Serveren understøtter ${Array.isArray(languages) ? languages.length : 0} sprog.`
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: `Kunne ikke forbinde til LanguageTool på ${normalized}: ${error.message || 'Ukendt netværksfejl'}`
    });
  }
});

router.post('/languagetool/check', async (req, res) => {
  const { url: rawUrl, text, language = 'da-DK', level = 'default' } = req.body;
  if (!rawUrl || typeof text !== 'string') {
    return res.status(400).json({ error: 'Mangler påkrævede parametre (url og text)' });
  }

  const normalized = normalizeLtUrl(rawUrl);
  const targetUrl = `${normalized}/check`;

  try {
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('language', language);
    if (level && level !== 'default') {
      params.append('level', level);
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `LanguageTool fejl (${response.status}): ${errText || response.statusText}`
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    return res.status(502).json({
      error: `Kunne ikke udføre tjek via LanguageTool (${normalized}): ${error.message}`
    });
  }
});

// ================= BACKUP API =================
router.get('/backup/data', (req, res) => {
  if (!inMemoryDocs) inMemoryDocs = readDocs();
  if (!inMemoryFolders) inMemoryFolders = readFolders();
  if (!inMemoryVersions) inMemoryVersions = readVersions();

  res.json({
    exportDate: new Date().toISOString(),
    version: '1.0',
    documents: inMemoryDocs,
    folders: inMemoryFolders,
    versions: inMemoryVersions,
  });
});

module.exports = router;
