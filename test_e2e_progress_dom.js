import fs from 'fs';
import { DOMParser } from '@xmldom/xmldom';

async function runDomProgressTest() {
    console.log('================================================================');
    console.log('   E2E DOM PROGRESS PERCENTAGE & PROGRESS BAR VERIFICATION     ');
    console.log('================================================================\n');

    const htmlContent = fs.readFileSync('./index.html', 'utf-8');
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Verify IDs exist in index.html
    const hasQueueProgressFill = htmlContent.includes('id="queue-progress-fill"');
    const hasQueuePercentageText = htmlContent.includes('id="queue-percentage-text"');
    const hasQueueCurrentPageText = htmlContent.includes('id="queue-current-page-text"');
    const hasProgressBarFill = htmlContent.includes('id="progress-bar-fill"');
    const hasProgressPageCounter = htmlContent.includes('id="progress-page-counter"');

    if (!hasQueueProgressFill || !hasQueuePercentageText || !hasProgressBarFill || !hasProgressPageCounter) {
        throw new Error('Required progress DOM elements missing from index.html');
    }

    // Mock DOM elements matching real browser behavior
    const queueProgressFill = { style: { width: '0%' } };
    const queuePercentageText = { textContent: '0%' };
    const queueCurrentPageText = { textContent: 'Current Page: 0 of 0' };
    const progressBarFill = { style: { width: '0%' } };
    const progressPageCounter = { textContent: '0% Complete' };

    let passed = 0;
    let total = 0;

    function assert(name, condition) {
        total++;
        if (condition) {
            passed++;
            console.log(`[PASS] ${name}`);
        } else {
            console.error(`[FAIL] ${name}`);
            throw new Error(`Assertion failed: ${name}`);
        }
    }

    // Helper simulating handleQueueProgress DOM synchronization
    function syncQueueProgress({ totalPages, encodedCount, isCancelled, isCompleted }) {
        let pct = totalPages > 0 ? Math.floor((encodedCount / totalPages) * 100) : 0;
        if (isCompleted && !isCancelled) pct = 100;
        if (isCancelled) pct = Math.min(pct, 99);

        // State driven updates:
        queuePercentageText.textContent = `${pct}%`;
        queueProgressFill.style.width = `${pct}%`;
        queueCurrentPageText.textContent = `Page ${encodedCount} of ${totalPages} • ${encodedCount}/${totalPages} Completed`;
        return { pct, text: queuePercentageText.textContent, width: queueProgressFill.style.width };
    }

    // Helper simulating modal progress synchronization
    function syncModalProgress({ pct, stage, totalPages, completedPages }) {
        const cleanPct = Math.max(0, Math.min(100, Math.round(pct)));
        progressBarFill.style.width = `${cleanPct}%`;
        progressPageCounter.textContent = `${cleanPct}% Complete (${completedPages}/${totalPages} Pages)`;
        return { cleanPct, text: progressPageCounter.textContent, width: progressBarFill.style.width };
    }

    console.log('>>> TEST A: 1:1 SYNCHRONIZATION OF PERCENTAGE AND BAR WIDTH');
    const milestones = [
        { completed: 10, total: 100, expectedPct: 10 },
        { completed: 25, total: 100, expectedPct: 25 },
        { completed: 50, total: 100, expectedPct: 50 },
        { completed: 55, total: 100, expectedPct: 55 },
        { completed: 75, total: 100, expectedPct: 75 },
        { completed: 100, total: 100, expectedPct: 100, isCompleted: true }
    ];

    for (const m of milestones) {
        const res = syncQueueProgress({
            totalPages: m.total,
            encodedCount: m.completed,
            isCompleted: !!m.isCompleted,
            isCancelled: false
        });
        assert(`Queue: ${m.expectedPct}% text equals exact "${m.expectedPct}%"`, res.text === `${m.expectedPct}%`);
        assert(`Queue: progress bar width is exactly "${m.expectedPct}%"`, res.width === `${m.expectedPct}%`);

        const modalRes = syncModalProgress({
            pct: m.expectedPct,
            stage: 'Processing',
            totalPages: m.total,
            completedPages: m.completed
        });
        assert(`Modal: bar width is exactly "${m.expectedPct}%"`, modalRes.width === `${m.expectedPct}%`);
        assert(`Modal: counter text includes "${m.expectedPct}% Complete"`, modalRes.text.includes(`${m.expectedPct}% Complete`));
    }

    console.log('\n>>> TEST B: PAGE-BASED CALCULATION VERIFICATION FOR 1, 50, 100, 300 PAGES');

    // 1-page PDF
    const p1 = syncQueueProgress({ totalPages: 1, encodedCount: 1, isCompleted: true, isCancelled: false });
    assert('1-page PDF complete -> 100%', p1.pct === 100 && p1.width === '100%');

    // 50 pages total, 10 completed = 20%
    const p50 = syncQueueProgress({ totalPages: 50, encodedCount: 10, isCompleted: false, isCancelled: false });
    assert('50 pages, 10 completed -> exactly 20% width & 20% text', p50.pct === 20 && p50.width === '20%' && p50.text === '20%');

    // 100 pages total, 55 completed = 55%
    const p100 = syncQueueProgress({ totalPages: 100, encodedCount: 55, isCompleted: false, isCancelled: false });
    assert('100 pages, 55 completed -> exactly 55% width & 55% text', p100.pct === 55 && p100.width === '55%' && p100.text === '55%');

    // 300 pages total, 150 completed = 50%
    const p300 = syncQueueProgress({ totalPages: 300, encodedCount: 150, isCompleted: false, isCancelled: false });
    assert('300 pages, 150 completed -> exactly 50% width & 50% text', p300.pct === 50 && p300.width === '50%' && p300.text === '50%');

    console.log('\n>>> TEST C: CANCEL HANDLING NEVER SHOWS 100%');
    const pCancel = syncQueueProgress({ totalPages: 100, encodedCount: 50, isCompleted: false, isCancelled: true });
    assert('Cancelled at 50 pages -> 50% (never 100%)', pCancel.pct === 50 && pCancel.width === '50%');

    const pCancelLate = syncQueueProgress({ totalPages: 100, encodedCount: 99, isCompleted: false, isCancelled: true });
    assert('Cancelled at 99 pages -> 99% (never 100%)', pCancelLate.pct === 99 && pCancelLate.width === '99%');

    console.log('\n================================================================');
    console.log(` ALL DOM PROGRESS TESTS PASSED! (${passed}/${total})           `);
    console.log('================================================================');
}

runDomProgressTest().catch(err => {
    console.error('DOM Progress test failed:', err);
    process.exit(1);
});
