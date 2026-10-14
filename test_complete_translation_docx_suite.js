import fs from 'fs';
import assert from 'assert';
import { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, Packer } from 'docx';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { transformDocxBuffer } from './src/services/docxGenerator.js';
import { translateEnglishToHindi, checkTranslationQuality } from './src/services/translationEngine.js';
import { unicodeToKrutiDev } from './src/services/krutiDevConverter.js';

async function runCompleteSuite() {
    console.log('================================================================');
    console.log('STARTING COMPLETE TRANSLATION & KRUTI DEV 010 VERIFICATION SUITE');
    console.log('================================================================\n');

    // -------------------------------------------------------------------------
    // PART 1: Direct Translation Engine & Glossary Checks
    // -------------------------------------------------------------------------
    console.log('--- PART 1: Context-Aware Translation of User Section 10 Sample ---');
    const sampleInput = "KARJARA Station is a 'B' class station on KIUL – GAYA B.G electrified section having dual VDU worked under Absolute Block System with Standard-II ELECTRONIC INTERLOCKING.";
    const sampleExpected = "करजरा स्टेशन किऊल–गया बड़ी लाइन के विद्युतीकृत सेक्शन पर स्थित 'बी' श्रेणी का स्टेशन है। इसमें दोहरी वी.डी.यू. है तथा यह निरपेक्ष ब्लॉक प्रणाली के अंतर्गत मानक-II इलेक्ट्रॉनिक इंटरलॉकिंग के साथ कार्य करता है।";

    const translatedSample = await translateEnglishToHindi(sampleInput);
    console.log('Input:    ', sampleInput);
    console.log('Output:   ', translatedSample);
    console.log('Expected: ', sampleExpected);
    assert.strictEqual(translatedSample, sampleExpected, 'Section 10 sentence must match expected Hindi Unicode translation character-for-character');
    console.log('✓ Section 10 sample translation 100% exact match!\n');

    console.log('--- PART 2: Railway Technical Abbreviations with Dots ---');
    const abbrInput = "HASSDAC MACLS IBH DSTE CSTE ECR SIP DNR SM VDU MNP ELB EKT";
    const abbrExpected = "एच.ए.एस.एस.डी.ए.सी. एम.ए.सी.एल.एस. आई.बी.एच. डी.एस.टी.ई. सी.एस.टी.ई. ई.सी.आर. एस.आई.पी. डी.एन.आर. एस.एम. वी.डी.यू. एम.एन.पी. ई.एल.बी. ई.के.टी.";
    const translatedAbbr = await translateEnglishToHindi(abbrInput);
    console.log('Abbr Output:   ', translatedAbbr);
    console.log('Abbr Expected: ', abbrExpected);
    assert.strictEqual(translatedAbbr, abbrExpected, 'Technical abbreviations must be converted letter-by-letter into Hindi with dots and without spaces between abbreviation letters');
    console.log('✓ Railway abbreviations 100% exact match!\n');

    console.log('--- PART 3: Technical Codes & Station Codes ---');
    const codesInput = "505AXT 505BXT DP519A ODP507A S9AXT UP DN";
    const codesExpected = "505ए.एक्स.टी. 505बी.एक्स.टी. डी.पी.519ए ओ.डी.पी.507ए एस9ए.एक्स.टी. अप डाउन";
    const translatedCodes = await translateEnglishToHindi(codesInput);
    console.log('Codes Output:   ', translatedCodes);
    console.log('Codes Expected: ', codesExpected);
    assert.strictEqual(translatedCodes, codesExpected, 'Technical codes must preserve numbers and transliterate alphabets with dots/letters');
    console.log('✓ Technical codes 100% exact match!\n');

    console.log('--- PART 4: Roman Numerals & Alphabetic Markers ---');
    const romanInput = "Standard-II Chapter VI para 6.02(iv) (a) First (b) Second";
    const romanExpected = "मानक-II अध्याय VI पैरा 6.02(iv) (ए) प्रथम (बी) द्वितीय";
    const translatedRoman = await translateEnglishToHindi(romanInput);
    console.log('Roman Output:   ', translatedRoman);
    console.log('Roman Expected: ', romanExpected);
    assert.ok(translatedRoman.includes('मानक-II'), 'Standard-II must be translated as मानक-II');
    assert.ok(translatedRoman.includes('VI'), 'Roman numeral VI must be preserved');
    assert.ok(translatedRoman.includes('6.02(iv)'), '6.02(iv) must be preserved');
    assert.ok(translatedRoman.includes('(ए)'), '(a) marker must be converted to (ए)');
    assert.ok(translatedRoman.includes('(बी)'), '(b) marker must be converted to (बी)');
    console.log('✓ Roman numerals and markers preserved/converted accurately!\n');

    console.log('--- PART 5: Numbers, Decimals & Punctuation Preservation ---');
    const punctInput = "Date: 12.09.2025, Ref: 08/2019, Distance: 800.00m, Ratio: 1 in 400 :- [OK]";
    const punctExpected = "तारीख: 12.09.2025, संदर्भ: 08/2019, दूरी: 800.00 मीटर, अनुपात: 1 में 400 :- [ठीक]";
    const translatedPunct = await translateEnglishToHindi(punctInput);
    console.log('Punct Output:   ', translatedPunct);
    assert.ok(translatedPunct.includes('12.09.2025'), 'Date 12.09.2025 must be preserved');
    assert.ok(translatedPunct.includes('08/2019'), 'Ref 08/2019 must be preserved');
    assert.ok(translatedPunct.includes('800.00 मीटर'), '800.00 मीटर must have space and preserved decimals');
    assert.ok(translatedPunct.includes(':-'), 'Punctuation :- must be preserved');
    console.log('✓ Numbers and punctuation preserved!\n');

    // -------------------------------------------------------------------------
    // PART 6: End-to-End DOCX In-Place Generation & XML Verification
    // -------------------------------------------------------------------------
    console.log('--- PART 6: Building Comprehensive Word DOCX Test Document ---');
    const docxParagraphs = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: 'STATION WORKING RULES OF KARJARA STATION', bold: true, size: 32 })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
                new TextRun({ text: "KARJARA Station is a 'B' class station on KIUL – GAYA B.G electrified section having dual VDU worked under Absolute Block System with Standard-II ELECTRONIC INTERLOCKING.", size: 24 })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: 'Adjacent Station and Holding Capacity:', bold: true, size: 24 })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: 'Adjacent Station is KIUL at Distance 15.50 km. Station Description shows Steepest Gradient 1 in 200.', size: 24 })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: 'Equipment codes: HASSDAC, MACLS, IBH, DSTE, CSTE, ECR, SIP, DNR, SM, VDU, MNP, ELB, EKT.', size: 24 })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
                new TextRun({ text: 'Track references: 505AXT, 505BXT, DP519A, ODP507A, S9AXT for UP Main Line and DN Loop Line.', size: 24 })
            ]
        })
    ];

    // Add a Table with Railway Data
    const docxTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Line No.', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Holding Capacity', bold: true })] })] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Line 1' })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'UP Loop Line' })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '686m (65 Vehicles)' })] })] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Line 2' })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'UP Main Line' })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '720m (68 Vehicles)' })] })] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Line 3' })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DN Main Line' })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '720m (68 Vehicles)' })] })] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Line 4' })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'DN Loop Line' })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '686m (65 Vehicles)' })] })] })
                ]
            })
        ]
    });

    const testDoc = new Document({
        sections: [{
            children: [
                ...docxParagraphs,
                new Paragraph({ text: '' }),
                docxTable
            ]
        }]
    });

    const docxBuffer = await Packer.toBuffer(testDoc);
    fs.writeFileSync('test_complete_source.docx', docxBuffer);
    console.log(`✓ Created test_complete_source.docx (${docxBuffer.length} bytes)`);

    console.log('\n--- PART 7: Transforming DOCX to Kruti Dev 010 Legacy In-Place ---');
    const krutiDocxBuffer = await transformDocxBuffer(docxBuffer, { mode: 'krutidev' });
    fs.writeFileSync('test_complete_krutidev.docx', krutiDocxBuffer);
    console.log(`✓ Created test_complete_krutidev.docx (${krutiDocxBuffer.length} bytes)`);

    console.log('\n--- PART 8: Transforming DOCX to Hindi Unicode In-Place ---');
    const unicodeDocxBuffer = await transformDocxBuffer(docxBuffer, { mode: 'unicode' });
    fs.writeFileSync('test_complete_unicode.docx', unicodeDocxBuffer);
    console.log(`✓ Created test_complete_unicode.docx (${unicodeDocxBuffer.length} bytes)`);

    // -------------------------------------------------------------------------
    // PART 9: Rigorous XML Inspection & Zero-English Validation Gate
    // -------------------------------------------------------------------------
    console.log('\n--- PART 9: Inspecting XML Content of Generated Documents ---');
    const krutiZip = await JSZip.loadAsync(krutiDocxBuffer);
    const krutiXml = await krutiZip.file('word/document.xml').async('text');

    const unicodeZip = await JSZip.loadAsync(unicodeDocxBuffer);
    const unicodeXml = await unicodeZip.file('word/document.xml').async('text');

    // Parse Unicode document XML to extract plain text
    const dom = new DOMParser().parseFromString(unicodeXml, 'text/xml');
    const allP = Array.from(dom.getElementsByTagName('w:p'));
    const docLines = allP.map(p => {
        const tNodes = Array.from(p.getElementsByTagName('w:t'));
        return tNodes.map(t => t.textContent).join('');
    }).filter(t => t.trim().length > 0);

    const fullDocText = docLines.join('\n');
    console.log('\n--- Extracted Document Text (Hindi Unicode Master) ---');
    console.log(fullDocText);
    console.log('------------------------------------------------------\n');

    // Quality Auditor Check
    const quality = checkTranslationQuality(fullDocText, { preserveRoman: true });
    console.log('Translation Quality Auditor Result:');
    console.log('  isValid:              ', quality.isValid);
    console.log('  untranslatedWordCount:', quality.untranslatedWordCount);
    console.log('  untranslatedWords:    ', quality.untranslatedWords);
    assert.strictEqual(quality.isValid, true, `Document must have 0 untranslated English words. Found: ${quality.untranslatedWords.join(', ')}`);
    console.log('✓ Zero untranslated English words in generated document!\n');

    // Word Spacing Assertions: ensure no glued words
    assert.ok(!fullDocText.includes('करजरास्टेशन'), 'Should not have joined words: करजरास्टेशन');
    assert.ok(!fullDocText.includes('निरपेक्षब्लॉक'), 'Should not have joined words: निरपेक्षब्लॉक');
    assert.ok(!fullDocText.includes('प्रणालीके'), 'Should not have joined words: प्रणालीके');
    assert.ok(!fullDocText.includes('ब्लॉकप्रणाली'), 'Should not have joined words: ब्लॉकप्रणाली');
    assert.ok(!fullDocText.includes('स्टेशनका'), 'Should not have joined words: स्टेशनका');
    assert.ok(fullDocText.includes('करजरा स्टेशन'), 'Should have proper spacing: करजरा स्टेशन');
    assert.ok(fullDocText.includes('निरपेक्ष ब्लॉक प्रणाली के अंतर्गत'), 'Should have proper spacing: निरपेक्ष ब्लॉक प्रणाली के अंतर्गत');
    assert.ok(fullDocText.includes('वी.डी.यू.'), 'Abbreviations must have dots preserved without spaces inside: वी.डी.यू.');
    assert.ok(!fullDocText.includes('वी. डी. यू.'), 'Abbreviations must not have spaces inside: वी. डी. यू.');
    console.log('✓ Word spacing checks 100% verified!\n');

    // Kruti Dev Font and Encoding Assertions in XML
    assert.ok(krutiXml.includes('w:ascii="Kruti Dev 010"'), 'Kruti Dev DOCX must assign Kruti Dev 010 font to Hindi text');
    assert.ok(krutiXml.includes('w:ascii="Times New Roman"'), 'Kruti Dev DOCX must assign Times New Roman font to Roman numerals and numbers');
    assert.ok(krutiXml.includes('ekud') && krutiXml.includes('II'), 'Roman numeral II and ekud must be preserved');
    console.log('✓ Kruti Dev 010 encoding and dual-font tagging 100% verified!\n');

    console.log('================================================================');
    console.log('🎉 ALL VERIFICATION SUITE TESTS PASSED WITH ZERO ERRORS!');
    console.log('================================================================\n');
}

runCompleteSuite().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
