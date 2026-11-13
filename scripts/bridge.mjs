// Dev-only bridge: serves dist/ bundles to a dash.cloudflare.com preview tab and
// accepts page dumps into real-dom/. Listens on localhost only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 47831;
const ALLOWED_ORIGIN = 'https://dash.cloudflare.com';
const root = path.resolve(process.argv[2] ?? 'dist');
const dumpDir = path.resolve(process.argv[3] ?? 'real-dom');

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/dump') {
      const name = path.basename(url.searchParams.get('name') ?? 'dump.txt');
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        fs.mkdirSync(dumpDir, { recursive: true });
        fs.writeFileSync(path.join(dumpDir, name), Buffer.concat(chunks));
        res.end('ok');
      });
      return;
    }
    fs.readFile(path.join(root, path.basename(url.pathname)), (error, body) => {
      if (error) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      res.end(body);
    });
  })
  .listen(PORT, '127.0.0.1', () => process.stdout.write(`LISTENING ${PORT}\n`));
