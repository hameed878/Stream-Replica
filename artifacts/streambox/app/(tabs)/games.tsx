import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function GamesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Games</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="tv-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="search" size={22} color="#fff" />
          </Pressable>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        </View>
      </View>

      {/* Coming soon */}
      <View style={styles.center}>
        <Ionicons name="game-controller-outline" size={52} color="#333" />
        <Text style={styles.title}>Games Coming Soon</Text>
        <Text style={styles.body}>
          Netflix Games will be available here. Stay tuned.
        </Text>
      </View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { color: '#888', fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
