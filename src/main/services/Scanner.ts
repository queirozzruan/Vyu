import fs from 'node:fs/promises';
import path from 'node:path';
import { isSupportedExtension } from '../utils/FileUtils';

export async function walkSupportedFiles(directoryPath: string, collector: string[]): Promise<void> {
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
