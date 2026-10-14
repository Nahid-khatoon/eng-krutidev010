import { Document, Paragraph, TextRun, AlignmentType, UnderlineType, Packer } from 'docx';
import { transformDocxBuffer } from './src/services/docxGenerator.js';
import { translateEnglishToHindi, checkTranslationQuality } from './src/services/translationEngine.js';
import { translateTechnicalCodes } from './src/services/technicalCodes.js';
import { unicodeToKrutiDev, krutiDevToUnicode } from './src/services/krutiDevConverter.js';
import { validateTranslationCompleteness } from './src/services/qualityValidator.js';
import JSZip from 'jszip';
import fs from 'fs';

async function runTestSuite() {
    console.log("==================================================");
    console.log("TEST 1: SECTION 10 BENCHMARK SAMPLE");
    console.log("==================================================");
    const sampleInput = `2.5.1 RUNNING LINES

(a) UP Main Line (Line No. 2)
(b) UP Loop Line (Line No. 1)
(c) DN Main Line (Line No. 3)
(d) DN Loop Line (Line No. 4)`;

    const hindiOutput = await translateEnglishToHindi(sampleInput);
    console.log("Hindi Unicode Output:\n" + hindiOutput);

    const expectedLines = [
        "2.5.1 रनिंग लाइन्स",
        "(ए) अप मेन लाइन (लाइन नंबर 2)",
        "(बी) अप लूप लाइन (लाइन नंबर 1)",
        "(सी) डाउन मेन लाइन (लाइन नंबर 3)",
        "(डी) डाउन लूप लाइन (लाइन नंबर 4)"
    ];

    const actualLines = hindiOutput.split('\n').filter(l => l.trim().length > 0);
    let samplePassed = true;
    for (let i = 0; i < expectedLines.length; i++) {
        if (actualLines[i] !== expectedLines[i]) {
            console.error(`Line mismatch at line ${i+1}: expected "${expectedLines[i]}", got "${actualLines[i]}"`);
            samplePassed = false;
        }
    }
    if (samplePassed) {
        console.log(">>> TEST 1 PASSED: 100% exact match on Section 10 sample!");
    } else {
        console.error(">>> TEST 1 FAILED!");
        process.exit(1);
    }

    console.log("\n==================================================");
    console.log("TEST 2: TECHNICAL CODES TO HINDI UNICODE");
    console.log("==================================================");
    const techTests = [
        ["505AXT", "505ए.एक्स.टी."],
        ["505BXT", "505बी.एक्स.टी."],
        ["S9AXT", "एस9ए.एक्स.टी."],
        ["S9BXT", "एस9बी.एक्स.टी."],
        ["DP519A", "डी.पी.519ए"],
        ["DP519B", "डी.पी.519बी"],
        ["ODP507A", "ओ.डी.पी.507ए"],
        ["UP", "अप"],
        ["DN", "डाउन"],
        ["MNP", "एम.एन.पी."],
        ["ELB", "ई.एल.बी."],
        ["EKT", "ई.के.टी."],
        ["DSTE", "डी.एस.टी.ई."],
        ["VDO", "वी.डी.ओ."],
        ["VDU", "वी.डी.यू."],
        ["KEU", "के.ई.यू."],
        ["GWR", "जी.डब्ल्यू.आर."],
        ["SI-24", "एस.आई.-24"],
        ["TVU", "टी.वी.यू."],
        ["DLV", "डी.एल.वी."]
    ];

    let techPassed = true;
    for (const [code, expected] of techTests) {
        const actual = translateTechnicalCodes(code);
        if (actual !== expected) {
            console.error(`Code mismatch: ${code} -> expected "${expected}", got "${actual}"`);
            techPassed = false;
        } else {
            console.log(`  ${code} -> ${actual} (OK)`);
        }
    }
    if (techPassed) {
        console.log(">>> TEST 2 PASSED: All 20 technical codes match exactly!");
    } else {
        console.error(">>> TEST 2 FAILED!");
        process.exit(1);
    }

    console.log("\n==================================================");
    console.log("TEST 3: ROMAN NUMERAL PRESERVATION");
    console.log("==================================================");
    const romanIn = "Chapter VI para 6.02(iv)";
    const romanOut = await translateEnglishToHindi(romanIn);
    console.log(`  "${romanIn}" -> "${romanOut}"`);
    if (romanOut === "अध्याय VI पैरा 6.02(iv)") {
        console.log(">>> TEST 3 PASSED: Roman numeral VI and decimal reference 6.02(iv) preserved exactly!");
    } else {
        console.error(">>> TEST 3 FAILED: expected 'अध्याय VI पैरा 6.02(iv)', got " + romanOut);
        process.exit(1);
    }

    console.log("\n==================================================");
    console.log("TEST 4: KRUTI DEV 010 ENCODING & REVERSE SYMMETRY");
    console.log("==================================================");
    const k1 = unicodeToKrutiDev("2.5.1 रनिंग लाइन्स");
    const k2 = unicodeToKrutiDev("(ए) अप मेन लाइन (लाइन नंबर 2)");
    const k3 = unicodeToKrutiDev("505ए.एक्स.टी.");
    const k4 = unicodeToKrutiDev("अध्याय VI पैरा 6.02(iv)");

    console.log("Kruti encoded k1:", k1);
    console.log("Kruti encoded k2:", k2);
    console.log("Kruti encoded k3:", k3);
    console.log("Kruti encoded k4:", k4);

    const r1 = krutiDevToUnicode(k1);
    const r2 = krutiDevToUnicode(k2);
    const r3 = krutiDevToUnicode(k3);
    const r4 = krutiDevToUnicode(k4);

    if (r1 === "2.5.1 रनिंग लाइन्स" &&
        r2 === "(ए) अप मेन लाइन (लाइन नंबर 2)" &&
        r3 === "505ए.एक्स.टी." &&
        r4 === "अध्याय VI पैरा 6.02(iv)") {
        console.log(">>> TEST 4 PASSED: 100% symmetric lossless conversion!");
    } else {
        console.error(">>> TEST 4 FAILED in reverse conversion!");
        process.exit(1);
    }

    console.log("\n==================================================");
    console.log("TEST 5: TRANSLATION QUALITY AUDIT");
    console.log("==================================================");
    const qualityAudit = checkTranslationQuality(hindiOutput);
    console.log("Audit isValid:", qualityAudit.isValid);
    console.log("Summary:", qualityAudit.summaryMessage);
    if (qualityAudit.isValid) {
        console.log(">>> TEST 5 PASSED: Zero untranslated English words!");
    } else {
        console.error(">>> TEST 5 FAILED: Untranslated words:", qualityAudit.untranslatedWords);
        process.exit(1);
    }

    console.log("\n==================================================");
    console.log("TEST 6: IN-PLACE DOCX XML FORMATTING PRESERVATION");
    console.log("==================================================");
    // Create original test DOCX using docx library with explicit alignments, styles, and runs
    const sourceDoc = new Document({
        sections: [{
            properties: {},
            children: [
                // 1. One centered bold heading
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: "2.5.1 RUNNING LINES",
                            bold: true,
                            size: 32
                        })
                    ]
                }),
                // 2. One left-aligned paragraph with alphabetic numbering
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({
                            text: "(a) ",
                            bold: true,
                            size: 24
                        }),
                        new TextRun({
                            text: "UP Main Line (Line No. 2)",
                            size: 24
                        })
                    ]
                }),
                // 3. One justified paragraph
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({
                            text: "Before giving line clear, the station master must verify crossover clearance.",
                            size: 24
                        })
                    ]
                }),
                // 4. One underlined sentence
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({
                            text: "Duties of Station Master and Loco Pilot must be strictly followed.",
                            underline: { type: UnderlineType.SINGLE },
                            size: 24
                        })
                    ]
                }),
                // 5. One paragraph with Roman numerals
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({
                            text: "Chapter VI para 6.02(iv)",
                            bold: true,
                            size: 24
                        })
                    ]
                }),
                // 6. One paragraph containing technical codes and dates
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({
                            text: "Track Circuit 505AXT and 505BXT clear on 22.07.2026.",
                            size: 24
                        })
                    ]
                })
            ]
        }]
    });

    const origBuffer = await Packer.toBuffer(sourceDoc);
    console.log(`Original DOCX generated: ${origBuffer.length} bytes.`);

    // Perform in-place XML transformation into Kruti Dev 010
    const transformedBytes = await transformDocxBuffer(origBuffer, {
        mode: 'krutidev'
    });
    console.log(`Transformed DOCX generated: ${transformedBytes.length} bytes.`);
    fs.writeFileSync('test_output_krutidev.docx', Buffer.from(transformedBytes));
    console.log("Saved transformed DOCX to test_output_krutidev.docx.");

    // Inspect word/document.xml inside transformed DOCX zip
    const zip = await JSZip.loadAsync(transformedBytes);
    const docXml = await zip.file('word/document.xml').async('text');

    console.log("\n--- Validating word/document.xml ---");

    // 1. Verify alignment preservation
    const hasCenter = docXml.includes('w:val="center"');
    const hasBoth = docXml.includes('w:val="both"');
    console.log("Paragraph alignment Center preserved:", hasCenter ? "YES (OK)" : "NO (FAIL)");
    console.log("Paragraph alignment Justified (both) preserved:", hasBoth ? "YES (OK)" : "NO (FAIL)");

    // 2. Verify font styling preservation
    const hasBold = docXml.includes('<w:b/>') || docXml.includes('<w:b ');
    const hasUnderline = docXml.includes('<w:u ') || docXml.includes('<w:u/>');
    console.log("Bold formatting preserved:", hasBold ? "YES (OK)" : "NO (FAIL)");
    console.log("Underline formatting preserved:", hasUnderline ? "YES (OK)" : "NO (FAIL)");

    // 3. Verify Kruti Dev 010 font application to Hindi
    const hasKrutiFont = docXml.includes('w:ascii="Kruti Dev 010"');
    console.log("Kruti Dev 010 font applied:", hasKrutiFont ? "YES (OK)" : "NO (FAIL)");

    // 4. Verify Times New Roman font application to numbers / Roman numerals
    const hasTimesFont = docXml.includes('w:ascii="Times New Roman"');
    console.log("Times New Roman font applied to numbers/Roman numerals:", hasTimesFont ? "YES (OK)" : "NO (FAIL)");

    // 5. Verify preserved numbers and codes
    const hasDate = docXml.includes('22.07.2026');
    console.log("Date 22.07.2026 preserved:", hasDate ? "YES (OK)" : "NO (FAIL)");

    const hasRomanVI = docXml.includes('VI');
    console.log("Roman numeral VI preserved:", hasRomanVI ? "YES (OK)" : "NO (FAIL)");

    const hasDecimal = docXml.includes('6.02(iv)');
    console.log("Decimal reference 6.02(iv) preserved:", hasDecimal ? "YES (OK)" : "NO (FAIL)");

    const allXmlOk = hasCenter && hasBoth && hasBold && hasUnderline && hasKrutiFont && hasTimesFont && hasDate && hasRomanVI && hasDecimal;
    if (allXmlOk) {
        console.log(">>> TEST 6 PASSED: All OpenXML formatting, fonts, alignments, and text preserved with 100% precision!");
    } else {
        console.error(">>> TEST 6 FAILED on OpenXML inspection!");
        process.exit(1);
    }

    console.log("\n==================================================");
    console.log("ALL 6 TESTS COMPLETED AND PASSED WITH 100% SUCCESS!");
    console.log("==================================================");
}

runTestSuite().catch(err => {
    console.error("Test Suite Error:", err);
    process.exit(1);
});
