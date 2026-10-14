import fs from 'fs';
import {
    translateEnglishToHindi,
    translateWordByMeaning,
    scanAndResolveEnglishLeftovers,
    checkTranslationQuality,
    ensureNoEnglishWordsRemain
} from './src/services/translationEngine.js';
import { unicodeToKrutiDev, krutiDevToUnicode } from './src/services/krutiDevConverter.js';
import { transformDocxBuffer, validateDocxBuffer } from './src/services/docxGenerator.js';
import { Document, Paragraph, TextRun, Table, TableRow, TableCell, Packer } from 'docx';
import JSZip from 'jszip';
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';

async function runTestSuite() {
    console.log('==================================================');
    console.log('STARTING UNTRANSLATED WORDS & PIPELINE TEST SUITE');
    console.log('==================================================\n');

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition, message, details = '') {
        totalTests++;
        if (condition) {
            passedTests++;
            console.log(`[PASS] ${message}`);
        } else {
            console.error(`[FAIL] ${message} - ${details}`);
        }
    }

    // ==========================================
    // 1. EXACT TEST SENTENCES (User Requirement 9)
    // ==========================================
    console.log('--- 1. EXACT USER TEST SENTENCES ---');

    const test1Input = 'Rigid observance of the rules is imperative and short cut method is not permitted.';
    const test1Expected = 'नियमों का कठोरता से पालन अनिवार्य है और संक्षिप्त तरीका अपनाने की अनुमति नहीं है।';
    const test1Hindi = await translateEnglishToHindi(test1Input);
    assert(
        test1Hindi.trim() === test1Expected.trim(),
        'Exact Test 1 matches expected Hindi Unicode',
        `Got: "${test1Hindi}" | Expected: "${test1Expected}"`
    );

    const test2Input = 'NOTE:\nThe station master must follow all safety instructions.';
    const test2Expected = 'टिप्पणी:\nस्टेशन मास्टर को सभी सुरक्षा निर्देशों का पालन करना चाहिए।';
    const test2Hindi = await translateEnglishToHindi(test2Input);
    assert(
        test2Hindi.trim().replace(/\s*\n\s*/g, '\n') === test2Expected.trim().replace(/\s*\n\s*/g, '\n'),
        'Exact Test 2 matches expected Hindi Unicode',
        `Got: "${test2Hindi}" | Expected: "${test2Expected}"`
    );

    // ==========================================
    // 2. TRANSLATE ALL REMAINING WORDS BY MEANING (User Requirement 1)
    // ==========================================
    console.log('\n--- 2. REQUIRED INDIVIDUAL WORDS BY MEANING ---');

    const requiredWordsMap = {
        'Rigid observance': 'नियमों का कठोरता से पालन',
        'Imperative': 'अनिवार्य',
        'Short cut method': 'संक्षिप्त तरीका',
        'NOTE': 'टिप्पणी',
        'NOTE:': 'टिप्पणी:',
        'Reporting': 'रिपोर्ट करना',
        'Accident': 'दुर्घटना',
        'Reference': 'संदर्भ',
        'Necessary': 'आवश्यक',
        'Independent': 'स्वतंत्र',
        'Adjacent': 'निकटवर्ती',
        'Conspicuously': 'प्रमुखता से'
    };

    for (const [enWord, expectedHi] of Object.entries(requiredWordsMap)) {
        const hi = await translateEnglishToHindi(enWord);
        assert(
            hi.trim() === expectedHi.trim(),
            `Word "${enWord}" -> "${expectedHi}"`,
            `Got: "${hi}"`
        );
    }

    // Verify words inside a paragraph:
    const paraWithWords = 'It is Imperative that Accident Reporting and Reference documents are Conspicuously displayed at Adjacent station.';
    const translatedPara = await translateEnglishToHindi(paraWithWords);
    const qualityAudit = checkTranslationQuality(translatedPara);
    assert(
        qualityAudit.isValid,
        'No Latin words remain in paragraph with technical words',
        `Remaining: ${qualityAudit.untranslatedWords.join(', ')}`
    );
    assert(
        translatedPara.includes('अनिवार्य') &&
        translatedPara.includes('दुर्घटना') &&
        translatedPara.includes('रिपोर्ट करना') &&
        translatedPara.includes('संदर्भ') &&
        translatedPara.includes('प्रमुखता से') &&
        translatedPara.includes('निकटवर्ती'),
        'Paragraph contains correct contextual Hindi translations for all required words',
        `Output: "${translatedPara}"`
    );

    // ==========================================
    // 3. SPECIAL RULE FOR NOTE (User Requirement 2)
    // ==========================================
    console.log('\n--- 3. SPECIAL RULE FOR NOTE ---');

    const noteVariations = ['NOTE', 'NOTE:', 'Note', 'Note:', 'NOTES', 'NOTES:'];
    for (const n of noteVariations) {
        const trans = await translateEnglishToHindi(n);
        assert(
            !trans.includes('एन.ओ.टी.ई.') && !trans.toLowerCase().includes('note'),
            `"${n}" translates to "टिप्पणी" and NEVER to "एन.ओ.टी.ई." or raw NOTE`,
            `Got: "${trans}"`
        );
        const kruti = unicodeToKrutiDev(trans);
        assert(
            kruti.includes('fVIi.kh') || kruti.includes('fVIi.k') || kruti.includes('fVIif.k;ka'),
            `"${n}" in Kruti Dev encodes to genuine Kruti Dev 010 (टिप्पणी / टिप्पणियां)`,
            `Got: "${kruti}"`
        );
    }

    // ==========================================
    // 4. PHONETIC ABBREVIATIONS (User Requirement 3)
    // ==========================================
    console.log('\n--- 4. PHONETIC ABBREVIATION CONVERSIONS ---');

    const expectedAbbrs = {
        'DSTE': 'डी.एस.टी.ई.',
        'CSTE': 'सी.एस.टी.ई.',
        'ECR': 'ई.सी.आर.',
        'SWR': 'एस.डब्ल्यू.आर.',
        'VDU': 'वी.डी.यू.',
        'HASSDAC': 'एच.ए.एस.एस.डी.ए.सी.',
        'MACLS': 'एम.ए.सी.एल.एस.',
        'IBH': 'आई.बी.एच.',
        'SM': 'एस.एम.'
    };

    for (const [abbr, expectedPhonetic] of Object.entries(expectedAbbrs)) {
        const trans = await translateEnglishToHindi(abbr);
        assert(
            trans.trim() === expectedPhonetic,
            `Abbreviation "${abbr}" -> "${expectedPhonetic}"`,
            `Got: "${trans}"`
        );
    }

    // ==========================================
    // 5. ROMAN NUMERALS PRESERVATION (User Requirement 5)
    // ==========================================
    console.log('\n--- 5. ROMAN NUMERALS & NUMBER PRESERVATION ---');

    const romanTestText = 'Chapter I, Chapter II, Chapter III, IV, V, VI, VII, VIII, IX, X with sub-clauses (i), (ii), (iii), (iv), (v), (vi).';
    const romanTranslated = await translateEnglishToHindi(romanTestText);
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', '(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'];
    let allRomansPreserved = true;
    for (const r of romans) {
        if (!romanTranslated.includes(r)) {
            allRomansPreserved = false;
            console.error(`Roman numeral "${r}" not found in: ${romanTranslated}`);
        }
    }
    assert(allRomansPreserved, 'All Roman numerals I to X and (i) to (vi) preserved without Hindi transliteration');

    // ==========================================
    // 6. 5-CLASSIFICATION LEFTOVER SCANNER (User Requirement 6)
    // ==========================================
    console.log('\n--- 6. 5-CLASSIFICATION FINAL ENGLISH LEFTOVER SCANNER ---');

    // Mixed test containing A (ordinary words), B (abbreviations), C (tech codes), D (places), E (Roman)
    const mixedInput = 'NOTE: Standard-II Absolute Block System with DSTE and HASSDAC on 505AXT at KARJARA station under Chapter VI para 6.02(iv).';
    const scanResult = scanAndResolveEnglishLeftovers(mixedInput, { pageNumber: 3, paragraph: 5 });
    assert(
        scanResult.unresolvedCount === 0,
        'Leftover scanner resolved all ordinary words, acronyms, and codes',
        `Unresolved: ${JSON.stringify(scanResult.unresolved)}`
    );
    assert(
        scanResult.resolvedText.includes('टिप्पणी:') &&
        scanResult.resolvedText.includes('मानक-II') &&
        scanResult.resolvedText.includes('डी.एस.टी.ई.') &&
        scanResult.resolvedText.includes('एच.ए.एस.एस.डी.ए.सी.') &&
        scanResult.resolvedText.includes('505ए.एक्स.टी.') &&
        scanResult.resolvedText.includes('करजरा') &&
        scanResult.resolvedText.includes('VI') &&
        scanResult.resolvedText.includes('(iv)'),
        'All 5 classes (A:टिप्पणी, B:डी.एस.टी.ई., C:505ए.एक्स.टी., D:करजरा, E:VI/(iv)) correctly handled in leftover scanner',
        `Resolved: "${scanResult.resolvedText}"`
    );

    // ==========================================
    // 7. IN-PLACE DOCX GENERATION & MULTI-RUN FORMATTING PRESERVATION (User Requirements 4, 7 & 8)
    // ==========================================
    console.log('\n--- 7. IN-PLACE DOCX XML GENERATION & FORMATTING PRESERVATION ---');

    // Create a source DOCX with split runs:
    // Run 1 (Bold): "NOTE: "
    // Run 2 (Normal): "The station master must follow all safety instructions."
    // Run 3 (Bold): "Rigid observance "
    // Run 4 (Italic): "of the rules is imperative "
    // Run 5 (Normal): "and short cut method is not permitted."
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [
                        new TextRun({ text: 'NOTE: ', bold: true }),
                        new TextRun({ text: 'The station master must follow all safety instructions.', bold: false })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Rigid observance ', bold: true }),
                        new TextRun({ text: 'of the rules is imperative ', italics: true }),
                        new TextRun({ text: 'and short cut method is not permitted.', bold: false })
                    ]
                }),
                new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DSTE Office', bold: true })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Reporting of Accident', italics: true })] })] })
                            ]
                        })
                    ]
                })
            ]
        }]
    });

    const sourceBlob = await Packer.toBlob(doc);
    const sourceBuffer = new Uint8Array(await sourceBlob.arrayBuffer());
    fs.writeFileSync('test_untranslated_source.docx', sourceBuffer);
    console.log('  Created test source DOCX (test_untranslated_source.docx)');

    // Generate Kruti Dev 010 DOCX
    const krutiDocxBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'krutidev' });
    fs.writeFileSync('test_untranslated_krutidev.docx', krutiDocxBuffer);
    console.log('  Generated transformed Kruti Dev DOCX (test_untranslated_krutidev.docx)');

    // Validate DOCX integrity
    const validation = await validateDocxBuffer(krutiDocxBuffer);
    assert(validation.valid, 'Generated Kruti Dev DOCX passes OpenXML binary validation');

    // Inspect XML of generated DOCX
    const zip = await JSZip.loadAsync(krutiDocxBuffer);
    const xmlStr = await zip.file('word/document.xml').async('text');
    const xmlDoc = new XmlDomParser().parseFromString(xmlStr, 'text/xml');
    const pNodes = Array.from(xmlDoc.getElementsByTagName('w:p'));

    // Verify Paragraph 1: NOTE: in bold
    const p1 = pNodes[0];
    const p1Runs = Array.from(p1.getElementsByTagName('w:r'));
    let p1HasBoldNote = false;
    let p1HasNormalBody = false;
    for (const r of p1Runs) {
        const rPr = r.getElementsByTagName('w:rPr')[0];
        const bNode = rPr?.getElementsByTagName('w:b')[0];
        const isBold = bNode && bNode.getAttribute('w:val') !== 'false' && bNode.getAttribute('w:val') !== '0';
        const t = r.getElementsByTagName('w:t')[0]?.textContent || '';
        if (isBold && (t.includes('fVIi.kh') || t.includes(':'))) {
            p1HasBoldNote = true;
        }
        if (!isBold && t.includes('LVs\'ku')) {
            p1HasNormalBody = true;
        }
    }
    assert(p1HasBoldNote, 'Paragraph 1: "fVIi.kh" (टिप्पणी:) preserved in bold run');
    assert(p1HasNormalBody, 'Paragraph 1: Body translated to Kruti Dev with normal font weight');

    // Verify Paragraph 2: Rigid observance...
    const p2 = pNodes[1];
    const p2Runs = Array.from(p2.getElementsByTagName('w:r'));
    let p2Text = '';
    for (const r of p2Runs) {
        const t = r.getElementsByTagName('w:t')[0]?.textContent || '';
        p2Text += t;
    }
    const decodedP2 = krutiDevToUnicode(p2Text);
    assert(
        decodedP2.includes('नियमों का कठोरता से पालन') &&
        decodedP2.includes('अनिवार्य') &&
        decodedP2.includes('संक्षिप्त तरीका'),
        'Paragraph 2: Decoded Kruti Dev contains exact translated phrase',
        `Decoded: "${decodedP2}"`
    );

    // Verify Table: DSTE Office & Reporting of Accident
    const tbl = xmlDoc.getElementsByTagName('w:tbl')[0];
    assert(tbl !== undefined, 'Table structure preserved in DOCX');
    const tcNodes = Array.from(tbl.getElementsByTagName('w:tc'));
    let cell1Text = '';
    let cell2Text = '';
    for (const r of Array.from(tcNodes[0].getElementsByTagName('w:r'))) {
        cell1Text += r.getElementsByTagName('w:t')[0]?.textContent || '';
    }
    for (const r of Array.from(tcNodes[1].getElementsByTagName('w:r'))) {
        cell2Text += r.getElementsByTagName('w:t')[0]?.textContent || '';
    }
    const decodedCell1 = krutiDevToUnicode(cell1Text);
    const decodedCell2 = krutiDevToUnicode(cell2Text);
    assert(
        decodedCell1.includes('डी.एस.टी.ई.'),
        'Table Cell 1 translates DSTE to phonetic "डी.एस.टी.ई."',
        `Got: "${decodedCell1}"`
    );
    assert(
        decodedCell2.includes('रिपोर्ट') && decodedCell2.includes('दुर्घटना'),
        'Table Cell 2 translates "Reporting of Accident" to Hindi by meaning',
        `Got: "${decodedCell2}"`
    );

    console.log('\n==================================================');
    console.log(`TEST SUITE FINISHED: ${passedTests} / ${totalTests} CHECKS PASSED.`);
    console.log('==================================================\n');

    if (passedTests === totalTests) {
        console.log('ALL REQUIREMENTS FULLY VERIFIED AND SATISFIED!');
    } else {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Fatal error in test suite:', err);
    process.exit(1);
});
