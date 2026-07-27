import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOTAL_MINUTES = 112;

const palette = {
  ink: '#090A0E',
  panel: '#15161C',
  panelRaised: '#202127',
  text: '#F4F0EC',
  textMuted: '#B1AEB2',
  textFaint: '#79777E',
  line: 'rgba(244,240,236,0.16)',
  softLine: 'rgba(244,240,236,0.09)',
  glass: 'rgba(14,15,20,0.72)',
  glassStrong: 'rgba(12,13,17,0.9)',
  accent: '#EC4056',
  accentDeep: '#9E253A',
  white: '#F9F7F4',
};

function fmt(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return hours > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `${mins}:00`;
}

function decodeParam(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

type IconButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'quiet' | 'solid';
  testID?: string;
};

function IconButton({
  accessibilityLabel,
  onPress,
  children,
  variant = 'quiet',
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.iconButton,
        variant === 'solid' && styles.iconButtonSolid,
        pressed && styles.iconButtonPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

function UtilityButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.utilityButton, pressed && styles.utilityButtonPressed]}
    >
      <Feather name={icon} size={18} color={palette.text} />
      <Text style={styles.utilityLabel}>{label}</Text>
    </Pressable>
  );
}

export default function PlayerScreen() {
  const { titleName, backdropUrl, type } = useLocalSearchParams<{
    id?: string;
    type?: string;
    titleName?: string;
    backdropUrl?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const title = decodeParam(titleName, 'Now Playing');
  const backdrop = decodeParam(backdropUrl, '');
  const isLandscape = width > height;
  const topInset = Math.max(insets.top, Platform.OS === 'web' ? 67 : 0);
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 0);
  const isMovie = type?.toLowerCase() === 'movie';

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setProgress((current) => {
        if (current >= 1) {
          setPlaying(false);
          return 1;
        }
        return current + 1 / (TOTAL_MINUTES * 60 * 10);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing]);

  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3800);
    } else {
      setControlsVisible(true);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing]);

  function showControls() {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3800);
    }
  }

  function togglePlayback() {
    setPlaying((current) => !current);
    setControlsVisible(true);
  }

  const elapsed = Math.round(progress * TOTAL_MINUTES);
  const remaining = TOTAL_MINUTES - elapsed;

  const portraitMediaWidth = Math.max(280, Math.min(width - 32, 760));
  const landscapeMediaHeight = Math.max(
    160,
    Math.min(height - topInset - bottomInset - 174, (width - 132) * 0.5625),
  );
  const mediaWidth = isLandscape
    ? Math.min(980, landscapeMediaHeight * (16 / 9))
    : portraitMediaWidth;
  const mediaHeight = isLandscape ? landscapeMediaHeight : portraitMediaWidth * 0.5625;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {backdrop ? (
        <Image
          source={{ uri: backdrop }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.backdropFallback]} />
      )}
      <LinearGradient
        colors={['rgba(7,8,11,0.88)', 'rgba(9,10,14,0.18)', 'rgba(7,8,11,0.98)']}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(236,64,86,0.10)', 'transparent', 'rgba(7,8,11,0.28)']}
        locations={[0, 0.28, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Pressable style={StyleSheet.absoluteFill} onPress={showControls} />

      {controlsVisible && (
        <View style={styles.controls}>
          <View style={[styles.topBar, { paddingTop: topInset + 10 }]}>
            <IconButton
              accessibilityLabel="Close player"
              onPress={() => router.back()}
              testID="player-close"
            >
              <Feather name="chevron-down" size={23} color={palette.text} />
            </IconButton>

            <View style={styles.heading}>
              <Text style={styles.brandLine}>STREAMBOX  /  PREVIEW</Text>
              <Text numberOfLines={1} style={styles.topTitle}>
                {title}
              </Text>
            </View>

            <View style={styles.topActions}>
              <IconButton
                accessibilityLabel="Cast to TV"
                onPress={() => Alert.alert('Cast to TV', 'Choose a nearby screen to cast this title.')}
              >
                <Feather name="cast" size={18} color={palette.text} />
              </IconButton>
              <IconButton
                accessibilityLabel="More player options"
                onPress={() => Alert.alert('Player options', 'Playback preferences are ready for this preview.')}
              >
                <Feather name="more-horizontal" size={20} color={palette.text} />
              </IconButton>
            </View>
          </View>

          <View
            style={[
              styles.stage,
              isLandscape ? styles.stageLandscape : styles.stagePortrait,
              { paddingBottom: isLandscape ? 6 : 0 },
            ]}
          >
            <View style={styles.mediaColumn}>
              <View
                style={[
                  styles.mediaFrame,
                  { width: mediaWidth, height: mediaHeight },
                ]}
              >
                {backdrop ? (
                  <Image
                    source={{ uri: backdrop }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, styles.mediaFallback]} />
                )}
                <LinearGradient
                  colors={['rgba(8,9,13,0.25)', 'transparent', 'rgba(8,9,13,0.82)']}
                  locations={[0, 0.45, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.mediaTopMeta}>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>PLAYBACK PREVIEW</Text>
                  </View>
                  <Text style={styles.mediaFormat}>HD</Text>
                </View>
                <View style={styles.centerControls}>
                  <Pressable
                    accessibilityLabel="Skip back 10 seconds"
                    accessibilityRole="button"
                    onPress={() => {
                      setProgress((current) => Math.max(0, current - 0.07));
                      showControls();
                    }}
                    style={styles.skipButton}
                  >
                    <Feather name="rotate-ccw" size={28} color={palette.text} />
                    <Text style={styles.skipValue}>10</Text>
                  </Pressable>
                  <IconButton
                    accessibilityLabel={playing ? 'Pause' : 'Play'}
                    onPress={togglePlayback}
                    variant="solid"
                    testID="player-play"
                  >
                    <Ionicons
                      name={playing ? 'pause' : 'play'}
                      size={31}
                      color={palette.ink}
                      style={{ marginLeft: playing ? 0 : 3 }}
                    />
                  </IconButton>
                  <Pressable
                    accessibilityLabel="Skip forward 10 seconds"
                    accessibilityRole="button"
                    onPress={() => {
                      setProgress((current) => Math.min(1, current + 0.07));
                      showControls();
                    }}
                    style={styles.skipButton}
                  >
                    <Feather name="rotate-cw" size={28} color={palette.text} />
                    <Text style={styles.skipValue}>10</Text>
                  </Pressable>
                </View>
                <View style={styles.mediaBottomCopy}>
                  <Text style={styles.mediaEyebrow}>{isMovie ? 'FEATURE PRESENTATION' : 'CONTINUE WATCHING'}</Text>
                  <Text numberOfLines={1} style={styles.mediaTitle}>
                    {title}
                  </Text>
                </View>
              </View>

              {!isLandscape && (
                <View style={styles.metadataBlock}>
                  <View style={styles.metadataCopy}>
                    <Text style={styles.eyebrow}>NOW PLAYING</Text>
                    <Text numberOfLines={2} style={styles.metadataTitle}>
                      {title}
                    </Text>
                    <Text style={styles.metadataSubline}>
                      {isMovie ? 'Feature presentation' : 'Season 1  ·  Episode 04'}  /  {fmt(remaining)} left
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Open episode list"
                    accessibilityRole="button"
                    onPress={() => Alert.alert('Episodes', 'Episode selection is ready for this preview.')}
                    style={styles.episodeButton}
                  >
                    <Feather name="list" size={17} color={palette.text} />
                  </Pressable>
                </View>
              )}
            </View>

            {isLandscape && (
              <View style={styles.landscapeRail}>
                <UtilityButton
                  icon="message-square"
                  label="Subtitles"
                  onPress={() => Alert.alert('Subtitles', 'Subtitles are available in this preview.')}
                />
                <UtilityButton
                  icon="list"
                  label="Episodes"
                  onPress={() => Alert.alert('Episodes', 'Episode selection is ready for this preview.')}
                />
                <UtilityButton
                  icon="settings"
                  label="Settings"
                  onPress={() => Alert.alert('Playback settings', 'Playback preferences are ready for this preview.')}
                />
              </View>
            )}
          </View>

          <View style={[styles.bottomPanel, { paddingBottom: bottomInset + 14 }]}>
            <View style={styles.progressLabels}>
              <Text style={styles.timeText}>{fmt(elapsed)}</Text>
              <Text style={styles.remainingText}>-{fmt(remaining)}</Text>
            </View>
            <View style={styles.trackOuter}>
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
              <View
                style={[
                  styles.thumb,
                  { left: `${Math.min(progress * 100, 98)}%` },
                ]}
              />
            </View>
            <View style={styles.actionRow}>
              <View style={styles.actionCluster}>
                <IconButton
                  accessibilityLabel={muted ? 'Unmute' : 'Mute'}
                  onPress={() => {
                    setMuted((value) => !value);
                    showControls();
                  }}
                >
                  <Feather name={muted ? 'volume-x' : 'volume-2'} size={19} color={palette.text} />
                </IconButton>
                <Text style={styles.audioLabel}>{muted ? 'MUTED' : 'ENGLISH 5.1'}</Text>
              </View>
              <View style={styles.bottomRightActions}>
                <Text style={styles.qualityBadge}>HD</Text>
                <IconButton
                  accessibilityLabel="Toggle fullscreen"
                  onPress={() => Alert.alert('Fullscreen', 'Fullscreen mode is ready for this preview.')}
                >
                  <Feather name="maximize-2" size={19} color={palette.text} />
                </IconButton>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.ink,
  },
  controls: {
    flex: 1,
    justifyContent: 'space-between',
  },
  backdropFallback: {
    backgroundColor: palette.ink,
  },
  mediaFallback: {
    backgroundColor: palette.panel,
  },
  topBar: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heading: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 12,
  },
  brandLine: {
    color: palette.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  topTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,21,27,0.66)',
    borderWidth: 1,
    borderColor: palette.softLine,
  },
  iconButtonSolid: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.white,
    borderColor: palette.white,
  },
  iconButtonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.95 }],
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
  },
  stagePortrait: {
    alignItems: 'center',
  },
  stageLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  mediaColumn: {
    alignItems: 'center',
  },
  mediaFrame: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: 'rgba(244,240,236,0.18)',
    shadowColor: palette.ink,
    shadowOpacity: 0.5,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  mediaTopMeta: {
    position: 'absolute',
    top: 15,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(9,10,14,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(244,240,236,0.16)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
    marginRight: 6,
  },
  liveText: {
    color: palette.text,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  mediaFormat: {
    color: palette.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(244,240,236,0.35)',
    backgroundColor: 'rgba(9,10,14,0.48)',
  },
  centerControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  skipButton: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 18,
  },
  skipValue: {
    position: 'absolute',
    color: palette.text,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
  mediaBottomCopy: {
    position: 'absolute',
    left: 17,
    right: 17,
    bottom: 15,
  },
  mediaEyebrow: {
    color: 'rgba(244,240,236,0.74)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  mediaTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  metadataBlock: {
    width: '100%',
    maxWidth: 760,
    paddingHorizontal: 4,
    paddingTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metadataCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  metadataTitle: {
    color: palette.text,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  metadataSubline: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
  },
  episodeButton: {
    width: 42,
    height: 42,
    marginLeft: 12,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,21,27,0.72)',
    borderWidth: 1,
    borderColor: palette.softLine,
  },
  landscapeRail: {
    width: 58,
    marginLeft: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityButton: {
    width: 56,
    minHeight: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderRadius: 15,
    backgroundColor: 'rgba(20,21,27,0.66)',
    borderWidth: 1,
    borderColor: palette.softLine,
  },
  utilityButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  utilityLabel: {
    color: palette.textMuted,
    fontSize: 8,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.2,
  },
  bottomPanel: {
    paddingHorizontal: 20,
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  timeText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  remainingText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  trackOuter: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(244,240,236,0.21)',
    justifyContent: 'center',
    marginBottom: 14,
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  thumb: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 8,
    marginLeft: -7,
    top: -5,
    backgroundColor: palette.white,
    borderWidth: 3,
    borderColor: palette.accent,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioLabel: {
    color: palette.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.05,
    marginLeft: 10,
  },
  bottomRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityBadge: {
    color: palette.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: 'rgba(244,240,236,0.38)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
});