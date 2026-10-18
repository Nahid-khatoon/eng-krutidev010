import fs from 'fs';
import JSZip from 'jszip';

async function checkDoc(p) {
  if (!fs.existsSync(p)) {
    console.log('NOT FOUND:', p);
    return;
  }
  const data = fs.readFileSync(p);
  const zip = await JSZip.loadAsync(data);
  const footers = Object.keys(zip.files).filter(k => k.startsWith('word/footer'));
  const headers = Object.keys(zip.files).filter(k => k.startsWith('word/header'));
  const xml = await zip.file('word/document.xml').async('text');
  const pageBreaks = (xml.match(/<w:br[^>]*w:type="page"/g) || []).length;
  const sectBreaks = (xml.match(/<w:sectPr/g) || []).length;
  const lastRendered = (xml.match(/<w:lastRenderedPageBreak/g) || []).length;
  console.log('\n=============================================');
  console.log('FILE:', p);
  console.log('Headers:', headers, 'Footers:', footers);
  console.log('PageBreaks (<w:br type="page">):', pageBreaks, 'SectPr:', sectBreaks, 'lastRenderedPageBreak:', lastRendered);
  
  for (const f of footers) {
    const txt = await zip.file(f).async('text');
    const raw = (txt.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(' ');
    console.log(`  Footer [${f}]: "${raw}"`);
  }
  for (const h of headers) {
    const txt = await zip.file(h).async('text');
    const raw = (txt.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join(' ');
    console.log(`  Header [${h}]: "${raw}"`);
  }
}

async function run() {
  await checkDoc('C:/Users/sadiy/OneDrive/Desktop/test.docx');
  await checkDoc('C:/Users/sadiy/Downloads/test_KrutiDev010_Formatted (31).docx');
  await checkDoc('C:/Users/sadiy/OneDrive/Desktop/WAZIRGANJ.docx');
  await checkDoc('C:/Users/sadiy/Downloads/SWR  WAZIRGANJ 22-01-2026.docx');
}
run().catch(console.error);
