/**
 * Utility functions for exporting and printing documents in MitEgetWord
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFilename(name: string): string {
  const sanitized = (name || 'Dokument')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .slice(0, 100);
  return sanitized || 'Dokument';
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export interface MarginConfig {
  topCm?: string | number;
  rightCm?: string | number;
  bottomCm?: string | number;
  leftCm?: string | number;
  topPx?: number;
  rightPx?: number;
  bottomPx?: number;
  leftPx?: number;
  css?: string;
}

export interface HeaderFooterConfig {
  headerHtml?: string;
  footerHtml?: string;
  authorName?: string;
  headerType?: string;
  footerType?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  pageNumberFormat?: string;
}

/**
 * Print document or save as PDF via isolated iframe
 */
export const printDocument = (
  title: string, 
  contentHtml: string, 
  margin?: MarginConfig, 
  headerFooter?: HeaderFooterConfig
): void => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const docTitle = title?.trim() || 'Dokument';
  const topMargin = margin?.topCm ? `${margin.topCm}cm` : '20mm';
  const bottomMargin = margin?.bottomCm ? `${margin.bottomCm}cm` : '20mm';
  const leftMargin = margin?.leftCm ? `${margin.leftCm}cm` : '20mm';
  const rightMargin = margin?.rightCm ? `${margin.rightCm}cm` : '20mm';

  const author = headerFooter?.authorName || '';
  const headerText = headerFooter?.headerType === 'author' ? author : docTitle;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="da">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(docTitle)}</title>
      <style>
        @page {
          size: A4;
          margin: ${topMargin} ${rightMargin} ${bottomMargin} ${leftMargin};
        }
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
          color: #1a1a1a;
          background-color: #ffffff;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          font-size: 11pt;
        }
        .page-break-node, [data-page-break="true"] {
          page-break-after: always !important;
          break-after: page !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
        }
        .page-break-indicator, .page-break-tag, .a4-page-gap, .a4-page-break-widget {
          display: none !important;
        }
        h1, h2, h3, h4, h5, h6 {
          color: #000000;
          font-weight: 600;
          line-height: 1.25;
          page-break-after: avoid;
        }
        h1 { font-size: 24pt; margin-top: 0; margin-bottom: 16pt; border-bottom: 1px solid #eaeaea; padding-bottom: 6pt; }
        h2 { font-size: 18pt; margin-top: 18pt; margin-bottom: 10pt; }
        h3 { font-size: 14pt; margin-top: 14pt; margin-bottom: 8pt; }
        h4 { font-size: 12pt; margin-top: 12pt; margin-bottom: 6pt; }
        h5 { font-size: 11pt; margin-top: 10pt; margin-bottom: 4pt; text-transform: uppercase; color: #555555; }
        h6 { font-size: 10pt; margin-top: 10pt; margin-bottom: 4pt; color: #777777; }
        p { margin-top: 0; margin-bottom: 10pt; }
        ul, ol { margin-top: 0; margin-bottom: 10pt; padding-left: 20pt; }
        li { margin-bottom: 4pt; }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 14pt 0;
          page-break-inside: avoid;
        }
        th, td {
          border: 1px solid #d0d0d0;
          padding: 6pt 10pt;
          text-align: left;
          vertical-align: top;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        img {
          max-width: 100%;
          height: auto;
          page-break-inside: avoid;
        }
        hr {
          border: none;
          border-top: 1px solid #dcdcdc;
          margin: 16pt 0;
        }
        blockquote {
          border-left: 3px solid #2b579a;
          margin: 12pt 0;
          padding-left: 12pt;
          color: #555555;
          font-style: italic;
        }
        a {
          color: #2b579a;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      ${contentHtml || '<p></p>'}
    </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Fejl ved udskrivning:', err);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  }, 250);
};

/**
 * Export document as a Word-compatible .doc file
 */
export const exportToWord = (title: string, contentHtml: string): void => {
  const docTitle = title?.trim() || 'Dokument';
  const filename = `${sanitizeFilename(docTitle)}.doc`;

  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' ` +
    `xmlns:w='urn:schemas-microsoft-com:office:word' ` +
    `xmlns='http://www.w3.org/TR/REC-html40'>` +
    `<head><meta charset='utf-8'><title>${escapeHtml(docTitle)}</title>` +
    `<style>` +
    `body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000000; }` +
    `h1 { font-size: 20pt; color: #1f4e79; margin-bottom: 12pt; }` +
    `h2 { font-size: 15pt; color: #2e74b5; margin-top: 14pt; margin-bottom: 6pt; }` +
    `h3 { font-size: 13pt; color: #1f4e79; margin-top: 12pt; margin-bottom: 4pt; }` +
    `p { margin-bottom: 8pt; }` +
    `table { border-collapse: collapse; width: 100%; margin: 12pt 0; }` +
    `th, td { border: 1px solid #bfbfbf; padding: 6pt; }` +
    `th { background-color: #f2f2f2; font-weight: bold; }` +
    `blockquote { border-left: 3px solid #2e74b5; margin: 10pt 0; padding-left: 10pt; color: #595959; }` +
    `img { max-width: 100%; height: auto; }` +
    `</style></head><body>`;
  const footer = `</body></html>`;
  const fullHtml = header + (contentHtml || '<p></p>') + footer;

  const blob = new Blob(['\ufeff', fullHtml], {
    type: 'application/msword;charset=utf-8'
  });
  triggerDownload(blob, filename);
};

/**
 * Export document as a standalone .html file
 */
export const exportToHtml = (title: string, contentHtml: string): void => {
  const docTitle = title?.trim() || 'Dokument';
  const filename = `${sanitizeFilename(docTitle)}.html`;

  const html = `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #222222;
      background: #ffffff;
      line-height: 1.7;
      max-width: 820px;
      margin: 40px auto;
      padding: 0 24px;
    }
    h1, h2, h3, h4, h5, h6 { color: #111111; line-height: 1.3; }
    h1 { font-size: 2.2rem; border-bottom: 2px solid #eaeaea; padding-bottom: 8px; margin-bottom: 20px; }
    h2 { font-size: 1.6rem; margin-top: 30px; }
    h3 { font-size: 1.3rem; margin-top: 24px; }
    p { margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #dddddd; padding: 10px 14px; text-align: left; }
    th { background-color: #f9f9f9; }
    blockquote { border-left: 4px solid #4a90e2; padding-left: 16px; color: #666666; margin: 20px 0; }
    img { max-width: 100%; height: auto; border-radius: 4px; }
    a { color: #4a90e2; text-decoration: underline; }
  </style>
</head>
<body>
  ${contentHtml || '<p></p>'}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, filename);
};

/**
 * Export document as plain text .txt file
 */
export const exportToText = (title: string, textContent: string): void => {
  const docTitle = title?.trim() || 'Dokument';
  const filename = `${sanitizeFilename(docTitle)}.txt`;
  const blob = new Blob([textContent || ''], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, filename);
};

/**
 * Export a rendered DOM element (such as the A4 Print Preview page) directly to a multi-page PDF file
 */
export const exportToPdf = async (title: string, element: HTMLElement): Promise<void> => {
  const canvas = await html2canvas(element, {
    scale: 2, // High resolution crisp text
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.98);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  const docTitle = title?.trim() || 'Dokument';
  pdf.save(`${sanitizeFilename(docTitle)}.pdf`);
};

/**
 * Headless export from raw HTML string to PDF
 */
export const exportToPdfFromHtml = async (title: string, contentHtml: string): Promise<void> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1a1a1a';
  container.style.padding = '48px';
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";
  container.style.fontSize = '11pt';
  container.style.lineHeight = '1.6';
  container.innerHTML = `
    <h1 style="font-size: 24pt; color: #000; margin-top: 0; margin-bottom: 16pt; border-bottom: 1px solid #eaeaea; padding-bottom: 6pt;">
      ${escapeHtml(title?.trim() || 'Dokument')}
    </h1>
    ${contentHtml || '<p></p>'}
  `;
  document.body.appendChild(container);

  try {
    await exportToPdf(title, container);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
};
