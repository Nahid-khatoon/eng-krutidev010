import fs from 'fs';
import assert from 'assert';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

async function verifyFinalTestDocx() {
    console.log('=== VERIFYING FINAL TEST KRUTI DEV 010 DOCX ===\n');

    const filePath = 'final_test_krutidev.docx';
    assert.ok(fs.existsSync(filePath), 'final_test_krutidev.docx must exist');

    const fileBuf = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(fileBuf);
    const docXml = await zip.file('word/document.xml').async('text');
    const doc = new DOMParser().parseFromString(docXml, 'text/xml');
    const pNodes = Array.from(doc.getElementsByTagName('w:p'));

    console.log(`Document contains ${pNodes.length} paragraphs.\n`);

    // Helper to extract runs with their font and text
    function getParaRuns(pNode) {
        const rNodes = Array.from(pNode.getElementsByTagName('w:r'));
        return rNodes.map(r => {
            const fontEl = r.getElementsByTagName('w:rFonts')[0];
            const font = fontEl ? fontEl.getAttribute('w:ascii') : 'default';
            const tEl = r.getElementsByTagName('w:t')[0];
            const text = tEl ? tEl.textContent : '';
            return { font, text };
        });
    }

    let passCount = 0;

    // Test 1: ब्रॉड गेज
    console.log('Checking Paragraph 0: ब्रॉड गेज');
    const p0Runs = getParaRuns(pNodes[0]);
    assert.ok(p0Runs.some(r => r.font === 'Kruti Dev 010'), 'Must contain Kruti Dev 010 font');
    console.log('  -> Runs:', JSON.stringify(p0Runs));
    console.log('  [PASS] Hindi heading in Kruti Dev 010\n');
    passCount++;

    // Test 2: जारी करने की तारीख......
    console.log('Checking Paragraph 1: जारी करने की तारीख......');
    const p1Runs = getParaRuns(pNodes[1]);
    const p1DotsRun = p1Runs.find(r => r.text === '......');
    assert.ok(p1DotsRun, 'Must contain run with exact multiple dots ......');
    assert.strictEqual(p1DotsRun.font, 'Times New Roman', 'Multiple dots run must have Times New Roman font');
    const p1HindiRun = p1Runs.find(r => r.font === 'Kruti Dev 010');
    assert.ok(p1HindiRun, 'Hindi text must have Kruti Dev 010 font');
    assert.ok(!p1Runs.some(r => r.text.includes('३')), 'Must not contain character ३');
    assert.ok(!p1Runs.some(r => r.text.includes('----')), 'Must not turn dots into hyphens');
    console.log('  -> Runs:', JSON.stringify(p1Runs));
    console.log('  [PASS] Multiple dots ...... preserved exactly in Times New Roman without turning into ३\n');
    passCount++;

    // Test 3: बलपूर्वक लाया गया......
    console.log('Checking Paragraph 2: बलपूर्वक लाया गया......');
    const p2Runs = getParaRuns(pNodes[2]);
    const p2DotsRun = p2Runs.find(r => r.text === '......');
    assert.ok(p2DotsRun, 'Must contain run with exact multiple dots ......');
    assert.strictEqual(p2DotsRun.font, 'Times New Roman', 'Multiple dots run must have Times New Roman font');
    assert.ok(!p2Runs.some(r => r.text.includes('३')), 'Must not contain character ३');
    console.log('  -> Runs:', JSON.stringify(p2Runs));
    console.log('  [PASS] Multiple dots ...... preserved exactly without turning into ३\n');
    passCount++;

    // Test 4: 2.5.1 रनिंग लाइन्स, गति की दिशा और सीएसआर
    console.log('Checking Paragraph 3: 2.5.1 रनिंग लाइन्स...');
    const p3Runs = getParaRuns(pNodes[3]);
    const p3SecRun = p3Runs.find(r => r.text.includes('2.5.1'));
    assert.ok(p3SecRun, 'Must contain run with section number 2.5.1');
    assert.strictEqual(p3SecRun.font, 'Times New Roman', 'Section number 2.5.1 must have Times New Roman font');
    assert.ok(!p3Runs.some(r => r.text.includes('2-5-1')), 'Section number must not have dots replaced by hyphens');
    assert.ok(!p3Runs.some(r => r.text.includes('३')), 'Section number must not contain character ३');
    console.log('  -> Runs:', JSON.stringify(p3Runs));
    console.log('  [PASS] Section number 2.5.1 preserved with exact dots in Times New Roman\n');
    passCount++;

    // Test 5: (a) UP Main Line (Line No. 2)
    console.log('Checking Paragraph 4: (a) UP Main Line (Line No. 2)');
    const p4Runs = getParaRuns(pNodes[4]);
    const p4MarkerRun = p4Runs.find(r => r.text.includes('(a)'));
    assert.ok(p4MarkerRun, 'Must contain list marker (a)');
    assert.strictEqual(p4MarkerRun.font, 'Times New Roman', 'List marker (a) must have Times New Roman font');
    assert.ok(!p4Runs.some(r => r.text.includes('प)')), 'List marker must not turn into प)');
    assert.ok(!p4Runs.some(r => r.text.includes('¼a½')), 'List marker must not turn into Kruti brackets ¼a½');
    console.log('  -> Runs:', JSON.stringify(p4Runs));
    console.log('  [PASS] Alphabetic list marker (a) preserved without turning into प)\n');
    passCount++;

    // Test 6: (b), (c), (d)
    console.log('Checking Paragraphs 5-7: (b), (c), (d)');
    const p5Runs = getParaRuns(pNodes[5]);
    const p6Runs = getParaRuns(pNodes[6]);
    const p7Runs = getParaRuns(pNodes[7]);
    assert.ok(p5Runs.some(r => r.text.includes('(b)') && r.font === 'Times New Roman'), '(b) preserved in Times New Roman');
    assert.ok(p6Runs.some(r => r.text.includes('(c)') && r.font === 'Times New Roman'), '(c) preserved in Times New Roman');
    assert.ok(p7Runs.some(r => r.text.includes('(d)') && r.font === 'Times New Roman'), '(d) preserved in Times New Roman');
    console.log('  [PASS] List markers (b), (c), (d) all preserved in Times New Roman\n');
    passCount++;

    // Test 7: Chapter VI para 6.02(iv)
    console.log('Checking Paragraph 8: Chapter VI para 6.02(iv)');
    const p8Runs = getParaRuns(pNodes[8]);
    const p8RomanRun = p8Runs.find(r => r.text.includes('VI'));
    assert.ok(p8RomanRun, 'Must preserve Roman numeral VI');
    assert.strictEqual(p8RomanRun.font, 'Times New Roman', 'Roman numeral VI must have Times New Roman font');
    const p8ClauseRun = p8Runs.find(r => r.text.includes('6.02(iv)'));
    assert.ok(p8ClauseRun, 'Must preserve rule reference 6.02(iv)');
    assert.strictEqual(p8ClauseRun.font, 'Times New Roman', 'Rule reference 6.02(iv) must have Times New Roman font');
    console.log('  -> Runs:', JSON.stringify(p8Runs));
    console.log('  [PASS] Roman numeral VI and 6.02(iv) preserved in Times New Roman\n');
    passCount++;

    // Test 8: Date: 22.07.2026
    console.log('Checking Paragraph 9: Date: 22.07.2026');
    const p9Runs = getParaRuns(pNodes[9]);
    const p9DateRun = p9Runs.find(r => r.text.includes('22.07.2026'));
    assert.ok(p9DateRun, 'Must preserve exact date 22.07.2026 with dots');
    assert.strictEqual(p9DateRun.font, 'Times New Roman', 'Date 22.07.2026 must have Times New Roman font');
    assert.ok(!p9Runs.some(r => r.text.includes('22-07-2026')), 'Date dots must not be converted to hyphens');
    assert.ok(!p9Runs.some(r => r.text.includes('३')), 'Date must not contain character ३');
    console.log('  -> Runs:', JSON.stringify(p9Runs));
    console.log('  [PASS] Date 22.07.2026 preserved with dots in Times New Roman\n');
    passCount++;

    // Global document assertions
    console.log('Checking global document integrity:');
    assert.ok(!docXml.includes('३'), 'Global doc must not contain corrupt digit ३');
    assert.ok(!docXml.includes('प)'), 'Global doc must not contain corrupt list marker प)');
    assert.ok(docXml.includes('>......<'), 'Global doc must contain literal dots run >......<');
    assert.ok(docXml.includes('2.5.1'), 'Global doc must contain 2.5.1');
    assert.ok(docXml.includes('22.07.2026'), 'Global doc must contain 22.07.2026');
    assert.ok(docXml.includes('(a)'), 'Global doc must contain (a)');
    assert.ok(docXml.includes('(b)'), 'Global doc must contain (b)');
    assert.ok(docXml.includes('(c)'), 'Global doc must contain (c)');
    assert.ok(docXml.includes('(d)'), 'Global doc must contain (d)');
    assert.ok(docXml.includes('VI'), 'Global doc must contain VI');
    assert.ok(docXml.includes('6.02(iv)'), 'Global doc must contain 6.02(iv)');
    console.log('  [PASS] Global document integrity verified.\n');
    passCount++;

    console.log('==================================================');
    console.log(`ALL ${passCount}/${passCount} FINAL TESTS PASSED WITH ZERO FAILURES!`);
    console.log('==================================================');
}

verifyFinalTestDocx().catch(err => {
    console.error('Final test verification failed:', err);
    process.exit(1);
});
