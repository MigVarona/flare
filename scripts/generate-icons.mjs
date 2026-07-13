/**
 * Renders the Churriapp brand mark — two overlapping lights, rose and cyan — into
 * every icon asset the app needs. Run with `node scripts/generate-icons.mjs`.
 */
import sharp from 'sharp';

const BACKGROUND = '#0B0710';
const YOU = '#FF3D8A';
const PARTNER = '#37E2FF';
const BOTH = '#A855F7';

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

const targets = [
  { file: 'assets/images/icon.png', size: 1024, scale: 0.62 },
  { file: 'assets/images/favicon.png', size: 96, scale: 0.66 },
  { file: 'assets/images/splash-icon.png', size: 512, scale: 0.72, transparent: true },
  // Android adaptive icons: the system masks them, so the mark must sit well inside.
  { file: 'assets/images/android-icon-foreground.png', size: 432, scale: 0.42, transparent: true },
];

for (const { file, size, scale, transparent } of targets) {
  await sharp(markSvg({ size, scale, transparent })).png().toFile(file);
  console.log(`wrote ${file} (${size}px)`);
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
