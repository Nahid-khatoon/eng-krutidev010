import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { transformDocxBuffer, splitIntoKrutiAndLatinSegments } from './src/services/docxGenerator.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';
import { DOMParser } from '@xmldom/xmldom';

async function runSuite() {
    console.log('==================================================');
    console.log('TEST SUITE: ABBREVIATION FULL-STOP (.) & PUNCTUATION');
    console.log('==================================================\n');

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

    // SECTION 1: UNIT TEST splitIntoKrutiAndLatinSegments
    console.log('--- SECTION 1: SEGMENT SPLITTING LOGIC ---');
    const testCases = [
        {
            input: "डी.एस.टी.ई.",
            expectedRuns: [
                { text: "डी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "एस", isLatin: false },
                { text: ".", isLatin: true },
                { text: "टी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "ई", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "एम.एस.डी.ए.सी.",
            expectedRuns: [
                { text: "एम", isLatin: false },
                { text: ".", isLatin: true },
                { text: "एस", isLatin: false },
                { text: ".", isLatin: true },
                { text: "डी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "ए", isLatin: false },
                { text: ".", isLatin: true },
                { text: "सी", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "एच.ए.एस.एस.डी.ए.सी.",
            expectedRuns: [
                { text: "एच", isLatin: false },
                { text: ".", isLatin: true },
                { text: "ए", isLatin: false },
                { text: ".", isLatin: true },
                { text: "एस", isLatin: false },
                { text: ".", isLatin: true },
                { text: "एस", isLatin: false },
                { text: ".", isLatin: true },
                { text: "डी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "ए", isLatin: false },
                { text: ".", isLatin: true },
                { text: "सी", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "सी.एस.टी.ई.",
            expectedRuns: [
                { text: "सी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "एस", isLatin: false },
                { text: ".", isLatin: true },
                { text: "टी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "ई", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "जी.आर.",
            expectedRuns: [
                { text: "जी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "आर", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "एस.आर.",
            expectedRuns: [
                { text: "एस", isLatin: false },
                { text: ".", isLatin: true },
                { text: "आर", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "ई.सी.आर.",
            expectedRuns: [
                { text: "ई", isLatin: false },
                { text: ".", isLatin: true },
                { text: "सी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "आर", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "एस.आई.पी.",
            expectedRuns: [
                { text: "एस", isLatin: false },
                { text: ".", isLatin: true },
                { text: "आई", isLatin: false },
                { text: ".", isLatin: true },
                { text: "पी", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "डी.एन.आर.",
            expectedRuns: [
                { text: "डी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "एन", isLatin: false },
                { text: ".", isLatin: true },
                { text: "आर", isLatin: false },
                { text: ".", isLatin: true }
            ]
        },
        {
            input: "वी.डी.यू.",
            expectedRuns: [
                { text: "वी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "डी", isLatin: false },
                { text: ".", isLatin: true },
                { text: "यू", isLatin: false },
                { text: ".", isLatin: true }
            ]
        }
    ];

    for (const tc of testCases) {
        const segs = splitIntoKrutiAndLatinSegments(tc.input);
        assert(segs.length === tc.expectedRuns.length, `Correct number of segments for "${tc.input}" (${segs.length} === ${tc.expectedRuns.length})`);
        for (let i = 0; i < segs.length; i++) {
            assert(segs[i].text === tc.expectedRuns[i].text, `Segment ${i} text: "${segs[i].text}" === "${tc.expectedRuns[i].text}"`);
            assert(segs[i].isLatin === tc.expectedRuns[i].isLatin, `Segment ${i} isLatin: ${segs[i].isLatin} === ${tc.expectedRuns[i].isLatin}`);
        }
    }

    // SECTION 2: HINDI HALF LETTERS AND CONJUNCTS
    console.log('\n--- SECTION 2: CONJUNCTS & HALF LETTERS PRESERVATION ---');
    const conjuncts = [
        { hindi: "प्र", expectedKruti: "ç" },
        { hindi: "क्र", expectedKruti: "Ø" },
        { hindi: "त्र", expectedKruti: "=" },
        { hindi: "ग्र", expectedKruti: "xz" },
        { hindi: "क्त", expectedKruti: "ä" },
        { hindi: "द्य", expectedKruti: "|" },
        { hindi: "स्त्र", expectedKruti: "L=" }
    ];

    for (const c of conjuncts) {
        const segs = splitIntoKrutiAndLatinSegments(c.hindi);
        assert(segs.length === 1 && !segs[0].isLatin, `"${c.hindi}" is treated strictly as Devanagari run`);
        const kruti = unicodeToKrutiDev(c.hindi);
        assert(kruti === c.expectedKruti, `"${c.hindi}" converts correctly to "${c.expectedKruti}"`);
    }

    // SECTION 3: OTHER PUNCTUATION PRESERVATION
    console.log('\n--- SECTION 3: PRESERVATION OF OTHER PUNCTUATION & NUMBERS ---');
    const punctuationTests = [
        "12.09.2025",
        "6.02(iv)",
        "117/2025",
        ". .. ... / : ; - :- ( ) [ ] & % @"
    ];
    for (const pt of punctuationTests) {
        const segs = splitIntoKrutiAndLatinSegments(pt);
        assert(segs.every(s => s.isLatin), `Punctuation/Number "${pt}" is 100% Latin/Times New Roman`);
        assert(segs.map(s => s.text).join('') === pt, `Text of "${pt}" preserved exactly`);
    }

    // SECTION 4: FULL IN-PLACE DOCX TRANSFORMATION & OPENXML RUN INSPECTION
    console.log('\n--- SECTION 4: IN-PLACE DOCX TRANSFORMATION & XML VALIDATION ---');
    const sourceParas = [
        "डी.एस.टी.ई.",
        "एम.एस.डी.ए.सी.",
        "एच.ए.एस.एस.डी.ए.सी.",
        "सी.एस.टी.ई.",
        "जी.आर.",
        "एस.आर.",
        "ई.सी.आर.",
        "एस.आई.पी.",
        "डी.एन.आर.",
        "वी.डी.यू.",
        "दिनांक 12.09.2025 को पैरा 6.02(iv) तथा संदर्भ 117/2025 के अनुसार।",
        "प्रक्रिया क्रमिक त्रुटी ग्रुप संयुक्त विद्या स्त्री",
        "चिह्न: . .. ... / : ; - :- ( ) [ ] & % @"
    ];

    const docxObj = new Document({
        sections: [{
            children: sourceParas.map(text => new Paragraph({
                children: [new TextRun({ text, font: { name: 'Calibri' }, size: 24 })]
            }))
        }]
    });

    const sourceBuf = await Packer.toBuffer(docxObj);
    fs.writeFileSync('test_abbrevs_source.docx', sourceBuf);
    assert(fs.existsSync('test_abbrevs_source.docx'), 'Saved test_abbrevs_source.docx');

    const transformedBuf = await transformDocxBuffer(sourceBuf, { mode: 'krutidev' });
    fs.writeFileSync('test_abbrevs_krutidev.docx', transformedBuf);
    assert(fs.existsSync('test_abbrevs_krutidev.docx'), 'Saved transformed test_abbrevs_krutidev.docx');

    // Read and parse word/document.xml in transformed DOCX
    const zip = await JSZip.loadAsync(transformedBuf);
    const docXmlStr = await zip.file('word/document.xml').async('text');
    const parser = new DOMParser();
    const docXml = parser.parseFromString(docXmlStr, 'application/xml');

    const pNodes = Array.from(docXml.getElementsByTagName('w:p'));
    console.log(`  Parsed ${pNodes.length} paragraphs from transformed DOCX.`);

    // Check abbreviation paragraphs
    for (let pIdx = 0; pIdx < 10; pIdx++) {
        const pNode = pNodes[pIdx];
        const rNodes = Array.from(pNode.getElementsByTagName('w:r'));
        const originalAbbrev = sourceParas[pIdx];

        console.log(`\n  Inspecting Para ${pIdx}: "${originalAbbrev}" (${rNodes.length} runs):`);
        for (let rIdx = 0; rIdx < rNodes.length; rIdx++) {
            const r = rNodes[rIdx];
            const rFonts = r.getElementsByTagName('w:rFonts')[0];
            const fontAscii = rFonts ? rFonts.getAttribute('w:ascii') : 'unknown';
            const tNode = r.getElementsByTagName('w:t')[0];
            const textContent = tNode ? tNode.textContent : '';

            console.log(`    Run ${rIdx}: font="${fontAscii}", text="${textContent}"`);

            if (textContent === '.') {
                assert(fontAscii === 'Times New Roman', `Dot run in "${originalAbbrev}" MUST use Times New Roman font (found "${fontAscii}")`);
                assert(!rFonts.hasAttribute('w:asciiTheme'), `Dot run must not have w:asciiTheme attribute`);
            } else {
                assert(fontAscii === 'Kruti Dev 010', `Hindi letter run in "${originalAbbrev}" MUST use Kruti Dev 010 font (found "${fontAscii}")`);
                // Ensure the Kruti Dev run does NOT contain any ASCII '.' that could display as 'ण्'
                assert(!textContent.includes('.'), `Kruti Dev run "${textContent}" must NOT contain any dot character`);
            }
        }
    }

    // Inspect Paragraph 10 (Date, Section, Decimal)
    const p10 = pNodes[10];
    const r10 = Array.from(p10.getElementsByTagName('w:r'));
    console.log(`\n  Inspecting Para 10 (Date/Decimal):`);
    const dateRun = r10.find(r => (r.textContent || '').includes('12.09.2025'));
    assert(dateRun !== undefined, 'Found date run 12.09.2025');
    const dateFont = dateRun.getElementsByTagName('w:rFonts')[0]?.getAttribute('w:ascii');
    assert(dateFont === 'Times New Roman', `Date 12.09.2025 run uses Times New Roman (found "${dateFont}")`);

    const decRun = r10.find(r => (r.textContent || '').includes('6.02(iv)'));
    assert(decRun !== undefined, 'Found decimal/Roman run 6.02(iv)');
    const decFont = decRun.getElementsByTagName('w:rFonts')[0]?.getAttribute('w:ascii');
    assert(decFont === 'Times New Roman', `6.02(iv) run uses Times New Roman (found "${decFont}")`);

    // Inspect Paragraph 11 (Conjuncts)
    const p11 = pNodes[11];
    const r11 = Array.from(p11.getElementsByTagName('w:r'));
    console.log(`\n  Inspecting Para 11 (Conjuncts):`);
    for (const r of r11) {
        const f = r.getElementsByTagName('w:rFonts')[0]?.getAttribute('w:ascii');
        assert(f === 'Kruti Dev 010', `Conjunct run uses Kruti Dev 010 (found "${f}")`);
    }

    console.log('\n==================================================');
    console.log(`TEST SUITE COMPLETED: ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('==================================================\n');
}

runSuite().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
