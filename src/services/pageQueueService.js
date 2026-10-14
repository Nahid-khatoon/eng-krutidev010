/**
 * Asynchronous Multi-Page Queue Service
 * Handles processing for 50, 100, 200, 222, 300, and 500+ page documents in batches.
 * Features:
 * - Batched execution (never blocks UI)
 * - Persistent per-page intermediate storage (IndexedDB)
 * - Pause, Resume, and Cancel support
 * - Isolated per-page retry (never restarts whole document on single page error)
 * - Real-time statistics: Total, Extracted, Translated, Encoded, Failed
 */

import { StorageService } from './storageService.js';
import { translateEnglishToHindi } from './translationEngine.js';
import { unicodeToKrutiDev } from './krutiDevConverter.js';
import { extractSinglePageText, inspectPageText, extractPageImages } from './pdfExtractor.js';

export class PageQueueService {
    constructor() {
        this.activeDocId = null;
        this.pdfDoc = null;
        this.totalPages = 0;
        this.batchSize = 5;
        this.isPaused = false;
        this.isCancelled = false;
        this.isRunning = false;
        this.onProgressCallback = null;
        this.options = {};
    }

    /**
     * Start a new processing job for a PDF document
     */
    async startJob(docId, pdfDoc, totalPages, options = {}, onProgress = null) {
        this.activeDocId = docId;
        this.pdfDoc = pdfDoc;
        this.totalPages = totalPages;
        this.options = options;
        this.onProgressCallback = onProgress;
        this.batchSize = options.batchSize || 5;
        this.isPaused = false;
        this.isCancelled = false;
        this.isRunning = true;

        // Initialize document record in IndexedDB
        await StorageService.saveDocument({
            id: docId,
            totalPages,
            status: 'processing',
            createdAt: Date.now()
        });

        // Initialize page records if not already created
        const existingPages = await StorageService.getAllPagesForDoc(docId);
        const existingMap = new Map(existingPages.map(p => [p.pageNum, p]));

        for (let p = 1; p <= totalPages; p++) {
            if (!existingMap.has(p)) {
                await StorageService.savePageResult(docId, p, {
                    status: 'pending',
                    originalText: '',
                    hindiText: '',
                    krutiText: '',
                    images: [],
                    imagesCount: 0
                });
            }
        }

        // Emit initial progress
        await this.emitProgress({
            currentPage: 1,
            stage: 'PDF Analysis',
            stageDesc: `Document analyzed. Queueing ${totalPages} pages for processing...`,
            subStepFraction: 0.0
        });

        // Run queue loop
        await this.runQueueLoop();
    }

    /**
     * Main Queue Execution Loop
     */
    async runQueueLoop() {
        while (this.isRunning && !this.isCancelled) {
            if (this.isPaused) {
                await new Promise(resolve => setTimeout(resolve, 300));
                continue;
            }

            // Find pending or failed pages
            const allPages = await StorageService.getAllPagesForDoc(this.activeDocId);
            const pendingPages = allPages.filter(p => p.status === 'pending');

            if (pendingPages.length === 0) {
                // Check if any failed
                const failed = allPages.filter(p => p.status === 'failed');
                this.isRunning = false;
                await StorageService.saveDocument({
                    id: this.activeDocId,
                    totalPages: this.totalPages,
                    status: failed.length > 0 ? 'completed_with_errors' : 'ready'
                });
                await this.emitProgress({
                    currentPage: this.totalPages,
                    stage: failed.length > 0 ? 'Completed with errors' : 'Completed',
                    stageDesc: failed.length > 0 ? `Finished with ${failed.length} failed pages.` : `All ${this.totalPages} pages processed. Running quality validation gate...`,
                    subStepFraction: 1.0
                });
                break;
            }

            // Take the next batch
            const currentBatch = pendingPages.slice(0, this.batchSize);

            for (const pageRecord of currentBatch) {
                if (this.isCancelled || this.isPaused) break;

                const pageNum = pageRecord.pageNum;
                await this.processSinglePage(pageNum);

                // Non-blocking yield to browser event loop
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
    }

    /**
     * Process an individual page end-to-end
     */
    async processSinglePage(pageNum) {
        if (this.isCancelled) return;
        const docId = this.activeDocId;
        try {
            // Stage 1: Text & Image extraction from PDF page
            await this.emitProgress({
                currentPage: pageNum,
                stage: 'PDF Text Extraction',
                stageDesc: `Extracting text and preserving images for page ${pageNum} of ${this.totalPages}...`,
                subStepFraction: 0.0
            });

            let originalText = '';
            let pageMeta = { isScanned: false, isEmpty: false, ocrMessage: null };
            let pageImages = [];

            if (this.pdfDoc) {
                const page = await this.pdfDoc.getPage(pageNum);
                const info = await inspectPageText(page, pageNum);
                originalText = info.text;
                pageMeta = { isScanned: info.isScanned, isEmpty: info.isEmpty, ocrMessage: info.ocrMessage };
                pageImages = await extractPageImages(page, pageNum, pageMeta.isScanned);
            }

            if (this.isCancelled) return;

            // Mark extracted in storage with preserved images
            await StorageService.savePageResult(docId, pageNum, {
                status: 'extracted',
                originalText,
                isScanned: pageMeta.isScanned,
                isEmpty: pageMeta.isEmpty,
                ocrMessage: pageMeta.ocrMessage,
                images: pageImages,
                imagesCount: pageImages.length
            });

            // Stage 2: Translate English to Hindi Unicode
            await this.emitProgress({
                currentPage: pageNum,
                stage: 'Hindi Translation',
                stageDesc: `Translating page ${pageNum} of ${this.totalPages} into Hindi Unicode...`,
                subStepFraction: 0.25
            });

            let hindiText = '';
            let krutiText = '';

            if (pageMeta.isScanned) {
                hindiText = `[पृष्ठ ${pageNum} सूचना: स्कैन किया गया दस्तावेज़ चित्र पाया गया जिसमें चयन योग्य पाठ परत नहीं है। स्कैन किए गए पृष्ठों से संपादन योग्य पाठ निकालने के लिए ओसीआर (OCR) उपकरण आवश्यक है।]`;
                krutiText = unicodeToKrutiDev(hindiText, {
                    preserveRoman: this.options.preserveRoman !== false,
                    preserveNumbers: this.options.preserveNumbers !== false,
                    preservePunctuation: this.options.preservePunctuation !== false
                });
            } else if (pageMeta.isEmpty) {
                hindiText = originalText;
                krutiText = originalText;
            } else {
                const cleanEnglish = originalText.replace(/\r\n/g, '\n');
                hindiText = await translateEnglishToHindi(cleanEnglish, {
                    customGlossary: this.options.customGlossary || {},
                    apiEndpoint: this.options.apiEndpoint,
                    apiKey: this.options.apiKey,
                    preserveRoman: this.options.preserveRoman !== false
                });

                if (this.isCancelled) return;

                // Stage 3: Encode Hindi Unicode into Kruti Dev 010 Legacy
                await this.emitProgress({
                    currentPage: pageNum,
                    stage: 'Kruti Dev 010 Encoding',
                    stageDesc: `Encoding Hindi into Kruti Dev 010 legacy characters for page ${pageNum} of ${this.totalPages}...`,
                    subStepFraction: 0.75
                });

                krutiText = unicodeToKrutiDev(hindiText, {
                    preserveRoman: this.options.preserveRoman !== false,
                    preserveNumbers: this.options.preserveNumbers !== false,
                    preservePunctuation: this.options.preservePunctuation !== false
                });
            }

            if (this.isCancelled) return;

            await StorageService.savePageResult(docId, pageNum, {
                status: 'translated',
                originalText,
                hindiText,
                isScanned: pageMeta.isScanned,
                isEmpty: pageMeta.isEmpty,
                images: pageImages,
                imagesCount: pageImages.length
            });

            // 4. Mark complete (encoded) in storage with preserved images
            await StorageService.savePageResult(docId, pageNum, {
                status: 'encoded',
                originalText,
                hindiText,
                krutiText,
                images: pageImages,
                imagesCount: pageImages.length,
                isScanned: pageMeta.isScanned,
                isEmpty: pageMeta.isEmpty,
                error: null
            });

            // Stage 4: Page Completed
            await this.emitProgress({
                currentPage: pageNum,
                stage: 'Page Completed',
                stageDesc: `Completed page ${pageNum} of ${this.totalPages}`,
                subStepFraction: 1.0
            });

        } catch (err) {
            console.error(`Error processing page ${pageNum}:`, err);
            // Save failure status without crashing the whole job
            await StorageService.savePageResult(docId, pageNum, {
                status: 'failed',
                error: err.message || 'Unknown processing error'
            });
            await this.emitProgress({
                currentPage: pageNum,
                stage: 'Error',
                stageDesc: `Error on page ${pageNum}: ${err.message}`,
                subStepFraction: 0.0
            });
        }
    }

    /**
     * Retry an individual failed page
     */
    async retryPage(pageNum) {
        if (!this.activeDocId) return;
        await StorageService.savePageResult(this.activeDocId, pageNum, {
            status: 'pending',
            error: null
        });
        await this.processSinglePage(pageNum);
    }

    /**
     * Retry all failed pages
     */
    async retryAllFailed() {
        if (!this.activeDocId) return;
        const failed = await StorageService.getFailedPagesForDoc(this.activeDocId);
        for (const p of failed) {
            await this.retryPage(p.pageNum);
        }
    }

    /**
     * Pause the current job
     */
    async pauseJob() {
        this.isPaused = true;
        await this.emitProgress({
            stage: 'Paused',
            stageDesc: 'Processing paused by user'
        });
    }

    /**
     * Resume a paused job
     */
    async resumeJob() {
        this.isPaused = false;
        if (!this.isRunning) {
            this.isRunning = true;
            this.runQueueLoop();
        }
        await this.emitProgress({
            stage: 'Resuming',
            stageDesc: 'Resuming document processing queue...'
        });
    }

    /**
     * Cancel the active job
     */
    async cancelJob() {
        this.isCancelled = true;
        this.isRunning = false;
        await this.emitProgress({
            stage: 'Cancelled',
            stageDesc: 'Processing cancelled by user'
        });
    }

    /**
     * Emit current stats to UI
     */
    async emitProgress(info = {}) {
        if (!this.onProgressCallback || !this.activeDocId) return;

        const allPages = await StorageService.getAllPagesForDoc(this.activeDocId);
        const extractedCount = allPages.filter(p => p.status === 'extracted' || p.status === 'translated' || p.status === 'encoded').length;
        const translatedCount = allPages.filter(p => p.status === 'translated' || p.status === 'encoded').length;
        const encodedCount = allPages.filter(p => p.status === 'encoded').length;
        const failedPages = allPages.filter(p => p.status === 'failed').map(p => p.pageNum);

        let currentPage = typeof info === 'number' ? info : (info.currentPage || (encodedCount < this.totalPages ? encodedCount + 1 : this.totalPages));
        let stage = typeof info === 'object' && info.stage ? info.stage : (encodedCount === this.totalPages ? 'Completed' : 'Processing');
        let stageDesc = typeof info === 'object' && info.stageDesc ? info.stageDesc : `Page ${currentPage} of ${this.totalPages}`;
        let subStepFraction = typeof info === 'object' && typeof info.subStepFraction === 'number' ? info.subStepFraction : (encodedCount === this.totalPages ? 1.0 : 0.0);

        if (this.isCancelled) {
            stage = 'Cancelled';
            stageDesc = 'Processing cancelled by user';
        }

        const isCompleted = !this.isCancelled && failedPages.length === 0 && encodedCount === this.totalPages && this.totalPages > 0;

        // Calculate real completed work across pages and in-progress page
        let completedWork = encodedCount;
        if (!isCompleted && subStepFraction > 0 && subStepFraction < 1.0) {
            completedWork += subStepFraction;
        }

        let percentage = 0;
        if (this.totalPages > 0) {
            if (isCompleted) {
                percentage = 100;
            } else {
                // Must strictly never show 100% until isCompleted is true
                percentage = Math.min(99, Math.floor((completedWork / this.totalPages) * 100));
            }
        }

        // Cancelled or failed jobs must never show 100%
        if (this.isCancelled || failedPages.length > 0) {
            percentage = Math.min(percentage, 99);
        }

        try {
            this.onProgressCallback({
                docId: this.activeDocId,
                totalPages: this.totalPages,
                currentPage,
                extractedCount,
                translatedCount,
                encodedCount,
                failedPages,
                isPaused: this.isPaused,
                isCancelled: this.isCancelled,
                isCompleted,
                stage,
                stageDesc,
                percentage,
                completedWork,
                pagesData: allPages
            });
        } catch (callbackErr) {
            console.warn('[PageQueueService] Non-fatal progress callback error:', callbackErr);
        }
    }
}
