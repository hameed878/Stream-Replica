import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';

const palette = {
  ink: '#090A0E',
  panel: '#15161C',
  text: '#F4F0EC',
  textMuted: '#B1AEB2',
  softLine: 'rgba(244,240,236,0.09)',
  glass: 'rgba(9,10,14,0.80)',
  glassStrong: 'rgba(9,10,14,0.95)',
  accent: '#EC4056',
  white: '#F9F7F4',
};

function decodeParam(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return fallback;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function buildEmbedUrl(
  id: string,
  type: string,
  season: string,
  episode: string,
  sourceIndex: number,
): string {
  const sources = type === 'tv'
    ? [
        `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`,
        `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
        `https://vidsrc.xyz/embed/tv/${id}?s=${season}&e=${episode}`,
        `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
      ]
    : [
        `https://vidsrc.to/embed/movie/${id}`,
        `https://vidsrc.me/embed/movie?tmdb=${id}`,
        `https://vidsrc.xyz/embed/movie/${id}`,
        `https://multiembed.mov/?video_id=${id}&tmdb=1`,
      ];
  return sources[Math.min(sourceIndex, sources.length - 1)];
}

const SOURCE_LABELS = ['VidSrc', 'VidSrc.me', 'VidSrc.xyz', 'MultiEmbed'];

export default function PlayerScreen() {
  const {
    id = '',
    type = 'movie',
    season = '1',
    episode = '1',
    titleName,
    episodeLabel,
  } = useLocalSearchParams<{
    id?: string;
    type?: string;
    season?: string;
    episode?: string;
    titleName?: string;
    episodeLabel?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'web' ? 60 : 0);

  const title = decodeParam(titleName, 'Now Playing');
  const epLabel = decodeParam(episodeLabel, '');

  const [sourceIndex, setSourceIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const webviewKey = useRef(0);

  const embedUrl = buildEmbedUrl(id, type as string, season as string, episode as string, sourceIndex);

  function switchSource(index: number) {
    setSourceIndex(index);
    setLoading(true);
    setError(false);
    setShowSourcePicker(false);
    webviewKey.current += 1;
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {/* ── WebView player ── */}
      {id ? (
        <WebView
          key={webviewKey.current}
          source={{ uri: embedUrl }}
          style={styles.webview}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          onLoadStart={() => { setLoading(true); setError(false); }}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          onHttpError={() => { setLoading(false); setError(true); }}
          onNavigationStateChange={(_nav: WebViewNavigation) => {}}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: palette.ink }]} />
      )}

      {/* ── Loading indicator ── */}
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Loading stream…</Text>
        </View>
      )}

      {/* ── Error state ── */}
      {error && !loading && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={48} color={palette.accent} />
          <Text style={styles.errorTitle}>Stream Unavailable</Text>
          <Text style={styles.errorSub}>Try a different source below.</Text>
          <View style={styles.errorSources}>
            {SOURCE_LABELS.map((label, i) => (
              <Pressable
                key={label}
                onPress={() => switchSource(i)}
                style={[styles.sourceBtn, i === sourceIndex && styles.sourceBtnActive]}
              >
                <Text style={[styles.sourceBtnText, i === sourceIndex && styles.sourceBtnTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: topInset + 6 }]} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="Close player"
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-down" size={26} color={palette.white} />
        </Pressable>

        <View style={styles.titleBlock}>
          <Text style={styles.brandLine}>STREAMBOX</Text>
          <Text numberOfLines={1} style={styles.titleText}>{title}</Text>
          {epLabel ? <Text style={styles.epText}>{epLabel}</Text> : null}
        </View>

        <View style={styles.topRight}>
          {/* Source picker toggle */}
          <Pressable
            accessibilityLabel="Switch source"
            onPress={() => setShowSourcePicker((v) => !v)}
            style={styles.iconBtn}
          >
            <Feather name="layers" size={19} color={palette.white} />
          </Pressable>
        </View>
      </View>

      {/* ── Source picker ── */}
      {showSourcePicker && (
        <View style={[styles.sourcePicker, { top: topInset + 66 }]}>
          <Text style={styles.sourcePickerTitle}>Select Source</Text>
          {SOURCE_LABELS.map((label, i) => (
            <Pressable
              key={label}
              onPress={() => switchSource(i)}
              style={[styles.sourcePickerRow, i === sourceIndex && styles.sourcePickerRowActive]}
            >
              <Text style={[styles.sourcePickerText, i === sourceIndex && styles.sourcePickerTextActive]}>
                {label}
              </Text>
              {i === sourceIndex && (
                <Ionicons name="checkmark" size={16} color={palette.accent} />
              )}
            </Pressable>
          ))}
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
  webview: {
    flex: 1,
    backgroundColor: palette.ink,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
  },
  errorSub: {
    color: palette.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  errorSources: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  sourceBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(244,240,236,0.2)',
    backgroundColor: 'rgba(20,21,27,0.8)',
  },
  sourceBtnActive: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(236,64,86,0.15)',
  },
  sourceBtnText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sourceBtnTextActive: {
    color: palette.accent,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: palette.glassStrong,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.softLine,
    zIndex: 20,
  },
  iconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(20,21,27,0.6)',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 10,
  },
  brandLine: {
    color: palette.accent,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 3,
  },
  titleText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  epText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourcePicker: {
    position: 'absolute',
    right: 14,
    width: 200,
    backgroundColor: palette.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244,240,236,0.12)',
    paddingVertical: 8,
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  sourcePickerTitle: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingHorizontal: 14,
    paddingBottom: 6,
    paddingTop: 2,
  },
  sourcePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sourcePickerRowActive: {
    backgroundColor: 'rgba(236,64,86,0.1)',
  },
  sourcePickerText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sourcePickerTextActive: {
    color: palette.text,
    fontWeight: '700',
  },
});
