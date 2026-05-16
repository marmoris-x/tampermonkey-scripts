const https = require('https'), http = require('http'), fs = require('fs');
const path = 'C:/Dev/Projects/tampermonkey-scripts/dist/Reddit Content Unlocker.user.js';
const serve = (res) => { res.writeHead(200,{'Content-Type':'application/javascript'}); res.end(fs.readFileSync(path,'utf-8')); };
// Try HTTPS first (self-signed)
try {
  const key = fs.readFileSync('C:/Users/morte/.claude/localhost-key.pem');
  const cert = fs.readFileSync('C:/Users/morte/.claude/localhost-cert.pem');
  https.createServer({key,cert}, (req,res) => serve(res)).listen(3334, () => console.log('HTTPS on :3334'));
} catch(e) { console.log('No certs, using HTTP'); }
http.createServer((req,res) => serve(res)).listen(3333, () => console.log('HTTP on :3333'));
