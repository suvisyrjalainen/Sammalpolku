// No external packages. Run: node server.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function createGameServer(dataFile = path.join(__dirname, 'data', 'scores.json')) {
  function readScores(file = dataFile) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  function json(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;
      const scoresFile = url.searchParams.get('mode') === 'test' ? dataFile + '.test' : dataFile;
      if (pathname === '/api/scores' && req.method === 'GET') return json(res, 200, readScores(scoresFile));
      if (pathname === '/api/scores' && req.method === 'POST') {
        const chunks = []; let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 2048) { json(res, 413, { error: 'Liian suuri pyyntö' }); req.resume(); return; }
          chunks.push(chunk);
        }
        let record;
        try { record = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { error: 'Virheellinen tulos' }); }
        if (!record || typeof record.name !== 'string' || !record.name.trim() || record.name.trim().length > 24
          || !Number.isSafeInteger(record.timeMs) || record.timeMs <= 0 || record.timeMs > 604800000) {
          return json(res, 400, { error: 'Virheellinen nimimerkki tai aika' });
        }
        const scores = readScores(scoresFile);
        scores.push({ name: record.name.trim(), timeMs: record.timeMs });
        scores.sort((a,b) => a.timeMs - b.timeMs);
        fs.mkdirSync(path.dirname(scoresFile), { recursive: true });
        const temporary = scoresFile + '.tmp';
        fs.writeFileSync(temporary, JSON.stringify(scores.slice(0, 10), null, 2), 'utf8');
        fs.renameSync(temporary, scoresFile);
        return json(res, 201, { saved: true });
      }
      if ((pathname === '/' || pathname === '/index.html') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
      }
      json(res, 404, { error: 'Sivua ei löydy' });
    } catch (error) {
      console.error('Palvelinvirhe:', error.message);
      if (!res.headersSent) json(res, 500, { error: 'Palvelin ei voinut käsitellä pyyntöä' });
      else res.end();
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createGameServer(process.env.SCORES_FILE).listen(port, '0.0.0.0', () => {
    console.log(`Sammalpolku: http://localhost:${port}`);
  });
}
module.exports = { createGameServer };
