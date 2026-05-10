import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const DIR_URI = `${(FileSystem as any).documentDirectory}markdown_files/`;

type FileInfo = { name: string; uri: string; size: number; mtime: number };
type HomeScreenProps = { navigation: StackNavigationProp<any, any> };

const formatTime = (ts: number) => {
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

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [sections, setSections] = useState<{ title: string; data: FileInfo[] }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, logout } = useAuth();
  
  const [isFabOpen, setIsFabOpen] = useState(false);
  const fabAnim = React.useRef(new Animated.Value(0)).current;

  const toggleFab = () => {
    const toValue = isFabOpen ? 0 : 1;
    Animated.spring(fabAnim, {
      toValue,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
    setIsFabOpen(!isFabOpen);
  };

  const closeFab = () => {
    if (isFabOpen) toggleFab();
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const loadFiles = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
      const contents = await FileSystem.readDirectoryAsync(DIR_URI);
      const infos = await Promise.all(
        contents.map(async (filename) => {
          const uri = `${DIR_URI}${filename}`;
          const info = await FileSystem.getInfoAsync(uri);
          return { 
            name: filename, 
            uri, 
            size: info.exists ? (info as any).size ?? 0 : 0,
            mtime: info.exists ? (info as any).modificationTime ?? 0 : 0
          };
        })
      );
      
      const validFiles = infos.filter((f) => f.name.endsWith('.md'));
      
      const today: FileInfo[] = [];
      const thisWeek: FileInfo[] = [];
      const thisMonth: FileInfo[] = [];
      const older: FileInfo[] = [];

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfWeek = startOfToday - now.getDay() * 86400000;
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      validFiles.forEach(f => {
        const mtimeMs = f.mtime > 20000000000 ? f.mtime : f.mtime * 1000;
        if (mtimeMs >= startOfToday) today.push(f);
        else if (mtimeMs >= startOfWeek) thisWeek.push(f);
        else if (mtimeMs >= startOfMonth) thisMonth.push(f);
        else older.push(f);
      });

      const newSections = [];
      if (today.length) newSections.push({ title: 'Today', data: today.sort((a,b) => b.mtime - a.mtime) });
      if (thisWeek.length) newSections.push({ title: 'This Week', data: thisWeek.sort((a,b) => b.mtime - a.mtime) });
      if (thisMonth.length) newSections.push({ title: 'This Month', data: thisMonth.sort((a,b) => b.mtime - a.mtime) });
      if (older.length) newSections.push({ title: 'Older', data: older.sort((a,b) => b.mtime - a.mtime) });

      setFiles(validFiles);
      setSections(newSections);
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

  const confirmDelete = (uri: string, name: string) => {
    Alert.alert('Delete File', `Are you sure you want to delete "${name.replace('.md', '')}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFile(uri) },
    ]);
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
            onPress={token ? handleLogout : () => navigation.navigate('Auth')}
            style={styles.iconButton}
            accessibilityLabel={token ? 'Log out' : 'Log in'}
          >
            <Ionicons name={token ? 'log-out-outline' : 'person-outline'} size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── File list ────────────────────────────── */}
      <SectionList
        sections={sections}
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
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <ThemedText type="label" style={{ fontFamily: 'SpaceGrotesk-Bold', color: colors.text }}>{title}</ThemedText>
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
                <ThemedText type="caption" muted>{(item.size / 1024).toFixed(1)} KB · {formatTime(item.mtime)}</ThemedText>
              </View>

              <View style={styles.fileActions}>
                <TouchableOpacity
                  onPress={() => confirmDelete(item.uri, item.name)}
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

      {/* ─── Expandable FAB ──────────────────────── */}
      <View style={styles.fabContainer}>
        {/* Link Button */}
        <Animated.View style={[styles.subFabContainer, {
          transform: [
            { scale: fabAnim },
            { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -195] }) },
          ],
        }]}>
          <TouchableOpacity
            style={[styles.subFab, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { closeFab(); Toast.show({ position: 'bottom', type: 'info', text1: 'Coming soon!' }); }}
            activeOpacity={0.85}
          >
            <Ionicons name="link-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* Import Button */}
        <Animated.View style={[styles.subFabContainer, {
          transform: [
            { scale: fabAnim },
            { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -130] }) },
          ],
        }]}>
          <TouchableOpacity
            style={[styles.subFab, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { closeFab(); importFile(); }}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-upload-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* New Button */}
        <Animated.View style={[styles.subFabContainer, {
          transform: [
            { scale: fabAnim },
            { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -65] }) },
          ],
        }]}>
          <TouchableOpacity
            style={[styles.subFab, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { closeFab(); navigation.navigate('Editor', { isNew: true }); }}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* Main FAB */}
        <TouchableOpacity
          style={styles.mainFabWrap}
          onPress={toggleFab}
          activeOpacity={0.85}
        >
          <View style={[styles.fabShadow, { backgroundColor: colors.shadow }]} />
          <Animated.View style={[styles.fab, { backgroundColor: colors.primary, borderColor: colors.border }, {
            transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }],
          }]}>
            <Ionicons name="add" size={30} color="#111" />
          </Animated.View>
        </TouchableOpacity>
      </View>
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
    borderBottomWidth: 2,
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
  sectionHeader: {
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
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
  // FAB container holds both shadow and button
  fabContainer: {
    position: 'absolute',
    bottom: 28,
    right: 28,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFabWrap: {
    position: 'absolute',
    width: 60,
    height: 60,
  },
  subFabContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
  },
  subFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    transform: [{ translateX: 4 }, { translateY: 4 }],
  },
  fab: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 0,
  },
});
