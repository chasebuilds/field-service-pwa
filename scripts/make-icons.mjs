// Renders public/icon.svg to the PNG sizes the manifest needs. Run: node scripts/make-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png');
// maskable: icon inset to 70% on a solid background so launchers can crop freely
const inner = await sharp(svg).resize(358, 358).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#b4532a' } })
  .composite([{ input: inner, gravity: 'center' }]).png().toFile('public/icon-maskable-512.png');
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
