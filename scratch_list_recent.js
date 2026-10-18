import fs from 'fs';
import path from 'path';

function listRecent(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).map(f => {
    try {
      const stat = fs.statSync(path.join(dir, f));
      return { name: f, size: stat.size, mtime: stat.mtime };
    } catch {
      return null;
    }
  }).filter(Boolean);
  files.sort((a, b) => b.mtime - a.mtime);
  console.log(`\n=== RECENT IN ${dir} ===`);
  files.slice(0, 15).forEach(f => {
    console.log(`${f.mtime.toISOString()} | ${f.size} bytes | ${f.name}`);
  });
}

listRecent('C:/Users/sadiy/Downloads');
listRecent('C:/Users/sadiy/OneDrive/Desktop');
