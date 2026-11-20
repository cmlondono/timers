// Genera los iconos de la app (cerdito con cronómetro) sin dependencias externas.
// Uso: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG_TOP = '#ffc6da';
const BG_BOTTOM = '#f27ba6';
const CENTER = [35, 33]; // centro del dibujo en el lienzo de 64x64

// Capas en un lienzo de 64x64, dibujadas en orden.
const LAYERS = [
  // orejas
  { t: 'tri', p: [[14, 23], [13, 9], [24, 16]], round: 1.8, fill: '#f59ab9' },
  { t: 'tri', p: [[42, 23], [43, 9], [32, 16]], round: 1.8, fill: '#f59ab9' },
  // cabeza
  { t: 'circle', cx: 28, cy: 32, r: 19, fill: '#ffd6e4' },
  // mejillas
  { t: 'ellipse', cx: 15, cy: 37, rx: 4, ry: 2.5, fill: '#ff8fb3', op: 0.55 },
  { t: 'ellipse', cx: 41, cy: 37, rx: 4, ry: 2.5, fill: '#ff8fb3', op: 0.55 },
  // ojos
  { t: 'circle', cx: 21, cy: 28, r: 2.8, fill: '#4a2238' },
  { t: 'circle', cx: 35, cy: 28, r: 2.8, fill: '#4a2238' },
  { t: 'circle', cx: 22, cy: 27, r: 0.9, fill: '#ffffff' },
  { t: 'circle', cx: 36, cy: 27, r: 0.9, fill: '#ffffff' },
  // hocico
  { t: 'ellipse', cx: 28, cy: 40, rx: 9, ry: 6.2, fill: '#ff9fbf' },
  { t: 'ellipse', cx: 24.5, cy: 40, rx: 1.8, ry: 2.6, fill: '#c2446f' },
  { t: 'ellipse', cx: 31.5, cy: 40, rx: 1.8, ry: 2.6, fill: '#c2446f' },
  // cronómetro
  { t: 'seg', a: [47, 33.2], b: [47, 36], w: 3.2, fill: '#d64f86' },
  { t: 'seg', a: [44.6, 32.6], b: [49.4, 32.6], w: 3, fill: '#d64f86' },
  { t: 'circle', cx: 47, cy: 47, r: 12.4, fill: '#ffffff' },
  { t: 'ring', cx: 47, cy: 47, r: 10.2, w: 2.6, fill: '#d64f86' },
  { t: 'seg', a: [47, 47], b: [47, 41.2], w: 2.3, fill: '#4a2238' },
  { t: 'seg', a: [47, 47], b: [50.8, 49.2], w: 2.3, fill: '#4a2238' },
  { t: 'circle', cx: 47, cy: 47, r: 1.6, fill: '#4a2238' },
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inTri(x, y, [a, b, c], round) {
  const s = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
  const inside = !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  return inside || Math.min(segDist(x, y, a, b), segDist(x, y, b, c), segDist(x, y, c, a)) <= round;
}

function hit(L, x, y) {
  switch (L.t) {
    case 'circle': return Math.hypot(x - L.cx, y - L.cy) <= L.r;
    case 'ellipse': return ((x - L.cx) / L.rx) ** 2 + ((y - L.cy) / L.ry) ** 2 <= 1;
    case 'ring': return Math.abs(Math.hypot(x - L.cx, y - L.cy) - L.r) <= L.w / 2;
    case 'seg': return segDist(x, y, L.a, L.b) <= L.w / 2;
    case 'tri': return inTri(x, y, L.p, L.round);
    default: return false;
  }
}

function inRoundRect(u, v, r) {
  const qx = Math.abs(u - 0.5) - (0.5 - r);
  const qy = Math.abs(v - 0.5) - (0.5 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r <= 0;
}

const layers = LAYERS.map((L) => ({ ...L, rgb: hex(L.fill), alpha: L.op ?? 1 }));
const top = hex(BG_TOP), bottom = hex(BG_BOTTOM);

function render(size, { radius, scale }) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      let covered = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          if (radius && !inRoundRect(u, v, radius)) continue;
          covered++;
          let col = top.map((c, i) => c + (bottom[i] - c) * v);
          // el dibujo de 64 unidades ocupa `scale` del icono
          const gx = ((u - 0.5) / scale) * 64 + CENTER[0];
          const gy = ((v - 0.5) / scale) * 64 + CENTER[1];
          for (const L of layers) {
            if (hit(L, gx, gy)) col = col.map((c, i) => c + (L.rgb[i] - c) * L.alpha);
          }
          acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2];
        }
      }
      const i = (y * size + x) * 4;
      const n = Math.max(covered, 1);
      px[i] = Math.round(acc[0] / n);
      px[i + 1] = Math.round(acc[1] / n);
      px[i + 2] = Math.round(acc[2] / n);
      px[i + 3] = Math.round((covered / (SS * SS)) * 255);
    }
  }
  return encodePNG(size, px);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['icon-192.png', 192, { radius: 0.22, scale: 0.86 }],
  ['icon-512.png', 512, { radius: 0.22, scale: 0.86 }],
  ['icon-maskable-512.png', 512, { radius: 0, scale: 0.68 }],
  ['apple-touch-icon.png', 180, { radius: 0, scale: 0.84 }],
];
for (const [name, size, opts] of targets) {
  writeFileSync(new URL(name, OUT), render(size, opts));
  console.log('ok', name);
}

// Versión vectorial equivalente (favicon y manifiesto).
function svgShape(L) {
  const op = L.op !== undefined ? ` opacity="${L.op}"` : '';
  switch (L.t) {
    case 'circle': return `<circle cx="${L.cx}" cy="${L.cy}" r="${L.r}" fill="${L.fill}"${op}/>`;
    case 'ellipse': return `<ellipse cx="${L.cx}" cy="${L.cy}" rx="${L.rx}" ry="${L.ry}" fill="${L.fill}"${op}/>`;
    case 'ring': return `<circle cx="${L.cx}" cy="${L.cy}" r="${L.r}" fill="none" stroke="${L.fill}" stroke-width="${L.w}"/>`;
    case 'seg': return `<path d="M${L.a} L${L.b}" stroke="${L.fill}" stroke-width="${L.w}" stroke-linecap="round"/>`;
    case 'tri': return `<path d="M${L.p.join(' L')}Z" fill="${L.fill}" stroke="${L.fill}" stroke-width="${L.round * 2}" stroke-linejoin="round"/>`;
    default: return '';
  }
}
const k = 0.86 * 512 / 64;
writeFileSync(new URL('icon.svg', OUT), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${k}) translate(${-CENTER[0]} ${-CENTER[1]})">
    ${LAYERS.map(svgShape).join('\n    ')}
  </g>
</svg>
`);
console.log('ok icon.svg');
