import fs from 'fs';
import path from 'path';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { transformDocxBuffer } from './src/services/docxGenerator.js';

async function generateTestDocx() {
    const paragraphs = [
        "G & SR 4.65",
        "G.R. 5.23",
        "S.R. 5.19(5)(a)",
        "T/369",
        "signals, points etc.",
        "other equipment etc.",
        "Chapter VI para 6.02(iv)",
        "T",
        "G",
        "505AXT",
        "505BXT",
        "DP519A",
        "SR",
        "GR",
        "G and SR",
        "ETC",
        "etc.",
        "(a) First rule instruction.",
        "(b) Second rule instruction.",
        "(i) Roman rule item."
    ];

    const doc = new Document({
        sections: [{
            properties: {},
            children: paragraphs.map(p => new Paragraph({
                children: [new TextRun({ text: p, size: 24, font: 'Calibri' })]
            }))
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const sourcePath = path.resolve('test_user_examples_source.docx');
    fs.writeFileSync(sourcePath, buffer);
    console.log(`Created source DOCX: ${sourcePath} (${buffer.length} bytes)`);

    // Transform into Kruti Dev 010 DOCX
    const krutiBuffer = await transformDocxBuffer(buffer, { mode: 'krutidev', preserveRoman: true });
    const krutiPath = path.resolve('test_user_examples_krutidev.docx');
    fs.writeFileSync(krutiPath, krutiBuffer);
    console.log(`Created Kruti Dev 010 DOCX: ${krutiPath} (${krutiBuffer.length} bytes)`);

    // Transform into Hindi Unicode DOCX
    const unicodeBuffer = await transformDocxBuffer(buffer, { mode: 'unicode', preserveRoman: true });
    const unicodePath = path.resolve('test_user_examples_unicode.docx');
    fs.writeFileSync(unicodePath, unicodeBuffer);
    console.log(`Created Hindi Unicode DOCX: ${unicodePath} (${unicodeBuffer.length} bytes)`);
}

generateTestDocx().catch(err => {
    console.error("Error generating DOCX:", err);
    process.exit(1);
});
