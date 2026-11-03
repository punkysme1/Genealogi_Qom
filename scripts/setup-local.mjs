import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || path.resolve(app, '../../../Backup/Supabase/nasab/nasab-public-data.sql');
const sql = await fs.readFile(source, 'utf8');
const result = {};
for (const table of ['individuals', 'marriages']) {
  const marker = `INSERT INTO "public"."${table}"`;
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error(`Tabel ${table} tidak ditemukan dalam backup.`);
  const section = sql.slice(start);
  const header = section.match(/^INSERT INTO .*?\((.*?)\) VALUES/s);
  const columns = [...header[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const rows = []; let row = [], token = '', quoted = false, isString = false, inside = false;
  const push = () => { const s = token.trim(); row.push(isString ? token : s === 'NULL' ? null : s === 'true' ? true : s === 'false' ? false : Number(s)); token = ''; isString = false; };
  for (let i = header[0].length; i < section.length; i++) {
    const c = section[i];
    if (quoted) { if (c === "'" && section[i + 1] === "'") { token += "'"; i++; } else if (c === "'") quoted = false; else token += c; continue; }
    if (c === ';') break;
    if (c === '(') { inside = true; row = []; token = ''; continue; }
    if (!inside) continue;
    if (c === "'") { quoted = true; isString = true; token = ''; }
    else if (c === ',') push();
    else if (c === ')') { push(); if (row.length !== columns.length) throw new Error('Jumlah kolom backup tidak sesuai.'); rows.push(Object.fromEntries(columns.map((k, n) => [k, row[n]]))); inside = false; }
    else if (!isString || !/\s/.test(c)) token += c;
  }
  result[table] = rows;
}
const ids = new Set(result.individuals.map(p => p.id));
if (!ids.size || ids.size !== result.individuals.length || result.individuals.some(p => [p.father_id, p.mother_id].some(id => id && !ids.has(id))) || result.marriages.some(m => !ids.has(m.husband_id) || !ids.has(m.wife_id))) throw new Error('Referensi backup tidak lengkap.');
await fs.mkdir(path.join(app, '.local'), { recursive: true });
await fs.writeFile(path.join(app, '.local/nasab-seed.json'), JSON.stringify(result));
console.log(`Backup lokal siap: ${result.individuals.length} individu, ${result.marriages.length} pernikahan. Data tidak dimasukkan ke bundle produksi.`);
