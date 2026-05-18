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
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { ConfirmModal } from '../components/ConfirmModal';
import { syncFilesWithFS, deleteFile as deleteFileFromStore } from '../utils/fileStore';
import { saveFile, generateUUID, getFileByName } from '../utils/fileStore';
import { API_URL } from '../api/client';
import { apiClient } from '../api/client';
import axios from 'axios';
import { scanMarkdownFiles, type DeviceMarkdownFile } from '../utils/deviceScan';
import { getDateTimeFormat, formatAbsoluteDateTime, type DateTimeFormatOption } from '../utils/dateTimeFormat';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const DIR_URI = `${(FileSystem as any).documentDirectory}markdown_files/`;

interface FileInfo {
  id?: string;
  name: string;
  uri: string;
  size: number;
  mtime: number;
  origin?: 'local' | 'imported';
};
type HomeScreenProps = { navigation: StackNavigationProp<any, any> };

const formatTime = (ts: number, dateTimeFormat: DateTimeFormatOption) => {
  const tsMs = ts > 20000000000 ? ts : ts * 1000;
  const now = new Date();
  const date = new Date(tsMs);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffInDays = Math.floor(diffInSeconds / 86400);

  if (diffInDays > 3) {
    return formatAbsoluteDateTime(date, dateTimeFormat);
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

const normalizeTimestampForDisplay = (ts: number | null) => {
  if (!ts) return null;
  // Keep exactly same behavior as Library cards.
  return ts > 20000000000 ? ts : ts * 1000;
};

const toSafeLocalMdFilename = (raw: string) => {
  const trimmed = String(raw || '').trim();
  const base = trimmed.replace(/\\/g, '/').split('/').pop() || 'imported.md';
  const noDocPrefix = base.includes(':') ? base.split(':').slice(1).join(':') : base;
  const sanitized = noDocPrefix.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  const finalName = sanitized || 'imported.md';
  return finalName.toLowerCase().endsWith('.md') ? finalName : `${finalName}.md`;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [dateTimeFormat, setDateTimeFormat] = useState<DateTimeFormatOption>('mdy_12h');
  const [activePage, setActivePage] = useState<'library' | 'device'>('library');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [sections, setSections] = useState<{ title: string; data: FileInfo[] }[]>([]);
  const [deviceFiles, setDeviceFiles] = useState<DeviceMarkdownFile[]>([]);
  const [deviceSections, setDeviceSections] = useState<{ title: string; data: DeviceMarkdownFile[] }[]>([]);
  const [isScanningDevice, setIsScanningDevice] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shareStatusMap, setShareStatusMap] = useState<Record<string, { ever_shared: boolean; active_shared: boolean }>>({});
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, username, logout } = useAuth();

  const [isFabOpen, setIsFabOpen] = useState(false);
  const fabAnim = React.useRef(new Animated.Value(0)).current;
  const scanBarAnim = React.useRef(new Animated.Value(0)).current;
  const subFabExtendedAnim = React.useRef(new Animated.Value(1)).current;
  const subFabTimer = React.useRef<NodeJS.Timeout | null>(null);

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id?: string, uri: string, name: string } | null>(null);

  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [importUrlModalVisible, setImportUrlModalVisible] = useState(false);
  const [importUrlInput, setImportUrlInput] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  const fabPressedAnim = React.useRef(new Animated.Value(0)).current;

  const handleFabPressIn = () => {
    Animated.timing(fabPressedAnim, {
      toValue: 1,
      duration: 60,
      useNativeDriver: true,
    }).start();
  };

  const handleFabPressOut = () => {
    Animated.timing(fabPressedAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const toggleFab = () => {
    const toValue = isFabOpen ? 0 : 1;
    Animated.spring(fabAnim, {
      toValue,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();

    if (!isFabOpen) {
      // Opening
      subFabExtendedAnim.setValue(1);
      if (subFabTimer.current) clearTimeout(subFabTimer.current);
      subFabTimer.current = setTimeout(() => {
        Animated.timing(subFabExtendedAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }, 3000);
    } else {
      // Closing
      if (subFabTimer.current) clearTimeout(subFabTimer.current);
    }

    setIsFabOpen(!isFabOpen);
  };


  const closeFab = () => {
    if (isFabOpen) toggleFab();
  };

  const handleLogout = () => {
    setLogoutConfirmVisible(false);
    logout();
  };

  const loadDeviceFiles = async () => {
    setIsScanningDevice(true);
    try {
      const scanned = await scanMarkdownFiles();
      setDeviceFiles(scanned);
      const grouped = scanned.reduce<Record<string, DeviceMarkdownFile[]>>((acc, item) => {
        if (!acc[item.parentLabel]) acc[item.parentLabel] = [];
        acc[item.parentLabel].push(item);
        return acc;
      }, {});
      const newSections = Object.keys(grouped)
        .sort()
        .map((k) => ({
          title: k,
          data: grouped[k].sort(
            (a, b) =>
              (normalizeTimestampForDisplay(b.mtime) ?? 0) -
              (normalizeTimestampForDisplay(a.mtime) ?? 0)
          ),
        }));
      setDeviceSections(newSections);
    } catch (e: any) {
      setDeviceFiles([]);
      setDeviceSections([]);
    } finally {
      setIsScanningDevice(false);
    }
  };

  React.useEffect(() => {
    if (!isScanningDevice) {
      scanBarAnim.stopAnimation();
      scanBarAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(scanBarAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      scanBarAnim.stopAnimation();
      scanBarAnim.setValue(0);
    };
  }, [isScanningDevice, scanBarAnim]);

  const loadFiles = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
      }

      const dbFiles = await syncFilesWithFS();

      const infos = await Promise.all(
        (dbFiles || []).map(async (f) => {
          const info = await FileSystem.getInfoAsync(f.uri);
          const filenameLower = String(f.filename || '').toLowerCase();
          const inferredImported = filenameLower.startsWith('imported-');
          return {
            id: f.id,
            name: f.filename,
            uri: f.uri,
            size: info.exists ? (info as any).size ?? 0 : 0,
            mtime: info.exists ? (info as any).modificationTime ?? 0 : 0,
            origin: (((f as any).origin === 'imported' || inferredImported) ? 'imported' : 'local') as 'local' | 'imported',
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
      if (today.length) newSections.push({ title: 'Today', data: today.sort((a, b) => b.mtime - a.mtime) });
      if (thisWeek.length) newSections.push({ title: 'This Week', data: thisWeek.sort((a, b) => b.mtime - a.mtime) });
      if (thisMonth.length) newSections.push({ title: 'This Month', data: thisMonth.sort((a, b) => b.mtime - a.mtime) });
      if (older.length) newSections.push({ title: 'Older', data: older.sort((a, b) => b.mtime - a.mtime) });

      setFiles(validFiles);
      setSections(newSections);

      if (token) {
        try {
          const fileIds = validFiles.map((f) => f.id).filter(Boolean) as string[];
          if (fileIds.length === 0) {
            setShareStatusMap({});
          } else {
            const response = await apiClient.post('/api/share/status', { local_file_ids: fileIds });
            const items = Array.isArray(response?.data?.items) ? response.data.items : [];
            const map: Record<string, { ever_shared: boolean; active_shared: boolean }> = {};
            items.forEach((item: any) => {
              if (!item?.local_file_id) return;
              map[String(item.local_file_id)] = {
                ever_shared: Boolean(item.ever_shared),
                active_shared: Boolean(item.active_shared),
              };
            });
            setShareStatusMap(map);
          }
        } catch {
          setShareStatusMap({});
        }
      } else {
        setShareStatusMap({});
      }
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(useCallback(() => {
    loadFiles();
    loadDeviceFiles();
    getDateTimeFormat().then(setDateTimeFormat).catch(() => setDateTimeFormat('mdy_12h'));
  }, [token]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFiles(), loadDeviceFiles()]);
    setRefreshing(false);
  };

  const importFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/markdown', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const getUniqueFilename = async (baseName: string): Promise<string> => {
        const safeBase = baseName.endsWith('.md') ? baseName : `${baseName}.md`;
        const stem = safeBase.replace(/\.md$/i, '');
        let candidate = safeBase;
        let counter = 1;
        while (true) {
          const existsInStore = await getFileByName(candidate);
          const existsInFs = await FileSystem.getInfoAsync(`${DIR_URI}${candidate}`);
          if (!existsInStore && !existsInFs.exists) return candidate;
          candidate = `${stem} (${counter}).md`;
          counter += 1;
        }
      };

      let importedCount = 0;
      for (const asset of result.assets) {
        const finalFilename = await getUniqueFilename(asset.name || 'imported.md');
        const newUri = `${DIR_URI}${finalFilename}`;
        await FileSystem.copyAsync({ from: asset.uri, to: newUri });
        await saveFile({
          id: generateUUID(),
          filename: finalFilename,
          uri: newUri,
          createdAt: Date.now(),
          origin: 'local',
        });
        importedCount += 1;
      }

      await loadFiles();
      setActivePage('library');
      Toast.show({
        position: 'bottom',
        type: 'success',
        text1: importedCount === 1 ? 'Imported 1 file' : `Imported ${importedCount} files`,
      });
    } catch (err) { console.error(err); }
  };

  const parseImportUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error('Please enter a URL');
    const parsed = new URL(trimmed);
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error('Only http/https URLs are supported');
    }

    const configuredHost = (() => {
      try {
        return API_URL ? new URL(API_URL).host : '';
      } catch {
        return '';
      }
    })();
    if (configuredHost && parsed.host !== configuredHost) {
      throw new Error('Only this app share URL is supported');
    }

    const viewTokenMatch = parsed.pathname.match(/^\/view\/([^/]+)\/?$/);
    if (viewTokenMatch) {
      const token = viewTokenMatch[1];
      return `${parsed.origin}/view/${token}/download?format=md`;
    }

    const downloadTokenMatch = parsed.pathname.match(/^\/view\/([^/]+)\/download\/?$/);
    if (downloadTokenMatch) {
      parsed.searchParams.set('format', 'md');
      return parsed.toString();
    }

    throw new Error('Invalid share URL format');
  };

  const extractFilenameFromHeaders = (headers: any, fallback: string): string => {
    const contentDisposition = String(
      headers?.['content-disposition'] ?? headers?.['Content-Disposition'] ?? ''
    );
    const match =
      contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ||
      contentDisposition.match(/filename="?([^"]+)"?/i);
    const decoded = match?.[1] ? decodeURIComponent(match[1]) : fallback;
    const safe = decoded.replace(/[\\/:*?"<>|]/g, '_').trim();
    const named = safe || fallback;
    return named.endsWith('.md') ? named : `${named}.md`;
  };

  const importFromUrl = async () => {
    setImportingUrl(true);
    try {
      const downloadUrl = parseImportUrl(importUrlInput);
      const response = await axios.get(downloadUrl, {
        responseType: 'text',
        timeout: 20000,
      });
      const body = typeof response.data === 'string' ? response.data : String(response.data ?? '');
      if (!body.trim()) {
        throw new Error('Downloaded markdown is empty');
      }

      const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
      }

      const parsed = new URL(downloadUrl);
      const token = parsed.pathname.split('/')[2] || generateUUID().slice(0, 8);
      const baseName = extractFilenameFromHeaders(response.headers, `imported-${token}.md`);
      let finalFilename = baseName;
      let counter = 1;
      while (await getFileByName(finalFilename)) {
        const stem = baseName.replace(/\.md$/i, '');
        finalFilename = `${stem} (${counter}).md`;
        counter += 1;
      }

      const newUri = `${DIR_URI}${finalFilename}`;
      await FileSystem.writeAsStringAsync(newUri, body);
      const newFileId = generateUUID();
      await saveFile({
        id: newFileId,
        filename: finalFilename,
        uri: newUri,
        createdAt: Date.now(),
        origin: 'imported',
      });

      setImportUrlModalVisible(false);
      setImportUrlInput('');
      await loadFiles();
      setActivePage('library');
      Toast.show({ position: 'bottom', type: 'success', text1: 'Imported from URL' });
      navigation.navigate('Editor', { uri: newUri, name: finalFilename, fileId: newFileId });
    } catch (error: any) {
      const detail = error?.response?.status === 410
        ? 'This share link has expired'
        : error?.response?.status === 404
          ? 'Link not found or revoked'
          : error?.message || 'Import failed';
      Toast.show({ position: 'bottom', type: 'error', text1: 'Import failed', text2: detail });
    } finally {
      setImportingUrl(false);
    }
  };

  const confirmDelete = (id: string | undefined, uri: string, name: string) => {
    setFileToDelete({ id, uri, name: name.replace('.md', '') });
    setDeleteConfirmVisible(true);
  };

  const importScannedFile = async (item: DeviceMarkdownFile) => {
    try {
      console.log('[DeviceImport] start', {
        uri: item.uri,
        name: item.name,
        parentLabel: item.parentLabel,
        isContentUri: item.uri.startsWith('content://'),
      });
      const body = item.uri.startsWith('content://')
        ? await FileSystem.StorageAccessFramework.readAsStringAsync(item.uri)
        : await FileSystem.readAsStringAsync(item.uri);
      console.log('[DeviceImport] read done', { length: body.length });
      if (!body.trim()) {
        Toast.show({ position: 'bottom', type: 'error', text1: 'File is empty' });
        return;
      }

      const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
      }

      let finalFilename = toSafeLocalMdFilename(item.name);
      let counter = 1;
      while (await getFileByName(finalFilename)) {
        const stem = item.name.replace(/\.md$/i, '');
        finalFilename = `${stem} (${counter}).md`;
        counter += 1;
      }

      const newUri = `${DIR_URI}${finalFilename}`;
      console.log('[DeviceImport] write target', { newUri, finalFilename });
      await FileSystem.writeAsStringAsync(newUri, body);
      const newFileId = generateUUID();
      await saveFile({
        id: newFileId,
        filename: finalFilename,
        uri: newUri,
        createdAt: Date.now(),
        origin: 'local',
      });
      await loadFiles();
      setActivePage('library');
      console.log('[DeviceImport] success', { newFileId, finalFilename });
      Toast.show({ position: 'bottom', type: 'success', text1: 'Imported to Library' });
    } catch (error: any) {
      console.error('[DeviceImport] failed', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        error,
      });
      Toast.show({ position: 'bottom', type: 'error', text1: 'Import failed' });
    }
  };

  const executeDelete = async () => {
    if (fileToDelete) {
      try {
        await FileSystem.deleteAsync(fileToDelete.uri, { idempotent: true });
        if (fileToDelete.id) {
          await deleteFileFromStore(fileToDelete.id);
        }
        setFileToDelete(null);
        setDeleteConfirmVisible(false);
        await loadFiles();
        Toast.show({
          type: 'success',
          text1: 'Deleted successfully',
          position: 'bottom',
        });
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const renderAvatar = () => (
    <View style={[styles.avatarCircle, { borderColor: colors.border, backgroundColor: colors.primary }]}>
      {token ? (
        <ThemedText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#111' }}>
          {username ? username.charAt(0).toUpperCase() : 'U'}
        </ThemedText>
      ) : (
        <Ionicons name="person" size={16} color="#111" />
      )}
    </View>
  );

  const subFabWidth = subFabExtendedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [48, 140],
  });

  const subFabTextOpacity = subFabExtendedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

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
          <TouchableOpacity onPress={toggleTheme} style={styles.iconButton} accessibilityLabel="Toggle theme">
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setProfileMenuVisible(true)}
            style={[styles.iconButton, { padding: 4 }]}
            accessibilityLabel={token ? 'Profile' : 'Log in'}
          >
            {renderAvatar()}
          </TouchableOpacity>
        </View>
      </View>
      {isScanningDevice ? (
        <View style={[styles.scanProgressTrack, { backgroundColor: isDark ? '#2A2A2A' : '#E5E7EB' }]}>
          <Animated.View
            style={[
              styles.scanProgressBar,
              {
                backgroundColor: colors.primary,
                transform: [
                  {
                    translateX: scanBarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-160, 420],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      ) : null}

      {activePage === 'library' && (
        <>
          {/* ─── File list ────────────────────────────── */}
          <View style={[styles.legendRow, { borderBottomColor: colors.border }]}>
            <View style={styles.legendItem}>
              <Ionicons name="download-outline" size={13} color={isDark ? '#9AE6B4' : '#166534'} />
              <ThemedText type="caption" muted>Imported</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="cloud-done-outline" size={13} color={colors.textMuted} />
              <ThemedText type="caption" muted>Cloud saved</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="share-social-outline" size={13} color={colors.success} />
              <ThemedText type="caption" muted>Active Link</ThemedText>
            </View>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(item) => item.uri}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={['#111']}
                progressBackgroundColor={colors.primary}
              />
            }
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
                onPress={() => navigation.navigate('Editor', { uri: item.uri, name: item.name, fileId: item.id })}
              >
                <ThemedView card style={styles.fileCard}>
                  {/* File icon badge */}
                  <View style={[styles.fileIconBadge, { backgroundColor: colors.primary, borderColor: colors.border }]}>
                    <Ionicons name="document-text" size={20} color="#111" />
                  </View>

                  <View style={styles.fileDetails}>
                    <View style={styles.fileTitleRow}>
                      <ThemedText type="label" numberOfLines={1} style={{ flex: 1 }}>
                        {item.name.replace('.md', '')}
                      </ThemedText>
                    </View>
                    {(() => {
                      const shareState = item.id ? shareStatusMap[item.id] : undefined;
                      const wasEverShared = Boolean(shareState?.ever_shared);
                      const isActiveShared = Boolean(shareState?.active_shared);
                      const isImported = item.origin === 'imported';
                      return (
                        <View style={styles.metaRow}>
                          <ThemedText type="caption" muted>
                        {(item.size / 1024).toFixed(1)} KB · {formatTime(item.mtime, dateTimeFormat)}
                          </ThemedText>
                          <View style={styles.metaIconsRow}>
                            {isImported ? (
                              <Ionicons name="download-outline" size={14} color={isDark ? '#9AE6B4' : '#166534'} />
                            ) : null}
                            {wasEverShared ? (
                              <Ionicons name="cloud-done-outline" size={14} color={colors.textMuted} />
                            ) : null}
                            {isActiveShared ? (
                              <Ionicons name="share-social-outline" size={14} color={colors.success} />
                            ) : null}
                          </View>
                        </View>
                      );
                    })()}
                  </View>

                  <View style={[styles.fileActions, { marginLeft: 'auto' }]}>
                    <TouchableOpacity
                      onPress={() => confirmDelete(item.id, item.uri, item.name)}
                      style={[styles.deleteButton, { borderColor: colors.border }]}
                      accessibilityLabel={`Delete ${item.name}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </ThemedView>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {activePage === 'device' && (
        <SectionList
          sections={deviceSections}
          keyExtractor={(item) => item.uri}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={['#111']}
              progressBackgroundColor={colors.primary}
            />
          }
          contentContainerStyle={[styles.list, deviceFiles.length === 0 && styles.listEmpty]}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle" style={{ marginBottom: 8 }}>No scanned markdown files</ThemedText>
              <ThemedText muted style={{ textAlign: 'center' }}>
                Add scan folders in Settings, then pull to refresh.
              </ThemedText>
            </View>
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <ThemedText type="label" style={{ fontFamily: 'SpaceGrotesk-Bold', color: colors.text }}>{title}</ThemedText>
            </View>
          )}
          renderItem={({ item }) => (
            <ThemedView card style={styles.fileCard}>
              <View style={[styles.fileIconBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="document-outline" size={20} color={colors.text} />
              </View>
              <View style={styles.fileDetails}>
                <ThemedText type="label" numberOfLines={1}>{item.name.replace('.md', '')}</ThemedText>
                <ThemedText type="caption" muted>
                  {(item.size / 1024).toFixed(1)} KB · {item.mtime ? formatTime((normalizeTimestampForDisplay(item.mtime) as number) / 1000, dateTimeFormat) : 'Unknown'}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[styles.importDeviceBtn, { borderColor: colors.border, backgroundColor: colors.primary }]}
                onPress={() => importScannedFile(item)}
              >
                <ThemedText type="caption" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#111' }}>Import</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
        />
      )}

      {/* ─── Expandable FAB ──────────────────────── */}
      <View style={styles.fabContainer}>
        {/* Import Link Button */}
        <Animated.View style={[styles.subFabRow, { transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -195] }) }, { scale: fabAnim }] }]}>
          <TouchableOpacity onPress={() => { closeFab(); setImportUrlModalVisible(true); }} activeOpacity={0.85}>
            <Animated.View style={[styles.subFabPill, { backgroundColor: colors.card, borderColor: colors.border, width: subFabWidth }]}>
              <Animated.Text style={[styles.subFabPillText, { color: colors.text, opacity: subFabTextOpacity }]} numberOfLines={1}>
                Import Link
              </Animated.Text>
              <Ionicons name="link-outline" size={22} color={colors.text} style={{ paddingRight: 11 }} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* Import Button */}
        <Animated.View style={[styles.subFabRow, { transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -130] }) }, { scale: fabAnim }] }]}>
          <TouchableOpacity onPress={() => { closeFab(); importFile(); }} activeOpacity={0.85}>
            <Animated.View style={[styles.subFabPill, { backgroundColor: colors.card, borderColor: colors.border, width: subFabWidth }]}>
              <Animated.Text style={[styles.subFabPillText, { color: colors.text, opacity: subFabTextOpacity }]} numberOfLines={1}>
                Import File
              </Animated.Text>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.text} style={{ paddingRight: 11 }} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* New Button */}
        <Animated.View style={[styles.subFabRow, { transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -65] }) }, { scale: fabAnim }] }]}>
          <TouchableOpacity onPress={() => { closeFab(); navigation.navigate('Editor', { isNew: true }); }} activeOpacity={0.85}>
            <Animated.View style={[styles.subFabPill, { backgroundColor: colors.card, borderColor: colors.border, width: subFabWidth }]}>
              <Animated.Text style={[styles.subFabPillText, { color: colors.text, opacity: subFabTextOpacity }]} numberOfLines={1}>
                New File
              </Animated.Text>
              <Ionicons name="document-text-outline" size={22} color={colors.text} style={{ paddingRight: 11 }} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* Main FAB */}
        <Pressable
          style={styles.mainFabWrap}
          onPress={toggleFab}
          onPressIn={handleFabPressIn}
          onPressOut={handleFabPressOut}
        >
          <Animated.View style={[styles.fab, { backgroundColor: colors.primary, borderColor: colors.border }, {
            transform: [
              {
                translateX: fabPressedAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 3],
                }),
              },
              {
                translateY: fabPressedAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 3],
                }),
              },
              { rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) },
            ],
          }]}>
            <Ionicons name="add" size={30} color="#111" />
          </Animated.View>
        </Pressable>
      </View>

      <View style={[styles.bottomSwitchIsland, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.bottomSwitchBtn, activePage === 'library' && { backgroundColor: colors.primary }]}
          onPress={() => setActivePage('library')}
        >
          <ThemedText type="caption" style={{ fontFamily: 'SpaceGrotesk-Bold', color: activePage === 'library' ? '#111' : colors.text }}>
            Library
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomSwitchBtn, activePage === 'device' && { backgroundColor: colors.primary }]}
          onPress={() => setActivePage('device')}
        >
          <ThemedText type="caption" style={{ fontFamily: 'SpaceGrotesk-Bold', color: activePage === 'device' ? '#111' : colors.text }}>
            Device
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* ─── Modals ──────────────────────── */}
      <Modal visible={profileMenuVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setProfileMenuVisible(false)}>
          <View style={[styles.profileSheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: isDark ? 'transparent' : colors.shadow }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <ThemedText type="subtitle" style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, lineHeight: 26 }}>
                {token ? 'Account' : 'Menu'}
              </ThemedText>
            </View>
            {token ? (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setProfileMenuVisible(false); navigation.navigate('Profile'); }}>
                  <Ionicons name="person-outline" size={20} color={colors.text} />
                  <ThemedText style={styles.menuText}>Profile</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setProfileMenuVisible(false); navigation.navigate('Share', {}); }}>
                  <Ionicons name="link-outline" size={20} color={colors.text} />
                  <ThemedText style={styles.menuText}>My Links</ThemedText>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.menuItem} onPress={() => { setProfileMenuVisible(false); navigation.navigate('Settings'); }}>
              <Ionicons name="settings-outline" size={20} color={colors.text} />
              <ThemedText style={styles.menuText}>Settings</ThemedText>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            {token ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setProfileMenuVisible(false); setLogoutConfirmVisible(true); }}>
                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                <ThemedText style={[styles.menuText, { color: colors.error }]}>Log Out</ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setProfileMenuVisible(false); navigation.navigate('Auth'); }}>
                <Ionicons name="log-in-outline" size={20} color={colors.text} />
                <ThemedText style={styles.menuText}>Log In</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <ConfirmModal
        visible={deleteConfirmVisible}
        title="Delete File"
        message={`Are you sure you want to delete "${fileToDelete?.name}"?`}
        onCancel={() => { setDeleteConfirmVisible(false); setFileToDelete(null); }}
        onConfirm={executeDelete}
        confirmText="Delete"
      />

      <ConfirmModal
        visible={logoutConfirmVisible}
        title="Log Out"
        message="Are you sure you want to log out?"
        onCancel={() => setLogoutConfirmVisible(false)}
        onConfirm={handleLogout}
        confirmText="Log Out"
      />

      <Modal visible={importUrlModalVisible} transparent animationType="fade" onRequestClose={() => setImportUrlModalVisible(false)}>
        <View style={styles.menuOverlay}>
          <View style={[styles.importUrlCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: isDark ? 'transparent' : colors.shadow }]}>
            <ThemedText type="subtitle" style={styles.importUrlTitle}>Import from Link</ThemedText>
            <TextInput
              value={importUrlInput}
              onChangeText={setImportUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://.../view/<token>"
              placeholderTextColor={isDark ? '#777' : '#888'}
              style={[styles.importUrlInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <View style={styles.importUrlActions}>
              <TouchableOpacity
                style={[styles.importUrlBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => {
                  if (importingUrl) return;
                  setImportUrlModalVisible(false);
                  setImportUrlInput('');
                }}
              >
                <ThemedText type="label">Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importUrlBtn, { borderColor: colors.border, backgroundColor: colors.primary, opacity: importingUrl ? 0.8 : 1 }]}
                onPress={importFromUrl}
                disabled={importingUrl}
              >
                <ThemedText type="label" style={{ color: '#111', fontFamily: 'SpaceGrotesk-Bold' }}>
                  {importingUrl ? 'Importing…' : 'Import'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', `${colors.background}99`, `${colors.background}FA`, colors.background]}
        locations={[0, 0.35, 0.75, 1]}
        style={styles.bottomFadeWrap}
      />
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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { marginLeft: 8, padding: 6 },
  scanProgressTrack: {
    height: 2,
    overflow: 'hidden',
  },
  scanProgressBar: {
    width: 160,
    height: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  list: { padding: 16, paddingBottom: 170 },
  listEmpty: { flex: 1 },
  sectionHeader: {
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  subFabPill: {
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  subFabPillText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 14,
    position: 'absolute',
    right: 48,
  },
  fileDetails: { flex: 1 },
  fileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileActions: { flexDirection: 'row', alignItems: 'center' },
  deleteButton: {
    width: 34,
    height: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importDeviceBtn: {
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
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
    zIndex: 4,
  },
  mainFabWrap: {
    position: 'absolute',
    width: 60,
    height: 60,
  },
  subFabRow: {
    position: 'absolute',
    right: 6,
    alignItems: 'flex-end',
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
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  profileSheet: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderWidth: 2,
    borderRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    paddingVertical: 8,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 15,
  },
  menuDivider: {
    height: 2,
    marginVertical: 4,
  },
  importUrlCard: {
    marginHorizontal: 16,
    marginTop: 140,
    borderWidth: 2,
    padding: 14,
    gap: 12,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  importUrlTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
  },
  importUrlInput: {
    borderWidth: 2,
    minHeight: 44,
    paddingHorizontal: 12,
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 14,
  },
  importUrlActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  importUrlBtn: {
    minHeight: 40,
    minWidth: 96,
    paddingHorizontal: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSwitchIsland: {
    position: 'absolute',
    left: 28,
    right: 96,
    bottom: 28,
    height: 60,
    borderWidth: 2,
    borderRadius: 30,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    zIndex: 3,
  },
  bottomSwitchBtn: {
    flex: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomFadeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
    zIndex: 1,
  },
});
