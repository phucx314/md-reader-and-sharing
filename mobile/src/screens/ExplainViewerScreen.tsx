import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { WebView } from 'react-native-webview';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';

type ExplainViewerProps = {
  navigation: StackNavigationProp<any, any>;
  route: RouteProp<any, any>;
};

type SelectionPayload = {
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  paragraph: string;
};

type ExplainResult = {
  term: string;
  meaning: string;
  explanation: string;
  example?: string | null;
  confidence?: string | null;
  cached: boolean;
  daily_remaining: number;
};

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildExplainHtml = (markdown: string, isDark: boolean) => {
  const blocks = markdown
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);
  const bg = isDark ? '#1C1C1C' : '#FFFEF2';
  const text = isDark ? '#F5F0E8' : '#111111';
  const muted = isDark ? '#999999' : '#666666';
  const htmlBlocks = blocks
    .map((block, idx) => {
      const escaped = escapeHtml(block);
      if (/^#{1,6}\s/.test(block)) {
        const level = Math.min(3, block.match(/^#+/)?.[0].length || 2);
        const content = escaped.replace(/^#{1,6}\s*/, '');
        return `<h${level} data-block-index="${idx}" data-context="1">${content}</h${level}>`;
      }
      return `<p data-block-index="${idx}" data-context="1">${escaped.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes">
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: ${bg};
        color: ${text};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 16px;
        line-height: 26px;
        -webkit-user-select: text;
        user-select: text;
      }
      body { padding: 20px; }
      p { margin: 8px 0; white-space: normal; }
      h1, h2, h3 { margin: 18px 0 10px; line-height: 1.25; }
      code, pre { font-family: monospace; }
      .hint { color: ${muted}; font-size: 13px; margin-bottom: 16px; }
      ::selection { background: #FACC15; color: #111111; }
    </style>
  </head>
  <body>
    <div class="hint">Select a word or phrase, then tap Explain.</div>
    <main id="content">${htmlBlocks || '<p data-block-index="0" data-context="1">Nothing to preview yet.</p>'}</main>
    <script>
      const blocks = Array.from(document.querySelectorAll('[data-context="1"]'));
      let timer = null;
      function post(payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      function closestBlock(node) {
        if (!node) return null;
        const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return el ? el.closest('[data-context="1"]') : null;
      }
      function publishSelection() {
        const sel = window.getSelection();
        const selectedText = sel ? sel.toString().trim() : '';
        if (!sel || !selectedText || selectedText.length > 160) {
          post({ type: 'selection', selectedText: '' });
          return;
        }
        const range = sel.rangeCount ? sel.getRangeAt(0) : null;
        const block = range ? closestBlock(range.commonAncestorContainer) : null;
        const idx = block ? Number(block.getAttribute('data-block-index')) : -1;
        const paragraph = block ? block.innerText.trim() : document.body.innerText.trim();
        const before = idx > 0 && blocks[idx - 1] ? blocks[idx - 1].innerText.trim() : '';
        const after = idx >= 0 && blocks[idx + 1] ? blocks[idx + 1].innerText.trim() : '';
        post({ type: 'selection', selectedText, paragraph, contextBefore: before, contextAfter: after });
      }
      document.addEventListener('selectionchange', function() {
        clearTimeout(timer);
        timer = setTimeout(publishSelection, 120);
      });
    </script>
  </body>
</html>`;
};

export const ExplainViewerScreen: React.FC<ExplainViewerProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { content = '', filename = 'Untitled.md', fileId = null } = route.params || {};
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const html = useMemo(() => buildExplainHtml(String(content), isDark), [content, isDark]);

  React.useEffect(() => {
    const showPrivacyNotice = async () => {
      const key = 'explainPrivacyNoticeSeen';
      const seen = await AsyncStorage.getItem(key);
      if (seen) return;
      Alert.alert(
        'Explain uses AI',
        'Selected text and nearby context will be sent to the configured AI provider.',
        [{ text: 'OK', onPress: () => AsyncStorage.setItem(key, 'true') }]
      );
    };
    showPrivacyNotice().catch(() => undefined);
  }, []);

  const requestExplanation = async (renew = false) => {
    if (!selection?.selectedText) {
      Toast.show({ position: 'bottom', type: 'info', text1: 'Select text first' });
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.post('/api/explain-term', {
        selected_text: selection.selectedText,
        context_before: selection.contextBefore || '',
        context_after: selection.contextAfter || '',
        paragraph: selection.paragraph || '',
        document_title: filename,
        local_file_id: fileId,
        language: 'vi',
        renew,
      });
      setResult(response.data);
      setModalVisible(true);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      Toast.show({
        position: 'bottom',
        type: 'error',
        text1: error.response?.status === 429 ? 'Daily limit reached' : 'Explain failed',
        text2: typeof detail === 'string' ? detail : 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.toolbarButton} onPress={() => navigation.goBack()} accessibilityLabel="Close explain viewer">
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.title} numberOfLines={1}>Explain</ThemedText>
        <TouchableOpacity
          style={[
            styles.explainBtn,
            { borderColor: colors.border, backgroundColor: selection?.selectedText ? colors.primary : colors.background },
          ]}
          disabled={!selection?.selectedText || loading}
          onPress={() => requestExplanation(false)}
          accessibilityLabel="Explain selected text"
        >
          {loading ? (
            <ActivityIndicator color="#111111" size="small" />
          ) : (
            <Ionicons name="sparkles-outline" size={18} color={selection?.selectedText ? '#111111' : colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webView}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload.type === 'selection') {
              setSelection(payload.selectedText ? payload : null);
            }
          } catch {
            // ignore malformed messages from the WebView
          }
        }}
      />

      {selection?.selectedText ? (
        <View style={[styles.selectionBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText type="caption" numberOfLines={1} style={{ flex: 1 }}>
            {selection.selectedText}
          </ThemedText>
          <TouchableOpacity
            style={[styles.selectionAction, { backgroundColor: colors.primary, borderColor: colors.border }]}
            onPress={() => requestExplanation(false)}
            disabled={loading}
          >
            <ThemedText type="caption" style={{ color: '#111111', fontFamily: 'SpaceGrotesk-Bold' }}>
              Explain
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <ThemedText type="subtitle" style={styles.resultTitle}>{result?.term}</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityLabel="Close explanation">
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              <ThemedText type="label" style={styles.label}>Meaning</ThemedText>
              <ThemedText style={styles.resultText}>{result?.meaning}</ThemedText>
              <ThemedText type="label" style={styles.label}>Explanation</ThemedText>
              <ThemedText style={styles.resultText}>{result?.explanation}</ThemedText>
              {result?.example ? (
                <>
                  <ThemedText type="label" style={styles.label}>Example</ThemedText>
                  <ThemedText style={styles.resultText}>{result.example}</ThemedText>
                </>
              ) : null}
              <ThemedText type="caption" muted>
                {result?.cached ? 'Cached result' : 'New result'} • {result?.daily_remaining ?? 0} requests left today
              </ThemedText>
            </ScrollView>
            <TouchableOpacity
              style={[styles.renewBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => requestExplanation(true)}
              disabled={loading}
            >
              <ThemedText type="label">Renew</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  toolbarButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 16,
  },
  explainBtn: {
    minWidth: 40,
    minHeight: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webView: { flex: 1, backgroundColor: 'transparent' },
  selectionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    borderWidth: 2,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionAction: {
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  resultCard: {
    borderTopWidth: 2,
    padding: 18,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  resultTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    fontFamily: 'SpaceGrotesk-Bold',
  },
  resultText: {
    lineHeight: 22,
  },
  renewBtn: {
    borderWidth: 2,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
});
