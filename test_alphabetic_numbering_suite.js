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
import { transformDocxBuffer } from './src/services/docxGenerator.js';
import { krutiDevToUnicode } from './src/services/krutiDevConverter.js';
import { validateTranslationCompleteness } from './src/services/qualityValidator.js';
import { translateEnglishToHindi, ensureNoEnglishWordsRemain } from './src/services/translationEngine.js';

async function buildTestDocx() {
    // 1. Create base document with docx library
    const doc = new Document({
        sections: [{
            children: [
                // Section 1: Explicit Alphabetic Numbering in Text Runs (Requirement 2 & 10)
                new Paragraph({ children: [new TextRun({ text: '(a) The Station Master must verify the signal.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(b) The Loco Pilot must follow the instructions.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(c) Record the details in the register.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(d) The train must be dispatched.' })] }),

                // Section 2: Explicit Roman Numeral Numbering in Text Runs (Requirement 3 & 10)
                new Paragraph({ children: [new TextRun({ text: '(i) The station must remain clear.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(ii) The signal must be checked.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(iii) The route must be verified.' })] }),
                new Paragraph({ children: [new TextRun({ text: '(iv) The train may proceed.' })] }),

                // Section 3: NOTE and Power On Indication (Requirement 1 & 10)
                new Paragraph({ children: [new TextRun({ text: 'NOTE:', bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: 'Power On indication must be checked.' })] }),

                // Section 4: Railway Abbreviations (Requirement 4 & 10)
                new Paragraph({ children: [new TextRun({ text: 'DSTE, CSTE, SWR, VDU, HASSDAC, MACLS and IBH.' })] }),

                // Section 5: Technical Codes & Meaning Terms (Requirement 1 & 5)
                new Paragraph({ children: [new TextRun({ text: '505AXT, 505BXT, DP519A, ODP507A, S9AXT, UP and DN.' })] }),
                new Paragraph({ children: [new TextRun({ text: 'Resetting Operation of Description of Station with Counter and Busy.' })] }),

                // Section 6: Placeholders for Word Automatic Numbering (will be wired in XML)
                new Paragraph({ children: [new TextRun({ text: 'The Station Master must verify the signal.' })] }), // auto-alphabetic item 1
                new Paragraph({ children: [new TextRun({ text: 'The Loco Pilot must follow the instructions.' })] }), // auto-alphabetic item 2
                new Paragraph({ children: [new TextRun({ text: 'Record the details in the register.' })] }), // auto-alphabetic item 3
                new Paragraph({ children: [new TextRun({ text: 'The train must be dispatched.' })] }), // auto-alphabetic item 4

                new Paragraph({ children: [new TextRun({ text: 'The station must remain clear.' })] }), // auto-roman item 1
                new Paragraph({ children: [new TextRun({ text: 'The signal must be checked.' })] }), // auto-roman item 2
                new Paragraph({ children: [new TextRun({ text: 'The route must be verified.' })] }), // auto-roman item 3
                new Paragraph({ children: [new TextRun({ text: 'The train may proceed.' })] })  // auto-roman item 4
            ]
        }]
    });

    const baseBuffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(baseBuffer);

    // 2. Add word/numbering.xml:
    // abstractNum 0: lowerLetter, lvlText "(%1)", ind left 720 hanging 360
    // abstractNum 1: lowerRoman, lvlText "(%1)", ind left 720 hanging 360
    // num 1 -> abstractNum 0 (lowerLetter)
    // num 2 -> abstractNum 1 (lowerRoman)
    const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerLetter"/>
      <w:lvlText w:val="(%1)"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="lowerRoman"/>
      <w:lvlText w:val="(%1)"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
  <w:num w:numId="2">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`;
    zip.file('word/numbering.xml', numberingXml);

    // Update document.xml to attach <w:numPr> to the automatic list paragraphs
    const docXmlStr = await zip.file('word/document.xml').async('text');
    const parser = new XmlDomParser();
    const docXml = parser.parseFromString(docXmlStr, 'text/xml');
    const pList = Array.from(docXml.getElementsByTagName('w:p'));

    // Paras 13, 14, 15, 16 get numId="1" (automatic lowerLetter)
    for (let idx = 13; idx <= 16; idx++) {
        const p = pList[idx];
        let pPr = p.getElementsByTagName('w:pPr')[0];
        if (!pPr) {
            pPr = docXml.createElement('w:pPr');
            p.insertBefore(pPr, p.firstChild);
        }
        const numPr = docXml.createElement('w:numPr');
        const ilvl = docXml.createElement('w:ilvl');
        ilvl.setAttribute('w:val', '0');
        const numId = docXml.createElement('w:numId');
        numId.setAttribute('w:val', '1');
        numPr.appendChild(ilvl);
        numPr.appendChild(numId);
        pPr.appendChild(numPr);
    }

    // Paras 17, 18, 19, 20 get numId="2" (automatic lowerRoman)
    for (let idx = 17; idx <= 20; idx++) {
        const p = pList[idx];
        let pPr = p.getElementsByTagName('w:pPr')[0];
        if (!pPr) {
            pPr = docXml.createElement('w:pPr');
            p.insertBefore(pPr, p.firstChild);
        }
        const numPr = docXml.createElement('w:numPr');
        const ilvl = docXml.createElement('w:ilvl');
        ilvl.setAttribute('w:val', '0');
        const numId = docXml.createElement('w:numId');
        numId.setAttribute('w:val', '2');
        numPr.appendChild(ilvl);
        numPr.appendChild(numId);
        pPr.appendChild(numPr);
    }

    // Serialize modified document.xml back into zip
    const serializer = new (await import('@xmldom/xmldom')).XMLSerializer();
    zip.file('word/document.xml', serializer.serializeToString(docXml));

    return await zip.generateAsync({ type: 'nodebuffer' });
}

async function runTestSuite() {
    console.log('==================================================');
    console.log('STARTING ALPHABETIC NUMBERING & REQUIREMENT 10 SUITE');
    console.log('==================================================\n');

    let checksPassed = 0;
    let totalChecks = 0;
    function assert(condition, message) {
        totalChecks++;
        if (condition) {
            console.log(`  [PASS] ${message}`);
            checksPassed++;
        } else {
            console.error(`  [FAIL] ${message}`);
        }
    }

    // Step 1: Build test document
    console.log('Step 1: Generating Source DOCX with text and Word automatic lists...');
    const sourceBuffer = await buildTestDocx();
    fs.writeFileSync('test_numbering_source.docx', sourceBuffer);
    console.log('  Saved test_numbering_source.docx (' + sourceBuffer.length + ' bytes)\n');

    // Step 2: Transform into Kruti Dev 010 DOCX
    console.log('Step 2: Transforming into Kruti Dev 010 DOCX...');
    const krutiBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'krutidev' });
    fs.writeFileSync('test_numbering_krutidev.docx', krutiBuffer);
    console.log('  Saved test_numbering_krutidev.docx (' + krutiBuffer.length + ' bytes)\n');

    // Step 3: Transform into Unicode Hindi DOCX
    console.log('Step 3: Transforming into Unicode Hindi DOCX...');
    const unicodeBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'unicode' });
    fs.writeFileSync('test_numbering_unicode.docx', unicodeBuffer);
    console.log('  Saved test_numbering_unicode.docx (' + unicodeBuffer.length + ' bytes)\n');

    // Step 4: Inspect Unicode DOCX structure
    console.log('Step 4: Inspecting Transformed Unicode DOCX Content...');
    const uZip = await JSZip.loadAsync(unicodeBuffer);
    const uXmlStr = await uZip.file('word/document.xml').async('text');
    const uDoc = new XmlDomParser().parseFromString(uXmlStr, 'text/xml');
    const uParas = Array.from(uDoc.getElementsByTagName('w:p'));

    function getParaText(p) {
        const tNodes = p.getElementsByTagName('w:t');
        let text = '';
        for (let i = 0; i < tNodes.length; i++) {
            text += tNodes[i].textContent || '';
        }
        return text.trim();
    }

    // Verification of Section 1: Explicit Alphabetic Numbering (Requirement 2 & 10)
    console.log('\n--- VERIFYING SECTION 1: EXPLICIT ALPHABETIC NUMBERING ---');
    const para0 = getParaText(uParas[0]);
    const para1 = getParaText(uParas[1]);
    const para2 = getParaText(uParas[2]);
    const para3 = getParaText(uParas[3]);

    console.log('  Para 0:', para0);
    console.log('  Para 1:', para1);
    console.log('  Para 2:', para2);
    console.log('  Para 3:', para3);

    assert(para0 === '(ए) स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।', 'Para 0 matches expected: (ए) स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।');
    assert(para1 === '(बी) लोको पायलट को निर्देशों का पालन करना चाहिए।', 'Para 1 matches expected: (बी) लोको पायलट को निर्देशों का पालन करना चाहिए।');
    assert(para2 === '(सी) विवरण रजिस्टर में दर्ज करें।', 'Para 2 matches expected: (सी) विवरण रजिस्टर में दर्ज करें।');
    assert(para3 === '(डी) ट्रेन को रवाना किया जाना चाहिए।', 'Para 3 matches expected: (डी) ट्रेन को रवाना किया जाना चाहिए।');

    // Verification of Section 2: Explicit Roman Numeral Numbering (Requirement 3 & 10)
    console.log('\n--- VERIFYING SECTION 2: EXPLICIT ROMAN NUMERALS ---');
    const para4 = getParaText(uParas[4]);
    const para5 = getParaText(uParas[5]);
    const para6 = getParaText(uParas[6]);
    const para7 = getParaText(uParas[7]);

    console.log('  Para 4:', para4);
    console.log('  Para 5:', para5);
    console.log('  Para 6:', para6);
    console.log('  Para 7:', para7);

    assert(para4 === '(i) स्टेशन खाली रहना चाहिए।', 'Para 4 preserves Roman (i): (i) स्टेशन खाली रहना चाहिए।');
    assert(para5 === '(ii) सिग्नल की जाँच की जानी चाहिए।', 'Para 5 preserves Roman (ii): (ii) सिग्नल की जाँच की जानी चाहिए।');
    assert(para6 === '(iii) मार्ग की पुष्टि की जानी चाहिए।', 'Para 6 preserves Roman (iii): (iii) मार्ग की पुष्टि की जानी चाहिए।');
    assert(para7 === '(iv) ट्रेन आगे बढ़ सकती है।', 'Para 7 preserves Roman (iv): (iv) ट्रेन आगे बढ़ सकती है।');

    // Verification of Section 3: NOTE and Power On Indication (Requirement 1 & 10)
    console.log('\n--- VERIFYING SECTION 3: NOTE & POWER ON ---');
    const para8 = getParaText(uParas[8]);
    const para9 = getParaText(uParas[9]);

    console.log('  Para 8:', para8);
    console.log('  Para 9:', para9);

    assert(para8.includes('टिप्पणी:'), 'NOTE: translated to टिप्पणी:');
    assert(!para8.includes('NOTE') && !para8.includes('एन.ओ.टी.ई.'), 'No Latin NOTE or transliterated एन.ओ.टी.ई.');
    assert(para9 === 'विद्युत चालू होने के संकेत की जाँच की जानी चाहिए।', 'Power On indication matches: विद्युत चालू होने के संकेत की जाँच की जानी चाहिए।');

    // Verification of Section 4: Railway Abbreviations (Requirement 4 & 10)
    console.log('\n--- VERIFYING SECTION 4: ABBREVIATIONS ---');
    const para10 = getParaText(uParas[10]);
    console.log('  Para 10:', para10);

    const expectedAbbr = 'डी.एस.टी.ई., सी.एस.टी.ई., एस.डब्ल्यू.आर., वी.डी.यू., एच.ए.एस.एस.डी.ए.सी., एम.ए.सी.एल.एस. और आई.बी.एच.';
    assert(para10 === expectedAbbr, 'Abbreviations match exact required string: ' + expectedAbbr);
    assert(!para10.includes('..') && !para10.includes('.।'), 'No double dots or rogue danda after abbreviation ending dot');

    // Verification of Section 5: Technical Codes & Meaning Terms (Requirement 1 & 5)
    console.log('\n--- VERIFYING SECTION 5: CODES & MEANINGS ---');
    const para11 = getParaText(uParas[11]);
    const para12 = getParaText(uParas[12]);
    console.log('  Para 11:', para11);
    console.log('  Para 12:', para12);

    assert(para11.includes('505ए.एक्स.टी.') && para11.includes('505बी.एक्स.टी.') && para11.includes('डी.पी.519ए') && para11.includes('ओ.डी.पी.507ए') && para11.includes('एस9ए.एक्स.टी.'), 'Technical codes translated correctly');
    assert(para11.includes('अप') && para11.includes('डाउन'), 'UP/DN translated to अप/डाउन');
    assert(para12.includes('पुनर्स्थापन प्रक्रिया'), 'Resetting Operation -> पुनर्स्थापन प्रक्रिया');
    assert(para12.includes('स्टेशन का विवरण'), 'Description of Station -> स्टेशन का विवरण');
    assert(para12.includes('गणक'), 'Counter -> गणक');
    assert(para12.includes('व्यस्त'), 'Busy -> व्यस्त');

    // Verification of Section 6: Word Automatic Alphabetic Numbering (Requirement 2)
    console.log('\n--- VERIFYING SECTION 6: WORD AUTOMATIC NUMBERING ---');
    const autoAlpha0 = getParaText(uParas[13]);
    const autoAlpha1 = getParaText(uParas[14]);
    const autoAlpha2 = getParaText(uParas[15]);
    const autoAlpha3 = getParaText(uParas[16]);

    console.log('  Auto Alpha 0:', autoAlpha0);
    console.log('  Auto Alpha 1:', autoAlpha1);
    console.log('  Auto Alpha 2:', autoAlpha2);
    console.log('  Auto Alpha 3:', autoAlpha3);

    assert(autoAlpha0 === '(ए) स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।', 'Auto Alpha 0 generated (ए) and translated sentence');
    assert(autoAlpha1 === '(बी) लोको पायलट को निर्देशों का पालन करना चाहिए।', 'Auto Alpha 1 generated (बी) and translated sentence');
    assert(autoAlpha2 === '(सी) विवरण रजिस्टर में दर्ज करें।', 'Auto Alpha 2 generated (सी) and translated sentence');
    assert(autoAlpha3 === '(डी) ट्रेन को रवाना किया जाना चाहिए।', 'Auto Alpha 3 generated (डी) and translated sentence');

    // Check that <w:numPr> was removed and <w:ind> preserved on automatic alphabetic paragraphs
    for (let idx = 13; idx <= 16; idx++) {
        const p = uParas[idx];
        const numPr = p.getElementsByTagName('w:numPr')[0];
        const ind = p.getElementsByTagName('w:ind')[0];
        assert(!numPr, `Para ${idx} has <w:numPr> removed to avoid Word rendering English Latin letters`);
        assert(ind && ind.getAttribute('w:left') === '720' && ind.getAttribute('w:hanging') === '360', `Para ${idx} preserves list indentation w:left=720 w:hanging=360`);
    }

    // Check that <w:numPr> was KEPT INTACT on automatic Roman numeral paragraphs
    for (let idx = 17; idx <= 20; idx++) {
        const p = uParas[idx];
        const numPr = p.getElementsByTagName('w:numPr')[0];
        assert(numPr !== null && numPr !== undefined, `Para ${idx} (Roman numeral) keeps <w:numPr> intact for Word native Roman numbering`);
    }

    const autoRom0 = getParaText(uParas[17]);
    const autoRom1 = getParaText(uParas[18]);
    const autoRom2 = getParaText(uParas[19]);
    const autoRom3 = getParaText(uParas[20]);

    console.log('  Auto Rom 0 text:', autoRom0);
    console.log('  Auto Rom 1 text:', autoRom1);
    console.log('  Auto Rom 2 text:', autoRom2);
    console.log('  Auto Rom 3 text:', autoRom3);

    assert(autoRom0 === 'स्टेशन खाली रहना चाहिए।', 'Auto Rom 0 text translated correctly');
    assert(autoRom1 === 'सिग्नल की जाँच की जानी चाहिए।', 'Auto Rom 1 text translated correctly');
    assert(autoRom2 === 'मार्ग की पुष्टि की जानी चाहिए।', 'Auto Rom 2 text translated correctly');
    assert(autoRom3 === 'ट्रेन आगे बढ़ सकती है।', 'Auto Rom 3 text translated correctly');

    // Step 5: Inspect Kruti Dev DOCX
    console.log('\n--- VERIFYING KRUTI DEV 010 DOCX ---');
    const kZip = await JSZip.loadAsync(krutiBuffer);
    const kXmlStr = await kZip.file('word/document.xml').async('text');
    const kDoc = new XmlDomParser().parseFromString(kXmlStr, 'text/xml');
    const kParas = Array.from(kDoc.getElementsByTagName('w:p'));

    // Verify font assignments on runs
    let krutiDevRunsCount = 0;
    let timesRunsCount = 0;
    const allRuns = Array.from(kDoc.getElementsByTagName('w:r'));
    for (const r of allRuns) {
        const rFonts = r.getElementsByTagName('w:rFonts')[0];
        if (rFonts) {
            const font = rFonts.getAttribute('w:ascii') || rFonts.getAttribute('w:hAnsi');
            if (font === 'Kruti Dev 010') krutiDevRunsCount++;
            if (font === 'Times New Roman') timesRunsCount++;
        }
    }
    console.log(`  Found ${krutiDevRunsCount} Kruti Dev 010 runs and ${timesRunsCount} Times New Roman runs`);
    assert(krutiDevRunsCount > 0, 'Kruti Dev 010 font assigned to Hindi Devanagari text runs');
    assert(timesRunsCount > 0, 'Times New Roman font assigned to punctuation, numbers, and Roman numerals');

    // Decode Kruti Dev text from Para 0
    const kPara0Runs = Array.from(kParas[0].getElementsByTagName('w:r'));
    let decodedPara0 = '';
    for (const r of kPara0Runs) {
        const t = r.getElementsByTagName('w:t')[0];
        if (!t) continue;
        const font = r.getElementsByTagName('w:rFonts')[0]?.getAttribute('w:ascii');
        if (font === 'Kruti Dev 010') {
            decodedPara0 += krutiDevToUnicode(t.textContent || '');
        } else {
            decodedPara0 += t.textContent || '';
        }
    }
    console.log('  Decoded Kruti Dev Para 0:', decodedPara0);
    assert(decodedPara0.includes('(ए)') && decodedPara0.includes('स्टेशन मास्टर'), 'Kruti Dev Para 0 decodes cleanly to (ए) स्टेशन मास्टर');

    // Step 6: Quality Gate Validation
    console.log('\n--- QUALITY GATE & LEFTOVER AUDIT ---');
    const qualityReport = validateTranslationCompleteness(uParas.map(getParaText).join('\n'));
    console.log('  Quality Score:', qualityReport.score + '%');
    console.log('  Validation Passed:', qualityReport.isValid);
    assert(qualityReport.isValid, 'validateTranslationCompleteness reports 100% valid translation');
    assert(qualityReport.untranslatedWords.length === 0, 'Zero unapproved ordinary English words remain');

    console.log('\n==================================================');
    console.log(`TEST SUITE RESULTS: ${checksPassed} / ${totalChecks} Checks Passed.`);
    console.log('==================================================');

    if (checksPassed === totalChecks) {
        console.log('\nALL 12 VALIDATION ITEMS FULLY VERIFIED AND SATISFIED!');
        process.exit(0);
    } else {
        console.error(`\nSOME CHECKS FAILED: ${totalChecks - checksPassed} failures.`);
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
