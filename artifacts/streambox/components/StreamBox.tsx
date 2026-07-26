import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

/** The red Netflix-style "N" lettermark. */
export function NetflixN({ size = 20 }: { size?: number }) {
  return (
    <View style={[nStyles.wrap, { width: size, height: size * 1.4 }]}>
      <Text style={[nStyles.letter, { fontSize: size * 0.85 }]}>N</Text>
    </View>
  );
}

const nStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  letter: {
    color: '#fff',
    fontWeight: '900',
    lineHeight: undefined,
    includeFontPadding: false,
  },
});

/** "N SERIES" or "N FILM" badge shown in the detail header */
export function NetflixTypeBadge({ type }: { type: 'tv' | 'movie' }) {
  return (
    <View style={badgeStyles.row}>
      <NetflixN size={14} />
      <Text style={badgeStyles.label}>{type === 'tv' ? 'SERIES' : 'FILM'}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    color: '#AAAAAA',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
  },
});

/** Vertical icon + label button used in hero / detail action rows */
export function VerticalAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={() => { triggerTap(); onPress?.(); }} style={vaStyles.btn}>
      {icon}
      <Text style={vaStyles.label}>{label}</Text>
    </Pressable>
  );
}

const vaStyles = StyleSheet.create({
  btn: { alignItems: 'center', gap: 4, minWidth: 56 },
  label: { color: '#FFFFFF', fontSize: 11, fontWeight: '500', textAlign: 'center' },
});

/** White "▶ Play" button — use in hero rows */
export function PlayButton({ onPress, label = 'Play' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      testID="play-button"
      onPress={() => { triggerTap(); onPress(); }}
      style={({ pressed }) => [pbStyles.btn, pressed && pbStyles.pressed]}
    >
      <Ionicons name="play" size={16} color="#000" style={{ marginLeft: 3 }} />
      <Text style={pbStyles.text}>{label}</Text>
    </Pressable>
  );
}

const pbStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 4,
    gap: 7,
  },
  pressed: { opacity: 0.8 },
  text: { color: '#000000', fontWeight: '700', fontSize: 16 },
});

/** Full-width white "▶ Play" button for detail screen */
export function PlayButtonFull({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="play-button-full"
      onPress={() => { triggerTap(); onPress(); }}
      style={({ pressed }) => [fullBtnStyles.play, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name="play" size={18} color="#000" style={{ marginLeft: 4 }} />
      <Text style={fullBtnStyles.playText}>Play</Text>
    </Pressable>
  );
}

/** Full-width dark download button for detail screen */
export function DownloadButton({ label = 'Download S1:E1', onPress }: { label?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={() => { triggerTap(); onPress?.(); }}
      style={({ pressed }) => [fullBtnStyles.download, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name="download-outline" size={18} color="#fff" />
      <Text style={fullBtnStyles.downloadText}>{label}</Text>
    </Pressable>
  );
}

const fullBtnStyles = StyleSheet.create({
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    height: 48,
    borderRadius: 4,
    gap: 8,
    marginBottom: 10,
  },
  playText: { color: '#000', fontWeight: '700', fontSize: 17 },
  download: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2A',
    height: 48,
    borderRadius: 4,
    gap: 8,
  },
  downloadText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});

/** Netflix-style filter chip (e.g. "Movies ▼", "All Categories ▼") */
export function FilterChip({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={chipStyles.chip}>
      <Text style={chipStyles.label}>{label}</Text>
      <Ionicons name="chevron-down" size={12} color="#fff" />
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  label: { color: '#fff', fontSize: 13, fontWeight: '500' },
});

/** Poster card with optional TOP 10 rank badge */
export function PosterCard({ title, width = 112, rank }: { title: Title; width?: number; rank?: number }) {
  const router = useRouter();
  const posterH = width * 1.46;

  return (
    <Pressable
      testID={`poster-${title.id}`}
      onPress={() => { triggerTap(); router.push(`/detail/${title.id}?type=${title.mediaType}`); }}
      style={({ pressed }) => [pcStyles.card, { width }, pressed && pcStyles.pressed]}
    >
      <View style={{ width, height: posterH, position: 'relative' }}>
        <Image source={artwork(title.posterUrl)} style={[pcStyles.poster, { width, height: posterH }]} />
        {rank !== undefined && rank <= 10 && (
          <View style={pcStyles.badge}>
            <NetflixN size={12} />
            <Text style={pcStyles.rankNum}>{rank}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const pcStyles = StyleSheet.create({
  card: { marginRight: 6 },
  pressed: { opacity: 0.75 },
  poster: { borderRadius: 3, backgroundColor: '#1A1A1A' },
  badge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    alignItems: 'center',
    gap: 0,
  },
  rankNum: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 44,
    letterSpacing: -2,
    includeFontPadding: false,
  },
});

/** Netflix-style horizontal rail */
export function Rail({ title, items, showRank = false }: { title: string; items: Title[]; showRank?: boolean }) {
  return (
    <View style={railStyles.rail}>
      <Text style={railStyles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={railStyles.scroller}
      >
        {items.slice(0, 10).map((item, i) => (
          <PosterCard
            key={`${item.mediaType}-${item.id}`}
            title={item}
            rank={showRank ? i + 1 : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const railStyles = StyleSheet.create({
  rail: { marginTop: 24 },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  scroller: { paddingHorizontal: 12, gap: 6 },
});

export function EmptyState({
  title,
  body,
  icon = 'bookmark',
}: {
  title: string;
  body: string;
  icon?: keyof typeof Feather.glyphMap;
}) {
  return (
    <View style={emptyStyles.wrap}>
      <Feather name={icon} size={28} color="#555" />
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.body}>{body}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { color: '#888', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
});

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={errStyles.wrap}>
      <Feather name="wifi-off" size={28} color="#E50914" />
      <Text style={errStyles.title}>Could not load catalog</Text>
      <Text style={errStyles.body}>Check your connection and try again.</Text>
      <Pressable onPress={onRetry} style={errStyles.btn}>
        <Text style={errStyles.btnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const errStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, paddingTop: 100 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { color: '#888', fontSize: 14, textAlign: 'center' },
  btn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
