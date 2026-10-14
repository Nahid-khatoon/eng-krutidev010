/**
 * IndexedDB & LocalStorage Persistence Service (Version 2)
 * Supports large multi-page document persistence (50, 100, 200, 222, 300, 500+ pages),
 * per-page state tracking, intermediate results, auto-save, and terminology dictionary.
 */

const DB_NAME = 'KrutiDev010ConverterDB';
const DB_VERSION = 2;

let dbPromise = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Document metadata store
                if (!db.objectStoreNames.contains('documents')) {
                    db.createObjectStore('documents', { keyPath: 'id' });
                }

                // Per-page storage for large multi-page documents (up to 500+ pages)
                // Key format: `${docId}_${pageNum}`
                if (!db.objectStoreNames.contains('pages')) {
                    const pageStore = db.createObjectStore('pages', { keyPath: 'id' });
                    pageStore.createIndex('docId', 'docId', { unique: false });
                    pageStore.createIndex('status', 'status', { unique: false });
                    pageStore.createIndex('docId_pageNum', ['docId', 'pageNum'], { unique: true });
                }

                // Custom railway dictionary terms
                if (!db.objectStoreNames.contains('dictionary')) {
                    db.createObjectStore('dictionary', { keyPath: 'term' });
                }

                // Recent conversions history
                if (!db.objectStoreNames.contains('history')) {
                    const histStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                    histStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return dbPromise;
}

export const StorageService = {
    /**
     * Save or update document metadata
     */
    async saveDocument(doc) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('documents', 'readwrite');
            const store = tx.objectStore('documents');
            const data = {
                ...doc,
                updatedAt: Date.now()
            };
            store.put(data);
            tx.oncomplete = () => resolve(data);
            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Retrieve document by ID
     */
    async getDocument(id) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('documents', 'readonly');
            const store = tx.objectStore('documents');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },

    /**
     * Save an individual page result
     */
    async savePageResult(docId, pageNum, pageData) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pages', 'readwrite');
            const store = tx.objectStore('pages');
            const pageRecord = {
                id: `${docId}_${pageNum}`,
                docId,
                pageNum,
                ...pageData,
                updatedAt: Date.now()
            };
            store.put(pageRecord);
            tx.oncomplete = () => resolve(pageRecord);
            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Get an individual page record
     */
    async getPageResult(docId, pageNum) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pages', 'readonly');
            const store = tx.objectStore('pages');
            const req = store.get(`${docId}_${pageNum}`);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },

    /**
     * Retrieve all pages for a document, sorted by page number ascending
     */
    async getAllPagesForDoc(docId) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pages', 'readonly');
            const store = tx.objectStore('pages');
            const index = store.index('docId');
            const req = index.getAll(docId);
            req.onsuccess = () => {
                const pages = req.result || [];
                pages.sort((a, b) => a.pageNum - b.pageNum);
                resolve(pages);
            };
            req.onerror = () => reject(req.error);
        });
    },

    /**
     * Get failed pages for a document
     */
    async getFailedPagesForDoc(docId) {
        const allPages = await this.getAllPagesForDoc(docId);
        return allPages.filter(p => p.status === 'failed');
    },

    /**
     * Clear all pages for a document
     */
    async clearPagesForDoc(docId) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pages', 'readwrite');
            const store = tx.objectStore('pages');
            const index = store.index('docId');
            const req = index.openCursor(IDBKeyRange.only(docId));
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Custom Dictionary Management
     */
    async saveDictionaryTerm(term, hindi) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('dictionary', 'readwrite');
            const store = tx.objectStore('dictionary');
            store.put({ term, hindi, updatedAt: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    async getCustomDictionary() {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('dictionary', 'readonly');
            const store = tx.objectStore('dictionary');
            const req = store.getAll();
            req.onsuccess = () => {
                const map = {};
                (req.result || []).forEach(item => {
                    map[item.term] = item.hindi;
                });
                resolve(map);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async deleteDictionaryTerm(term) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('dictionary', 'readwrite');
            const store = tx.objectStore('dictionary');
            store.delete(term);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * User Settings
     */
    getSettings() {
        const defaults = {
            preserveFormatting: true,
            preserveBold: true,
            preserveUnderline: true,
            preserveItalic: true,
            preserveRomanNumerals: true,
            preserveNumbers: true,
            preservePunctuation: true,
            preserveTables: true,
            preserveIndentation: true,
            technicalCodeTranslation: true,
            autoSave: true,
            batchSize: 5,
            apiEndpoint: '',
            apiKey: '',
            theme: 'dark'
        };
        try {
            const saved = localStorage.getItem('krutidev_settings');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch {
            return defaults;
        }
    },

    saveSettings(settings) {
        try {
            localStorage.setItem('krutidev_settings', JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save settings to localStorage:', e);
        }
    }
};
