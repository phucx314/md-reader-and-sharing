import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const DIR_URI = `${(FileSystem as any).documentDirectory}markdown_files/`;

type FileInfo = { name: string; uri: string; size: number };
type HomeScreenProps = { navigation: StackNavigationProp<any, any> };

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, logout } = useAuth();

  const loadFiles = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
      const contents = await FileSystem.readDirectoryAsync(DIR_URI);
      const infos = await Promise.all(
        contents.map(async (filename) => {
          const uri = `${DIR_URI}${filename}`;
          const info = await FileSystem.getInfoAsync(uri);
          return { name: filename, uri, size: info.exists ? (info as any).size ?? 0 : 0 };
        })
      );
      setFiles(infos.filter((f) => f.name.endsWith('.md')));
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(useCallback(() => { loadFiles(); }, []));

  const onRefresh = async () => { setRefreshing(true); await loadFiles(); setRefreshing(false); };

  const importFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/markdown', 'text/plain'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const newUri = `${DIR_URI}${asset.name.endsWith('.md') ? asset.name : asset.name + '.md'}`;
        await FileSystem.copyAsync({ from: asset.uri, to: newUri });
        await loadFiles();
      }
    } catch (err) { console.error(err); }
  };

  const deleteFile = async (uri: string) => {
    await FileSystem.deleteAsync(uri);
    await loadFiles();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Header ───────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerLeft}>
          <ThemedText type="title">MD Reader</ThemedText>
          {files.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.border }]}>
              <ThemedText type="caption" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#111' }}>
                {files.length}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={importFile} style={styles.iconButton} accessibilityLabel="Import file">
            <Ionicons name="cloud-upload-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconButton} accessibilityLabel="Toggle theme">
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={token ? logout : () => navigation.navigate('Auth')}
            style={styles.iconButton}
            accessibilityLabel={token ? 'Log out' : 'Log in'}
          >
            <Ionicons name={token ? 'log-out-outline' : 'person-outline'} size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── File list ────────────────────────────── */}
      <FlatList
        data={files}
        keyExtractor={(item) => item.uri}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={[styles.list, files.length === 0 && styles.listEmpty]}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <ThemedText style={[styles.emptyEmoji]}>📄</ThemedText>
            <ThemedText type="subtitle" style={{ marginBottom: 8 }}>No files yet</ThemedText>
            <ThemedText muted style={{ textAlign: 'center' }}>
              Tap the + button to create{'\n'}or import a markdown file.
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Editor', { uri: item.uri, name: item.name })}
          >
            <ThemedView card style={styles.fileCard}>
              {/* File icon badge */}
              <View style={[styles.fileIconBadge, { backgroundColor: colors.primary, borderColor: colors.border }]}>
                <Ionicons name="document-text" size={20} color="#111" />
              </View>

              <View style={styles.fileDetails}>
                <ThemedText type="label" numberOfLines={1}>
                  {item.name.replace('.md', '')}
                </ThemedText>
                <ThemedText type="caption" muted>{(item.size / 1024).toFixed(1)} KB · .md</ThemedText>
              </View>

              <View style={styles.fileActions}>
                <TouchableOpacity
                  onPress={() => deleteFile(item.uri)}
                  style={styles.deleteButton}
                  accessibilityLabel={`Delete ${item.name}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 8 }} />
              </View>
            </ThemedView>
          </TouchableOpacity>
        )}
      />

      {/* ─── FAB ──────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fabShadow, { backgroundColor: colors.shadow }]}
        onPress={() => navigation.navigate('Editor', { isNew: true })}
        activeOpacity={0.85}
        accessibilityLabel="Create new file"
      >
        <View style={[styles.fab, { backgroundColor: colors.primary, borderColor: colors.border }]}>
          <Ionicons name="add" size={30} color="#111" />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    borderWidth: 2,
    borderRadius: 20,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerActions: { flexDirection: 'row' },
  iconButton: { marginLeft: 8, padding: 6 },
  list: { padding: 16, paddingBottom: 100 },
  listEmpty: { flex: 1 },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 14,
    gap: 14,
  },
  fileIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: { flex: 1 },
  fileActions: { flexDirection: 'row', alignItems: 'center' },
  deleteButton: { padding: 4 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 20 },
  // FAB: shadow layer underneath, button on top
  fabShadow: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    top: undefined,
    // Shadow sits 4px offset
    transform: [{ translateX: 4 }, { translateY: 4 }],
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 0,
  },
});
