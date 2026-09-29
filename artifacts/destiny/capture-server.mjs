import http from 'node:http';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory = resolve('artifacts/destiny/source');
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/save' && req.headers.origin === 'http://127.0.0.1:18769') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 10000000) { res.writeHead(413); res.end(); return; } }
    const form = new URLSearchParams(body);
    const name = form.get('name');
    if (!/^[a-z0-9-]+\.html$/.test(name ?? '')) { res.writeHead(400); res.end('Invalid filename'); return; }
    await writeFile(resolve(directory, name), form.get('html') ?? '');
    res.end('Saved ' + name);
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><title>Destiny local capture</title><form method="post" action="/save"><label>Filename <input name="name"></label><label>Page HTML <textarea name="html"></textarea></label><button>Save locally</button></form>');
}).listen(18769, '127.0.0.1');
