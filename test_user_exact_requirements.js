import fs from 'fs';
import path from 'path';
import {
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    Packer
} from 'docx';
import JSZip from 'jszip';
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';
import { transformDocxBuffer } from './src/services/docxGenerator.js';
import { krutiDevToUnicode } from './src/services/krutiDevConverter.js';
import { checkTranslationQuality } from './src/services/translationEngine.js';

async function createSourceDocx() {
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                }
            },
            children: [
                // 1. Heading with duplicate section numbering in text
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({ text: '2.5.3. 2.5.3 Station Working Rules and Sidings', bold: true, size: 28 })
                    ]
                }),

                // 2. Heading with single section number
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({ text: '2.5.4 Duties of Station Master and Running Lines', bold: true, size: 24 })
                    ]
                }),

                // 3. Paragraph testing joined words issue
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({ text: 'RUNNING LINE AND THEIR CAPACITY', bold: true, size: 22 })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({ text: 'The station consists of running lines and non-running lines. ENGG SIDING CAL98.90 METER LONG.', size: 22 })
                    ]
                }),

                // 4. Exact table specified in User Request
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        // Header row
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Line No.', bold: true })] })] }),
                                new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true })] })] }),
                                new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true })] })] }),
                                new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Capacity / Length', bold: true })] })] })
                            ]
                        }),
                        // Row 1: HOT METAL SIDING | SLEEPER | CAL65 METER LONG
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'i)' })] })] }),
                                new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'HOT METAL SIDING' })] })] }),
                                new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'SLEEPER' })] })] }),
                                new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'CAL65 METER LONG' })] })] })
                            ]
                        }),
                        // Row 2: ENGINEERING SIDING | SLEEPER | 98.90 METER LONG
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'ii)' })] })] }),
                                new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'ENGINEERING SIDING' })] })] }),
                                new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'SLEEPER' })] })] }),
                                new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '98.90 METER LONG' })] })] })
                            ]
                        }),
                        // Row 3: NON-RUNNING LINE | - | CAL65
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'iii)' })] })] }),
                                new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'NON-RUNNING LINE' })] })] }),
                                new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '-' })] })] }),
                                new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'CAL65' })] })] })
                            ]
                        }),
                        // Row 4: SIDING | SLEEPERS | CAPACITY 50 VEHICLES
                        new TableRow({
                            children: [
                                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'iv)' })] })] }),
                                new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'SIDING' })] })] }),
                                new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'SLEEPERS' })] })] }),
                                new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'CAPACITY 50 VEHICLES' })] })] })
                            ]
                        })
                    ]
                })
            ]
        }]
    });

    return await Packer.toBuffer(doc);
}

async function runTestSuite() {
    console.log('=== STARTING USER EXACT REQUIREMENTS TEST SUITE ===\n');

    // 1. Generate Source Document
    console.log('Step 1: Creating Source DOCX with railway table, numbering, and abbreviations...');
    const sourceBuffer = await createSourceDocx();
    fs.writeFileSync('user_test_source.docx', sourceBuffer);
    console.log(' Saved source DOCX: user_test_source.docx (' + sourceBuffer.length + ' bytes)');

    // 2. Transform into Kruti Dev 010 DOCX
    console.log('\nStep 2: Transforming into Kruti Dev 010 DOCX...');
    const krutiBuffer = await transformDocxBuffer(sourceBuffer, {
        mode: 'krutidev',
        onProgress: (done, total, desc) => {
            // silent progress
        }
    });
    fs.writeFileSync('user_test_krutidev.docx', krutiBuffer);
    console.log(' Saved Kruti Dev DOCX: user_test_krutidev.docx (' + krutiBuffer.length + ' bytes)');

    // 3. Transform into Unicode Hindi DOCX
    console.log('\nStep 3: Transforming into Unicode Hindi DOCX...');
    const unicodeBuffer = await transformDocxBuffer(sourceBuffer, {
        mode: 'unicode',
        onProgress: (done, total, desc) => {
            // silent progress
        }
    });
    fs.writeFileSync('user_test_unicode.docx', unicodeBuffer);
    console.log(' Saved Unicode DOCX: user_test_unicode.docx (' + unicodeBuffer.length + ' bytes)');

    // 4. Inspect Kruti Dev XML Content
    console.log('\nStep 4: Inspecting Kruti Dev DOCX Structure & Content...');
    const zip = await JSZip.loadAsync(krutiBuffer);
    const xml = await zip.file('word/document.xml').async('text');
    const doc = new XmlDomParser().parseFromString(xml, 'text/xml');

    let passedChecks = 0;
    let totalChecks = 0;

    function assertCheck(name, condition, details = '') {
        totalChecks++;
        if (condition) {
            console.log(`  [PASS] ${name}`);
            passedChecks++;
        } else {
            console.error(`  [FAIL] ${name} - Details: ${details}`);
        }
    }

    // CHECK 1: Table exists and preserves all 5 rows and 4 columns
    const tables = doc.getElementsByTagName('w:tbl');
    assertCheck('Table structure preserved', tables.length === 1, `Found ${tables.length} tables`);
    const tbl = tables[0];
    const rows = Array.from(tbl.getElementsByTagName('w:tr'));
    assertCheck('Table has exactly 5 rows', rows.length === 5, `Found ${rows.length} rows`);

    // CHECK 2: Every row has cantSplit to prevent rows breaking across pages
    let allRowsHaveCantSplit = true;
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const trPr = rows[rIdx].getElementsByTagName('w:trPr')[0];
        const cantSplit = trPr ? trPr.getElementsByTagName('w:cantSplit')[0] : null;
        if (!cantSplit) {
            allRowsHaveCantSplit = false;
        }
    }
    assertCheck('All table rows have w:cantSplit', allRowsHaveCantSplit);

    // CHECK 3: No rogue page breaks or keepNext inside table cells
    let hasRoguePageBreaks = false;
    let hasKeepNext = false;
    const tcList = Array.from(tbl.getElementsByTagName('w:tc'));
    for (const tc of tcList) {
        if (tc.getElementsByTagName('w:pageBreakBefore').length > 0) hasRoguePageBreaks = true;
        if (tc.getElementsByTagName('w:keepNext').length > 0) hasKeepNext = true;
        const brs = Array.from(tc.getElementsByTagName('w:br'));
        for (const br of brs) {
            if (br.getAttribute('w:type') === 'page') hasRoguePageBreaks = true;
        }
    }
    assertCheck('No rogue pageBreakBefore inside table cells', !hasRoguePageBreaks);
    assertCheck('No rogue keepNext inside table cells', !hasKeepNext);

    // CHECK 4: Check cell text contents
    // Extract text per cell
    const cellData = [];
    for (let r = 0; r < rows.length; r++) {
        const rowCells = Array.from(rows[r].getElementsByTagName('w:tc'));
        const rowText = [];
        for (let c = 0; c < rowCells.length; c++) {
            const cell = rowCells[c];
            const runs = Array.from(cell.getElementsByTagName('w:r'));
            let text = '';
            for (const run of runs) {
                const rFonts = run.getElementsByTagName('w:rFonts')[0];
                const fontAscii = rFonts ? rFonts.getAttribute('w:ascii') : '';
                const t = run.getElementsByTagName('w:t')[0];
                const runText = t ? (t.textContent || '') : '';
                if (fontAscii === 'Kruti Dev 010') {
                    text += krutiDevToUnicode(runText);
                } else {
                    text += runText;
                }
            }
            rowText.push(text.trim());
        }
        cellData.push(rowText);
    }

    console.log('\nExtracted Table Cell Contents (decoded from Kruti Dev):');
    cellData.forEach((row, i) => console.log(`  Row ${i}: [ ${row.join(' | ')} ]`));

    // Assert Row 1: HOT METAL SIDING | SLEEPER | CAL65 METER LONG -> हॉट मेटल साइडिंग | स्लीपर | 65 मीटर लंबी
    assertCheck('Row 1 Column 1 has numbering i)', cellData[1][0] === 'i)');
    assertCheck('Row 1 Column 2 translates HOT METAL SIDING', cellData[1][1].includes('हॉट मेटल साइडिंग'), `Got: "${cellData[1][1]}"`);
    assertCheck('Row 1 Column 3 translates SLEEPER', cellData[1][2].includes('स्लीपर'), `Got: "${cellData[1][2]}"`);
    assertCheck('Row 1 Column 4 translates CAL65 METER LONG', cellData[1][3].includes('65 मीटर लंबी'), `Got: "${cellData[1][3]}"`);

    // Assert Row 2: ENGINEERING SIDING | SLEEPER | 98.90 METER LONG
    assertCheck('Row 2 Column 1 has numbering ii)', cellData[2][0] === 'ii)');
    assertCheck('Row 2 Column 2 translates ENGINEERING SIDING', cellData[2][1].includes('इंजीनियरिंग साइडिंग'), `Got: "${cellData[2][1]}"`);
    assertCheck('Row 2 Column 4 translates 98.90 METER LONG', cellData[2][3].includes('98.90 मीटर लंबी'), `Got: "${cellData[2][3]}"`);

    // Assert Row 3: NON-RUNNING LINE | - | CAL65
    assertCheck('Row 3 Column 1 has numbering iii)', cellData[3][0] === 'iii)');
    assertCheck('Row 3 Column 2 translates NON-RUNNING LINE', cellData[3][1].includes('गैर-रनिंग लाइन'), `Got: "${cellData[3][1]}"`);
    assertCheck('Row 3 Column 4 translates CAL65 to phonetic सी.ए.एल. 65', cellData[3][3].includes('सी.ए.एल. 65'), `Got: "${cellData[3][3]}"`);

    // Assert Row 4: SIDING | SLEEPERS | CAPACITY 50 VEHICLES
    assertCheck('Row 4 Column 2 translates SIDING', cellData[4][1].includes('साइडिंग'), `Got: "${cellData[4][1]}"`);
    assertCheck('Row 4 Column 4 translates CAPACITY', cellData[4][3].includes('क्षमता'), `Got: "${cellData[4][3]}"`);

    // CHECK 5: Duplicate section numbering deduplicated
    // Find paragraph containing 2.5.3
    const pNodes = Array.from(doc.getElementsByTagName('w:p'));
    let para253Text = '';
    for (const p of pNodes) {
        const runs = Array.from(p.getElementsByTagName('w:r'));
        let text = '';
        for (const run of runs) {
            const rFonts = run.getElementsByTagName('w:rFonts')[0];
            const fontAscii = rFonts ? rFonts.getAttribute('w:ascii') : '';
            const t = run.getElementsByTagName('w:t')[0];
            const runText = t ? (t.textContent || '') : '';
            if (fontAscii === 'Kruti Dev 010') {
                text += krutiDevToUnicode(runText);
            } else {
                text += runText;
            }
        }
        if (text.includes('2.5.3')) {
            para253Text = text;
            break;
        }
    }
    console.log(`\nSection 2.5.3 Paragraph text: "${para253Text}"`);
    assertCheck('Section 2.5.3 is NOT duplicated (no "2.5.3. 2.5.3")', !para253Text.includes('2.5.3. 2.5.3') && !para253Text.includes('2.5.3 2.5.3'), `Got: "${para253Text}"`);
    assertCheck('Section 2.5.3 number is present exactly once', (para253Text.match(/2\.5\.3/g) || []).length === 1);

    // CHECK 6: Paragraph word spaces preserved (no joined words)
    let runningLinesPara = '';
    for (const p of pNodes) {
        const runs = Array.from(p.getElementsByTagName('w:r'));
        let text = '';
        for (const run of runs) {
            const rFonts = run.getElementsByTagName('w:rFonts')[0];
            const fontAscii = rFonts ? rFonts.getAttribute('w:ascii') : '';
            const t = run.getElementsByTagName('w:t')[0];
            const runText = t ? (t.textContent || '') : '';
            if (fontAscii === 'Kruti Dev 010') {
                text += krutiDevToUnicode(runText);
            } else {
                text += runText;
            }
        }
        if (text.includes('रनिंग लाइन') && (text.includes('क्षमता') || text.includes('उनकी'))) {
            runningLinesPara = text;
            break;
        }
    }
    console.log(`\nRunning lines paragraph text: "${runningLinesPara}"`);
    assertCheck('Word spaces preserved in "रनिंग लाइन और उनकी क्षमता"', runningLinesPara.includes('रनिंग लाइन और उनकी क्षमता'), `Got: "${runningLinesPara}"`);
    assertCheck('No joined words "रनिंगलाइनऔरउनकीक्षमता"', !runningLinesPara.includes('रनिंगलाइनऔरउनकीक्षमता'));

    // CHECK 7: Font properties and xml:space preservation
    let allRunsHaveXmlSpace = true;
    const allTNodes = Array.from(doc.getElementsByTagName('w:t'));
    for (const t of allTNodes) {
        if (!t.getAttribute('xml:space') || t.getAttribute('xml:space') !== 'preserve') {
            allRunsHaveXmlSpace = false;
        }
    }
    assertCheck('All text elements have xml:space="preserve"', allRunsHaveXmlSpace);

    console.log(`\n==================================================`);
    console.log(`TEST SUITE RESULTS: ${passedChecks} / ${totalChecks} Checks Passed.`);
    console.log(`==================================================\n`);

    if (passedChecks !== totalChecks) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
});
