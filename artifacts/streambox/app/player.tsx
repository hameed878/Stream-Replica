import React, { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { customFetch } from '@workspace/api-client-react';

const palette = {
  ink: '#090A0E',
  panel: '#15161C',
  text: '#F4F0EC',
  textMuted: '#B1AEB2',
  accent: '#EC4056',
  white: '#F9F7F4',
};

type StreamResponse = {
  primaryUrl: string;
  source: string;
  detailUrl?: string;
};

function decodeParam(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function PlayerScreen() {
  const {
    id = '',
    type = 'movie',
    titleName,
    episodeLabel,
  } = useLocalSearchParams<{
    id?: string;
    type?: string;
    titleName?: string;
    episodeLabel?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const title = decodeParam(titleName, 'Now Playing');
  const epLabel = decodeParam(episodeLabel, '');
  const [stream, setStream] = useState<StreamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 12_000);

    setLoading(true);
    setStream(null);
    setError(null);

    if (!id || !title) {
      setLoading(false);
      setError('A title is required before a stream can be resolved.');
      clearTimeout(timeout);
      return () => controller.abort();
    }

    customFetch<StreamResponse>(
      `/api/catalog/stream/${encodeURIComponent(id)}?type=${encodeURIComponent(String(type))}&title=${encodeURIComponent(title)}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!active) return;
        if (!result.primaryUrl) throw new Error('HindiWeb returned no player URL.');
        setStream(result);
        setWebviewLoading(true);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          controller.signal.aborted
            ? 'HindiWeb took too long to find this title.'
            : requestError instanceof Error
            ? requestError.message
            : 'HindiWeb did not return a playable stream.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [id, retry, title, type]);

  useEffect(() => {
    if (!stream || !webviewLoading || error) return;

    const timeout = setTimeout(() => {
      setWebviewLoading(false);
      setError('The HindiWeb player took too long to open.');
    }, 15_000);

    return () => clearTimeout(timeout);
  }, [error, stream, webviewLoading]);

  const topInset = Math.max(insets.top, Platform.OS === 'web' ? 60 : 0);
  const isResolving = loading || (Boolean(stream) && webviewLoading);

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {stream && !error ? (
        <WebView
          source={{ uri: stream.primaryUrl }}
          style={styles.webview}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          onLoadStart={() => setWebviewLoading(true)}
          onLoad={() => setWebviewLoading(false)}
          onError={() => {
            setWebviewLoading(false);
            setError('The HindiWeb player could not be opened.');
          }}
          onHttpError={() => {
            setWebviewLoading(false);
            setError('The HindiWeb player returned an error.');
          }}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"
        />
      ) : null}

      {isResolving && !error && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>
            {loading ? 'Finding this title on HindiWeb…' : 'Opening HindiWeb player…'}
          </Text>
          <Text style={styles.loadingSubText}>
            This will stop automatically if HindiWeb is unavailable.
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={48} color={palette.accent} />
          <Text style={styles.errorTitle}>HindiWeb stream unavailable</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => setRetry((value) => value + 1)} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>Go back</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: topInset + 6 }]} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="Close player"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name="chevron-down" size={26} color={palette.white} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.brandLine}>STREAMBOX · HINDIWEB</Text>
          <Text numberOfLines={1} style={styles.titleText}>{title}</Text>
          {epLabel ? <Text style={styles.epText}>{epLabel}</Text> : null}
          {stream && !error ? <Text style={styles.sourceText}>{stream.source}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  webview: { flex: 1, backgroundColor: palette.ink },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 5,
  },
  loadingText: { color: palette.textMuted, fontSize: 14, fontWeight: '600' },
  loadingSubText: {
    color: 'rgba(177,174,178,0.55)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 28,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    zIndex: 6,
  },
  errorTitle: { color: palette.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  errorSub: { color: palette.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  retryButton: {
    backgroundColor: palette.accent,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  backButton: {
    borderColor: 'rgba(244,240,236,0.25)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  backText: { color: palette.text, fontSize: 14, fontWeight: '700' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: 'rgba(9,10,14,0.9)',
    zIndex: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1, marginLeft: 8 },
  brandLine: { color: palette.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  titleText: { color: palette.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  epText: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  sourceText: { color: '#78D4A4', fontSize: 10, fontWeight: '700', marginTop: 3 },
});