import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { WebView } from 'react-native-webview';

import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { buildMermaidHtml } from '../utils/mermaidHtml';

type MermaidViewerProps = {
  navigation: StackNavigationProp<any, any>;
  route: RouteProp<any, any>;
};

export const MermaidViewerScreen: React.FC<MermaidViewerProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { chart = '' } = route.params || {};
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(() => buildMermaidHtml(String(chart), isDark, true), [chart, isDark]);

  const runZoom = (script: string) => `${script}; true;`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => navigation.goBack()} accessibilityLabel="Close Mermaid graph">
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.title} numberOfLines={1}>Mermaid Graph</ThemedText>
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.zoomButton, { borderColor: colors.border }]}
            onPress={() => webViewRef.current?.injectJavaScript(runZoom('window.zoomOut()'))}
            accessibilityLabel="Zoom out"
          >
            <Ionicons name="remove" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomButton, { borderColor: colors.border }]}
            onPress={() => webViewRef.current?.injectJavaScript(runZoom('window.fitGraph()'))}
            accessibilityLabel="Fit graph"
          >
            <Ionicons name="scan-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomButton, { borderColor: colors.border }]}
            onPress={() => webViewRef.current?.injectJavaScript(runZoom('window.zoomIn()'))}
            accessibilityLabel="Zoom in"
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.viewerFrame, { borderColor: colors.border }]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webView}
          scalesPageToFit={Platform.OS === 'android'}
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          onMessage={() => setLoading(false)}
          onLoadEnd={() => setLoading(false)}
        />
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator color={colors.text} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
  },
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 40,
  },
  title: {
    flex: 1,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  zoomButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 40,
    borderWidth: 2,
  },
  viewerFrame: {
    flex: 1,
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
});
