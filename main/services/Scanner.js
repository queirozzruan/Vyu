const fs = require('fs/promises');
const path = require('path');
const { isSupportedExtension } = require('../utils/FileUtils');

async function walkSupportedFiles(directoryPath, collector) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(directoryPath, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkSupportedFiles(absolute, collector);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (isSupportedExtension(ext)) {
      collector.push(absolute);
    }
  }
}

module.exports = { walkSupportedFiles };
