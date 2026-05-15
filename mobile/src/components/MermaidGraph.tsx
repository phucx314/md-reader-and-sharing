import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

import { ThemedText } from './ThemedText';
import type { ThemeColors } from '../constants/theme';
import { buildMermaidHtml } from '../utils/mermaidHtml';

type MermaidGraphProps = {
  chart: string;
  colors: ThemeColors;
  isDark: boolean;
};

export const MermaidGraph: React.FC<MermaidGraphProps> = ({ chart, colors, isDark }) => {
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();
  const [previewLoading, setPreviewLoading] = useState(true);
  const previewHtml = useMemo(() => buildMermaidHtml(chart, isDark, false), [chart, isDark]);
  const previewHeight = Math.min(260, Math.max(180, height * 0.28));

  useEffect(() => {
    setPreviewLoading(true);
  }, [chart, isDark]);

  return (
    <Pressable
      style={[
        styles.previewFrame,
        {
          width: Math.max(0, width - 40),
          height: previewHeight,
          backgroundColor: isDark ? colors.surface : '#FFFEF2',
          borderColor: colors.border,
        },
      ]}
      onPress={() => navigation.navigate('MermaidViewer', { chart })}
      accessibilityRole="button"
      accessibilityLabel="Open Mermaid graph"
    >
      <WebView
        originWhitelist={['*']}
        source={{ html: previewHtml }}
        style={styles.webView}
        scrollEnabled={false}
        pointerEvents="none"
        onMessage={() => setPreviewLoading(false)}
        onLoadEnd={() => setPreviewLoading(false)}
      />
      {previewLoading && (
        <View style={[styles.loadingOverlay, { backgroundColor: isDark ? colors.surface : '#FFFEF2' }]}>
          <ActivityIndicator color={colors.text} />
        </View>
      )}
      <View style={[styles.previewBadge, { backgroundColor: colors.primary, borderColor: colors.border }]}>
        <Ionicons name="expand-outline" size={14} color="#111111" />
        <ThemedText type="caption" style={styles.previewBadgeText}>Open</ThemedText>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  previewFrame: {
    alignSelf: 'center',
    borderWidth: 2,
    marginVertical: 14,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  previewBadgeText: {
    color: '#111111',
    fontFamily: 'SpaceGrotesk-Bold',
  },
});
