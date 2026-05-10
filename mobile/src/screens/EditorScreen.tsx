import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
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

import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

type EditorScreenProps = {
  navigation: StackNavigationProp<any, any>;
  route: RouteProp<any, any>;
};

const DIR_URI = `${(FileSystem as any).documentDirectory}markdown_files/`;

export const EditorScreen: React.FC<EditorScreenProps> = ({ navigation, route }) => {
  const { uri: initialUri, name: initialName, isNew } = route.params || {};
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState(initialName ? initialName.replace('.md', '') : 'Untitled');
  const [uri, setUri] = useState<string | null>(initialUri || null);
  const [isPreview, setIsPreview] = useState(false);
  const { colors, isDark } = useTheme();
  const { token } = useAuth();

  useEffect(() => {
    if (initialUri && !isNew) loadContent(initialUri);
  }, [initialUri, isNew]);

  const loadContent = async (fileUri: string) => {
    try {
      setContent(await FileSystem.readAsStringAsync(fileUri));
    } catch (e) {
      console.error('Failed to read file', e);
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to open file' });
    }
  };

  const handleSave = async (): Promise<string | null> => {
    const safeName = filename.trim() || 'Untitled';
    const finalFilename = `${safeName}.md`;
    let targetUri = uri;
    try {
      if (!targetUri) {
        const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
        targetUri = `${DIR_URI}${finalFilename}`;
      } else if (initialName !== finalFilename) {
        targetUri = `${DIR_URI}${finalFilename}`;
      }
      await FileSystem.writeAsStringAsync(targetUri, content);
      setUri(targetUri);
      Toast.show({ position: 'bottom', type: 'success', text1: '💾 Saved!' });
      return targetUri;
    } catch (e) {
      console.error('Failed to save file', e);
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to save' });
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
    navigation.navigate('Share', { uri: savedUri, filename: `${filename}.md` });
  };

  const markdownStyles = {
    body: { color: colors.text, fontFamily: 'SpaceGrotesk-Regular', fontSize: 16, lineHeight: 26, backgroundColor: isDark ? colors.background : '#FFFEF2' },
    heading1: { color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 28, borderBottomWidth: 2, borderBottomColor: colors.border, paddingBottom: 8, marginBottom: 16 },
    heading2: { color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 22 },
    heading3: { color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18 },
    code_block: { backgroundColor: isDark ? '#2A2A2A' : '#E8F4F8', color: isDark ? '#E5E5E5' : '#111111', borderColor: colors.border, borderWidth: 2, borderRadius: 0, padding: 16, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    fence: { backgroundColor: isDark ? '#2A2A2A' : '#E8F4F8', color: isDark ? '#E5E5E5' : '#111111', borderColor: colors.border, borderWidth: 2, borderRadius: 0, padding: 16 },
    blockquote: { borderLeftWidth: 4, borderLeftColor: colors.primary, paddingLeft: 16, backgroundColor: colors.primary + (isDark ? '22' : '33') },
    strong: { fontFamily: 'SpaceGrotesk-Bold' },
  };

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
          onChangeText={setFilename}
          placeholder="Filename"
          placeholderTextColor={isDark ? '#888' : '#999'}
          onBlur={handleSave}
          selectTextOnFocus
        />

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} accessibilityLabel="Save">
            <Ionicons name="save-outline" size={22} color={colors.text} />
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
            <Ionicons name="create-outline" size={14} color="#111" style={{ marginRight: 4 }} />
            <ThemedText type="caption" style={{ color: '#111', fontFamily: 'SpaceGrotesk-Bold' }}>Edit</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, isPreview && { backgroundColor: colors.primary }]}
            onPress={() => { handleSave(); setIsPreview(true); }}
          >
            <Ionicons name="eye-outline" size={14} color="#111" style={{ marginRight: 4 }} />
            <ThemedText type="caption" style={{ color: '#111', fontFamily: 'SpaceGrotesk-Bold' }}>Preview</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText type="caption" muted style={styles.wordCount}>
          {content.split(/\s+/).filter(Boolean).length} words
        </ThemedText>
      </View>

      {/* ─── Editor / Preview ────────────────────── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {isPreview ? (
          <ScrollView style={[styles.previewScroll, { backgroundColor: isDark ? colors.background : '#FFFEF2' }]} contentContainerStyle={styles.previewContent}>
            <Markdown style={markdownStyles as any}>
              {content || '*Nothing to preview yet…*'}
            </Markdown>
          </ScrollView>
        ) : (
          <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1 }}>
            <TextInput
              style={[styles.editor, { color: colors.text }]}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              placeholder={"# Start writing…\n\nMarkdown is supported."}
              placeholderTextColor={isDark ? '#555' : '#aaa'}
              scrollEnabled={false} // Disable inner scroll so the outer ScrollView handles it
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
