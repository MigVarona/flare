/**
 * The logo was drawn as light on a black square, so pasting it on any other background
 * shows the square. But light on black is exactly what an alpha channel describes: how
 * bright a pixel is *is* how present it is.
 *
 * So the alpha is baked from the pixel's own brightness — black falls away, the glow
 * keeps its soft falloff, and the mark now sits on any surface without an edge.
 *
 * Run with `node scripts/cutout-logo.mjs`.
 */
import sharp from 'sharp';

const SOURCE = 'assets/images/churri-fusion-logo.png';

const image = sharp(SOURCE).ensureAlpha();
const { width, height } = await image.metadata();
const { data } = await image.raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  // Brightness of the brightest channel: the glow's falloff becomes the alpha's falloff.
  const brightness = Math.max(data[i], data[i + 1], data[i + 2]);
  data[i + 3] = brightness;
}

await sharp(data, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(SOURCE);

console.log(`recortado: ${SOURCE} (${width}×${height}) — el negro ahora es transparente`);
