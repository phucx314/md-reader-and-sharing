import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';

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
  const [isLandscapeLocked, setIsLandscapeLocked] = useState(false);
  const webViewRef = React.useRef<WebView>(null);
  const html = useMemo(() => buildMermaidHtml(String(chart), isDark, true), [chart, isDark]);

  useEffect(() => {
    let active = true;
    const syncOrientation = async () => {
      const current = await ScreenOrientation.getOrientationAsync();
      if (!active) return;
      const landscape =
        current === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscapeLocked(landscape);
    };
    syncOrientation();
    return () => {
      active = false;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  const toggleOrientation = async () => {
    if (isLandscapeLocked) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsLandscapeLocked(false);
      return;
    }
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    setIsLandscapeLocked(true);
  };

  const handleResetView = () => {
    if (Platform.OS !== 'ios') return;
    const resetScript = `
      (function() {
        if (document && document.body) {
          document.body.style.zoom = '100%';
        }
        window.scrollTo(0, 0);
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(resetScript);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => navigation.goBack()} accessibilityLabel="Close Mermaid graph">
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.title} numberOfLines={1}>Mermaid Graph</ThemedText>
        <TouchableOpacity
          style={[styles.zoomButton, { borderColor: colors.border }]}
          onPress={toggleOrientation}
          accessibilityLabel="Toggle screen orientation"
        >
          <Ionicons name={isLandscapeLocked ? 'phone-portrait-outline' : 'phone-landscape-outline'} size={19} color={colors.text} />
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.zoomButton, { borderColor: colors.border }]}
            onPress={handleResetView}
            accessibilityLabel="Reset zoom and position"
          >
            <Ionicons name="locate-outline" size={19} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.viewerFrame, { borderColor: colors.border }]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webView}
          scalesPageToFit
          setBuiltInZoomControls
          setDisplayZoomControls={Platform.OS === 'android'}
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
