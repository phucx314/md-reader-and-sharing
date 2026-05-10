import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import Markdown from 'react-native-markdown-display';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { BrutalButton } from '../components/BrutalButton';
import { BrutalInput } from '../components/BrutalInput';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

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
    if (initialUri && !isNew) {
      loadContent(initialUri);
    }
  }, [initialUri, isNew]);

  const loadContent = async (fileUri: string) => {
    try {
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      setContent(fileContent);
    } catch (e) {
      console.error('Failed to read file', e);
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to open file' });
    }
  };

  const handleSave = async () => {
    const safeName = filename.trim() || 'Untitled';
    const finalFilename = `${safeName}.md`;
    let targetUri = uri;

    try {
      if (!targetUri) {
        // Ensure dir exists
        const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
        }
        targetUri = `${DIR_URI}${finalFilename}`;
      } else if (initialName !== finalFilename) {
        // Rename case - delete old if it exists (simplification for this task)
        const newUri = `${DIR_URI}${finalFilename}`;
        if (newUri !== targetUri) {
             targetUri = newUri;
        }
      }

      await FileSystem.writeAsStringAsync(targetUri, content);
      setUri(targetUri);
      Toast.show({ position: 'bottom', type: 'success', text1: 'Saved locally' });
      return targetUri;
    } catch (e) {
      console.error('Failed to save file', e);
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to save file' });
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
    body: { color: colors.text, fontFamily: 'SpaceGrotesk-Regular', fontSize: 16 },
    heading1: { color: colors.text, fontFamily: 'SpaceGrotesk-Bold', borderBottomWidth: 2, borderBottomColor: colors.border },
    heading2: { color: colors.text, fontFamily: 'SpaceGrotesk-Bold' },
    code_block: { backgroundColor: isDark ? '#222' : '#f0f0f0', borderColor: colors.border, borderWidth: 2 },
    fence: { backgroundColor: isDark ? '#222' : '#f0f0f0', borderColor: colors.border, borderWidth: 2 },
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.filenameInput, { color: colors.text }]}
          value={filename}
          onChangeText={setFilename}
          placeholder="Filename"
          placeholderTextColor={isDark ? '#888' : '#666'}
          onBlur={handleSave}
        />

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
            <Ionicons name="share-social" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.tab, !isPreview && styles.activeTab, !isPreview && { backgroundColor: colors.primary, borderRightColor: colors.border }]} 
          onPress={() => setIsPreview(false)}
        >
          <ThemedText style={{ fontWeight: !isPreview ? 'bold' : 'normal', color: !isPreview ? '#111' : colors.text }}>Edit</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, isPreview && styles.activeTab, isPreview && { backgroundColor: colors.primary, borderLeftColor: colors.border }]} 
          onPress={() => { handleSave(); setIsPreview(true); }}
        >
          <ThemedText style={{ fontWeight: isPreview ? 'bold' : 'normal', color: isPreview ? '#111' : colors.text }}>Preview</ThemedText>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {isPreview ? (
          <ScrollView style={styles.previewContainer}>
            <Markdown style={markdownStyles}>
              {content || '*Nothing to preview*'}
            </Markdown>
          </ScrollView>
        ) : (
          <TextInput
            style={[styles.editor, { color: colors.text, backgroundColor: colors.background }]}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            placeholder="Type your markdown here..."
            placeholderTextColor={isDark ? '#888' : '#666'}
          />
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
    padding: 12,
    borderBottomWidth: 3,
  },
  iconButton: {
    padding: 8,
  },
  filenameInput: {
    flex: 1,
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 18,
    marginHorizontal: 12,
    paddingVertical: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderWidth: 3,
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  editor: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    padding: 16,
    lineHeight: 24,
  },
  previewContainer: {
    flex: 1,
    padding: 16,
  },
});
