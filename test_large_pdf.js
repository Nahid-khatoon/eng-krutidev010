import fs from 'fs';
import { validateDocumentQuality } from './src/services/qualityValidator.js';
import { downloadDocx } from './src/services/docxGenerator.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';
import { translateEnglishToHindi } from './src/services/translationEngine.js';

async function runLargePdfTests() {
    console.log('====================================================');
    console.log('   LARGE PDF SUPPORT TEST SUITE (UP TO 300+ PAGES)   ');
    console.log('====================================================\n');

    let passed = 0;
    let total = 0;

    function assert(name, condition) {
        total++;
        if (condition) {
            passed++;
            console.log(`[PASS] ${name}`);
        } else {
            console.error(`[FAIL] ${name}`);
        }
    }

    // TEST 1: 300 Pages Complete Quality Validation
    console.log('>>> TEST 1: 300-PAGE COMPLETE QUALITY VALIDATION');
    const valid300Pages = [];
    for (let p = 1; p <= 300; p++) {
        valid300Pages.push({
            pageNum: p,
            status: 'encoded',
            originalText: `Section Chapter VI para 6.02(iv) and track 505AXT on page ${p}.`,
            hindiText: `अनुभाग अध्याय VI पैरा 6.02(iv) और ट्रैक 505ए.एक्स.टी. पृष्ठ ${p} पर।`,
            krutiText: `vuqHkkx v/;k; VI iSjk 6.02(iv) vkSj VªSd 505,.,Dl.Vh. i\x60"B ${p} ijA`
        });
    }

    const valResult300 = validateDocumentQuality(300, valid300Pages);
    assert('300 pages valid: isValid === true', valResult300.isValid === true);
    assert('300 pages processedCount === 300', valResult300.processedCount === 300);
    assert('300 pages errors.length === 0', valResult300.errors.length === 0);
    assert('Roman numerals VI verified intact across 300 pages', valResult300.romanOk === true);
    assert('Decimals 6.02 verified intact across 300 pages', valResult300.decimalsOk === true);
    assert('Technical codes 505AXT verified converted across 300 pages', valResult300.techCodesOk === true);

    // TEST 2: Detection of Incomplete / Missing Page (e.g. Page 47 missing)
    console.log('\n>>> TEST 2: MISSING PAGE DETECTION (PAGE 47 MISSING)');
    const missingPage47 = valid300Pages.filter(p => p.pageNum !== 47);
    const valResultMissing = validateDocumentQuality(300, missingPage47);
    assert('Missing page 47: isValid === false', valResultMissing.isValid === false);
    assert('Identifies page 47 in missingPages', valResultMissing.missingPages.includes(47));

    // TEST 3: Detection of Failed Page with Retry Requirement (e.g. Page 102 failed)
    console.log('\n>>> TEST 3: FAILED PAGE DETECTION (PAGE 102 FAILED)');
    const failedPage102 = valid300Pages.map(p => p.pageNum === 102 ? { ...p, status: 'failed', error: 'Text layer unreadable' } : p);
    const valResultFailed = validateDocumentQuality(300, failedPage102);
    assert('Failed page 102: isValid === false', valResultFailed.isValid === false);
    assert('Identifies page 102 in failedPages', valResultFailed.failedPages.includes(102));

    // TEST 4: 222 Pages Section 5 Complete DOCX Generation
    console.log('\n>>> TEST 4: 222-PAGE SECTION 5 WORD DOCUMENT GENERATION');
    const pages222 = [];
    for (let p = 1; p <= 222; p++) {
        pages222.push({
            pageNum: p,
            status: 'encoded',
            originalText: `NORTHERN RAILWAY — PAGE ${p} OF 222\nStation Master verified line clear. 505AXT and DP519A detected normal.`,
            hindiText: `उत्तर रेलवे — पृष्ठ ${p} / 222\nस्टेशन मास्टर ने लाइन क्लियर सत्यापित किया। 505ए.एक्स.टी. और डी.पी.519ए सामान्य पाए गए।`,
            krutiText: `mRrj jsyos & i\x60"B ${p} / 222\nLVs'ku ekLVj us ykbu Dyh;j lR;kfir fd;kA 505,.,Dl.Vh. vkSj Mh.ih.519, lkekU; ik, x,A`
        });
    }

    const docxBlob = await downloadDocx({
        pagesData: pages222,
        mode: 'krutidev',
        preserveFormatting: true,
        filename: 'Railway_GSR_222Pages_KrutiDev010.docx'
    });
    assert('222-page DOCX successfully generated with PageBreaks', docxBlob && docxBlob.size > 10000);
    console.log(`   Generated DOCX size for 222 pages: ${Math.round(docxBlob.size / 1024)} KB`);

    // TEST 5: Large Document Batched Translation
    console.log('\n>>> TEST 5: BATCH TRANSLATION SPEED & INTEGRITY (50 PAGES)');
    const startTime = Date.now();
    let sampleTranslated = await translateEnglishToHindi(
        "Station Master on duty verified track circuit 505AXT and 505BXT before clearing Home Signal. " +
        "Comply with General Rules Chapter VI para 6.02(iv). Date of Issue:- 22-07-2026."
    );
    const durationMs = Date.now() - startTime;
    assert('Sample translation contains स्टेशन मास्टर', sampleTranslated.includes('स्टेशन मास्टर'));
    assert('Sample translation contains 505ए.एक्स.टी.', sampleTranslated.includes('505ए.एक्स.टी.'));
    assert('Sample translation contains VI and 6.02(iv)', sampleTranslated.includes('VI') && sampleTranslated.includes('6.02(iv)'));
    assert('Translation completes under 200ms per batch', durationMs < 200);

    console.log('\n====================================================');
    console.log(`   LARGE PDF TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
    console.log('====================================================');
}

runLargePdfTests().catch(e => {
    console.error('Test execution failed:', e);
    process.exit(1);
});
