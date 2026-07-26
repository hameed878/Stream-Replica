import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { Title } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const fallbackPoster = require('@/assets/images/fallback-poster.jpg');
const fallbackHero = require('@/assets/images/fallback-hero.jpg');

export function artwork(uri: string | undefined, hero = false) {
  return uri ? { uri } : hero ? fallbackHero : fallbackPoster;
}

export function triggerTap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function Logo() {
  const colors = useColors();
  return (
    <View style={styles.logoLockup}>
      <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
        <View style={[styles.logoCut, { backgroundColor: colors.background }]} />
      </View>
      <Text style={[styles.logoText, { color: colors.foreground }]}>STREAM<Text style={{ color: colors.primary }}>BOX</Text></Text>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  active = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
  active?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityLabel={label}
      testID={`icon-${label.toLowerCase().replaceAll(' ', '-')}`}
      onPress={() => { triggerTap(); onPress(); }}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, active && { backgroundColor: colors.primary }]}
    >
      <Feather name={icon} size={19} color={active ? colors.primaryForeground : colors.foreground} />
    </Pressable>
  );
}

export function PosterCard({ title, width = 112 }: { title: Title; width?: number }) {
  const colors = useColors();
  const router = useRouter();
  return (
    <Pressable
      testID={`poster-${title.id}`}
      onPress={() => { triggerTap(); router.push(`/detail/${title.id}?type=${title.mediaType}`); }}
      style={({ pressed }) => [styles.posterCard, { width }, pressed && styles.cardPressed]}
    >
      <Image source={artwork(title.posterUrl)} style={[styles.poster, { width, height: width * 1.46 }]} />
      <Text numberOfLines={1} style={[styles.posterTitle, { color: colors.foreground }]}>{title.title}</Text>
      <Text numberOfLines={1} style={[styles.posterMeta, { color: colors.mutedForeground }]}>
        {title.year || '—'} <Text style={{ color: colors.primary }}>•</Text> {title.rating ? title.rating.toFixed(1) : 'NR'}
      </Text>
    </Pressable>
  );
}

export function Rail({ title, items }: { title: string; items: Title[] }) {
  const colors = useColors();
  return (
    <View style={styles.rail}>
      <View style={styles.railHeading}>
        <Text style={[styles.railTitle, { color: colors.foreground }]}>{title}</Text>
        <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
      </View>
      <View style={styles.railScroller}>
        {items.slice(0, 10).map((item) => <PosterCard key={`${item.mediaType}-${item.id}`} title={item} />)}
      </View>
    </View>
  );
}

export function PlayButton({ onPress, label = 'Play now' }: { onPress: () => void; label?: string }) {
  const colors = useColors();
  return (
    <Pressable
      testID="play-button"
      onPress={() => { triggerTap(); onPress(); }}
      style={({ pressed }) => [styles.playButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
    >
      <Ionicons name="play" size={16} color={colors.primaryForeground} />
      <Text style={[styles.playText, { color: colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, body, icon = 'bookmark' }: { title: string; body: string; icon?: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</Text>
    </View>
  );
}

export function LoadingRows() {
  const colors = useColors();
  return (
    <View style={styles.loadingWrap}>
      <View style={[styles.skeletonHero, { backgroundColor: colors.card }]} />
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.loadingRail}>
          <View style={[styles.skeletonLine, { backgroundColor: colors.card }]} />
          <View style={styles.loadingPosters}>
            {[0, 1, 2].map((item) => <View key={item} style={[styles.skeletonPoster, { backgroundColor: colors.card }]} />)}
          </View>
        </View>
      ))}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.errorState}>
      <Feather name="wifi-off" size={28} color={colors.primary} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>The feed missed a cue</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>We could not reach the catalog right now.</Text>
      <Pressable onPress={onRetry} style={[styles.retryButton, { borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground, fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  logoLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoMark: { width: 26, height: 26, borderRadius: 8, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' },
  logoCut: { width: 8, height: 15, borderRadius: 4, transform: [{ rotate: '-45deg' }] },
  logoText: { fontSize: 15, letterSpacing: 2.3, fontWeight: '800' },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.68, transform: [{ scale: 0.96 }] },
  posterCard: { marginRight: 12 },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  poster: { borderRadius: 9, backgroundColor: '#1A1B23' },
  posterTitle: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  posterMeta: { marginTop: 4, fontSize: 11, fontWeight: '500' },
  rail: { marginTop: 27 },
  railHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingRight: 20 },
  railTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  railScroller: { flexDirection: 'row', paddingRight: 12 },
  playButton: { height: 48, borderRadius: 15, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  playText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  empty: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 30, marginTop: 24, alignItems: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { textAlign: 'center', fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 290 },
  retryButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 18 },
  loadingWrap: { padding: 16 },
  skeletonHero: { height: 410, borderRadius: 22, opacity: 0.72 },
  loadingRail: { marginTop: 25 },
  skeletonLine: { width: 150, height: 19, borderRadius: 8 },
  loadingPosters: { flexDirection: 'row', gap: 12, marginTop: 14 },
  skeletonPoster: { width: 112, height: 164, borderRadius: 9, opacity: 0.75 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
});