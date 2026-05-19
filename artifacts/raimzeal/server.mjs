import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = parseInt(process.env.PORT || '3000', 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, 'dist', 'public');

const MIME = {
  '.html':        'text/html; charset=utf-8',
  '.js':          'application/javascript; charset=utf-8',
  '.mjs':         'application/javascript; charset=utf-8',
  '.css':         'text/css; charset=utf-8',
  '.json':        'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png':         'image/png',
  '.jpg':         'image/jpeg',
  '.jpeg':        'image/jpeg',
  '.gif':         'image/gif',
  '.svg':         'image/svg+xml',
  '.ico':         'image/x-icon',
  '.webp':        'image/webp',
  '.woff':        'font/woff',
  '.woff2':       'font/woff2',
  '.ttf':         'font/ttf',
  '.otf':         'font/otf',
  '.txt':         'text/plain; charset=utf-8',
  '.xml':         'text/xml; charset=utf-8',
  '.pdf':         'application/pdf',
};

function handleRequest(req, res) {
  const host = (req.headers['host'] || '').toLowerCase();

  // Canonical redirect: www → non-www (301 permanent)
  // NOTE: Only redirect if the apex domain A record is confirmed live.
  // When the apex domain has no DNS A record this redirect causes a hard
  // outage for all users (www resolves → redirects → apex DNS failure).
  // Re-enable this block once an A record for raimzeal.com (@ → 34.111.179.208)
  // is confirmed in the DNS panel.
  //
  // if (host.startsWith('www.')) {
  //   const bare = host.slice(4);
  //   res.writeHead(301, { Location: `https://${bare}${req.url}` });
  //   res.end();
  //   return;
  // }

  // Normalise: strip www prefix for robots/canonical header logic without redirecting
  const canonicalHost = host.startsWith('www.') ? host.slice(4) : host;
  void canonicalHost;

  // Override any platform-level noindex header
  res.setHeader('X-Robots-Tag', 'index, follow');

  let urlPath;
  try {
    urlPath = new URL(req.url, 'http://localhost').pathname;
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const filePath = path.join(DIST, urlPath);

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  tryServe(filePath, res, true);
}

function tryServe(filePath, res, spaFallback) {
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      tryServe(path.join(filePath, 'index.html'), res, spaFallback);
      return;
    }

    if (!err && stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      const isHtml = ext === '.html';

      res.setHeader('Content-Type', mime);
      res.setHeader(
        'Cache-Control',
        isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
      );
      res.writeHead(200);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    if (spaFallback) {
      const index = path.join(DIST, 'index.html');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.writeHead(200);
      fs.createReadStream(index).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });
}

http.createServer(handleRequest).listen(PORT, '0.0.0.0', () => {
  console.log(`RAIMZEAL static server listening on port ${PORT}`);
});
