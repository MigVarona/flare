/**
 * Renders Flare's mark — two lights and the lens where they cross — into every icon
 * asset the app needs, so the launcher icon is the same logo you see inside.
 * Run with `node scripts/generate-icons.mjs`.
 */
import sharp from 'sharp';

// Flare's own colours, the same ones the logo and the wordmark use.
const BACKGROUND = '#01030F';
const YOU = '#F72E79';
const PARTNER = '#17A9F5';
const BOTH = '#F19AF5';

/**
 * @param {object} options
 * @param {number} options.size canvas size in px
 * @param {boolean} options.transparent leave the canvas transparent (adaptive foreground)
 * @param {number} options.scale how much of the canvas the mark fills, 0–1
 */
function markSvg({ size, transparent = false, scale = 0.62 }) {
  const c = size / 2;
  const radius = (size * scale) / 4;
  const offset = radius * 0.58;

  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="${radius * 0.28}" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="left">
          <circle cx="${c - offset}" cy="${c}" r="${radius}" />
        </clipPath>
      </defs>
      ${transparent ? '' : `<rect width="${size}" height="${size}" fill="${BACKGROUND}" />`}
      <g filter="url(#glow)">
        <circle cx="${c - offset}" cy="${c}" r="${radius}" fill="${YOU}" />
        <circle cx="${c + offset}" cy="${c}" r="${radius}" fill="${PARTNER}" />
        <!-- Where the two overlap: the space that only exists because of both. -->
        <g clip-path="url(#left)">
          <circle cx="${c + offset}" cy="${c}" r="${radius}" fill="${BOTH}" />
        </g>
      </g>
    </svg>
  `);
}

/**
 * The mark reduced to a silhouette, because Android insists on one.
 *
 * The status bar and the themed launcher icon throw the colour away: every pixel that isn't
 * transparent turns a single flat tone. Two filled circles would come back as one shapeless
 * blob, so the mark is drawn as two rings — the crossing survives, and that crossing is the
 * whole idea.
 *
 * @param {number} size canvas size in px
 * @param {number} scale how much of the canvas the mark fills, 0–1
 */
function silhouetteSvg(size, scale = 0.62) {
  const c = size / 2;
  const radius = (size * scale) / 3.24;
  const offset = radius * 0.62;
  const stroke = radius * 0.34;

  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="#FFFFFF" stroke-width="${stroke}">
        <circle cx="${c - offset}" cy="${c}" r="${radius - stroke / 2}" />
        <circle cx="${c + offset}" cy="${c}" r="${radius - stroke / 2}" />
      </g>
    </svg>
  `);
}

const targets = [
  { file: 'assets/images/icon.png', size: 1024, scale: 0.78 },
  { file: 'assets/images/favicon.png', size: 96, scale: 0.8 },
  { file: 'assets/images/splash-icon.png', size: 512, scale: 0.72, transparent: true },
  // Android adaptive icons: the system masks them, so the mark must sit well inside.
  { file: 'assets/images/android-icon-foreground.png', size: 432, scale: 0.52, transparent: true },
];

for (const { file, size, scale, transparent } of targets) {
  await sharp(markSvg({ size, scale, transparent })).png().toFile(file);
  console.log(`wrote ${file} (${size}px)`);
}

// The two places Android strips the colour out and keeps only the shape.
const silhouettes = [
  // The status-bar icon on every notification. Without it, Android silhouettes the app icon
  // — background and all — and every alert shows up as a white square.
  { file: 'assets/images/notification-icon.png', size: 96, scale: 0.9 },
  // The themed launcher icon, which the system tints to match the wallpaper.
  { file: 'assets/images/android-icon-monochrome.png', size: 432, scale: 0.52 },
];

for (const { file, size, scale } of silhouettes) {
  await sharp(silhouetteSvg(size, scale)).png().toFile(file);
  console.log(`wrote ${file} (${size}px, silueta)`);
}

// A flat background plate for the Android adaptive icon.
await sharp({
  create: {
    width: 432,
    height: 432,
    channels: 4,
    background: BACKGROUND,
  },
})
  .png()
  .toFile('assets/images/android-icon-background.png');
console.log('wrote assets/images/android-icon-background.png (432px)');
