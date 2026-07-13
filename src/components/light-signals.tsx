import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { glow } from '@/constants/theme';

/**
 * The app speaks in light, so it answers in light too — not in yellow faces.
 *
 * Four signals, drawn in the colour of whoever sends them. They cost nothing, which is
 * the point: you can say "I'm here" without spending one of your five messages.
 */
export const Signals = [
  { id: 'pulso', name: 'Pulso', meaning: 'Te leo' },
  { id: 'chispa', name: 'Chispa', meaning: 'Me ha hecho gracia' },
  { id: 'aura', name: 'Aura', meaning: 'Me gusta' },
  { id: 'lazo', name: 'Lazo', meaning: 'Nosotros' },
] as const;

export type SignalId = (typeof Signals)[number]['id'];

export function isSignalId(value: unknown): value is SignalId {
  return Signals.some((signal) => signal.id === value);
}

export function LightSignal({
  id,
  color,
  size = 22,
}: {
  id: SignalId;
  color: string;
  size?: number;
}) {
  const c = size / 2;

  return (
    <View style={glow(color, size * 0.8, 'AA')}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {id === 'pulso' && (
          <>
            <Circle cx={c} cy={c} r={size * 0.4} stroke={color} strokeWidth={1} opacity={0.45} />
            <Circle cx={c} cy={c} r={size * 0.16} fill={color} />
          </>
        )}

        {id === 'chispa' && (
          <Path
            d={`M ${c} ${size * 0.06}
                L ${c + size * 0.11} ${c - size * 0.11}
                L ${size * 0.94} ${c}
                L ${c + size * 0.11} ${c + size * 0.11}
                L ${c} ${size * 0.94}
                L ${c - size * 0.11} ${c + size * 0.11}
                L ${size * 0.06} ${c}
                L ${c - size * 0.11} ${c - size * 0.11} Z`}
            fill={color}
          />
        )}

        {id === 'aura' && (
          <>
            <Circle cx={c} cy={c} r={size * 0.42} fill={color} opacity={0.18} />
            <Circle cx={c} cy={c} r={size * 0.26} fill={color} opacity={0.45} />
            <Circle cx={c} cy={c} r={size * 0.12} fill={color} />
          </>
        )}

        {/* The mark itself: the two of you, overlapping. */}
        {id === 'lazo' && (
          <>
            <Defs>
              <ClipPath id={`lazo-${color.replace('#', '')}`}>
                <Circle cx={c - size * 0.13} cy={c} r={size * 0.24} />
              </ClipPath>
            </Defs>
            <Circle cx={c - size * 0.13} cy={c} r={size * 0.24} fill={color} opacity={0.55} />
            <Circle cx={c + size * 0.13} cy={c} r={size * 0.24} fill={color} opacity={0.55} />
            <G clipPath={`url(#lazo-${color.replace('#', '')})`}>
              <Circle cx={c + size * 0.13} cy={c} r={size * 0.24} fill={color} />
            </G>
          </>
        )}
      </Svg>
    </View>
  );
}
