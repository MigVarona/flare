import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** The "add to calendar" glyph. Kept in one place so every screen that offers this action uses
 * the same shape — a bell here and a calendar there would read as two different actions. */
export function CalendarGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x={3.5}
        y={5}
        width={17}
        height={15.5}
        rx={3}
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d="M3.5 9.5h17M8 3v4M16 3v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={8.6} cy={14.6} r={1.5} fill={color} />
    </Svg>
  );
}

/** Points at what a control opens or switches. Says "there's more here" without a word. */
export function ChevronGlyph({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 9l7 7 7-7"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Settings, drawn as sliders rather than a literal gear — it reads clean at icon-button
 * size, and doesn't compete with the space switcher it sits next to for attention. */
export function SettingsGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h13M21 17h-2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle cx={13} cy={7} r={2.1} fill={color} />
      <Circle cx={7} cy={12} r={2.1} fill={color} />
      <Circle cx={18} cy={17} r={2.1} fill={color} />
    </Svg>
  );
}

/** A drawing pin. Marks a note on the Tablón as one that doesn't fade with the others. */
export function PinGlyph({
  color,
  size = 16,
  filled = false,
}: {
  color: string;
  size?: number;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14.8 3.2 20.8 9.2 17.6 12.4 18.7 16.9 15.7 19.9 11.1 15.3 6.3 20.1 4.9 18.7 9.7 13.9 5.1 9.3 8.1 6.3 12.6 7.4 15.8 4.2Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
