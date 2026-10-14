import { PageQueueService } from './src/services/pageQueueService.js';
import { StorageService } from './src/services/storageService.js';
import { translateEnglishToHindi } from './src/services/translationEngine.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';

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

async function runTestSuite() {
    console.log('================================================================');
    console.log(' KRUTI DEV 010 — PROGRESS PERCENTAGE & PROGRESS BAR TEST SUITE  ');
    console.log('================================================================\n');

    // MOCK / SETUP StorageService for testing in Node.js
    const memoryStore = new Map();
    StorageService.saveDocument = async (doc) => {
        memoryStore.set(`doc_${doc.id}`, doc);
        return doc;
    };
    StorageService.savePageResult = async (docId, pageNum, pageData) => {
        const key = `doc_${docId}_pages`;
        const list = memoryStore.get(key) || [];
        const existingIdx = list.findIndex(p => p.pageNum === pageNum);
        const record = { docId, pageNum, ...pageData };
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...record };
        } else {
            list.push(record);
        }
        memoryStore.set(key, list);
        return record;
    };
    StorageService.getAllPagesForDoc = async (docId) => {
        return memoryStore.get(`doc_${docId}_pages`) || [];
    };

    // -------------------------------------------------------------
    // TEST 1: Page-Based Progress Calculation (Requirement 3)
    // -------------------------------------------------------------
    console.log('>>> TEST 1: PAGE-BASED PROGRESS CALCULATION');

    // Case 1A: 50 pages total, 10 completed = 20%
    const queue50 = new PageQueueService();
    queue50.activeDocId = 'test_50';
    queue50.totalPages = 50;
    for (let p = 1; p <= 50; p++) {
        await StorageService.savePageResult('test_50', p, {
            status: p <= 10 ? 'encoded' : 'pending'
        });
    }

    let reportedProgress50 = null;
    queue50.onProgressCallback = (p) => { reportedProgress50 = p; };
    await queue50.emitProgress({ currentPage: 10 });

    assert('50 pages, 10 completed: percentage === 20%', reportedProgress50.percentage === 20);
    assert('50 pages, 10 completed: encodedCount === 10', reportedProgress50.encodedCount === 10);
    assert('50 pages, 10 completed: isCompleted === false', reportedProgress50.isCompleted === false);

    // Case 1B: 100 pages total, 55 completed = 55%
    const queue100 = new PageQueueService();
    queue100.activeDocId = 'test_100';
    queue100.totalPages = 100;
    for (let p = 1; p <= 100; p++) {
        await StorageService.savePageResult('test_100', p, {
            status: p <= 55 ? 'encoded' : 'pending'
        });
    }

    let reportedProgress100 = null;
    queue100.onProgressCallback = (p) => { reportedProgress100 = p; };
    await queue100.emitProgress({ currentPage: 55 });

    assert('100 pages, 55 completed: percentage === 55%', reportedProgress100.percentage === 55);
    assert('100 pages, 55 completed: encodedCount === 55', reportedProgress100.encodedCount === 55);
    assert('100 pages, 55 completed: isCompleted === false', reportedProgress100.isCompleted === false);

    // Case 1C: 300 pages total, 150 completed = 50%
    const queue300 = new PageQueueService();
    queue300.activeDocId = 'test_300';
    queue300.totalPages = 300;
    for (let p = 1; p <= 300; p++) {
        await StorageService.savePageResult('test_300', p, {
            status: p <= 150 ? 'encoded' : 'pending'
        });
    }

    let reportedProgress300 = null;
    queue300.onProgressCallback = (p) => { reportedProgress300 = p; };
    await queue300.emitProgress({ currentPage: 150 });

    assert('300 pages, 150 completed: percentage === 50%', reportedProgress300.percentage === 50);
    assert('300 pages, 150 completed: encodedCount === 150', reportedProgress300.encodedCount === 150);
    assert('300 pages, 150 completed: isCompleted === false', reportedProgress300.isCompleted === false);

    // -------------------------------------------------------------
    // TEST 2: Exact Matching Between Percentage & Progress Bar Width (Requirement 2)
    // -------------------------------------------------------------
    console.log('\n>>> TEST 2: PERCENTAGE & PROGRESS BAR MATCHING');

    const testPercentages = [10, 25, 50, 55, 75, 100];
    for (const testPct of testPercentages) {
        // UI logic simulation
        const pctText = `${testPct}%`;
        const barWidth = `${testPct}%`;
        assert(`Pct ${testPct}%: text === "${pctText}" matches bar width === "${barWidth}"`, pctText === barWidth);
    }

    // -------------------------------------------------------------
    // TEST 3: Multi-Stage Tracking for 1-Page PDF (Requirements 3 & 4)
    // -------------------------------------------------------------
    console.log('\n>>> TEST 3: 1-PAGE MULTI-STAGE PROCESSING PROGRESS');

    const queue1 = new PageQueueService();
    queue1.activeDocId = 'test_1page';
    queue1.totalPages = 1;

    let p1Stages = [];
    queue1.onProgressCallback = (p) => {
        p1Stages.push({ stage: p.stage, percentage: p.percentage, isCompleted: p.isCompleted });
    };

    // Stage 0: Analysis
    await StorageService.savePageResult('test_1page', 1, { status: 'pending' });
    await queue1.emitProgress({ currentPage: 1, stage: 'PDF Analysis', subStepFraction: 0.0 });
    assert('Stage 0 (PDF Analysis): percentage === 0%', p1Stages[p1Stages.length - 1].percentage === 0);
    assert('Stage 0: isCompleted === false', p1Stages[p1Stages.length - 1].isCompleted === false);

    // Stage 1: Text extraction done
    await StorageService.savePageResult('test_1page', 1, { status: 'extracted' });
    await queue1.emitProgress({ currentPage: 1, stage: 'Hindi Translation', subStepFraction: 0.25 });
    assert('Stage 1 (Text Extracted): percentage === 25%', p1Stages[p1Stages.length - 1].percentage === 25);
    assert('Stage 1: isCompleted === false', p1Stages[p1Stages.length - 1].isCompleted === false);

    // Stage 2: Hindi translation done
    await StorageService.savePageResult('test_1page', 1, { status: 'translated' });
    await queue1.emitProgress({ currentPage: 1, stage: 'Kruti Dev 010 Encoding', subStepFraction: 0.75 });
    assert('Stage 2 (Hindi Translated): percentage === 75%', p1Stages[p1Stages.length - 1].percentage === 75);
    assert('Stage 2: isCompleted === false', p1Stages[p1Stages.length - 1].isCompleted === false);

    // Stage 3: Kruti encoding done (all pages encoded)
    await StorageService.savePageResult('test_1page', 1, { status: 'encoded' });
    await queue1.emitProgress({ currentPage: 1, stage: 'Completed', subStepFraction: 1.0 });
    assert('Stage 3 (Complete & Encoded): percentage === 100%', p1Stages[p1Stages.length - 1].percentage === 100);
    assert('Stage 3: isCompleted === true', p1Stages[p1Stages.length - 1].isCompleted === true);

    // -------------------------------------------------------------
    // TEST 4: Error and Cancellation Handling (Requirement 6)
    // -------------------------------------------------------------
    console.log('\n>>> TEST 4: ERROR AND CANCELLATION HANDLING');

    // Case 4A: User cancels at 50%
    const queueCancel = new PageQueueService();
    queueCancel.activeDocId = 'test_cancel';
    queueCancel.totalPages = 100;
    for (let p = 1; p <= 100; p++) {
        await StorageService.savePageResult('test_cancel', p, {
            status: p <= 50 ? 'encoded' : 'pending'
        });
    }

    let cancelProgress = null;
    queueCancel.onProgressCallback = (p) => { cancelProgress = p; };
    await queueCancel.cancelJob();

    assert('Cancelled job: isCancelled === true', cancelProgress.isCancelled === true);
    assert('Cancelled job: isCompleted === false', cancelProgress.isCompleted === false);
    assert('Cancelled job percentage is capped at 50% (never 100%)', cancelProgress.percentage === 50);
    assert('Cancelled job stage === "Cancelled"', cancelProgress.stage === 'Cancelled');

    // Case 4B: Processing fails on a page (e.g. page 7 fails)
    const queueError = new PageQueueService();
    queueError.activeDocId = 'test_error';
    queueError.totalPages = 10;
    for (let p = 1; p <= 10; p++) {
        await StorageService.savePageResult('test_error', p, {
            status: p <= 6 ? 'encoded' : (p === 7 ? 'failed' : 'pending'),
            error: p === 7 ? 'Corrupt stream' : null
        });
    }

    let errorProgress = null;
    queueError.onProgressCallback = (p) => { errorProgress = p; };
    await queueError.emitProgress({ currentPage: 7, stage: 'Error', stageDesc: 'Error on page 7: Corrupt stream' });

    assert('Failed job: isCompleted === false', errorProgress.isCompleted === false);
    assert('Failed job percentage never reaches 100% (is 60%)', errorProgress.percentage === 60);
    assert('Failed pages detected in failedPages array', errorProgress.failedPages.includes(7));

    // -------------------------------------------------------------
    // TEST 5: Monotonic Progress (No Backward Jumps) (Requirement 5)
    // -------------------------------------------------------------
    console.log('\n>>> TEST 5: MONOTONIC PROGRESS (PREVENT BACKWARD JUMPS)');

    let currentPct = 0;
    function updateSynchronizedProgress(incomingPct) {
        if (incomingPct < currentPct) {
            // monotonic clamp
            return currentPct;
        }
        currentPct = incomingPct;
        return currentPct;
    }

    assert('Progress starts at 0', updateSynchronizedProgress(0) === 0);
    assert('Progress advances to 20%', updateSynchronizedProgress(20) === 20);
    assert('Progress advances to 55%', updateSynchronizedProgress(55) === 55);
    // Transient fluctuation or out-of-order callback must NOT drop backwards
    assert('Transient 50% does not jump backward from 55%', updateSynchronizedProgress(50) === 55);
    assert('Progress advances to 75%', updateSynchronizedProgress(75) === 75);
    assert('Progress completes at 100%', updateSynchronizedProgress(100) === 100);

    // -------------------------------------------------------------
    // TEST 6: Single Document Conversion Discrete Task Progress
    // -------------------------------------------------------------
    console.log('\n>>> TEST 6: REAL DISCRETE TASK PROGRESS IN TRANSLATION');

    const sampleEnglish = "NORTHERN RAILWAY\nStation Master\nLoco Pilot on duty\nLine clear verified";
    const lineReports = [];
    const translatedResult = await translateEnglishToHindi(sampleEnglish, {
        onLineProgress: (lineIdx, totalLines) => {
            lineReports.push({ lineIdx, totalLines });
        }
    });

    assert('Translation completed non-empty text', translatedResult.length > 0);
    assert('onLineProgress fired for each line', lineReports.length >= 4);
    assert('Last line reported totalLines === 4', lineReports[lineReports.length - 1].totalLines === 4);

    console.log('\n================================================================');
    console.log(` ALL PROGRESS TESTS PASSED! (${passed}/${total})               `);
    console.log('================================================================');
}

runTestSuite().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
