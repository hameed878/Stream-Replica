import React from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customFetch, type Title } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useMyList } from '@/hooks/useMyList';
import { artwork, PlayButton, triggerTap } from '@/components/StreamBox';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STILL_W = SCREEN_WIDTH * 0.62;
const STILL_H = STILL_W / 1.78;

export default function DetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSaved } = useMyList();

  const numId = Number(id);
  const mediaType = type === 'tv' ? 'tv' : 'movie';

  const query = useQuery<Title>({
    queryKey: ['/api/catalog/title', numId, mediaType],
    queryFn: ({ signal }) =>
      customFetch<Title>(`/api/catalog/title/${numId}?type=${mediaType}`, { signal }),
    enabled: !isNaN(numId),
  });

  const title = query.data;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Back button — always on top */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 12 }]}
      >
        <Feather name="arrow-left" size={20} color="#fff" />
      </Pressable>

      {/* Loading skeleton */}
      {query.isLoading && (
        <View>
          <View style={[styles.skeletonHero, { backgroundColor: colors.card }]} />
          <View style={{ padding: 20, gap: 12 }}>
            <View style={[styles.skeletonLine, { width: 220, backgroundColor: colors.card }]} />
            <View style={[styles.skeletonLine, { width: 140, backgroundColor: colors.card }]} />
            <View style={[styles.skeletonLine, { width: 180, backgroundColor: colors.card }]} />
          </View>
        </View>
      )}

      {/* Error */}
      {query.isError && (
        <View style={styles.errorCenter}>
          <Feather name="alert-circle" size={36} color={colors.primary} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Title not found</Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.goBackBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontWeight: '700' }}>Go back</Text>
          </Pressable>
        </View>
      )}

      {/* Content */}
      {title && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 56 }}>
          {/* Hero backdrop */}
          <View style={styles.hero}>
            <Image
              source={artwork(title.backdropUrl || title.posterUrl, true)}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(9,10,14,0.4)', colors.background]}
              locations={[0.15, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={styles.content}>
            {/* Genre / type badges */}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: colors.primary + '22' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {title.mediaType === 'tv' ? 'SERIES' : 'MOVIE'}
                </Text>
              </View>
              {title.genres.slice(0, 2).map((g) => (
                <View key={g} style={[styles.badge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                    {g.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>

            {/* Title */}
            <Text style={[styles.titleText, { color: colors.foreground }]}>{title.title}</Text>

            {/* Meta */}
            <View style={styles.metaRow}>
              <Text style={[styles.metaItem, { color: colors.accent }]}>{title.year || '—'}</Text>
              <View style={styles.metaDot} />
              <Text style={[styles.metaItem, { color: colors.foreground }]}>
                {title.mediaType === 'tv'
                  ? `${title.seasons || 1} Season${title.seasons !== 1 ? 's' : ''}`
                  : `${title.runtimeMinutes || 0} min`}
              </Text>
              <View style={styles.metaDot} />
              <Feather name="star" size={13} color={colors.accent} />
              <Text style={[styles.metaItem, { color: colors.foreground }]}>
                {title.rating ? title.rating.toFixed(1) : 'NR'}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <PlayButton
                onPress={() => {
                  triggerTap();
                  router.push(
                    `/player?id=${title.id}&type=${title.mediaType}&titleName=${encodeURIComponent(title.title)}&backdropUrl=${encodeURIComponent(title.backdropUrl)}`,
                  );
                }}
              />
              <Pressable
                onPress={() => { triggerTap(); toggleSaved(title); }}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather
                  name={isSaved(title.id) ? 'check' : 'plus'}
                  size={18}
                  color={colors.foreground}
                />
                <Text style={[styles.saveBtnText, { color: colors.foreground }]}>
                  {isSaved(title.id) ? 'Saved' : 'My List'}
                </Text>
              </Pressable>
            </View>

            {/* Synopsis */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.primary }]}>SYNOPSIS</Text>
              <Text style={[styles.overview, { color: colors.foreground }]}>{title.overview}</Text>
            </View>

            {/* Cast */}
            {title.cast.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>CAST</Text>
                <Text style={[styles.castText, { color: colors.mutedForeground }]}>
                  {title.cast.join(' · ')}
                </Text>
              </View>
            )}

            {/* Stills */}
            {title.stillUrls.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.primary }]}>SCENES</Text>
                <FlatList
                  data={title.stillUrls}
                  keyExtractor={(_, i) => String(i)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <Image
                      source={{ uri: item }}
                      style={[styles.still, { width: STILL_W, height: STILL_H }]}
                    />
                  )}
                  contentContainerStyle={{ gap: 10 }}
                />
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(9,10,14,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { height: 360 },
  content: { paddingHorizontal: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  titleText: {
    fontSize: 33,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 37,
    marginBottom: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  metaItem: { fontSize: 13, fontWeight: '700' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#A69DA1' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 30 },
  saveBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  saveBtnText: { fontSize: 13, fontWeight: '700' },
  section: { marginBottom: 26 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  overview: { fontSize: 14, lineHeight: 22 },
  castText: { fontSize: 13, lineHeight: 21 },
  still: { borderRadius: 10, backgroundColor: '#1A1B23' },
  skeletonHero: { height: 360, opacity: 0.7 },
  skeletonLine: { height: 20, borderRadius: 8 },
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, paddingTop: 120 },
  errorTitle: { fontSize: 20, fontWeight: '800', marginTop: 16, marginBottom: 22 },
  goBackBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13 },
});
