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

type SettingsScreenProps = { navigation: StackNavigationProp<any, any> };

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const [busy, setBusy] = useState(false);

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
          <ThemedText type="label" style={styles.sectionTitle}>Data</ThemedText>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, opacity: busy ? 0.7 : 1 }]}
            onPress={resyncLocalFiles}
            disabled={busy}
          >
            <Ionicons name="sync-outline" size={18} color={colors.text} />
            <ThemedText type="label">Resync Local File Index</ThemedText>
          </TouchableOpacity>
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
});

