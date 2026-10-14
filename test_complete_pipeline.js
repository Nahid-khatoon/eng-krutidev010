import { translateEnglishToHindi, checkTranslationQuality } from './src/services/translationEngine.js';
import { unicodeToKrutiDev, krutiDevToUnicode } from './src/services/krutiDevConverter.js';

const testInput = `NORTHERN RAILWAY
Safety Circular No. 117/2025
Date of Issue: 22-07-2026

Subject: Station Working Rules and Signal Clearance Procedure

1. Duties of Station Master and Loco Pilot:
The Station Master must verify that track circuit 505AXT and 505BXT are clear before giving Line Clear.
The Loco Pilot must not pass Home Signal or Advanced Starter at danger without authority.
Refer Chapter VI para 6.02(iv) and General Rules para 1.20.

2. Point Machines and Technical Codes:
Point machine DP519A and DP519B must remain detected normal.
Verify crossover clearance on ODP507A and S9AXT.`;

async function test() {
    console.log('--- STARTING TRANSLATION TEST ---');
    const hindi = await translateEnglishToHindi(testInput);
    console.log('--- HINDI UNICODE OUTPUT ---');
    console.log(hindi);

    console.log('\n--- QUALITY CHECK ---');
    const quality = checkTranslationQuality(hindi);
    console.log(JSON.stringify(quality, null, 2));

    console.log('\n--- KRUTI DEV 010 OUTPUT ---');
    const kruti = unicodeToKrutiDev(hindi);
    console.log(kruti);

    console.log('\n--- VERIFYING CRITICAL REQUIREMENTS ---');
    const hasEnglishWords = quality.untranslatedWordCount > 0;
    console.log('1. Ordinary English words in Hindi:', hasEnglishWords ? 'FAIL: ' + quality.untranslatedWords.join(', ') : 'PASS (0 untranslated words)');

    const has505AXT = hindi.includes('505ए.एक्स.टी.');
    const has505BXT = hindi.includes('505बी.एक्स.टी.');
    const hasDP519A = hindi.includes('डी.पी.519ए');
    const hasDP519B = hindi.includes('डी.पी.519बी');
    const hasODP507A = hindi.includes('ओ.डी.पी.507ए');
    const hasS9AXT = hindi.includes('एस9ए.एक्स.टी.');
    console.log('2. Technical codes:');
    console.log('   - 505AXT -> 505ए.एक्स.टी.:', has505AXT ? 'PASS' : 'FAIL');
    console.log('   - 505BXT -> 505बी.एक्स.टी.:', has505BXT ? 'PASS' : 'FAIL');
    console.log('   - DP519A -> डी.पी.519ए:', hasDP519A ? 'PASS' : 'FAIL');
    console.log('   - DP519B -> डी.पी.519बी:', hasDP519B ? 'PASS' : 'FAIL');
    console.log('   - ODP507A -> ओ.डी.पी.507ए:', hasODP507A ? 'PASS' : 'FAIL');
    console.log('   - S9AXT -> एस9ए.एक्स.टी.:', hasS9AXT ? 'PASS' : 'FAIL');

    const hasRomanVI = hindi.includes('VI');
    const hasRomanIv = hindi.includes('(iv)');
    console.log('3. Roman numerals preserved:');
    console.log('   - Chapter VI:', hasRomanVI ? 'PASS' : 'FAIL');
    console.log('   - para 6.02(iv):', hasRomanIv ? 'PASS' : 'FAIL');

    const hasDate = hindi.includes('22-07-2026');
    const hasRef = hindi.includes('117/2025');
    const hasDecimal = hindi.includes('6.02') && hindi.includes('1.20');
    console.log('4. Numbers and punctuation preserved in Hindi Unicode:');
    console.log('   - 22-07-2026:', hasDate ? 'PASS' : 'FAIL');
    console.log('   - 117/2025:', hasRef ? 'PASS' : 'FAIL');
    console.log('   - 6.02 & 1.20:', hasDecimal ? 'PASS' : 'FAIL');

    // Kruti Dev verification: Check that full stop dot (.) in Kruti Dev is mapped to '-' and NOT left as '.' (which renders as ण्)
    console.log('5. Kruti Dev 010 Encoding checks:');
    console.log('   - No raw full stop "." in DP codes in Kruti (must use "-"):', (!kruti.includes('Mh.ih.') && kruti.includes('Mh-ih-')) ? 'PASS' : 'CHECK: ' + kruti);
    console.log('   - Date in Kruti uses "&" for hyphen:', kruti.includes('22&07&2026') ? 'PASS' : 'CHECK: ' + kruti);
    console.log('   - Slash in Kruti uses "@":', kruti.includes('117@2025') ? 'PASS' : 'CHECK: ' + kruti);
}

test();
