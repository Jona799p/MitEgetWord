import JSZip from 'jszip';

export interface ParsedLocalFile {
  title: string;
  content: string;
  filename: string;
  isLocal: boolean;
}

/**
 * Rens HTML-indhold og fjern potentielt farlige tags som script/iframe
 */
function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Fjern script, style, iframe, object osv.
  const dangerous = doc.querySelectorAll('script, style, iframe, object, embed, applet');
  dangerous.forEach(el => el.remove());

  return doc.body.innerHTML || '';
}

/**
 * Parse Markdown-tekst til pæn HTML til TipTap-editoren
 */
function parseMarkdownToHtml(mdText: string): string {
  const lines = mdText.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Kodeblokke
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        htmlParts.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        if (inList) {
          htmlParts.push('</ul>');
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(escapeXml(line));
      continue;
    }

    // Tomme linjer
    if (!line.trim()) {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }
      continue;
    }

    // Overskrifter
    if (line.startsWith('###### ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h6>${formatInlineMd(line.slice(7))}</h6>`);
      continue;
    }
    if (line.startsWith('##### ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h5>${formatInlineMd(line.slice(6))}</h5>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h4>${formatInlineMd(line.slice(5))}</h4>`);
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h3>${formatInlineMd(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h2>${formatInlineMd(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false; }
      htmlParts.push(`<h1>${formatInlineMd(line.slice(2))}</h1>`);
      continue;
    }

    // Punktlister
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        htmlParts.push('<ul>');
        inList = true;
      }
      const itemContent = line.trim().slice(2);
      htmlParts.push(`<li>${formatInlineMd(itemContent)}</li>`);
      continue;
    } else if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }

    // Citater (Blockquote)
    if (line.startsWith('> ')) {
      htmlParts.push(`<blockquote><p>${formatInlineMd(line.slice(2))}</p></blockquote>`);
      continue;
    }

    // Almindelig paragraf
    htmlParts.push(`<p>${formatInlineMd(line)}</p>`);
  }

  if (inList) htmlParts.push('</ul>');
  if (inCodeBlock && codeBuffer.length > 0) {
    htmlParts.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
  }

  return htmlParts.join('') || '<p></p>';
}

function formatInlineMd(text: string): string {
  return escapeXml(text)
    // Fed skrift
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // Kursiv
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // Gennemstregning
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    // Inline kode
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse en .docx fil via JSZip og XML DOMParser
 */
async function parseDocxFile(arrayBuffer: ArrayBuffer, fileName: string): Promise<{ title: string; content: string }> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXmlFile = zip.file('word/document.xml');

    if (!documentXmlFile) {
      throw new Error('Ikke et gyldigt Word-dokument (mangler word/document.xml)');
    }

    const xmlText = await documentXmlFile.async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    // Tjek evt. billeder i relationer
    const relsFile = zip.file('word/_rels/document.xml.rels');
    const imageMap = new Map<string, string>();
    if (relsFile) {
      try {
        const relsXmlText = await relsFile.async('text');
        const relsDoc = parser.parseFromString(relsXmlText, 'application/xml');
        const rels = relsDoc.getElementsByTagName('Relationship');
        for (let i = 0; i < rels.length; i++) {
          const r = rels[i];
          const type = r.getAttribute('Type') || '';
          const id = r.getAttribute('Id') || '';
          const target = r.getAttribute('Target') || '';
          if (type.includes('/image') && id && target) {
            // Find filen i zip
            const imagePath = target.startsWith('/') 
              ? target.slice(1) 
              : target.startsWith('word/') ? target : `word/${target}`;
            const imgZipFile = zip.file(imagePath);
            if (imgZipFile) {
              const base64 = await imgZipFile.async('base64');
              const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
              imageMap.set(id, `data:${mime};base64,${base64}`);
            }
          }
        }
      } catch (err) {
        console.warn('Kunne ikke udtrække billeder fra .docx:', err);
      }
    }

    const body = xmlDoc.getElementsByTagName('w:body')[0];
    if (!body) {
      return {
        title: cleanTitle(fileName),
        content: '<p></p>'
      };
    }

    const htmlParts: string[] = [];
    let detectedTitle = '';

    // Gennemløb alle børn af body (paragraffer og tabeller)
    for (let i = 0; i < body.childNodes.length; i++) {
      const node = body.childNodes[i];
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      // Tabeller <w:tbl>
      if (tagName === 'w:tbl') {
        const tableHtml = parseDocxTable(element);
        if (tableHtml) htmlParts.push(tableHtml);
        continue;
      }

      // Paragraffer <w:p>
      if (tagName === 'w:p') {
        const paragraphResult = parseDocxParagraph(element, imageMap);
        if (paragraphResult) {
          htmlParts.push(paragraphResult.html);
          if (!detectedTitle && paragraphResult.plainText.trim()) {
            detectedTitle = paragraphResult.plainText.trim();
          }
        }
      }
    }

    const finalTitle = detectedTitle 
      ? detectedTitle.slice(0, 80) 
      : cleanTitle(fileName);

    return {
      title: finalTitle,
      content: htmlParts.join('') || '<p></p>'
    };
  } catch (error) {
    console.error('Fejl ved parsing af .docx fil:', error);
    return {
      title: cleanTitle(fileName),
      content: `<p>Dokumentet "${fileName}" kunne ikke udtrækkes fuldstændigt som .docx. Indholdet kan være beskyttet eller i et ældre format.</p>`
    };
  }
}

/**
 * Parse en enkelt Word-paragraf <w:p>
 */
function parseDocxParagraph(pElement: Element, imageMap: Map<string, string>): { html: string; plainText: string } | null {
  // Tjek stil (Heading osv.)
  let pStyle = '';
  const pStyleEl = pElement.getElementsByTagName('w:pStyle')[0];
  if (pStyleEl) {
    pStyle = (pStyleEl.getAttribute('w:val') || '').toLowerCase();
  }

  // Tjek centrering/justering
  let textAlign = '';
  const jcEl = pElement.getElementsByTagName('w:jc')[0];
  if (jcEl) {
    const jcVal = (jcEl.getAttribute('w:val') || '').toLowerCase();
    if (jcVal === 'center') textAlign = 'text-align: center;';
    else if (jcVal === 'right') textAlign = 'text-align: right;';
    else if (jcVal === 'both' || jcVal === 'justify') textAlign = 'text-align: justify;';
  }

  let plainText = '';
  const runHtmlParts: string[] = [];

  for (let i = 0; i < pElement.childNodes.length; i++) {
    const child = pElement.childNodes[i];
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const childEl = child as Element;
    const childTag = childEl.tagName.toLowerCase();

    // Word Run <w:r>
    if (childTag === 'w:r') {
      const runResult = parseDocxRun(childEl, imageMap);
      if (runResult) {
        runHtmlParts.push(runResult.html);
        plainText += runResult.plainText;
      }
    } else if (childTag === 'w:hyperlink') {
      // Hyperlink
      let linkText = '';
      const runs = childEl.getElementsByTagName('w:r');
      for (let r = 0; r < runs.length; r++) {
        const runRes = parseDocxRun(runs[r], imageMap);
        if (runRes) {
          linkText += runRes.plainText;
        }
      }
      plainText += linkText;
      runHtmlParts.push(`<a>${escapeXml(linkText)}</a>`);
    }
  }

  const innerHtml = runHtmlParts.join('');
  const styleAttr = textAlign ? ` style="${textAlign}"` : '';

  // Returner korrekt tag efter overskriftsniveau
  if (pStyle.includes('heading 1') || pStyle === 'heading1' || pStyle === 'title') {
    return { html: `<h1${styleAttr}>${innerHtml || '&nbsp;'}</h1>`, plainText };
  } else if (pStyle.includes('heading 2') || pStyle === 'heading2') {
    return { html: `<h2${styleAttr}>${innerHtml || '&nbsp;'}</h2>`, plainText };
  } else if (pStyle.includes('heading 3') || pStyle === 'heading3') {
    return { html: `<h3${styleAttr}>${innerHtml || '&nbsp;'}</h3>`, plainText };
  } else if (pStyle.includes('heading 4') || pStyle === 'heading4') {
    return { html: `<h4${styleAttr}>${innerHtml || '&nbsp;'}</h4>`, plainText };
  } else if (pStyle.includes('heading 5') || pStyle === 'heading5') {
    return { html: `<h5${styleAttr}>${innerHtml || '&nbsp;'}</h5>`, plainText };
  } else if (pStyle.includes('heading 6') || pStyle === 'heading6') {
    return { html: `<h6${styleAttr}>${innerHtml || '&nbsp;'}</h6>`, plainText };
  }

  return { html: `<p${styleAttr}>${innerHtml || ''}</p>`, plainText };
}

/**
 * Parse et Word Run <w:r>
 */
function parseDocxRun(rElement: Element, imageMap: Map<string, string>): { html: string; plainText: string } | null {
  const rPr = rElement.getElementsByTagName('w:rPr')[0];
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrike = false;
  let color = '';

  if (rPr) {
    if (rPr.getElementsByTagName('w:b').length > 0) isBold = true;
    if (rPr.getElementsByTagName('w:i').length > 0) isItalic = true;
    if (rPr.getElementsByTagName('w:u').length > 0) isUnderline = true;
    if (rPr.getElementsByTagName('w:strike').length > 0) isStrike = true;

    const colorEl = rPr.getElementsByTagName('w:color')[0];
    if (colorEl) {
      const val = colorEl.getAttribute('w:val');
      if (val && val !== 'auto') {
        color = `#${val}`;
      }
    }
  }

  let text = '';
  let html = '';

  // Tjek for billeder i tegning / blip
  const blipEls = rElement.getElementsByTagName('a:blip');
  if (blipEls.length > 0) {
    for (let b = 0; b < blipEls.length; b++) {
      const embedId = blipEls[b].getAttribute('r:embed');
      if (embedId && imageMap.has(embedId)) {
        const imgSrc = imageMap.get(embedId)!;
        html += `<img src="${imgSrc}" alt="Indsat billede" style="max-width: 100%; height: auto;" />`;
      }
    }
  }

  for (let i = 0; i < rElement.childNodes.length; i++) {
    const node = rElement.childNodes[i];
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'w:t') {
      text += el.textContent || '';
    } else if (tag === 'w:br') {
      html += '<br/>';
    }
  }

  if (text) {
    let formattedText = escapeXml(text);
    if (isBold) formattedText = `<strong>${formattedText}</strong>`;
    if (isItalic) formattedText = `<em>${formattedText}</em>`;
    if (isUnderline) formattedText = `<u>${formattedText}</u>`;
    if (isStrike) formattedText = `<s>${formattedText}</s>`;
    if (color) formattedText = `<span style="color: ${color};">${formattedText}</span>`;
    html += formattedText;
  }

  return { html, plainText: text };
}

/**
 * Parse Word-tabel <w:tbl>
 */
function parseDocxTable(tblElement: Element): string {
  const rows = tblElement.getElementsByTagName('w:tr');
  if (rows.length === 0) return '';

  const trParts: string[] = [];

  for (let r = 0; r < rows.length; r++) {
    const rowEl = rows[r];
    const cells = rowEl.getElementsByTagName('w:tc');
    const tdParts: string[] = [];

    for (let c = 0; c < cells.length; c++) {
      const cellEl = cells[c];
      const paragraphs = cellEl.getElementsByTagName('w:p');
      const cellHtml: string[] = [];

      for (let p = 0; p < paragraphs.length; p++) {
        const texts = paragraphs[p].getElementsByTagName('w:t');
        let pText = '';
        for (let t = 0; t < texts.length; t++) {
          pText += texts[t].textContent || '';
        }
        cellHtml.push(`<p>${escapeXml(pText)}</p>`);
      }

      tdParts.push(`<td>${cellHtml.join('') || '&nbsp;'}</td>`);
    }

    trParts.push(`<tr>${tdParts.join('')}</tr>`);
  }

  return `<table style="border-collapse: collapse; width: 100%; margin: 12px 0;"><tbody>${trParts.join('')}</tbody></table>`;
}

/**
 * Renser et filnavn for filendelse og ugyldige tegn til brug som dokumenttitel
 */
function cleanTitle(filename: string): string {
  if (!filename) return 'Lokal fil';
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt.trim() || filename;
}

/**
 * Hovedfunktion: Læser en vilkårlig lokal fil og konverterer til { title, content, filename, isLocal: true }
 */
export async function parseLocalFile(file: File): Promise<ParsedLocalFile> {
  const filename = file.name || 'Dokument';
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  // 1. DOCX & DOC filer
  if (extension === 'docx') {
    const buffer = await file.arrayBuffer();
    const result = await parseDocxFile(buffer, filename);
    return {
      title: result.title,
      content: result.content,
      filename,
      isLocal: true
    };
  }

  // 2. HTML / HTM filer
  if (extension === 'html' || extension === 'htm') {
    const rawText = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawText, 'text/html');
    
    // Find titel hvis angivet i <title> eller <h1>
    let docTitle = doc.title || '';
    if (!docTitle) {
      const h1 = doc.querySelector('h1');
      if (h1 && h1.textContent?.trim()) {
        docTitle = h1.textContent.trim();
      }
    }
    if (!docTitle) docTitle = cleanTitle(filename);

    const cleanContent = sanitizeHtml(doc.body.innerHTML || rawText);
    return {
      title: docTitle,
      content: cleanContent || '<p></p>',
      filename,
      isLocal: true
    };
  }

  // 3. JSON og MEW (MitEgetWord filformat)
  if (extension === 'json' || extension === 'mew') {
    const rawText = await file.text();
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && (parsed.content || parsed.title)) {
        return {
          title: parsed.title || cleanTitle(filename),
          content: parsed.content || '<p></p>',
          filename,
          isLocal: true
        };
      }
    } catch {
      // Hvis ikke gyldig JSON, fortsæt til almindelig tekstbehandling
    }
    return {
      title: cleanTitle(filename),
      content: `<pre><code>${escapeXml(rawText)}</code></pre>`,
      filename,
      isLocal: true
    };
  }

  // 4. Markdown filer
  if (extension === 'md' || extension === 'markdown') {
    const rawText = await file.text();
    const html = parseMarkdownToHtml(rawText);
    return {
      title: cleanTitle(filename),
      content: html,
      filename,
      isLocal: true
    };
  }

  // 5. TXT og andre almindelige tekstformater
  const rawText = await file.text();
  const paragraphs = rawText
    .split(/\r?\n\r?\n/)
    .map(p => `<p>${escapeXml(p).replace(/\r?\n/g, '<br/>')}</p>`)
    .join('');

  return {
    title: cleanTitle(filename),
    content: paragraphs || '<p></p>',
    filename,
    isLocal: true
  };
}

export async function parseDocxArrayBuffer(arrayBuffer: ArrayBuffer, fileName: string): Promise<{ title: string; content: string }> {
  return await parseDocxFile(arrayBuffer, fileName);
}

