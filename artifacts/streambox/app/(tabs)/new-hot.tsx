import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  customFetch,
  discoverCatalog,
  type Title,
} from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { EmptyState, PosterCard } from '@/components/StreamBox';

const CARD_WIDTH = 108;

export default function NewHotScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [browseType, setBrowseType] = useState<'movie' | 'tv'>('movie');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 450);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useQuery<Title[]>({
    queryKey: ['/api/catalog/search', debouncedQuery],
    queryFn: ({ signal }) =>
      customFetch<Title[]>(
        `/api/catalog/search?q=${encodeURIComponent(debouncedQuery)}`,
        { signal },
      ),
    enabled: debouncedQuery.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const showResults = debouncedQuery.length > 0;
  const browse = useInfiniteQuery({
    queryKey: ['/api/catalog/discover', browseType],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      discoverCatalog(
        { type: browseType, page: pageParam },
        { signal },
      ),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: !showResults,
    staleTime: 10 * 60 * 1000,
  });
  const browseItems = useMemo(() => {
    const seen = new Set<string>();
    return (browse.data?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((item) => {
        const key = `${item.mediaType}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [browse.data?.pages]);

  function loadMoreIfNeeded(event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isNearBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 520;
    if (isNearBottom && browse.hasNextPage && !browse.isFetchingNextPage) {
      void browse.fetchNextPage();
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New & Hot</Text>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityLabel="Cast to TV"
            onPress={() => alert('Choose a nearby screen to cast this title.')}
            style={styles.iconBtn}
          >
            <Ionicons name="tv-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/my-list')} style={styles.avatar}>
            <Ionicons name="person" size={16} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color="#888" style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Search movies & shows…"
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => { setQuery(''); setDebouncedQuery(''); }}
            style={styles.clearBtn}
          >
            <Ionicons name="close" size={16} color="#888" />
          </Pressable>
        )}
      </View>

      {!showResults && (
        <View style={styles.browseControls}>
          <Text style={styles.browseTitle}>Browse the catalog</Text>
          <View style={styles.typeSwitch}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: browseType === 'movie' }}
              onPress={() => setBrowseType('movie')}
              style={[styles.typeChip, browseType === 'movie' && styles.typeChipActive]}
            >
              <Text style={[styles.typeChipText, browseType === 'movie' && styles.typeChipTextActive]}>
                Movies
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: browseType === 'tv' }}
              onPress={() => setBrowseType('tv')}
              style={[styles.typeChip, browseType === 'tv' && styles.typeChipActive]}
            >
              <Text style={[styles.typeChipText, browseType === 'tv' && styles.typeChipTextActive]}>
                Series
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Results */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={loadMoreIfNeeded}
        scrollEventThrottle={250}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
      >
        {showResults ? (
          search.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#E50914" />
            </View>
          ) : search.isError ? (
            <EmptyState
              icon="wifi-off"
              title="Search unavailable"
              body="Could not reach the catalog. Try again in a moment."
            />
          ) : !search.data || search.data.length === 0 ? (
            <EmptyState
              icon="film"
              title="No results"
              body={`Nothing matched "${debouncedQuery}". Try a different title.`}
            />
          ) : (
            <View style={styles.results}>
              <Text style={styles.resultCount}>
                {search.data.length} result{search.data.length !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
              </Text>
              <View style={styles.grid}>
                {search.data.map((title) => (
                  <PosterCard
                    key={`${title.mediaType}-${title.id}`}
                    title={title}
                    width={CARD_WIDTH}
                  />
                ))}
              </View>
            </View>
          )
        ) : browse.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#E50914" />
          </View>
        ) : browse.isError ? (
          <EmptyState
            icon="wifi-off"
            title="Catalog unavailable"
            body="Could not load the catalog. Try again in a moment."
          />
        ) : browseItems.length === 0 ? (
          <EmptyState
            icon="film"
            title="No catalog titles"
            body="There are no titles available for this category yet."
          />
        ) : (
          <View style={styles.results}>
            <Text style={styles.resultCount}>
              {browseItems.length.toLocaleString()} {browseType === 'movie' ? 'movie' : 'series'} titles loaded
              {browse.data?.pages[0]?.totalResults
                ? ` of ${browse.data.pages[0].totalResults.toLocaleString()}`
                : ''}
            </Text>
            <View style={styles.grid}>
              {browseItems.map((title) => (
                <PosterCard
                  key={`${title.mediaType}-${title.id}`}
                  title={title}
                  width={CARD_WIDTH}
                />
              ))}
            </View>
            {browse.isFetchingNextPage && (
              <ActivityIndicator style={styles.moreLoading} size="small" color="#E50914" />
            )}
            {!browse.hasNextPage && browseItems.length > 0 && (
              <Text style={styles.endLabel}>End of the available catalog</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  clearBtn: { padding: 4 },
  browseControls: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  browseTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  typeSwitch: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  typeChipActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  typeChipText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: '#fff',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  results: { paddingHorizontal: 14, paddingTop: 4 },
  resultCount: { color: '#888', fontSize: 12, fontWeight: '500', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moreLoading: { marginVertical: 24 },
  endLabel: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 22 },
});
