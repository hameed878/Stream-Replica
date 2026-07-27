import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import WebView, { type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';

// ─── Palette ────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// How long to wait for URL extraction before falling back to WebView
const EXTRACTION_TIMEOUT_MS = 15_000;

// ─── JS injected into the hidden WebView ─────────────────────────────────────
// Intercepts XHR, fetch, and <video src> to grab the first .m3u8 / .mp4 URL,
// then postMessages it back to React Native.
const INJECT_JS = `
(function() {
  var sent = false;

  function send(url) {
    if (sent) return;
    if (!url || typeof url !== 'string') return;
    var lower = url.toLowerCase().split('?')[0];
    if (!lower.endsWith('.m3u8') && !lower.endsWith('.mp4')) return;
    // Skip tiny/empty segments — real stream URLs tend to be longer
    if (url.length < 20) return;
    sent = true;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VIDEO_URL', url: url }));
  }

  // --- Intercept XMLHttpRequest ---
  var OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    var xhr = new OrigXHR();
    var origOpen = xhr.open.bind(xhr);
    xhr.open = function(method, url) {
      send(url);
      return origOpen.apply(this, arguments);
    };
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  // --- Intercept fetch ---
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url);
    send(url);
    return origFetch.apply(this, arguments);
  };

  // --- MutationObserver: watch <video src> ---
  function checkNode(node) {
    if (!node) return;
    if (node.tagName === 'VIDEO') {
      if (node.src) send(node.src);
      if (node.currentSrc) send(node.currentSrc);
      // Also watch for src changes via attribute
      var obs = new MutationObserver(function(muts) {
        muts.forEach(function(m) {
          if (m.attributeName === 'src' && node.src) send(node.src);
        });
      });
      obs.observe(node, { attributes: true });
    }
    if (node.querySelectorAll) {
      node.querySelectorAll('video').forEach(function(v) {
        if (v.src) send(v.src);
        if (v.currentSrc) send(v.currentSrc);
      });
    }
  }

  var domObs = new MutationObserver(function(muts) {
    muts.forEach(function(m) {
      m.addedNodes.forEach(function(n) { checkNode(n); });
    });
    // Also re-scan all videos on every mutation (some players swap src)
    document.querySelectorAll('video').forEach(function(v) {
      if (v.src) send(v.src);
      if (v.currentSrc) send(v.currentSrc);
    });
  });

  domObs.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });

  // Initial scan in case video already exists
  document.querySelectorAll('video').forEach(function(v) {
    if (v.src) send(v.src);
    if (v.currentSrc) send(v.currentSrc);
  });

  true; // required by injectedJavaScriptBeforeContentLoaded
})();
`;

// ─── Player modes ─────────────────────────────────────────────────────────────
type Mode =
  | 'extracting'   // hidden WebView is sniffing for the video URL
  | 'native'       // expo-video is playing the extracted URL
  | 'webview'      // fallback: show the WebView embed directly
  | 'error';       // all sources exhausted

// ─── Native video sub-component ──────────────────────────────────────────────
function NativePlayer({
  videoUrl,
  onError,
}: {
  videoUrl: string;
  onError: () => void;
}) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', (status) => {
      if (status.status === 'error') {
        onError();
      }
    });
    return () => sub.remove();
  }, [player, onError]);

  return (
    <VideoView
      style={StyleSheet.absoluteFillObject}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      contentFit="contain"
      nativeControls
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
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
  const [mode, setMode] = useState<Mode>('extracting');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [webviewError, setWebviewError] = useState(false);

  // Key incremented to force WebView remount on source switch
  const webviewKey = useRef(0);
  // Extraction timeout handle
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const embedUrl = buildEmbedUrl(
    id,
    type as string,
    season as string,
    episode as string,
    sourceIndex,
  );

  // ── Start/reset extraction for a given source ──
  const startExtraction = useCallback((index: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    webviewKey.current += 1;
    setSourceIndex(index);
    setMode('extracting');
    setVideoUrl(null);
    setWebviewLoading(true);
    setWebviewError(false);
    setShowSourcePicker(false);

    timeoutRef.current = setTimeout(() => {
      // Timed out waiting for a URL → fall back to showing WebView directly
      setMode('webview');
    }, EXTRACTION_TIMEOUT_MS);
  }, []);

  // Kick off extraction on mount
  useEffect(() => {
    if (id) startExtraction(0);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [id, startExtraction]);

  // ── Handle message from hidden WebView ──
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'VIDEO_URL' && data.url) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setVideoUrl(data.url);
        setMode('native');
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  // ── Native player failed (e.g. 403) → fall back to WebView ──
  const onNativeError = useCallback(() => {
    setMode('webview');
  }, []);

  // ── Switch source manually ──
  function switchSource(index: number) {
    startExtraction(index);
  }

  // ── Determine label for loading overlay ──
  const loadingLabel = mode === 'extracting'
    ? 'Resolving stream…'
    : 'Loading stream…';

  const showLoading =
    mode === 'extracting' ||
    (mode === 'webview' && webviewLoading && !webviewError);

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {/* ── Hidden extraction WebView ── */}
      {mode === 'extracting' && id ? (
        <WebView
          key={`extract-${webviewKey.current}`}
          source={{ uri: embedUrl }}
          style={styles.hidden}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          injectedJavaScript={INJECT_JS}
          onMessage={onMessage}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          // Suppress errors — we'll time out instead
          onError={() => {}}
          onHttpError={() => {}}
        />
      ) : null}

      {/* ── Native expo-video player ── */}
      {mode === 'native' && videoUrl ? (
        <NativePlayer videoUrl={videoUrl} onError={onNativeError} />
      ) : null}

      {/* ── Fallback WebView (visible embed) ── */}
      {mode === 'webview' && id ? (
        <WebView
          key={`webview-${webviewKey.current}`}
          source={{ uri: embedUrl }}
          style={styles.webview}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          onLoadStart={() => { setWebviewLoading(true); setWebviewError(false); }}
          onLoad={() => setWebviewLoading(false)}
          onError={() => { setWebviewLoading(false); setWebviewError(true); }}
          onHttpError={() => { setWebviewLoading(false); setWebviewError(true); }}
          onNavigationStateChange={(_nav: WebViewNavigation) => {}}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        />
      ) : null}

      {/* ── Dark background when no video content yet ── */}
      {(mode === 'extracting' || (!id)) ? (
        <View style={[StyleSheet.absoluteFillObject, styles.bg]} pointerEvents="none" />
      ) : null}

      {/* ── Loading overlay ── */}
      {showLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>{loadingLabel}</Text>
          {mode === 'extracting' && (
            <Text style={styles.loadingSubText}>
              Extracting native stream from source…
            </Text>
          )}
        </View>
      )}

      {/* ── WebView error state ── */}
      {mode === 'webview' && webviewError && !webviewLoading && (
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
          {mode === 'native' && (
            <Text style={styles.nativeBadge}>▶ Native Player</Text>
          )}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.ink,
  },
  bg: {
    backgroundColor: palette.ink,
  },
  hidden: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
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
  loadingSubText: {
    color: 'rgba(177,174,178,0.55)',
    fontSize: 12,
    fontWeight: '500',
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
    gap: 2,
  },
  brandLine: {
    color: palette.accent,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
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
  },
  nativeBadge: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
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
