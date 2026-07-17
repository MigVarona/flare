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
