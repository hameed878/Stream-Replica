import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Title } from '@workspace/api-client-react';
import { useMyList } from '@/hooks/useMyList';
import { useRouter } from 'expo-router';
import { EmptyState, PosterCard } from '@/components/StreamBox';

const CARD_WIDTH = 108;

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedTitles, hydrated } = useMyList();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Downloads</Text>
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

      {!hydrated ? null : savedTitles.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="download"
            title="No Downloads"
            body="Titles you save to My List will appear here for offline viewing."
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        >
          <Text style={styles.countLabel}>
            {savedTitles.length} saved title{savedTitles.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.grid}>
            {savedTitles.map((t) => (
              <PosterCard
                key={`${t.mediaType}-${t.id}`}
                title={t as Title}
                width={CARD_WIDTH}
              />
            ))}
          </View>
        </ScrollView>
      )}
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
  emptyWrap: { flex: 1 },
  countLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
  },
});
