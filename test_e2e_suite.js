import fs from 'fs';
import { unicodeToKrutiDev, krutiDevToUnicode } from './src/services/krutiDevConverter.js';
import { translateEnglishToHindi } from './src/services/translationEngine.js';
import { translateTechnicalCodes } from './src/services/technicalCodes.js';
import { extractDocxContent } from './src/services/docxExtractor.js';
import { downloadDocx } from './src/services/docxGenerator.js';

async function runEndToEndVerification() {
    console.log('====================================================');
    console.log('   KRUTI DEV 010 CONVERTER — FULL TEST SUITE');
    console.log('====================================================\n');

    let passedTests = 0;
    let totalTests = 0;

    function assertTest(testName, actual, expected) {
        totalTests++;
        const passed = actual === expected;
        if (passed) {
            passedTests++;
            console.log(`[PASS] ${testName}`);
        } else {
            console.error(`[FAIL] ${testName}`);
            console.error(`       Expected: "${expected}"`);
            console.error(`       Actual:   "${actual}"`);
        }
    }

    // 1. Technical Codes Tests (Section 8)
    console.log('>>> TESTING SECTION 8: TECHNICAL CODES TRANSLATION');
    assertTest('505AXT -> 505ए.एक्स.टी.', translateTechnicalCodes('505AXT'), '505ए.एक्स.टी.');
    assertTest('505BXT -> 505बी.एक्स.टी.', translateTechnicalCodes('505BXT'), '505बी.एक्स.टी.');
    assertTest('DP519A -> डी.पी.519ए', translateTechnicalCodes('DP519A'), 'डी.पी.519ए');
    assertTest('ODP507A -> ओ.डी.पी.507ए', translateTechnicalCodes('ODP507A'), 'ओ.डी.पी.507ए');
    assertTest('S9XT -> एस9.एक्स.टी.', translateTechnicalCodes('S9XT'), 'एस9.एक्स.टी.');
    assertTest('S9AXT -> एस9ए.एक्स.टी.', translateTechnicalCodes('S9AXT'), 'एस9ए.एक्स.टी.');
    assertTest('S507XT -> एस507.एक्स.टी.', translateTechnicalCodes('S507XT'), 'एस507.एक्स.टी.');
    assertTest('A-517 -> ए-517', translateTechnicalCodes('A-517'), 'ए-517');

    // 2. Kruti Dev 010 Encoding Tests (Section 14 & 27)
    console.log('\n>>> TESTING SECTION 14 & 27: KRUTI DEV 010 ENCODING');
    
    // Station Master -> LVs'ku ekLVj
    const stationMasterKruti = unicodeToKrutiDev('स्टेशन मास्टर');
    assertTest('स्टेशन मास्टर Kruti Dev encoding', stationMasterKruti, "LVs'ku ekLVj");

    // 505AXT Hindi -> Kruti Dev
    const axtHindi = '505ए.एक्स.टी.';
    const axtKruti = unicodeToKrutiDev(axtHindi);
    console.log('   505ए.एक्स.टी. -> Kruti Dev:', axtKruti);
    assertTest('505 preserved in Kruti Dev', axtKruti.startsWith('505'), true);
    assertTest('Dots preserved in Kruti Dev', axtKruti.includes('.'), true);

    // 3. Roman Numerals & Numeric Decimals (Section 10 & 11)
    console.log('\n>>> TESTING SECTION 10 & 11: ROMAN NUMERALS & NUMERICS');
    const romanHindi = await translateEnglishToHindi('Chapter VI para 6.02(iv)');
    assertTest('Chapter VI para 6.02(iv) Hindi translation', romanHindi, 'अध्याय VI पैरा 6.02(iv)');
    
    const romanKruti = unicodeToKrutiDev(romanHindi, { preserveRoman: true });
    assertTest('Roman VI preserved in Kruti Dev', romanKruti.includes('VI'), true);
    assertTest('Reference 6.02(iv) preserved in Kruti Dev', romanKruti.includes('6.02(iv)'), true);

    // 4. Punctuation Preservation (Section 12)
    console.log('\n>>> TESTING SECTION 12: PUNCTUATION PRESERVATION');
    const puncHindi = await translateEnglishToHindi('Date of Issue:-');
    assertTest('Date of Issue:- punctuation preserved', puncHindi, 'जारी करने की तारीख:-');

    const slashHindi = await translateEnglishToHindi('Section/Line');
    assertTest('Section/Line slash preserved', slashHindi, 'सेक्शन/लाइन');

    // 5. Real Word Document (.docx) Extraction & Processing (Section 15 & 28)
    console.log('\n>>> TESTING SECTION 15 & 28: WORD DOCUMENT EXTRACTION (.DOCX)');
    const sampleBuffer = fs.readFileSync('sample_railway_test.docx');
    const extracted = await extractDocxContent(sampleBuffer);
    console.log(`   Extracted ${extracted.paragraphsCount} paragraphs from sample_railway_test.docx`);
    assertTest('DOCX text contains Station Master', extracted.plainText.includes('Station Master'), true);
    assertTest('DOCX text contains 505AXT', extracted.plainText.includes('505AXT'), true);
    assertTest('DOCX text contains DP519A', extracted.plainText.includes('DP519A'), true);
    assertTest('DOCX AST paragraphs extracted', extracted.ast.length > 0, true);

    // Full translation of extracted DOCX text
    const translatedDocx = await translateEnglishToHindi(extracted.plainText);
    console.log('\n   Translated DOCX output snippet:\n' + translatedDocx.split('\n').slice(0, 4).join('\n'));
    assertTest('Translated DOCX contains स्टेशन मास्टर', translatedDocx.includes('स्टेशन मास्टर'), true);
    assertTest('Translated DOCX contains 505ए.एक्स.टी.', translatedDocx.includes('505ए.एक्स.टी.'), true);
    assertTest('Translated DOCX contains डी.पी.519ए', translatedDocx.includes('डी.पी.519ए'), true);
    assertTest('Translated DOCX contains VI and 6.02(iv)', translatedDocx.includes('VI') && translatedDocx.includes('6.02(iv)'), true);

    console.log('\n====================================================');
    console.log(`   RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('====================================================');

    if (passedTests === totalTests) {
        console.log('\n🎉 ALL ACCEPTANCE CRITERIA VERIFIED AND PASSED SUCCESSFULLY!');
    }
}

runEndToEndVerification().catch(err => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
});
