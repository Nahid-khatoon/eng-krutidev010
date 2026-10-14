/**
 * Calibration & Visual Preview Test Suite (Section 5 & Prompt Requirements)
 * Verifies:
 * 1. Exact Section 5 Calibration Examples:
 *    - स्टेशन -> LVs'ku
 *    - मास्टर -> ekLVj
 *    - स्टेशन मास्टर -> LVs'ku ekLVj
 *    - अप -> vi
 *    - लाइन -> ykbu
 *    - स्टेशन का विवरण -> LVs'ku dk fooj.k
 *    - डाउन लाइन -> Mkmu ykbu
 *    - सामान्य नियम -> lkekU; fu;e
 *    - डी.एस.टी.ई. -> Mh.,l.Vh.bZ.
 *    - एम.एन.पी. -> ,e.,u.ih.
 * 2. Visual Preview HTML structure (no corrupted Latin spans on Kruti words)
 * 3. Separation of 3 outputs (Hindi Unicode Master, Kruti Dev Visual Preview, Raw Code)
 * 4. Technical codes & Railway abbreviations (505AXT, DSTE, MNP, UP, DN)
 * 5. DOCX Kruti Dev font tagging
 */

import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';
import { translateEnglishToHindi } from './src/services/translationEngine.js';
import { splitIntoKrutiAndLatinSegments } from './src/services/docxGenerator.js';
import assert from 'assert';

console.log('================================================================');
console.log('RUNNING SECTION 5 CALIBRATION & VISUAL PREVIEW TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(desc, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✓ PASS: ${desc}`);
        passedTests++;
    } catch (e) {
        console.error(`  ✗ FAIL: ${desc}`);
        console.error(`    Error: ${e.message}`);
        process.exitCode = 1;
    }
}

// -------------------------------------------------------------
// Test 1: Section 5 Exact Calibration Pairs
// -------------------------------------------------------------
const calibrationPairs = [
    { hindi: 'स्टेशन', expectedKruti: "LVs'ku" },
    { hindi: 'मास्टर', expectedKruti: 'ekLVj' },
    { hindi: 'स्टेशन मास्टर', expectedKruti: "LVs'ku ekLVj" },
    { hindi: 'अप', expectedKruti: 'vi' },
    { hindi: 'लाइन', expectedKruti: 'ykbu' },
    { hindi: 'स्टेशन का विवरण', expectedKruti: "LVs'ku dk fooj.k" },
    { hindi: 'डाउन लाइन', expectedKruti: 'Mkmu ykbu' },
    { hindi: 'सामान्य नियम', expectedKruti: 'lkekU; fu;e' },
    { hindi: 'डी.एस.टी.ई.', expectedKruti: 'Mh.,l.Vh.bZ.' },
    { hindi: 'एम.एन.पी.', expectedKruti: ',e.,u.ih.' }
];

for (const pair of calibrationPairs) {
    runTest(`Calibration: "${pair.hindi}" -> "${pair.expectedKruti}"`, () => {
        const actualKruti = unicodeToKrutiDev(pair.hindi);
        assert.strictEqual(actualKruti, pair.expectedKruti, `Expected ${pair.expectedKruti}, got ${actualKruti}`);
    });
}

// -------------------------------------------------------------
// Test 2: Word Spaces Preservation
// -------------------------------------------------------------
runTest('Word space preservation in "स्टेशन मास्टर"', () => {
    const kruti = unicodeToKrutiDev('स्टेशन मास्टर');
    assert(kruti.includes(' '), 'Must contain a normal space between words');
    const parts = kruti.split(' ');
    assert.strictEqual(parts[0], "LVs'ku");
    assert.strictEqual(parts[1], "ekLVj");
});

// -------------------------------------------------------------
// Test 3: Abbreviation Dots Preservation
// -------------------------------------------------------------
runTest('Abbreviation dots preservation in "डी.एस.टी.ई." and "एम.एन.पी."', () => {
    const dste = unicodeToKrutiDev('डी.एस.टी.ई.');
    const mnp = unicodeToKrutiDev('एम.एन.पी.');
    assert.strictEqual((dste.match(/\./g) || []).length, 4, 'डी.एस.टी.ई. must have 4 dots');
    assert.strictEqual((mnp.match(/\./g) || []).length, 3, 'एम.एन.पी. must have 3 dots');
});

// -------------------------------------------------------------
// Test 4: Visual Preview Formatting Logic (No Kruti words in kruti-latin)
// -------------------------------------------------------------
function formatKrutiVisualPreviewHtml(krutiText, hindiText) {
    const escapeHtml = (str) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (hindiText) {
        const segments = splitIntoKrutiAndLatinSegments(hindiText);
        return segments.map(seg => {
            if (seg.isLatin) {
                return `<span class="kruti-latin">${escapeHtml(seg.text)}</span>`;
            } else {
                const krutiCode = unicodeToKrutiDev(seg.text, {
                    preserveRoman: true,
                    preserveNumbers: true,
                    preservePunctuation: true
                });
                return `<span class="kruti-devanagari">${escapeHtml(krutiCode)}</span>`;
            }
        }).join('');
    }
    return '';
}

runTest('Visual Preview: Devanagari text is wrapped in kruti-devanagari, never kruti-latin', () => {
    const previewHtml = formatKrutiVisualPreviewHtml('', 'स्टेशन मास्टर');
    assert(previewHtml.includes('<span class="kruti-devanagari">LVs&#39;ku ekLVj</span>') || previewHtml.includes('<span class="kruti-devanagari">LVs\'ku ekLVj</span>'),
        'Visual preview must put LVs\'ku ekLVj into .kruti-devanagari');
    assert(!previewHtml.includes('<span class="kruti-latin">LVs'), 'Must not wrap LVs in kruti-latin');
    assert(!previewHtml.includes('<span class="kruti-latin">ekLVj'), 'Must not wrap ekLVj in kruti-latin');
});

runTest('Visual Preview: Abbreviation dots in "डी.एस.टी.ई." are rendered in kruti-latin', () => {
    const previewHtml = formatKrutiVisualPreviewHtml('', 'डी.एस.टी.ई.');
    assert(previewHtml.includes('<span class="kruti-latin">.</span>'), 'Dots must be in kruti-latin');
    assert(previewHtml.includes('<span class="kruti-devanagari">Mh</span>'), 'Mh must be in kruti-devanagari');
    assert(previewHtml.includes('<span class="kruti-devanagari">,l</span>'), ',l must be in kruti-devanagari');
    assert(previewHtml.includes('<span class="kruti-devanagari">Vh</span>'), 'Vh must be in kruti-devanagari');
    assert(previewHtml.includes('<span class="kruti-devanagari">bZ</span>'), 'bZ must be in kruti-devanagari');
});

runTest('Visual Preview: Mixed numbers and text "2.5.3 स्टेशन मास्टर 98.90 मीटर लंबी"', () => {
    const previewHtml = formatKrutiVisualPreviewHtml('', '2.5.3 स्टेशन मास्टर 98.90 मीटर लंबी');
    assert(previewHtml.includes('<span class="kruti-latin">2.5.3 </span>'), '2.5.3 must be in kruti-latin');
    assert(previewHtml.includes('<span class="kruti-devanagari">LVs&#39;ku ekLVj</span>') || previewHtml.includes('<span class="kruti-devanagari">LVs\'ku ekLVj</span>'), 'LVs\'ku ekLVj must be in kruti-devanagari');
    assert(previewHtml.includes('<span class="kruti-latin"> 98.90 </span>'), '98.90 must be in kruti-latin');
    assert(previewHtml.includes('<span class="kruti-devanagari">ehVj yach</span>'), 'ehVj yach must be in kruti-devanagari');
});

// -------------------------------------------------------------
// Test 5: English to Hindi Translation & Technical Abbreviations
// -------------------------------------------------------------
runTest('Translation: 505AXT -> 505ए.एक्स.टी., DSTE -> डी.एस.टी.ई., MNP -> एम.एन.पी.', async () => {
    const res505 = await translateEnglishToHindi('Track circuit 505AXT clear.');
    assert(res505.includes('505ए.एक्स.टी.'), `Expected 505ए.एक्स.टी. in "${res505}"`);

    const resDste = await translateEnglishToHindi('DSTE on duty.');
    assert(resDste.includes('डी.एस.टी.ई.'), `Expected डी.एस.टी.ई. in "${resDste}"`);

    const resMnp = await translateEnglishToHindi('Signal MNP inspected.');
    assert(resMnp.includes('एम.एन.पी.'), `Expected एम.एन.पी. in "${resMnp}"`);

    const resUpDn = await translateEnglishToHindi('UP Line and DN Line');
    assert(resUpDn.includes('अप') && resUpDn.includes('डाउन'), `Expected अप and डाउन in "${resUpDn}"`);
});

// -------------------------------------------------------------
// Test 6: Deterministic Encoding (No Double Encoding)
// -------------------------------------------------------------
runTest('Deterministic single encoding: does not double encode Kruti text', () => {
    const kruti1 = unicodeToKrutiDev('स्टेशन मास्टर');
    // Encoding already-encoded Kruti text should not alter ASCII letters
    const kruti2 = unicodeToKrutiDev(kruti1);
    assert.strictEqual(kruti2, kruti1, 'Already encoded Kruti Dev text must remain unchanged');
});

// -------------------------------------------------------------
// Test 7: Three Separate Representations
// -------------------------------------------------------------
runTest('Separation of Hindi Unicode, Kruti Dev Visual Preview, and Raw Code', () => {
    const hindiMaster = 'स्टेशन मास्टर';
    const rawCode = unicodeToKrutiDev(hindiMaster);
    const visualHtml = formatKrutiVisualPreviewHtml(rawCode, hindiMaster);

    // 1. Hindi Unicode Master must be pure Devanagari
    assert(/[\u0900-\u097F]/.test(hindiMaster), 'Hindi Master must contain Devanagari');
    // 2. Raw Code must be ASCII Kruti Remington
    assert(!/[\u0900-\u097F]/.test(rawCode), 'Raw Code must NOT contain Devanagari');
    assert.strictEqual(rawCode, "LVs'ku ekLVj");
    // 3. Visual Preview must contain HTML elements with proper font classes
    assert(visualHtml.includes('kruti-devanagari'), 'Visual Preview must have kruti-devanagari class');
    assert(!visualHtml.includes('undefined'), 'Visual Preview must not have undefined');
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`RESULTS: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('================================================================\n');

if (passedTests === totalTests) {
    console.log('ALL SECTION 5 CALIBRATION & PREVIEW TESTS PASSED SUCCESSFULLY! ✓\n');
} else {
    process.exit(1);
}
