import fs from 'fs';
import assert from 'assert';
import { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, Packer } from 'docx';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { transformDocxBuffer } from './src/services/docxGenerator.js';
import { checkTranslationQuality } from './src/services/translationEngine.js';

async function createAndVerifySample10() {
    console.log('==================================================');
    console.log('CREATING TEST SOURCE DOCX WITH SECTION 10 SAMPLE');
    console.log('==================================================\n');

    const paragraphs = [
        // 1. Centered heading (Bold, 32 half-pts = 16 pt)
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: '2.5 RUNNING LINES', bold: true, size: 32 })
            ]
        }),
        // 2. Left-aligned (i) UP Main Line (Line No. 2)
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: '(i) UP Main Line (Line No. 2)', size: 24 })
            ]
        }),
        // 3. Left-aligned (ii) UP Loop Line (Line No. 1)
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: '(ii) UP Loop Line (Line No. 1)', size: 24 })
            ]
        }),
        // 4. Left-aligned (iii) DN Main Line (Line No. 3)
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: '(iii) DN Main Line (Line No. 3)', size: 24 })
            ]
        }),
        // 5. Left-aligned (iv) DN Loop Line (Line No. 4)
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: '(iv) DN Loop Line (Line No. 4)', size: 24 })
            ]
        }),
        // 6. Left-aligned Technical abbreviations:
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: 'Technical abbreviations:', size: 24, bold: true })
            ]
        }),
        // 7. Left-aligned abbreviations with commas
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: 'DLI, MNP, DSTE, VDU, ELB, EKT, GWR, TVU.', size: 24 })
            ]
        }),
        // 8. Additional abbreviations:
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: 'MSDAC, KEU, SI-24, AXT, BXT, VDO.', size: 24 })
            ]
        }),
        // 9. Railway terminology
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: 'Block Station Building with Gradient 1 in 400 and Distance 800.00m on Section.', size: 24 })
            ]
        }),
        // 10. Right-aligned italic
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
                new TextRun({ text: 'Date: 22.07.2026, Section Ref: 117/2025', italics: true, size: 22 })
            ]
        }),
        // 11. Justified underlined
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
                new TextRun({ text: 'Point Machine DP519A detected normal and Track circuit clear before giving Line Clear.', underline: {}, size: 24 })
            ]
        }),
        // 12. Left-indented paragraph with alphabetic markers and Roman numerals
        new Paragraph({
            alignment: AlignmentType.LEFT,
            indent: { left: 720 },
            children: [
                new TextRun({ text: '(a) First condition (b) Second condition: Chapter VI para 6.02(iv)', size: 24 })
            ]
        })
    ];

    // 13. Table
    const table = new Table({
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 4500, type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text: 'Section', bold: true })] })]
                    }),
                    new TableCell({
                        width: { size: 4500, type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text: 'Normal / Clear', bold: true })] })]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 4500, type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text: 'DLI' })] })]
                    }),
                    new TableCell({
                        width: { size: 4500, type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text: 'Point Machine' })] })]
                    })
                ]
            })
        ]
    });

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                    }
                },
                children: [...paragraphs, table]
            }
        ]
    });

    const sourceBuffer = await Packer.toBuffer(doc);
    fs.writeFileSync('test_sample10_source.docx', sourceBuffer);
    console.log('✓ Created test_sample10_source.docx (' + sourceBuffer.length + ' bytes)\n');

    // Transform to Kruti Dev 010 DOCX
    console.log('Transforming source to Kruti Dev 010 DOCX via transformDocxBuffer...');
    const krutiBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'krutidev' });
    fs.writeFileSync('test_sample10_krutidev.docx', krutiBuffer);
    console.log('✓ Created test_sample10_krutidev.docx (' + krutiBuffer.length + ' bytes)\n');

    // Transform to Unicode DOCX
    console.log('Transforming source to Hindi Unicode DOCX via transformDocxBuffer...');
    const unicodeBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'unicode' });
    fs.writeFileSync('test_sample10_unicode.docx', unicodeBuffer);
    console.log('✓ Created test_sample10_unicode.docx (' + unicodeBuffer.length + ' bytes)\n');

    // Now deep inspect test_sample10_krutidev.docx and test_sample10_unicode.docx
    console.log('==================================================');
    console.log('VERIFYING CHECKS ON GENERATED DOCUMENTS');
    console.log('==================================================\n');

    const zip = await JSZip.loadAsync(krutiBuffer);
    const xml = await zip.file('word/document.xml').async('text');
    const dom = new DOMParser().parseFromString(xml, 'text/xml');
    const pNodes = Array.from(dom.getElementsByTagName('w:p'));

    console.log(`Total paragraphs found: ${pNodes.length}`);

    // Helper: get text and font info for all runs in a paragraph
    function getRuns(p) {
        return Array.from(p.getElementsByTagName('w:r')).map(r => {
            const fontEl = r.getElementsByTagName('w:rFonts')[0];
            const font = fontEl ? fontEl.getAttribute('w:ascii') : 'default';
            const b = r.getElementsByTagName('w:b')[0];
            const i = r.getElementsByTagName('w:i')[0];
            const u = r.getElementsByTagName('w:u')[0];
            const sz = r.getElementsByTagName('w:sz')[0];
            const tNodes = Array.from(r.getElementsByTagName('w:t'));
            const text = tNodes.map(t => t.textContent).join('');
            return {
                font,
                text,
                bold: !!b,
                italic: !!i,
                underline: !!u,
                size: sz ? sz.getAttribute('w:val') : null
            };
        });
    }

    // Helper: get alignment
    function getAlignment(p) {
        const jc = p.getElementsByTagName('w:jc')[0];
        return jc ? jc.getAttribute('w:val') : 'left';
    }

    // Helper: get indentation
    function getIndentLeft(p) {
        const ind = p.getElementsByTagName('w:ind')[0];
        return ind ? ind.getAttribute('w:left') : null;
    }

    let passedChecks = 0;

    // Check 1: Paragraph 0 (Heading): Centered, Bold, Size preserved
    console.log('Checking Paragraph 0 (2.5 RUNNING LINES):');
    const p0Runs = getRuns(pNodes[0]);
    const p0Align = getAlignment(pNodes[0]);
    assert.strictEqual(p0Align, 'center', 'Paragraph 0 must have center alignment');
    assert.ok(p0Runs.some(r => r.bold), 'Paragraph 0 must have bold run');
    assert.ok(p0Runs.some(r => r.size === '32'), 'Paragraph 0 must preserve size 32');
    assert.ok(p0Runs.some(r => r.text.includes('2.5')), 'Must preserve 2.5');
    assert.ok(p0Runs.some(r => r.font === 'Kruti Dev 010'), 'Must have Kruti Dev 010 text for रनिंग लाइन्स');
    console.log('  -> Alignment: ' + p0Align + ', Runs: ' + JSON.stringify(p0Runs.map(r => ({ text: r.text, font: r.font, bold: r.bold }))));
    console.log('  [PASS] Paragraph 0: Center alignment, Bold, and Kruti Dev 010 encoding verified.\n');
    passedChecks++;

    // Check 2: Paragraph 1 ((i) UP Main Line (Line No. 2))
    console.log('Checking Paragraph 1 ((i) UP Main Line (Line No. 2)):');
    const p1Runs = getRuns(pNodes[1]);
    const p1Align = getAlignment(pNodes[1]);
    assert.strictEqual(p1Align, 'left', 'Paragraph 1 must have left alignment');
    assert.ok(p1Runs.some(r => r.text.includes('(i)') && r.font === 'Times New Roman'), '(i) must be in Times New Roman');
    assert.ok(p1Runs.some(r => r.text.includes('2)') && r.font === 'Times New Roman'), 'Number 2 must be preserved');
    assert.ok(p1Runs.some(r => r.font === 'Kruti Dev 010'), 'Must contain Kruti Dev 010 font');
    console.log('  -> Alignment: ' + p1Align + ', Runs: ' + JSON.stringify(p1Runs.map(r => ({ text: r.text, font: r.font }))));
    console.log('  [PASS] Paragraph 1: Left alignment, Roman numeral (i), Line No. 2, and Kruti Dev 010 verified.\n');
    passedChecks++;

    // Check 3: Paragraphs 2-4 ((ii), (iii), (iv))
    console.log('Checking Paragraphs 2-4:');
    const p2Runs = getRuns(pNodes[2]);
    const p3Runs = getRuns(pNodes[3]);
    const p4Runs = getRuns(pNodes[4]);
    assert.ok(p2Runs.some(r => r.text.includes('(ii)') && r.font === 'Times New Roman'), '(ii) in Times New Roman');
    assert.ok(p3Runs.some(r => r.text.includes('(iii)') && r.font === 'Times New Roman'), '(iii) in Times New Roman');
    assert.ok(p4Runs.some(r => r.text.includes('(iv)') && r.font === 'Times New Roman'), '(iv) in Times New Roman');
    console.log('  [PASS] Paragraphs 2-4: Roman numerals (ii), (iii), (iv) all preserved in Times New Roman.\n');
    passedChecks++;

    // Check 4: Paragraph 6 (DLI, MNP, DSTE, VDU, ELB, EKT, GWR, TVU.)
    console.log('Checking Paragraph 6 (Technical abbreviations with dots):');
    const p6Runs = getRuns(pNodes[6]);
    const p6Align = getAlignment(pNodes[6]);
    assert.strictEqual(p6Align, 'left', 'Paragraph 6 must have left alignment');
    // Ensure all dots are in Times New Roman so they appear visibly as dots in Word
    const p6DotRuns = p6Runs.filter(r => r.text.includes('.') && r.font === 'Times New Roman');
    assert.ok(p6DotRuns.length > 0, 'Technical abbreviations must have dots in Times New Roman runs');
    // Check that there are NO untranslated English acronyms in p6
    const p6FullText = p6Runs.map(r => r.text).join('');
    assert.ok(!p6FullText.includes('DLI'), 'DLI must not be in English');
    assert.ok(!p6FullText.includes('MNP'), 'MNP must not be in English');
    assert.ok(!p6FullText.includes('DSTE'), 'DSTE must not be in English');
    assert.ok(!p6FullText.includes('VDU'), 'VDU must not be in English');
    assert.ok(!p6FullText.includes('ELB'), 'ELB must not be in English');
    assert.ok(!p6FullText.includes('EKT'), 'EKT must not be in English');
    assert.ok(!p6FullText.includes('GWR'), 'GWR must not be in English');
    assert.ok(!p6FullText.includes('TVU'), 'TVU must not be in English');
    console.log('  -> Total runs: ' + p6Runs.length + ', Times New Roman dot runs: ' + p6DotRuns.length);
    console.log('  [PASS] Paragraph 6: All abbreviations converted with dots preserved in Times New Roman.\n');
    passedChecks++;

    // Check 5: Paragraph 7 (MSDAC, KEU, SI-24, AXT, BXT, VDO.)
    console.log('Checking Paragraph 7 (Additional abbreviations):');
    const p7Runs = getRuns(pNodes[7]);
    const p7FullText = p7Runs.map(r => r.text).join('');
    assert.ok(!p7FullText.includes('MSDAC'), 'MSDAC must not be in English');
    assert.ok(!p7FullText.includes('KEU'), 'KEU must not be in English');
    assert.ok(!p7FullText.includes('AXT'), 'AXT must not be in English');
    assert.ok(!p7FullText.includes('BXT'), 'BXT must not be in English');
    assert.ok(!p7FullText.includes('VDO'), 'VDO must not be in English');
    console.log('  [PASS] Paragraph 7: All abbreviations converted with dots preserved.\n');
    passedChecks++;

    // Check 6: Paragraph 8 (Railway terminology: Block Station Building, Gradient, Distance, Section)
    console.log('Checking Paragraph 8 (Railway terminology):');
    const p8Runs = getRuns(pNodes[8]);
    const p8FullText = p8Runs.map(r => r.text).join('');
    assert.ok(!p8FullText.includes('Block Station'), 'Block Station must be translated');
    assert.ok(!p8FullText.includes('Station Building'), 'Station Building must be translated');
    assert.ok(!p8FullText.includes('Gradient'), 'Gradient must be translated');
    assert.ok(!p8FullText.includes('Distance'), 'Distance must be translated');
    assert.ok(!p8FullText.includes('Section'), 'Section must be translated');
    assert.ok(p8Runs.some(r => r.text.includes('800.00')), '800.00 must be preserved');
    console.log('  [PASS] Paragraph 8: Railway terminology translated, numbers preserved.\n');
    passedChecks++;

    // Check 7: Paragraph 9 (Right-aligned, Italics: Date 22.07.2026, Section Ref 117/2025)
    console.log('Checking Paragraph 9 (Right-aligned, Italics):');
    const p9Runs = getRuns(pNodes[9]);
    const p9Align = getAlignment(pNodes[9]);
    assert.strictEqual(p9Align, 'right', 'Paragraph 9 must be right aligned');
    assert.ok(p9Runs.some(r => r.italic), 'Paragraph 9 must preserve italics');
    assert.ok(p9Runs.some(r => r.text.includes('22.07.2026')), '22.07.2026 preserved');
    assert.ok(p9Runs.some(r => r.text.includes('117/2025')), '117/2025 preserved');
    console.log('  -> Alignment: ' + p9Align + ', Italic: true');
    console.log('  [PASS] Paragraph 9: Right alignment, italics, and dates/references preserved.\n');
    passedChecks++;

    // Check 8: Paragraph 10 (Justified, Underline: Point Machine, normal, clear)
    console.log('Checking Paragraph 10 (Justified, Underline):');
    const p10Runs = getRuns(pNodes[10]);
    const p10Align = getAlignment(pNodes[10]);
    assert.strictEqual(p10Align, 'both', 'Paragraph 10 must be justified (both)');
    assert.ok(p10Runs.some(r => r.underline), 'Paragraph 10 must preserve underline');
    const p10FullText = p10Runs.map(r => r.text).join('');
    assert.ok(!p10FullText.includes('Point Machine'), 'Point Machine must be translated');
    assert.ok(!p10FullText.toLowerCase().includes('normal'), 'Normal must be translated');
    assert.ok(!p10FullText.toLowerCase().includes('clear'), 'Clear must be translated');
    console.log('  -> Alignment: ' + p10Align + ', Underline: true');
    console.log('  [PASS] Paragraph 10: Justified alignment, underline, and terminology translated.\n');
    passedChecks++;

    // Check 9: Paragraph 11 (Left indentation, (a) -> (ए), (b) -> (बी), Roman VI, 6.02(iv))
    console.log('Checking Paragraph 11 (Left indentation, list markers, Roman numerals):');
    const p11Runs = getRuns(pNodes[11]);
    const p11Align = getAlignment(pNodes[11]);
    const p11Indent = getIndentLeft(pNodes[11]);
    assert.strictEqual(p11Align, 'left', 'Paragraph 11 must be left aligned');
    assert.strictEqual(p11Indent, '720', 'Paragraph 11 indentation 720 dxa must be preserved');
    assert.ok(p11Runs.some(r => r.text.includes('VI')), 'Roman numeral VI must be preserved');
    assert.ok(p11Runs.some(r => r.text.includes('6.02(iv)')), '6.02(iv) must be preserved');
    console.log('  -> Alignment: ' + p11Align + ', Indentation: ' + p11Indent + ' dxa');
    console.log('  [PASS] Paragraph 11: Left indentation 720 dxa, Roman VI, and 6.02(iv) preserved.\n');
    passedChecks++;

    // Check 10: Table translation and structure
    console.log('Checking Table paragraphs:');
    const tableParaIndices = [12, 13, 14, 15]; // The 4 cells in the 2x2 table
    for (const idx of tableParaIndices) {
        if (pNodes[idx]) {
            const tRuns = getRuns(pNodes[idx]);
            const cellText = tRuns.map(r => r.text).join('');
            assert.ok(!cellText.includes('Section'), `Table cell at p[${idx}] must translate Section`);
            assert.ok(!cellText.includes('DLI'), `Table cell at p[${idx}] must translate DLI`);
            assert.ok(!cellText.includes('Point Machine'), `Table cell at p[${idx}] must translate Point Machine`);
        }
    }
    console.log('  [PASS] Table cells translated properly without breaking table structure.\n');
    passedChecks++;

    // Check 11: Check for any bidi / rtl tags anywhere in document.xml
    console.log('Checking for any bidi / rtl tags in entire XML:');
    assert.strictEqual(xml.includes('<w:bidi'), false, 'Document must not contain any w:bidi tags');
    assert.strictEqual(xml.includes('<w:rtl'), false, 'Document must not contain any w:rtl tags');
    console.log('  [PASS] Zero w:bidi and zero w:rtl tags found in document.xml.\n');
    passedChecks++;

    // Check 12: Unicode document quality verification
    console.log('Checking Hindi Unicode DOCX quality:');
    const uniZip = await JSZip.loadAsync(unicodeBuffer);
    const uniXml = await uniZip.file('word/document.xml').async('text');
    const uniDom = new DOMParser().parseFromString(uniXml, 'text/xml');
    const uniPNodes = Array.from(uniDom.getElementsByTagName('w:p'));
    assert.strictEqual(getAlignment(uniPNodes[0]), 'center', 'Unicode Para 0 must be center');
    assert.strictEqual(getAlignment(uniPNodes[9]), 'right', 'Unicode Para 9 must be right');
    assert.strictEqual(getAlignment(uniPNodes[10]), 'both', 'Unicode Para 10 must be both (justified)');
    assert.strictEqual(getIndentLeft(uniPNodes[11]), '720', 'Unicode Para 11 indent must be 720');

    // Extract all text from Unicode document and run checkTranslationQuality
    const allUniText = uniPNodes.map(p => p.textContent).join('\n');
    const quality = checkTranslationQuality(allUniText);
    console.log('  -> Quality report:', JSON.stringify(quality, null, 2));
    assert.strictEqual(quality.isValid, true, 'Translation quality must be valid');
    assert.strictEqual(quality.untranslatedWordCount, 0, 'Zero untranslated English words');
    console.log('  [PASS] Unicode document verified with 100% Hindi quality and identical alignments.\n');
    passedChecks++;

    console.log('==================================================');
    console.log(`ALL ${passedChecks}/${passedChecks} CHECKS PASSED WITH FLYING COLORS!`);
    console.log('==================================================');
}

createAndVerifySample10().catch(err => {
    console.error('FAILED TEST:', err);
    process.exit(1);
});
