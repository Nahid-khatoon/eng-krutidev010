import fs from 'fs';
import assert from 'assert';
import { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, Packer, ImageRun, PageBreak } from 'docx';
import { transformDocxBuffer, validateDocxBuffer } from './src/services/docxGenerator.js';

// 1x1 transparent PNG buffer for image tests
const SAMPLE_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

async function runRealProgressTests() {
    console.log('================================================================');
    console.log(' REAL-TIME PROGRESS CALCULATION & VERIFICATION TEST SUITE       ');
    console.log('================================================================\n');

    let totalTestsPassed = 0;

    // Helper to inspect progress event sequence
    function createProgressRecorder() {
        const events = [];
        return {
            onProgress: (done, total, desc, details) => {
                const pct = (typeof total === 'number' && total > 0)
                    ? Math.round((done / total) * 100)
                    : (typeof done === 'number' ? Math.round(done) : 0);
                events.push({ done, total, pct, desc, details });
            },
            getEvents: () => events,
            verifyMonotonicity: (testName) => {
                assert.ok(events.length >= 3, `${testName}: Must have at least 3 progress reports, got ${events.length}`);
                assert.strictEqual(events[0].pct <= 10, true, `${testName}: Initial progress must be <= 10%, was ${events[0].pct}%`);
                assert.strictEqual(events[events.length - 1].pct, 100, `${testName}: Final progress must be exactly 100%`);

                let prevPct = -1;
                for (let i = 0; i < events.length; i++) {
                    const e = events[i];
                    assert.ok(
                        e.pct >= prevPct,
                        `${testName}: Progress must not jump backwards! At step ${i}: ${e.pct}% < prev ${prevPct}%`
                    );
                    assert.ok(
                        e.done <= e.total,
                        `${testName}: Completed units (${e.done}) must not exceed total units (${e.total})`
                    );
                    prevPct = e.pct;
                }

                // Verify that progress did NOT stall at fake 50%
                const allFifties = events.filter(e => e.pct === 50);
                assert.ok(
                    allFifties.length < events.length / 2,
                    `${testName}: Progress must not be stuck at 50% fake progress`
                );

                console.log(`  ✓ ${testName} recorded ${events.length} progress events monotonically from ${events[0].pct}% to 100%`);
            }
        };
    }

    // -----------------------------------------------------------------
    // TEST 1: 2-Page DOCX Real Progress
    // -----------------------------------------------------------------
    console.log('>>> TEST 1: 2-PAGE DOCX REAL PROGRESS CALCULATION');
    const p2Children = [
        new Paragraph({ children: [new TextRun({ text: 'Page 1 Heading', bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: 'Station Master must ensure line clear before clearing Home Signal.' })] }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ children: [new TextRun({ text: 'Page 2 Heading: Track Circuit 505AXT clear.', bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: 'DP519A locked in normal position.' })] })
    ];
    const doc2 = new Document({ sections: [{ children: p2Children }] });
    const buf2 = await Packer.toBuffer(doc2);

    const rec2 = createProgressRecorder();
    const result2 = await transformDocxBuffer(buf2, {
        mode: 'krutidev',
        onProgress: rec2.onProgress
    });

    rec2.verifyMonotonicity('2-Page DOCX');
    const val2 = await validateDocxBuffer(result2);
    assert.strictEqual(val2.valid, true, '2-Page DOCX must be valid');
    console.log('  [PASS] 2-Page DOCX generated and validated with real dynamic progress!\n');
    totalTestsPassed++;

    // -----------------------------------------------------------------
    // TEST 2: 50-Page DOCX Real Progress
    // -----------------------------------------------------------------
    console.log('>>> TEST 2: 50-PAGE DOCX REAL PROGRESS CALCULATION');
    const p50Children = [];
    const templateParas = [
        "Operating Circular: Duties of Station Master and Loco Pilot.",
        "Track circuit 505AXT and 505BXT detected normal. Distance: 800.00m.",
        "Refer Chapter VI para 6.02(iv) and Signal S9AXT clearance."
    ];
    for (let p = 1; p <= 50; p++) {
        p50Children.push(new Paragraph({
            children: [new TextRun({ text: `Page ${p}: ${templateParas[(p - 1) % templateParas.length]}`, bold: true })]
        }));
        p50Children.push(new Paragraph({
            children: [new TextRun({ text: templateParas[p % templateParas.length] })]
        }));
        if (p < 50) {
            p50Children.push(new Paragraph({ children: [new PageBreak()] }));
        }
    }
    const doc50 = new Document({ sections: [{ children: p50Children }] });
    const buf50 = await Packer.toBuffer(doc50);

    const rec50 = createProgressRecorder();
    const result50 = await transformDocxBuffer(buf50, {
        mode: 'krutidev',
        onProgress: rec50.onProgress
    });

    rec50.verifyMonotonicity('50-Page DOCX');
    const val50 = await validateDocxBuffer(result50);
    assert.strictEqual(val50.valid, true, '50-Page DOCX must be valid');
    console.log('  [PASS] 50-Page DOCX generated and validated with real dynamic progress!\n');
    totalTestsPassed++;

    // -----------------------------------------------------------------
    // TEST 3: 100-Page DOCX Real Progress
    // -----------------------------------------------------------------
    console.log('>>> TEST 3: 100-PAGE DOCX REAL PROGRESS CALCULATION');
    const p100Children = [];
    for (let p = 1; p <= 100; p++) {
        p100Children.push(new Paragraph({
            children: [new TextRun({ text: `Northern Railway Section ${p % 10}: Signal S9AXT and DP519A.`, bold: true })]
        }));
        p100Children.push(new Paragraph({
            children: [new TextRun({ text: "Station Master must ensure line clear before giving Line Clear." })]
        }));
        if (p < 100) {
            p100Children.push(new Paragraph({ children: [new PageBreak()] }));
        }
    }
    const doc100 = new Document({ sections: [{ children: p100Children }] });
    const buf100 = await Packer.toBuffer(doc100);

    const rec100 = createProgressRecorder();
    const result100 = await transformDocxBuffer(buf100, {
        mode: 'krutidev',
        onProgress: rec100.onProgress
    });

    rec100.verifyMonotonicity('100-Page DOCX');
    const val100 = await validateDocxBuffer(result100);
    assert.strictEqual(val100.valid, true, '100-Page DOCX must be valid');
    console.log('  [PASS] 100-Page DOCX generated and validated with real dynamic progress!\n');
    totalTestsPassed++;

    // -----------------------------------------------------------------
    // TEST 4: Large DOCX with Tables and Embedded Images
    // -----------------------------------------------------------------
    console.log('>>> TEST 4: LARGE DOCX CONTAINING TABLES AND IMAGES');
    const tableRows = [];
    for (let r = 1; r <= 8; r++) {
        tableRows.push(new TableRow({
            children: [
                new TableCell({
                    width: { size: 4500, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: `Section ${r}: Main Line` })] })]
                }),
                new TableCell({
                    width: { size: 4500, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: `Track Circuit 505AXT clear` })] })]
                })
            ]
        }));
    }
    const table = new Table({ rows: tableRows });

    const complexChildren = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'RAILWAY YARD SCHEMATIC & SIGNALING DETAILS', bold: true, size: 28 })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new ImageRun({
                    data: SAMPLE_PNG,
                    transformation: { width: 100, height: 100 }
                })
            ]
        }),
        new Paragraph({
            children: [new TextRun({ text: 'DLI, MNP, DSTE, VDU, ELB, EKT, GWR, TVU technical equipment inventory.' })]
        }),
        table,
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Date: 22.07.2026, Section Ref: 117/2025', italics: true })]
        })
    ];

    const complexDoc = new Document({ sections: [{ children: complexChildren }] });
    const complexBuf = await Packer.toBuffer(complexDoc);

    const recComplex = createProgressRecorder();
    const resultComplex = await transformDocxBuffer(complexBuf, {
        mode: 'krutidev',
        onProgress: recComplex.onProgress
    });

    recComplex.verifyMonotonicity('Complex Tables & Images DOCX');
    const valComplex = await validateDocxBuffer(resultComplex);
    assert.strictEqual(valComplex.valid, true, 'Complex DOCX must be valid');
    console.log('  [PASS] Complex Tables & Images DOCX generated and validated with real progress!\n');
    totalTestsPassed++;

    // -----------------------------------------------------------------
    // TEST 5: User Cancellation Handling
    // -----------------------------------------------------------------
    console.log('>>> TEST 5: CANCELLATION HANDLING (NO FAKE 100%)');
    let cancellationCaught = false;
    let cancelEvents = [];
    try {
        let count = 0;
        await transformDocxBuffer(buf50, {
            mode: 'krutidev',
            onProgress: (done, total, desc) => {
                cancelEvents.push({ done, total });
            },
            checkCancelled: () => {
                count++;
                return count > 5; // Cancel after 5 checks
            }
        });
    } catch (err) {
        cancellationCaught = true;
        assert.ok(err.message.includes('cancelled'), 'Error must specify cancellation');
    }

    assert.strictEqual(cancellationCaught, true, 'Cancellation must be caught and stop execution');
    const lastCancelEvent = cancelEvents[cancelEvents.length - 1];
    assert.ok(lastCancelEvent.done < lastCancelEvent.total, 'Cancelled job must never report done === total');
    console.log('  [PASS] Cancellation cleanly stopped execution without falsely reaching 100%!\n');
    totalTestsPassed++;

    // -----------------------------------------------------------------
    // TEST 6: Validation Rejection on Corrupted Data
    // -----------------------------------------------------------------
    console.log('>>> TEST 6: VALIDATION INTEGRITY GATE');
    let corruptCaught = false;
    try {
        await validateDocxBuffer(Buffer.from('not a docx file'));
    } catch (err) {
        corruptCaught = true;
    }
    assert.strictEqual(corruptCaught, true, 'Corrupted buffer must be rejected by validateDocxBuffer');
    console.log('  [PASS] Validation integrity gate properly rejects invalid DOCX buffers!\n');
    totalTestsPassed++;

    console.log('================================================================');
    console.log(` ALL ${totalTestsPassed}/${totalTestsPassed} REAL PROGRESS TESTS PASSED SUCCESSFULLY! `);
    console.log('================================================================');
}

runRealProgressTests().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
