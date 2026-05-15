import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import { ThemedText } from './ThemedText';
import type { ThemeColors } from '../constants/theme';

type MermaidGraphProps = {
  chart: string;
  colors: ThemeColors;
  isDark: boolean;
};

const buildMermaidHtml = (chart: string, isDark: boolean, fullScreen: boolean) => {
  const encodedChart = JSON.stringify(chart);
  const theme = isDark ? 'dark' : 'default';
  const background = isDark ? '#1C1C1C' : '#FFFEF2';
  const text = isDark ? '#F5F0E8' : '#111111';

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=8, user-scalable=yes">
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: 100%;
        background: ${background};
        color: ${text};
        overflow: ${fullScreen ? 'auto' : 'hidden'};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #graph {
        box-sizing: border-box;
        padding: ${fullScreen ? '18px' : '10px'};
        transform-origin: center center;
        transition: transform 120ms ease;
      }
      #graph svg {
        display: block;
        max-width: ${fullScreen ? 'none' : '100%'};
        height: auto;
      }
      .error {
        box-sizing: border-box;
        padding: 16px;
        white-space: pre-wrap;
        font-size: 14px;
        line-height: 20px;
      }
    </style>
  </head>
  <body>
    <div id="graph"></div>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
      const source = ${encodedChart};
      let zoom = 1;

      function post(payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function applyZoom() {
        document.getElementById('graph').style.transform = 'scale(' + zoom + ')';
      }

      window.zoomIn = function() {
        zoom = Math.min(zoom * 1.2, 6);
        applyZoom();
      };

      window.zoomOut = function() {
        zoom = Math.max(zoom / 1.2, 0.25);
        applyZoom();
      };

      window.fitGraph = function() {
        zoom = 1;
        applyZoom();
        window.scrollTo(0, 0);
      };

      async function renderGraph() {
        const graph = document.getElementById('graph');
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: '${theme}',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: true, htmlLabels: true },
            sequence: { useMaxWidth: true },
            gantt: { useMaxWidth: true }
          });
          const result = await mermaid.render('graph-' + Date.now(), source);
          graph.innerHTML = result.svg;
          const svg = graph.querySelector('svg');
          if (svg) {
            svg.removeAttribute('width');
            svg.removeAttribute('height');
            if (${fullScreen ? 'true' : 'false'}) {
              svg.style.minWidth = '100%';
            } else {
              svg.style.width = '100%';
            }
          }
          post({ type: 'rendered' });
        } catch (error) {
          graph.innerHTML = '<div class="error">Mermaid render failed\\n\\n' +
            String(error && (error.message || error)).replace(/[<>&]/g, function(char) {
              return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char];
            }) +
            '</div>';
          post({ type: 'error' });
        }
      }

      if (window.mermaid) {
        renderGraph();
      } else {
        window.addEventListener('load', renderGraph);
      }
    </script>
  </body>
</html>`;
};

export const MermaidGraph: React.FC<MermaidGraphProps> = ({ chart, colors, isDark }) => {
  const { width, height } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [fullLoading, setFullLoading] = useState(true);
  const previewHtml = useMemo(() => buildMermaidHtml(chart, isDark, false), [chart, isDark]);
  const fullHtml = useMemo(() => buildMermaidHtml(chart, isDark, true), [chart, isDark]);
  const previewHeight = Math.min(260, Math.max(180, height * 0.28));

  useEffect(() => {
    setPreviewLoading(true);
  }, [chart, isDark]);

  const runZoom = (script: string) => {
    return `${script}; true;`;
  };

  const fullWebViewRef = React.useRef<WebView>(null);

  return (
    <>
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
        onPress={() => {
          setFullLoading(true);
          setModalVisible(true);
        }}
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

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalToolbar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => setModalVisible(false)}
              accessibilityLabel="Close Mermaid graph"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle} numberOfLines={1}>Mermaid Graph</ThemedText>
            <View style={styles.zoomControls}>
              <TouchableOpacity
                style={[styles.toolbarButton, { borderColor: colors.border }]}
                onPress={() => fullWebViewRef.current?.injectJavaScript(runZoom('window.zoomOut()'))}
                accessibilityLabel="Zoom out"
              >
                <Ionicons name="remove" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolbarButton, { borderColor: colors.border }]}
                onPress={() => fullWebViewRef.current?.injectJavaScript(runZoom('window.fitGraph()'))}
                accessibilityLabel="Fit graph"
              >
                <Ionicons name="scan-outline" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolbarButton, { borderColor: colors.border }]}
                onPress={() => fullWebViewRef.current?.injectJavaScript(runZoom('window.zoomIn()'))}
                accessibilityLabel="Zoom in"
              >
                <Ionicons name="add" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.fullGraphFrame, { borderColor: colors.border }]}>
            <WebView
              ref={fullWebViewRef}
              originWhitelist={['*']}
              source={{ html: fullHtml }}
              style={styles.webView}
              scalesPageToFit={Platform.OS === 'android'}
              setBuiltInZoomControls
              setDisplayZoomControls={false}
              onMessage={() => setFullLoading(false)}
              onLoadEnd={() => setFullLoading(false)}
            />
            {fullLoading && (
              <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
                <ActivityIndicator color={colors.text} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
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
  modalRoot: {
    flex: 1,
  },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 48 : 12,
    paddingBottom: 10,
    gap: 8,
  },
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 40,
  },
  modalTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  fullGraphFrame: {
    flex: 1,
    borderTopWidth: 0,
  },
});
