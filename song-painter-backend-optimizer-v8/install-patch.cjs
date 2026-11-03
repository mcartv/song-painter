#!/usr/bin/env node
// Song Painter optimized backend v8; exact v7 file guard, backups, atomic writes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = process.cwd();
const rel = 'backend/modal_app.py';
const file = path.join(base, rel);
const backup = path.join(base, '.song-painter-patch-backup', 'backend-v8', 'modal_app.py');
const expected = 'aa5b92525277e0d7c0bae6a4a743382ff2d8580a8e72e13699a099d65bf7a267';
const src = path.join(__dirname, 'backend', 'modal_app.py');
const marker = 'Song Painter analysis service (optimized v8)';
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const mode = process.argv[2];
function fail(x){console.error('Patch v8: ' + x);process.exit(1)}
if (!['--check','--install','--undo'].includes(mode)) fail('use --check, --install, or --undo');
if (!fs.existsSync(file)) fail('backend/modal_app.py missing. Install patch v7 first.');
const existing = fs.readFileSync(file);
if (mode === '--undo') {
  if (!fs.existsSync(backup)) fail('No v8 backup exists.');
  if (!existing.toString().includes(marker)) fail('Current file is not v8; refusing to overwrite changes.');
  fs.writeFileSync(file, fs.readFileSync(backup));
  console.log('Patch v8: restored v7 backend file.');
  process.exit(0);
}
if (existing.toString().includes(marker)) {
  if (mode === '--check') {console.log('Patch v8 already installed.');process.exit(0)}
  fail('already installed');
}
if (hash(existing) !== expected) fail('Backend differs from the original v7 package. No files changed; review changes before installing.');
if (mode === '--check') {console.log('Patch v8: Dry run PASS. No files changed.');process.exit(0)}
if (fs.existsSync(backup)) fail('Backup already exists; refusing to overwrite it.');
fs.mkdirSync(path.dirname(backup), {recursive:true});
fs.copyFileSync(file, backup);
const temp = file + '.v8-tmp';
try {fs.writeFileSync(temp, fs.readFileSync(src));fs.renameSync(temp,file)}
catch(e){try{fs.rmSync(temp,{force:true})}catch{};fs.copyFileSync(backup,file);fail(e.message)}
console.log('Patch v8 installed. Your original backend is backed up.');
