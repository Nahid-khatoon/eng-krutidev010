import { translateEnglishToHindi, checkTranslationQuality } from './src/services/translationEngine.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';
import { translateTechnicalCodes } from './src/services/technicalCodes.js';

async function run() {
    const sample = `2.5.1 RUNNING LINES

(a) UP Main Line (Line No. 2)
(b) UP Loop Line (Line No. 1)
(c) DN Main Line (Line No. 3)
(d) DN Loop Line (Line No. 4)`;

    console.log("=== TRANSLATING SAMPLE ===");
    const hindi = await translateEnglishToHindi(sample);
    console.log("Hindi Unicode Output:");
    console.log(hindi);

    console.log("\n=== TECHNICAL CODES ===");
    console.log("505AXT ->", translateTechnicalCodes("505AXT"));
    console.log("505BXT ->", translateTechnicalCodes("505BXT"));
    console.log("S9AXT ->", translateTechnicalCodes("S9AXT"));
    console.log("DP519A ->", translateTechnicalCodes("DP519A"));
    console.log("ODP507A ->", translateTechnicalCodes("ODP507A"));
    console.log("UP ->", translateTechnicalCodes("UP"));
    console.log("DN ->", translateTechnicalCodes("DN"));
    console.log("MNP ->", translateTechnicalCodes("MNP"));
    console.log("ELB ->", translateTechnicalCodes("ELB"));
    console.log("EKT ->", translateTechnicalCodes("EKT"));
    console.log("DSTE ->", translateTechnicalCodes("DSTE"));
    console.log("VDO ->", translateTechnicalCodes("VDO"));
    console.log("VDU ->", translateTechnicalCodes("VDU"));
    console.log("KEU ->", translateTechnicalCodes("KEU"));
    console.log("GWR ->", translateTechnicalCodes("GWR"));
    console.log("SI-24 ->", translateTechnicalCodes("SI-24"));
    console.log("TVU ->", translateTechnicalCodes("TVU"));
    console.log("DLV ->", translateTechnicalCodes("DLV"));

    console.log("\n=== ROMAN NUMERAL TEST ===");
    const romanTest = await translateEnglishToHindi("Chapter VI para 6.02(iv)");
    console.log("Chapter VI para 6.02(iv) ->", romanTest);

    console.log("\n=== KRUTI DEV 010 ENCODING & REVERSE TEST ===");
    const k1 = unicodeToKrutiDev("2.5.1 रनिंग लाइन्स");
    const k2 = unicodeToKrutiDev("(ए) अप मेन लाइन (लाइन नंबर 2)");
    const k3 = unicodeToKrutiDev("505ए.एक्स.टी.");
    const k4 = unicodeToKrutiDev("अध्याय VI पैरा 6.02(iv)");
    console.log("Kruti k1:", k1);
    console.log("Kruti k2:", k2);
    console.log("Kruti k3:", k3);
    console.log("Kruti k4:", k4);

    const { krutiDevToUnicode } = await import('./src/services/krutiDevConverter.js');
    console.log("Reverse k1:", krutiDevToUnicode(k1));
    console.log("Reverse k2:", krutiDevToUnicode(k2));
    console.log("Reverse k3:", krutiDevToUnicode(k3));
    console.log("Reverse k4:", krutiDevToUnicode(k4));

    console.log("\n=== QUALITY VALIDATION AUDIT ===");
    const audit = checkTranslationQuality(hindi);
    console.log("Quality isValid:", audit.isValid);
    console.log("Summary:", audit.summaryMessage);
    if (!audit.isValid) {
        console.log("Untranslated words:", audit.untranslatedWords);
    }
}

run();
