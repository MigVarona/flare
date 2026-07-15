import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { neonBorder, Radius } from '@/constants/theme';

/** How long the oldest message takes to die, so the light goes out before the record does. */
export const DeathMs = 1100;

/** How long the surge takes to climb from one message to the next. */
export const StepMs = 110;

/**
 * The message itself: a thin edge and the words. No glow.
 *
 * It used to carry its own halo, which meant every message sat in a permanent puddle of light
 * whether anything was happening or not — and light that never changes stops being light and
 * becomes wallpaper. The glow now lives behind all of them, in the field, where the messages
 * are the sources rather than the decorated objects. This is only the lamp's housing.
 */
export function MessageLight({
  color,
  isMine,
  /** Its resting brightness: the older it is, the closer it already is to going out. */
  rest,
  isDying,
  /** How far the surge has to travel to reach it, so the light dies in order. */
  delay,
  children,
}: {
  color: string;
  isMine: boolean;
  rest: number;
  isDying: boolean;
  delay: number;
  children: ReactNode;
}) {
  const body = useSharedValue(0);

  useEffect(() => {
    // It doesn't fade in. It turns on — badly, the way a strip light does.
    body.value = withSequence(
      withTiming(rest, { duration: 60 }),
      withTiming(rest * 0.25, { duration: 50 }),
      withTiming(rest, { duration: 70 }),
      withTiming(rest * 0.5, { duration: 40 }),
      withTiming(rest, { duration: 140 }),
    );
    // Only on arrival: `rest` shifts as the message ages, and re-striking the light every time
    // someone writes would make the whole screen twitch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDying) return;
    body.value = withDelay(delay + 180, withTiming(0.04, { duration: 640 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDying]);

  const bodyStyle = useAnimatedStyle(() => ({ opacity: body.value }));

  return (
    <Animated.View
      style={[
        styles.bubble,
        isMine ? styles.mine : styles.theirs,
        { backgroundColor: `${color}14` },
        neonBorder(color, '99'),
        bodyStyle,
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: Radius.large,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  mine: {
    borderBottomRightRadius: Radius.small,
  },
  theirs: {
    borderBottomLeftRadius: Radius.small,
  },
});
