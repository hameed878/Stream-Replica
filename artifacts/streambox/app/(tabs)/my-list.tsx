import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Title } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useMyList } from '@/hooks/useMyList';
import { EmptyState, PosterCard } from '@/components/StreamBox';

const CARD_WIDTH = 108;

export default function MyListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { savedTitles, hydrated } = useMyList();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>My List</Text>
        {savedTitles.length > 0 && (
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {savedTitles.length} title{savedTitles.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {!hydrated ? null : savedTitles.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Your list is empty"
          body="Save movies and shows to watch later. Tap the + button on any title."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 108, flexGrow: 1 }}
        >
          <View style={styles.grid}>
            {savedTitles.map((t) => (
              <PosterCard key={`${t.mediaType}-${t.id}`} title={t as Title} width={CARD_WIDTH} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heading: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  count: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
});
