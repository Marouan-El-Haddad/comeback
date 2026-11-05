// Draws the app's home-screen icons (public/icon-192.png, public/icon-512.png): a red »C« on navy,
// in the token colours. Pure Node (zlib), so it needs no image library. Run: node scripts/make-icons.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import tokens from '../src/ui/design-tokens.json' with { type: 'json' };

type RGB = [number, number, number];

function hex(value: string): RGB {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size: number, pixel: (x: number, y: number) => RGB): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const navy = hex(tokens.color.navy);
const red = hex(tokens.color.red);

/** Inside the »C«: a thick ring, open towards the right. Coordinates in 0…1. */
function inC(x: number, y: number): boolean {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.hypot(dx, dy);
  if (r < 0.2 || r > 0.33) return false;
  const angle = Math.atan2(dy, dx); // 0 = right
  return Math.abs(angle) > Math.PI / 4.2;
}

function draw(size: number): Buffer {
  const samples = 4;
  return png(size, (x, y) => {
    let hits = 0;
    for (let i = 0; i < samples; i++) {
      for (let j = 0; j < samples; j++) {
        if (inC((x + (i + 0.5) / samples) / size, (y + (j + 0.5) / samples) / size)) hits++;
      }
    }
    const t = hits / (samples * samples);
    return [0, 1, 2].map((c) => Math.round((navy[c] ?? 0) * (1 - t) + (red[c] ?? 0) * t)) as RGB;
  });
}

for (const size of [192, 512]) {
  writeFileSync(join('public', `icon-${size}.png`), draw(size));
  console.log(`public/icon-${size}.png`);
}
