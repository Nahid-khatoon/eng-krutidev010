import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import fs from 'fs';

async function generateSampleDocx() {
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: [
                        new TextRun({ text: "NORTHERN RAILWAY SAFETY INSTRUCTIONS", bold: true, size: 32 })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Date of Issue:- 22-07-2026", bold: true, underline: {} })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "1. Station Master and Loco Pilot Duties:\n" }),
                        new TextRun({ text: "The Station Master must verify that track circuit 505AXT and 505BXT are clear before giving Line Clear.\n" }),
                        new TextRun({ text: "Point machine DP519A and DP519B must remain detected normal.\n" }),
                        new TextRun({ text: "Refer Chapter VI para 6.02(iv) and Section/Line crossover rules." })
                    ]
                })
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync('sample_railway_test.docx', buffer);
    console.log('sample_railway_test.docx created successfully!');
}

generateSampleDocx();
