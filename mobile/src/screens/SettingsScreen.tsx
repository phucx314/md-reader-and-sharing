import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { StackNavigationProp } from '@react-navigation/stack';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { BrutalSwitch } from '../components/BrutalSwitch';
import { useTheme } from '../context/ThemeContext';
import { API_URL } from '../api/client';
import { syncFilesWithFS } from '../utils/fileStore';
import {
  DATE_TIME_OPTIONS,
  getDateTimeFormat,
  setDateTimeFormat,
  type DateTimeFormatOption,
} from '../utils/dateTimeFormat';
import {
  getScanFolders,
  pickAndAddScanFolder,
  removeScanFolder,
  scanMarkdownFiles,
  getScanRecursiveAll,
  setScanRecursiveAll,
  type ScanFolder,
} from '../utils/deviceScan';

type SettingsScreenProps = { navigation: StackNavigationProp<any, any> };

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [scanFolders, setScanFolders] = useState<ScanFolder[]>([]);
  const [scanRecursiveAll, setScanRecursiveAllState] = useState(true);
  const [dateTimeFormat, setDateTimeFormatState] = useState<DateTimeFormatOption>('mdy_12h');

  const backendHost = useMemo(() => {
    try {
      return new URL(API_URL).host;
    } catch {
      return 'Not configured';
    }
  }, []);

  const resetExplainNotice = async () => {
    setBusy(true);
    try {
      await AsyncStorage.removeItem('explainPrivacyNoticeSeen');
      Toast.show({ position: 'bottom', type: 'success', text1: 'Explain notice reset' });
    } catch {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Reset failed' });
    } finally {
      setBusy(false);
    }
  };

  const resyncLocalFiles = async () => {
    setBusy(true);
    try {
      const files = await syncFilesWithFS();
      Toast.show({ position: 'bottom', type: 'success', text1: `Synced ${files.length} files` });
    } catch {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Sync failed' });
    } finally {
      setBusy(false);
    }
  };

  const loadScanFolders = async () => {
    const folders = await getScanFolders();
    setScanFolders(folders);
    setScanRecursiveAllState(await getScanRecursiveAll());
    setDateTimeFormatState(await getDateTimeFormat());
  };

  React.useEffect(() => {
    loadScanFolders();
  }, []);

  const addScanFolder = async () => {
    setBusy(true);
    try {
      const added = await pickAndAddScanFolder();
      await loadScanFolders();
      if (added) {
        Toast.show({ position: 'bottom', type: 'success', text1: 'Scan folder added' });
      }
    } catch (e: any) {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Add folder failed', text2: e?.message || '' });
    } finally {
      setBusy(false);
    }
  };

  const deleteScanFolder = async (uri: string) => {
    setBusy(true);
    try {
      await removeScanFolder(uri);
      await loadScanFolders();
      Toast.show({ position: 'bottom', type: 'success', text1: 'Scan folder removed' });
    } finally {
      setBusy(false);
    }
  };

  const rescanDeviceMarkdown = async () => {
    setBusy(true);
    try {
      const items = await scanMarkdownFiles();
      Toast.show({ position: 'bottom', type: 'success', text1: `Found ${items.length} markdown file(s)` });
    } catch {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Rescan failed' });
    } finally {
      setBusy(false);
    }
  };

  const toggleScanAll = async (next: boolean) => {
    setScanRecursiveAllState(next);
    await setScanRecursiveAll(next);
  };

  const updateDateTimeFormat = async (next: DateTimeFormatOption) => {
    setDateTimeFormatState(next);
    await setDateTimeFormat(next);
    Toast.show({ position: 'bottom', type: 'success', text1: 'Time format updated' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title">Settings</ThemedText>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.content}>
        <ThemedView card style={styles.section}>
          <ThemedText type="label" style={styles.sectionTitle}>Appearance</ThemedText>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText type="label">Dark Theme</ThemedText>
              <ThemedText type="caption" muted>Switch between dark and light mode.</ThemedText>
            </View>
            <BrutalSwitch value={isDark} onValueChange={toggleTheme} />
          </View>
        </ThemedView>

        <ThemedView card style={styles.section}>
          <ThemedText type="label" style={styles.sectionTitle}>Explain</ThemedText>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, opacity: busy ? 0.7 : 1 }]}
            onPress={resetExplainNotice}
            disabled={busy}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.text} />
            <ThemedText type="label">Show AI Notice Again</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView card style={styles.section}>
          <ThemedText type="label" style={styles.sectionTitle}>Date & Time</ThemedText>
          {DATE_TIME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.actionBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: dateTimeFormat === option.key ? colors.primary : colors.background,
                },
              ]}
              onPress={() => updateDateTimeFormat(option.key)}
            >
              <ThemedText type="label" style={{ color: dateTimeFormat === option.key ? '#111' : colors.text }}>
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        <ThemedView card style={styles.section}>
          <ThemedText type="label" style={styles.sectionTitle}>Data</ThemedText>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, opacity: busy ? 0.7 : 1 }]}
            onPress={resyncLocalFiles}
            disabled={busy}
          >
            <Ionicons name="sync-outline" size={18} color={colors.text} />
            <ThemedText type="label">Resync Local File Index</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, opacity: busy ? 0.7 : 1 }]}
            onPress={addScanFolder}
            disabled={busy}
          >
            <Ionicons name="folder-open-outline" size={18} color={colors.text} />
            <ThemedText type="label">Add Scan Folder</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, opacity: busy ? 0.7 : 1 }]}
            onPress={rescanDeviceMarkdown}
            disabled={busy}
          >
            <Ionicons name="scan-outline" size={18} color={colors.text} />
            <ThemedText type="label">Rescan Device Markdown</ThemedText>
          </TouchableOpacity>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText type="label">Scan All Subfolders</ThemedText>
              <ThemedText type="caption" muted>Recursive scan inside selected folder roots.</ThemedText>
            </View>
            <BrutalSwitch value={scanRecursiveAll} onValueChange={toggleScanAll} />
          </View>
          {scanFolders.map((folder) => (
            <View key={folder.uri} style={[styles.folderRow, { borderColor: colors.border }]}>
              <ThemedText type="caption" style={{ flex: 1 }} numberOfLines={1}>
                {folder.label}
              </ThemedText>
              <TouchableOpacity onPress={() => deleteScanFolder(folder.uri)} disabled={busy}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </ThemedView>

        <ThemedView card style={styles.section}>
          <ThemedText type="label" style={styles.sectionTitle}>About</ThemedText>
          <View style={styles.aboutRow}>
            <ThemedText type="caption" muted>Backend</ThemedText>
            <ThemedText type="caption">{backendHost}</ThemedText>
          </View>
          <View style={styles.aboutRow}>
            <ThemedText type="caption" muted>App</ThemedText>
            <ThemedText type="caption">MD Reader & Sharing</ThemedText>
          </View>
        </ThemedView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  headerBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  section: {
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk-Bold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    borderWidth: 2,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderRow: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
