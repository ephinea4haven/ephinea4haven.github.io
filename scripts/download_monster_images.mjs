import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const run = promisify(execFile);
const pages = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const output = 'assets/img/monsters/wiki';
await fs.mkdir(output, {recursive:true});
const images = {};
for (let i = 0; i < pages.length; i += 4) {
  await Promise.all(pages.slice(i, i + 4).map(async page => {
    const info = page.imageinfo[0];
    const file = `${output}/${info.sha1.slice(0,16)}.png`;
    try { await fs.access(file); } catch { await run('curl', ['-fLsS','--retry','3','--retry-all-errors','--connect-timeout','15','--max-time','45',info.url,'-o',file]); }
    const bytes = await fs.readFile(file);
    if (createHash('sha1').update(bytes).digest('hex') !== info.sha1 || !bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) throw new Error(`Invalid image ${page.title}`);
    images[page.title.slice(5,-4)] = {path:`/${file}`, source:info.url, page:info.descriptionurl, sha1:info.sha1, width:info.width, height:info.height};
  }));
  console.log(`Images: ${Math.min(i+4,pages.length)}/${pages.length}`);
}
await fs.writeFile('content/monster-catalog/images.json', JSON.stringify(Object.fromEntries(Object.entries(images).sort()),null,2)+'\n');
