// Génère public/data/codes-postaux.json : code postal → [latitude, longitude]
// (moyenne des communes qui partagent le code postal), à partir de la « Base
// officielle des codes postaux » de La Poste (data.gouv.fr, Licence Ouverte 2.0).
//
// À rejouer quand la base change :  node scripts/codes-postaux.mjs
// Sans réseau, avec un CSV déjà téléchargé :  node scripts/codes-postaux.mjs chemin/vers/base.csv
//
// Le téléchargement n'a lieu qu'ici, à la construction — jamais dans l'extension.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE = {
  editeur: 'La Poste',
  jeu: 'Base officielle des codes postaux',
  page: 'https://www.data.gouv.fr/fr/datasets/base-officielle-des-codes-postaux/',
  url: 'https://www.data.gouv.fr/api/1/datasets/r/008a2dda-2c60-4b63-b910-998f6f818089',
  licence: 'Licence Ouverte / Open Licence 2.0 (Etalab)',
};
const OUT = fileURLToPath(new URL('../public/data/codes-postaux.json', import.meta.url));

async function readCsv(localPath) {
  if (localPath) return readFile(localPath, 'utf8');
  console.log(`Téléchargement : ${SOURCE.url}`);
  const res = await fetch(SOURCE.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${SOURCE.url}`);
  return res.text();
}

/** Découpe une ligne CSV en respectant les guillemets. */
function splitLine(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === sep && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function build(csv) {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = splitLine(lines[0], sep).map((h) => h.replace(/^#/, '').toLowerCase());
  const find = (re) => header.findIndex((h) => re.test(h));
  const iCp = find(/code_?postal/);
  const iGeo = find(/geopoint|geo_point|coordonn/);
  const iLat = find(/^lat/);
  const iLon = find(/^lon|^lng/);
  if (iCp === -1 || (iGeo === -1 && (iLat === -1 || iLon === -1))) throw new Error(`Colonnes introuvables dans l'en-tête : ${header.join(' | ')}`);

  const acc = new Map(); // cp → { lat, lon, n }
  let lus = 0;
  let sansCoords = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, sep);
    const cp = (cells[iCp] || '').padStart(5, '0');
    if (!/^\d{5}$/.test(cp)) continue;
    lus++;
    let lat;
    let lon;
    if (iGeo !== -1) [lat, lon] = (cells[iGeo] || '').split(/[,;\s]+/).map(Number);
    else { lat = Number(cells[iLat]); lon = Number(cells[iLon]); }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) { sansCoords++; continue; }
    const a = acc.get(cp) ?? { lat: 0, lon: 0, n: 0 };
    a.lat += lat; a.lon += lon; a.n++;
    acc.set(cp, a);
  }
  const cp = {};
  for (const k of [...acc.keys()].sort()) {
    const a = acc.get(k);
    cp[k] = [Number((a.lat / a.n).toFixed(3)), Number((a.lon / a.n).toFixed(3))];
  }
  return { lus, sansCoords, cp };
}

const local = process.argv[2];
const { lus, sansCoords, cp } = build(await readCsv(local));
const json = {
  _source: { ...SOURCE, date: new Date().toISOString().slice(0, 10), ...(local ? { fichierLocal: local } : {}), lignesLues: lus, lignesSansCoordonnees: sansCoords, codesPostaux: Object.keys(cp).length, format: 'cp → [latitude, longitude] (3 décimales, moyenne des communes du code postal)' },
  cp,
};
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
const text = JSON.stringify(json);
await writeFile(OUT, text);
console.log(`${Object.keys(cp).length} codes postaux (${lus} lignes lues, ${sansCoords} sans coordonnées) → ${OUT} (${(text.length / 1024).toFixed(0)} Ko)`);
