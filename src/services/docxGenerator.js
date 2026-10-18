/**
 * DOCX Document Generator & In-Place XML Transformer
 * Supports:
 * - High-Fidelity In-Place DOCX XML transformation preserving exact margins,
 *   page orientation, headers/footers, alignments (Center, Justified, Left, Right),
 *   paragraph styles, bold, italic, underline, font size, and tables.
 * - Kruti Dev 010 legacy encoding applied specifically to Hindi text.
 * - Latin / Unicode font (Times New Roman / Arial) applied specifically to
 *   Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X, (i)-(vi), (I)-(IV)),
 *   dates (22-07-2026), fractional codes (117/2025), and decimals (6.02(iv)).
 * - Fallback DOCX generation from document AST or multi-page records for PDF / pasted text.
 */

import { Document, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, Packer, WidthType, BorderStyle, PageBreak } from 'docx';
import fileSaver from 'file-saver';
const saveAs = fileSaver.saveAs || fileSaver;
import { unicodeToKrutiDev } from './krutiDevConverter.js';
import { translateEnglishToHindi, ensureNoEnglishWordsRemain, normalizeHindiWordSpacing, convertAlphabeticListMarkers, cleanHindiOrdinalListMarkers, extractRomanListPrefix } from './translationEngine.js';
import JSZip from 'jszip';
import { DOMParser as XmlDomParser, XMLSerializer as XmlDomSerializer } from '@xmldom/xmldom';

/**
 * Universal DOMParser and XMLSerializer loader for both Browser and Node.js
 */
function getXmlDomClasses() {
    if (typeof window !== 'undefined' && window.DOMParser && window.XMLSerializer) {
        return { DOMParserClass: window.DOMParser, XMLSerializerClass: window.XMLSerializer };
    }
    return { DOMParserClass: XmlDomParser, XMLSerializerClass: XmlDomSerializer };
}

/**
 * Convert 1-based number to alphabetic list string (1 -> a, 2 -> b, ..., 26 -> z, 27 -> aa)
 */
export function numberToAlphabetic(num, uppercase = false) {
    let result = '';
    let n = num;
    while (n > 0) {
        const rem = (n - 1) % 26;
        result = String.fromCharCode((uppercase ? 65 : 97) + rem) + result;
        n = Math.floor((n - 1) / 26);
    }
    return result || (uppercase ? 'A' : 'a');
}

/**
 * Parse word/numbering.xml to identify list formats, levels, and indentations
 */
export function parseNumberingXml(numberingDoc) {
    const abstractNums = new Map();
    const nums = new Map();
    if (!numberingDoc) return { abstractNums, nums };

    const abstractNumNodes = Array.from(numberingDoc.getElementsByTagName('w:abstractNum'));
    for (const absNode of abstractNumNodes) {
        const absId = absNode.getAttribute('w:abstractNumId');
        if (!absId) continue;
        const levels = new Map();
        const lvlNodes = Array.from(absNode.getElementsByTagName('w:lvl'));
        for (const lvlNode of lvlNodes) {
            const ilvl = lvlNode.getAttribute('w:ilvl') || '0';
            const numFmtNode = lvlNode.getElementsByTagName('w:numFmt')[0];
            const numFmt = numFmtNode ? (numFmtNode.getAttribute('w:val') || '') : '';
            const lvlTextNode = lvlNode.getElementsByTagName('w:lvlText')[0];
            const lvlText = lvlTextNode ? (lvlTextNode.getAttribute('w:val') || '%1.') : '%1.';
            const startNode = lvlNode.getElementsByTagName('w:start')[0];
            const start = startNode ? parseInt(startNode.getAttribute('w:val') || '1', 10) : 1;

            let ind = null;
            const pPr = lvlNode.getElementsByTagName('w:pPr')[0];
            if (pPr) {
                const indNode = pPr.getElementsByTagName('w:ind')[0];
                if (indNode) {
                    ind = {
                        left: indNode.getAttribute('w:left') || '',
                        hanging: indNode.getAttribute('w:hanging') || '',
                        firstLine: indNode.getAttribute('w:firstLine') || ''
                    };
                }
            }

            levels.set(ilvl, { numFmt, lvlText, start, ind });
        }
        abstractNums.set(absId, levels);
    }

    const numNodes = Array.from(numberingDoc.getElementsByTagName('w:num'));
    for (const numNode of numNodes) {
        const numId = numNode.getAttribute('w:numId');
        if (!numId) continue;
        const absIdNode = numNode.getElementsByTagName('w:abstractNumId')[0];
        const absId = absIdNode ? absIdNode.getAttribute('w:val') : null;
        const lvlOverrides = new Map();
        const overrideNodes = Array.from(numNode.getElementsByTagName('w:lvlOverride'));
        for (const ov of overrideNodes) {
            const ilvl = ov.getAttribute('w:ilvl') || '0';
            const startOvNode = ov.getElementsByTagName('w:startOverride')[0];
            if (startOvNode) {
                const startVal = parseInt(startOvNode.getAttribute('w:val') || '1', 10);
                lvlOverrides.set(ilvl, startVal);
            }
        }
        nums.set(numId, { abstractNumId: absId, lvlOverrides });
    }

    return { abstractNums, nums };
}

/**
 * Check whether a DOM node or any of its descendants contains graphical elements:
 * DrawingML (<w:drawing>), VML shapes/pictures (<w:pict>), Markup Compatibility
 * AlternateContent (<mc:AlternateContent>), or embedded objects (<w:object>).
 */
export function hasGraphicalElements(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = node.nodeName;
    if (tag === 'w:drawing' || tag === 'w:pict' || tag === 'mc:AlternateContent' || tag === 'w:object') {
        return true;
    }
    return (
        node.getElementsByTagName('w:drawing').length > 0 ||
        node.getElementsByTagName('w:pict').length > 0 ||
        node.getElementsByTagName('mc:AlternateContent').length > 0 ||
        node.getElementsByTagName('w:object').length > 0
    );
}

/**
 * Check whether a run contains graphical elements, tab stops (<w:tab>),
 * line/page breaks (<w:br>), carriage returns (<w:cr>), symbols, or field codes.
 * These runs must NEVER be deleted, merged, or lost during transformation.
 */
export function hasSpecialRunElements(node) {
    if (!node || node.nodeType !== 1) return false;
    if (hasGraphicalElements(node)) return true;
    const specialTags = ['w:tab', 'w:br', 'w:cr', 'w:sym', 'w:fldSimple', 'w:fldChar', 'w:footnoteReference', 'w:endnoteReference'];
    for (const tag of specialTags) {
        if (node.getElementsByTagName(tag).length > 0) return true;
    }
    return false;
}

/**
 * Comprehensive Roman numerals, numbers, dates, circulars, and technical codes regex
 */
const ROMAN_PART = '(?:M{1,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})|M{0,4}(?:CM|CD|D?C{1,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})|M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{1,3}|L)(?:IX|IV|V?I{0,3})|M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{1,3}|V))';

export const LATIN_OR_NUM_REGEX = new RegExp(
    '(\\b\\d{1,4}[-/]\\d{1,2}[-/]\\d{2,4}\\b|' +
    '\\b\\d+(?:\\.\\d+)+(?:\\([a-zA-Z0-9]+\\))?|' +
    '\\b\\d+/\\d+\\b|' +
    '\\b' + ROMAN_PART + '\\b|' +
    '\\((?:[iIvVxX]+)\\)|' +
    '\\b[A-Z0-9]{3,}\\b|' +
    '\\b\\d+\\b)',
    'g'
);

/**
 * Splits text into Hindi Devanagari segments (for Kruti Dev encoding with Kruti Dev 010 font)
 * and Protected Non-Devanagari segments (dots, numbers, Roman numerals, list markers, punctuation
 * with Times New Roman font).
 */
export function splitIntoKrutiAndLatinSegments(text) {
    if (!text) return [];
    const segments = [];
    // Strictly match Devanagari words (and whitespace between Devanagari words).
    // NEVER include '.' or punctuation or Latin/digits inside Devanagari runs!
    // Punctuation like '.' in Kruti Dev font is the glyph for half-letter 'ण्' (halant).
    // Keeping punctuation in separate runs with Times New Roman ensures genuine English dots (U+002E).
    const devRegex = /[\u0900-\u097F]+(?:\s+[\u0900-\u097F]+)*/g;
    let lastIdx = 0;
    let match;

    while ((match = devRegex.exec(text)) !== null) {
        if (match.index > lastIdx) {
            segments.push({
                text: text.substring(lastIdx, match.index),
                isLatin: true // Non-Devanagari (dots, numbers, Roman numerals, list markers, Latin words, punctuation)
            });
        }
        segments.push({
            text: match[0],
            isLatin: false // Pure Devanagari Hindi text
        });
        lastIdx = match.index + match[0].length;
    }

    if (lastIdx < text.length) {
        segments.push({
            text: text.substring(lastIdx),
            isLatin: true
        });
    }

    return segments.filter(s => s.text.length > 0);
}

/**
 * Helper to set run font family in OpenXML DOM
 */
function setRunFont(doc, rPr, fontName) {
    let rFonts = rPr.getElementsByTagName('w:rFonts')[0];
    if (!rFonts) {
        rFonts = doc.createElement('w:rFonts');
        rPr.insertBefore(rFonts, rPr.firstChild);
    }
    rFonts.setAttribute('w:ascii', fontName);
    rFonts.setAttribute('w:hAnsi', fontName);
    rFonts.setAttribute('w:cs', fontName);
    if (rFonts.hasAttribute('w:asciiTheme')) rFonts.removeAttribute('w:asciiTheme');
    if (rFonts.hasAttribute('w:hAnsiTheme')) rFonts.removeAttribute('w:hAnsiTheme');
    if (rFonts.hasAttribute('w:cstheme')) rFonts.removeAttribute('w:cstheme');
    if (rFonts.hasAttribute('w:eastAsiaTheme')) rFonts.removeAttribute('w:eastAsiaTheme');
}

/**
 * Compare two run properties (<w:rPr>) to check if they have identical styling
 */
function areRPrEqual(rPr1, rPr2) {
    if (!rPr1 && !rPr2) return true;
    if (!rPr1 || !rPr2) return false;
    const getVal = (pr, tag) => {
        const el = pr.getElementsByTagName(tag)[0];
        if (!el) return 'none';
        return el.getAttribute('w:val') || 'true';
    };
    return getVal(rPr1, 'w:b') === getVal(rPr2, 'w:b') &&
           getVal(rPr1, 'w:i') === getVal(rPr2, 'w:i') &&
           getVal(rPr1, 'w:u') === getVal(rPr2, 'w:u') &&
           getVal(rPr1, 'w:sz') === getVal(rPr2, 'w:sz') &&
           getVal(rPr1, 'w:color') === getVal(rPr2, 'w:color');
}

/**
 * Append formatted Kruti Dev or Unicode runs into OpenXML paragraph DOM
 */
function appendSegmentsForRun(doc, pNode, refRun, origRPr, textToInsert, mode, options) {
    const segments = splitIntoKrutiAndLatinSegments(textToInsert);
    for (const seg of segments) {
        const newRun = doc.createElement('w:r');
        const newRPr = origRPr ? origRPr.cloneNode(true) : doc.createElement('w:rPr');

        // Strip any accidental bidi or rtl attributes from run properties to guarantee left-to-right writing
        const bidiList = Array.from(newRPr.getElementsByTagName('w:bidi'));
        bidiList.forEach(b => newRPr.removeChild(b));
        const rtlList = Array.from(newRPr.getElementsByTagName('w:rtl'));
        rtlList.forEach(r => newRPr.removeChild(r));

        // Calibrate font size for Hindi runs to offset ~25% text length expansion and prevent page spill
        if (!seg.isLatin) {
            const szEl = newRPr.getElementsByTagName('w:sz')[0];
            if (szEl) {
                const origSz = parseInt(szEl.getAttribute('w:val') || '24', 10);
                if (origSz >= 24) {
                    szEl.setAttribute('w:val', String(Math.max(20, origSz - 3)));
                } else if (origSz >= 20) {
                    szEl.setAttribute('w:val', String(Math.max(18, origSz - 2)));
                }
                const szCsEl = newRPr.getElementsByTagName('w:szCs')[0];
                if (szCsEl) {
                    szCsEl.setAttribute('w:val', szEl.getAttribute('w:val'));
                }
            }
        }

        if (mode === 'krutidev') {
            if (seg.isLatin) {
                setRunFont(doc, newRPr, 'Times New Roman');
                newRun.appendChild(newRPr);
                const newT = doc.createElement('w:t');
                newT.setAttribute('xml:space', 'preserve');
                newT.appendChild(doc.createTextNode(seg.text));
                newRun.appendChild(newT);
            } else {
                setRunFont(doc, newRPr, 'Kruti Dev 010');
                newRun.appendChild(newRPr);
                const krutiStr = unicodeToKrutiDev(seg.text, options);
                const newT = doc.createElement('w:t');
                newT.setAttribute('xml:space', 'preserve');
                newT.appendChild(doc.createTextNode(krutiStr));
                newRun.appendChild(newT);
            }
        } else {
            // Unicode Hindi
            setRunFont(doc, newRPr, seg.isLatin ? 'Times New Roman' : 'Mangal');
            newRun.appendChild(newRPr);
            const newT = doc.createElement('w:t');
            newT.setAttribute('xml:space', 'preserve');
            newT.appendChild(doc.createTextNode(seg.text));
            newRun.appendChild(newT);
        }
        pNode.insertBefore(newRun, refRun);
    }
}

/**
 * Distribute complete sentence translation across multiple formatted runs.
 * Preserves character-level formatting (bold, underline, italic, font size, color).
 * Safeguards 100% of original embedded drawings, pictures, shapes, tabs, and images.
 */
async function distributeTranslatedRuns(doc, pNode, rNodes, fullParaText, translatedPara, mode, options) {
    if (!rNodes || rNodes.length === 0) return;
    translatedPara = cleanHindiOrdinalListMarkers(translatedPara);

    // Collect each run's original text, rPr, and graphical/special elements status
    const runInfos = rNodes.map(run => {
        let text = '';
        const tNodes = run.getElementsByTagName('w:t');
        for (let k = 0; k < tNodes.length; k++) {
            text += tNodes[k].textContent || '';
        }
        return {
            run,
            rPr: run.getElementsByTagName('w:rPr')[0],
            text,
            hasSpecial: hasSpecialRunElements(run)
        };
    });

    const runsWithText = runInfos.filter(ri => ri.text.trim().length > 0);

    // If 1 or 0 runs have text:
    if (runsWithText.length <= 1) {
        const textRunInfo = runsWithText[0];
        for (const ri of runInfos) {
            if (ri === textRunInfo) {
                if (ri.hasSpecial) {
                    // Run contains both special elements (graphics/tabs/breaks) AND text
                    // Keep special child nodes, remove old w:t nodes, and insert new translated runs before ri.run
                    const tNodes = Array.from(ri.run.getElementsByTagName('w:t'));
                    tNodes.forEach(t => ri.run.removeChild(t));
                    appendSegmentsForRun(doc, pNode, ri.run, ri.rPr, translatedPara, mode, options);
                } else {
                    appendSegmentsForRun(doc, pNode, ri.run, ri.rPr, translatedPara, mode, options);
                    pNode.removeChild(ri.run);
                }
            } else if (!ri.hasSpecial) {
                // Empty text run without any graphics or special elements can be safely pruned
                pNode.removeChild(ri.run);
            }
            // If ri.hasSpecial is true, LEAVE IT 100% INTACT!
        }
        return;
    }

    // Check if all text-containing runs share identical styling:
    const firstPr = runsWithText[0].rPr;
    const allSameStyle = runsWithText.every(ri => areRPrEqual(firstPr, ri.rPr) && !ri.hasSpecial);
    const hasTabs = pNode.getElementsByTagName('w:tab').length > 0;

    if (allSameStyle && !hasTabs) {
        // When all text runs share identical styling (standard paragraphs, headings, table cells),
        // replace them as a single cohesive sentence. This guarantees 100% word spacing and prevents fragmentation!
        appendSegmentsForRun(doc, pNode, runsWithText[0].run, firstPr, translatedPara, mode, options);
        for (const ri of runInfos) {
            if (!ri.hasSpecial && ri.run.parentNode === pNode) {
                pNode.removeChild(ri.run);
            }
        }
        return;
    }

    // Multiple runs with differing styling: distribute with whitespace preservation
    let remainingHindi = translatedPara;
    for (let i = 0; i < runsWithText.length; i++) {
        const ri = runsWithText[i];
        let runHindi = '';
        if (i === runsWithText.length - 1 || !remainingHindi.trim()) {
            runHindi = remainingHindi;
            remainingHindi = '';
        } else {
            let translatedPart = await translateEnglishToHindi(ri.text.trim(), options);
            translatedPart = ensureNoEnglishWordsRemain(translatedPart, options.preserveRoman !== false, options.customGlossary);
            translatedPart = normalizeHindiWordSpacing(translatedPart);
            const trimmedPart = translatedPart.trim();
            const idx = remainingHindi.indexOf(trimmedPart);
            if (idx !== -1) {
                const endIdx = idx + trimmedPart.length;
                runHindi = remainingHindi.substring(0, endIdx);
                // Preserve trailing whitespace from original run or separate adjacent runs
                if ((/\s$/.test(ri.text) || i < runsWithText.length - 1) && !/\s$/.test(runHindi)) {
                    runHindi += ' ';
                }
                remainingHindi = remainingHindi.substring(endIdx).replace(/^[\s\t]+/, '');
            } else {
                // If exact fragment match not found in remainingHindi, distribute by word proportion to prevent text duplication!
                const origWords = ri.text.trim().split(/\s+/).filter(Boolean);
                const remainingOrigWords = runsWithText.slice(i).reduce((acc, r) => acc + r.text.trim().split(/\s+/).filter(Boolean).length, 0);
                const hindiWords = remainingHindi.trim().split(/\s+/).filter(Boolean);

                const takeCount = remainingOrigWords > 0 
                    ? Math.max(1, Math.min(hindiWords.length, Math.round(hindiWords.length * (origWords.length / remainingOrigWords))))
                    : hindiWords.length;

                runHindi = hindiWords.slice(0, takeCount).join(' ');
                remainingHindi = hindiWords.slice(takeCount).join(' ');
                if ((/\s$/.test(ri.text) || i < runsWithText.length - 1) && !/\s$/.test(runHindi)) {
                    runHindi += ' ';
                }
            }
        }

        // Ensure zero untranslated English words remain in runHindi
        runHindi = ensureNoEnglishWordsRemain(runHindi, options.preserveRoman !== false, options.customGlossary);
        runHindi = normalizeHindiWordSpacing(runHindi);

        if (ri.hasSpecial) {
            // Keep special child nodes, remove w:t nodes, and insert translated segments
            const tNodes = Array.from(ri.run.getElementsByTagName('w:t'));
            tNodes.forEach(t => ri.run.removeChild(t));
            appendSegmentsForRun(doc, pNode, ri.run, ri.rPr, runHindi, mode, options);
        } else {
            appendSegmentsForRun(doc, pNode, ri.run, ri.rPr, runHindi, mode, options);
            pNode.removeChild(ri.run);
        }
    }

    // Clean up empty runs that have no text and no special elements
    for (const ri of runInfos) {
        if (!ri.text.trim() && !ri.hasSpecial && ri.run.parentNode === pNode) {
            pNode.removeChild(ri.run);
        }
    }
}

/**
 * Validate Generated DOCX Buffer
 * Verifies standard ZIP header, minimum size, and presence of mandatory OpenXML components.
 */
export async function validateDocxBuffer(buffer) {
    if (!buffer || buffer.length < 1000) {
        throw new Error('Generated DOCX buffer is empty or too small (< 1KB).');
    }
    // Check ZIP header magic bytes: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
        throw new Error('Generated DOCX is not a valid ZIP archive (missing PK signature).');
    }
    const zip = await JSZip.loadAsync(buffer);
    if (!zip.file('word/document.xml')) {
        throw new Error('Generated DOCX is corrupt: missing word/document.xml.');
    }
    if (!zip.file('[Content_Types].xml')) {
        throw new Error('Generated DOCX is corrupt: missing [Content_Types].xml.');
    }
    return { valid: true, size: buffer.length };
}

function detectSwrHeaderPara(fullText, hiText) {
    const raw = (fullText + ' ' + (hiText || '')).trim();
    if (/EAST\s+CENTRAL\s+RAILWAY|पूर्व\s+मध्य\s+रेलवे/i.test(raw)) return 'railway_name';
    if (/DANAPUR\s+DIVISION|दानापुर\s+मंडल/i.test(raw)) return 'division_name';
    if (/No\.?\s*[-–]?\s*[A-Za-z]\s*\/\s*SWR|क्रमांक\s+[A-Za-z\u0900-\u097F]\s*\/\s*एस\.डब्ल्यू\.आर\./i.test(raw)) return 'rule_number';
    if (/STATION\s+WORKING\s+RULES\s+OF|स्टेशन\s+के\s+स्टेशन\s+नियम/i.test(raw)) return 'station_rules_title';
    if (/BROAD\s+GA(?:G|UG)E|ब्रॉड\s+गेज/i.test(raw)) return 'gauge';
    if (/Date\s+of\s+Issue|जारी\s+करने\s+की\s+तारीख/i.test(raw)) return 'issue_date';
    if (/Date\s+(?:brought\s+in\s+force|of\s+bringing\s+into\s+force)|लागू\s+होने\s+की\s+तारीख/i.test(raw)) return 'force_date';
    return null;
}

function isItem1Heading(fullText, hiText) {
    const raw = (fullText + ' ' + (hiText || '')).trim();
    return /^1\s*[\.:]\s*(?:STATION\s+WORKING\s+RULE\s+DIAGRAM|स्टेशन\s+कार्य\s+नियम\s+आरेख)/i.test(raw);
}

/**
 * High-Fidelity In-Place DOCX XML Transformation
 * Manipulates word/document.xml directly inside the DOCX ZIP archive.
 * Preserves 100% of original embedded media, images, drawings, alignments, margins, tabs, and tables.
 * Accurately tracks actual completed work units from 0% to 100%.
 */
export async function transformDocxBuffer(originalBuffer, options = {}) {
    const { mode = 'krutidev', onProgress = null, checkCancelled = null } = options;
    const { DOMParserClass, XMLSerializerClass } = getXmlDomClasses();
    let detectedStationName = 'वजीरगंज';

    function report(done, total, desc, details = {}) {
        if (typeof onProgress === 'function') {
            onProgress(done, total, desc, details);
        }
    }

    if (checkCancelled && checkCancelled()) {
        throw new Error('DOCX generation cancelled by user');
    }

    const zip = await JSZip.loadAsync(originalBuffer);
    if (checkCancelled && checkCancelled()) {
        throw new Error('DOCX generation cancelled by user');
    }

    // Collect all XML files to transform (document + headers + footers + footnotes + endnotes + comments + glossary)
    const xmlFileNames = Object.keys(zip.files).filter(name =>
        /^word\/(document|header\d+|footer\d+|footnotes\d*|endnotes\d*|comments\d*)\.xml$/.test(name) ||
        name === 'word/glossary/document.xml'
    );

    // Parse word/numbering.xml to identify automatic list styles and numbering sequences
    let numberingData = { abstractNums: new Map(), nums: new Map() };
    const numberingXmlFile = zip.file('word/numbering.xml');
    if (numberingXmlFile) {
        try {
            const numXmlStr = await numberingXmlFile.async('text');
            const numDoc = new DOMParserClass().parseFromString(numXmlStr, 'text/xml');
            numberingData = parseNumberingXml(numDoc);
        } catch (numErr) {
            console.warn('[DOCX Generator] Failed to parse word/numbering.xml:', numErr);
        }
    }
    const listCounters = new Map();

    // Pre-parse DOMs to count total paragraphs for genuine work measurement
    const parsedParts = [];
    let totalParagraphs = 0;
    for (const fileName of xmlFileNames) {
        const xmlStr = await zip.file(fileName).async('text');
        const doc = new DOMParserClass().parseFromString(xmlStr, 'text/xml');
        const pNodes = Array.from(doc.getElementsByTagName('w:p'));
        parsedParts.push({ fileName, doc, pNodes });
        totalParagraphs += pNodes.length;
    }

    // Total units of genuine work:
    // 1 unit: Unpacking archive & reading structure
    // 1 unit: Cataloging components, tables, styles, and image relationships
    // totalParagraphs units: Processing paragraphs & text runs
    // 1 unit: Serializing updated XML parts
    // 5 units: Generating & compressing DOCX ZIP package (mapped from JSZip metadata.percent)
    // 1 unit: Validating output DOCX integrity
    const TOTAL_UNITS = totalParagraphs > 0 ? (totalParagraphs + 9) : 9;

    report(1, TOTAL_UNITS, 'Read original Word DOCX archive structure...');
    report(
        2,
        TOTAL_UNITS,
        `Cataloged ${totalParagraphs} paragraphs across ${xmlFileNames.length} document parts. Beginning transformation...`,
        { completedParagraphs: 0, totalParagraphs }
    );

    // Translation cache so identical paragraphs/phrases are translated quickly without redundant network calls
    const translationCache = new Map();
    async function getTranslatedParagraph(text) {
        const trimmed = text.trim();
        if (!trimmed) return '';
        if (translationCache.has(trimmed)) return translationCache.get(trimmed);
        let translated = await translateEnglishToHindi(trimmed, options);
        translated = cleanHindiOrdinalListMarkers(translated);
        translated = ensureNoEnglishWordsRemain(translated, options.preserveRoman !== false, options.customGlossary);
        translated = cleanHindiOrdinalListMarkers(translated);
        translated = normalizeHindiWordSpacing(translated);
        translationCache.set(trimmed, translated);
        return translated;
    }

    let processedParas = 0;
    const BATCH_SIZE = totalParagraphs > 150 ? 10 : (totalParagraphs > 50 ? 5 : 1);

    for (const part of parsedParts) {
        const { fileName, doc, pNodes } = part;

        // Step A: Ensure table rows have cantSplit and eliminate rogue page breaks/keepNext inside table cells
        const tblNodes = Array.from(doc.getElementsByTagName('w:tbl'));
        for (const tbl of tblNodes) {
            const trNodes = Array.from(tbl.getElementsByTagName('w:tr'));
            for (const tr of trNodes) {
                let trPr = tr.getElementsByTagName('w:trPr')[0];
                if (!trPr) {
                    trPr = doc.createElement('w:trPr');
                    tr.insertBefore(trPr, tr.firstChild);
                }
                let cantSplit = trPr.getElementsByTagName('w:cantSplit')[0];
                if (!cantSplit) {
                    cantSplit = doc.createElement('w:cantSplit');
                    trPr.appendChild(cantSplit);
                }

                const tcList = Array.from(tr.getElementsByTagName('w:tc'));
                for (const tc of tcList) {
                    const pList = Array.from(tc.getElementsByTagName('w:p'));
                    for (const cellP of pList) {
                        const cellPPr = cellP.getElementsByTagName('w:pPr')[0];
                        if (cellPPr) {
                            // Remove pageBreakBefore from table cells to prevent rows jumping onto next page
                            const pbbList = Array.from(cellPPr.getElementsByTagName('w:pageBreakBefore'));
                            pbbList.forEach(pbb => cellPPr.removeChild(pbb));

                            // Remove keepNext from table cells to prevent awkward row pushing
                            const knList = Array.from(cellPPr.getElementsByTagName('w:keepNext'));
                            knList.forEach(kn => cellPPr.removeChild(kn));

                            // Normalize excessive spacing inside table cells
                            const spList = Array.from(cellPPr.getElementsByTagName('w:spacing'));
                            for (const sp of spList) {
                                const afterVal = parseInt(sp.getAttribute('w:after') || '0', 10);
                                if (afterVal > 240) sp.setAttribute('w:after', '100');
                                const beforeVal = parseInt(sp.getAttribute('w:before') || '0', 10);
                                if (beforeVal > 240) sp.setAttribute('w:before', '0');
                            }
                        }

                        // Remove explicit page breaks (<w:br w:type="page"/>) inside table cells
                        const brList = Array.from(cellP.getElementsByTagName('w:br'));
                        for (const br of brList) {
                            if (br.getAttribute('w:type') === 'page') {
                                br.parentNode.removeChild(br);
                            }
                        }
                    }
                }
            }
        }

        // Step B: Process each paragraph
        for (const pNode of pNodes) {
            if (checkCancelled && checkCancelled()) {
                throw new Error('DOCX generation cancelled by user');
            }

            // Strip any accidental bidi or right-to-left direction from paragraph properties to ensure left-to-right writing
            let pPr = pNode.getElementsByTagName('w:pPr')[0];
            if (!pPr) {
                pPr = doc.createElement('w:pPr');
                pNode.insertBefore(pPr, pNode.firstChild);
            }
            const bidiList = Array.from(pPr.getElementsByTagName('w:bidi'));
            bidiList.forEach(b => pPr.removeChild(b));
            const rtlList = Array.from(pPr.getElementsByTagName('w:rtl'));
            rtlList.forEach(r => pPr.removeChild(r));

            // Remove soft lastRenderedPageBreak tags so they do not artificially fracture paragraphs
            const lrList = Array.from(pNode.getElementsByTagName('w:lastRenderedPageBreak'));
            for (const lr of lrList) {
                lr.parentNode.removeChild(lr);
            }

            // Normalize only excessive paragraph spacing (>240 dxa) without squashing natural paragraph margins
            let spEl = pPr.getElementsByTagName('w:spacing')[0];
            if (spEl) {
                const afterVal = parseInt(spEl.getAttribute('w:after') || '0', 10);
                if (afterVal > 240) spEl.setAttribute('w:after', '120');
                const beforeVal = parseInt(spEl.getAttribute('w:before') || '0', 10);
                if (beforeVal > 240) spEl.setAttribute('w:before', '60');
            }

            let rNodes = Array.from(pNode.getElementsByTagName('w:r'));
            if (rNodes.length > 0) {
                // Step 1: Merge adjacent runs with identical styling to prevent artificial fragmentation
                // CRITICAL: NEVER merge any run containing graphical elements (w:drawing, w:pict, etc.) or special elements (w:tab, w:br)
                for (let j = 0; j < rNodes.length - 1; j++) {
                    const curr = rNodes[j];
                    const next = rNodes[j + 1];

                    if (hasSpecialRunElements(curr) || hasSpecialRunElements(next)) {
                        continue;
                    }
                    if (curr.nextSibling !== next) {
                        continue;
                    }

                    const currPr = curr.getElementsByTagName('w:rPr')[0];
                    const nextPr = next.getElementsByTagName('w:rPr')[0];

                    if (areRPrEqual(currPr, nextPr)) {
                        const currT = curr.getElementsByTagName('w:t')[0];
                        const nextT = next.getElementsByTagName('w:t')[0];
                        if (currT && nextT) {
                            currT.textContent = (currT.textContent || '') + (nextT.textContent || '');
                            currT.setAttribute('xml:space', 'preserve');
                            pNode.removeChild(next);
                            rNodes.splice(j + 1, 1);
                            j--;
                        }
                    }
                }

                // Extract raw paragraph text
                let fullParaText = '';
                for (let rIdx = 0; rIdx < rNodes.length; rIdx++) {
                    const r = rNodes[rIdx];
                    const tNodes = r.getElementsByTagName('w:t');
                    let runText = '';
                    for (let k = 0; k < tNodes.length; k++) {
                        runText += tNodes[k].textContent || '';
                    }
                    // Preserve space at run boundaries if adjacent runs represent separate words
                    if (fullParaText && runText &&
                        /[A-Za-z0-9\u0900-\u097F]$/.test(fullParaText) &&
                        /^[A-Za-z0-9\u0900-\u097F]/.test(runText)) {
                        fullParaText += ' ';
                    }
                    fullParaText += runText;
                }

                // Check Microsoft Word automatic numbering (Requirement 2 & Requirement 3):
                const numPr = pPr ? pPr.getElementsByTagName('w:numPr')[0] : null;
                if (numPr) {
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
                            if (levelDef && (levelDef.numFmt === 'lowerLetter' || levelDef.numFmt === 'upperLetter')) {
                                // Word automatic alphabetic list marker (e.g. (a), (b), (c) -> (ए), (बी), (सी))
                                const listKey = `${numId}_${ilvl}`;
                                let count = listCounters.get(listKey);
                                if (count === undefined) {
                                    count = numEntry.lvlOverrides.has(ilvl) ? numEntry.lvlOverrides.get(ilvl) : levelDef.start;
                                } else {
                                    count += 1;
                                }
                                listCounters.set(listKey, count);

                                const isUpper = levelDef.numFmt === 'upperLetter';
                                const letter = numberToAlphabetic(count, isUpper);
                                const rawMarker = levelDef.lvlText.replace(/%1/g, letter);
                                const hindiMarker = convertAlphabeticListMarkers(rawMarker);

                                // Preserve paragraph list indentation and hanging indent
                                let indEl = pPr.getElementsByTagName('w:ind')[0];
                                if (!indEl) {
                                    indEl = doc.createElement('w:ind');
                                    pPr.appendChild(indEl);
                                }
                                if (levelDef.ind) {
                                    if (levelDef.ind.left && !indEl.getAttribute('w:left')) {
                                        indEl.setAttribute('w:left', levelDef.ind.left);
                                    }
                                    if (levelDef.ind.hanging && !indEl.getAttribute('w:hanging')) {
                                        indEl.setAttribute('w:hanging', levelDef.ind.hanging);
                                    }
                                    if (levelDef.ind.firstLine && !indEl.getAttribute('w:firstLine')) {
                                        indEl.setAttribute('w:firstLine', levelDef.ind.firstLine);
                                    }
                                } else {
                                    if (!indEl.getAttribute('w:left')) indEl.setAttribute('w:left', '720');
                                    if (!indEl.getAttribute('w:hanging')) indEl.setAttribute('w:hanging', '360');
                                }

                                // Remove <w:numPr> so Word does not display the English letter
                                pPr.removeChild(numPr);

                                // Prepend converted Hindi list marker to the paragraph text
                                fullParaText = `${hindiMarker} ${fullParaText}`.trim();
                            }
                            // NOTE: For lowerRoman, upperRoman, and decimal, numPr is kept intact so Word renders Roman numerals!
                            if (levelDef && (levelDef.numFmt === 'lowerRoman' || levelDef.numFmt === 'upperRoman')) {
                                const romanCheck = extractRomanListPrefix(fullParaText);
                                if (romanCheck.prefix) {
                                    // Paragraph text already has explicit Roman numeral typed in it -> remove numPr to prevent duplicate "(i) (i)" in Word!
                                    pPr.removeChild(numPr);
                                }
                            }
                        }
                    } else if (/^\s*\d+(?:\.\d+)+\.?(\s+|$)/.test(fullParaText)) {
                        // Section Numbering Deduplication (Requirement 5):
                        // If paragraph text ALREADY explicitly contains the section number (e.g. "2.5.3")
                        pPr.removeChild(numPr);
                    }
                }

                // Deduplicate any repeated section numbering in text (e.g. "2.5.3. 2.5.3" -> "2.5.3")
                fullParaText = fullParaText.replace(/^\s*(\d+(?:\.\d+)+)\.?\s+\1\.?\s*$/g, (m, g1) => g1);
                fullParaText = fullParaText.replace(/^\s*(\d+(?:\.\d+)+)\.?\s+\1\.?\s+/g, (m, g1) => g1 + (m.includes('.') ? '. ' : ' '));

                // Ensure space between Devanagari and Latin letters (e.g. साइडिंगCAL98.90 -> साइडिंग CAL 98.90)
                fullParaText = fullParaText.replace(/([\u0900-\u097F])([A-Za-z])/g, '$1 $2');
                fullParaText = fullParaText.replace(/([A-Za-z])([\u0900-\u097F])/g, '$1 $2');

                // Ensure space between abbreviations and following numbers (e.g. CAL98.90 -> CAL 98.90, CAL65 -> CAL 65)
                fullParaText = fullParaText.replace(/\b([A-Za-z]+)(\d+(?:\.\d+)?)\b/g, '$1 $2');

                // If paragraph has text, translate and distribute runs
                if (fullParaText.trim()) {
                    let translatedPara = await getTranslatedParagraph(fullParaText);
                    // Only add space for CAL (सी.ए.एल. 65), but preserve technical codes like DP519A (डी.पी.519ए) and ODP507A (ओ.डी.पी.507ए)
                    translatedPara = translatedPara.replace(/(सी\.ए\.एल\.)(\d)/g, '$1 $2');
                    translatedPara = translatedPara.replace(/(डी\.पी\.|ओ\.डी\.पी\.)\s+(\d+[\u0900-\u097F])/g, '$1$2');
                    // Ensure normal space between Hindi words and Latin words/numbers
                    translatedPara = translatedPara.replace(/([\u0900-\u097F])([A-Za-z])/g, '$1 $2');
                    translatedPara = translatedPara.replace(/([A-Za-z])([\u0900-\u097F])/g, '$1 $2');

                    // Enforce standard SWR page boundaries so content stays strictly on its designated page matching original
                    if (fileName === 'word/document.xml') {
                        const isSection2 = /^\s*2\.\s*(?:DESCRIPTION\s+OF\s+STATION|STATION\s+DESCRIPTION|स्टेशन\s+का\s+विवरण|LVs'ku\s+dk\s+fooj.k)/i.test(fullParaText);
                        const isSection2_4 = /^\s*2\.4\s*(?:GRADIENT|ढाल|\[kky)/i.test(fullParaText);
                        const isSection3 = /^\s*3\.\s*(?:SYSTEM\s+AND\s+MEANS\s+OF\s+WORKING|कार्य\s+करने\s+की\s+प्रणाली|dk;Z\s+djus\s+dh\s+çfØ;k|dk;Z\s+djus\s+dh\s+ç.kkyh)/i.test(fullParaText);

                        if (isSection2 || isSection2_4 || isSection3) {
                            if (!pPr.getElementsByTagName('w:pageBreakBefore')[0]) {
                                const pbb = doc.createElement('w:pageBreakBefore');
                                pPr.appendChild(pbb);
                            }
                        }
                    }

                    // Check SWR Title & Front Page Block classification
                    const headerType = detectSwrHeaderPara(fullParaText, translatedPara);
                    const isItem1 = isItem1Heading(fullParaText, translatedPara);

                    if (headerType) {
                        // Enforce center alignment
                        let jcEl = pPr.getElementsByTagName('w:jc')[0];
                        if (!jcEl) {
                            jcEl = doc.createElement('w:jc');
                            pPr.appendChild(jcEl);
                        }
                        jcEl.setAttribute('w:val', 'center');

                        // Remove all left/right/hanging/firstLine indents that push text off-center or into right margin
                        const indEls = Array.from(pPr.getElementsByTagName('w:ind'));
                        indEls.forEach(ind => pPr.removeChild(ind));

                        // Remove tabs inside paragraph
                        const tabEls = Array.from(pNode.getElementsByTagName('w:tab'));
                        tabEls.forEach(tab => tab.parentNode && tab.parentNode.removeChild(tab));

                        // Compact line spacing
                        if (!spEl) {
                            spEl = doc.createElement('w:spacing');
                            pPr.appendChild(spEl);
                        }
                        spEl.setAttribute('w:after', '40');
                        spEl.setAttribute('w:before', '0');
                        spEl.setAttribute('w:line', '240');
                        spEl.setAttribute('w:lineRule', 'auto');

                        if (headerType === 'station_rules_title') {
                            let pStyleEl = pPr.getElementsByTagName('w:pStyle')[0];
                            if (!pStyleEl) {
                                pStyleEl = doc.createElement('w:pStyle');
                                pPr.insertBefore(pStyleEl, pPr.firstChild);
                            }
                            pStyleEl.setAttribute('w:val', 'Heading7');

                            const stnMatch = (fullParaText + ' ' + translatedPara).match(/(?:STATION\s+WORKING\s+RULES\s+OF\s+([A-Za-z]+)\s+STATION|([A-Za-z\u0900-\u097F]+)\s+स्टेशन\s+के\s+स्टेशन\s+नियम|othjxat)/i);
                            if (stnMatch) {
                                detectedStationName = stnMatch[1] || stnMatch[2] || 'वजीरगंज';
                            }
                        }
                    } else if (isItem1) {
                        let jcEl = pPr.getElementsByTagName('w:jc')[0];
                        if (jcEl) jcEl.setAttribute('w:val', 'both');
                    }

                    await distributeTranslatedRuns(doc, pNode, rNodes, fullParaText, translatedPara, mode, options);

                    // If SWR Header Block, enforce bold & underline run styles matching Image 2
                    if (headerType) {
                        const finalRuns = Array.from(pNode.getElementsByTagName('w:r'));
                        for (const r of finalRuns) {
                            let rPr = r.getElementsByTagName('w:rPr')[0];
                            if (!rPr) {
                                rPr = doc.createElement('w:rPr');
                                r.insertBefore(rPr, r.firstChild);
                            }
                            if (headerType === 'railway_name' || headerType === 'division_name' || 
                                headerType === 'station_rules_title' || headerType === 'gauge') {
                                if (!rPr.getElementsByTagName('w:b')[0]) {
                                    rPr.appendChild(doc.createElement('w:b'));
                                }
                                if (!rPr.getElementsByTagName('w:bCs')[0]) {
                                    rPr.appendChild(doc.createElement('w:bCs'));
                                }
                                if (!rPr.getElementsByTagName('w:u')[0]) {
                                    const u = doc.createElement('w:u');
                                    u.setAttribute('w:val', 'single');
                                    rPr.appendChild(u);
                                }
                            } else if (headerType === 'issue_date' || headerType === 'force_date') {
                                if (!rPr.getElementsByTagName('w:u')[0]) {
                                    const u = doc.createElement('w:u');
                                    u.setAttribute('w:val', 'single');
                                    rPr.appendChild(u);
                                }
                            }
                        }
                    } else if (isItem1) {
                        const finalRuns = Array.from(pNode.getElementsByTagName('w:r'));
                        for (const r of finalRuns) {
                            let rPr = r.getElementsByTagName('w:rPr')[0];
                            if (!rPr) {
                                rPr = doc.createElement('w:rPr');
                                r.insertBefore(rPr, r.firstChild);
                            }
                            if (!rPr.getElementsByTagName('w:b')[0]) {
                                rPr.appendChild(doc.createElement('w:b'));
                            }
                            if (!rPr.getElementsByTagName('w:bCs')[0]) {
                                rPr.appendChild(doc.createElement('w:bCs'));
                            }
                            if (!rPr.getElementsByTagName('w:u')[0]) {
                                const u = doc.createElement('w:u');
                                u.setAttribute('w:val', 'single');
                                rPr.appendChild(u);
                            }
                        }
                    }
                }
            }

            processedParas++;
            const curUnits = 2 + processedParas;

            if (processedParas % BATCH_SIZE === 0 || processedParas === totalParagraphs) {
                const pct = Math.round((curUnits / TOTAL_UNITS) * 100);
                report(
                    curUnits,
                    TOTAL_UNITS,
                    `Processing paragraph ${processedParas} of ${totalParagraphs} (${pct}%)...`,
                    { completedParagraphs: processedParas, totalParagraphs }
                );
                // Yield to browser event loop to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Preserve section page margins. Only set standard margins if completely missing.
        const sectPrNodes = Array.from(doc.getElementsByTagName('w:sectPr'));
        for (const sectPr of sectPrNodes) {
            let pgMar = sectPr.getElementsByTagName('w:pgMar')[0];
            if (!pgMar) {
                pgMar = doc.createElement('w:pgMar');
                pgMar.setAttribute('w:top', '907');
                pgMar.setAttribute('w:bottom', '992');
                pgMar.setAttribute('w:left', '1440');
                pgMar.setAttribute('w:right', '1440');
                pgMar.setAttribute('w:header', '431');
                pgMar.setAttribute('w:footer', '272');
                sectPr.appendChild(pgMar);
            }
        }
    }

    // Step C: Ensure Heading7 in styles.xml has centered alignment
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
        try {
            const stylesStr = await stylesFile.async('text');
            const stylesDoc = new DOMParserClass().parseFromString(stylesStr, 'text/xml');
            const heading7 = Array.from(stylesDoc.getElementsByTagName('w:style')).find(s => s.getAttribute('w:styleId') === 'Heading7');
            if (heading7) {
                let pPrEl = heading7.getElementsByTagName('w:pPr')[0];
                if (!pPrEl) {
                    pPrEl = stylesDoc.createElement('w:pPr');
                    heading7.appendChild(pPrEl);
                }
                let jc = pPrEl.getElementsByTagName('w:jc')[0];
                if (!jc) {
                    jc = stylesDoc.createElement('w:jc');
                    pPrEl.appendChild(jc);
                }
                jc.setAttribute('w:val', 'center');

                let rPrEl = heading7.getElementsByTagName('w:rPr')[0];
                if (!rPrEl) {
                    rPrEl = stylesDoc.createElement('w:rPr');
                    heading7.appendChild(rPrEl);
                }
                if (!rPrEl.getElementsByTagName('w:u')[0]) {
                    const u = stylesDoc.createElement('w:u');
                    u.setAttribute('w:val', 'single');
                    rPrEl.appendChild(u);
                }
                if (!rPrEl.getElementsByTagName('w:b')[0]) {
                    const b = stylesDoc.createElement('w:b');
                    rPrEl.appendChild(b);
                }
                const modifiedStyles = new XMLSerializerClass().serializeToString(stylesDoc);
                zip.file('word/styles.xml', modifiedStyles);
            }
        } catch (e) {
            console.warn('[DOCX Generator] Could not update styles.xml Heading7:', e);
        }
    }

    // Step C.1: Header Injection if document does not already have header parts
    const existingHeaderKeys = Object.keys(zip.files).filter(name => /^word\/header\d+\.xml$/.test(name));
    if (existingHeaderKeys.length === 0) {
        try {
            const stnHindi = (detectedStationName.toUpperCase() === 'WAZIRGANJ' || detectedStationName === 'वजीरगंज')
                ? 'वजीरगंज'
                : (DEFAULT_RAILWAY_GLOSSARY[detectedStationName] || detectedStationName);
            const stnKruti = unicodeToKrutiDev(stnHindi);
            const headerStationText = mode === 'krutidev' ? stnKruti : stnHindi;
            const headerFont = mode === 'krutidev' ? 'Kruti Dev 010' : 'Mangal';

            const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:pStyle w:val="Header"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:fldChar w:fldCharType="begin"/>
    </w:r>
    <w:r>
      <w:instrText xml:space="preserve"> PAGE   \\* MERGEFORMAT </w:instrText>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="separate"/>
    </w:r>
    <w:r>
      <w:rPr>
        <w:noProof/>
      </w:rPr>
      <w:t>1</w:t>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="end"/>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr>
      <w:pStyle w:val="Header"/>
      <w:jc w:val="right"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${headerFont}" w:hAnsi="${headerFont}" w:cs="${headerFont}"/>
        <w:color w:val="000000"/>
        <w:sz w:val="28"/>
        <w:szCs w:val="28"/>
      </w:rPr>
      <w:t>${headerStationText}</w:t>
    </w:r>
  </w:p>
</w:hdr>`;

            zip.file('word/header1.xml', headerXml);

            // Update word/_rels/document.xml.rels
            const relsFile = zip.file('word/_rels/document.xml.rels');
            if (relsFile) {
                let relsStr = await relsFile.async('text');
                if (!relsStr.includes('header1.xml')) {
                    const relNode = `<Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`;
                    relsStr = relsStr.replace('</Relationships>', `${relNode}</Relationships>`);
                    zip.file('word/_rels/document.xml.rels', relsStr);
                }
            }

            // Update [Content_Types].xml
            const ctFile = zip.file('[Content_Types].xml');
            if (ctFile) {
                let ctStr = await ctFile.async('text');
                if (!ctStr.includes('header1.xml')) {
                    const ctOverride = `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`;
                    ctStr = ctStr.replace('</Types>', `${ctOverride}</Types>`);
                    zip.file('[Content_Types].xml', ctStr);
                }
            }

            // Link in sectPr
            for (const part of parsedParts) {
                if (part.fileName === 'word/document.xml') {
                    const sectPrNodes = Array.from(part.doc.getElementsByTagName('w:sectPr'));
                    for (const sectPr of sectPrNodes) {
                        if (!sectPr.getElementsByTagName('w:headerReference')[0]) {
                            const headerRef = part.doc.createElement('w:headerReference');
                            headerRef.setAttribute('w:type', 'default');
                            headerRef.setAttribute('r:id', 'rIdHeader1');
                            sectPr.insertBefore(headerRef, sectPr.firstChild);
                        }
                    }
                }
            }
        } catch (hErr) {
            console.warn('[DOCX Generator] Could not inject header1.xml:', hErr);
        }
    }

    // Step C.2: Footer Injection if document does not already have footer parts
    const existingFooterKeys = Object.keys(zip.files).filter(name => /^word\/footer\d+\.xml$/.test(name));
    if (existingFooterKeys.length === 0) {
        try {
            const officerFont = mode === 'krutidev' ? 'Kruti Dev 010' : 'Mangal';
            const off1 = mode === 'krutidev' ? '( euh"k \'kekZ )' : '( मनीष शर्मा )';
            const off2 = mode === 'krutidev' ? '( jtuh\'k dqekj flag )' : '( रजनीश कुमार सिंह )';
            const off3 = mode === 'krutidev' ? '( lq/kkalq jatu )' : '( सुधांशु रंजन )';

            const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:pStyle w:val="Footer"/>
      <w:tabs>
        <w:tab w:val="center" w:pos="5040"/>
        <w:tab w:val="right" w:pos="10080"/>
      </w:tabs>
      <w:ind w:left="-400" w:right="-400"/>
      <w:rPr>
        <w:b/>
        <w:bCs/>
      </w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${officerFont}" w:hAnsi="${officerFont}" w:cs="${officerFont}"/>
        <w:b/>
        <w:bCs/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
      <w:t>${off1}</w:t>
    </w:r>
    <w:r><w:tab/></w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${officerFont}" w:hAnsi="${officerFont}" w:cs="${officerFont}"/>
        <w:b/>
        <w:bCs/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
      <w:t>${off2}</w:t>
    </w:r>
    <w:r><w:tab/></w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${officerFont}" w:hAnsi="${officerFont}" w:cs="${officerFont}"/>
        <w:b/>
        <w:bCs/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
      <w:t>${off3}</w:t>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr>
      <w:pStyle w:val="Footer"/>
      <w:tabs>
        <w:tab w:val="center" w:pos="5040"/>
        <w:tab w:val="right" w:pos="10080"/>
      </w:tabs>
      <w:ind w:left="-400" w:right="-400"/>
      <w:rPr>
        <w:b/>
        <w:bCs/>
      </w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:b/>
        <w:bCs/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
      </w:rPr>
      <w:t>CGM/S&amp;T/IRCON</w:t>
    </w:r>
    <w:r><w:tab/></w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:b/>
        <w:bCs/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
      </w:rPr>
      <w:t>Sr. DSTE/DNR</w:t>
    </w:r>
    <w:r><w:tab/></w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:b/>
        <w:bCs/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
      </w:rPr>
      <w:t>Sr. DOM/DNR</w:t>
    </w:r>
  </w:p>
</w:ftr>`;

            zip.file('word/footer1.xml', footerXml);

            // Update word/_rels/document.xml.rels
            const relsFile = zip.file('word/_rels/document.xml.rels');
            if (relsFile) {
                let relsStr = await relsFile.async('text');
                if (!relsStr.includes('footer1.xml')) {
                    const relNode = `<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
                    relsStr = relsStr.replace('</Relationships>', `${relNode}</Relationships>`);
                    zip.file('word/_rels/document.xml.rels', relsStr);
                }
            }

            // Update [Content_Types].xml
            const ctFile = zip.file('[Content_Types].xml');
            if (ctFile) {
                let ctStr = await ctFile.async('text');
                if (!ctStr.includes('footer1.xml')) {
                    const ctOverride = `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
                    ctStr = ctStr.replace('</Types>', `${ctOverride}</Types>`);
                    zip.file('[Content_Types].xml', ctStr);
                }
            }

            // Link in sectPr
            for (const part of parsedParts) {
                if (part.fileName === 'word/document.xml') {
                    const sectPrNodes = Array.from(part.doc.getElementsByTagName('w:sectPr'));
                    for (const sectPr of sectPrNodes) {
                        if (!sectPr.getElementsByTagName('w:footerReference')[0]) {
                            const footerRefDefault = part.doc.createElement('w:footerReference');
                            footerRefDefault.setAttribute('w:type', 'default');
                            footerRefDefault.setAttribute('r:id', 'rIdFooter1');
                            sectPr.appendChild(footerRefDefault);

                            const footerRefFirst = part.doc.createElement('w:footerReference');
                            footerRefFirst.setAttribute('w:type', 'first');
                            footerRefFirst.setAttribute('r:id', 'rIdFooter1');
                            sectPr.appendChild(footerRefFirst);
                        }
                    }
                }
            }
        } catch (fErr) {
            console.warn('[DOCX Generator] Could not inject footer1.xml:', fErr);
        }
    }

    // Step D: Update modified XML files in the ZIP archive
    const serializeUnits = 2 + totalParagraphs + 1;
    report(
        serializeUnits,
        TOTAL_UNITS,
        'Updating document XML parts with converted text and preserved styles...',
        { completedParagraphs: totalParagraphs, totalParagraphs }
    );
    for (const part of parsedParts) {
        const modifiedXml = new XMLSerializerClass().serializeToString(part.doc);
        zip.file(part.fileName, modifiedXml);
    }

    // Step E: Compress final DOCX ZIP package with real progression
    let lastZipStep = 0;
    const transformedBytes = await zip.generateAsync(
        {
            type: 'uint8array',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        },
        (metadata) => {
            if (checkCancelled && checkCancelled()) {
                throw new Error('DOCX generation cancelled by user');
            }
            const zipStep = Math.min(5, Math.floor((metadata.percent / 100) * 5));
            if (zipStep !== lastZipStep) {
                lastZipStep = zipStep;
                const curUnits = 2 + totalParagraphs + 1 + zipStep;
                const pct = Math.round((curUnits / TOTAL_UNITS) * 100);
                report(
                    curUnits,
                    TOTAL_UNITS,
                    `Compressing DOCX ZIP package (${Math.round(metadata.percent)}%)...`,
                    { zipPercent: metadata.percent }
                );
            }
        }
    );

    // Step F: Validate generated DOCX integrity and OpenXML structures
    const validationUnits = 2 + totalParagraphs + 1 + 5;
    report(
        validationUnits,
        TOTAL_UNITS,
        'Validating generated DOCX integrity and XML structure...',
        { stage: 'validation' }
    );
    await validateDocxBuffer(transformedBytes);

    // Final Completion
    report(
        TOTAL_UNITS,
        TOTAL_UNITS,
        'Word DOCX generated, validated, and ready for download (100%).',
        { stage: 'completed' }
    );

    return transformedBytes;
}

/**
 * Generate and download a DOCX file from original buffer, document AST, multi-page data, or plain text.
 * @param {Object} options
 * @param {ArrayBuffer|Uint8Array} options.originalDocxBuffer - Original uploaded DOCX buffer for in-place transformation
 * @param {Array} options.ast - Document AST from docxExtractor
 * @param {Array} options.pagesData - Array of page records for multi-page documents (up to 300+ pages)
 * @param {string} options.text - Raw text fallback if AST not present
 * @param {string} options.mode - 'krutidev' or 'unicode'
 * @param {boolean} options.preserveFormatting - Whether to use in-place transformation or AST formatting
 * @param {string} options.filename - Download filename
 * @param {Function} options.onProgress - Progress callback (done, total, desc, details)
 * @param {Function} options.checkCancelled - Cancellation check function
 */
export async function downloadDocx(options) {
    const {
        originalDocxBuffer = null,
        ast = null,
        pagesData = null,
        text = '',
        mode = 'krutidev', // 'krutidev' | 'unicode'
        preserveFormatting = true,
        filename = 'converted_document.docx',
        onProgress = null,
        checkCancelled = null
    } = options;

    // High-Fidelity In-Place DOCX XML transformation if original DOCX buffer is present
    if (originalDocxBuffer && preserveFormatting) {
        const transformedBytes = await transformDocxBuffer(originalDocxBuffer, {
            ...options,
            mode,
            hindiText: text || options.hindiText,
            onProgress,
            checkCancelled
        });
        if (onProgress) {
            onProgress(100, 100, 'Word DOCX ready for download (100%).');
        }
        const blob = new Blob([transformedBytes], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        saveAs(blob, filename);
        return blob;
    }

    const fontName = mode === 'krutidev' ? 'Kruti Dev 010' : 'Mangal';
    const children = [];

    if (pagesData && pagesData.length > 0) {
        // Multi-page document generation (up to 300+ pages)
        const totalPagesCount = pagesData.length;
        const totalUnits = totalPagesCount + 4;

        for (let i = 0; i < totalPagesCount; i++) {
            if (checkCancelled && checkCancelled()) {
                throw new Error('DOCX generation cancelled by user');
            }
            if (onProgress) {
                onProgress(i + 1, totalUnits, `Building DOCX page ${i + 1} of ${totalPagesCount}...`);
            }
            const page = pagesData[i];

            // Insert preserved page images (diagrams, track layouts, scanned diagrams)
            if (page.images && page.images.length > 0) {
                for (const img of page.images) {
                    const imgBuffer = img.uint8Array || img.data;
                    if (imgBuffer) {
                        const aspect = (img.width && img.height) ? (img.width / img.height) : (4 / 3);
                        const renderWidth = Math.min(img.width || 450, 480);
                        const renderHeight = Math.max(Math.round(renderWidth / aspect), 40);
                        try {
                            children.push(new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new ImageRun({
                                        data: imgBuffer,
                                        transformation: {
                                            width: renderWidth,
                                            height: renderHeight
                                        }
                                    })
                                ]
                            }));
                        } catch (imgErr) {
                            console.warn('[DOCX Generation] Could not embed image into DOCX:', imgErr);
                        }
                    }
                }
            }

            const pageText = page.hindiText || page.originalText || '';
            const lines = pageText.split('\n');

            // Adaptive font size & spacing based on page density so page content strictly stays on 1 page without overflow
            const nonEmptyLineCount = lines.filter(l => l.trim().length > 0).length;
            let pageFontSize = 22; // 11pt default
            let paraSpacingAfter = 40; // 2pt
            if (nonEmptyLineCount > 40) {
                pageFontSize = 18; // 9pt for dense pages (prevents overflow past page boundary)
                paraSpacingAfter = 20;
            } else if (nonEmptyLineCount > 28) {
                pageFontSize = 20; // 10pt for medium-dense pages
                paraSpacingAfter = 30;
            }

            for (const line of lines) {
                if (!line.trim()) {
                    children.push(new Paragraph({
                        spacing: { before: 0, after: 20, line: 120 },
                        children: [new TextRun({ text: '' })]
                    }));
                    continue;
                }
                const runs = createParagraphRunsFromText(line, mode, {}, pageFontSize);
                children.push(new Paragraph({
                    spacing: { before: 0, after: paraSpacingAfter, line: 240 },
                    children: runs
                }));
            }

            // Insert page break between pages (except after last page)
            if (i < totalPagesCount - 1) {
                children.push(new Paragraph({
                    children: [new PageBreak()]
                }));
            }

            if (i % 5 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    } else if (preserveFormatting && ast && ast.length > 0) {
        // Build document from AST
        const totalItems = ast.length;
        const totalUnits = totalItems + 4;

        for (let i = 0; i < totalItems; i++) {
            if (checkCancelled && checkCancelled()) {
                throw new Error('DOCX generation cancelled by user');
            }
            if (onProgress) {
                onProgress(i + 1, totalUnits, `Formatting DOCX section ${i + 1} of ${totalItems}...`);
            }
            const item = ast[i];
            if (item.type === 'paragraph') {
                const docParagraph = createDocxParagraph(item, mode, fontName);
                children.push(docParagraph);
            } else if (item.type === 'table') {
                const docTable = createDocxTable(item, mode, fontName);
                children.push(docTable);
            } else if (item.type === 'image') {
                const imgBuffer = item.data || item.uint8Array;
                if (imgBuffer) {
                    const aspect = (item.width && item.height) ? (item.width / item.height) : (4 / 3);
                    const renderWidth = Math.min(item.width || 450, 480);
                    const renderHeight = Math.max(Math.round(renderWidth / aspect), 40);
                    try {
                        children.push(new Paragraph({
                            alignment: item.alignment === 'center' ? AlignmentType.CENTER : (item.alignment === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT),
                            children: [
                                new ImageRun({
                                    data: imgBuffer,
                                    transformation: {
                                        width: renderWidth,
                                        height: renderHeight
                                    }
                                })
                            ]
                        }));
                    } catch (imgErr) {
                        console.warn('[DOCX Generation] Could not embed AST image:', imgErr);
                    }
                }
            }

            if (i % 10 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    } else {
        // Build document from plain text lines
        const lines = (text || '').split('\n');
        const totalLines = Math.max(1, lines.length);
        const totalUnits = totalLines + 4;

        for (let i = 0; i < lines.length; i++) {
            if (checkCancelled && checkCancelled()) {
                throw new Error('DOCX generation cancelled by user');
            }
            if (onProgress) {
                onProgress(i + 1, totalUnits, `Formatting paragraph ${i + 1} of ${lines.length}...`);
            }
            const line = lines[i];
            if (!line.trim()) {
                children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
                continue;
            }

            const runs = createParagraphRunsFromText(line, mode);
            children.push(new Paragraph({
                children: runs
            }));

            if (i % 15 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    const currentUnits = children.length;
    const finalTotalUnits = currentUnits + 4;

    if (onProgress) {
        onProgress(currentUnits + 1, finalTotalUnits, 'Compiling DOCX document model...');
    }

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: fontName,
                        size: 24
                    }
                }
            }
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 720,
                            bottom: 720,
                            left: 720,
                            right: 720
                        }
                    }
                },
                children
            }
        ]
    });

    if (onProgress) {
        onProgress(currentUnits + 2, finalTotalUnits, 'Packing OpenXML binary package...');
    }
    const blob = await Packer.toBlob(doc);

    if (onProgress) {
        onProgress(currentUnits + 3, finalTotalUnits, 'Validating output DOCX package...');
    }
    const arrayBuffer = await blob.arrayBuffer();
    await validateDocxBuffer(new Uint8Array(arrayBuffer));

    if (onProgress) {
        onProgress(finalTotalUnits, finalTotalUnits, 'DOCX ready for download (100%).');
    }
    saveAs(blob, filename);
    return blob;
}

/**
 * Helper to split text and create docx.TextRuns with Times New Roman for Latin/punctuation/dots
 * and Kruti Dev 010 (or Mangal) for Hindi text
 */
function createParagraphRunsFromText(rawText, mode, rAst = {}, targetFontSize = null) {
    if (!rawText) return [new TextRun({ text: '' })];
    const chunks = splitIntoKrutiAndLatinSegments(rawText);
    const runs = [];
    const baseFontSize = targetFontSize || rAst.fontSize || 24;
    // Calibrate Hindi font size slightly (~10% compact) to offset text expansion
    const hindiFontSize = targetFontSize ? targetFontSize : (rAst.fontSize ? Math.max(18, Math.round(rAst.fontSize * 0.9)) : 22);

    for (const chunk of chunks) {
        const segSize = chunk.isLatin ? baseFontSize : hindiFontSize;
        if (mode === 'krutidev') {
            if (chunk.isLatin) {
                runs.push(new TextRun({
                    text: chunk.text,
                    font: { name: 'Times New Roman' },
                    bold: rAst.bold,
                    italics: rAst.italic,
                    underline: rAst.underline ? {} : undefined,
                    size: segSize,
                    color: rAst.fontColor || undefined
                }));
            } else {
                const krutiChunk = unicodeToKrutiDev(chunk.text);
                runs.push(new TextRun({
                    text: krutiChunk,
                    font: { name: 'Kruti Dev 010' },
                    bold: rAst.bold,
                    italics: rAst.italic,
                    underline: rAst.underline ? {} : undefined,
                    size: segSize,
                    color: rAst.fontColor || undefined
                }));
            }
        } else {
            // Unicode Hindi
            runs.push(new TextRun({
                text: chunk.text,
                font: { name: chunk.isLatin ? 'Times New Roman' : 'Mangal' },
                bold: rAst.bold,
                italics: rAst.italic,
                underline: rAst.underline ? {} : undefined,
                size: segSize,
                color: rAst.fontColor || undefined
            }));
        }
    }
    return runs.length > 0 ? runs : [new TextRun({ text: '' })];
}

/**
 * Convert an AST paragraph into a `docx.Paragraph`
 */
function createDocxParagraph(pAst, mode, fontName) {
    const runs = [];

    for (const rAst of pAst.runs) {
        const rawText = rAst.text;
        if (!rawText) continue;
        const segmentRuns = createParagraphRunsFromText(rawText, mode, rAst);
        runs.push(...segmentRuns);
    }

    // Alignment mapping
    let alignment = AlignmentType.LEFT;
    if (pAst.alignment === 'center') alignment = AlignmentType.CENTER;
    else if (pAst.alignment === 'right') alignment = AlignmentType.RIGHT;
    else if (pAst.alignment === 'both' || pAst.alignment === 'justify') alignment = AlignmentType.JUSTIFIED;

    // Heading mapping
    let heading = undefined;
    if (pAst.isHeading) {
        if (pAst.headingLevel === 1) heading = HeadingLevel.HEADING_1;
        else if (pAst.headingLevel === 2) heading = HeadingLevel.HEADING_2;
        else if (pAst.headingLevel === 3) heading = HeadingLevel.HEADING_3;
        else heading = HeadingLevel.HEADING_1;
    }

    return new Paragraph({
        alignment,
        heading,
        spacing: {
            before: 20,
            after: 40,
            line: 240
        },
        children: runs.length > 0 ? runs : [new TextRun({ text: '' })]
    });
}

/**
 * Convert an AST table into a `docx.Table`
 */
function createDocxTable(tblAst, mode, fontName) {
    const tableRows = [];

    for (const row of tblAst.rows) {
        const cells = [];
        for (const cell of row) {
            const cellParagraphs = [];
            for (const p of cell.paragraphs) {
                cellParagraphs.push(createDocxParagraph(p, mode, fontName));
            }
            cells.push(new TableCell({
                width: { size: 100 / (row.length || 1), type: WidthType.PERCENTAGE },
                children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ children: [] })]
            }));
        }
        tableRows.push(new TableRow({ children: cells, cantSplit: true }));
    }

    return new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
}
