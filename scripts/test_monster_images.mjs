import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const script=path.resolve('scripts/download_monster_images.mjs');
const original=Object.values(JSON.parse(fs.readFileSync('content/monster-catalog/images.json','utf8')))[0];
const bytes=fs.readFileSync('.'+original.path);
test('image synchronization recovers interrupted cache and publishes only verified bytes',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'haven-monster-images-'));
  try {
    const file=path.join(root,'assets/img/monsters/wiki',original.sha1.slice(0,16)+'.png');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.mkdirSync(path.join(root,'content/monster-catalog'),{recursive:true});
    const source=path.join(root,'source.png');fs.writeFileSync(source,bytes);
    const input=path.join(root,'input.json');
    fs.writeFileSync(input,JSON.stringify([{title:'File:Fixture.png',imageinfo:[{url:pathToFileURL(source).href,descriptionurl:'https://wiki.pioneer2.net/w/File:Fixture.png',sha1:original.sha1,width:original.width,height:original.height}]}]));
    fs.writeFileSync(file,bytes.subarray(0,24));
    execFileSync(process.execPath,[script,input],{cwd:root});
    assert.deepEqual(fs.readFileSync(file),bytes);
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'content/monster-catalog/images.json')));
    assert.equal(manifest.Fixture.sha1,original.sha1);
    // Valid cache is usable without a remote response.
    fs.unlinkSync(source);
    execFileSync(process.execPath,[script,input],{cwd:root});
    assert.deepEqual(fs.readFileSync(file),bytes);
    // Bad downloaded data must not replace a cached file or publish a manifest.
    fs.writeFileSync(file,'partial');fs.writeFileSync(source,'not a PNG');
    const saved=fs.readFileSync(path.join(root,'content/monster-catalog/images.json'));
    assert.throws(()=>execFileSync(process.execPath,[script,input],{cwd:root,stdio:'pipe'}),/Invalid image/);
    assert.equal(fs.readFileSync(file,'utf8'),'partial');
    assert.deepEqual(fs.readFileSync(path.join(root,'content/monster-catalog/images.json')),saved);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
