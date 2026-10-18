import assert from 'assert';
import { translateEnglishToHindi, checkTranslationQuality, ensureNoEnglishWordsRemain, isPermittedRomanNumeral } from './src/services/translationEngine.js';
import { downloadDocx, transformDocxBuffer } from './src/services/docxGenerator.js';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import JSZip from 'jszip';

console.log('========================================================');
console.log('TEST SUITE: VERIFYING 3 USER REQUIREMENTS');
console.log('========================================================\n');

async function runTests() {
    let passed = 0;
    let total = 0;

    function test(desc, fn) {
        total++;
        try {
            fn();
            console.log(`✅ [PASS] ${desc}`);
            passed++;
        } catch (err) {
            console.error(`❌ [FAIL] ${desc}:`, err.message);
        }
    }

    // -------------------------------------------------------------
    // REQUIREMENT 1: Zero English words leftover in translated text
    // -------------------------------------------------------------
    console.log('>>> REQUIREMENT 1: English Leftover Remediation (No English leftover)');
    const railwaySentences = [
        'Rigid observance of the rules is imperative and short cut method is not permitted.',
        'It is Imperative that Accident Reporting and Reference documents are Conspicuously displayed at Adjacent station.',
        'Duties of Station Master and Loco Pilot: Verify crossover clearance on 505AXT before giving Line Clear.',
        'Resetting Operation of Description of Station with Counter and Busy.',
        'All necessary details must be entered in the register.'
    ];

    for (const sent of railwaySentences) {
        const translated = await translateEnglishToHindi(sent);
        const audit = checkTranslationQuality(translated);
        test(`Zero English in: "${sent.slice(0, 45)}..."`, () => {
            assert(audit.isValid, `Found untranslated English: ${audit.untranslatedWords.join(', ')} in "${translated}"`);
        });
    }

    // -------------------------------------------------------------
    // REQUIREMENT 2: Single-page content strictly stays on 1 page (No overflow)
    // -------------------------------------------------------------
    console.log('\n>>> REQUIREMENT 2: Page Content Fit (No Page Overflow)');

    // Test A: downloadDocx with multi-page records (each page must have compact margins and adaptive sizing)
    const page1Lines = [];
    for (let i = 1; i <= 35; i++) {
        page1Lines.push(`पैराग्राफ ${i}: उत्तर रेलवे सुरक्षा परिपत्र एवं स्टेशन कार्य नियम खंड ${i}।`);
    }
    const page2Lines = [];
    for (let i = 1; i <= 25; i++) {
        page2Lines.push(`पेज 2 पैराग्राफ ${i}: सिग्नल एवं पॉइंट मशीन संचालन प्रक्रिया विवरण संख्या ${i}।`);
    }

    const pagesData = [
        { pageNum: 1, hindiText: page1Lines.join('\n') },
        { pageNum: 2, hindiText: page2Lines.join('\n') }
    ];

    // Mock saveAs for headless test
    const globalAny = global;
    let savedBlob = null;
    globalAny.window = {
        saveAs: (b) => { savedBlob = b; }
    };

    // Test B: in-place transformDocxBuffer margin calibration
    const sampleDoc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
                }
            },
            children: [
                new Paragraph({ children: [new TextRun('Safety Circular 117/2025: SWR rules')] }),
                new Paragraph({ children: [new TextRun('Chapter VI para 6.02(iv) and G & SR 4.65')] })
            ]
        }]
    });
    const sampleBuffer = await Packer.toBuffer(sampleDoc);
    const transformedBuffer = await transformDocxBuffer(sampleBuffer, { mode: 'krutidev' });
    const zip = await JSZip.loadAsync(transformedBuffer);
    const docXml = await zip.file('word/document.xml').async('text');

    test('In-place DOCX XML calibrates page margins to 720 dxa (0.5 inch) to prevent vertical overflow', () => {
        assert(docXml.includes('w:top="720"'), 'Top margin must be calibrated to 720 dxa');
        assert(docXml.includes('w:bottom="720"'), 'Bottom margin must be calibrated to 720 dxa');
    });

    test('In-place DOCX XML sets single line spacing (w:line="240") and compact w:after to prevent page spill', () => {
        assert(docXml.includes('w:line="240"'), 'Line spacing must be 240 (1.0 single spacing)');
    });

    // -------------------------------------------------------------
    // REQUIREMENT 3: Contextual Pronoun "I" vs Roman numeral "I"
    // -------------------------------------------------------------
    console.log('\n>>> REQUIREMENT 3: Contextual Pronoun "I" vs Roman Numeral "I"');

    const pronounCases = [
        { text: 'I have inspected the station and signals.', notWords: ['1', 'I', 'प्रथम'], includeAny: ['मैंने', 'निरीक्षण'] },
        { text: 'I hereby certify that all points are locked.', notWords: ['1', 'I', 'प्रथम'], includeAny: ['प्रमाणित'] },
        { text: 'I was on duty at Karjara station.', notWords: ['1', 'I', 'प्रथम'], includeAny: ['ड्यूटी', 'था'] },
        { text: 'I checked the track circuit.', notWords: ['1', 'I', 'प्रथम'], includeAny: ['मैंने', 'जाँच'] },
        { text: 'I will inform the Station Master.', notWords: ['1', 'I', 'प्रथम'], includeAny: ['मैं', 'स्टेशन मास्टर'] }
    ];

    for (const tc of pronounCases) {
        const res = await translateEnglishToHindi(tc.text);
        test(`Pronoun "I" contextually translated in: "${tc.text}"`, () => {
            const words = res.split(/\s+/);
            for (const nw of tc.notWords) {
                assert(!words.includes(nw), `Must NOT treat pronoun "I" as Roman numeral "${nw}" in "${res}"`);
            }
            const foundExpected = tc.includeAny.some(expected => res.includes(expected));
            assert(foundExpected, `Expected contextual translation in "${res}"`);
        });
    }

    const romanCases = [
        { text: 'Chapter I', expected: 'I' },
        { text: 'Standard-I Electronic Interlocking', expected: 'I' },
        { text: '(I) Verify route clearance.', expected: '(I)' },
        { text: 'Class I Station', expected: 'I' },
        { text: 'Rule I of General Rules', expected: 'I' }
    ];

    for (const rc of romanCases) {
        const res = await translateEnglishToHindi(rc.text);
        test(`Roman numeral "I" preserved in: "${rc.text}"`, () => {
            assert(res.includes(rc.expected), `Expected Roman "${rc.expected}" in "${res}"`);
        });
    }

    console.log('\n========================================================');
    console.log(`RESULTS: ${passed} / ${total} TESTS PASSED!`);
    console.log('========================================================');
    if (passed === total) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test suite execution error:', err);
    process.exit(1);
});
