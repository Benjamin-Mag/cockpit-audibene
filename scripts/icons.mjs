// Génère public/icons/icon{16,48,128}.png (jauge blanche sur carré arrondi bleu #1B4F9B),
// sans dépendance : encodeur PNG minimal + rendu par sur-échantillonnage.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
const png = (w, h, rgba) => {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
};

const BG = [27, 79, 155];
const FG = [255, 255, 255];
const deg = (a) => (a * Math.PI) / 180;

// Couleur d'un point (u,v) dans [0,1]² ; null = transparent.
function shade(u, v) {
  const r = 0.22;
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0);
  const dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
  if (Math.hypot(dx, dy) > r) return null;
  const cx = 0.5, cy = 0.56;
  const d = Math.hypot(u - cx, v - cy);
  const ang = Math.atan2(-(v - cy), u - cx);
  const arc = d > 0.245 && d < 0.325 && ang > deg(-25) && ang < deg(205);
  const na = deg(55);
  const px = u - cx, py = -(v - cy);
  const along = px * Math.cos(na) + py * Math.sin(na);
  const across = Math.abs(-px * Math.sin(na) + py * Math.cos(na));
  const needle = along > 0 && along < 0.27 && across < 0.035;
  const hub = d < 0.07;
  return arc || needle || hub ? FG : BG;
}

function render(size) {
  const S = 4;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const c = shade((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
    }
    const n = S * S, i = (y * size + x) * 4;
    const cov = a / n;
    buf[i] = cov ? Math.round(r / (a / 255)) : 0;
    buf[i + 1] = cov ? Math.round(g / (a / 255)) : 0;
    buf[i + 2] = cov ? Math.round(b / (a / 255)) : 0;
    buf[i + 3] = Math.round(cov);
  }
  return png(size, size, buf);
}

mkdirSync('public/icons', { recursive: true });
for (const s of [16, 48, 128]) writeFileSync(`public/icons/icon${s}.png`, render(s));
console.log('icônes générées : public/icons/icon{16,48,128}.png');
