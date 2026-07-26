import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { customFetch, type Title } from '@workspace/api-client-react';
import { EmptyState, PosterCard } from '@/components/StreamBox';

const CARD_WIDTH = 108;

export default function NewHotScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New & Hot</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="tv-outline" size={22} color="#fff" />
          </Pressable>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
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

      {/* Results */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
      >
        {!showResults ? (
          <EmptyState
            icon="search"
            title="Search movies & shows"
            body="Find something great to watch."
          />
        ) : search.isLoading ? (
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
              {search.data.length} result{search.data.length !== 1 ? 's' : ''} for &ldquo;
              {debouncedQuery}&rdquo;
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  results: { paddingHorizontal: 14, paddingTop: 4 },
  resultCount: { color: '#888', fontSize: 12, fontWeight: '500', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
