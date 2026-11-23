import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const rows = JSON.parse(await readFile(new URL('data/spots.json', root), 'utf8'));
const fields = [...new Set(rows.flatMap(Object.keys))];
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const value = (v, key) => v == null ? 'NULL' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : key === 'tags' ? `ARRAY[${v.map(quote).join(',')}]::text[]` : key === 'extra_sources' ? quote(JSON.stringify(v)) + '::jsonb' : typeof v === 'number' ? String(v) : quote(v);
const sql = `-- Researched on 2026-10-10. Only trip_rand_spots is changed.\nBEGIN;\nINSERT INTO public.trip_rand_spots (${fields.join(',')}) VALUES\n${rows.map(row => '(' + fields.map(key => value(row[key], key)).join(',') + ')').join(',\n')}\nON CONFLICT (slug) DO UPDATE SET ${fields.filter(f => f !== 'slug').map(f => `${f}=EXCLUDED.${f}`).join(',')}, updated_at=now();\nCOMMIT;\nSELECT prefecture, count(*) FROM public.trip_rand_spots GROUP BY prefecture ORDER BY prefecture;\n`;
await writeFile(new URL('seed.sql', root), sql);
console.log(`seed.sql: ${rows.length} spots`);
