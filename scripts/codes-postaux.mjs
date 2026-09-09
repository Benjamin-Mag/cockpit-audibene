// Génère public/data/codes-postaux.json : code postal → [latitude, longitude]
// (moyenne des communes qui partagent le code postal), à partir de la « Base
// officielle des codes postaux » de La Poste (Licence Ouverte 2.0), lue sur le
// portail Datanova de La Poste (le CSV publié sur data.gouv.fr n'a plus de colonne
// de coordonnées ; l'API Datanova expose le centroïde de chaque commune, _geopoint).
//
// À rejouer quand la base change :  node scripts/codes-postaux.mjs
// Sans réseau, avec un CSV déjà téléchargé (colonnes code_postal + _geopoint ou lat/lon) :
//   node scripts/codes-postaux.mjs chemin/vers/base.csv
//
// Le téléchargement n'a lieu qu'ici, à la construction — jamais dans l'extension.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE = {
  editeur: 'La Poste',
  jeu: 'Base officielle des codes postaux',
  page: 'https://www.data.gouv.fr/fr/datasets/base-officielle-des-codes-postaux/',
  url: 'https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/lines?select=code_postal,_geopoint&size=10000',
  licence: 'Licence Ouverte / Open Licence 2.0 (Etalab)',
};
const OUT = fileURLToPath(new URL('../public/data/codes-postaux.json', import.meta.url));

/** Lit toutes les lignes (code postal, "lat,lon") via l'API paginée de Datanova. */
async function fetchLines() {
  const rows = [];
  let url = SOURCE.url;
  let pages = 0;
  while (url) {
    console.log(`Téléchargement : ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    const json = await res.json();
    for (const r of json.results ?? []) rows.push([r.code_postal, r._geopoint]);
    url = json.results?.length && json.next && json.next !== url ? json.next : null;
    if (++pages > 20) throw new Error('Trop de pages : pagination suspecte.');
  }
  return rows;
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

/** Lit un CSV local : renvoie des paires [code postal, "lat,lon"]. */
function csvLines(csv) {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = splitLine(lines[0], sep).map((h) => h.replace(/^#/, '').toLowerCase());
  const find = (re) => header.findIndex((h) => re.test(h));
  const iCp = find(/code_?postal/);
  const iGeo = find(/geopoint|geo_point|coordonn/);
  const iLat = find(/^lat/);
  const iLon = find(/^lon|^lng/);
  if (iCp === -1 || (iGeo === -1 && (iLat === -1 || iLon === -1))) throw new Error(`Colonnes introuvables dans l'en-tête : ${header.join(' | ')}`);
  return lines.slice(1).map((line) => {
    const c = splitLine(line, sep);
    return [c[iCp], iGeo !== -1 ? c[iGeo] : `${c[iLat]},${c[iLon]}`];
  });
}

function build(rows) {
  const acc = new Map(); // cp → { lat, lon, n }
  let lus = 0;
  let sansCoords = 0;
  for (const [cpRaw, geo] of rows) {
    const cp = String(cpRaw || '').padStart(5, '0');
    if (!/^\d{5}$/.test(cp)) continue;
    lus++;
    const [lat, lon] = String(geo || '').split(/[,;\s]+/).map(Number);
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
const rows = local ? csvLines(await readFile(local, 'utf8')) : await fetchLines();
const { lus, sansCoords, cp } = build(rows);
const json = {
  _source: {
    ...SOURCE,
    date: new Date().toISOString().slice(0, 10),
    ...(local ? { fichierLocal: local } : {}),
    lignesLues: lus,
    lignesSansCoordonnees: sansCoords,
    codesPostaux: Object.keys(cp).length,
    format: 'cp → [latitude, longitude] (3 décimales, moyenne des centroïdes des communes du code postal)',
  },
  cp,
};
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
const text = JSON.stringify(json);
await writeFile(OUT, text);
console.log(`${Object.keys(cp).length} codes postaux (${lus} lignes lues, ${sansCoords} sans coordonnées) → ${OUT} (${(text.length / 1024).toFixed(0)} Ko)`);
