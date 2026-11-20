// Genera los iconos PNG de la app sin dependencias externas.
// Uso: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const TOP = [0x5a, 0x78, 0xff];
const BOTTOM = [0x32, 0x48, 0xd1];

// Cronómetro en coordenadas de un viewBox 24x24 (igual que el logo de la app).
const STROKE = 2.2;
const shapes = [
  { kind: 'ring', cx: 12, cy: 13.5, r: 7.5 },
  { kind: 'seg', a: [12, 10], b: [12, 13.5] },
  { kind: 'seg', a: [12, 13.5], b: [14.5, 15] },
  { kind: 'seg', a: [10, 2.5], b: [14, 2.5] },
  { kind: 'seg', a: [12, 2.5], b: [12, 6] },
];

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inGlyph(x, y) {
  return shapes.some((s) => s.kind === 'ring'
    ? Math.abs(Math.hypot(x - s.cx, y - s.cy) - s.r) <= STROKE / 2
    : segDist(x, y, s.a, s.b) <= STROKE / 2);
}

function inRoundRect(u, v, r) {
  const qx = Math.abs(u - 0.5) - (0.5 - r);
  const qy = Math.abs(v - 0.5) - (0.5 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r <= 0;
}

function render(size, { radius, scale }) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0, fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          if (radius && !inRoundRect(u, v, radius)) continue;
          bg++;
          // contenido centrado: el glifo de 24 unidades ocupa `scale` del icono (con un ligero ajuste vertical)
          const gx = ((u - 0.5) / scale) * 24 + 12;
          const gy = ((v - 0.5) / scale) * 24 + 12.4;
          if (inGlyph(gx, gy)) fg++;
        }
      }
      const n = SS * SS;
      const t = y / (size - 1);
      const base = TOP.map((c, i) => c + (BOTTOM[i] - c) * t);
      const f = fg / Math.max(bg, 1);
      const i = (y * size + x) * 4;
      px[i] = Math.round(base[0] + (255 - base[0]) * f);
      px[i + 1] = Math.round(base[1] + (255 - base[1]) * f);
      px[i + 2] = Math.round(base[2] + (255 - base[2]) * f);
      px[i + 3] = Math.round((bg / n) * 255);
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
  ['icon-192.png', 192, { radius: 0.22, scale: 0.62 }],
  ['icon-512.png', 512, { radius: 0.22, scale: 0.62 }],
  ['icon-maskable-512.png', 512, { radius: 0, scale: 0.48 }],
  ['apple-touch-icon.png', 180, { radius: 0, scale: 0.6 }],
];
for (const [name, size, opts] of targets) {
  writeFileSync(new URL(name, OUT), render(size, opts));
  console.log('ok', name);
}

writeFileSync(new URL('icon.svg', OUT), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a78ff"/><stop offset="1" stop-color="#3248d1"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${(512 * 0.62) / 24}) translate(-12 -12.4)" fill="none" stroke="#fff" stroke-width="${STROKE}" stroke-linecap="round">
    <circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 1.5"/><path d="M10 2.5h4"/><path d="M12 2.5V6"/>
  </g>
</svg>
`);
console.log('ok icon.svg');
