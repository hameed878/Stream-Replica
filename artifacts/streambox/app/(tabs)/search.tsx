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
import { Feather } from '@expo/vector-icons';
import { customFetch, type Title } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { EmptyState, PosterCard } from '@/components/StreamBox';

const CARD_WIDTH = 108;

export default function SearchScreen() {
  const colors = useColors();
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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.headerArea, { paddingTop: insets.top + 16 }]}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.input, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={17} color={colors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder="Search movies & shows…"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery('');
                setDebouncedQuery('');
              }}
              style={styles.clearBtn}
            >
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Results */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 108, flexGrow: 1 }}
      >
        {!showResults ? (
          <EmptyState
            icon="search"
            title="What are you looking for?"
            body="Search for a movie or show by title, genre, or actor."
          />
        ) : search.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : search.isError ? (
          <EmptyState
            icon="wifi-off"
            title="Search unavailable"
            body="We couldn't reach the catalog right now. Try again in a moment."
          />
        ) : !search.data || search.data.length === 0 ? (
          <EmptyState
            icon="film"
            title="No results"
            body={`Nothing matched "${debouncedQuery}". Try a different title or spelling.`}
          />
        ) : (
          <View style={styles.results}>
            <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
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
  screen: { flex: 1 },
  headerArea: { paddingHorizontal: 18, paddingBottom: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  clearBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  results: { paddingHorizontal: 18, paddingTop: 10 },
  resultCount: { fontSize: 12, fontWeight: '600', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
