import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
const run = promisify(execFile);
const pages = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const output = 'assets/img/monsters/wiki';
await fs.mkdir(output, {recursive:true});
const images = {};
const valid = (bytes, sha1) => createHash('sha1').update(bytes).digest('hex') === sha1 && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
for (let i = 0; i < pages.length; i += 4) {
  await Promise.all(pages.slice(i, i + 4).map(async page => {
    const info = page.imageinfo[0];
    const file = `${output}/${info.sha1.slice(0,16)}.png`;
    const cached = await fs.readFile(file).catch(error => {if(error.code==='ENOENT') return null; throw error;});
    if (!cached || !valid(cached,info.sha1)) {
      const temporary = `${file}.${randomUUID()}.part`;
      try {
        await run('curl', ['-fLsS','--retry','3','--retry-all-errors','--connect-timeout','15','--max-time','45',info.url,'-o',temporary]);
        if (!valid(await fs.readFile(temporary),info.sha1)) throw new Error(`Invalid image ${page.title}`);
        await fs.rename(temporary,file);
      } finally {await fs.rm(temporary,{force:true});}
    }
    images[page.title.slice(5,-4)] = {path:`/${file}`, source:info.url, page:info.descriptionurl, sha1:info.sha1, width:info.width, height:info.height};
  }));
  console.log(`Images: ${Math.min(i+4,pages.length)}/${pages.length}`);
}
const manifest='content/monster-catalog/images.json';
const temporary=`${manifest}.${randomUUID()}.part`;
try {
  await fs.writeFile(temporary, JSON.stringify(Object.fromEntries(Object.entries(images).sort()),null,2)+'\n');
  await fs.rename(temporary,manifest);
} finally {await fs.rm(temporary,{force:true});}
