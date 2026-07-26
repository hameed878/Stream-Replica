import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customFetch, type Title } from '@workspace/api-client-react';
import { useMyList } from '@/hooks/useMyList';
import {
  artwork,
  DownloadButton,
  NetflixTypeBadge,
  PlayButtonFull,
  triggerTap,
  VerticalAction,
} from '@/components/StreamBox';

const { width: SCREEN_W } = Dimensions.get('window');
const PREVIEW_H = SCREEN_W * 0.56;
const STILL_W = SCREEN_W * 0.55;
const STILL_H = STILL_W / 1.78;

export default function DetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSaved } = useMyList();
  const [expanded, setExpanded] = useState(false);

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
    <View style={styles.screen}>
      {/* Loading */}
      {query.isLoading && (
        <View style={{ paddingTop: insets.top + 60 }}>
          <View style={[styles.skeletonPreview]} />
          <View style={{ padding: 16, gap: 12 }}>
            <View style={[styles.skeletonLine, { width: 220 }]} />
            <View style={[styles.skeletonLine, { width: 150 }]} />
            <View style={[styles.skeletonLine, { width: 200 }]} />
          </View>
        </View>
      )}

      {/* Error */}
      {query.isError && (
        <View style={[styles.errorCenter, { paddingTop: insets.top + 60 }]}>
          <Ionicons name="alert-circle-outline" size={40} color="#E50914" />
          <Text style={styles.errorTitle}>Title not found</Text>
          <Pressable onPress={() => router.back()} style={styles.goBack}>
            <Text style={styles.goBackText}>Go Back</Text>
          </Pressable>
        </View>
      )}

      {/* Content */}
      {title && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* ── Video Preview ── */}
          <View style={styles.preview}>
            <Image
              source={artwork(title.backdropUrl || title.posterUrl, true)}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            {/* Dark overlay */}
            <View style={styles.previewOverlay} />
            {/* Play icon */}
            <View style={styles.previewPlayBtn}>
              <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.9)" />
            </View>
            {/* "Preview" label */}
            <View style={styles.previewLabel}>
              <Text style={styles.previewLabelText}>Preview</Text>
            </View>
            {/* Back + top actions overlay */}
            <View style={[styles.previewTopBar, { paddingTop: insets.top + 4 }]}>
              <Pressable onPress={() => router.back()} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </Pressable>
              <View style={styles.topBarRight}>
                <Pressable style={styles.iconBtn}>
                  <Ionicons name="tv-outline" size={22} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(tabs)/search')}
                  style={styles.iconBtn}
                >
                  <Ionicons name="search" size={22} color="#fff" />
                </Pressable>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={14} color="#fff" />
                </View>
              </View>
            </View>
          </View>

          {/* ── Title info ── */}
          <View style={styles.info}>
            {/* N SERIES / N FILM */}
            <NetflixTypeBadge type={mediaType} />

            {/* Title */}
            <Text style={styles.titleText}>{title.title}</Text>

            {/* Meta row */}
            <View style={styles.metaRow}>
              <Text style={styles.metaYear}>{title.year || '—'}</Text>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>
                  {title.mediaType === 'tv' ? '16+' : 'PG-13'}
                </Text>
              </View>
              <Text style={styles.metaItem}>
                {title.mediaType === 'tv'
                  ? `${title.seasons || 1} Season${(title.seasons || 1) !== 1 ? 's' : ''}`
                  : `${title.runtimeMinutes || 0} min`}
              </Text>
              <View style={styles.hdBadge}>
                <Text style={styles.hdText}>HD</Text>
              </View>
              <View style={styles.hdBadge}>
                <Text style={styles.hdText}>AD</Text>
              </View>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color="#aaa" />
            </View>

            {/* Play & Download buttons */}
            <PlayButtonFull
              onPress={() =>
                router.push(
                  `/player?id=${title.id}&type=${title.mediaType}&titleName=${encodeURIComponent(title.title)}&backdropUrl=${encodeURIComponent(title.backdropUrl || '')}`,
                )
              }
            />
            <DownloadButton
              label={title.mediaType === 'tv' ? 'Download S1:E1' : 'Download'}
            />

            {/* Overview */}
            <View style={styles.section}>
              <Pressable onPress={() => setExpanded((v) => !v)}>
                <Text style={styles.overview} numberOfLines={expanded ? undefined : 3}>
                  {title.overview}
                </Text>
                {!expanded && title.overview && title.overview.length > 120 && (
                  <Text style={styles.moreText}>more</Text>
                )}
              </Pressable>
            </View>

            {/* Starring / Creator */}
            {title.cast.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.creditLine}>
                  <Text style={styles.creditKey}>Starring: </Text>
                  <Text style={styles.creditVal}>
                    {title.cast.slice(0, 3).join(', ')}
                    {title.cast.length > 3 ? '... ' : ''}
                  </Text>
                  {title.cast.length > 3 && (
                    <Text style={styles.moreText}>more</Text>
                  )}
                </Text>
              </View>
            )}

            {/* ── Bottom Action Row: My List / Rate / Share / Download ── */}
            <View style={styles.actionRow}>
              <VerticalAction
                icon={
                  <Ionicons
                    name={isSaved(title.id) ? 'checkmark' : 'add'}
                    size={26}
                    color="#fff"
                  />
                }
                label={isSaved(title.id) ? 'Saved' : 'My List'}
                onPress={() => { triggerTap(); toggleSaved(title); }}
              />
              <VerticalAction
                icon={<Ionicons name="thumbs-up-outline" size={26} color="#fff" />}
                label="Rate"
              />
              <VerticalAction
                icon={<Ionicons name="share-social-outline" size={26} color="#fff" />}
                label="Share"
              />
              <VerticalAction
                icon={<Ionicons name="download-outline" size={26} color="#fff" />}
                label={title.mediaType === 'tv' ? 'Download\nSeason 1' : 'Download'}
              />
            </View>
          </View>

          {/* Stills */}
          {title.stillUrls.length > 0 && (
            <View style={styles.stillsSection}>
              <Text style={styles.stillsLabel}>More Like This</Text>
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
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },

  // Preview
  preview: {
    width: '100%',
    height: PREVIEW_H + 56,
    position: 'relative',
    backgroundColor: '#141414',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  previewPlayBtn: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  previewLabelText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  previewTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  // Info block
  info: { paddingHorizontal: 16, paddingTop: 14 },

  titleText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 10,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  metaYear: { color: '#AAAAAA', fontSize: 14, fontWeight: '500' },
  metaItem: { color: '#AAAAAA', fontSize: 14, fontWeight: '500' },
  ratingBadge: {
    borderWidth: 1,
    borderColor: '#666',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  ratingText: { color: '#AAAAAA', fontSize: 12, fontWeight: '600' },
  hdBadge: {
    borderWidth: 1,
    borderColor: '#555',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  hdText: { color: '#AAAAAA', fontSize: 11, fontWeight: '700' },

  // Text
  section: { marginBottom: 10 },
  overview: { color: '#CCCCCC', fontSize: 14, lineHeight: 21 },
  creditLine: { fontSize: 13, lineHeight: 20 },
  creditKey: { color: '#888', fontSize: 13 },
  creditVal: { color: '#CCC', fontSize: 13 },
  moreText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Bottom action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    marginTop: 20,
    marginBottom: 6,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },

  // Stills
  stillsSection: { marginTop: 20 },
  stillsLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  still: { borderRadius: 4, backgroundColor: '#141414' },

  // Loading
  skeletonPreview: {
    height: PREVIEW_H + 56,
    backgroundColor: '#141414',
  },
  skeletonLine: { height: 18, borderRadius: 4, backgroundColor: '#1A1A1A' },

  // Error
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  errorTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  goBack: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goBackText: { color: '#fff', fontWeight: '700' },
});
