import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import Markdown from 'react-native-markdown-display';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { ConfirmModal } from '../components/ConfirmModal';
import { MermaidGraph } from '../components/MermaidGraph';
import { TablePreview } from '../components/TablePreview';
import { saveFile, generateUUID } from '../utils/fileStore';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { splitMarkdownWithTables } from '../utils/markdownTables';

type EditorScreenProps = {
  navigation: StackNavigationProp<any, any>;
  route: RouteProp<any, any>;
};

const DIR_URI = `${(FileSystem as any).documentDirectory}markdown_files/`;

const formatTime = (ts: number) => {
  if (!ts) return '';
  const tsMs = ts > 20000000000 ? ts : ts * 1000;
  const now = new Date();
  const date = new Date(tsMs);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffInDays = Math.floor(diffInSeconds / 86400);

  if (diffInDays > 3) {
    return date.toLocaleDateString();
  } else if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds >= 3600) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds >= 60) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

export const EditorScreen: React.FC<EditorScreenProps> = ({ navigation, route }) => {
  const { uri: initialUri, name: initialName, isNew, fileId: initialFileId } = route.params || {};
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState(initialName ? initialName.replace('.md', '') : 'Untitled');
  const [uri, setUri] = useState<string | null>(initialUri || null);
  const [fileId, setFileId] = useState<string | null>(initialFileId || null);
  const [isPreview, setIsPreview] = useState(false);
  const [lastModified, setLastModified] = useState<number>(0);
  const [isDirty, setIsDirty] = useState(false);
  const [discardModalVisible, setDiscardModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isShared, setIsShared] = useState<boolean>(false);
  const isUndoRedoAction = useRef(false);

  const { colors, isDark } = useTheme();
  const { token } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!fileId || !token) return;
      const checkShared = async () => {
        try {
          const response = await apiClient.get(`/api/share/me?skip=0&limit=1&local_file_id=${fileId}`);
          if (response.data && response.data.total > 0) {
            setIsShared(true);
          } else {
            setIsShared(false);
          }
        } catch (err) {
          // ignore
        }
      };
      checkShared();
    }, [fileId, token])
  );

  // Auto-save timer
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      handleSave(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [content, filename, isDirty]);

  // Handle back navigation when dirty
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty) {
        return;
      }
      e.preventDefault();
      setPendingAction(() => e.data.action);
      setDiscardModalVisible(true);
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  // If auto-save completes while the modal is open, just dismiss and proceed
  useEffect(() => {
    if (!isDirty && discardModalVisible && pendingAction) {
      setDiscardModalVisible(false);
      navigation.dispatch(pendingAction);
    }
  }, [isDirty, discardModalVisible, pendingAction]);

  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (history[historyIndex] !== content) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(content);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [content, history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const prevContent = history[historyIndex - 1];
      setContent(prevContent);
      setHistoryIndex(historyIndex - 1);
      setIsDirty(true);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const nextContent = history[historyIndex + 1];
      setContent(nextContent);
      setHistoryIndex(historyIndex + 1);
      setIsDirty(true);
    }
  };

  useEffect(() => {
    if (initialUri && !isNew) loadContent(initialUri);
  }, [initialUri, isNew]);

  const loadContent = async (fileUri: string) => {
    try {
      const text = await FileSystem.readAsStringAsync(fileUri);
      setContent(text);
      setHistory([text]);
      setHistoryIndex(0);
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists) {
        setLastModified((info as any).modificationTime ?? 0);
      }
      setIsDirty(false);
    } catch (e) {
      console.error('Failed to read file', e);
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to open file' });
    }
  };

  const handleSave = async (silent = false): Promise<string | null> => {
    let safeName = filename.trim() || 'Untitled';
    let finalFilename = `${safeName}.md`;
    let targetUri = uri;
    let currentFileId = fileId;
    try {
      const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
      }

      if (!targetUri || initialName !== finalFilename) {
        let uniqueFilename = finalFilename;
        let counter = 1;
        while (true) {
          const checkUri = `${DIR_URI}${uniqueFilename}`;
          if (targetUri && checkUri === uri) break;
          const checkInfo = await FileSystem.getInfoAsync(checkUri);
          if (!checkInfo.exists) break;
          uniqueFilename = `${safeName} (${counter}).md`;
          counter++;
        }
        finalFilename = uniqueFilename;
        safeName = uniqueFilename.replace('.md', '');
        if (filename !== safeName) setFilename(safeName);

        const newTargetUri = `${DIR_URI}${finalFilename}`;
        
        if (uri && uri !== newTargetUri) {
          try {
            await FileSystem.moveAsync({ from: uri, to: newTargetUri });
          } catch (err) {
            console.error('Failed to move file', err);
          }
        }
        targetUri = newTargetUri;
        
        if (!currentFileId) {
          currentFileId = generateUUID();
          setFileId(currentFileId);
        }
      }

      await FileSystem.writeAsStringAsync(targetUri!, content);
      
      if (currentFileId) {
        await saveFile({
          id: currentFileId,
          filename: finalFilename,
          uri: targetUri!,
          createdAt: Date.now()
        });
      }
      
      setUri(targetUri!);
      setIsDirty(false);
      const info = await FileSystem.getInfoAsync(targetUri!);
      if (info.exists) {
        setLastModified((info as any).modificationTime ?? 0);
      }
      if (!silent) {
        Toast.show({ position: 'bottom', type: 'success', text1: 'Saved!' });
      }
      return targetUri;
    } catch (e) {
      console.error('Failed to save file', e);
      if (!silent) {
        Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to save' });
      }
      return null;
    }
  };

  const handleShare = async () => {
    const savedUri = await handleSave();
    if (!savedUri) return;
    if (!token) {
      Toast.show({ position: 'bottom', type: 'info', text1: 'Please log in to share' });
      navigation.navigate('Auth');
      return;
    }
    navigation.navigate('Share', { uri: savedUri, filename: `${filename}.md`, fileId });
  };

  const markdownStyles = {
    body: { color: colors.text, fontFamily: 'SpaceGrotesk-Regular', fontSize: 16, lineHeight: 26, backgroundColor: isDark ? colors.background : '#FFFEF2' },
    heading1: { color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 28, borderBottomWidth: 2, borderBottomColor: colors.border, paddingBottom: 8, marginBottom: 16, marginTop: 24 },
    heading2: { color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 22, marginTop: 20, marginBottom: 12 },
    heading3: { color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, marginTop: 16, marginBottom: 10 },
    paragraph: { marginTop: 8, marginBottom: 8 },
    code_block: { backgroundColor: isDark ? '#2A2A2A' : '#E8F4F8', color: isDark ? '#E5E5E5' : '#111111', borderColor: colors.border, borderWidth: 2, borderRadius: 0, padding: 16, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginVertical: 12 },
    fence: { backgroundColor: isDark ? '#2A2A2A' : '#E8F4F8', color: isDark ? '#E5E5E5' : '#111111', borderColor: colors.border, borderWidth: 2, borderRadius: 0, padding: 16, marginVertical: 12 },
    blockquote: { borderLeftWidth: 4, borderLeftColor: colors.primary, paddingLeft: 16, backgroundColor: colors.primary + (isDark ? '22' : '33'), marginVertical: 16, paddingVertical: 8 },
    strong: { fontFamily: 'SpaceGrotesk-Bold' },
    code_inline: { backgroundColor: isDark ? '#333' : '#FEF08A', color: isDark ? '#FFF' : '#111', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
    s: { textDecorationLine: 'line-through' },
    table: { marginVertical: 16, borderColor: colors.border, borderWidth: 2 },
    hr: { marginVertical: 24, backgroundColor: colors.border, height: 2 },
  };

  const markdownRules = {
    fence: (node: any) => {
      const language = String(node.sourceInfo || node.info || '').trim().split(/\s+/)[0].toLowerCase();
      const code = String(node.content || '');

      if (language === 'mermaid') {
        return <MermaidGraph key={node.key} chart={code} colors={colors} isDark={isDark} />;
      }

      return (
        <Text key={node.key} style={markdownStyles.fence as any}>
          {code}
        </Text>
      );
    },
  };
  const previewBlocks = splitMarkdownWithTables(content || '*Nothing to preview yet…*');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Header ──────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <TextInput
          style={[styles.filenameInput, { color: colors.text }]}
          value={filename}
          onChangeText={(text) => { setFilename(text); setIsDirty(true); }}
          placeholder="Filename"
          placeholderTextColor={isDark ? '#888' : '#999'}
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          onBlur={() => handleSave(true)}
          selectTextOnFocus
        />

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleUndo} disabled={historyIndex <= 0} style={styles.headerBtn} accessibilityLabel="Undo">
            <Ionicons name="arrow-undo-outline" size={22} color={historyIndex <= 0 ? (isDark ? '#555' : '#ccc') : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRedo} disabled={historyIndex >= history.length - 1} style={styles.headerBtn} accessibilityLabel="Redo">
            <Ionicons name="arrow-redo-outline" size={22} color={historyIndex >= history.length - 1 ? (isDark ? '#555' : '#ccc') : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSave(false)} style={styles.headerBtn} accessibilityLabel="Save">
            <Ionicons name="save-outline" size={22} color={colors.text} />
            {isDirty && (
              <View style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn} accessibilityLabel="Share">
            <Ionicons name="share-social-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Edit/Preview pill toggle ────────────── */}
      <View style={[styles.toggleRow, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.togglePill, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.toggleOption, !isPreview && { backgroundColor: colors.primary }]}
            onPress={() => setIsPreview(false)}
          >
            <Ionicons name="create-outline" size={14} color={!isPreview ? '#111' : colors.text} style={{ marginRight: 4 }} />
            <ThemedText type="caption" style={{ color: !isPreview ? '#111' : colors.text, fontFamily: 'SpaceGrotesk-Bold' }}>Edit</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, isPreview && { backgroundColor: colors.primary }]}
            onPress={() => setIsPreview(true)}
          >
            <Ionicons name="eye-outline" size={14} color={isPreview ? '#111' : colors.text} style={{ marginRight: 4 }} />
            <ThemedText type="caption" style={{ color: isPreview ? '#111' : colors.text, fontFamily: 'SpaceGrotesk-Bold' }}>Preview</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText type="caption" muted style={styles.wordCount}>
            {content.split(/\s+/).filter(Boolean).length} words {fileId ? `• ${isShared ? 'Shared' : 'Not shared'}` : ''}
          </ThemedText>
          {lastModified > 0 && (
            <ThemedText type="caption" muted style={{ fontSize: 11, marginTop: 2 }}>
              Updated {formatTime(lastModified)}
            </ThemedText>
          )}
        </View>
      </View>

      {/* ─── Editor / Preview ────────────────────── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {isPreview ? (
          <ScrollView style={[styles.previewScroll, { backgroundColor: isDark ? colors.background : '#FFFEF2' }]} contentContainerStyle={styles.previewContent}>
            {previewBlocks.map((block, index) => {
              if (block.type === 'table' && block.columns > 4) {
                return (
                  <TablePreview
                    key={`table-${index}`}
                    tableMarkdown={block.content}
                    columns={block.columns}
                    colors={colors}
                    isDark={isDark}
                    markdownStyles={markdownStyles}
                  />
                );
              }

              return (
                <Markdown key={`md-${index}`} style={markdownStyles as any} rules={markdownRules}>
                  {block.type === 'table' ? `${block.content}\n` : block.content}
                </Markdown>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1 }}>
            <TextInput
              style={[styles.editor, { color: colors.text }]}
              value={content}
              onChangeText={(text) => { setContent(text); setIsDirty(true); }}
              multiline
              textAlignVertical="top"
              placeholder={"# Start writing…\n\nMarkdown is supported."}
              placeholderTextColor={isDark ? '#555' : '#aaa'}
              cursorColor={colors.primary}
              selectionColor={colors.primary}
              scrollEnabled={false} // Disable inner scroll so the outer ScrollView handles it
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={discardModalVisible}
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to save or discard them?"
        cancelText="Discard"
        confirmText="Save"
        onCancel={() => {
          setDiscardModalVisible(false);
          setIsDirty(false);
          navigation.dispatch(pendingAction);
        }}
        onDismiss={() => {
          setDiscardModalVisible(false);
          // Stay on the screen and do nothing else
        }}
        onConfirm={async () => {
          setDiscardModalVisible(false);
          await handleSave();
          navigation.dispatch(pendingAction);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 2,
    gap: 4,
  },
  headerBtn: { padding: 8 },
  filenameInput: {
    flex: 1,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 17,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  headerRight: { flexDirection: 'row' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  togglePill: {
    flexDirection: 'row',
    borderWidth: 2,
    overflow: 'hidden',
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  wordCount: {},
  previewScroll: { flex: 1 },
  previewContent: { padding: 20 },
  editor: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 15,
    padding: 16,
    lineHeight: 26,
  },
});
