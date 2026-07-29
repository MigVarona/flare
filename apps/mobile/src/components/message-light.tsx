import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { neonBorder, Radius } from '@/constants/theme';

/**
 * The note itself: a thin edge and the words. No glow.
 *
 * The glow lives behind all of them, in the field, where the notes are the sources rather
 * than the decorated objects. This is only the lamp's housing.
 */
export function MessageLight({
  color,
  isMine,
  children,
}: {
  color: string;
  isMine: boolean;
  children: ReactNode;
}) {
  const body = useSharedValue(0);

  useEffect(() => {
    // It doesn't fade in. It turns on — badly, the way a strip light does.
    body.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(0.25, { duration: 50 }),
      withTiming(1, { duration: 70 }),
      withTiming(0.5, { duration: 40 }),
      withTiming(1, { duration: 140 }),
    );
  }, []);

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
