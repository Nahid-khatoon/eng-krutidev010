/**
 * Full Multi-Page PDF Document Extractor
 * Uses pdfjs-dist text layer with coordinate-based reconstruction.
 * Accurately calculates baseline and word gaps to prevent artificial character splitting.
 * Supports progress updates for multi-page documents (1 to 300+ pages).
 */

import * as pdfjsLib from 'pdfjs-dist';

// Polyfill standard TC39 APIs required by modern PDF.js engines
if (typeof Uint8Array !== 'undefined' && !Uint8Array.prototype.toHex) {
    Uint8Array.prototype.toHex = function() {
        return Array.from(this).map(b => b.toString(16).padStart(2, '0')).join('');
    };
}

if (typeof Map !== 'undefined' && !Map.prototype.getOrInsertComputed) {
    Map.prototype.getOrInsertComputed = function(key, callback) {
        if (this.has(key)) return this.get(key);
        const value = callback(key);
        this.set(key, value);
        return value;
    };
}

if (typeof Map !== 'undefined' && !Map.prototype.getOrInsert) {
    Map.prototype.getOrInsert = function(key, defaultValue) {
        if (this.has(key)) return this.get(key);
        this.set(key, defaultValue);
        return defaultValue;
    };
}

if (typeof Promise !== 'undefined' && !Promise.withResolvers) {
    Promise.withResolvers = function() {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

// Configure PDF.js worker safely across browser and Node.js environments
if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        const version = pdfjsLib.version || '6.4.299';
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
    }
}

export async function loadPdfDocument(fileOrBuffer) {
    let data;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrBuffer)) {
        // PDF.js v6 disallows Node Buffer instances; convert to pure Uint8Array
        const ab = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength);
        data = new Uint8Array(ab);
    } else if (fileOrBuffer instanceof Uint8Array) {
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrBuffer)) {
            const ab = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength);
            data = new Uint8Array(ab);
        } else {
            data = fileOrBuffer;
        }
    } else if (fileOrBuffer instanceof ArrayBuffer) {
        data = new Uint8Array(fileOrBuffer);
    } else if (typeof Blob !== 'undefined' && fileOrBuffer instanceof Blob) {
        const ab = await fileOrBuffer.arrayBuffer();
        data = new Uint8Array(ab);
    } else {
        throw new Error('Unsupported PDF input type: expected File, Blob, ArrayBuffer, or Uint8Array.');
    }

    try {
        const loadingTask = pdfjsLib.getDocument({
            data,
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '6.4.299'}/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '6.4.299'}/standard_fonts/`
        });
        const pdfDoc = await loadingTask.promise;

        if (!pdfDoc || typeof pdfDoc.numPages !== 'number' || pdfDoc.numPages < 1) {
            throw new Error('PDF document has 0 pages or failed to initialize.');
        }

        return { pdfDoc, numPages: pdfDoc.numPages };
    } catch (err) {
        console.error('[PDF.js loadPdfDocument Error]', err);
        throw new Error(`Failed to initialize PDF document: ${err.message || 'Corrupted or unreadable PDF'}`);
    }
}

/**
 * Inspect page text layer and detect empty pages and scanned images without text layers.
 */
export async function inspectPageText(page, pageNum = 1) {
    if (!page) {
        return {
            text: `[Page ${pageNum}: Page object unavailable]`,
            hasText: false,
            isEmpty: true,
            isScanned: false,
            ocrMessage: null
        };
    }

    let textContent = null;
    try {
        textContent = await page.getTextContent();
    } catch (err) {
        console.warn(`[PDF Analysis] Failed to retrieve text layer for page ${pageNum}:`, err);
    }

    const items = textContent && textContent.items ? textContent.items : [];
    const pageLines = reconstructPageTextLines(items);
    const hasSelectableText = pageLines.length > 0 && pageLines.some(line => line.trim().length > 0);

    if (hasSelectableText) {
        return {
            text: pageLines.join('\n'),
            hasText: true,
            isEmpty: false,
            isScanned: false,
            ocrMessage: null
        };
    }

    // No selectable text found. Check if page contains raster images (scanned document).
    let hasImages = false;
    try {
        const ops = await page.getOperatorList();
        if (ops && ops.fnArray && Array.isArray(ops.fnArray)) {
            const imageOps = [
                pdfjsLib.OPS.paintImageXObject,
                pdfjsLib.OPS.paintInlineImageXObject,
                pdfjsLib.OPS.paintImageMaskXObject
            ];
            hasImages = ops.fnArray.some(op => imageOps.includes(op));
        }
    } catch (opErr) {
        console.warn(`[PDF Analysis] Operator list check failed on page ${pageNum}:`, opErr);
    }

    if (hasImages) {
        const ocrNotice = `[Page ${pageNum} Notice: Scanned document image detected without an embedded text layer. OCR is required to extract editable text from scanned pages.]`;
        return {
            text: ocrNotice,
            hasText: false,
            isEmpty: false,
            isScanned: true,
            ocrMessage: `Page ${pageNum} is a scanned document without selectable text. OCR is recommended.`
        };
    }

    // Completely empty page (no text and no images)
    return {
        text: `[Page ${pageNum}: Empty page]`,
        hasText: false,
        isEmpty: true,
        isScanned: false,
        ocrMessage: null
    };
}

/**
 * Convert PDF.js image object to PNG Uint8Array and Data URL
 */
export function rawImageToPngBuffer(imgObj) {
    if (!imgObj || !imgObj.width || !imgObj.height || !imgObj.data) return null;
    const w = imgObj.width;
    const h = imgObj.height;
    const totalPixels = w * h;
    const src = imgObj.data;

    // Convert src to standardized RGBA Buffer/Uint8Array
    const rgba = new Uint8Array(totalPixels * 4);

    if (imgObj.kind === 1) { // Grayscale (1 byte per pixel)
        for (let p = 0; p < totalPixels; p++) {
            const g = src[p];
            const dst = p * 4;
            rgba[dst] = g;
            rgba[dst + 1] = g;
            rgba[dst + 2] = g;
            rgba[dst + 3] = 255;
        }
    } else if (imgObj.kind === 2) { // RGB (3 bytes per pixel)
        for (let p = 0; p < totalPixels; p++) {
            const s = p * 3;
            const dst = p * 4;
            rgba[dst] = src[s];
            rgba[dst + 1] = src[s + 1];
            rgba[dst + 2] = src[s + 2];
            rgba[dst + 3] = 255;
        }
    } else { // RGBA (4 bytes per pixel)
        rgba.set(src.subarray(0, totalPixels * 4));
    }

    // 1. Browser canvas path (if available)
    if (typeof document !== 'undefined' && document.createElement) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            const imgData = ctx.createImageData(w, h);
            imgData.data.set(rgba);
            ctx.putImageData(imgData, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            let uint8Array;
            if (typeof atob !== 'undefined') {
                const bin = atob(base64);
                uint8Array = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) uint8Array[i] = bin.charCodeAt(i);
            } else if (typeof Buffer !== 'undefined') {
                uint8Array = new Uint8Array(Buffer.from(base64, 'base64'));
            }
            return { uint8Array, dataUrl };
        } catch (cErr) {
            console.warn('[PDF Image Extractor] Canvas rendering fallback:', cErr);
        }
    }

    // 2. Node.js zlib path (if in Node.js test environment)
    if (typeof Buffer !== 'undefined') {
        try {
            // Synchronously create pure PNG using zlib
            let zlibModule = null;
            if (typeof process !== 'undefined' && process.versions && process.versions.node) {
                // Dynamically load node zlib if available
                const req = typeof require !== 'undefined' ? require : null;
                if (req) zlibModule = req('zlib');
            }
            if (zlibModule) {
                const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
                const ihdrData = Buffer.alloc(13);
                ihdrData.writeUInt32BE(w, 0);
                ihdrData.writeUInt32BE(h, 4);
                ihdrData[8] = 8; ihdrData[9] = 6;
                function makeChunk(t, d) {
                    const len = Buffer.alloc(4); len.writeUInt32BE(d.length, 0);
                    const type = Buffer.from(t, 'ascii');
                    const crc32 = (function(buf) {
                        let c = 0xffffffff;
                        for (let i = 0; i < buf.length; i++) {
                            c ^= buf[i];
                            for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
                        }
                        return (c ^ 0xffffffff) >>> 0;
                    })(Buffer.concat([type, d]));
                    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32, 0);
                    return Buffer.concat([len, type, d, crc]);
                }
                const ihdr = makeChunk('IHDR', ihdrData);
                const raw = Buffer.alloc(h * (1 + w * 4));
                let o = 0, so = 0;
                for (let y = 0; y < h; y++) {
                    raw[o++] = 0;
                    for (let x = 0; x < w * 4; x++) raw[o++] = rgba[so++];
                }
                const idat = makeChunk('IDAT', zlibModule.deflateSync(raw));
                const iend = makeChunk('IEND', Buffer.alloc(0));
                const fullBuf = Buffer.concat([sig, ihdr, idat, iend]);
                return {
                    uint8Array: new Uint8Array(fullBuf),
                    dataUrl: `data:image/png;base64,` + fullBuf.toString('base64')
                };
            }
        } catch (nodeErr) {
            console.warn('[PDF Image Extractor] Node zlib fallback:', nodeErr);
        }
    }

    return null;
}

/**
 * Extract all embedded images, diagrams, and scanned page graphics from a PDF page
 */
export async function extractPageImages(page, pageNum = 1, isScanned = false) {
    if (!page) return [];
    const images = [];

    // 1. Scanned page full high-resolution diagram/photo capture
    if (isScanned && typeof document !== 'undefined' && document.createElement) {
        try {
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/png');
            const base64 = dataUrl.split(',')[1];
            let uint8Array;
            if (typeof atob !== 'undefined') {
                const bin = atob(base64);
                uint8Array = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) uint8Array[i] = bin.charCodeAt(i);
            } else if (typeof Buffer !== 'undefined') {
                uint8Array = new Uint8Array(Buffer.from(base64, 'base64'));
            }
            images.push({
                id: `scanned_page_${pageNum}`,
                pageNum,
                name: `Scanned Document Page ${pageNum}`,
                width: Math.round(viewport.width),
                height: Math.round(viewport.height),
                x: 0,
                y: 0,
                aspectRatio: viewport.width / (viewport.height || 1),
                uint8Array,
                dataUrl,
                isScannedPage: true
            });
            return images;
        } catch (sErr) {
            console.warn(`[PDF Image Extractor] Scanned page canvas render failed on page ${pageNum}:`, sErr);
        }
    }

    // 2. Embedded images (paintImageXObject / paintInlineImageXObject)
    try {
        const ops = await page.getOperatorList();
        if (!ops || !ops.fnArray || !Array.isArray(ops.fnArray)) return images;

        let currentTransform = [1, 0, 0, 1, 0, 0];
        let imgIdx = 0;

        for (let i = 0; i < ops.fnArray.length; i++) {
            const fn = ops.fnArray[i];
            const args = ops.argsArray[i];

            if (fn === pdfjsLib.OPS.transform) {
                currentTransform = args;
            } else if (fn === pdfjsLib.OPS.paintImageXObject) {
                imgIdx++;
                const imgName = args[0];
                const width = Math.abs(Math.round(currentTransform[0])) || 100;
                const height = Math.abs(Math.round(currentTransform[3])) || 100;
                const x = Math.round(currentTransform[4]) || 0;
                const y = Math.round(currentTransform[5]) || 0;

                let imgObj = null;
                try {
                    imgObj = await new Promise((resolve) => {
                        let timeout = setTimeout(() => resolve(null), 1000);
                        page.objs.get(imgName, (res) => {
                            clearTimeout(timeout);
                            resolve(res || null);
                        });
                    });
                } catch (objErr) {
                    console.warn(`[PDF Image Extractor] Could not load image obj ${imgName}:`, objErr);
                }

                let encoded = imgObj ? rawImageToPngBuffer(imgObj) : null;
                images.push({
                    id: `page_${pageNum}_img_${imgIdx}`,
                    pageNum,
                    name: imgName,
                    width,
                    height,
                    x,
                    y,
                    aspectRatio: height > 0 ? (width / height) : 1,
                    uint8Array: encoded ? encoded.uint8Array : null,
                    dataUrl: encoded ? encoded.dataUrl : '',
                    isScannedPage: false
                });
            } else if (fn === pdfjsLib.OPS.paintInlineImageXObject) {
                imgIdx++;
                const inlineObj = args[0];
                const width = inlineObj.width || Math.abs(Math.round(currentTransform[0])) || 100;
                const height = inlineObj.height || Math.abs(Math.round(currentTransform[3])) || 100;
                const encoded = rawImageToPngBuffer(inlineObj);
                images.push({
                    id: `page_${pageNum}_inline_img_${imgIdx}`,
                    pageNum,
                    name: `Inline Image ${imgIdx}`,
                    width,
                    height,
                    x: Math.round(currentTransform[4]) || 0,
                    y: Math.round(currentTransform[5]) || 0,
                    aspectRatio: height > 0 ? (width / height) : 1,
                    uint8Array: encoded ? encoded.uint8Array : null,
                    dataUrl: encoded ? encoded.dataUrl : '',
                    isScannedPage: false
                });
            }
        }
    } catch (opErr) {
        console.warn(`[PDF Image Extractor] Error inspecting operator list on page ${pageNum}:`, opErr);
    }

    return images;
}

export async function extractSinglePageText(page, pageNum = 1) {
    const pageInfo = await inspectPageText(page, pageNum);
    return pageInfo.text;
}

export async function extractPdfContent(fileOrBuffer, onProgress = null) {
    const { pdfDoc, numPages } = await loadPdfDocument(fileOrBuffer);

    const pageTexts = [];
    const documentAst = [];
    const allImages = [];
    let scannedPagesCount = 0;
    let emptyPagesCount = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (onProgress) {
            try {
                onProgress({
                    current: pageNum,
                    total: numPages,
                    percentage: Math.round((pageNum / numPages) * 100),
                    stage: `Analyzing Page ${pageNum} of ${numPages} (Text & Images)`
                });
            } catch (pErr) {
                console.warn('[PDF Extraction] Non-fatal progress callback error:', pErr);
            }
        }

        const page = await pdfDoc.getPage(pageNum);
        const pageInfo = await inspectPageText(page, pageNum);

        if (pageInfo.isScanned) scannedPagesCount++;
        if (pageInfo.isEmpty) emptyPagesCount++;

        pageTexts.push(pageInfo.text);

        // Extract and preserve all embedded diagrams, photographs, and scanned images
        const pageImages = await extractPageImages(page, pageNum, pageInfo.isScanned);
        if (pageImages && pageImages.length > 0) {
            allImages.push(...pageImages);
            // Insert images into document AST
            for (const img of pageImages) {
                documentAst.push({
                    type: 'image',
                    id: img.id,
                    pageNum,
                    width: img.width,
                    height: img.height,
                    aspectRatio: img.aspectRatio,
                    alignment: 'center',
                    data: img.uint8Array,
                    dataUrl: img.dataUrl
                });
            }
        }

        // Build AST paragraphs for this page
        const lines = pageInfo.text.split('\n');
        for (const line of lines) {
            if (line.trim()) {
                documentAst.push({
                    type: 'paragraph',
                    alignment: 'left',
                    isHeading: isProbableHeading(line),
                    headingLevel: isProbableHeading(line) ? 1 : 0,
                    isListItem: /^\d+[\.\)]\s|^[\-\*•]\s/.test(line),
                    runs: [
                        {
                            type: 'run',
                            text: line,
                            bold: isProbableHeading(line),
                            italic: false,
                            underline: false,
                            fontSize: isProbableHeading(line) ? 28 : 24
                        }
                    ]
                });
            }
        }
    }

    const fullPlainText = pageTexts.join('\n\n');

    return {
        plainText: fullPlainText,
        ast: documentAst,
        pageCount: numPages,
        scannedPagesCount,
        emptyPagesCount,
        isScannedDocument: scannedPagesCount > 0 && scannedPagesCount === numPages,
        images: allImages,
        imagesCount: allImages.length
    };
}

/**
 * Reconstruct page text items into clean lines using coordinate geometry.
 * Prevents split-letter bugs like "C r a n k   H a n d l e".
 */
function reconstructPageTextLines(items) {
    if (!items || items.length === 0) return [];

    // Filter valid items
    const validItems = items.filter(item => item.str && item.str.trim() !== '');
    if (validItems.length === 0) return [];

    // Group items into visual lines by matching Y coordinates (with a small tolerance)
    const lineTolerance = 4; // pixels
    const lines = [];

    // Sort primarily by Y descending (top of page to bottom), secondarily by X ascending (left to right)
    validItems.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > lineTolerance) {
            return yDiff;
        }
        return a.transform[4] - b.transform[4];
    });

    let currentLineY = validItems[0].transform[5];
    let currentLineItems = [];

    for (const item of validItems) {
        const itemY = item.transform[5];
        if (Math.abs(itemY - currentLineY) <= lineTolerance) {
            currentLineItems.push(item);
        } else {
            // Finish current line
            lines.push(assembleLine(currentLineItems));
            currentLineY = itemY;
            currentLineItems = [item];
        }
    }

    if (currentLineItems.length > 0) {
        lines.push(assembleLine(currentLineItems));
    }

    return lines;
}

/**
 * Assemble text items within the same line, respecting actual physical gaps between words.
 */
function assembleLine(items) {
    // Sort items by X position
    items.sort((a, b) => a.transform[4] - b.transform[4]);

    let lineText = '';
    let lastRightX = -1;
    let approxCharWidth = 6;

    for (const item of items) {
        const str = item.str;
        const x = item.transform[4];
        const width = item.width || (str.length * 7);

        if (str.length > 0) {
            approxCharWidth = Math.max(width / str.length, 4);
        }

        if (lastRightX === -1) {
            lineText += str;
        } else {
            const gap = x - lastRightX;
            // Only insert space if the gap is greater than ~ 35% of a character width
            if (gap > approxCharWidth * 0.35) {
                lineText += ' ' + str;
            } else {
                lineText += str;
            }
        }

        lastRightX = x + width;
    }

    // Clean up any remaining double spaces while preserving single spaces
    return lineText.replace(/\s+/g, ' ').trim();
}

function isProbableHeading(line) {
    const trimmed = line.trim();
    if (trimmed.length > 3 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && !trimmed.endsWith('.')) {
        return true;
    }
    if (/^(CHAPTER|SECTION|RULE|PARAGRAPH|अध्याय|नियम)\s+[0-9IVXLCDM]+/i.test(trimmed)) {
        return true;
    }
    return false;
}
