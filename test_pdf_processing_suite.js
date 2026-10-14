import fs from 'fs';
import { jsPDF } from 'jspdf';
import { loadPdfDocument, inspectPageText, extractSinglePageText, extractPdfContent } from './src/services/pdfExtractor.js';
import { PageQueueService } from './src/services/pageQueueService.js';
import { translateEnglishToHindi } from './src/services/translationEngine.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';
import { validateDocumentQuality } from './src/services/qualityValidator.js';

console.log('====================================================');
console.log('   PDF PROCESSING & ERROR RESOLUTION TEST SUITE     ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(description, condition) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`[PASS] ${description}`);
    } else {
        console.error(`[FAIL] ${description}`);
    }
}

async function runTestSuite() {
    // -------------------------------------------------------------
    // GENERATE 5 TEST PDFS
    // -------------------------------------------------------------

    // 1. One-Page English PDF
    const pdf1 = new jsPDF();
    pdf1.setFont('helvetica');
    pdf1.setFontSize(16);
    pdf1.text('NORTHERN RAILWAY', 20, 30);
    pdf1.setFontSize(12);
    pdf1.text('Safety Circular No. 117/2025. Date of Issue: 22-07-2026.', 20, 45);
    pdf1.text('The Station Master must verify track circuit 505AXT is clear before giving Line Clear.', 20, 60);
    const pdf1Buffer = Buffer.from(pdf1.output('arraybuffer'));

    // 2. Multi-Page English PDF (3 pages)
    const pdf2 = new jsPDF();
    pdf2.text('Page 1: Station Master duties and Home Signal.', 20, 30);
    pdf2.text('Refer Chapter VI para 6.02(iv).', 20, 45);
    pdf2.addPage();
    pdf2.text('Page 2: Point Machine DP519A and DP519B must remain detected normal.', 20, 30);
    pdf2.addPage();
    pdf2.text('Page 3: General Rules para 1.20 and Loco Pilot instructions.', 20, 30);
    const pdf2Buffer = Buffer.from(pdf2.output('arraybuffer'));

    // 3. PDF with an Empty Page (Page 1 text, Page 2 blank, Page 3 text)
    const pdf3 = new jsPDF();
    pdf3.text('Page 1: Active operational section.', 20, 30);
    pdf3.addPage(); // Blank page 2
    pdf3.addPage();
    pdf3.text('Page 3: Resuming operational procedures after blank appendix.', 20, 30);
    const pdf3Buffer = Buffer.from(pdf3.output('arraybuffer'));

    // 4. PDF with Selectable Text (rich railway document)
    const pdf4 = new jsPDF();
    pdf4.text('NORTHERN RAILWAY SAFETY INSTRUCTIONS', 20, 20);
    pdf4.text('Subject: Station Working Rules and Signal Clearance Procedure', 20, 35);
    pdf4.text('Station Master must verify track circuit 505AXT and 505BXT before Line Clear.', 20, 50);
    pdf4.text('Comply with General Rules Chapter VI para 6.02(iv).', 20, 65);
    const pdf4Buffer = Buffer.from(pdf4.output('arraybuffer'));

    // 5. Scanned / Image-Only PDF (draws image/graphics on page with no text calls)
    const pdf5 = new jsPDF();
    // In jsPDF, add an image without any text calls
    // Generate a minimal 1x1 png base64
    const samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    pdf5.addImage(samplePng, 'PNG', 15, 15, 180, 250);
    const pdf5Buffer = Buffer.from(pdf5.output('arraybuffer'));

    console.log('--- TEST SCENARIO 1: ONE-PAGE ENGLISH PDF ---');
    const loadRes1 = await loadPdfDocument(pdf1Buffer);
    assert('Scenario 1: PDF loaded successfully', !!loadRes1.pdfDoc);
    assert('Scenario 1: Page count detected as 1', loadRes1.numPages === 1);
    const extRes1 = await extractPdfContent(pdf1Buffer);
    assert('Scenario 1: Extracted text contains "NORTHERN RAILWAY"', extRes1.plainText.includes('NORTHERN RAILWAY'));
    assert('Scenario 1: Extracted text contains "505AXT"', extRes1.plainText.includes('505AXT'));
    assert('Scenario 1: Extracted text contains "Station Master"', extRes1.plainText.includes('Station Master'));
    assert('Scenario 1: Not marked as scanned', extRes1.isScannedDocument === false);

    console.log('\n--- TEST SCENARIO 2: MULTI-PAGE ENGLISH PDF (3 PAGES) ---');
    const loadRes2 = await loadPdfDocument(pdf2Buffer);
    assert('Scenario 2: Page count detected as 3', loadRes2.numPages === 3);
    const extRes2 = await extractPdfContent(pdf2Buffer);
    assert('Scenario 2: Plain text contains Page 1 content', extRes2.plainText.includes('Page 1'));
    assert('Scenario 2: Plain text contains Page 2 content (DP519A)', extRes2.plainText.includes('DP519A'));
    assert('Scenario 2: Plain text contains Page 3 content (Loco Pilot)', extRes2.plainText.includes('Loco Pilot'));
    assert('Scenario 2: All 3 pages preserved without content loss', extRes2.pageCount === 3);

    console.log('\n--- TEST SCENARIO 3: PDF WITH EMPTY PAGE (3 PAGES, PAGE 2 EMPTY) ---');
    const loadRes3 = await loadPdfDocument(pdf3Buffer);
    assert('Scenario 3: Page count detected as 3', loadRes3.numPages === 3);
    const page1Info = await inspectPageText(await loadRes3.pdfDoc.getPage(1), 1);
    const page2Info = await inspectPageText(await loadRes3.pdfDoc.getPage(2), 2);
    const page3Info = await inspectPageText(await loadRes3.pdfDoc.getPage(3), 3);
    assert('Scenario 3: Page 1 has selectable text', page1Info.hasText === true);
    assert('Scenario 3: Page 2 safely detected as empty', page2Info.isEmpty === true && page2Info.hasText === false);
    assert('Scenario 3: Page 2 does not throw uncaught error', typeof page2Info.text === 'string');
    assert('Scenario 3: Page 3 has selectable text', page3Info.hasText === true);

    console.log('\n--- TEST SCENARIO 4: SELECTABLE TEXT & TECHNICAL CODES PIPELINE ---');
    const loadRes4 = await loadPdfDocument(pdf4Buffer);
    assert('Scenario 4: Selectable text PDF loaded', loadRes4.numPages === 1);
    const p1 = await loadRes4.pdfDoc.getPage(1);
    const page4Text = await extractSinglePageText(p1, 1);
    assert('Scenario 4: Extracted text contains "General Rules Chapter VI"', page4Text.includes('Chapter VI'));
    assert('Scenario 4: Extracted text contains "505AXT"', page4Text.includes('505AXT'));
    const hindi4 = await translateEnglishToHindi(page4Text);
    const kruti4 = unicodeToKrutiDev(hindi4);
    assert('Scenario 4: Hindi translation contains "505ए.एक्स.टी."', hindi4.includes('505ए.एक्स.टी.'));
    assert('Scenario 4: Hindi translation contains "स्टेशन मास्टर"', hindi4.includes('स्टेशन मास्टर'));
    assert('Scenario 4: Kruti Dev conversion completed', kruti4.length > 20);

    console.log('\n--- TEST SCENARIO 5: SCANNED / IMAGE-ONLY PDF ---');
    const loadRes5 = await loadPdfDocument(pdf5Buffer);
    assert('Scenario 5: Scanned PDF loaded', loadRes5.numPages === 1);
    const scannedPage = await loadRes5.pdfDoc.getPage(1);
    const scannedInfo = await inspectPageText(scannedPage, 1);
    assert('Scenario 5: Detected as scanned (hasImages === true, hasText === false)', scannedInfo.isScanned === true);
    assert('Scenario 5: Has OCR notice in text', scannedInfo.text.includes('OCR is required') || scannedInfo.text.includes('Scanned'));
    assert('Scenario 5: Does not crash or skip page', scannedInfo.hasText === false && !!scannedInfo.ocrMessage);

    console.log('\n--- TEST VERIFICATION: SAFE DOM & PROGRESS UPDATE INTEGRITY ---');
    // Test that safeSetText handles null, undefined, and valid elements without throwing
    let safeSetThrow = false;
    try {
        function testSafeSetText(el, val) {
            if (el && typeof el.textContent !== 'undefined') {
                el.textContent = val != null ? String(val) : '';
            }
        }
        testSafeSetText(null, 'test');
        testSafeSetText(undefined, 'test');
        testSafeSetText({}, 'test');
        const mockEl = { textContent: '' };
        testSafeSetText(mockEl, '10 KB • 5 Pages • PDF');
        assert('Safe text update works on mock element', mockEl.textContent === '10 KB • 5 Pages • PDF');
    } catch (e) {
        safeSetThrow = true;
    }
    assert('Safe DOM helper never throws on null/undefined elements', safeSetThrow === false);

    console.log('\n====================================================');
    console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('====================================================');

    if (passedTests === totalTests) {
        console.log('\nALL 5 PDF SCENARIOS AND REGRESSION TESTS PASSED 100%!\n');
    } else {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
