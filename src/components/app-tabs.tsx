import { LinearGradient } from 'expo-linear-gradient';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { BrandGradient, Colors, glow, neonBorder, Radius, Spacing } from '@/constants/theme';

const theme = Colors.dark;

export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />
      <TabList
        style={[
          styles.bar,
          neonBorder(theme.border, 'FF'),
          glow('#000000', 28, 'CC'),
          { bottom: insets.bottom + Spacing.two },
        ]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton>Espacio</TabButton>
        </TabTrigger>
        <TabTrigger name="reminders" href="/reminders" asChild>
          <TabButton>Avisos</TabButton>
        </TabTrigger>
        <TabTrigger name="gallery" href="/gallery" asChild>
          <TabButton>Fotos</TabButton>
        </TabTrigger>
        <TabTrigger name="chat" href="/chat" asChild>
          <TabButton>Mensajes</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const TabButton = forwardRef<View, TabTriggerSlotProps>(({ children, isFocused, ...props }, ref) => (
  <Pressable ref={ref} {...props} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
    {isFocused ? (
      <LinearGradient
        colors={BrandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}>
        <ThemedText type="small" numberOfLines={1} style={styles.activeLabel}>
          {children}
        </ThemedText>
      </LinearGradient>
    ) : (
      <View style={styles.fill}>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={1}
          style={styles.inactiveLabel}>
          {children}
        </ThemedText>
      </View>
    )}
  </Pressable>
));

TabButton.displayName = 'TabButton';

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.pill,
    padding: Spacing.one,
  },
  tab: {
    flex: 1,
  },
  fill: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
  },
  activeLabel: {
    color: '#0B0710',
    fontWeight: '800',
    fontSize: 13,
  },
  inactiveLabel: {
    fontWeight: '600',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
});
