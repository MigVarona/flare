import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, Path } from 'react-native-svg';

import { glow } from '@/constants/theme';

/**
 * The app speaks in light, so it answers in light — not in yellow faces.
 *
 * Every signal is a verb: something light *does*. And it does it: a light that just sits
 * there is not a light, it's a drawing of one. Each plays when it arrives and then settles
 * into a shape you can still read, so the message keeps its answer after the show is over.
 *
 * They cost nothing, which is the point — you can say "I'm here" without spending one of
 * your five messages.
 */
export const Signals = [
  { id: 'parpadeo', name: 'Parpadeo', meaning: 'Te he leído' },
  { id: 'chispazo', name: 'Chispazo', meaning: 'Me ha hecho gracia' },
  { id: 'bengala', name: 'Bengala', meaning: '¡Toma ya!' },
  { id: 'apagon', name: 'Apagón', meaning: 'Me he quedado sin palabras' },
  { id: 'corto', name: 'Cortocircuito', meaning: 'Me ha explotado la cabeza' },
  { id: 'fundido', name: 'Fundido', meaning: 'Estoy aquí' },
] as const;

export type SignalId = (typeof Signals)[number]['id'];

export function isSignalId(value: unknown): value is SignalId {
  return Signals.some((signal) => signal.id === value);
}

/** What each signal does when it lands, and where it comes to rest. */
function useArrival(id: SignalId) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    const quick = { duration: 90 };

    if (id === 'parpadeo') {
      // Two blinks, the way you'd catch someone's eye across a room.
      opacity.value = withSequence(
        withTiming(1, quick),
        withTiming(0.15, quick),
        withTiming(1, quick),
        withTiming(0.2, quick),
        withTiming(1, { duration: 160 }),
      );
      scale.value = withTiming(1, { duration: 120 });
      return;
    }

    if (id === 'chispazo') {
      // It overshoots, because a spark doesn't arrive politely.
      opacity.value = withTiming(1, quick);
      scale.value = withSequence(
        withTiming(1.45, { duration: 110 }),
        withTiming(0.92, { duration: 90 }),
        withTiming(1, { duration: 110 }),
      );
      return;
    }

    if (id === 'bengala') {
      // Flares up, then holds, the way a flare hangs in the air before it falls.
      opacity.value = withSequence(withTiming(1, { duration: 70 }), withTiming(0.85, { duration: 400 }));
      scale.value = withSequence(
        withTiming(1.3, { duration: 130 }),
        withTiming(1, { duration: 240 }),
      );
      return;
    }

    if (id === 'apagon') {
      // Burns bright and then goes out — and stays out. That's the joke, so it has to land.
      opacity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withDelay(220, withTiming(0.35, { duration: 260 })),
      );
      scale.value = withSequence(
        withTiming(1.1, { duration: 80 }),
        withDelay(220, withTiming(0.9, { duration: 260 })),
      );
      return;
    }

    if (id === 'corto') {
      // A bad connection: it can't decide whether it's on.
      opacity.value = withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(0.2, { duration: 40 }),
        withTiming(0.9, { duration: 30 }),
        withTiming(0.1, { duration: 50 }),
        withTiming(1, { duration: 40 }),
        withTiming(0.3, { duration: 60 }),
        withTiming(1, { duration: 120 }),
      );
      scale.value = withTiming(1, { duration: 100 });
      return;
    }

    // fundido: the two lights find each other and stay.
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSequence(
      withTiming(1.12, { duration: 220 }),
      withTiming(1, { duration: 200 }),
    );
  }, [id, opacity, scale]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
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
  const arrival = useArrival(id);
  const c = size / 2;
  const key = color.replace('#', '');

  return (
    <Animated.View style={[glow(color, size * 0.8, 'AA'), arrival]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {id === 'parpadeo' && (
          <>
            <Circle cx={c} cy={c} r={size * 0.4} stroke={color} strokeWidth={1} opacity={0.45} />
            <Circle cx={c} cy={c} r={size * 0.16} fill={color} />
          </>
        )}

        {id === 'chispazo' && (
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

        {/* A burning head with the light thrown off it. */}
        {id === 'bengala' && (
          <>
            <G stroke={color} strokeWidth={1.4} strokeLinecap="round" opacity={0.8}>
              <Line x1={c} y1={size * 0.08} x2={c} y2={size * 0.26} />
              <Line x1={size * 0.16} y1={size * 0.22} x2={size * 0.29} y2={size * 0.35} />
              <Line x1={size * 0.84} y1={size * 0.22} x2={size * 0.71} y2={size * 0.35} />
            </G>
            <Circle cx={c} cy={c + size * 0.08} r={size * 0.22} fill={color} />
          </>
        )}

        {/* A light that has gone out: the shape stays, the fire doesn't. */}
        {id === 'apagon' && (
          <>
            <Circle
              cx={c}
              cy={c}
              r={size * 0.32}
              stroke={color}
              strokeWidth={1.6}
              opacity={0.9}
            />
            <Line
              x1={size * 0.28}
              y1={size * 0.72}
              x2={size * 0.72}
              y2={size * 0.28}
              stroke={color}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </>
        )}

        {/* The bolt: the current going where it shouldn't. */}
        {id === 'corto' && (
          <Path
            d={`M ${c + size * 0.12} ${size * 0.06}
                L ${size * 0.3} ${c + size * 0.02}
                L ${c} ${c + size * 0.02}
                L ${c - size * 0.1} ${size * 0.94}
                L ${size * 0.74} ${c - size * 0.06}
                L ${c + size * 0.02} ${c - size * 0.06} Z`}
            fill={color}
          />
        )}

        {/* The mark itself: the two of you, overlapping. */}
        {id === 'fundido' && (
          <>
            <Defs>
              <ClipPath id={`fundido-${key}`}>
                <Circle cx={c - size * 0.13} cy={c} r={size * 0.24} />
              </ClipPath>
            </Defs>
            <Circle cx={c - size * 0.13} cy={c} r={size * 0.24} fill={color} opacity={0.55} />
            <Circle cx={c + size * 0.13} cy={c} r={size * 0.24} fill={color} opacity={0.55} />
            <G clipPath={`url(#fundido-${key})`}>
              <Circle cx={c + size * 0.13} cy={c} r={size * 0.24} fill={color} />
            </G>
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
