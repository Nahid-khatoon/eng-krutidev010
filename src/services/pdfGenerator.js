/**
 * PDF Document Generator
 * Generates downloadable PDF documents for Hindi Unicode and Kruti Dev 010.
 * Ensures the PDF visually shows readable Hindi script, not raw ASCII gibberish.
 */

import { jsPDF } from 'jspdf';
import fileSaver from 'file-saver';
const saveAs = fileSaver.saveAs || fileSaver;
import { unicodeToKrutiDev } from './krutiDevConverter.js';

/**
 * Generate and download PDF
 * @param {Object} options
 * @param {string} options.text - Document text to export
 * @param {string} options.mode - 'unicode' or 'krutidev'
 * @param {string} options.title - Document title
 * @param {string} options.filename - Download filename
 */
export async function downloadPdf(options) {
    const {
        pagesData = null,
        text = '',
        mode = 'unicode',
        title = 'KRUTI DEV 010 DOCUMENT',
        filename = 'document.pdf',
        onProgress = null,
        checkCancelled = null
    } = options;

    const isMultiPage = pagesData && pagesData.length > 0;
    const meaningfulLines = (text || '').split('\n').filter(l => l.trim().length > 0);
    const totalItems = isMultiPage ? pagesData.length : Math.max(1, meaningfulLines.length);
    const totalUnits = totalItems + 3;
    let completedUnits = 0;

    if (onProgress) {
        onProgress(0, totalUnits, 'Initializing PDF typography and layout...');
    }

    let exportText = text;
    if (pagesData && pagesData.length > 0) {
        exportText = pagesData
            .map(p => mode === 'krutidev' ? (p.krutiText || unicodeToKrutiDev(p.hindiText || '')) : (p.hindiText || p.originalText || ''))
            .join('\n\n');
    }

    // Create an offscreen styled document container to render faithful typography
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // Standard A4 width at 96 DPI
    container.style.padding = '48px 56px';
    container.style.background = '#FFFFFF';
    container.style.color = '#111827';
    container.style.boxSizing = 'border-box';
    container.style.lineHeight = '1.7';
    container.style.fontSize = '14px';

    if (mode === 'krutidev') {
        container.style.fontFamily = "'Kruti Dev 010', 'KrutiDev010', sans-serif";
    } else {
        container.style.fontFamily = "'Noto Sans Devanagari', 'Mangal', 'Segoe UI', sans-serif";
    }

    // Document Header
    const headerEl = document.createElement('div');
    headerEl.style.borderBottom = '2px solid #E5E7EB';
    headerEl.style.paddingBottom = '14px';
    headerEl.style.marginBottom = '24px';
    headerEl.style.display = 'flex';
    headerEl.style.justifyContent = 'space-between';
    headerEl.style.alignItems = 'center';

    const titleEl = document.createElement('div');
    titleEl.style.fontSize = '18px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = '#1E3A8A';
    titleEl.textContent = title;
    headerEl.appendChild(titleEl);

    const badgeEl = document.createElement('div');
    badgeEl.style.fontSize = '11px';
    badgeEl.style.padding = '3px 8px';
    badgeEl.style.borderRadius = '4px';
    badgeEl.style.background = '#F3F4F6';
    badgeEl.style.color = '#4B5563';
    badgeEl.textContent = mode === 'krutidev' ? 'KRUTI DEV 010 ENCODED' : 'HINDI UNICODE MASTER';
    headerEl.appendChild(badgeEl);

    container.appendChild(headerEl);

    // Body content
    const contentEl = document.createElement('div');

    if (pagesData && pagesData.length > 0) {
        // Multi-page document layout
        pagesData.forEach((page, pageIdx) => {
            if (checkCancelled && checkCancelled()) throw new Error('PDF generation cancelled by user');

            // Render preserved images for this page (diagrams, photos, track layouts)
            if (page.images && page.images.length > 0) {
                for (const img of page.images) {
                    if (img.dataUrl) {
                        const imgWrap = document.createElement('div');
                        imgWrap.style.margin = '14px 0';
                        imgWrap.style.textAlign = 'center';

                        const imgEl = document.createElement('img');
                        imgEl.src = img.dataUrl;
                        imgEl.style.maxWidth = '100%';
                        imgEl.style.maxHeight = '420px';
                        imgEl.style.height = 'auto';
                        imgEl.style.borderRadius = '4px';
                        imgEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        imgEl.style.display = 'inline-block';
                        imgWrap.appendChild(imgEl);

                        if (img.name && !img.isScannedPage) {
                            const caption = document.createElement('div');
                            caption.style.fontSize = '11px';
                            caption.style.color = '#6B7280';
                            caption.style.marginTop = '4px';
                            caption.textContent = img.name;
                            imgWrap.appendChild(caption);
                        }

                        contentEl.appendChild(imgWrap);
                    }
                }
            }

            // Render page text
            const pageText = mode === 'krutidev'
                ? (page.krutiText || unicodeToKrutiDev(page.hindiText || ''))
                : (page.hindiText || page.originalText || '');

            const pLines = pageText.split('\n');
            for (const rawLine of pLines) {
                if (!rawLine.trim()) {
                    const spacer = document.createElement('div');
                    spacer.style.height = '10px';
                    contentEl.appendChild(spacer);
                    continue;
                }

                const p = document.createElement('p');
                p.style.margin = '0 0 10px 0';
                p.style.textAlign = 'justify';
                p.style.wordBreak = 'break-word';

                if (/^(अध्याय|CHAPTER|SECTION|RULE|नियम)\b/i.test(rawLine) || (rawLine.length < 50 && rawLine.endsWith(':'))) {
                    p.style.fontWeight = 'bold';
                    p.style.fontSize = '16px';
                    p.style.color = '#1E3A8A';
                    p.style.marginTop = '16px';
                }

                p.textContent = rawLine;
                contentEl.appendChild(p);
            }

            // Divider between pages
            if (pageIdx < pagesData.length - 1) {
                const pageDivider = document.createElement('div');
                pageDivider.style.borderTop = '1px dashed #D1D5DB';
                pageDivider.style.margin = '24px 0';
                contentEl.appendChild(pageDivider);
            }

            completedUnits = pageIdx + 1;
            if (onProgress) {
                onProgress(completedUnits, totalUnits, `Formatting PDF page ${pageIdx + 1} of ${pagesData.length}...`);
            }
        });
    } else {
        const lines = (text || '').split('\n');
        let processedLineCount = 0;

        for (const rawLine of lines) {
            if (checkCancelled && checkCancelled()) throw new Error('PDF generation cancelled by user');

            if (!rawLine.trim()) {
                const spacer = document.createElement('div');
                spacer.style.height = '12px';
                contentEl.appendChild(spacer);
                continue;
            }

            const p = document.createElement('p');
            p.style.margin = '0 0 10px 0';
            p.style.textAlign = 'justify';
            p.style.wordBreak = 'break-word';

            if (/^(अध्याय|CHAPTER|SECTION|RULE|नियम)\b/i.test(rawLine) || (rawLine.length < 50 && rawLine.endsWith(':'))) {
                p.style.fontWeight = 'bold';
                p.style.fontSize = '16px';
                p.style.color = '#1E3A8A';
                p.style.marginTop = '16px';
            }

            const displayText = mode === 'krutidev' ? unicodeToKrutiDev(rawLine) : rawLine;
            p.textContent = displayText;

            contentEl.appendChild(p);

            processedLineCount++;
            completedUnits = processedLineCount;
            if (onProgress && (processedLineCount % 5 === 0 || processedLineCount === totalItems)) {
                onProgress(completedUnits, totalUnits, `Formatting PDF section ${processedLineCount} of ${totalItems}...`);
            }
        }
    }

    container.appendChild(contentEl);

    // Footer
    const footerEl = document.createElement('div');
    footerEl.style.borderTop = '1px solid #E5E7EB';
    footerEl.style.paddingTop = '12px';
    footerEl.style.marginTop = '32px';
    footerEl.style.fontSize = '10px';
    footerEl.style.color = '#9CA3AF';
    footerEl.style.display = 'flex';
    footerEl.style.justifyContent = 'space-between';
    footerEl.innerHTML = `<span>Generated by KRUTI DEV 010 SMART CONVERTER</span><span>Date: ${new Date().toLocaleDateString()}</span>`;
    container.appendChild(footerEl);

    document.body.appendChild(container);

    try {
        if (checkCancelled && checkCancelled()) throw new Error('PDF generation cancelled by user');
        if (onProgress) {
            onProgress(totalUnits - 2, totalUnits, 'Rendering Hindi typography and vector canvas with jsPDF...');
        }

        // Use jsPDF's html renderer
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        await doc.html(container, {
            callback: function (pdf) {
                if (onProgress) {
                    onProgress(totalUnits - 1, totalUnits, 'Saving PDF file to disk...');
                }
                pdf.save(filename);
                if (onProgress) {
                    onProgress(totalUnits, totalUnits, 'PDF generated and downloaded successfully (100%).');
                }
            },
            x: 20,
            y: 20,
            width: 555,
            windowWidth: 794
        });
    } finally {
        document.body.removeChild(container);
    }
}
