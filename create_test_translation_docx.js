import fs from 'fs';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { transformDocxBuffer } from './src/services/docxGenerator.js';
import { translateEnglishToHindi, checkTranslationQuality } from './src/services/translationEngine.js';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

async function run() {
    console.log('--- CREATING TEST DOCX WITH USER TEST PARAGRAPH ---');

    const testParagraphs = [
        'Gradient, (F) 303, 1160m, 550.00m, 1390m, 3640m, Block Section, Station Building.',
        'Gradient, (F) 303, 1160m, 550.00m, 1390.m, 3640m, Block Section, Station Building.',
        'ब्रॉड गेज',
        'जारी करने की तारीख......',
        'बलपूर्वक लाया गया......',
        '2.5.1 रनिंग लाइन्स, गति की दिशा और सीएसआर',
        '(a) UP Main Line (Line No. 2)',
        '(b) UP Loop Line (Line No. 1)',
        '(c) DN Main Line (Line No. 3)',
        '(d) DN Loop Line (Line No. 4)',
        'Chapter VI para 6.02(iv)',
        'Date: 22.07.2026'
    ];

    // Build source DOCX
    const doc = new Document({
        sections: [{
            children: testParagraphs.map(text => new Paragraph({
                children: [new TextRun({ text, size: 24 })]
            }))
        }]
    });

    const sourceBuffer = await Packer.toBuffer(doc);
    fs.writeFileSync('test_translation_source.docx', sourceBuffer);
    console.log('Wrote test_translation_source.docx (' + sourceBuffer.length + ' bytes)');

    // 1. Transform to Kruti Dev 010 DOCX
    console.log('Transforming to Kruti Dev 010 DOCX...');
    const krutiBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'krutidev' });
    fs.writeFileSync('test_translation_krutidev.docx', Buffer.from(krutiBuffer));
    console.log('Wrote test_translation_krutidev.docx (' + krutiBuffer.length + ' bytes)');

    // 2. Transform to Hindi Unicode DOCX
    console.log('Transforming to Hindi Unicode DOCX...');
    const unicodeBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'unicode' });
    fs.writeFileSync('test_translation_unicode.docx', Buffer.from(unicodeBuffer));
    console.log('Wrote test_translation_unicode.docx (' + unicodeBuffer.length + ' bytes)');

    // 3. Inspect XML content in transformed Kruti Dev DOCX
    console.log('\n--- VERIFYING GENERATED KRUTI DEV DOCX XML ---');
    const zip = await JSZip.loadAsync(krutiBuffer);
    const docXml = await zip.file('word/document.xml').async('text');
    const xmlDoc = new DOMParser().parseFromString(docXml, 'text/xml');
    const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));

    let allPassed = true;

    paragraphs.forEach((p, idx) => {
        const runs = Array.from(p.getElementsByTagName('w:r'));
        const paraText = runs.map(r => {
            const t = r.getElementsByTagName('w:t')[0];
            return t ? t.textContent : '';
        }).join('');

        if (!paraText.trim()) return;
        console.log(`\nParagraph ${idx + 1}:`);
        console.log(`  Combined text: "${paraText}"`);

        runs.forEach((r, rIdx) => {
            const t = r.getElementsByTagName('w:t')[0];
            const textVal = t ? t.textContent : '';
            const rFonts = r.getElementsByTagName('w:rFonts')[0];
            const fontVal = rFonts ? rFonts.getAttribute('w:ascii') : 'default';
            console.log(`    Run ${rIdx + 1}: font="${fontVal}" text="${textVal}"`);
        });
    });

    // 4. Verify test paragraph in Unicode DOCX
    console.log('\n--- VERIFYING TRANSLATION QUALITY AUDIT ---');
    const unicodeZip = await JSZip.loadAsync(unicodeBuffer);
    const unicodeXml = await unicodeZip.file('word/document.xml').async('text');
    const uDoc = new DOMParser().parseFromString(unicodeXml, 'text/xml');
    const uParas = Array.from(uDoc.getElementsByTagName('w:p'));
    const fullUnicodeText = uParas.map(p => {
        return Array.from(p.getElementsByTagName('w:t')).map(t => t.textContent).join('');
    }).join('\n');

    console.log('\nFull Extracted Hindi Unicode:\n' + fullUnicodeText);

    const audit = checkTranslationQuality(fullUnicodeText);
    console.log('\nQuality Audit Result:', audit);

    if (!audit.isValid) {
        console.error('FAIL: Translation Quality Audit failed with untranslated words:', audit.untranslatedWords);
        allPassed = false;
    } else {
        console.log('PASS: Translation Quality Audit passed with 0 untranslated words.');
    }

    // Specific verification points
    const checks = [
        { name: 'Gradient translated', test: fullUnicodeText.includes('ग्रेडिएंट') },
        { name: 'Technical notation (F) 303 -> (एफ) 303', test: fullUnicodeText.includes('(एफ) 303') },
        { name: '1160m -> 1160 मीटर', test: fullUnicodeText.includes('1160 मीटर') },
        { name: '550.00m -> 550.00 मीटर', test: fullUnicodeText.includes('550.00 मीटर') },
        { name: '1390m -> 1390 मीटर', test: fullUnicodeText.includes('1390 मीटर') },
        { name: '3640m -> 3640 मीटर', test: fullUnicodeText.includes('3640 मीटर') },
        { name: 'Block Section -> ब्लॉक सेक्शन', test: fullUnicodeText.includes('ब्लॉक सेक्शन') },
        { name: 'Station Building -> स्टेशन भवन', test: fullUnicodeText.includes('स्टेशन भवन') },
        { name: 'List markers (a)-(d) preserved', test: fullUnicodeText.includes('(a)') && fullUnicodeText.includes('(b)') },
        { name: 'Chapter VI para 6.02(iv) preserved', test: fullUnicodeText.includes('VI') && fullUnicodeText.includes('6.02(iv)') },
        { name: 'Date 22.07.2026 preserved', test: fullUnicodeText.includes('22.07.2026') },
        { name: 'Multiple dots preserved', test: fullUnicodeText.includes('......') },
        { name: 'Zero rogue ३ or प)', test: !docXml.includes('३') && !docXml.includes('प)') }
    ];

    console.log('\n--- DETAILED CHECK RESULTS ---');
    checks.forEach(c => {
        if (c.test) {
            console.log(`PASS: ${c.name}`);
        } else {
            console.error(`FAIL: ${c.name}`);
            allPassed = false;
        }
    });

    if (allPassed) {
        console.log('\n>>> ALL FINAL TESTS PASSED PERFECTLY! <<<');
        process.exit(0);
    } else {
        console.error('\n>>> SOME TESTS FAILED! <<<');
        process.exit(1);
    }
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
