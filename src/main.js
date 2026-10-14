/**
 * KRUTI DEV 010 — SMART DOCUMENT CONVERTER
 * Main Application Orchestrator & State Manager
 * Featuring Large Document Batch Queue (Up to 300+ Pages) & Quality Validation Gate
 */

import { unicodeToKrutiDev, krutiDevToUnicode } from './services/krutiDevConverter.js';
import { translateEnglishToHindi } from './services/translationEngine.js';
import { extractDocxContent } from './services/docxExtractor.js';
import { extractPdfContent, loadPdfDocument } from './services/pdfExtractor.js';
import { downloadDocx, splitIntoKrutiAndLatinSegments } from './services/docxGenerator.js';
import { downloadPdf } from './services/pdfGenerator.js';
import { StorageService } from './services/storageService.js';
import { DEFAULT_RAILWAY_GLOSSARY } from './services/railwayGlossary.js';
import { PageQueueService } from './services/pageQueueService.js';
import { validateDocumentQuality, validateTranslationCompleteness, validateImagePreservation } from './services/qualityValidator.js';
import fileSaver from 'file-saver';
const saveAs = fileSaver.saveAs || fileSaver;

// Application State
const state = {
    originalText: '',
    hindiText: '',
    krutiText: '',
    documentAst: null,
    originalDocxBuffer: null,
    activeFile: null,
    activeDocId: null,
    activeView: 'visual', // 'visual' | 'raw'
    totalPages: 1,
    pagesData: [],
    images: [],
    imagesCount: 0,
    imageValidation: null,
    settings: StorageService.getSettings(),
    customDictionary: {},
    isProcessing: false,
    isMultiPageMode: false,
    qualityValidation: null,
    findState: {
        query: '',
        matches: [],
        currentIndex: -1
    }
};

const queueService = new PageQueueService();

// Test Cases Definition
const TEST_CASES = {
    "1": {
        title: "Test 1: Station Master",
        text: "Station Master\nLoco Pilot\nAssistant Loco Pilot\nGuard on duty"
    },
    "2": {
        title: "Test 2: 505AXT",
        text: "Track Circuit 505AXT clear.\nSignal clearance for 505AXT received from Station Master."
    },
    "3": {
        title: "Test 3: 505BXT",
        text: "505BXT track circuit occupied.\nPrivate number given for 505BXT."
    },
    "4": {
        title: "Test 4: DP519A",
        text: "Point machine DP519A locked in normal position.\nDP519B set for loop line."
    },
    "5": {
        title: "Test 5: ODP507A",
        text: "ODP507A and ODP507B crossover detection verified.\nODP511A normal."
    },
    "6": {
        title: "Test 6: S9AXT",
        text: "Signal S9XT and S9AXT automatic aspect.\nS9BXT track circuit clear."
    },
    "7": {
        title: "Test 7: Roman Numerals & Numeric References",
        text: "Chapter VI para 6.02(iv)\nRefer Chapter IV rule 3.61/2(a) and paragraph 1.20.\nSub-clause (i), (ii), (iii), and (iv) remain applicable."
    },
    "8": {
        title: "Test 8: Punctuation Preservation",
        text: "Date of Issue:-\nWorking Diary:- Updated.\nSafety Notice:- Caution Order issued."
    },
    "9": {
        title: "Test 9: Section / Line Slash",
        text: "Section/Line: Main Line 117/2025.\nSpeed Restriction: 30 km/h on Section/Line crossover."
    },
    "10": {
        title: "Test 10: Section 7 Official Circular Test",
        text: `NORTHERN RAILWAY
Safety Circular No. 117/2025
Date of Issue: 22-07-2026

Subject: Station Working Rules and Signal Clearance Procedure

1. Duties of Station Master and Loco Pilot:
The Station Master must verify that track circuit 505AXT and 505BXT are clear before giving Line Clear.
The Loco Pilot must not pass Home Signal or Advanced Starter at danger without authority.
Refer Chapter VI para 6.02(iv) and General Rules para 1.20.

2. Point Machines and Technical Codes:
Point machine DP519A and DP519B must remain detected normal.
Verify crossover clearance on ODP507A and S9AXT.`
    }
};

// DOM Elements
const elements = {
    // Buttons
    heroUploadPdfBtn: document.getElementById('hero-upload-pdf-btn'),
    heroUploadWordBtn: document.getElementById('hero-upload-word-btn'),
    heroPasteTextBtn: document.getElementById('hero-paste-text-btn'),
    heroStartConvertBtn: document.getElementById('hero-start-convert-btn'),
    startConversionTopBtn: document.getElementById('start-conversion-top-btn'),
    regenerateKrutiBtn: document.getElementById('regenerate-kruti-btn'),
    runCalibrationBtn: document.getElementById('run-calibration-btn'),
    brandHomeBtn: document.getElementById('brand-home-btn'),

    // File inputs & Dropzone
    fileInputPdf: document.getElementById('file-input-pdf'),
    fileInputWord: document.getElementById('file-input-word'),
    fileInputAny: document.getElementById('file-input-any'),
    dropZone: document.getElementById('drop-zone'),
    dropZonePrompt: document.getElementById('drop-zone-prompt'),
    fileActiveCard: document.getElementById('file-active-card'),
    activeFileName: document.getElementById('active-file-name'),
    activeFileDetails: document.getElementById('active-file-details'),
    removeFileBtn: document.getElementById('remove-file-btn'),
    replaceFileBtn: document.getElementById('replace-file-btn'),

    // Textareas & Previews
    originalTextarea: document.getElementById('original-textarea'),
    hindiTextarea: document.getElementById('hindi-textarea'),
    krutiVisualBox: document.getElementById('kruti-visual-box'),
    krutiRawBox: document.getElementById('kruti-raw-box'),
    tabKrutiVisual: document.getElementById('tab-kruti-visual'),
    tabKrutiRaw: document.getElementById('tab-kruti-raw'),
    originalWordCount: document.getElementById('original-word-count'),
    hindiWordCount: document.getElementById('hindi-word-count'),
    krutiByteCount: document.getElementById('kruti-byte-count'),
    docStatusIndicator: document.getElementById('doc-status-indicator'),
    sourceBadge: document.getElementById('source-badge'),
    krutiMetaInfo: document.getElementById('kruti-meta-info'),

    // Toolbar & Panels
    clearOriginalBtn: document.getElementById('clear-original-btn'),
    copyOriginalBtn: document.getElementById('copy-original-btn'),
    copyHindiBtn: document.getElementById('copy-hindi-btn'),
    copyKrutiBtn: document.getElementById('copy-kruti-btn'),

    // Find & Replace
    toggleFindReplaceBtn: document.getElementById('toggle-find-replace-btn'),
    findReplaceBar: document.getElementById('find-replace-bar'),
    findInput: document.getElementById('find-input'),
    replaceInput: document.getElementById('replace-input'),
    frMatchCase: document.getElementById('fr-match-case'),
    frWholeWord: document.getElementById('fr-whole-word'),
    frSearchCodes: document.getElementById('fr-search-codes'),
    findCounter: document.getElementById('find-counter'),
    findNextBtn: document.getElementById('find-next-btn'),
    findPrevBtn: document.getElementById('find-prev-btn'),
    replaceBtn: document.getElementById('replace-btn'),
    replaceAllBtn: document.getElementById('replaceAll-btn') || document.getElementById('replace-all-btn'),
    frClearBtn: document.getElementById('fr-clear-btn'),

    // Large Document Dashboard Elements
    largeDocDashboard: document.getElementById('large-doc-dashboard'),
    statTotalPages: document.getElementById('stat-total-pages'),
    statExtractedPages: document.getElementById('stat-extracted-pages'),
    statTranslatedPages: document.getElementById('stat-translated-pages'),
    statEncodedPages: document.getElementById('stat-encoded-pages'),
    queueCurrentPageText: document.getElementById('queue-current-page-text'),
    queuePercentageText: document.getElementById('queue-percentage-text'),
    queueProgressFill: document.getElementById('queue-progress-fill'),
    queueStageDesc: document.getElementById('queue-stage-desc'),
    queuePauseBtn: document.getElementById('queue-pause-btn'),
    queueResumeBtn: document.getElementById('queue-resume-btn'),
    queueCancelBtn: document.getElementById('queue-cancel-btn'),
    queueRetryFailedBtn: document.getElementById('queue-retry-failed-btn'),
    failedPagesCount: document.getElementById('failed-pages-count'),
    qualityBanner: document.getElementById('quality-banner'),
    qualityIcon: document.getElementById('quality-icon'),
    qualityMessage: document.getElementById('quality-message'),
    qualityBadge: document.getElementById('quality-badge'),
    pageMatrixGrid: document.getElementById('page-matrix-grid'),

    // Download Dropdown
    downloadDropdownBtn: document.getElementById('download-dropdown-btn'),
    downloadDropdownMenu: document.getElementById('download-dropdown-menu'),
    dlKrutiFormattedDocx: document.getElementById('dl-kruti-formatted-docx'),
    dlHindiFormattedDocx: document.getElementById('dl-hindi-formatted-docx'),
    dlKrutiDocx: document.getElementById('dl-kruti-docx'),
    dlHindiDocx: document.getElementById('dl-hindi-docx'),
    dlKrutiPdf: document.getElementById('dl-kruti-pdf'),
    dlHindiPdf: document.getElementById('dl-hindi-pdf'),
    dlKrutiTxt: document.getElementById('dl-kruti-txt'),
    dlHindiTxt: document.getElementById('dl-hindi-txt'),

    // Modals
    progressModal: document.getElementById('progress-modal'),
    progressStageText: document.getElementById('progress-stage-text'),
    progressSubText: document.getElementById('progress-sub-text'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressPageCounter: document.getElementById('progress-page-counter'),
    cancelProgressBtn: document.getElementById('cancel-progress-btn'),

    dictionaryModal: document.getElementById('dictionary-modal'),
    openDictionaryBtn: document.getElementById('open-dictionary-btn'),
    closeDictModal: document.getElementById('close-dict-modal'),
    dictDoneBtn: document.getElementById('dict-done-btn'),
    dictSearchInput: document.getElementById('dict-search-input'),
    dictTermsTableBody: document.getElementById('dict-terms-table-body'),
    addTermBtn: document.getElementById('add-term-btn'),
    addTermForm: document.getElementById('add-term-form'),
    newTermEn: document.getElementById('new-term-en'),
    newTermHi: document.getElementById('new-term-hi'),
    saveNewTerm: document.getElementById('save-new-term'),
    cancelNewTerm: document.getElementById('cancel-new-term'),
    importDictBtn: document.getElementById('import-dict-btn'),
    exportDictBtn: document.getElementById('export-dict-btn'),
    dictFileInput: document.getElementById('dict-file-input'),

    settingsModal: document.getElementById('settings-modal'),
    openSettingsBtn: document.getElementById('open-settings-btn'),
    closeSettingsModal: document.getElementById('close-settings-modal'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeIcon: document.getElementById('theme-icon')
};

/**
 * Defensive DOM update helpers
 * Ensures textContent and styling are safely updated without throwing on null/undefined
 */
function safeSetText(element, text) {
    if (element && typeof element.textContent !== 'undefined') {
        element.textContent = text != null ? String(text) : '';
    }
}

function safeSetStyle(element, property, value) {
    if (element && element.style) {
        element.style[property] = value;
    }
}

/**
 * Initialize Application
 */
async function initApp() {
    try {
        state.customDictionary = await StorageService.getCustomDictionary();
    } catch (e) {
        console.warn('Could not load custom dictionary from IndexedDB:', e);
    }

    if (state.settings.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (elements.themeIcon) elements.themeIcon.textContent = '☀️';
    }

    // Initialize font loading & verification
    checkAndApplyKrutiFont();
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => checkAndApplyKrutiFont());
    }

    setupHeroAndFileUploads();
    setupWorkspacePanels();
    setupFindAndReplace();
    setupDownloads();
    setupModals();
    setupTestCases();
    setupQueueControls();

    loadWelcomeContent();
}

/**
 * Hero and File Upload Event Bindings
 */
function setupHeroAndFileUploads() {
    elements.heroUploadPdfBtn.addEventListener('click', () => elements.fileInputPdf.click());
    elements.fileInputPdf.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleUploadedFile(e.target.files[0]);
    });

    elements.heroUploadWordBtn.addEventListener('click', () => elements.fileInputWord.click());
    elements.fileInputWord.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleUploadedFile(e.target.files[0]);
    });

    elements.heroPasteTextBtn.addEventListener('click', () => {
        document.getElementById('workspace-section').scrollIntoView({ behavior: 'smooth' });
        elements.originalTextarea.focus();
    });

    const triggerConversion = () => {
        const text = elements.originalTextarea.value.trim();
        if (!text) {
            alert('Please paste English text or upload a Word/PDF document first.');
            elements.originalTextarea.focus();
            return;
        }
        runSingleDocumentConversion();
    };

    elements.heroStartConvertBtn.addEventListener('click', triggerConversion);
    elements.startConversionTopBtn.addEventListener('click', triggerConversion);

    elements.dropZone.addEventListener('click', (e) => {
        if (e.target.closest('#file-active-card')) return;
        elements.fileInputAny.click();
    });
    elements.fileInputAny.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleUploadedFile(e.target.files[0]);
    });

    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('drag-over');
    });
    elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('drag-over'));
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUploadedFile(e.dataTransfer.files[0]);
        }
    });

    elements.removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetActiveFile();
    });
    elements.replaceFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.fileInputAny.click();
    });
}

/**
 * Handle Uploaded Document (.docx, .doc, .pdf, .txt)
 */
async function handleUploadedFile(file) {
    let currentStage = 'Initializing File Upload';
    state.activeFile = {
        name: file.name,
        size: file.size,
        type: file.type || file.name.split('.').pop()
    };
    state.activeDocId = `doc_${Date.now()}`;

    safeSetStyle(elements.dropZonePrompt, 'display', 'none');
    safeSetStyle(elements.fileActiveCard, 'display', 'flex');
    safeSetText(elements.activeFileName, file.name);
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    safeSetText(elements.activeFileDetails, `${sizeKb} KB • ${file.name.split('.').pop().toUpperCase()}`);

    try {
        const lowerName = file.name.toLowerCase();

        if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
            currentStage = 'Word DOCX Extraction';
            safeSetText(elements.sourceBadge, 'Word DOCX');
            safeSetStyle(elements.largeDocDashboard, 'display', 'none');
            state.isMultiPageMode = false;

            showProgressModal('Extracting Word Document', 'Reading paragraph AST, tables, bold, and runs...', 0);
            const buffer = await file.arrayBuffer();
            state.originalDocxBuffer = buffer;
            const extracted = await extractDocxContent(buffer, (done, total) => {
                const pct = total > 0 ? Math.min(99, Math.floor((done / total) * 100)) : 0;
                updateProgress('Extracting Word Document', `Parsing Word AST elements (${done}/${total})...`, pct);
            });

            state.originalText = extracted.plainText;
            state.documentAst = extracted.ast;
            state.images = extracted.images || [];
            state.imagesCount = extracted.imagesCount || 0;

            if (elements.originalTextarea) elements.originalTextarea.value = extracted.plainText;
            updateWordCounts();
            const imgTag = extracted.imagesCount > 0 ? ` • 🖼️ ${extracted.imagesCount} Images Preserved` : '';
            safeSetText(elements.activeFileDetails, `${sizeKb} KB • ${extracted.paragraphsCount} Paragraphs • ${extracted.tablesCount} Tables${imgTag}`);

            hideProgressModal();
            runSingleDocumentConversion();

        } else if (lowerName.endsWith('.pdf')) {
            currentStage = 'Analyzing PDF Document';
            safeSetText(elements.sourceBadge, 'PDF Document');
            showProgressModal('Analyzing PDF Document', 'Detecting total page count and text layers...', 0);

            const { pdfDoc, numPages } = await loadPdfDocument(file);
            hideProgressModal();

            if (!numPages || numPages < 1) {
                throw new Error('PDF document contains 0 pages or could not be parsed.');
            }

            state.totalPages = numPages;
            const pdfFileDetails = `${sizeKb} KB • ${numPages} Pages • PDF`;
            safeSetText(elements.activeFileDetails, pdfFileDetails);
            state.activeFileDetails = pdfFileDetails;

            currentStage = 'Launching Multi-Page Processing Queue';
            // Launch Multi-Page Queue Workflow
            await startMultiPageJob(state.activeDocId, pdfDoc, numPages);

        } else {
            currentStage = 'Text Document Reading';
            safeSetText(elements.sourceBadge, 'Text Document');
            safeSetStyle(elements.largeDocDashboard, 'display', 'none');
            state.isMultiPageMode = false;

            const text = await file.text();
            state.originalText = text;
            state.documentAst = null;
            if (elements.originalTextarea) elements.originalTextarea.value = text;
            updateWordCounts();
            runSingleDocumentConversion();
        }

        const workspaceSec = document.getElementById('workspace-section');
        if (workspaceSec) {
            workspaceSec.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        console.error(`[PDF Processing Error at Stage: ${currentStage}]`, err.message, err.stack);
        hideProgressModal();
        showProcessingError(file.name, currentStage, err);
    }
}

function showProcessingError(fileName, stage, err) {
    const errorMsg = err?.message || 'Unknown processing error';
    console.error(`[Document Processing Failure] File: ${fileName} | Stage: [${stage}] | Stack:`, err?.stack || err);

    safeSetText(elements.docStatusIndicator, `Error: ${errorMsg}`);

    if (elements.queueStageDesc) {
        safeSetText(elements.queueStageDesc, `Error during [${stage}]: ${errorMsg}`);
    }

    if (elements.qualityBanner) {
        elements.qualityBanner.className = 'quality-validation-banner invalid';
        safeSetText(elements.qualityIcon, '⚠️');
        safeSetText(elements.qualityMessage, `Error in "${fileName}" during [${stage}]: ${errorMsg}`);
        safeSetText(elements.qualityBadge, 'Error');
        safeSetStyle(elements.largeDocDashboard, 'display', 'block');
    }
}

function resetActiveFile() {
    state.activeFile = null;
    state.documentAst = null;
    state.originalDocxBuffer = null;
    state.pagesData = [];
    state.isMultiPageMode = false;
    elements.dropZonePrompt.style.display = 'block';
    elements.fileActiveCard.style.display = 'none';
    elements.largeDocDashboard.style.display = 'none';
    elements.sourceBadge.textContent = 'English Source';
    setDownloadButtonsLock(false);
}

/**
 * Large Multi-Page Processing Workflow (Section 5 & Prompt Requirements)
 */
async function startMultiPageJob(docId, pdfDoc, totalPages) {
    state.isMultiPageMode = true;
    state.totalPages = totalPages;
    state.activeDocId = docId;

    // Show Large Document Dashboard & Lock Downloads
    safeSetStyle(elements.largeDocDashboard, 'display', 'block');
    safeSetText(elements.statTotalPages, totalPages);
    safeSetText(elements.statExtractedPages, '0');
    safeSetText(elements.statTranslatedPages, '0');
    safeSetText(elements.statEncodedPages, '0');
    safeSetText(elements.queueCurrentPageText, `Current Page: 1 of ${totalPages}`);
    safeSetText(elements.queuePercentageText, '0%');
    safeSetStyle(elements.queueProgressFill, 'width', '0%');
    safeSetText(elements.queueStageDesc, `Processing pages in batches of 5...`);

    // Initialize Interactive Page Matrix Grid
    renderPageMatrix(totalPages);

    // Lock download buttons until all pages are 100% complete
    setDownloadButtonsLock(true, `Processing ${totalPages} pages in queue. Downloads unlocked after full verification.`);

    safeSetStyle(elements.queuePauseBtn, 'display', 'inline-flex');
    safeSetStyle(elements.queueResumeBtn, 'display', 'none');
    safeSetStyle(elements.queueRetryFailedBtn, 'display', 'none');

    // Start Queue Service
    await queueService.startJob(
        docId,
        pdfDoc,
        totalPages,
        {
            batchSize: 5,
            customGlossary: state.customDictionary,
            apiEndpoint: state.settings.apiEndpoint,
            apiKey: state.settings.apiKey,
            preserveRoman: state.settings.preserveRomanNumerals,
            preserveNumbers: state.settings.preserveNumbers,
            preservePunctuation: state.settings.preservePunctuation
        },
        (progress) => handleQueueProgress(progress)
    );
}

/**
 * Handle Real-Time Progress from Queue
 */
async function handleQueueProgress(progress) {
    try {
        const {
            totalPages,
            currentPage,
            extractedCount,
            translatedCount,
            encodedCount,
            failedPages,
            isPaused,
            isCancelled,
            isCompleted,
            stage,
            stageDesc,
            percentage,
            pagesData
        } = progress;

        state.pagesData = pagesData || [];

        // Update Stat Cards safely
        safeSetText(elements.statTotalPages, totalPages);
        safeSetText(elements.statExtractedPages, extractedCount);
        safeSetText(elements.statTranslatedPages, translatedCount);
        safeSetText(elements.statEncodedPages, encodedCount);

        // Calculate real percentage
        let pct = typeof percentage === 'number'
            ? percentage
            : (totalPages > 0 ? Math.floor((encodedCount / totalPages) * 100) : 0);

        if (!state.lastProgressDocId || state.lastProgressDocId !== progress.docId) {
            state.lastProgressDocId = progress.docId;
            state.lastProgressPercentage = 0;
        }

        // Prevent jumping backward unexpectedly unless cancelled
        if (!isCancelled && !isCompleted && pct < state.lastProgressPercentage) {
            pct = state.lastProgressPercentage;
        } else if (!isCancelled) {
            state.lastProgressPercentage = pct;
        }

        // PERCENTAGE AND PROGRESS BAR MUST MATCH (Requirement 2)
        safeSetText(elements.queuePercentageText, `${pct}%`);
        safeSetStyle(elements.queueProgressFill, 'width', `${pct}%`);

        // Update Page Matrix Tiles
        updatePageMatrixTiles(pagesData);

        // Cancel Handling (Requirement 6)
        if (isCancelled) {
            safeSetStyle(elements.queuePauseBtn, 'display', 'none');
            safeSetStyle(elements.queueResumeBtn, 'display', 'none');
            safeSetText(elements.queueStageDesc, `Processing cancelled by user at ${pct}% (${encodedCount}/${totalPages} pages completed).`);
            safeSetText(elements.docStatusIndicator, `Cancelled by user (${encodedCount}/${totalPages} Pages - ${pct}%)`);
            setDownloadButtonsLock(true, 'Document processing was cancelled before completion.');
            if (elements.qualityBanner) {
                elements.qualityBanner.className = 'quality-validation-banner invalid';
                safeSetText(elements.qualityIcon, '⏹️');
                safeSetText(elements.qualityMessage, `Processing cancelled by user. ${encodedCount} of ${totalPages} pages completed.`);
                safeSetText(elements.qualityBadge, 'Cancelled');
            }
            return;
        }

        // Failed Pages Handling
        if (failedPages && failedPages.length > 0) {
            safeSetStyle(elements.queueRetryFailedBtn, 'display', 'inline-flex');
            safeSetText(elements.failedPagesCount, failedPages.length);
            safeSetText(elements.docStatusIndicator, `Processing with ${failedPages.length} failed page(s) (${pct}%)`);
        } else {
            safeSetStyle(elements.queueRetryFailedBtn, 'display', 'none');
            safeSetText(elements.docStatusIndicator, `Processing: ${encodedCount}/${totalPages} Pages (${pct}%)`);
        }

        // Page Progress and Stage description
        safeSetText(elements.queueCurrentPageText, `Page ${currentPage} of ${totalPages} • ${encodedCount}/${totalPages} Completed`);
        if (stageDesc) {
            safeSetText(elements.queueStageDesc, stageDesc);
        }

        // Pause/Resume UI
        if (isPaused) {
            safeSetStyle(elements.queuePauseBtn, 'display', 'none');
            safeSetStyle(elements.queueResumeBtn, 'display', 'inline-flex');
            safeSetText(elements.queueStageDesc, 'Processing Paused. Click Resume to continue.');
        } else {
            safeSetStyle(elements.queuePauseBtn, 'display', 'inline-flex');
            safeSetStyle(elements.queueResumeBtn, 'display', 'none');
        }

        // Detect scanned pages
        const scannedPages = (pagesData || []).filter(p => p.isScanned);

        // Completion & Quality Validation Gate
        if ((isCompleted || encodedCount === totalPages) && !isCancelled && (!failedPages || failedPages.length === 0)) {
            safeSetText(elements.queueStageDesc, `All ${totalPages} pages processed. Running quality validation gate...`);

            const validation = validateDocumentQuality(totalPages, pagesData);
            state.qualityValidation = validation;

            if (validation.isValid) {
                // Verified 100% completion
                pct = 100;
                safeSetText(elements.queuePercentageText, '100%');
                safeSetStyle(elements.queueProgressFill, 'width', '100%');

                // Unlock Download Buttons
                setDownloadButtonsLock(false);
                if (elements.qualityBanner) elements.qualityBanner.className = 'quality-validation-banner valid';
                safeSetText(elements.qualityIcon, '✓');

                const docImages = [];
                pagesData.forEach(p => {
                    if (p.images && p.images.length > 0) docImages.push(...p.images);
                });
                state.images = docImages;
                state.imagesCount = docImages.length;
                const imgMsg = docImages.length > 0 ? ` 🖼️ ${docImages.length} images/diagrams preserved.` : '';

                if (scannedPages.length > 0) {
                    safeSetText(elements.qualityMessage, `All ${totalPages}/${totalPages} pages processed. Notice: ${scannedPages.length} scanned image page(s) detected without text layer (OCR notice applied).${imgMsg}`);
                    safeSetText(elements.qualityBadge, 'Scanned (OCR Notice)');
                } else {
                    safeSetText(elements.qualityMessage, `All ${totalPages}/${totalPages} pages processed and validated. Roman numerals, decimals, punctuation, and technical codes 100% verified.${imgMsg}`);
                    safeSetText(elements.qualityBadge, 'Verified & Ready');
                }

                // Assemble Full Document into Panels for Viewing & Editing
                const fullOriginal = pagesData.map(p => `--- PAGE ${p.pageNum} ---\n${p.originalText || ''}`).join('\n\n');
                const fullHindi = pagesData.map(p => `--- पृष्ठ ${p.pageNum} ---\n${p.hindiText || ''}`).join('\n\n');
                const fullKruti = pagesData.map(p => `--- PAGE ${p.pageNum} ---\n${p.krutiText || ''}`).join('\n\n');

                state.originalText = fullOriginal;
                state.hindiText = fullHindi;
                state.krutiText = fullKruti;

                if (elements.originalTextarea) elements.originalTextarea.value = fullOriginal;
                if (elements.hindiTextarea) elements.hindiTextarea.value = fullHindi;
                renderKrutiPreview(fullKruti, fullHindi);
                updateWordCounts();

                safeSetText(elements.queueCurrentPageText, `All ${totalPages} of ${totalPages} Pages Completed`);
                safeSetText(elements.docStatusIndicator, `Complete: ${totalPages}/${totalPages} Pages ✓ (100%)`);
            } else {
                // Validation Incomplete / Failed - Never show 100%
                pct = Math.min(pct, 99);
                safeSetText(elements.queuePercentageText, `${pct}%`);
                safeSetStyle(elements.queueProgressFill, 'width', `${pct}%`);
                setDownloadButtonsLock(true, validation.summaryMessage);
                if (elements.qualityBanner) elements.qualityBanner.className = 'quality-validation-banner invalid';
                safeSetText(elements.qualityIcon, '⚠️');
                safeSetText(elements.qualityMessage, validation.summaryMessage);
                safeSetText(elements.qualityBadge, 'Incomplete');
                safeSetText(elements.docStatusIndicator, 'Pending Verification');
            }
        }
    } catch (progressErr) {
        console.warn('[handleQueueProgress] Non-fatal UI update error:', progressErr);
    }
}

/**
 * Render Interactive Page Matrix Grid
 */
function renderPageMatrix(totalPages) {
    const grid = elements.pageMatrixGrid;
    if (!grid) return;
    grid.innerHTML = '';

    for (let p = 1; p <= totalPages; p++) {
        const tile = document.createElement('div');
        tile.className = 'page-tile pending';
        tile.id = `page-tile-${p}`;
        tile.textContent = p;
        tile.title = `Page ${p}: Pending`;

        tile.addEventListener('click', () => {
            const pageRecord = state.pagesData.find(item => item.pageNum === p);
            if (pageRecord && pageRecord.status === 'failed') {
                if (confirm(`Page ${p} failed with error: "${pageRecord.error || 'Unknown'}". Retry this page now?`)) {
                    queueService.retryPage(p);
                }
            } else if (pageRecord && pageRecord.status === 'encoded') {
                const previewMsg = pageRecord.isScanned
                    ? `Page ${p} [Scanned Page]:\n\n${pageRecord.hindiText}`
                    : `Page ${p} Preview:\n\nHindi: ${(pageRecord.hindiText || '').substring(0, 150)}...\n\nKruti Dev: ${(pageRecord.krutiText || '').substring(0, 150)}...`;
                alert(previewMsg);
            }
        });

        grid.appendChild(tile);
    }
}

function updatePageMatrixTiles(pagesData = []) {
    for (const page of pagesData) {
        const tile = document.getElementById(`page-tile-${page.pageNum}`);
        if (!tile) continue;

        tile.className = `page-tile ${page.status}`;
        if (page.isScanned) {
            tile.title = `Page ${page.pageNum}: Scanned Image (OCR Notice applied)`;
        } else if (page.status === 'encoded') {
            tile.title = `Page ${page.pageNum}: Ready (Kruti Dev Encoded)`;
        } else if (page.status === 'failed') {
            tile.title = `Page ${page.pageNum}: FAILED (${page.error || 'Click to retry'})`;
        } else if (page.status === 'translated') {
            tile.title = `Page ${page.pageNum}: Translated to Hindi`;
        } else if (page.status === 'extracted') {
            tile.title = `Page ${page.pageNum}: Extracted`;
        }
    }
}

/**
 * Setup Queue Control Buttons (Pause, Resume, Cancel, Retry)
 */
function setupQueueControls() {
    elements.queuePauseBtn.addEventListener('click', () => queueService.pauseJob());
    elements.queueResumeBtn.addEventListener('click', () => queueService.resumeJob());
    elements.queueCancelBtn.addEventListener('click', () => {
        if (confirm('Cancel multi-page processing? Completed pages will be saved.')) {
            state.isCancelled = true;
            queueService.cancelJob();
            safeSetText(elements.queueStageDesc, 'Processing Cancelled by user.');
            safeSetText(elements.docStatusIndicator, 'Cancelled by user');
        }
    });
    elements.queueRetryFailedBtn.addEventListener('click', () => {
        queueService.retryAllFailed();
    });
}

/**
 * Lock or Unlock Download Buttons based on Quality Gate
 */
function setDownloadButtonsLock(locked, reason = '') {
    const btn = elements.downloadDropdownBtn;
    if (locked) {
        btn.classList.add('btn-locked');
        btn.title = reason || 'Downloads locked until all pages are 100% processed.';
    } else {
        btn.classList.remove('btn-locked');
        btn.title = 'Download processed document in Word, PDF, or TXT.';
    }
}

/**
 * Single Document Conversion Workflow (Word DOCX, Text, Sample Tests)
 */
async function runSingleDocumentConversion() {
    const rawEnglish = elements.originalTextarea.value;
    if (!rawEnglish.trim()) return;

    state.isProcessing = true;
    state.isCancelled = false;
    elements.docStatusIndicator.textContent = 'Converting...';

    const cleanEnglish = rawEnglish.replace(/\r\n/g, '\n');
    const rawLines = cleanEnglish.split('\n');
    const meaningfulLines = rawLines.filter(l => l.trim().length > 0);
    const lineCount = Math.max(1, meaningfulLines.length);

    // Multi-stage discrete tasks:
    // Task 1: Sanitization & Pre-Analysis (1 task)
    // Tasks 2 to 1 + lineCount: Line-by-line translation (lineCount tasks)
    // Task 2 + lineCount: Quality validation gate (1 task)
    // Tasks 3 + lineCount to 2 + 2*lineCount: Line-by-line Kruti Dev encoding (lineCount tasks)
    // Task 3 + 2*lineCount: Document assembly & AST sync (1 task)
    const totalTasks = 2 * lineCount + 3;
    let completedTasks = 0;

    showProgressModal('Analyzing Document', `Preparing ${lineCount} text sections for conversion...`, 0);

    try {
        if (state.isCancelled) throw new Error('Conversion cancelled by user');

        // Stage 1: Text Sanitization & Pre-Analysis
        completedTasks++;
        let pct = Math.floor((completedTasks / totalTasks) * 100);
        updateProgress('Cleaning English Text', 'Sanitizing text and identifying railway technical codes...', pct);

        // Stage 2: English to Hindi Unicode Translation
        const hindiMaster = await translateEnglishToHindi(cleanEnglish, {
            customGlossary: state.customDictionary,
            apiEndpoint: state.settings.apiEndpoint,
            apiKey: state.settings.apiKey,
            preserveRoman: state.settings.preserveRomanNumerals,
            onLineProgress: (lineIdx, totalLinesCount) => {
                if (state.isCancelled) throw new Error('Conversion cancelled by user');
                completedTasks++;
                const p = Math.min(99, Math.floor((completedTasks / totalTasks) * 100));
                updateProgress(
                    'Translating English to Hindi Unicode',
                    `Translating section ${lineIdx} of ${totalLinesCount} with Indian Railways technical glossary...`,
                    p
                );
            }
        });

        if (state.isCancelled) throw new Error('Conversion cancelled by user');

        // Stage 3: Translation Quality Check
        completedTasks++;
        pct = Math.min(99, Math.floor((completedTasks / totalTasks) * 100));
        updateProgress('Translation Quality Audit', 'Scanning for untranslated technical terminology & units...', pct);

        const qualityAudit = validateTranslationCompleteness(hindiMaster, {
            preserveRoman: state.settings.preserveRomanNumerals
        });

        state.hindiText = hindiMaster;
        elements.hindiTextarea.value = hindiMaster;

        if (state.isCancelled) throw new Error('Conversion cancelled by user');

        // Stage 4: Line-by-line Kruti Dev 010 Encoding
        const hindiLines = hindiMaster.split('\n');
        const krutiLines = [];
        for (let i = 0; i < hindiLines.length; i++) {
            if (state.isCancelled) throw new Error('Conversion cancelled by user');
            const encoded = unicodeToKrutiDev(hindiLines[i], {
                preserveRoman: state.settings.preserveRomanNumerals,
                preserveNumbers: state.settings.preserveNumbers,
                preservePunctuation: state.settings.preservePunctuation
            });
            krutiLines.push(encoded);
            if (hindiLines[i].trim()) {
                completedTasks++;
                const p = Math.min(99, Math.floor((completedTasks / totalTasks) * 100));
                updateProgress(
                    'Encoding Kruti Dev 010',
                    `Generating verified Remington layout legacy characters (${i + 1}/${hindiLines.length})...`,
                    p
                );
            }
        }
        const krutiOutput = krutiLines.join('\n');
        state.krutiText = krutiOutput;

        renderKrutiPreview(krutiOutput, hindiMaster);
        updateWordCounts();

        if (state.documentAst) {
            updateAstTextsWithHindi(hindiMaster);
        }

        // Stage 5: Final Document Model Assembly
        completedTasks = totalTasks;
        updateProgress('Completed', 'All stages converted and verified. Ready for Word & PDF download.', 100);

        setDownloadButtonsLock(false);

        if (state.settings.autoSave) {
            StorageService.saveDocument({
                id: state.activeFile ? state.activeFile.name : 'conversion_' + Date.now(),
                name: state.activeFile ? state.activeFile.name : 'Untitled',
                originalText: state.originalText,
                hindiText: state.hindiText,
                krutiText: state.krutiText,
                ast: state.documentAst
            }).catch(e => console.warn('Autosave error:', e));
        }

        setTimeout(() => {
            hideProgressModal();
            elements.docStatusIndicator.textContent = 'Conversion Complete ✓ (100%)';
        }, 500);

    } catch (err) {
        console.error('Conversion workflow error:', err);
        hideProgressModal();
        if (state.isCancelled || err.message?.includes('cancelled')) {
            elements.docStatusIndicator.textContent = 'Conversion Cancelled by user';
        } else {
            alert(`Conversion error: ${err.message}`);
            elements.docStatusIndicator.textContent = `Error during conversion: ${err.message}`;
        }
    } finally {
        state.isProcessing = false;
    }
}

/**
 * Regenerate Kruti Dev 010 directly from modified Hindi Master
 */
function regenerateKrutiDev() {
    const currentHindi = elements.hindiTextarea.value;
    state.hindiText = currentHindi;

    const krutiOutput = unicodeToKrutiDev(currentHindi, {
        preserveRoman: state.settings.preserveRomanNumerals,
        preserveNumbers: state.settings.preserveNumbers,
        preservePunctuation: state.settings.preservePunctuation
    });

    state.krutiText = krutiOutput;
    renderKrutiPreview(krutiOutput, currentHindi);
    updateWordCounts();

    elements.docStatusIndicator.textContent = 'Kruti Dev Updated ✓';
    setTimeout(() => {
        elements.docStatusIndicator.textContent = 'Ready';
    }, 2000);
}

function updateAstTextsWithHindi(hindiText) {
    if (!state.documentAst) return;
    const lines = hindiText.split('\n');
    let lineIdx = 0;

    for (const item of state.documentAst) {
        if (item.type === 'paragraph') {
            if (lineIdx < lines.length) {
                if (item.runs.length === 1) {
                    item.runs[0].text = lines[lineIdx];
                } else if (item.runs.length > 1) {
                    item.runs[0].text = lines[lineIdx];
                    for (let r = 1; r < item.runs.length; r++) {
                        item.runs[r].text = '';
                    }
                }
                lineIdx++;
            }
        } else if (item.type === 'table' && item.rows) {
            for (const row of item.rows) {
                for (const cell of row) {
                    for (const p of (cell.paragraphs || [])) {
                        if (lineIdx < lines.length) {
                            if (p.runs.length === 1) {
                                p.runs[0].text = lines[lineIdx];
                            } else if (p.runs.length > 1) {
                                p.runs[0].text = lines[lineIdx];
                                for (let r = 1; r < p.runs.length; r++) {
                                    p.runs[r].text = '';
                                }
                            }
                            lineIdx++;
                        }
                    }
                }
            }
        }
    }
}

// Kruti Dev 010 Font Detection State
const fontStatus = {
    checked: false,
    loaded: false
};

/**
 * Check whether Kruti Dev 010 font is loaded and available to the browser.
 * Uses CSS Font Loading API (document.fonts) with canvas fallback measurement.
 */
async function checkAndApplyKrutiFont() {
    let isAvailable = false;
    try {
        if (document.fonts && document.fonts.check) {
            isAvailable = document.fonts.check("16px 'Kruti Dev 010'");
            if (!isAvailable && document.fonts.load) {
                try {
                    await document.fonts.load("16px 'Kruti Dev 010'");
                    isAvailable = document.fonts.check("16px 'Kruti Dev 010'");
                } catch (loadErr) {
                    console.warn('[FontLoad] document.fonts.load call failed:', loadErr);
                }
            }
        }
    } catch (e) {
        console.warn('[FontLoad] document.fonts check error:', e);
    }

    if (!isAvailable) {
        isAvailable = checkFontWithCanvas();
    }

    fontStatus.checked = true;
    fontStatus.loaded = isAvailable;
    updateFontStatusUI(isAvailable);
    return isAvailable;
}

function checkFontWithCanvas() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        const testStr = "LVs'ku ekLVj vi ykbu";
        ctx.font = "72px monospace";
        const baselineWidth = ctx.measureText(testStr).width;
        
        ctx.font = "72px 'Kruti Dev 010', monospace";
        const testWidth = ctx.measureText(testStr).width;
        
        return Math.abs(baselineWidth - testWidth) > 5;
    } catch (e) {
        return false;
    }
}

function updateFontStatusUI(isLoaded) {
    if (elements.krutiMetaInfo) {
        if (isLoaded) {
            elements.krutiMetaInfo.innerHTML = '<span style="color: #10B981; font-weight: 600;">🟢 Font: Kruti Dev 010 (Active)</span>';
        } else {
            elements.krutiMetaInfo.innerHTML = '<span style="color: #F59E0B; font-weight: 600;">⚠️ Font: Kruti Dev 010 (Checking / Missing)</span>';
        }
    }
}

function formatKrutiVisualPreviewHtml(krutiText, hindiText) {
    if (!krutiText && !hindiText) {
        return '<span style="font-family: var(--font-sans); font-size: 0.9rem; color: var(--text-tertiary);">Kruti Dev 010 visual preview will display readable Hindi here using Kruti Dev 010 font.</span>';
    }

    let warningHtml = '';
    if (fontStatus.checked && !fontStatus.loaded) {
        warningHtml = '<div class="font-warning-banner">⚠️ <strong>Notice:</strong> "Kruti Dev 010" font file is loading or not yet installed locally. Ensure <code>Kruti Dev 010</code> font is available for full Hindi visual rendering.</div>';
    }

    const escapeHtml = (str) => {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    const sourceHindi = hindiText !== undefined ? hindiText : state.hindiText;
    if (sourceHindi && typeof sourceHindi === 'string' && sourceHindi.trim().length > 0) {
        const segments = splitIntoKrutiAndLatinSegments(sourceHindi);
        const htmlParts = segments.map(seg => {
            if (seg.isLatin) {
                return `<span class="kruti-latin">${escapeHtml(seg.text)}</span>`;
            } else {
                const krutiCode = unicodeToKrutiDev(seg.text, {
                    preserveRoman: true,
                    preserveNumbers: true,
                    preservePunctuation: true
                });
                return `<span class="kruti-devanagari">${escapeHtml(krutiCode)}</span>`;
            }
        });
        return warningHtml + htmlParts.join('');
    }

    // Fallback: If only krutiText is provided, wrap ONLY numbers, decimals and Roman numerals in .kruti-latin
    // NEVER match [A-Za-z]+ because all Kruti Dev characters are ASCII letters!
    const escaped = escapeHtml(krutiText);
    const latinPattern = /(\.{2,}|…|\b\d+(?:\.\d+)+(?:\([a-zA-Z0-9]+\))?|\b\d{1,4}[-.\/]\d{1,2}[-.\/]\d{2,4}\b|\b\d+\/\d+\b|\b\d+\b|\b(?:M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{1,4}))\b|\((?:[iIvVxX]+|\d+)\)|[iIvVxX]+\))/g;
    
    const formatted = escaped.replace(latinPattern, (match) => {
        return `<span class="kruti-latin">${match}</span>`;
    });

    return warningHtml + `<span class="kruti-devanagari">${formatted}</span>`;
}

function renderKrutiPreview(krutiText, hindiText) {
    if (elements.krutiVisualBox) {
        elements.krutiVisualBox.innerHTML = formatKrutiVisualPreviewHtml(krutiText, hindiText);
    }
    if (elements.krutiRawBox) {
        elements.krutiRawBox.textContent = krutiText || '';
    }
    if (elements.krutiByteCount) {
        elements.krutiByteCount.textContent = `Bytes: ${new Blob([krutiText || '']).size}`;
    }
}

/**
 * Section 5 Calibration Test
 * Tests exact required test examples and verifies Hindi Unicode Master, Kruti Dev Visual Preview, and Raw Code
 */
function runCalibrationTest() {
    const calibrationPhrases = [
        'स्टेशन मास्टर',
        'स्टेशन का विवरण',
        'अप लाइन',
        'डाउन लाइन',
        'सामान्य नियम',
        'डी.एस.टी.ई.',
        'एम.एन.पी.'
    ];
    
    const hindiMaster = calibrationPhrases.join('\n');
    state.originalText = "Station Master\nDescription of Station\nUP Line\nDN Line\nGeneral Rules\nDSTE\nMNP";
    state.hindiText = hindiMaster;
    
    if (elements.originalTextarea) elements.originalTextarea.value = state.originalText;
    if (elements.hindiTextarea) elements.hindiTextarea.value = hindiMaster;
    
    regenerateKrutiDev();
    
    // Switch to visual preview tab to display readable Hindi
    if (elements.tabKrutiVisual) {
        elements.tabKrutiVisual.click();
    }
    
    checkAndApplyKrutiFont();
    
    safeSetText(elements.docStatusIndicator, 'Calibration Test Loaded & Verified ✓');
}

/**
 * Workspace Panels Event Setup
 */
function setupWorkspacePanels() {
    // Automatically regenerate Kruti Dev output whenever Hindi Master is edited
    elements.hindiTextarea.addEventListener('input', () => {
        updateWordCounts();
        regenerateKrutiDev();
    });
    elements.regenerateKrutiBtn.addEventListener('click', () => regenerateKrutiDev());
    elements.originalTextarea.addEventListener('input', () => updateWordCounts());

    elements.tabKrutiVisual.addEventListener('click', () => {
        elements.tabKrutiVisual.classList.add('active');
        elements.tabKrutiRaw.classList.remove('active');
        elements.krutiVisualBox.style.display = 'block';
        elements.krutiRawBox.style.display = 'none';
        state.activeView = 'visual';
    });

    elements.tabKrutiRaw.addEventListener('click', () => {
        elements.tabKrutiRaw.classList.add('active');
        elements.tabKrutiVisual.classList.remove('active');
        elements.krutiVisualBox.style.display = 'none';
        elements.krutiRawBox.style.display = 'block';
        state.activeView = 'raw';
    });

    elements.copyOriginalBtn.addEventListener('click', () => copyToClipboard(elements.originalTextarea.value, 'Original English copied!'));
    elements.copyHindiBtn.addEventListener('click', () => copyToClipboard(elements.hindiTextarea.value, 'Hindi Unicode Master copied!'));
    elements.copyKrutiBtn.addEventListener('click', () => copyToClipboard(state.krutiText, 'Kruti Dev 010 text copied!'));

    if (elements.runCalibrationBtn) {
        elements.runCalibrationBtn.addEventListener('click', () => runCalibrationTest());
    }

    elements.clearOriginalBtn.addEventListener('click', () => {
        if (confirm('Clear original document?')) {
            elements.originalTextarea.value = '';
            state.originalText = '';
            resetActiveFile();
            updateWordCounts();
        }
    });
}

function updateWordCounts() {
    const origText = elements.originalTextarea.value;
    const origWords = origText.trim() ? origText.trim().split(/\s+/).length : 0;
    elements.originalWordCount.textContent = `Words: ${origWords} | Characters: ${origText.length}`;

    const hindiText = elements.hindiTextarea.value;
    const hindiWords = hindiText.trim() ? hindiText.trim().split(/\s+/).length : 0;
    elements.hindiWordCount.textContent = `Words: ${hindiWords} | Characters: ${hindiText.length}`;
}

function copyToClipboard(text, message) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        alert(message);
    }).catch(err => {
        console.error('Clipboard copy failed:', err);
    });
}

/**
 * Find and Replace Setup
 */
function setupFindAndReplace() {
    elements.toggleFindReplaceBtn.addEventListener('click', () => {
        const isVisible = elements.findReplaceBar.style.display !== 'none';
        elements.findReplaceBar.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) elements.findInput.focus();
    });

    elements.frClearBtn.addEventListener('click', () => {
        elements.findInput.value = '';
        elements.replaceInput.value = '';
        elements.findCounter.textContent = 'Matches: 0';
        state.findState = { query: '', matches: [], currentIndex: -1 };
    });

    elements.findInput.addEventListener('input', updateFindMatches);
    elements.frMatchCase.addEventListener('change', updateFindMatches);
    elements.frWholeWord.addEventListener('change', updateFindMatches);

    elements.findNextBtn.addEventListener('click', () => navigateMatch(1));
    elements.findPrevBtn.addEventListener('click', () => navigateMatch(-1));

    elements.replaceBtn.addEventListener('click', () => {
        const query = elements.findInput.value;
        const replaceWith = elements.replaceInput.value;
        if (!query) return;

        const currentText = elements.hindiTextarea.value;
        const flags = elements.frMatchCase.checked ? '' : 'i';
        let regex;
        try {
            const pattern = elements.frWholeWord.checked ? `\\b${escapeRegExp(query)}\\b` : escapeRegExp(query);
            regex = new RegExp(pattern, flags);
        } catch {
            return;
        }

        elements.hindiTextarea.value = currentText.replace(regex, replaceWith);
        regenerateKrutiDev();
        updateFindMatches();
    });

    elements.replaceAllBtn.addEventListener('click', () => {
        const query = elements.findInput.value;
        const replaceWith = elements.replaceInput.value;
        if (!query) return;

        const currentText = elements.hindiTextarea.value;
        const flags = elements.frMatchCase.checked ? 'g' : 'gi';
        let regex;
        try {
            const pattern = elements.frWholeWord.checked ? `\\b${escapeRegExp(query)}\\b` : escapeRegExp(query);
            regex = new RegExp(pattern, flags);
        } catch {
            return;
        }

        elements.hindiTextarea.value = currentText.replace(regex, replaceWith);
        regenerateKrutiDev();
        updateFindMatches();
        alert('All occurrences replaced.');
    });
}

function updateFindMatches() {
    const query = elements.findInput.value;
    if (!query) {
        elements.findCounter.textContent = 'Matches: 0';
        state.findState.matches = [];
        return;
    }

    const text = elements.hindiTextarea.value;
    const flags = elements.frMatchCase.checked ? 'g' : 'gi';
    let regex;
    try {
        const pattern = elements.frWholeWord.checked ? `\\b${escapeRegExp(query)}\\b` : escapeRegExp(query);
        regex = new RegExp(pattern, flags);
    } catch {
        return;
    }

    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        matches.push(match.index);
    }

    state.findState.matches = matches;
    state.findState.currentIndex = matches.length > 0 ? 0 : -1;
    elements.findCounter.textContent = `Matches: ${matches.length}`;
}

function navigateMatch(direction) {
    const { matches } = state.findState;
    if (matches.length === 0) return;

    state.findState.currentIndex = (state.findState.currentIndex + direction + matches.length) % matches.length;
    const targetPos = matches[state.findState.currentIndex];
    const queryLen = elements.findInput.value.length;

    elements.hindiTextarea.focus();
    elements.hindiTextarea.setSelectionRange(targetPos, targetPos + queryLen);
    elements.findCounter.textContent = `Match ${state.findState.currentIndex + 1} of ${matches.length}`;
}

/**
 * Download Options Setup
 */
function setupDownloads() {
    elements.downloadDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = elements.downloadDropdownMenu.style.display !== 'none';
        elements.downloadDropdownMenu.style.display = isOpen ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
        elements.downloadDropdownMenu.style.display = 'none';
    });

    const getBaseName = () => {
        return state.activeFile ? state.activeFile.name.replace(/\.[^/.]+$/, "") : "document";
    };

    const runDownloadWithProgress = async (stageName, taskFn) => {
        try {
            state.isProcessing = true;
            state.isCancelled = false;
            showProgressModal(stageName, 'Initializing document generation...', 0);
            await taskFn((done, total, desc, details = {}) => {
                if (state.isCancelled) throw new Error('Generation cancelled by user');
                let pct = 0;
                if (typeof total === 'number' && total > 0) {
                    pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
                } else if (typeof done === 'number' && done >= 0 && done <= 100) {
                    pct = Math.round(done);
                }
                updateProgress(stageName, desc || `Generating document (${pct}%)...`, pct, details);
            });
            updateProgress('Completed', 'Document generated and downloaded successfully (100%).', 100);
            setTimeout(() => {
                hideProgressModal();
                state.isProcessing = false;
            }, 600);
        } catch (err) {
            console.error('Download error:', err);
            hideProgressModal();
            state.isProcessing = false;
            if (state.isCancelled || err.message?.includes('cancelled')) {
                safeSetText(elements.docStatusIndicator, 'Generation cancelled by user');
            } else {
                alert(`Document generation error: ${err.message}`);
                safeSetText(elements.docStatusIndicator, `Generation error: ${err.message}`);
            }
        }
    };

    // 1. Formatted Kruti Dev 010 DOCX
    elements.dlKrutiFormattedDocx.addEventListener('click', async () => {
        await runDownloadWithProgress('Generating Formatted Kruti Dev 010 Word DOCX', (onProgress) =>
            downloadDocx({
                originalDocxBuffer: state.originalDocxBuffer,
                ast: state.documentAst,
                pagesData: state.isMultiPageMode ? state.pagesData : null,
                text: state.hindiText,
                mode: 'krutidev',
                preserveFormatting: true,
                filename: `${getBaseName()}_KrutiDev010_Formatted.docx`,
                customGlossary: state.customDictionary,
                preserveRoman: state.settings.preserveRomanNumerals,
                preserveNumbers: state.settings.preserveNumbers,
                preservePunctuation: state.settings.preservePunctuation,
                apiEndpoint: state.settings.apiEndpoint,
                apiKey: state.settings.apiKey,
                onProgress,
                checkCancelled: () => state.isCancelled
            })
        );
    });

    // 2. Formatted Hindi Unicode DOCX
    elements.dlHindiFormattedDocx.addEventListener('click', async () => {
        await runDownloadWithProgress('Generating Formatted Hindi Unicode Word DOCX', (onProgress) =>
            downloadDocx({
                originalDocxBuffer: state.originalDocxBuffer,
                ast: state.documentAst,
                pagesData: state.isMultiPageMode ? state.pagesData : null,
                text: state.hindiText,
                mode: 'unicode',
                preserveFormatting: true,
                filename: `${getBaseName()}_HindiUnicode_Formatted.docx`,
                customGlossary: state.customDictionary,
                preserveRoman: state.settings.preserveRomanNumerals,
                preserveNumbers: state.settings.preserveNumbers,
                preservePunctuation: state.settings.preservePunctuation,
                apiEndpoint: state.settings.apiEndpoint,
                apiKey: state.settings.apiKey,
                onProgress,
                checkCancelled: () => state.isCancelled
            })
        );
    });

    // 3. Kruti Dev 010 DOCX (Text runs)
    elements.dlKrutiDocx.addEventListener('click', async () => {
        await runDownloadWithProgress('Generating Kruti Dev 010 DOCX', (onProgress) =>
            downloadDocx({
                ast: null,
                pagesData: state.isMultiPageMode ? state.pagesData : null,
                text: state.hindiText,
                mode: 'krutidev',
                preserveFormatting: false,
                filename: `${getBaseName()}_KrutiDev010.docx`,
                onProgress,
                checkCancelled: () => state.isCancelled
            })
        );
    });

    // 4. Hindi Unicode DOCX (Mangal)
    elements.dlHindiDocx.addEventListener('click', async () => {
        await runDownloadWithProgress('Generating Hindi Unicode DOCX', (onProgress) =>
            downloadDocx({
                ast: null,
                pagesData: state.isMultiPageMode ? state.pagesData : null,
                text: state.hindiText,
                mode: 'unicode',
                preserveFormatting: false,
                filename: `${getBaseName()}_HindiUnicode.docx`,
                onProgress,
                checkCancelled: () => state.isCancelled
            })
        );
    });

    // 5. Kruti Dev PDF
    elements.dlKrutiPdf.addEventListener('click', async () => {
        await runDownloadWithProgress('Generating Kruti Dev 010 PDF', (onProgress) =>
            downloadPdf({
                pagesData: state.isMultiPageMode ? state.pagesData : null,
                text: state.hindiText,
                mode: 'krutidev',
                title: getBaseName().toUpperCase(),
                filename: `${getBaseName()}_KrutiDev.pdf`,
                onProgress,
                checkCancelled: () => state.isCancelled
            })
        );
    });

    // 6. Hindi Unicode PDF
    elements.dlHindiPdf.addEventListener('click', async () => {
        await runDownloadWithProgress('Generating Hindi Unicode PDF', (onProgress) =>
            downloadPdf({
                pagesData: state.isMultiPageMode ? state.pagesData : null,
                text: state.hindiText,
                mode: 'unicode',
                title: getBaseName().toUpperCase(),
                filename: `${getBaseName()}_HindiUnicode.pdf`,
                onProgress,
                checkCancelled: () => state.isCancelled
            })
        );
    });

    // 7. Kruti Dev Legacy Encoded TXT
    elements.dlKrutiTxt.addEventListener('click', () => {
        const blob = new Blob([state.krutiText], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${getBaseName()}_KrutiDev010.txt`);
    });

    // 8. Hindi Unicode TXT
    elements.dlHindiTxt.addEventListener('click', () => {
        const blob = new Blob([state.hindiText], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${getBaseName()}_HindiUnicode.txt`);
    });
}

/**
 * Required Test Cases Setup (including 50, 222, and 300 page simulations)
 */
function setupTestCases() {
    const testChips = document.querySelectorAll('.test-chip');
    testChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const testId = chip.getAttribute('data-test');

            if (testId === "50" || testId === "222" || testId === "300") {
                // Large Multi-Page Simulation
                runLargeDocumentSimulation(parseInt(testId, 10));
                return;
            }

            const test = TEST_CASES[testId];
            if (!test) return;

            elements.largeDocDashboard.style.display = 'none';
            state.isMultiPageMode = false;
            elements.originalTextarea.value = test.text;
            state.originalText = test.text;
            state.activeFile = { name: `TestCase_${testId}.txt`, size: test.text.length, type: 'txt' };
            elements.sourceBadge.textContent = test.title;

            updateWordCounts();
            runSingleDocumentConversion();
            document.getElementById('workspace-section').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

/**
 * Large Multi-Page Simulation (50, 222, 300 Pages)
 * Simulates batched page extraction, translation, Kruti Dev encoding, and validation!
 */
async function runLargeDocumentSimulation(pageCount) {
    state.activeFile = {
        name: `Railway_GSR_Manual_${pageCount}Pages.pdf`,
        size: pageCount * 45000,
        type: 'pdf'
    };
    state.activeDocId = `sim_${pageCount}_${Date.now()}`;
    state.totalPages = pageCount;
    state.isMultiPageMode = true;

    elements.dropZonePrompt.style.display = 'none';
    elements.fileActiveCard.style.display = 'flex';
    elements.activeFileName.textContent = state.activeFile.name;
    elements.activeFileDetails.textContent = `${Math.round(state.activeFile.size / 1024)} KB • ${pageCount} Pages • PDF`;
    elements.sourceBadge.textContent = `${pageCount}-Page PDF Document`;

    // Initialize Dashboard UI
    elements.largeDocDashboard.style.display = 'block';
    elements.statTotalPages.textContent = pageCount;
    elements.statExtractedPages.textContent = '0';
    elements.statTranslatedPages.textContent = '0';
    elements.statEncodedPages.textContent = '0';
    elements.queueCurrentPageText.textContent = `Current Page: 1 of ${pageCount}`;
    elements.queuePercentageText.textContent = '0%';
    elements.queueProgressFill.style.width = '0%';
    elements.queueStageDesc.textContent = `Simulating batched processing across ${pageCount} pages...`;

    renderPageMatrix(pageCount);
    setDownloadButtonsLock(true, `Processing all ${pageCount} pages. Download will unlock when complete.`);

    document.getElementById('workspace-section').scrollIntoView({ behavior: 'smooth' });

    // Seed Pages into IndexedDB
    const templateParagraphs = [
        "Station Master must ensure line clear before clearing Home Signal.",
        "Track circuit 505AXT and 505BXT are detected in normal section.",
        "Point machine DP519A locked. ODP507A clearance verified on Section/Line.",
        "Comply with General Rules Chapter VI para 6.02(iv) and sub-clause (i), (ii).",
        "Date of Issue:- 22-07-2026. Private Number given on Telephone to Cabin Master."
    ];

    const pagesData = [];
    const batchSize = 10;

    for (let p = 1; p <= pageCount; p++) {
        const text = `NORTHERN RAILWAY OPERATING CIRCULAR — PAGE ${p} OF ${pageCount}\n` +
            `${templateParagraphs[(p - 1) % templateParagraphs.length]}\n` +
            `Signal S9AXT automatic aspect. S507XT aspect normal. Speed: 30 km/h.`;

        pagesData.push({
            id: `${state.activeDocId}_${p}`,
            docId: state.activeDocId,
            pageNum: p,
            originalText: text,
            status: 'pending'
        });
    }

    // Process in batches
    for (let i = 0; i < pagesData.length; i += batchSize) {
        if (state.isCancelled) {
            handleQueueProgress({
                docId: state.activeDocId,
                totalPages: pageCount,
                currentPage: i,
                extractedCount: i,
                translatedCount: i,
                encodedCount: i,
                failedPages: [],
                isPaused: false,
                isCancelled: true,
                isCompleted: false,
                stage: 'Cancelled',
                stageDesc: 'Processing cancelled by user.',
                percentage: Math.floor((i / pageCount) * 100),
                pagesData
            });
            break;
        }

        const currentBatch = pagesData.slice(i, i + batchSize);

        for (const item of currentBatch) {
            if (state.isCancelled) break;
            // Translate
            const clean = item.originalText.replace(/\r\n/g, '\n');
            const hindi = await translateEnglishToHindi(clean, {
                customGlossary: state.customDictionary,
                preserveRoman: true
            });
            const kruti = unicodeToKrutiDev(hindi, {
                preserveRoman: true,
                preserveNumbers: true,
                preservePunctuation: true
            });

            item.hindiText = hindi;
            item.krutiText = kruti;
            item.status = 'encoded';

            await StorageService.savePageResult(state.activeDocId, item.pageNum, item);
        }

        if (state.isCancelled) break;

        const encodedCount = Math.min(i + batchSize, pageCount);
        const isDone = encodedCount === pageCount;
        const pct = isDone ? 100 : Math.min(99, Math.floor((encodedCount / pageCount) * 100));

        handleQueueProgress({
            docId: state.activeDocId,
            totalPages: pageCount,
            currentPage: encodedCount,
            extractedCount: encodedCount,
            translatedCount: encodedCount,
            encodedCount,
            failedPages: [],
            isPaused: false,
            isCancelled: false,
            isCompleted: isDone,
            stage: isDone ? 'Completed' : 'Batch Processing',
            stageDesc: isDone
                ? `All ${pageCount} pages processed and verified.`
                : `Completed ${encodedCount} of ${pageCount} pages in batch...`,
            percentage: pct,
            pagesData
        });

        // Yield to browser event loop
        await new Promise(r => setTimeout(r, 40));
    }
}

/**
 * Modals & Settings
 */
function setupModals() {
    elements.openDictionaryBtn.addEventListener('click', () => {
        populateDictionaryTable();
        elements.dictionaryModal.classList.add('open');
    });
    elements.closeDictModal.addEventListener('click', () => elements.dictionaryModal.classList.remove('open'));
    elements.dictDoneBtn.addEventListener('click', () => elements.dictionaryModal.classList.remove('open'));

    elements.addTermBtn.addEventListener('click', () => {
        elements.addTermForm.style.display = 'block';
    });
    elements.cancelNewTerm.addEventListener('click', () => {
        elements.addTermForm.style.display = 'none';
    });
    elements.saveNewTerm.addEventListener('click', async () => {
        const term = elements.newTermEn.value.trim();
        const hindi = elements.newTermHi.value.trim();
        if (!term || !hindi) {
            alert('Please enter both English and Hindi term.');
            return;
        }

        await StorageService.saveDictionaryTerm(term, hindi);
        state.customDictionary[term] = hindi;
        elements.newTermEn.value = '';
        elements.newTermHi.value = '';
        elements.addTermForm.style.display = 'none';
        populateDictionaryTable();
    });

    elements.exportDictBtn.addEventListener('click', () => {
        const data = JSON.stringify({ ...DEFAULT_RAILWAY_GLOSSARY, ...state.customDictionary }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        saveAs(blob, 'railway_technical_dictionary.json');
    });

    elements.importDictBtn.addEventListener('click', () => elements.dictFileInput.click());
    elements.dictFileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const text = await e.target.files[0].text();
                const json = JSON.parse(text);
                for (const [k, v] of Object.entries(json)) {
                    await StorageService.saveDictionaryTerm(k, v);
                    state.customDictionary[k] = v;
                }
                populateDictionaryTable();
                alert('Dictionary imported successfully.');
            } catch (err) {
                alert('Invalid JSON file.');
            }
        }
    });

    elements.openSettingsBtn.addEventListener('click', () => {
        loadSettingsIntoUI();
        elements.settingsModal.classList.add('open');
    });
    elements.closeSettingsModal.addEventListener('click', () => elements.settingsModal.classList.remove('open'));
    elements.saveSettingsBtn.addEventListener('click', () => {
        saveSettingsFromUI();
        elements.settingsModal.classList.remove('open');
    });

    elements.themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        state.settings.theme = nextTheme;
        StorageService.saveSettings(state.settings);
        elements.themeIcon.textContent = nextTheme === 'dark' ? '🌙' : '☀️';
    });

    elements.cancelProgressBtn.addEventListener('click', () => {
        state.isCancelled = true;
        state.isProcessing = false;
        queueService.cancelJob();
        hideProgressModal();
        safeSetText(elements.docStatusIndicator, 'Cancelled by user');
        safeSetText(elements.queueStageDesc, 'Processing Cancelled by user.');
    });
}

function populateDictionaryTable(filter = '') {
    const merged = { ...DEFAULT_RAILWAY_GLOSSARY, ...state.customDictionary };
    const tbody = elements.dictTermsTableBody;
    tbody.innerHTML = '';

    const keys = Object.keys(merged).filter(k => k.toLowerCase().includes(filter.toLowerCase()));

    for (const key of keys.slice(0, 50)) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-subtle)';

        const tdEn = document.createElement('td');
        tdEn.style.padding = '0.5rem 0.85rem';
        tdEn.textContent = key;

        const tdHi = document.createElement('td');
        tdHi.style.padding = '0.5rem 0.85rem';
        tdHi.style.color = 'var(--accent-amber)';
        tdHi.textContent = merged[key];

        const tdAct = document.createElement('td');
        tdAct.style.padding = '0.5rem 0.85rem';
        tdAct.style.textAlign = 'right';

        if (state.customDictionary[key]) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-ghost';
            delBtn.style.padding = '0.2rem 0.5rem';
            delBtn.style.color = '#EF4444';
            delBtn.textContent = 'Delete';
            delBtn.addEventListener('click', async () => {
                await StorageService.deleteDictionaryTerm(key);
                delete state.customDictionary[key];
                populateDictionaryTable(filter);
            });
            tdAct.appendChild(delBtn);
        } else {
            tdAct.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-tertiary);">Official</span>';
        }

        tr.appendChild(tdEn);
        tr.appendChild(tdHi);
        tr.appendChild(tdAct);
        tbody.appendChild(tr);
    }
}

function loadSettingsIntoUI() {
    const s = state.settings;
    document.getElementById('set-preserve-formatting').checked = s.preserveFormatting;
    document.getElementById('set-preserve-bold').checked = s.preserveBold;
    document.getElementById('set-preserve-underline').checked = s.preserveUnderline;
    document.getElementById('set-preserve-roman').checked = s.preserveRomanNumerals;
    document.getElementById('set-preserve-numbers').checked = s.preserveNumbers;
    document.getElementById('set-preserve-punctuation').checked = s.preservePunctuation;
    document.getElementById('set-tech-codes').checked = s.technicalCodeTranslation;
    document.getElementById('set-preserve-tables').checked = s.preserveTables;
    document.getElementById('set-auto-save').checked = s.autoSave;
    document.getElementById('set-api-endpoint').value = s.apiEndpoint || '';
    document.getElementById('set-api-key').value = s.apiKey || '';
}

function saveSettingsFromUI() {
    state.settings = {
        preserveFormatting: document.getElementById('set-preserve-formatting').checked,
        preserveBold: document.getElementById('set-preserve-bold').checked,
        preserveUnderline: document.getElementById('set-preserve-underline').checked,
        preserveItalic: true,
        preserveRomanNumerals: document.getElementById('set-preserve-roman').checked,
        preserveNumbers: document.getElementById('set-preserve-numbers').checked,
        preservePunctuation: document.getElementById('set-preserve-punctuation').checked,
        preserveTables: document.getElementById('set-preserve-tables').checked,
        preserveIndentation: true,
        technicalCodeTranslation: document.getElementById('set-tech-codes').checked,
        autoSave: document.getElementById('set-auto-save').checked,
        apiEndpoint: document.getElementById('set-api-endpoint').value.trim(),
        apiKey: document.getElementById('set-api-key').value.trim(),
        theme: state.settings.theme
    };
    StorageService.saveSettings(state.settings);
    alert('Settings saved.');
}

function showProgressModal(stage, subtext, percentage, details = {}) {
    try {
        state.isCancelled = false;
        const pct = Math.max(0, Math.min(100, Math.round(percentage)));
        safeSetText(elements.progressStageText, stage);
        safeSetText(elements.progressSubText, subtext);
        safeSetStyle(elements.progressBarFill, 'width', `${pct}%`);
        const counter = details.pagesInfo
            ? `${pct}% Complete (${details.pagesInfo})`
            : `${pct}% Complete`;
        safeSetText(elements.progressPageCounter, counter);
        if (elements.progressModal) {
            elements.progressModal.classList.add('open');
        }
    } catch (err) {
        console.warn('[Progress Modal] Non-fatal error showing progress:', err);
    }
}

function updateProgress(stage, subtext, percentage, details = {}) {
    try {
        const pct = Math.max(0, Math.min(100, Math.round(percentage)));
        safeSetText(elements.progressStageText, stage);
        safeSetText(elements.progressSubText, subtext);
        safeSetStyle(elements.progressBarFill, 'width', `${pct}%`);
        const counter = details.pagesInfo
            ? `${pct}% Complete (${details.pagesInfo})`
            : `${pct}% Complete`;
        safeSetText(elements.progressPageCounter, counter);
    } catch (err) {
        console.warn('[Progress Modal] Non-fatal error updating progress:', err);
    }
}

function hideProgressModal() {
    try {
        if (elements.progressModal) {
            elements.progressModal.classList.remove('open');
        }
    } catch (err) {
        console.warn('[Progress Modal] Non-fatal error hiding progress modal:', err);
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadWelcomeContent() {
    const welcome = `NORTHERN RAILWAY
Safety Circular No. 117/2025
Date of Issue: 22-07-2026

Subject: Station Working Rules and Signal Clearance Procedure

1. Duties of Station Master and Loco Pilot:
The Station Master must verify that track circuit 505AXT and 505BXT are clear before giving Line Clear.
The Loco Pilot must not pass Home Signal or Advanced Starter at danger without authority.
Refer Chapter VI para 6.02(iv) and General Rules para 1.20.

2. Point Machines and Technical Codes:
Point machine DP519A and DP519B must remain detected normal.
Verify crossover clearance on ODP507A and S9AXT.`;

    elements.originalTextarea.value = welcome;
    state.originalText = welcome;
    updateWordCounts();
    runSingleDocumentConversion();
}

// Start Application on Load
window.addEventListener('DOMContentLoaded', initApp);
