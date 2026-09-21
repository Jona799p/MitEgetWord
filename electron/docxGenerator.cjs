const JSZip = require('jszip');

function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeHtmlEntities(str) {
  return (str || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sanitizeFilename(name, fallback = 'Dokument') {
  if (!name || !name.trim()) return fallback;
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : fallback;
}

function parseInlineToRuns(html, defaultFontSize = 22) {
  if (!html) return `<w:r><w:rPr><w:sz w:val="${defaultFontSize}"/></w:rPr><w:t></w:t></w:r>`;

  const tagRegex = /(<\/?(?:strong|b|em|i|u|s|del|strike|code|span|a)[^>]*>)/gi;
  const parts = html.split(tagRegex);
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrike = false;
  let runsXml = '';

  for (const part of parts) {
    if (!part) continue;
    const lower = part.toLowerCase();
    if (lower.startsWith('<strong') || lower.startsWith('<b ') || lower === '<b>') { isBold = true; continue; }
    if (lower === '</strong>' || lower === '</b>') { isBold = false; continue; }
    if (lower.startsWith('<em') || lower.startsWith('<i ') || lower === '<i>') { isItalic = true; continue; }
    if (lower === '</em>' || lower === '</i>') { isItalic = false; continue; }
    if (lower.startsWith('<u ') || lower === '<u>') { isUnderline = true; continue; }
    if (lower === '</u>') { isUnderline = false; continue; }
    if (lower.startsWith('<s ') || lower === '<s>' || lower.startsWith('<del') || lower.startsWith('<strike')) { isStrike = true; continue; }
    if (lower === '</s>' || lower === '</del>' || lower === '</strike>') { isStrike = false; continue; }
    if (lower.startsWith('<') && lower.endsWith('>')) continue;

    const text = decodeHtmlEntities(part);
    if (!text) continue;

    let rPr = `<w:sz w:val="${defaultFontSize}"/>`;
    if (isBold) rPr += '<w:b/>';
    if (isItalic) rPr += '<w:i/>';
    if (isUnderline) rPr += '<w:u w:val="single"/>';
    if (isStrike) rPr += '<w:strike/>';

    runsXml += `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  }

  return runsXml || `<w:r><w:rPr><w:sz w:val="${defaultFontSize}"/></w:rPr><w:t></w:t></w:r>`;
}

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

  const rawHtml = contentHtml || '';

  // Process blocks
  const cleanText = rawHtml
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '===H1===$1===END===')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '===H2===$1===END===')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '===H3===$1===END===')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '===P===$1===END===')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '===LI===$1===END===')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '===QUOTE===$1===END===')
    .replace(/<br\s*\/?>/gi, '\n');

  let bodyXml = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>${escapeXml(title || 'Dokument')}</w:t></w:r></w:p>`;

  const blocks = cleanText.split('===END===');
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('===H1===')) {
      const inner = trimmed.replace('===H1===', '');
      bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${parseInlineToRuns(inner, 32)}</w:p>`;
    } else if (trimmed.startsWith('===H2===')) {
      const inner = trimmed.replace('===H2===', '');
      bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>${parseInlineToRuns(inner, 28)}</w:p>`;
    } else if (trimmed.startsWith('===H3===')) {
      const inner = trimmed.replace('===H3===', '');
      bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>${parseInlineToRuns(inner, 24)}</w:p>`;
    } else if (trimmed.startsWith('===LI===')) {
      const inner = trimmed.replace('===LI===', '');
      bodyXml += `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">• </w:t></w:r>${parseInlineToRuns(inner, 22)}</w:p>`;
    } else if (trimmed.startsWith('===QUOTE===')) {
      const inner = trimmed.replace('===QUOTE===', '');
      bodyXml += `<w:p><w:pPr><w:ind w:left="720"/></w:pPr>${parseInlineToRuns(inner, 22)}</w:p>`;
    } else {
      const inner = trimmed.replace(/^===P===/, '');
      if (inner.trim()) {
        bodyXml += `<w:p>${parseInlineToRuns(inner, 22)}</w:p>`;
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

module.exports = {
  createDocxBuffer,
  escapeXml,
  sanitizeFilename
};
