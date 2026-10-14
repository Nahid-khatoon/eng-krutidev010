import { Document, Paragraph, TextRun, ImageRun, Packer, Table, TableRow, TableCell, WidthType, Header, Footer } from 'docx';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { transformDocxBuffer } from './src/services/docxGenerator.js';
import { extractDocxContent } from './src/services/docxExtractor.js';
import { extractPdfContent, loadPdfDocument } from './src/services/pdfExtractor.js';
import { validateImagePreservation, validateDocumentQuality } from './src/services/qualityValidator.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';
import { translateEnglishToHindi } from './src/services/translationEngine.js';
import { translateTechnicalCodes } from './src/services/technicalCodes.js';

// Clean 1x1 PNG pixel buffer
const REAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const testImgBuffer = Buffer.from(REAL_PNG_BASE64, 'base64');

async function runTestSuite() {
    console.log('================================================================');
    console.log('   KRUTI DEV 010 — IMAGE & GRAPHICAL PRESERVATION TEST SUITE    ');
    console.log('================================================================\n');

    let allTestsPassed = true;

    // -------------------------------------------------------------
    // TEST 1: DOCX with Inline Images
    // -------------------------------------------------------------
    console.log('--- TEST 1: DOCX with Inline Images ---');
    const doc1 = new Document({
        sections: [{
            children: [
                new Paragraph({
                    children: [
                        new TextRun('Figure 1: Track Diagram for Signal 505AXT'),
                        new ImageRun({
                            data: testImgBuffer,
                            transformation: { width: 160, height: 120 }
                        }),
                        new TextRun(' Verify track circuit clearance before granting line clear.')
                    ]
                })
            ]
        }]
    });
    const buf1 = await Packer.toBuffer(doc1);
    const trans1 = await transformDocxBuffer(buf1, { mode: 'krutidev' });
    const zip1 = await JSZip.loadAsync(trans1);
    const xml1 = await zip1.file('word/document.xml').async('text');
    const media1 = Object.keys(zip1.files).filter(k => k.startsWith('word/media/')).length;
    const drawings1 = (xml1.match(/<w:drawing/g) || []).length;
    const hasKruti1 = xml1.includes('Kruti Dev 010');

    const pass1 = drawings1 === 1 && media1 >= 1 && hasKruti1;
    console.log(`Original Drawings: 1 | Preserved Drawings: ${drawings1}`);
    console.log(`Media Files Preserved: ${media1} | Kruti Dev Encoded: ${hasKruti1}`);
    console.log(`Result: ${pass1 ? 'PASSED ✓' : 'FAILED ✗'}\n`);
    if (!pass1) allTestsPassed = false;

    // -------------------------------------------------------------
    // TEST 2: DOCX with Multiple Images & Floating / Standalone Diagram
    // -------------------------------------------------------------
    console.log('--- TEST 2: DOCX with Multiple Images & Standalone Diagram ---');
    const doc2 = new Document({
        sections: [{
            children: [
                new Paragraph({
                    children: [
                        new TextRun('Header paragraph: General Overview of Station Yard.')
                    ]
                }),
                new Paragraph({
                    children: [
                        new ImageRun({
                            data: testImgBuffer,
                            transformation: { width: 300, height: 200 }
                        })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun('Figure 2: Crossover ODP507A to S9AXT.'),
                        new ImageRun({
                            data: testImgBuffer,
                            transformation: { width: 200, height: 150 }
                        })
                    ]
                })
            ]
        }]
    });
    const buf2 = await Packer.toBuffer(doc2);
    const trans2 = await transformDocxBuffer(buf2, { mode: 'krutidev' });
    const zip2 = await JSZip.loadAsync(trans2);
    const xml2 = await zip2.file('word/document.xml').async('text');
    const drawings2 = (xml2.match(/<w:drawing/g) || []).length;
    const pass2 = drawings2 === 2;
    console.log(`Original Drawings: 2 | Preserved Drawings: ${drawings2}`);
    console.log(`Result: ${pass2 ? 'PASSED ✓' : 'FAILED ✗'}\n`);
    if (!pass2) allTestsPassed = false;

    // -------------------------------------------------------------
    // TEST 3: DOCX with Images Inside Tables
    // -------------------------------------------------------------
    console.log('--- TEST 3: DOCX with Images Inside Table Cells ---');
    const doc3 = new Document({
        sections: [{
            children: [
                new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [new Paragraph({ children: [new TextRun('Point Machine DP519A Specification')] })]
                                }),
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            children: [
                                                new ImageRun({
                                                    data: testImgBuffer,
                                                    transformation: { width: 140, height: 100 }
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        }]
    });
    const buf3 = await Packer.toBuffer(doc3);
    const trans3 = await transformDocxBuffer(buf3, { mode: 'krutidev' });
    const zip3 = await JSZip.loadAsync(trans3);
    const xml3 = await zip3.file('word/document.xml').async('text');
    const drawings3 = (xml3.match(/<w:drawing/g) || []).length;
    const pass3 = drawings3 === 1;
    console.log(`Table Image Count: 1 | Preserved Table Images: ${drawings3}`);
    console.log(`Result: ${pass3 ? 'PASSED ✓' : 'FAILED ✗'}\n`);
    if (!pass3) allTestsPassed = false;

    // -------------------------------------------------------------
    // TEST 4: DOCX with Headers, Footers, Logos, and Signatures
    // -------------------------------------------------------------
    console.log('--- TEST 4: DOCX with Headers, Footers, Logos, and Signatures ---');
    const doc4 = new Document({
        sections: [{
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun('NORTHERN RAILWAY - OFFICIAL SEAL'),
                                new ImageRun({
                                    data: testImgBuffer,
                                    transformation: { width: 80, height: 60 }
                                })
                            ]
                        })
                    ]
                })
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun('Signature of Senior Divisional Signal & Telecom Engineer (DSTE)'),
                                new ImageRun({
                                    data: testImgBuffer,
                                    transformation: { width: 100, height: 50 }
                                })
                            ]
                        })
                    ]
                })
            },
            children: [
                new Paragraph({
                    children: [
                        new TextRun('Subject: Safety Circular No. 117/2025 regarding Signal Clearance.')
                    ]
                })
            ]
        }]
    });
    const buf4 = await Packer.toBuffer(doc4);
    const trans4 = await transformDocxBuffer(buf4, { mode: 'krutidev' });
    const zip4 = await JSZip.loadAsync(trans4);
    
    // Check header, footer, and media files
    const headerXml = await zip4.file('word/header1.xml')?.async('text') || '';
    const footerXml = await zip4.file('word/footer1.xml')?.async('text') || '';
    const headerDrawing = (headerXml.match(/<w:drawing/g) || []).length;
    const footerDrawing = (footerXml.match(/<w:drawing/g) || []).length;
    const totalMedia4 = Object.keys(zip4.files).filter(k => k.startsWith('word/media/')).length;

    const pass4 = headerDrawing === 1 && footerDrawing === 1 && totalMedia4 >= 2;
    console.log(`Header Logo Preserved: ${headerDrawing === 1} | Footer Signature Preserved: ${footerDrawing === 1}`);
    console.log(`Total Media Assets Preserved in ZIP: ${totalMedia4}`);
    console.log(`Result: ${pass4 ? 'PASSED ✓' : 'FAILED ✗'}\n`);
    if (!pass4) allTestsPassed = false;

    // -------------------------------------------------------------
    // TEST 5: PDF Containing Photographs and Diagrams
    // -------------------------------------------------------------
    console.log('--- TEST 5: PDF with Photograph & Signal Diagram ---');
    const pdfDoc = new jsPDF();
    pdfDoc.text('NORTHERN RAILWAY SAFETY CIRCULAR', 20, 20);
    pdfDoc.text('Figure 1: Home Signal Diagram', 20, 30);
    pdfDoc.addImage(`data:image/png;base64,${REAL_PNG_BASE64}`, 'PNG', 20, 40, 100, 80);
    pdfDoc.text('The Station Master must verify clearance before route setting.', 20, 130);
    const pdfBytes = pdfDoc.output('arraybuffer');

    const pdfExtracted = await extractPdfContent(new Uint8Array(pdfBytes));
    const pass5 = pdfExtracted.imagesCount === 1 && pdfExtracted.pageCount === 1;
    console.log(`PDF Pages: ${pdfExtracted.pageCount} | Extracted Images: ${pdfExtracted.imagesCount}`);
    if (pdfExtracted.imagesCount > 0) {
        const img = pdfExtracted.images[0];
        console.log(`Image 1 Details -> Dimensions: ${img.width}x${img.height}, X: ${img.x}, Y: ${img.y}`);
    }
    console.log(`Result: ${pass5 ? 'PASSED ✓' : 'FAILED ✗'}\n`);
    if (!pass5) allTestsPassed = false;

    // -------------------------------------------------------------
    // TEST 6: PDF Containing Multiple Images on Same Page
    // -------------------------------------------------------------
    console.log('--- TEST 6: PDF with Multiple Images on Same Page ---');
    const pdfDoc6 = new jsPDF();
    pdfDoc6.text('Yard Layout Diagrams', 20, 20);
    pdfDoc6.addImage(`data:image/png;base64,${REAL_PNG_BASE64}`, 'PNG', 20, 30, 50, 40);
    pdfDoc6.addImage(`data:image/png;base64,${REAL_PNG_BASE64}`, 'PNG', 80, 30, 50, 40);
    pdfDoc6.addImage(`data:image/png;base64,${REAL_PNG_BASE64}`, 'PNG', 20, 80, 100, 60);
    const pdfBytes6 = pdfDoc6.output('arraybuffer');

    const pdfExtracted6 = await extractPdfContent(new Uint8Array(pdfBytes6));
    const pass6 = pdfExtracted6.imagesCount === 3;
    console.log(`Multi-Image Page Image Count: ${pdfExtracted6.imagesCount} (Expected: 3)`);
    console.log(`Result: ${pass6 ? 'PASSED ✓' : 'FAILED ✗'}\n`);
    if (!pass6) allTestsPassed = false;

    // -------------------------------------------------------------
    // TEST 7: Automatic Image Validation Gate
    // -------------------------------------------------------------
    console.log('--- TEST 7: Automatic Image Validation Gate ---');
    const origInventory = {
        images: [
            { id: 'img_1', pageNum: 1, name: 'Signal Diagram', width: 400, height: 300, aspectRatio: 4/3, isTable: false },
            { id: 'img_2', pageNum: 1, name: 'Yard Map', width: 600, height: 400, aspectRatio: 1.5, isTable: false },
            { id: 'img_3', pageNum: 2, name: 'Table Diagram', width: 200, height: 150, aspectRatio: 4/3, isTable: true }
        ]
    };
    
    // Case A: Matching output
    const matchOutput = {
        images: [
            { id: 'img_1', pageNum: 1, name: 'Signal Diagram', width: 400, height: 300, aspectRatio: 4/3, isTable: false },
            { id: 'img_2', pageNum: 1, name: 'Yard Map', width: 600, height: 400, aspectRatio: 1.5, isTable: false },
            { id: 'img_3', pageNum: 2, name: 'Table Diagram', width: 200, height: 150, aspectRatio: 4/3, isTable: true }
        ]
    };
    const valResultA = validateImagePreservation(origInventory, matchOutput);
    console.log(`Validation Match Result: ${valResultA.isValid ? 'PASSED' : 'FAILED'} (100% Preserved: ${valResultA.preservedCount}/${valResultA.originalCount})`);

    // Case B: Dropped image detection
    const droppedOutput = {
        images: [
            { id: 'img_1', pageNum: 1, name: 'Signal Diagram', width: 400, height: 300, aspectRatio: 4/3, isTable: false }
        ]
    };
    const valResultB = validateImagePreservation(origInventory, droppedOutput);
    console.log(`Validation Dropped Detection: ${!valResultB.isValid ? 'CORRECTLY FLAGGED' : 'FAILED'} (Dropped: ${valResultB.droppedCount}, Errors: ${valResultB.errors.length})`);

    const pass7 = valResultA.isValid === true && valResultB.isValid === false && valResultB.droppedCount === 2;
    console.log(`Result: ${pass7 ? 'PASSED ✓' : 'FAILED ✗'}\n`);
    if (!pass7) allTestsPassed = false;

    // -------------------------------------------------------------
    // TEST 8: Text Translation & Kruti Dev Legacy Integrity
    // -------------------------------------------------------------
    console.log('--- TEST 8: Text Translation, Technical Codes & Kruti Dev 010 Integrity ---');
    const tCode1 = translateTechnicalCodes("505AXT");
    const tCode2 = translateTechnicalCodes("DP519A");
    const tCode3 = translateTechnicalCodes("ODP507A");
    const kDev1 = unicodeToKrutiDev("505ए.एक्स.टी.");
    const kDev2 = unicodeToKrutiDev("डी.पी.519ए");
    const romanHindi = await translateEnglishToHindi("Chapter VI para 6.02(iv)");
    const romanKruti = unicodeToKrutiDev(romanHindi);

    const pass8 = tCode1 === "505ए.एक्स.टी." &&
                  tCode2 === "डी.पी.519ए" &&
                  tCode3 === "ओ.डी.पी.507ए" &&
                  romanHindi.includes("VI") &&
                  romanHindi.includes("6.02(iv)") &&
                  romanKruti.includes("VI") &&
                  romanKruti.includes("6.02(iv)");

    console.log(`Technical Code 505AXT: ${tCode1} | Kruti: ${kDev1}`);
    console.log(`Technical Code DP519A: ${tCode2} | Kruti: ${kDev2}`);
    console.log(`Roman Preservation: "${romanHindi}" -> Kruti: "${romanKruti}"`);
    console.log(`Result: ${pass8 ? 'PASSED ✓' : 'FAILED ✗'}\n`);
    if (!pass8) allTestsPassed = false;

    console.log('================================================================');
    if (allTestsPassed) {
        console.log('   🎉 ALL 8/8 IMAGE & GRAPHICAL PRESERVATION TESTS PASSED!    ');
        console.log('================================================================');
    } else {
        console.log('   ❌ SOME TESTS FAILED. PLEASE REVIEW LOGS ABOVE.             ');
        console.log('================================================================');
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Test Suite encountered fatal error:', err);
    process.exit(1);
});
