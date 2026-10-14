/**
 * DOCX Document Extractor
 * Reads Microsoft Word documents paragraph-by-paragraph, run-by-run, and table-by-table
 * using JSZip and native XML DOM parsing. Preserves formatting AST.
 */

import JSZip from 'jszip';
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { parseNumberingXml, numberToAlphabetic } from './docxGenerator.js';
import { convertAlphabeticListMarkers } from './translationEngine.js';

function numberToRoman(num, uppercase = false) {
    const romanMap = [
        [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
        [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
        [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
    ];
    let result = '';
    let n = num;
    for (const [val, rom] of romanMap) {
        while (n >= val) {
            result += rom;
            n -= val;
        }
    }
    return uppercase ? result.toUpperCase() : result;
}

function getDOMParser() {
    if (typeof window !== 'undefined' && window.DOMParser) {
        return new window.DOMParser();
    }
    return new XmlDomParser();
}

export async function extractDocxContent(fileOrBuffer, onProgress = null) {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(fileOrBuffer);

    const docXmlFile = loadedZip.file('word/document.xml');
    if (!docXmlFile) {
        throw new Error('Invalid DOCX file: word/document.xml not found.');
    }

    // Parse image relationships from word/_rels/document.xml.rels
    const relsMap = await parseRelationships(loadedZip);

    // Parse numbering definitions from word/numbering.xml
    let numberingData = { abstractNums: new Map(), nums: new Map() };
    const numberingFile = loadedZip.file('word/numbering.xml');
    if (numberingFile) {
        try {
            const numXmlStr = await numberingFile.async('text');
            const numDoc = getDOMParser().parseFromString(numXmlStr, 'text/xml');
            numberingData = parseNumberingXml(numDoc);
        } catch (e) {
            console.warn('[DOCX Extractor] Error parsing numbering.xml:', e);
        }
    }
    const listCounters = new Map();

    const xmlString = await docXmlFile.async('text');
    const parser = getDOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const body = xmlDoc.getElementsByTagName('w:body')[0];
    if (!body) {
        throw new Error('DOCX document body not found.');
    }

    const documentAst = [];
    const textLines = [];
    const allImages = [];

    // Traverse direct children of w:body (paragraphs and tables)
    const childNodes = body.childNodes || [];
    for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        if (!node || node.nodeType !== 1) continue;
        const nodeName = node.nodeName;

        if (nodeName === 'w:p') {
            const paragraphAst = await parseParagraphNodeAsync(node, relsMap, loadedZip, allImages, numberingData, listCounters);
            if (paragraphAst) {
                documentAst.push(paragraphAst);
                const fullText = paragraphAst.runs
                    .filter(r => r.type !== 'image')
                    .map(r => r.text)
                    .join('');
                if (fullText.trim()) {
                    textLines.push(fullText);
                }
            }
        } else if (nodeName === 'w:tbl') {
            const tableAst = await parseTableNodeAsync(node, relsMap, loadedZip, allImages, numberingData, listCounters);
            if (tableAst) {
                documentAst.push(tableAst);
                // Text representation for preview
                for (const row of tableAst.rows) {
                    const rowText = row
                        .map(cell => cell.paragraphs
                            .map(p => p.runs.filter(r => r.type !== 'image').map(r => r.text).join(''))
                            .join(' ')
                        )
                        .join(' | ');
                    if (rowText.trim()) {
                        textLines.push(rowText);
                    }
                }
            }
        }

        if (onProgress && typeof onProgress === 'function') {
            onProgress(i + 1, childNodes.length);
        }
    }

    const plainText = textLines.join('\n');

    return {
        ast: documentAst,
        plainText,
        rawBuffer: fileOrBuffer,
        paragraphsCount: documentAst.filter(n => n.type === 'paragraph').length,
        tablesCount: documentAst.filter(n => n.type === 'table').length,
        images: allImages,
        imagesCount: allImages.length
    };
}

/**
 * Parse relationships from word/_rels/document.xml.rels
 */
async function parseRelationships(loadedZip) {
    const relsMap = new Map();
    const relsFile = loadedZip.file('word/_rels/document.xml.rels');
    if (!relsFile) return relsMap;

    try {
        const relsXml = await relsFile.async('text');
        const parser = getDOMParser();
        const xmlDoc = parser.parseFromString(relsXml, 'text/xml');
        const relNodes = xmlDoc.getElementsByTagName('Relationship');

        for (let i = 0; i < relNodes.length; i++) {
            const id = relNodes[i].getAttribute('Id');
            const target = relNodes[i].getAttribute('Target');
            const type = relNodes[i].getAttribute('Type') || '';
            if (id && target) {
                relsMap.set(id, { target, type });
            }
        }
    } catch (err) {
        console.warn('[DOCX Extractor] Failed to parse document.xml.rels:', err);
    }

    return relsMap;
}

/**
 * Load image binary buffer and base64 dataUrl for a given relationship ID
 */
async function getImageFromRelId(loadedZip, relsMap, rId) {
    if (!relsMap.has(rId)) return null;
    const { target } = relsMap.get(rId);
    let fullPath = target.startsWith('/') ? target.substring(1) : (target.startsWith('word/') ? target : `word/${target}`);
    fullPath = fullPath.replace(/^\.\.\//, '');
    let file = loadedZip.file(fullPath);

    if (!file) {
        // Fallback: search zip files by filename
        const filename = target.replace(/^.*[\\\/]/, '');
        const match = Object.keys(loadedZip.files).find(k => k.endsWith(filename));
        if (match) file = loadedZip.file(match);
    }
    if (!file) return null;

    try {
        const uint8Array = await file.async('uint8array');
        const ext = fullPath.split('.').pop().toLowerCase();
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : (ext === 'png' ? 'image/png' : `image/${ext}`);
        let dataUrl = '';
        if (typeof Buffer !== 'undefined') {
            dataUrl = `data:${mimeType};base64,` + Buffer.from(uint8Array).toString('base64');
        } else if (typeof btoa !== 'undefined') {
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            dataUrl = `data:${mimeType};base64,` + btoa(binary);
        }

        return {
            path: fullPath,
            uint8Array,
            dataUrl,
            mimeType
        };
    } catch (err) {
        console.warn(`[DOCX Extractor] Error reading image media ${fullPath}:`, err);
        return null;
    }
}

/**
 * Parse a single <w:p> node into AST asynchronously, resolving drawings and media
 */
async function parseParagraphNodeAsync(pNode, relsMap, loadedZip, allImages, numberingData = null, listCounters = null) {
    const pPr = pNode.getElementsByTagName('w:pPr')[0];
    let alignment = 'left';
    let isHeading = false;
    let headingLevel = 0;
    let isListItem = false;
    let listMarker = '';

    if (pPr) {
        const jc = pPr.getElementsByTagName('w:jc')[0];
        if (jc && jc.getAttribute('w:val')) {
            alignment = jc.getAttribute('w:val');
        }

        const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
        if (pStyle && pStyle.getAttribute('w:val')) {
            const styleVal = pStyle.getAttribute('w:val').toLowerCase();
            if (styleVal.includes('heading')) {
                isHeading = true;
                const match = styleVal.match(/\d+/);
                headingLevel = match ? parseInt(match[0], 10) : 1;
            }
        }

        const numPr = pPr.getElementsByTagName('w:numPr')[0];
        if (numPr) {
            isListItem = true;
            if (numberingData && numberingData.nums && listCounters) {
                const numIdEl = numPr.getElementsByTagName('w:numId')[0];
                const ilvlEl = numPr.getElementsByTagName('w:ilvl')[0];
                const numId = numIdEl ? numIdEl.getAttribute('w:val') : null;
                const ilvl = ilvlEl ? ilvlEl.getAttribute('w:val') : '0';
                if (numId && numberingData.nums.has(numId)) {
                    const numEntry = numberingData.nums.get(numId);
                    const absId = numEntry.abstractNumId;
                    if (absId && numberingData.abstractNums.has(absId)) {
                        const levels = numberingData.abstractNums.get(absId);
                        const levelDef = levels.get(ilvl);
                        if (levelDef) {
                            const listKey = `${numId}_${ilvl}`;
                            let count = listCounters.get(listKey);
                            if (count === undefined) {
                                count = numEntry.lvlOverrides.has(ilvl) ? numEntry.lvlOverrides.get(ilvl) : levelDef.start;
                            } else {
                                count += 1;
                            }
                            listCounters.set(listKey, count);
                            if (levelDef.numFmt === 'lowerLetter' || levelDef.numFmt === 'upperLetter') {
                                const isUpper = levelDef.numFmt === 'upperLetter';
                                const letter = numberToAlphabetic(count, isUpper);
                                const rawMarker = levelDef.lvlText.replace(/%1/g, letter);
                                listMarker = convertAlphabeticListMarkers(rawMarker);
                            } else if (levelDef.numFmt === 'lowerRoman' || levelDef.numFmt === 'upperRoman') {
                                const rom = numberToRoman(count, levelDef.numFmt === 'upperRoman');
                                listMarker = levelDef.lvlText.replace(/%1/g, rom);
                            } else if (levelDef.numFmt === 'decimal') {
                                listMarker = levelDef.lvlText.replace(/%1/g, count);
                            }
                        }
                    }
                }
            }
        }
    }

    const runs = [];
    const pChildren = pNode.childNodes || [];
    for (let c = 0; c < pChildren.length; c++) {
        const child = pChildren[c];
        if (!child || child.nodeType !== 1) continue;

        if (child.nodeName === 'w:r') {
            await extractRunsAndDrawings(child, relsMap, loadedZip, runs, allImages, alignment);
        } else if (child.nodeName === 'w:hyperlink') {
            const hChildren = child.childNodes || [];
            for (let sub = 0; sub < hChildren.length; sub++) {
                if (hChildren[sub] && hChildren[sub].nodeName === 'w:r') {
                    await extractRunsAndDrawings(hChildren[sub], relsMap, loadedZip, runs, allImages, alignment);
                }
            }
        }
    }

    if (listMarker && runs.length > 0) {
        const firstTextRun = runs.find(r => r.type !== 'image');
        if (firstTextRun) {
            firstTextRun.text = `${listMarker} ${firstTextRun.text}`;
        }
    }

    return {
        type: 'paragraph',
        alignment,
        isHeading,
        headingLevel,
        isListItem,
        runs
    };
}

/**
 * Extract text runs as well as embedded drawings (<w:drawing>) and VML picts (<w:pict>)
 */
async function extractRunsAndDrawings(rNode, relsMap, loadedZip, runs, allImages, alignment) {
    // Check for drawing inside run
    const drawings = Array.from(rNode.getElementsByTagName('w:drawing'));
    for (const drawing of drawings) {
        const ext = drawing.getElementsByTagName('wp:extent')[0];
        const cx = ext ? parseInt(ext.getAttribute('cx') || '0', 10) : 0;
        const cy = ext ? parseInt(ext.getAttribute('cy') || '0', 10) : 0;
        const width = cx > 0 ? Math.round(cx / 9525) : 300;
        const height = cy > 0 ? Math.round(cy / 9525) : 200;

        const blip = drawing.getElementsByTagName('a:blip')[0];
        const rId = blip ? blip.getAttribute('r:embed') : null;
        let imgData = null;
        if (rId && relsMap) {
            imgData = await getImageFromRelId(loadedZip, relsMap, rId);
        }

        const isAnchor = drawing.getElementsByTagName('wp:anchor').length > 0;
        const docPr = drawing.getElementsByTagName('wp:docPr')[0];
        const name = docPr ? (docPr.getAttribute('name') || docPr.getAttribute('title') || '') : '';

        const imageItem = {
            type: 'image',
            rId,
            name,
            width,
            height,
            isFloating: isAnchor,
            alignment,
            cx,
            cy,
            data: imgData ? imgData.uint8Array : null,
            dataUrl: imgData ? imgData.dataUrl : '',
            mimeType: imgData ? imgData.mimeType : 'image/png'
        };

        runs.push(imageItem);
        if (allImages) allImages.push(imageItem);
    }

    // Check for VML pict
    const picts = Array.from(rNode.getElementsByTagName('w:pict'));
    for (const pict of picts) {
        const imgDataNode = pict.getElementsByTagName('v:imagedata')[0];
        const rId = imgDataNode ? (imgDataNode.getAttribute('r:id') || imgDataNode.getAttribute('o:relid')) : null;
        let imgData = null;
        if (rId && relsMap) {
            imgData = await getImageFromRelId(loadedZip, relsMap, rId);
        }
        const imageItem = {
            type: 'image',
            rId,
            name: 'VML Graphic',
            width: 300,
            height: 200,
            isFloating: false,
            alignment,
            data: imgData ? imgData.uint8Array : null,
            dataUrl: imgData ? imgData.dataUrl : '',
            mimeType: imgData ? imgData.mimeType : 'image/png'
        };
        runs.push(imageItem);
        if (allImages) allImages.push(imageItem);
    }

    // Also parse normal text run
    const textRun = parseRunNode(rNode);
    if (textRun && textRun.text) {
        runs.push(textRun);
    }
}

/**
 * Parse a single <w:r> node into AST
 */
function parseRunNode(rNode) {
    const tNodes = rNode.getElementsByTagName('w:t');
    let text = '';
    for (let i = 0; i < tNodes.length; i++) {
        text += tNodes[i].textContent || '';
    }

    const rPr = rNode.getElementsByTagName('w:rPr')[0];
    let bold = false;
    let italic = false;
    let underline = false;
    let fontSize = 24; // standard 12pt (24 half-points)
    let fontColor = null;

    if (rPr) {
        const b = rPr.getElementsByTagName('w:b')[0];
        if (b && (b.getAttribute('w:val') !== '0' && b.getAttribute('w:val') !== 'false')) {
            bold = true;
        }

        const i = rPr.getElementsByTagName('w:i')[0];
        if (i && (i.getAttribute('w:val') !== '0' && i.getAttribute('w:val') !== 'false')) {
            italic = true;
        }

        const u = rPr.getElementsByTagName('w:u')[0];
        if (u && (!u.hasAttribute('w:val') || (u.getAttribute('w:val') !== 'none' && u.getAttribute('w:val') !== '0' && u.getAttribute('w:val') !== 'false'))) {
            underline = true;
        }

        const sz = rPr.getElementsByTagName('w:sz')[0];
        if (sz && sz.getAttribute('w:val')) {
            fontSize = parseInt(sz.getAttribute('w:val'), 10);
        }

        const color = rPr.getElementsByTagName('w:color')[0];
        if (color) {
            fontColor = color.getAttribute('w:val');
        }
    }

    return {
        type: 'run',
        text,
        bold,
        italic,
        underline,
        fontSize,
        fontColor
    };
}

/**
 * Parse a single <w:tbl> table node into AST asynchronously
 */
async function parseTableNodeAsync(tblNode, relsMap, loadedZip, allImages, numberingData = null, listCounters = null) {
    const rows = [];
    const trNodes = tblNode.getElementsByTagName('w:tr');

    for (let r = 0; r < trNodes.length; r++) {
        const rowAst = [];
        const tcNodes = trNodes[r].getElementsByTagName('w:tc');

        for (let c = 0; c < tcNodes.length; c++) {
            const cellParagraphs = [];
            const pNodes = tcNodes[c].getElementsByTagName('w:p');

            for (let p = 0; p < pNodes.length; p++) {
                const pAst = await parseParagraphNodeAsync(pNodes[p], relsMap, loadedZip, allImages, numberingData, listCounters);
                if (pAst) cellParagraphs.push(pAst);
            }

            rowAst.push({
                type: 'cell',
                paragraphs: cellParagraphs
            });
        }
        rows.push(rowAst);
    }

    return {
        type: 'table',
        rows
    };
}
