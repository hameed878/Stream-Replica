import React from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetCatalogHome } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useMyList } from '@/hooks/useMyList';
import { artwork, ErrorState, IconButton, Logo, PlayButton, Rail } from '@/components/StreamBox';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSaved, toggleSaved } = useMyList();
  const query = useGetCatalogHome();
  const featured = query.data?.featured;

  if (query.isLoading) return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}><LoadingHome /></View>;
  if (query.isError || !query.data || !featured) return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}><ErrorState onRetry={() => query.refetch()} /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.primary} colors={[colors.primary]} refreshing={query.isFetching} onRefresh={() => query.refetch()} />}
        contentContainerStyle={{ paddingBottom: 108 }}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Logo />
          <View style={styles.topActions}>
            <IconButton label="Search" icon="search" onPress={() => router.push('/search')} />
            <IconButton label="My list" icon="bookmark" onPress={() => router.push('/my-list')} active={isSaved(featured.id)} />
          </View>
        </View>
        <Pressable testID="featured-title" onPress={() => router.push(`/detail/${featured.id}`)} style={styles.hero}>
          <Image source={artwork(featured.backdropUrl || featured.posterUrl, true)} style={styles.heroImage} />
          <LinearGradient colors={['transparent', 'rgba(9,10,14,0.32)', colors.background]} locations={[0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroCopy}>
            <View style={[styles.kicker, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.primaryForeground, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }}>FEATURED TONIGHT</Text>
            </View>
            <Text numberOfLines={2} style={[styles.heroTitle, { color: colors.foreground }]}>{featured.title}</Text>
            <View style={styles.heroMeta}>
              <Text style={[styles.metaText, { color: colors.accent }]}>{featured.year || 'NEW'}</Text>
              <View style={styles.metaDot} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>{featured.mediaType === 'tv' ? `${featured.seasons || 1} seasons` : `${featured.runtimeMinutes || 0} min`}</Text>
              <View style={styles.metaDot} />
              <Feather name="star" size={13} color={colors.accent} />
              <Text style={[styles.metaText, { color: colors.foreground }]}>{featured.rating ? featured.rating.toFixed(1) : 'NR'}</Text>
            </View>
            <Text numberOfLines={2} style={[styles.heroOverview, { color: colors.mutedForeground }]}>{featured.overview}</Text>
            <View style={styles.heroButtons}>
              <PlayButton onPress={() => router.push({ pathname: '/player', params: { id: String(featured.id) } })} />
              <Pressable testID="save-featured" onPress={() => toggleSaved(featured)} style={[styles.saveButton, { borderColor: colors.border }]}>
                <Feather name={isSaved(featured.id) ? 'check' : 'plus'} size={18} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 13 }}>{isSaved(featured.id) ? 'Saved' : 'My list'}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
        <View style={styles.content}>
          <View style={styles.sectionIntro}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>CURATED FOR YOU</Text>
              <Text style={[styles.pageTitle, { color: colors.foreground }]}>Find your next watch.</Text>
            </View>
            <Text style={[styles.syncText, { color: colors.mutedForeground }]}>LIVE CATALOG</Text>
          </View>
          {query.data.rails.map((rail) => <Rail key={rail.title} title={rail.title} items={rail.items} />)}
          <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>Catalog synced {new Date(query.data.syncedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Stream only from licensed sources.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function LoadingHome() {
  const colors = useColors();
  return <View style={{ padding: 16 }}><View style={[styles.skeletonHero, { backgroundColor: colors.card }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.card }]} /><View style={styles.skeletonRow}>{[0, 1, 2].map((i) => <View key={i} style={[styles.skeletonPoster, { backgroundColor: colors.card }]} />)}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 18, paddingBottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', gap: 8 },
  hero: { height: 528, marginHorizontal: 14, borderRadius: 24, overflow: 'hidden' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroCopy: { position: 'absolute', left: 22, right: 22, bottom: 23 },
  kicker: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, marginBottom: 13 },
  heroTitle: { fontSize: 39, lineHeight: 42, fontWeight: '800', letterSpacing: -1.3 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  metaText: { fontSize: 12, fontWeight: '700' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#A69DA1' },
  heroOverview: { fontSize: 13, lineHeight: 19, marginTop: 11, maxWidth: 320 },
  heroButtons: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 17 },
  saveButton: { height: 48, paddingHorizontal: 15, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  content: { paddingHorizontal: 18 },
  sectionIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 29 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  pageTitle: { fontSize: 23, fontWeight: '800', letterSpacing: -0.4 },
  syncText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 4 },
  footerNote: { fontSize: 11, lineHeight: 18, marginTop: 30, paddingBottom: 20 },
  skeletonHero: { height: 500, borderRadius: 24, opacity: 0.7 },
  skeletonLine: { width: 180, height: 22, borderRadius: 8, marginTop: 28 },
  skeletonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  skeletonPoster: { width: 112, height: 164, borderRadius: 9 },
});