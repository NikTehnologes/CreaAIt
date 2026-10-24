// Необязательный локальный сервер. Саму игру можно открыть и обычным HTML-файлом.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const root = path.dirname(fileURLToPath(import.meta.url));
const portIndex = process.argv.indexOf('--port');
const port = portIndex === -1 ? 8080 : Number(process.argv[portIndex + 1]);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.png': 'image/png', '.json': 'application/json; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  try {
    let name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (name === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    if (name === '/') name = '/3D_прототип.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end('Файл не найден');
  }
});
server.listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
