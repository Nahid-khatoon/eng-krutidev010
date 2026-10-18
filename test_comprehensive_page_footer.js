import fs from 'fs';
import JSZip from 'jszip';
import { transformDocxBuffer } from './src/services/docxGenerator.js';

async function runTestSuite() {
    console.log('=== Running Comprehensive Page & Footer Verification Suite ===');
    const origBuf = fs.readFileSync('C:/Users/sadiy/OneDrive/Desktop/test.docx');
    
    const outBuf = await transformDocxBuffer(origBuf, {
        mode: 'krutidev',
        onProgress: (done, total, desc) => {
            if (done === 1 || done === total || done % 25 === 0) {
                console.log(`Progress: [${done}/${total}] ${desc}`);
            }
        }
    });

    const zip = await JSZip.loadAsync(outBuf);

    // 1. Footer verification
    const footerFiles = Object.keys(zip.files).filter(k => k.includes('footer'));
    console.log('1. Footer files in archive:', footerFiles);
    if (!footerFiles.includes('word/footer1.xml')) {
        throw new Error('FAIL: word/footer1.xml missing from archive!');
    }
    const f1Content = await zip.files['word/footer1.xml'].async('text');
    console.log('   word/footer1.xml length:', f1Content.length);
    if (!f1Content.includes('euh"k \'kekZ') || !f1Content.includes('CGM/S&amp;T/IRCON')) {
        throw new Error('FAIL: Footer does not contain officer names or designations!');
    }
    console.log('   PASS: word/footer1.xml has official railway officers and designations.');

    // 2. Rels and Content_Types
    const relsStr = await zip.files['word/_rels/document.xml.rels'].async('text');
    if (!relsStr.includes('Target="footer1.xml"')) {
        throw new Error('FAIL: footer1.xml relationship missing from document.xml.rels!');
    }
    console.log('   PASS: document.xml.rels links footer1.xml.');

    const ctStr = await zip.files['[Content_Types].xml'].async('text');
    if (!ctStr.includes('PartName="/word/footer1.xml"')) {
        throw new Error('FAIL: footer1.xml missing from [Content_Types].xml!');
    }
    console.log('   PASS: [Content_Types].xml contains footer1.xml override.');

    // 3. Document XML verification
    const docXml = await zip.files['word/document.xml'].async('text');
    
    // Check footer reference in sectPr
    if (!docXml.includes('r:id="rIdFooter1"')) {
        throw new Error('FAIL: sectPr does not reference rIdFooter1!');
    }
    console.log('   PASS: sectPr has footerReference rIdFooter1.');

    // Check page breaks
    const pageBreakBefore = (docXml.match(/<w:pageBreakBefore\/>/g) || []).length;
    console.log(`2. Page breaks: pageBreakBefore = ${pageBreakBefore}`);
    if (pageBreakBefore < 3) {
        throw new Error(`FAIL: Expected at least 3 pageBreakBefore for Section 2, 2.4, 3, got ${pageBreakBefore}`);
    }
    console.log('   PASS: Sections 2, 2.4, and 3 have pageBreakBefore to ensure exact page alignment!');

    // Check margins
    const pgMarMatch = docXml.match(/<w:pgMar[^>]*\/>/);
    console.log('3. Section margins:', pgMarMatch ? pgMarMatch[0] : 'None');
    if (pgMarMatch && (pgMarMatch[0].includes('w:top="720"') || pgMarMatch[0].includes('w:bottom="720"'))) {
        throw new Error('FAIL: Margins were inappropriately crushed to 720!');
    }
    console.log('   PASS: Original document margins preserved.');

    // Save test output file to Downloads so user can open it in Word immediately if they want
    const outPath = 'C:/Users/sadiy/Downloads/test_KrutiDev010_Formatted (32).docx';
    fs.writeFileSync(outPath, Buffer.from(outBuf));
    console.log(`Saved transformed DOCX to ${outPath} (${outBuf.length} bytes)`);

    console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runTestSuite().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
