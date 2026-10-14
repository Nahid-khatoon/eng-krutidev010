import { translateEnglishToHindi, checkTranslationQuality } from './src/services/translationEngine.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';

const testCases = [
    { input: "G & SR 4.65", expected: "जी. एंड एस.आर. 4.65" },
    { input: "G.R. 5.23", expected: "जी.आर. 5.23" },
    { input: "S.R. 5.19(5)(a)", expected: "एस.आर. 5.19(5)(a)" },
    { input: "T/369", expected: "टी/369" },
    { input: "signals, points etc.", expected: "सिग्नल, पॉइंट आदि।" },
    { input: "other equipment etc.", expected: "अन्य उपकरण आदि" },
    { input: "Chapter VI para 6.02(iv)", expected: "अध्याय VI पैरा 6.02(iv)" },
    { input: "T", expected: "टी" },
    { input: "G", expected: "जी" },
    { input: "505AXT", expected: "505ए.एक्स.टी." },
    { input: "505BXT", expected: "505बी.एक्स.टी." },
    { input: "DP519A", expected: "डी.पी.519ए." },
    { input: "SR", expected: "एस.आर." },
    { input: "GR", expected: "जी.आर." },
    { input: "G and SR", expected: "जी. एंड एस.आर." },
    { input: "ETC", expected: "आदि" },
    { input: "etc.", expected: "आदि" }
];

async function runTests() {
    console.log("==========================================");
    console.log("RUNNING USER REQUIREMENTS VERIFICATION SUITE");
    console.log("==========================================");

    let passedCount = 0;
    for (const tc of testCases) {
        const hindi = await translateEnglishToHindi(tc.input);
        const kruti = unicodeToKrutiDev(hindi);
        const quality = checkTranslationQuality(hindi);

        const match = hindi.trim() === tc.expected.trim();
        if (match) {
            console.log(`✅ PASS: "${tc.input}"`);
            console.log(`   Hindi:    "${hindi}"`);
            console.log(`   KrutiDev: "${kruti}"`);
            passedCount++;
        } else {
            console.error(`❌ FAIL: "${tc.input}"`);
            console.error(`   Expected: "${tc.expected}"`);
            console.error(`   Actual:   "${hindi}"`);
        }

        if (!quality.isValid) {
            console.warn(`   ⚠️ Untranslated words detected:`, quality.untranslatedWords);
        }
    }

    console.log("==========================================");
    console.log(`RESULTS: ${passedCount}/${testCases.length} Passed`);
    console.log("==========================================");

    if (passedCount !== testCases.length) {
        process.exit(1);
    }
}

runTests();
