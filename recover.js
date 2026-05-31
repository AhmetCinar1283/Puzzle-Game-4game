const fs = require('fs');
const path = require('path');

const nextDir = 'c:\\Users\\ahmet\\Desktop\\Projects\\myReactApps\\know-and-conquer\\.next';

function walkDir(dir, callback) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath, callback);
      } else {
        callback(filePath);
      }
    }
  } catch (err) {}
}

const found = [];

walkDir(nextDir, (filePath) => {
  const ext = path.extname(filePath);
  if (['.js', '.map', '.json'].includes(ext)) {
    if (filePath.includes('lock')) return; // skip lock files
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('AdminUserProfileWorkspace')) {
        console.log('MATCH FOUND:', filePath, 'size:', content.length);
        found.push({ filePath, content });
      }
    } catch (e) {}
  }
});

if (found.length > 0) {
  // Let's analyze the first match.
  // If it's a source map (.map), it contains the exact original source code!
  for (const item of found) {
    if (item.filePath.endsWith('.map')) {
      try {
        const json = JSON.parse(item.content);
        if (json.sourcesContent) {
          for (let i = 0; i < json.sources.length; i++) {
            const src = json.sources[i];
            if (src.includes('page.tsx') && src.includes('users')) {
              const srcContent = json.sourcesContent[i];
              if (srcContent && srcContent.includes('AdminUserProfileWorkspace')) {
                console.log('FOUND ORIGINAL SOURCE IN SOURCE MAP!', src);
                fs.writeFileSync('c:\\Users\\ahmet\\Desktop\\Projects\\myReactApps\\know-and-conquer\\app\\admin\\users\\[uid]\\AdminUserProfileClient.tsx', srcContent, 'utf8');
                console.log('RESTORED SUCCESSFULLY!');
                process.exit(0);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse source map:', e);
      }
    }
  }

  // If no source map worked, let's print some info about other matches
  console.log('No direct source map restoration succeeded.');
} else {
  console.log('No matches found in .next directory.');
}
