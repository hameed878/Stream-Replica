import React from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetCatalogHome } from '@workspace/api-client-react';
import { useMyList } from '@/hooks/useMyList';
import {
  artwork,
  ErrorState,
  FilterChip,
  PlayButton,
  Rail,
  VerticalAction,
} from '@/components/StreamBox';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HERO_H = SCREEN_H * 0.56;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSaved, toggleSaved } = useMyList();
  const query = useGetCatalogHome();
  const featured = query.data?.featured;

  if (query.isLoading) {
    return (
      <View style={styles.screen}>
        <View style={[styles.skeleton, { height: HERO_H, marginTop: insets.top + 80 }]} />
      </View>
    );
  }

  if (query.isError || !query.data || !featured) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ErrorState onRetry={() => query.refetch()} />
      </View>
    );
  }

  const genres = (featured as any).genres as string[] | undefined;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor="#E50914"
            colors={['#E50914']}
            refreshing={query.isFetching}
            onRefresh={() => query.refetch()}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ──────────── HERO ──────────── */}
        <Pressable
          testID="featured-title"
          onPress={() =>
            router.push(`/detail/${featured.id}?type=${featured.mediaType}`)
          }
          style={{ position: 'relative', height: HERO_H + insets.top + 64 }}
        >
          <Image
            source={artwork(featured.backdropUrl || featured.posterUrl, true)}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          {/* Dark top vignette so header icons are readable */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent']}
            locations={[0, 0.35]}
            style={StyleSheet.absoluteFill}
          />
          {/* Bottom fade to black */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.08)', '#000000']}
            locations={[0.5, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* ── Header overlaid on hero ── */}
          <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
            <View style={styles.headerLeft}>
              <Pressable onPress={() => router.back()} style={styles.headerIconBtn}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </Pressable>
              <Text style={styles.headerTitle}>Movies</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable style={styles.headerIconBtn}>
                <Ionicons name="tv-outline" size={22} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/search')}
                style={styles.headerIconBtn}
              >
                <Ionicons name="search" size={22} color="#fff" />
              </Pressable>
              <View style={styles.avatar}>
                <Ionicons name="person" size={16} color="#fff" />
              </View>
            </View>
          </View>

          {/* ── Filter chips ── */}
          <View style={[styles.chips, { top: insets.top + 52 }]}>
            <FilterChip label="Movies" />
            <FilterChip label="All Categories" />
          </View>

          {/* ── Hero bottom content ── */}
          <View style={styles.heroContent}>
            {/* Genre tags */}
            {genres && genres.length > 0 && (
              <Text style={styles.genreTags}>
                {genres.slice(0, 4).join(' · ')}
              </Text>
            )}

            {/* Action row: My List · Play · Info */}
            <View style={styles.heroActions}>
              <VerticalAction
                icon={
                  <Ionicons
                    name={isSaved(featured.id) ? 'checkmark' : 'add'}
                    size={26}
                    color="#fff"
                  />
                }
                label={isSaved(featured.id) ? 'Saved' : 'My List'}
                onPress={() => toggleSaved(featured)}
              />
              <PlayButton
                onPress={() =>
                  router.push(
                    `/player?id=${featured.id}&type=${featured.mediaType}&titleName=${encodeURIComponent(featured.title)}&backdropUrl=${encodeURIComponent(featured.backdropUrl || '')}`,
                  )
                }
              />
              <VerticalAction
                icon={
                  <Ionicons
                    name="information-circle-outline"
                    size={26}
                    color="#fff"
                  />
                }
                label="Info"
                onPress={() =>
                  router.push(
                    `/detail/${featured.id}?type=${featured.mediaType}`,
                  )
                }
              />
            </View>
          </View>
        </Pressable>

        {/* ──────────── RAILS ──────────── */}
        {query.data.rails.map((rail: { title: string; items: any[] }, i: number) => (
          <Rail
            key={rail.title}
            title={i === 0 ? 'Popular on Netflix' : rail.title}
            items={rail.items}
            showRank={i === 0}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  skeleton: {
    marginHorizontal: 0,
    backgroundColor: '#141414',
    opacity: 0.7,
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  // Filter chips
  chips: {
    position: 'absolute',
    left: 14,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },

  // Hero content
  heroContent: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  genreTags: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
});
