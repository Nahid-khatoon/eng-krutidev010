import fs from 'fs';

const p = 'C:/Users/sadiy/OneDrive/Desktop/test.docx';
console.log('Exists:', fs.existsSync(p));
if (fs.existsSync(p)) {
  const stat = fs.statSync(p);
  console.log('Size:', stat.size, 'Mtime:', stat.mtime);
}
