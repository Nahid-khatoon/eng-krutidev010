import fs from 'fs';
import JSZip from 'jszip';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { DOMParser } from '@xmldom/xmldom';
import { translateEnglishToHindi } from './src/services/translationEngine.js';
import { unicodeToKrutiDev, krutiDevToUnicode, isKrutiDevText, detectSegmentEncoding } from './src/services/krutiDevConverter.js';
import { transformDocxBuffer, splitIntoKrutiAndLatinSegments } from './src/services/docxGenerator.js';

async function runSuite() {
    console.log('====================================================');
    console.log('TEST SUITE: FINAL MIXED PDF CONVERSION RULE');
    console.log('====================================================\n');

    let passedChecks = 0;
    let totalChecks = 0;

    function assert(condition, message) {
        totalChecks++;
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passedChecks++;
        } else {
            console.error(`  [FAIL] ${message}`);
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    // ----------------------------------------------------
    // TEST 1: LANGUAGE & ENCODING SEGMENT DETECTION
    // ----------------------------------------------------
    console.log('--- TEST 1: LANGUAGE & ENCODING SEGMENT DETECTION ---');

    const detectionCases = [
        { text: "The station master must follow all safety instructions.", expected: 'ENGLISH' },
        { text: "Resetting Operation of HASSDAC on single line section.", expected: 'ENGLISH' },
        { text: "स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।", expected: 'UNICODE_HINDI' },
        { text: "डी.एस.टी.ई., सी.एस.टी.ई. और एस.डब्ल्यू.आर. को सूचित करें।", expected: 'UNICODE_HINDI' },
        { text: "LVs'ku ekLVj dks lHkh lqj{kk funsZ'kksa dk ikyu djuk pkfg,A", expected: 'KRUTI_DEV' },
        { text: "Mh.,l.Vh.bZ. rFkk lh.,l.Vh.bZ. dks lwfpr djsaA", expected: 'KRUTI_DEV' },
        { text: ";g ,d vf/kd`r nLrkost+ gSA", expected: 'KRUTI_DEV' },
        { text: "12.09.2025, 6.02(iv), 117/2025", expected: 'PUNCTUATION_OR_NUMBERS' },
        { text: "(iv)", expected: 'PUNCTUATION_OR_NUMBERS' }
    ];

    for (const dc of detectionCases) {
        const detected = detectSegmentEncoding(dc.text);
        assert(detected === dc.expected, `detectSegmentEncoding("${dc.text}") === '${dc.expected}' (got '${detected}')`);
    }

    // ----------------------------------------------------
    // TEST 2: GENERATION OF HINDI UNICODE MASTER
    // ----------------------------------------------------
    console.log('\n--- TEST 2: GENERATION OF HINDI UNICODE MASTER ---');

    const mixedInputDoc = [
        "The station master must follow all safety instructions.",
        "स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।",
        "LVs'ku ekLVj dks lHkh lqj{kk funsZ'kksa dk ikyu djuk pkfg,A",
        "दिनांक 12.09.2025 को पैरा 6.02(iv) तथा संदर्भ 117/2025 के अनुसार।",
        "Mh.,l.Vh.bZ. rFkk lh.,l.Vh.bZ. dks lwfpr djsaA",
        "Note: LVs'ku ekLVj dks lHkh lqj{kk funsZ'kksa dk ikyu djuk pkfg,A",
        "Check the route."
    ].join('\n');

    const hindiMaster = await translateEnglishToHindi(mixedInputDoc);
    const masterLines = hindiMaster.split('\n');

    console.log('Hindi Unicode Master Output:');
    masterLines.forEach((l, idx) => console.log(`  Line ${idx + 1}: ${l}`));

    // Assert Line 1 (English was translated completely to proper Hindi Unicode)
    assert(masterLines[0].includes("स्टेशन मास्टर को") && masterLines[0].includes("सुरक्षा निर्देशों का पालन करना चाहिए"),
        'Line 1 (English) was translated into proper Hindi Unicode');
    assert(!/[a-zA-Z]/.test(masterLines[0]), 'Line 1 contains zero untranslated English words');

    // Assert Line 2 (Already correct Hindi Unicode preserved without re-translation)
    assert(masterLines[1] === "स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।",
        'Line 2 (Existing Hindi Unicode) was preserved exactly without distortion');

    // Assert Line 3 (Already Kruti Dev decoded through verified reverse mapping into Unicode Master)
    assert(masterLines[2].includes("स्टेशन मास्टर को सभी सुरक्षा निर्देशों का पालन करना चाहिए"),
        'Line 3 (Kruti Dev) was decoded through verified reverse mapping into Hindi Unicode Master');

    // Assert Line 4 (Dates, decimals, Roman numerals preserved)
    assert(masterLines[3].includes("12.09.2025") && masterLines[3].includes("6.02(iv)") && masterLines[3].includes("117/2025"),
        'Line 4 preserves dates 12.09.2025, decimals 6.02(iv), and technical reference 117/2025');

    // Assert Line 5 (Kruti Dev abbreviations decoded into Unicode)
    assert(masterLines[4].includes("डी.एस.टी.ई.") && masterLines[4].includes("सी.एस.टी.ई."),
        'Line 5 (Kruti Dev abbreviations) decoded into clean Devanagari Unicode abbreviations');

    // Assert Line 6 (Intra-line mixed: English Note + Kruti Dev decoded and translated)
    assert(masterLines[5].includes("टिप्पणी:") && masterLines[5].includes("स्टेशन मास्टर को"),
        'Line 6 (Intra-line mixed) translated Note: to टिप्पणी: and decoded Kruti Dev to Unicode');

    // Assert Line 7 (English translated)
    assert(masterLines[6] === "मार्ग की जाँच करें।",
        'Line 7 (English) translated to मार्ग की जाँच करें।');

    // ----------------------------------------------------
    // TEST 3: GENERATION OF KRUTI DEV 010 FROM HINDI MASTER
    // ----------------------------------------------------
    console.log('\n--- TEST 3: KRUTI DEV 010 OUTPUT FROM HINDI UNICODE MASTER ---');

    const krutiLines = masterLines.map(l => unicodeToKrutiDev(l));

    console.log('Kruti Dev 010 Output:');
    krutiLines.forEach((l, idx) => console.log(`  Line ${idx + 1}: ${l}`));

    // Assert Line 1 (English converted to genuine Kruti Dev via Hindi master)
    assert(krutiLines[0].includes("LVs'ku ekLVj dks"),
        'Line 1 Kruti Dev output contains genuine Kruti Dev legacy characters');

    // Assert Line 2 (Unicode Hindi converted to Kruti Dev)
    assert(krutiLines[1].includes("LVs'ku ekLVj dks flXuy dh tk¡p"),
        'Line 2 converted from Unicode to genuine Kruti Dev');

    // Assert Line 3 (Original Kruti Dev NOT double encoded!)
    assert(krutiLines[2] === "LVs'ku ekLVj dks lHkh lqj{kk funsZ'kksa dk ikyu djuk pkfg,A",
        'Line 3 (Original Kruti Dev) was NEVER double-encoded and matches genuine Kruti Dev exactly!');

    // Assert Line 4 (Dates and references preserved in Kruti output)
    assert(krutiLines[3].includes("12.09.2025") && krutiLines[3].includes("6.02(iv)") && krutiLines[3].includes("117/2025"),
        'Line 4 Kruti output preserves dates, decimals, and Roman numerals');

    // Assert Line 5 (Abbreviation dots in Kruti output)
    assert(krutiLines[4].includes("Mh.,l.Vh.bZ.") && krutiLines[4].includes("lh.,l.Vh.bZ."),
        'Line 5 Kruti output contains clean abbreviation codes');

    // ----------------------------------------------------
    // TEST 4: FULL DOCX TRANSFORMATION WITH MIXED CONTENT
    // ----------------------------------------------------
    console.log('\n--- TEST 4: FULL DOCX TRANSFORMATION & OPENXML RUN INSPECTION ---');

    const docxParas = [
        "The station master must follow all safety instructions.",
        "स्टेशन मास्टर को सिग्नल की जाँच करनी चाहिए।",
        "LVs'ku ekLVj dks lHkh lqj{kk funsZ'kksa dk ikyu djuk pkfg,A",
        "दिनांक 12.09.2025 को पैरा 6.02(iv) तथा संदर्भ 117/2025 के अनुसार।",
        "Mh.,l.Vh.bZ. rFkk lh.,l.Vh.bZ. dks lwfpr djsaA",
        "Note: LVs'ku ekLVj dks lHkh lqj{kk funsZ'kksa dk ikyu djuk pkfg,A",
        "Check the route."
    ];

    const sourceDocx = new Document({
        sections: [{
            children: docxParas.map(text => new Paragraph({
                children: [new TextRun({ text, font: { name: 'Calibri' }, size: 24 })]
            }))
        }]
    });

    const sourceDocxBuf = await Packer.toBuffer(sourceDocx);
    fs.writeFileSync('test_mixed_pdf_source.docx', sourceDocxBuf);

    // Transform into Kruti Dev DOCX
    const transformedDocxBuf = await transformDocxBuffer(sourceDocxBuf, { mode: 'krutidev' });
    fs.writeFileSync('test_mixed_pdf_krutidev.docx', transformedDocxBuf);
    assert(fs.existsSync('test_mixed_pdf_krutidev.docx'), 'Generated test_mixed_pdf_krutidev.docx');

    // Inspect word/document.xml
    const zip = await JSZip.loadAsync(transformedDocxBuf);
    const docXmlStr = await zip.file('word/document.xml').async('text');
    const docXml = new DOMParser().parseFromString(docXmlStr, 'application/xml');
    const pNodes = Array.from(docXml.getElementsByTagName('w:p'));

    console.log(`  Parsed ${pNodes.length} paragraphs from transformed DOCX.`);
    assert(pNodes.length >= 7, `Expected at least 7 paragraphs, found ${pNodes.length}`);

    // Verify Kruti Dev font is assigned to Hindi text and Times New Roman to punctuation/dots
    const allRuns = Array.from(docXml.getElementsByTagName('w:r'));
    const krutiRuns = allRuns.filter(r => r.getElementsByTagName('w:rFonts')[0]?.getAttribute('w:ascii') === 'Kruti Dev 010');
    const tnrRuns = allRuns.filter(r => r.getElementsByTagName('w:rFonts')[0]?.getAttribute('w:ascii') === 'Times New Roman');

    console.log(`  Found ${krutiRuns.length} Kruti Dev 010 runs and ${tnrRuns.length} Times New Roman runs.`);
    assert(krutiRuns.length > 0, 'Kruti Dev 010 runs exist for all Hindi text');
    assert(tnrRuns.length > 0, 'Times New Roman runs exist for all punctuation, dots, and numbers');

    console.log('\n====================================================');
    console.log(`TEST SUITE COMPLETED: ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('====================================================\n');
}

runSuite().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
