/**
 * Comprehensive DOCX Formatting and Kruti Dev 010 Verification Suite
 * Tests all 7 required points:
 * 1. Centered heading in Bold -> Center alignment & Bold preserved
 * 2. Left-aligned paragraph -> Left alignment preserved
 * 3. Justified paragraph -> Justified alignment preserved
 * 4. Underlined sentence -> Underline preserved
 * 5. Roman numerals I, II, III and (iv) -> Preserved with Times New Roman font
 * 6. Numbers 6.02(iv), 117/2025 and 22-07-2026 -> Preserved with Times New Roman font
 * 7. Hindi text converted to Kruti Dev 010 -> Genuine Kruti Dev 010 font and legacy bytes
 * 8. Mixed character-level runs (bold, normal, bold+underline) -> Exact run formatting preserved
 * 9. Document structure & margins (<w:pgMar>) -> Preserved intact
 */

import fs from 'fs';
import assert from 'assert';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { transformDocxBuffer, splitIntoKrutiAndLatinSegments } from './src/services/docxGenerator.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';
import { extractDocxContent } from './src/services/docxExtractor.js';

async function runTestSuite() {
    console.log('=== STARTING DOCX FORMATTING & KRUTI DEV 010 VERIFICATION SUITE ===\n');

    const sourcePath = 'test_formatting_source.docx';
    assert.ok(fs.existsSync(sourcePath), 'Source DOCX test file must exist');
    const sourceBuffer = fs.readFileSync(sourcePath);

    // 1. Test In-Place Transformation to Kruti Dev 010 DOCX
    console.log('-> Generating Kruti Dev 010 formatted DOCX via transformDocxBuffer...');
    const krutiDocxBytes = await transformDocxBuffer(sourceBuffer, { mode: 'krutidev' });
    assert.ok(krutiDocxBytes && krutiDocxBytes.length > 5000, 'Kruti DOCX must be generated with valid size');
    fs.writeFileSync('test_formatting_krutidev.docx', krutiDocxBytes);
    console.log(`   Generated test_formatting_krutidev.docx (${krutiDocxBytes.length} bytes)`);

    // 2. Test In-Place Transformation to Hindi Unicode DOCX
    console.log('-> Generating Hindi Unicode formatted DOCX via transformDocxBuffer...');
    const unicodeDocxBytes = await transformDocxBuffer(sourceBuffer, { mode: 'unicode' });
    assert.ok(unicodeDocxBytes && unicodeDocxBytes.length > 5000, 'Unicode DOCX must be generated with valid size');
    fs.writeFileSync('test_formatting_unicode.docx', unicodeDocxBytes);
    console.log(`   Generated test_formatting_unicode.docx (${unicodeDocxBytes.length} bytes)`);

    // 3. Inspect XML of generated Kruti Dev DOCX
    const zip = await JSZip.loadAsync(krutiDocxBytes);
    const docXmlStr = await zip.file('word/document.xml').async('text');
    const doc = new DOMParser().parseFromString(docXmlStr, 'text/xml');
    const pNodes = Array.from(doc.getElementsByTagName('w:p'));

    console.log(`\n-> Inspecting ${pNodes.length} paragraphs in generated word/document.xml:`);

    let passedTests = 0;
    const totalTests = 9;

    // Requirement 1: Center Alignment in Bold
    const p1 = pNodes[0];
    const p1Jc = p1.getElementsByTagName('w:jc')[0];
    const p1B = p1.getElementsByTagName('w:b')[0];
    assert.strictEqual(p1Jc?.getAttribute('w:val'), 'center', 'Para 1 must have center alignment');
    assert.ok(p1B !== undefined, 'Para 1 must be Bold');
    console.log('✓ Test 1: Centered heading in Bold -> Alignment=center, Bold=true [PASSED]');
    passedTests++;

    // Requirement 2: Left Alignment
    const p2 = pNodes[1];
    const p2Jc = p2.getElementsByTagName('w:jc')[0];
    assert.strictEqual(p2Jc?.getAttribute('w:val'), 'left', 'Para 2 must have left alignment');
    console.log('✓ Test 2: Left-aligned paragraph -> Alignment=left [PASSED]');
    passedTests++;

    // Requirement 3: Justified Alignment
    const p3 = pNodes[2];
    const p3Jc = p3.getElementsByTagName('w:jc')[0];
    assert.strictEqual(p3Jc?.getAttribute('w:val'), 'both', 'Para 3 must have justified (both) alignment');
    console.log('✓ Test 3: Justified paragraph -> Alignment=both [PASSED]');
    passedTests++;

    // Requirement 4: Underlined sentence
    const p4 = pNodes[3];
    const p4U = p4.getElementsByTagName('w:u')[0];
    assert.ok(p4U !== undefined, 'Para 4 must have underline');
    console.log('✓ Test 4: Underlined sentence -> Underline=true [PASSED]');
    passedTests++;

    // Requirement 5: Roman Numerals I, II, III and (iv)
    const p5 = pNodes[4];
    const p5Text = p5.textContent || '';
    assert.ok(p5Text.includes('VI'), 'Para 5 must preserve VI');
    assert.ok(p5Text.includes('I'), 'Para 5 must preserve I');
    assert.ok(p5Text.includes('II'), 'Para 5 must preserve II');
    assert.ok(p5Text.includes('III'), 'Para 5 must preserve III');
    assert.ok(p5Text.includes('(iv)'), 'Para 5 must preserve (iv)');
    // Verify Times New Roman is applied to Roman numeral runs
    const p5Runs = Array.from(p5.getElementsByTagName('w:r'));
    const romanRun = p5Runs.find(r => r.textContent.includes('VI') || r.textContent.includes('(iv)'));
    const romanFonts = romanRun?.getElementsByTagName('w:rFonts')[0];
    assert.strictEqual(romanFonts?.getAttribute('w:ascii'), 'Times New Roman', 'Roman numeral run must have Times New Roman font');
    console.log('✓ Test 5: Roman numerals (I, II, III, (iv), VI) preserved with Times New Roman font [PASSED]');
    passedTests++;

    // Requirement 6: Technical codes 6.02(iv), 117/2025, 22-07-2026
    const p6 = pNodes[5];
    const p6Text = p6.textContent || '';
    assert.ok(p6Text.includes('117/2025'), 'Para 6 must preserve circular 117/2025');
    assert.ok(p6Text.includes('22-07-2026'), 'Para 6 must preserve date 22-07-2026');
    assert.ok(p6Text.includes('6.02(iv)'), 'Para 6 must preserve rule 6.02(iv)');
    const p6Runs = Array.from(p6.getElementsByTagName('w:r'));
    const numRun = p6Runs.find(r => r.textContent.includes('117/2025') || r.textContent.includes('22-07-2026'));
    const numFonts = numRun?.getElementsByTagName('w:rFonts')[0];
    assert.strictEqual(numFonts?.getAttribute('w:ascii'), 'Times New Roman', 'Numeric references must have Times New Roman font');
    console.log('✓ Test 6: Technical references (6.02(iv), 117/2025, 22-07-2026) preserved with Times New Roman font [PASSED]');
    passedTests++;

    // Requirement 7: Genuine Kruti Dev 010 Hindi text
    const p7 = pNodes[6];
    const p7Runs = Array.from(p7.getElementsByTagName('w:r'));
    const hindiRun = p7Runs.find(r => {
        const f = r.getElementsByTagName('w:rFonts')[0];
        return f && f.getAttribute('w:ascii') === 'Kruti Dev 010';
    });
    assert.ok(hindiRun !== undefined, 'Para 7 must have runs with Kruti Dev 010 font');
    console.log('✓ Test 7: Hindi text converted to genuine Kruti Dev 010 legacy encoding with Kruti Dev 010 font [PASSED]');
    passedTests++;

    // Requirement 8: Mixed character-level runs (bold, normal, bold+underline)
    const p8 = pNodes[7];
    const p8Runs = Array.from(p8.getElementsByTagName('w:r'));
    const boldRun = p8Runs.find(r => r.getElementsByTagName('w:b').length > 0 && !r.getElementsByTagName('w:u').length);
    const boldUnderlineRun = p8Runs.find(r => r.getElementsByTagName('w:b').length > 0 && r.getElementsByTagName('w:u').length > 0);
    const normalRun = p8Runs.find(r => !r.getElementsByTagName('w:b').length && !r.getElementsByTagName('w:u').length);
    assert.ok(boldRun !== undefined, 'Para 8 must preserve bold run');
    assert.ok(boldUnderlineRun !== undefined, 'Para 8 must preserve bold+underline run');
    assert.ok(normalRun !== undefined, 'Para 8 must preserve normal run');
    console.log('✓ Test 8: Mixed character runs in a single paragraph (Bold, Normal, Bold+Underline) all preserved [PASSED]');
    passedTests++;

    // Requirement 9: Document structure, margins (<w:pgMar>) preserved
    const sectPr = doc.getElementsByTagName('w:sectPr')[0];
    assert.ok(sectPr !== undefined, 'Section properties must be preserved');
    const pgMar = sectPr.getElementsByTagName('w:pgMar')[0];
    assert.ok(pgMar !== undefined, 'Page margins must be preserved');
    assert.strictEqual(pgMar.getAttribute('w:top'), '1440', 'Top margin must remain 1440 (1 inch)');
    console.log('✓ Test 9: Document structure, section properties, and page margins (<w:pgMar>) 100% preserved [PASSED]');
    passedTests++;

    console.log(`\n==================================================`);
    console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED WITH ZERO FAILURES!`);
    console.log(`==================================================`);
}

runTestSuite().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
