import fs from 'fs';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { transformDocxBuffer } from './src/services/docxGenerator.js';

const TEST_PARAGRAPHS = [
    "ब्रॉड गेज",
    "जारी करने की तारीख......",
    "बलपूर्वक लाया गया......",
    "2.5.1 रनिंग लाइन्स, गति की दिशा और सीएसआर",
    "(a) UP Main Line (Line No. 2)",
    "(b) UP Loop Line (Line No. 1)",
    "(c) DN Main Line (Line No. 3)",
    "(d) DN Loop Line (Line No. 4)",
    "Chapter VI para 6.02(iv)",
    "Date: 22.07.2026"
];

async function generateFinalTestDocx() {
    console.log('Generating final test source document...');

    const paragraphs = [];
    for (const text of TEST_PARAGRAPHS) {
        paragraphs.push(new Paragraph({
            children: [
                new TextRun({
                    text,
                    size: 24
                })
            ]
        }));
    }

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                    }
                },
                children: paragraphs
            }
        ]
    });

    const sourceBuffer = await Packer.toBuffer(doc);
    fs.writeFileSync('final_test_source.docx', sourceBuffer);
    console.log('Created final_test_source.docx (', sourceBuffer.length, 'bytes)');

    // Now transform to Kruti Dev 010 DOCX
    console.log('Transforming to Kruti Dev 010 DOCX...');
    const krutiBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'krutidev' });
    fs.writeFileSync('final_test_krutidev.docx', krutiBuffer);
    console.log('Created final_test_krutidev.docx (', krutiBuffer.length, 'bytes)');

    // Also transform to Unicode DOCX
    console.log('Transforming to Hindi Unicode DOCX...');
    const unicodeBuffer = await transformDocxBuffer(sourceBuffer, { mode: 'unicode' });
    fs.writeFileSync('final_test_unicode.docx', unicodeBuffer);
    console.log('Created final_test_unicode.docx (', unicodeBuffer.length, 'bytes)');
}

generateFinalTestDocx().catch(err => {
    console.error('Error generating final test docx:', err);
    process.exit(1);
});
