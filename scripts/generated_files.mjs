import fs from 'node:fs';
import path from 'node:path';

/** Validate first, then publish complete files; never erase live compiler inputs. */
export function generatedFiles() {
  const files = new Map();
  const directories = new Set();
  return {
    write(file, content) { files.set(path.resolve(file), Buffer.from(content)); },
    clean(directory) { directories.add(path.resolve(directory)); },
    commit() {
      for (const [file, content] of files) {
        let previous;
        try { previous = fs.readFileSync(file); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (previous?.equals(content)) continue;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const temporary = `${file}.generated-${process.pid}`;
        try {
          fs.writeFileSync(temporary, content);
          fs.renameSync(temporary, file);
        } finally {
          fs.rmSync(temporary, { force: true });
        }
      }
      const clean = directory => {
        if (!fs.existsSync(directory)) return;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            clean(file);
            if (!fs.readdirSync(file).length) fs.rmdirSync(file);
          } else if (!files.has(file)) fs.unlinkSync(file);
        }
      };
      // Routes and replacement files now exist before obsolete files disappear.
      for (const directory of directories) clean(directory);
    },
  };
}
