import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholders that hold the shape of what's coming, so the screen settles instead
 * of flashing empty and then popping.
 */
export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-3xl bg-card" />
      ))}
    </View>
  );
}

export function PhotoGridSkeleton() {
  return (
    <View className="flex-row gap-2">
      {[0, 1].map((column) => (
        <View key={column} className="flex-1 gap-2">
          <Skeleton className={`rounded-3xl bg-card ${column === 0 ? 'h-64' : 'h-48'}`} />
          <Skeleton className={`rounded-3xl bg-card ${column === 0 ? 'h-48' : 'h-64'}`} />
        </View>
      ))}
    </View>
  );
}

export function MessageSkeletons() {
  return (
    <View className="gap-3">
      <Skeleton className="h-12 w-2/3 self-start rounded-3xl bg-card" />
      <Skeleton className="h-12 w-1/2 self-end rounded-3xl bg-card" />
      <Skeleton className="h-16 w-3/4 self-start rounded-3xl bg-card" />
    </View>
  );
}
