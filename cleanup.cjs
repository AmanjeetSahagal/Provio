const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Remove dark: classes
      content = content.replace(/dark:[a-zA-Z0-9-\[\]_#]+ /g, '');
      content = content.replace(/dark:[a-zA-Z0-9-\[\]_#]+"/g, '"');
      content = content.replace(/dark:[a-zA-Z0-9-\[\]_#]+'/g, "'");
      content = content.replace(/dark:[a-zA-Z0-9-\[\]_#]+`/g, '`');
      
      // Replace bg-white with bg-vt-cream
      content = content.replace(/bg-white/g, 'bg-vt-cream');
      
      // Replace text-white with text-vt-cream (except in selection:text-white which we already fixed in index.css, but let's just replace it)
      content = content.replace(/text-white/g, 'text-vt-cream');

      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir(path.join(__dirname, 'src'));
console.log('Done cleaning up classes');
