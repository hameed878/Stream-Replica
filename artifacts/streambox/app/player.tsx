import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');
const TOTAL_MINUTES = 112;

function fmt(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60);
  return h > 0 ? `${h}:${String(min).padStart(2, '0')}` : `${min}:00`;
}

export default function PlayerScreen() {
  const { titleName, backdropUrl } = useLocalSearchParams<{
    id?: string;
    type?: string;
    titleName?: string;
    backdropUrl?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hideTimer, setHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Simulate playback progress
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 1) {
          setPlaying(false);
          return 1;
        }
        return p + 1 / (TOTAL_MINUTES * 60 * 10); // ~10 fps ticks
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing]);

  // Auto-hide controls when playing
  function showControls() {
    setControlsVisible(true);
    if (hideTimer) clearTimeout(hideTimer);
    if (playing) {
      const t = setTimeout(() => setControlsVisible(false), 3500);
      setHideTimer(t);
    }
  }

  useEffect(() => {
    if (playing) {
      const t = setTimeout(() => setControlsVisible(false), 3500);
      setHideTimer(t);
      return () => clearTimeout(t);
    } else {
      setControlsVisible(true);
    }
  }, [playing]);

  const elapsed = Math.round(progress * TOTAL_MINUTES);
  const remaining = TOTAL_MINUTES - elapsed;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {/* Background */}
      {backdropUrl ? (
        <Image
          source={{ uri: decodeURIComponent(backdropUrl) }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'transparent', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Tap to show/hide controls */}
      <Pressable style={StyleSheet.absoluteFill} onPress={showControls}>
        {controlsVisible && (
          <View style={styles.controls}>
            {/* Top bar */}
            <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
              <Pressable onPress={() => router.back()} style={styles.iconBtn}>
                <Feather name="x" size={21} color="#fff" />
              </Pressable>
              <Text numberOfLines={1} style={styles.titleText}>
                {titleName ? decodeURIComponent(titleName) : 'Now Playing'}
              </Text>
              <Pressable
                accessibilityLabel="Cast to TV"
                onPress={() => Alert.alert('Cast to TV', 'Choose a nearby screen to cast this title.')}
                style={styles.iconBtn}
              >
                <Feather name="cast" size={19} color="#fff" />
              </Pressable>
            </View>

            {/* Center controls */}
            <View style={styles.centerRow}>
              <Pressable
                onPress={() => setProgress((p) => Math.max(0, p - 0.07))}
                style={styles.skipWrap}
              >
                <Feather name="rotate-ccw" size={30} color="#fff" />
                <Text style={styles.skipLabel}>10</Text>
              </Pressable>

              <Pressable
                onPress={() => { setPlaying((p) => !p); }}
                style={styles.playBtn}
              >
                <Ionicons
                  name={playing ? 'pause' : 'play'}
                  size={36}
                  color="#09090e"
                  style={{ marginLeft: playing ? 0 : 5 }}
                />
              </Pressable>

              <Pressable
                onPress={() => setProgress((p) => Math.min(1, p + 0.07))}
                style={styles.skipWrap}
              >
                <Feather name="rotate-cw" size={30} color="#fff" />
                <Text style={styles.skipLabel}>10</Text>
              </Pressable>
            </View>

            {/* Bottom bar */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{fmt(elapsed)}</Text>
                <Text style={styles.timeText}>−{fmt(remaining)}</Text>
              </View>

              {/* Progress bar */}
              <View style={styles.trackOuter}>
                <View style={[styles.trackFill, { width: `${progress * 100}%` as any }]} />
                <View style={[styles.thumb, { left: `${Math.min(progress * 100, 97)}%` as any }]} />
              </View>

              {/* Action row */}
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityLabel={muted ? 'Unmute' : 'Mute'}
                  onPress={() => setMuted((value) => !value)}
                  style={styles.iconBtn}
                >
                  <Feather name={muted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
                </Pressable>
                <Text style={styles.qualityBadge}>HD</Text>
                <Pressable
                  accessibilityLabel="Toggle fullscreen"
                  onPress={() => Alert.alert('Fullscreen', 'Fullscreen mode is ready for this preview.')}
                  style={styles.iconBtn}
                >
                  <Feather name="maximize" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  controls: { flex: 1, justifyContent: 'space-between' },

  // Top
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  titleText: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginHorizontal: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Center
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 44,
  },
  skipWrap: { alignItems: 'center', justifyContent: 'center' },
  skipLabel: {
    position: 'absolute',
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    bottom: -4,
  },
  playBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom
  bottomBar: { paddingHorizontal: 20 },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  trackOuter: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 2,
    marginBottom: 20,
    justifyContent: 'center',
  },
  trackFill: { height: '100%', backgroundColor: '#E03F5D', borderRadius: 2 },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    marginLeft: -7,
    top: -5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qualityBadge: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
});
