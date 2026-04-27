import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const brandDir = path.resolve('assets/brand');
const svgDir = path.join(brandDir, 'svg');
const rasterDir = path.join(brandDir, 'raster');

const jobs = [
  ['track-mark.svg', 'track-mark-512.png', 512, 359],
  ['track-mark.svg', 'track-mark-1024.png', 1024, 718],
  ['track-logo.svg', 'track-logo-1044.png', 1044, 456],
  ['track-logo-reversed.svg', 'track-logo-reversed-1044.png', 1044, 456],
  ['track-app-icon.svg', 'app-icon-1024.png', 1024, 1024],
  ['track-app-icon.svg', 'apple-touch-icon.png', 180, 180],
  ['track-app-icon.svg', 'android-chrome-192.png', 192, 192],
  ['track-app-icon.svg', 'android-chrome-512.png', 512, 512],
  ['track-favicon.svg', 'favicon-16.png', 16, 16],
  ['track-favicon.svg', 'favicon-32.png', 32, 32],
  ['track-favicon.svg', 'favicon-48.png', 48, 48],
  ['track-favicon.svg', 'favicon-96.png', 96, 96],
  ['track-favicon.svg', 'favicon-192.png', 192, 192],
  ['track-favicon.svg', 'favicon-512.png', 512, 512],
];

await fs.mkdir(rasterDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });

async function renderSvg(svgFile, outFile, width, height) {
  const svg = await fs.readFile(path.join(svgDir, svgFile), 'utf8');
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setViewportSize({ width, height });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          html, body {
            width: ${width}px;
            height: ${height}px;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background: transparent;
          }
          img {
            display: block;
            width: ${width}px;
            height: ${height}px;
          }
        </style>
      </head>
      <body><img src="${dataUrl}" /></body>
    </html>
  `);
  await page.screenshot({
    path: path.join(rasterDir, outFile),
    omitBackground: true,
    fullPage: false,
  });
}

for (const [svgFile, outFile, width, height] of jobs) {
  await renderSvg(svgFile, outFile, width, height);
}

await browser.close();

function pngIcoDirectoryEntry(png, size, imageOffset) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(imageOffset, 12);
  return entry;
}

async function writeIco() {
  const sizes = [16, 32, 48, 96, 192];
  const pngs = await Promise.all(
    sizes.map(async (size) => [
      size,
      await fs.readFile(path.join(rasterDir, `favicon-${size}.png`)),
    ]),
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = header.length + pngs.length * 16;
  const entries = [];
  for (const [size, png] of pngs) {
    entries.push(pngIcoDirectoryEntry(png, size, offset));
    offset += png.length;
  }

  await fs.writeFile(path.join(rasterDir, 'favicon.ico'), Buffer.concat([
    header,
    ...entries,
    ...pngs.map(([, png]) => png),
  ]));
}

await writeIco();

console.log(`Exported ${jobs.length} PNG assets and favicon.ico to ${rasterDir}`);
