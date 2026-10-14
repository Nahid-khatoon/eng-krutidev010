import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import {
    Document,
    Paragraph,
    TextRun,
    Packer
} from 'docx';
import { transformDocxBuffer, validateDocxBuffer } from './src/services/docxGenerator.js';
import { krutiDevToUnicode, unicodeToKrutiDev } from './src/services/krutiDevConverter.js';
import { validateTranslationCompleteness } from './src/services/qualityValidator.js';
import {
    translateEnglishToHindi,
    cleanHindiOrdinalListMarkers,
    extractRomanListPrefix,
    ROMAN_NUMERALS_SET,
    HINDI_ORDINAL_WORDS_LIST
} from './src/services/translationEngine.js';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition, message) {
    totalChecks++;
    if (condition) {
        passedChecks++;
        console.log(`  [PASS] ${message}`);
    } else {
        console.error(`  [FAIL] ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function buildTestDocx() {
    // Construct DOCX document containing typed Roman numerals, uppercase Roman numerals,
    // delimited Roman numerals, and automatic Word numbering.xml lists
    const doc = new Document({
        sections: [{
            children: [
                // Section 1: User's exact example: (i), (ii), (iii)
                new Paragraph({ children: [new TextRun({ text: '(i) The Station Master must verify the signal.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(ii) The train must be dispatched.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(iii) Check the route.' })] }),

                // Section 2: Roman numerals (iv) through (x)
                new Paragraph({ children: [new TextRun({ text: '(iv) The train may proceed.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(v) The station must remain clear.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(vi) The signal must be checked.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(vii) The Loco Pilot must follow the instructions.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(viii) Record the details in the register.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(ix) Power On indication must be checked.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(x) The route must be verified.' })] }),

                // Section 3: Uppercase Roman Numerals (I) through (VI)
                new Paragraph({ children: [new TextRun({ text: '(I) The Station Master must verify the signal.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(II) The train must be dispatched.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(III) Check the route.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(IV) The train may proceed.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(V) The station must remain clear.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(VI) The signal must be checked.' })] }),

                // Section 4: Delimited Roman numerals: i., ii., iii., x., I., II., III.
                new Paragraph({ children: [new TextRun({ text: 'i. The Station Master must verify the signal.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'ii. The train must be dispatched.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'iii. Check the route.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'x. The route must be verified.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'I. The Station Master must verify the signal.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'II. The train must be dispatched.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'III. Check the route.' })] }),

                // Section 5: Closing parenthesis Roman numerals: i), ii), iii), (x)
                new Paragraph({ children: [new TextRun({ text: 'i) The Station Master must verify the signal.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'ii) The train must be dispatched.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'iii) Check the route.' })] }),

                // Section 6: Automatic Word Numbering Placeholders (wired into numbering.xml below)
                new Paragraph({ children: [new TextRun({ text: 'The Station Master must verify the signal.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'The train must be dispatched.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'Check the route.' })] })
            ]
        }]
    });

    const baseBuffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(baseBuffer);

    // Wire up word/numbering.xml with lowerRoman list style
    const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:abstractNum w:abstractNumId="1">
        <w:lvl w:ilvl="0">
            <w:start w:val="1"/>
            <w:numFmt w:val="lowerRoman"/>
            <w:lvlText w:val="(%1)"/>
            <w:pPr>
                <w:ind w:left="720" w:hanging="360"/>
            </w:pPr>
        </w:lvl>
    </w:abstractNum>
    <w:num w:numId="10">
        <w:abstractNumId w:val="1"/>
    </w:num>
</w:numbering>`;
    zip.file('word/numbering.xml', numberingXml);

    // Attach numbering properties to Section 6 paragraphs in word/document.xml
    const docXmlStr = await zip.file('word/document.xml').async('text');
    const parser = new XmlDomParser();
    const docXml = parser.parseFromString(docXmlStr, 'text/xml');
    const pNodes = Array.from(docXml.getElementsByTagName('w:p'));

    // Attach to last 3 paragraphs
    for (let i = pNodes.length - 3; i < pNodes.length; i++) {
        const p = pNodes[i];
        let pPr = p.getElementsByTagName('w:pPr')[0];
        if (!pPr) {
            pPr = docXml.createElement('w:pPr');
            p.insertBefore(pPr, p.firstChild);
        }
        const numPr = docXml.createElement('w:numPr');
        const ilvl = docXml.createElement('w:ilvl');
        ilvl.setAttribute('w:val', '0');
        const numId = docXml.createElement('w:numId');
        numId.setAttribute('w:val', '10');
        numPr.appendChild(ilvl);
        numPr.appendChild(numId);
        pPr.appendChild(numPr);
    }

    const serializer = new (parser.constructor) ? new (XmlDomParser) : null;
    const { XMLSerializer: XmlSerializerClass } = await import('@xmldom/xmldom');
    const serializedDoc = new XmlSerializerClass().serializeToString(docXml);
    zip.file('word/document.xml', serializedDoc);

    return await zip.generateAsync({ type: 'nodebuffer' });
}

async function runTestSuite() {
    console.log('==================================================');
    console.log('STARTING ROMAN NUMERAL & ORDINAL NUMBERING REMOVAL SUITE');
    console.log('==================================================\n');

    // ----------------------------------------------------
    // TEST PART 1: Core Unit Tests on Helper Functions
    // ----------------------------------------------------
    console.log('--- TEST PART 1: ROMAN PREFIX EXTRACTION & ORDINAL REMOVAL ---');

    // Test extractRomanListPrefix
    const p1 = extractRomanListPrefix('(i) The Station Master must verify the signal.');
    assert(p1.prefix === '(i)' && p1.content === 'The Station Master must verify the signal.', 'extractRomanListPrefix extracts (i)');

    const p2 = extractRomanListPrefix('(ii) The train must be dispatched.');
    assert(p2.prefix === '(ii)' && p2.content === 'The train must be dispatched.', 'extractRomanListPrefix extracts (ii)');

    const p3 = extractRomanListPrefix('(x) Final check.');
    assert(p3.prefix === '(x)' && p3.content === 'Final check.', 'extractRomanListPrefix extracts (x)');

    const p4 = extractRomanListPrefix('(VI) The signal must be checked.');
    assert(p4.prefix === '(VI)' && p4.content === 'The signal must be checked.', 'extractRomanListPrefix extracts (VI)');

    const p5 = extractRomanListPrefix('ii. The train must be dispatched.');
    assert(p5.prefix === 'ii.' && p5.content === 'The train must be dispatched.', 'extractRomanListPrefix extracts ii.');

    const p6 = extractRomanListPrefix('I am the Station Master.');
    assert(p6.prefix === '' && p6.content === 'I am the Station Master.', 'extractRomanListPrefix does NOT treat pronoun I as Roman list marker');

    // Test cleanHindiOrdinalListMarkers
    const c1 = cleanHindiOrdinalListMarkers('प्रथम स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।');
    assert(c1 === 'स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।', 'cleanHindiOrdinalListMarkers strips leading प्रथम');

    const c2 = cleanHindiOrdinalListMarkers('द्वितीय ट्रेन को रवाना किया जाना चाहिए।');
    assert(c2 === 'ट्रेन को रवाना किया जाना चाहिए।', 'cleanHindiOrdinalListMarkers strips leading द्वितीय');

    const c3 = cleanHindiOrdinalListMarkers('तृतीय मार्ग की जाँच करें।');
    assert(c3 === 'मार्ग की जाँच करें।', 'cleanHindiOrdinalListMarkers strips leading तृतीय');

    const c4 = cleanHindiOrdinalListMarkers('(i) प्रथम स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।');
    assert(c4 === '(i) स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।', 'cleanHindiOrdinalListMarkers strips प्रथम adjacent to (i)');

    const c5 = cleanHindiOrdinalListMarkers('(ii) द्वितीय. ट्रेन को रवाना किया जाना चाहिए।');
    assert(c5 === '(ii) ट्रेन को रवाना किया जाना चाहिए।', 'cleanHindiOrdinalListMarkers strips द्वितीय adjacent to (ii)');

    const c6 = cleanHindiOrdinalListMarkers('प्रथम श्रेणी का पास');
    assert(c6 === 'प्रथम श्रेणी का पास', 'cleanHindiOrdinalListMarkers preserves genuine "प्रथम श्रेणी" (First class)');

    // ----------------------------------------------------
    // TEST PART 2: Translation Engine on User Example
    // ----------------------------------------------------
    console.log('\n--- TEST PART 2: TRANSLATION OF EXACT USER EXAMPLE ---');
    const userExample = `(i) The Station Master must verify the signal.
(ii) The train must be dispatched.
(iii) Check the route.`;

    const transUserExample = await translateEnglishToHindi(userExample);
    console.log('Translated Output:\n' + transUserExample);

    const userLines = transUserExample.split('\n');
    assert(userLines[0] === '(i) स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।', 'Line 1 matches exact required Hindi: (i) स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।');
    assert(userLines[1] === '(ii) ट्रेन को रवाना किया जाना चाहिए।', 'Line 2 matches exact required Hindi: (ii) ट्रेन को रवाना किया जाना चाहिए।');
    assert(userLines[2] === '(iii) मार्ग की जाँच करें।', 'Line 3 matches exact required Hindi: (iii) मार्ग की जाँच करें।');

    // Verify NONE of the forbidden words appear as list markers
    for (const ord of ['प्रथम', 'द्वितीय', 'तृतीय', 'चतुर्थ', 'पंचम', 'छठा', 'छठी', 'सप्तम', 'अष्टम', 'नवम', 'दशम']) {
        const regex = new RegExp(`(^|\\n)\\s*${ord}`, 'g');
        assert(!regex.test(transUserExample), `Zero occurrence of forbidden list marker "${ord}" in output`);
    }

    // ----------------------------------------------------
    // TEST PART 3: All Roman Numerals (i) to (x) and (I) to (VI)
    // ----------------------------------------------------
    console.log('\n--- TEST PART 3: ROMAN NUMERALS (i)-(x) AND (I)-(VI) ---');
    const allRomanText = `(i) The Station Master must verify the signal.
(ii) The train must be dispatched.
(iii) Check the route.
(iv) The train may proceed.
(v) The station must remain clear.
(vi) The signal must be checked.
(vii) The Loco Pilot must follow the instructions.
(viii) Record the details in the register.
(ix) Power On indication must be checked.
(x) Check the route.
(I) The Station Master must verify the signal.
(II) The train must be dispatched.
(III) Check the route.
(IV) The train may proceed.
(V) The station must remain clear.
(VI) The signal must be checked.`;

    const transAllRoman = await translateEnglishToHindi(allRomanText);
    const romanLines = transAllRoman.split('\n');

    assert(romanLines[0].startsWith('(i) '), 'Preserves (i)');
    assert(romanLines[1].startsWith('(ii) '), 'Preserves (ii)');
    assert(romanLines[2].startsWith('(iii) '), 'Preserves (iii)');
    assert(romanLines[3].startsWith('(iv) '), 'Preserves (iv)');
    assert(romanLines[4].startsWith('(v) '), 'Preserves (v)');
    assert(romanLines[5].startsWith('(vi) '), 'Preserves (vi)');
    assert(romanLines[6].startsWith('(vii) '), 'Preserves (vii)');
    assert(romanLines[7].startsWith('(viii) '), 'Preserves (viii)');
    assert(romanLines[8].startsWith('(ix) '), 'Preserves (ix)');
    assert(romanLines[9].startsWith('(x) '), 'Preserves (x) without converting to (एक्स)');
    assert(romanLines[10].startsWith('(I) '), 'Preserves (I)');
    assert(romanLines[11].startsWith('(II) '), 'Preserves (II)');
    assert(romanLines[12].startsWith('(III) '), 'Preserves (III)');
    assert(romanLines[13].startsWith('(IV) '), 'Preserves (IV)');
    assert(romanLines[14].startsWith('(V) '), 'Preserves (V)');
    assert(romanLines[15].startsWith('(VI) '), 'Preserves (VI)');

    // ----------------------------------------------------
    // TEST PART 4: Delimited Roman Numerals (ii., iii., x., II., III.)
    // ----------------------------------------------------
    console.log('\n--- TEST PART 4: DELIMITED ROMAN NUMERALS ---');
    const delimText = `i. The Station Master must verify the signal.
ii. The train must be dispatched.
iii. Check the route.
x. Check the route.
I. The Station Master must verify the signal.
II. The train must be dispatched.
III. Check the route.`;

    const transDelim = await translateEnglishToHindi(delimText);
    const delimLines = transDelim.split('\n');

    assert(delimLines[0].startsWith('i. '), 'i. preserved without converting to प्रथम. or मैं.');
    assert(delimLines[1].startsWith('ii. '), 'ii. preserved without converting to द्वितीय.');
    assert(delimLines[2].startsWith('iii. '), 'iii. preserved without converting to तृतीय.');
    assert(delimLines[3].startsWith('x. '), 'x. preserved without converting to एक्स. or दशम.');
    assert(delimLines[4].startsWith('I. '), 'I. preserved');
    assert(delimLines[5].startsWith('II. '), 'II. preserved without converting to द्वितीय.');
    assert(delimLines[6].startsWith('III. '), 'III. preserved without converting to तृतीय.');

    // ----------------------------------------------------
    // TEST PART 5: Full DOCX In-Place Transformation & Word Inspection
    // ----------------------------------------------------
    console.log('\n--- TEST PART 5: FULL DOCX IN-PLACE TRANSFORMATION ---');
    console.log('Generating test source DOCX buffer...');
    const sourceBuffer = await buildTestDocx();
    fs.writeFileSync('test_ordinal_source.docx', sourceBuffer);
    assert(sourceBuffer.length > 5000, 'Source DOCX successfully created');

    console.log('Transforming into Hindi Unicode DOCX...');
    const unicodeDocxBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'unicode' });
    fs.writeFileSync('test_ordinal_unicode.docx', unicodeDocxBuffer);
    await validateDocxBuffer(unicodeDocxBuffer);
    assert(unicodeDocxBuffer.length > 5000, 'Unicode DOCX buffer passed OpenXML validation');

    console.log('Transforming into Kruti Dev 010 DOCX...');
    const krutiDocxBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'krutidev' });
    fs.writeFileSync('test_ordinal_krutidev.docx', krutiDocxBuffer);
    await validateDocxBuffer(krutiDocxBuffer);
    assert(krutiDocxBuffer.length > 5000, 'Kruti Dev 010 DOCX buffer passed OpenXML validation');

    // Inspect transformed Unicode DOCX XML content
    const uniZip = await JSZip.loadAsync(unicodeDocxBuffer);
    const uniDocXml = await uniZip.file('word/document.xml').async('text');
    const uniParser = new XmlDomParser();
    const uniDoc = uniParser.parseFromString(uniDocXml, 'text/xml');
    const uniParas = Array.from(uniDoc.getElementsByTagName('w:p'));

    console.log(`Inspecting ${uniParas.length} paragraphs in transformed document.xml...`);

    function getParaText(p) {
        return Array.from(p.getElementsByTagName('w:t')).map(t => t.textContent || '').join('');
    }

    // Paragraph 0: (i)
    const p0Text = getParaText(uniParas[0]);
    console.log('  Para 0 text:', p0Text);
    assert(p0Text.includes('(i)'), 'Para 0 contains (i)');
    assert(!p0Text.includes('प्रथम'), 'Para 0 does NOT contain प्रथम');

    // Paragraph 1: (ii)
    const p1Text = getParaText(uniParas[1]);
    console.log('  Para 1 text:', p1Text);
    assert(p1Text.includes('(ii)'), 'Para 1 contains (ii)');
    assert(!p1Text.includes('द्वितीय'), 'Para 1 does NOT contain द्वितीय');

    // Paragraph 2: (iii)
    const p2Text = getParaText(uniParas[2]);
    console.log('  Para 2 text:', p2Text);
    assert(p2Text.includes('(iii)'), 'Para 2 contains (iii)');
    assert(!p2Text.includes('तृतीय'), 'Para 2 does NOT contain तृतीय');

    // Paragraph 9: (x)
    const p9Text = getParaText(uniParas[9]);
    console.log('  Para 9 text:', p9Text);
    assert(p9Text.includes('(x)'), 'Para 9 contains (x)');
    assert(!p9Text.includes('(एक्स)'), 'Para 9 does NOT contain (एक्स)');
    assert(!p9Text.includes('दशम'), 'Para 9 does NOT contain दशम');

    // Check automatic Word numbering paragraphs
    const autoP1 = uniParas[uniParas.length - 3];
    const autoP2 = uniParas[uniParas.length - 2];
    const autoP3 = uniParas[uniParas.length - 1];

    assert(autoP1.getElementsByTagName('w:numPr').length > 0, 'Auto Roman Para 1 preserves w:numPr for Word native rendering');
    assert(autoP2.getElementsByTagName('w:numPr').length > 0, 'Auto Roman Para 2 preserves w:numPr for Word native rendering');
    assert(autoP3.getElementsByTagName('w:numPr').length > 0, 'Auto Roman Para 3 preserves w:numPr for Word native rendering');

    const autoP1Text = getParaText(autoP1);
    const autoP2Text = getParaText(autoP2);
    const autoP3Text = getParaText(autoP3);
    assert(!autoP1Text.includes('प्रथम'), 'Auto Roman Para 1 text contains NO प्रथम');
    assert(!autoP2Text.includes('द्वितीय'), 'Auto Roman Para 2 text contains NO द्वितीय');
    assert(!autoP3Text.includes('तृतीय'), 'Auto Roman Para 3 text contains NO तृतीय');

    // Inspect Kruti Dev 010 document for font assignments
    const krutiZip = await JSZip.loadAsync(krutiDocxBuffer);
    const krutiDocXml = await krutiZip.file('word/document.xml').async('text');
    const krutiDoc = uniParser.parseFromString(krutiDocXml, 'text/xml');
    const rFontsNodes = Array.from(krutiDoc.getElementsByTagName('w:rFonts'));

    const krutiDevRuns = rFontsNodes.filter(rf => rf.getAttribute('w:ascii') === 'Kruti Dev 010');
    const timesRuns = rFontsNodes.filter(rf => rf.getAttribute('w:ascii') === 'Times New Roman');
    console.log(`  Found ${krutiDevRuns.length} Kruti Dev 010 runs and ${timesRuns.length} Times New Roman runs in Kruti Dev DOCX`);
    assert(krutiDevRuns.length > 0, 'Kruti Dev 010 font assigned to Hindi Devanagari runs');
    assert(timesRuns.length > 0, 'Times New Roman font assigned to Roman numerals and punctuation runs');

    console.log('\n==================================================');
    console.log(`TEST SUITE RESULTS: ${passedChecks} / ${totalChecks} Checks Passed.`);
    console.log('==================================================');
    console.log('ALL ROMAN NUMERAL & ORDINAL NUMBERING REMOVAL CHECKS PASSED SUCCESSFULLY!\n');
}

runTestSuite().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
