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
      
      // Remove dark: classes more robustly
      content = content.replace(/dark:[a-zA-Z0-9-\[\]_#\/]+/g, '');
      
      // Clean up multiple spaces that might have been left
      content = content.replace(/  +/g, ' ');

      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir(path.join(__dirname, 'src'));
console.log('Done cleaning up remaining dark classes');
