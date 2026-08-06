/**
 * Generates the app icons.
 *
 * Writes PNGs from scratch with zlib rather than pulling in an image library:
 * the icon is a rounded square with a route on it, which is a few dozen lines of
 * pixel maths, and a checked-in binary nobody can regenerate is worse than the
 * code that made it.
 *
 *   npm run icons
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG = [14, 17, 22];
const TRACK = [74, 222, 128];
const START = [232, 237, 244];

// --- PNG encoding ---------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** @param pixels RGBA bytes, row-major. */
function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // Compression, filter and interlace methods: the only values PNG defines.
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  // One filter byte per scanline. Filter 0 (None) keeps this simple; the images
  // are tiny and deflate handles the rest.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Drawing --------------------------------------------------------------

/** Distance from a point to a line segment, for stroking a polyline. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * A stylised route: a loop that reads as a running track at 48 pixels and still
 * looks deliberate at 512. Coordinates are fractions of the icon's size.
 */
const ROUTE = [
  [0.26, 0.74],
  [0.3, 0.52],
  [0.44, 0.44],
  [0.58, 0.5],
  [0.66, 0.38],
  [0.6, 0.26],
  [0.74, 0.28],
];

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const stroke = size * 0.075;
  const startDot = size * 0.075;

  // Supersampled 3x3: at icon sizes, aliasing on the diagonals is very visible
  // and the whole image is small enough that brute force costs nothing.
  const SAMPLES = 3;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = x + (sx + 0.5) / SAMPLES;
          const py = y + (sy + 0.5) / SAMPLES;

          // Rounded-square mask.
          const cx = Math.abs(px - size / 2) - (size / 2 - radius);
          const cy = Math.abs(py - size / 2) - (size / 2 - radius);
          const outside =
            cx > 0 && cy > 0 ? Math.hypot(cx, cy) - radius : Math.max(cx, cy) - radius;
          if (outside > 0) continue;

          let colour = BG;

          let best = Infinity;
          for (let i = 1; i < ROUTE.length; i++) {
            best = Math.min(
              best,
              distanceToSegment(
                px,
                py,
                ROUTE[i - 1][0] * size,
                ROUTE[i - 1][1] * size,
                ROUTE[i][0] * size,
                ROUTE[i][1] * size,
              ),
            );
          }
          if (best < stroke / 2) colour = TRACK;

          // The start marker sits on top of the line.
          if (Math.hypot(px - ROUTE[0][0] * size, py - ROUTE[0][1] * size) < startDot) {
            colour = START;
          }

          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
        }
      }

      const total = SAMPLES * SAMPLES;
      const offset = (y * size + x) * 4;
      if (a > 0) {
        // Un-premultiply: the colour sums only covered samples, the alpha counts
        // how many there were.
        const covered = a / 255;
        pixels[offset] = Math.round(r / covered);
        pixels[offset + 1] = Math.round(g / covered);
        pixels[offset + 2] = Math.round(b / covered);
        pixels[offset + 3] = Math.round(a / total);
      }
    }
  }

  return encodePng(size, size, pixels);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="22" fill="#0e1116"/>
  <polyline points="${ROUTE.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}"
    fill="none" stroke="#4ade80" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${ROUTE[0][0] * 100}" cy="${ROUTE[0][1] * 100}" r="7.5" fill="#e8edf4"/>
</svg>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'icon.svg'), svg);
for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), drawIcon(size));
}

console.log('Wrote icon.svg, icon-192.png and icon-512.png to public/');
