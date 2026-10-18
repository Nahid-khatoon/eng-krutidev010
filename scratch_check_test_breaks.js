import fs from 'fs';
import JSZip from 'jszip';

async function checkBreaks() {
  const p = 'C:/Users/sadiy/OneDrive/Desktop/test.docx';
  const data = fs.readFileSync(p);
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file('word/document.xml').async('text');
  
  // Find all paragraphs and check which ones have lastRenderedPageBreak, pageBreakBefore, w:br type="page", or sectPr
  const pMatches = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  pMatches.forEach((pStr, idx) => {
    const hasLast = pStr.includes('lastRenderedPageBreak');
    const hasBr = pStr.includes('w:type="page"');
    const hasPbb = pStr.includes('pageBreakBefore');
    const text = (pStr.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('');
    if (hasLast || hasBr || hasPbb) {
      console.log(`P[${idx}] break: lastRendered=${hasLast}, br=${hasBr}, pbb=${hasPbb} | Text: "${text.slice(0, 80)}"`);
    }
  });
}

checkBreaks().catch(console.error);
