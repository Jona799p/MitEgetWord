import JSZip from 'jszip';
import { DocumentItem, FolderItem } from './WordDashboard';

// Rens filnavne for ugyldige tegn på tværs af Windows/Mac/Linux
const sanitizeName = (name: string, fallback = 'Dokument'): string => {
  if (!name || !name.trim()) return fallback;
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 100) : fallback;
};

// Generer pæn og selvstændig HTML-visning til backup
const wrapHtmlDocument = (title: string, contentHtml: string): string => {
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(title)}</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #f7f9fa;
      margin: 0;
      padding: 40px 20px;
    }
    .page-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 60px 70px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border-radius: 8px;
    }
    h1.doc-title {
      font-size: 28px;
      margin-top: 0;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
      color: #0f172a;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 600;
    }
    blockquote {
      border-left: 4px solid #3b82f6;
      margin: 16px 0;
      padding-left: 16px;
      color: #475569;
      font-style: italic;
    }
    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .page-container {
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <h1 class="doc-title">${escapeXml(title)}</h1>
    <div class="doc-body">
      ${contentHtml || '<p><em>(Tomt dokument)</em></p>'}
    </div>
  </div>
</body>
</html>`;
};

const escapeXml = (unsafe: string): string => {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

/**
 * Eksporterer alle mapper og dokumenter til en struktureret .zip backup
 */
export const exportAllAsZip = async (
  documents: DocumentItem[],
  folders: FolderItem[] = []
): Promise<{ success: boolean; filename: string; totalDocs: number }> => {
  const zip = new JSZip();

  // Opbyg stier for mapper
  const folderPathMap = new Map<string, string>();

  const getFolderPath = (folderId: string): string => {
    if (folderPathMap.has(folderId)) return folderPathMap.get(folderId)!;

    const parts: string[] = [];
    let curr: FolderItem | undefined = folders.find(f => f.id === folderId);
    const visited = new Set<string>();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      parts.unshift(sanitizeName(curr.name, 'Mappe'));
      if (!curr.parentId) break;
      curr = folders.find(f => f.id === curr!.parentId);
    }

    const fullPath = parts.join('/');
    folderPathMap.set(folderId, fullPath);
    return fullPath;
  };

  // Opret mapper i zip
  folders.forEach(folder => {
    const path = getFolderPath(folder.id);
    if (path) {
      zip.folder(path);
    }
  });

  // Hold styr på filnavne for at forhindre overskrivning ved identiske navne i samme mappe
  const usedPaths = new Set<string>();

  const getUniquePath = (dir: string, baseName: string, ext: string): string => {
    const cleanBase = sanitizeName(baseName);
    let candidate = dir ? `${dir}/${cleanBase}.${ext}` : `${cleanBase}.${ext}`;
    let counter = 1;
    while (usedPaths.has(candidate.toLowerCase())) {
      candidate = dir 
        ? `${dir}/${cleanBase} (${counter}).${ext}` 
        : `${cleanBase} (${counter}).${ext}`;
      counter++;
    }
    usedPaths.add(candidate.toLowerCase());
    return candidate;
  };

  // Tilføj aktive dokumenter og trashede dokumenter
  documents.forEach(doc => {
    let dir = '';
    if (doc.inTrash) {
      dir = '_Papirkurv';
    } else if (doc.folderId) {
      dir = getFolderPath(doc.folderId);
    }

    const title = doc.title || 'Navnløst dokument';
    const filePath = getUniquePath(dir, title, 'html');
    const htmlContent = wrapHtmlDocument(title, doc.content);

    zip.file(filePath, htmlContent);
  });

  // Tilføj en rå JSON manifest fil for 100% trofast backup af metadata
  const manifest = {
    exportedAt: new Date().toISOString(),
    generator: 'MitEgetWord v1.0',
    totalDocuments: documents.length,
    activeDocumentsCount: documents.filter(d => !d.inTrash).length,
    trashedDocumentsCount: documents.filter(d => !!d.inTrash).length,
    totalFolders: folders.length,
    folders: folders.map(f => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId || null,
      createdAt: f.createdAt,
    })),
    documents: documents.map(d => ({
      id: d.id,
      title: d.title,
      folderId: d.folderId || null,
      tags: d.tags || [],
      color: d.color || null,
      isFavorite: !!d.isFavorite,
      inTrash: !!d.inTrash,
      deletedAt: d.deletedAt || null,
      updatedAt: d.updatedAt,
      contentLength: (d.content || '').length,
    })),
  };

  zip.file('backup-manifest.json', JSON.stringify(manifest, null, 2));

  // Generer ZIP-blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Generer dato-stempel til filnavn
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `MitEgetWord-Backup-${dateStr}.zip`;

  // Download i browser
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 1000);

  return {
    success: true,
    filename,
    totalDocs: documents.length,
  };
};
