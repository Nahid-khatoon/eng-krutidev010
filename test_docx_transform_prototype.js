import fs from 'fs';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { translateEnglishToHindi } from './src/services/translationEngine.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';

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

function splitIntoKrutiAndLatinSegments(text) {
    if (!text) return [];
    const segments = [];
    let lastIdx = 0;
    let match;
    LATIN_OR_NUM_REGEX.lastIndex = 0;

    while ((match = LATIN_OR_NUM_REGEX.exec(text)) !== null) {
        if (match.index > lastIdx) {
            segments.push({
                text: text.substring(lastIdx, match.index),
                isLatin: false
            });
        }
        segments.push({
            text: match[0],
            isLatin: true
        });
        lastIdx = match.index + match[0].length;
    }

    if (lastIdx < text.length) {
        segments.push({
            text: text.substring(lastIdx),
            isLatin: false
        });
    }

    return segments.filter(s => s.text.length > 0);
}

function setRunFont(doc, rPr, fontName) {
    let rFonts = rPr.getElementsByTagName('w:rFonts')[0];
    if (!rFonts) {
        rFonts = doc.createElement('w:rFonts');
        rPr.insertBefore(rFonts, rPr.firstChild);
    }
    rFonts.setAttribute('w:ascii', fontName);
    rFonts.setAttribute('w:hAnsi', fontName);
    rFonts.setAttribute('w:cs', fontName);
}

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

export async function transformDocxBuffer(originalBuffer, options = {}) {
    const { mode = 'krutidev', hindiText = null } = options;
    const zip = await JSZip.loadAsync(originalBuffer);

    // Collect all XML files to transform (document + headers + footers)
    const xmlFileNames = Object.keys(zip.files).filter(name =>
        /^word\/(document|header\d+|footer\d+)\.xml$/.test(name)
    );

    const hindiLines = (hindiText && typeof hindiText === 'string')
        ? hindiText.split('\n').filter(l => l.trim().length > 0)
        : null;
    let paraCounter = 0;

    for (const fileName of xmlFileNames) {
        const xmlStr = await zip.file(fileName).async('text');
        const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
        const pNodes = Array.from(doc.getElementsByTagName('w:p'));

        for (const pNode of pNodes) {
            let rNodes = Array.from(pNode.getElementsByTagName('w:r'));
            if (rNodes.length === 0) continue;

            // Step 1: Merge adjacent runs with identical styling
            for (let j = 0; j < rNodes.length - 1; j++) {
                const curr = rNodes[j];
                const next = rNodes[j + 1];
                const currPr = curr.getElementsByTagName('w:rPr')[0];
                const nextPr = next.getElementsByTagName('w:rPr')[0];

                if (areRPrEqual(currPr, nextPr)) {
                    const currT = curr.getElementsByTagName('w:t')[0];
                    const nextT = next.getElementsByTagName('w:t')[0];
                    if (currT && nextT) {
                        currT.textContent = (currT.textContent || '') + (nextT.textContent || '');
                        pNode.removeChild(next);
                        rNodes.splice(j + 1, 1);
                        j--;
                    }
                }
            }

            // Check if there is actual text in the paragraph
            let fullParaText = '';
            for (const r of rNodes) {
                const tNodes = r.getElementsByTagName('w:t');
                for (let k = 0; k < tNodes.length; k++) {
                    fullParaText += tNodes[k].textContent || '';
                }
            }

            if (!fullParaText.trim()) continue;

            // Case A: Single run or uniform formatting across entire paragraph
            if (rNodes.length === 1) {
                const origRun = rNodes[0];
                const origRPr = origRun.getElementsByTagName('w:rPr')[0];

                let translatedPara = '';
                if (hindiLines && paraCounter < hindiLines.length) {
                    translatedPara = hindiLines[paraCounter];
                } else {
                    translatedPara = await translateEnglishToHindi(fullParaText.trim(), options);
                }
                paraCounter++;

                pNode.removeChild(origRun);

                if (mode === 'krutidev') {
                    const segments = splitIntoKrutiAndLatinSegments(translatedPara);
                    for (const seg of segments) {
                        const newRun = doc.createElement('w:r');
                        const newRPr = origRPr ? origRPr.cloneNode(true) : doc.createElement('w:rPr');
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
                        pNode.appendChild(newRun);
                    }
                } else {
                    // Unicode Hindi
                    const segments = splitIntoKrutiAndLatinSegments(translatedPara);
                    for (const seg of segments) {
                        const newRun = doc.createElement('w:r');
                        const newRPr = origRPr ? origRPr.cloneNode(true) : doc.createElement('w:rPr');
                        setRunFont(doc, newRPr, seg.isLatin ? 'Times New Roman' : 'Mangal');
                        newRun.appendChild(newRPr);
                        const newT = doc.createElement('w:t');
                        newT.setAttribute('xml:space', 'preserve');
                        newT.appendChild(doc.createTextNode(seg.text));
                        newRun.appendChild(newT);
                        pNode.appendChild(newRun);
                    }
                }
            } else {
                // Case B: Paragraph has multiple runs with DIFFERENT formatting (bold, underline, etc.)
                paraCounter++;
                for (const run of rNodes) {
                    let rText = '';
                    const tNodes = run.getElementsByTagName('w:t');
                    for (let k = 0; k < tNodes.length; k++) {
                        rText += tNodes[k].textContent || '';
                    }

                    if (!rText.trim()) continue; // keep whitespace runs untouched

                    const origRPr = run.getElementsByTagName('w:rPr')[0];
                    const translatedRun = await translateEnglishToHindi(rText, options);

                    if (mode === 'krutidev') {
                        const segments = splitIntoKrutiAndLatinSegments(translatedRun);
                        for (const seg of segments) {
                            const newRun = doc.createElement('w:r');
                            const newRPr = origRPr ? origRPr.cloneNode(true) : doc.createElement('w:rPr');
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
                            pNode.insertBefore(newRun, run);
                        }
                    } else {
                        // Unicode Hindi
                        const segments = splitIntoKrutiAndLatinSegments(translatedRun);
                        for (const seg of segments) {
                            const newRun = doc.createElement('w:r');
                            const newRPr = origRPr ? origRPr.cloneNode(true) : doc.createElement('w:rPr');
                            setRunFont(doc, newRPr, seg.isLatin ? 'Times New Roman' : 'Mangal');
                            newRun.appendChild(newRPr);
                            const newT = doc.createElement('w:t');
                            newT.setAttribute('xml:space', 'preserve');
                            newT.appendChild(doc.createTextNode(seg.text));
                            newRun.appendChild(newT);
                            pNode.insertBefore(newRun, run);
                        }
                    }
                    pNode.removeChild(run);
                }
            }
        }

        const modifiedXml = new XMLSerializer().serializeToString(doc);
        zip.file(fileName, modifiedXml);
    }

    return await zip.generateAsync({ type: 'uint8array' });
}

async function runTest() {
    const srcBuf = fs.readFileSync('test_formatting_source.docx');
    const krutiBuf = await transformDocxBuffer(srcBuf, { mode: 'krutidev' });
    fs.writeFileSync('test_formatting_krutidev.docx', krutiBuf);
    console.log('Successfully generated test_formatting_krutidev.docx (', krutiBuf.length, 'bytes)');

    const unicodeBuf = await transformDocxBuffer(srcBuf, { mode: 'unicode' });
    fs.writeFileSync('test_formatting_unicode.docx', unicodeBuf);
    console.log('Successfully generated test_formatting_unicode.docx (', unicodeBuf.length, 'bytes)');

    // Now inspect test_formatting_krutidev.docx to verify all requirements!
    const resZip = await JSZip.loadAsync(krutiBuf);
    const resXml = await resZip.file('word/document.xml').async('text');
    console.log('\n--- VERIFYING GENERATED KRUTI DEV DOCX XML ---');
    console.log('1. Center Alignment (<w:jc w:val="center"/>):', resXml.includes('<w:jc w:val="center"/>'));
    console.log('2. Justified Alignment (<w:jc w:val="both"/>):', resXml.includes('<w:jc w:val="both"/>'));
    console.log('3. Left Alignment (<w:jc w:val="left"/>):', resXml.includes('<w:jc w:val="left"/>'));
    console.log('4. Bold formatting (<w:b/>):', resXml.includes('<w:b/>'));
    console.log('5. Underline formatting (<w:u w:val="single"/> or <w:u/>):', resXml.includes('<w:u'));
    console.log('6. Roman numerals (VI, (iv), I, II, III):',
        resXml.includes('Times New Roman') && resXml.includes('>VI<') && resXml.includes('>(iv)<')
    );
    console.log('7. Numbers and dates (117/2025, 22-07-2026, 6.02(iv)):',
        resXml.includes('>117/2025<') && resXml.includes('>22-07-2026<') && resXml.includes('>6.02(iv)<')
    );
    console.log('8. Genuine Kruti Dev 010 font applied to Hindi text:', resXml.includes('Kruti Dev 010'));
    console.log('9. Document margins (<w:pgMar>):', resXml.includes('<w:pgMar'));
}

runTest();
