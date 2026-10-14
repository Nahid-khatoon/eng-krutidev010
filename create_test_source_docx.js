import fs from 'fs';
import { Document, Paragraph, TextRun, AlignmentType, Packer } from 'docx';

async function createTestSourceDocx() {
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440, // 1 inch
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    }
                },
                children: [
                    // 1. One centered heading in Bold
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: "NORTHERN RAILWAY HEADQUARTERS",
                                bold: true,
                                size: 32
                            })
                        ]
                    }),

                    // 2. One left-aligned paragraph
                    new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: [
                            new TextRun({
                                text: "Duties of Station Master and Loco Pilot on line clear procedure.",
                                size: 24
                            })
                        ]
                    }),

                    // 3. One justified paragraph
                    new Paragraph({
                        alignment: AlignmentType.JUSTIFIED,
                        children: [
                            new TextRun({
                                text: "The Station Master must verify that track circuit 505AXT and 505BXT are clear before giving Line Clear. Point machine DP519A and DP519B must remain detected normal. Verify crossover clearance on ODP507A and S9AXT.",
                                size: 24
                            })
                        ]
                    }),

                    // 4. One underlined sentence
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This safety instruction must be strictly complied with by all operating staff.",
                                underline: {},
                                size: 24
                            })
                        ]
                    }),

                    // 5. One paragraph containing Roman numerals I, II, III and (iv)
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Refer Chapter VI and Sections I, II, III with special safety clause (iv) of the operating manual.",
                                size: 24
                            })
                        ]
                    }),

                    // 6. One paragraph containing 6.02(iv), 117/2025 and 22-07-2026
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Safety Circular No. 117/2025 dated 22-07-2026 under General Rules para 6.02(iv).",
                                size: 24
                            })
                        ]
                    }),

                    // 7. One paragraph containing English text that will convert to Kruti Dev 010 Hindi
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Date of Issue: 22-07-2026. Station Working Rules and Signal Clearance Procedure.",
                                size: 24
                            })
                        ]
                    }),

                    // 8. One paragraph with mixed character runs (bold, normal, bold+underline)
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "NOTE: ",
                                bold: true,
                                size: 24
                            }),
                            new TextRun({
                                text: "Comply strictly with sub-clause ",
                                size: 24
                            }),
                            new TextRun({
                                text: "(iv)",
                                bold: true,
                                underline: {},
                                size: 24
                            }),
                            new TextRun({
                                text: " and Chapter VI.",
                                size: 24
                            })
                        ]
                    })
                ]
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync('test_formatting_source.docx', buffer);
    console.log('Successfully created test_formatting_source.docx (', buffer.length, 'bytes)');
}

createTestSourceDocx();
