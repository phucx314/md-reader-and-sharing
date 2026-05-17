import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getFiles } from '../utils/fileStore';
import { apiClient, API_URL } from '../api/client';

type ProfileScreenProps = { navigation: StackNavigationProp<any, any> };

type ShareItem = {
  expires_at?: string | null;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, username, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [localFiles, setLocalFiles] = useState(0);
  const [shareTotal, setShareTotal] = useState(0);
  const [shareActive, setShareActive] = useState(0);

  const backendHost = useMemo(() => {
    try {
      return new URL(API_URL).host;
    } catch {
      return 'Not configured';
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!token) {
      navigation.replace('Auth');
      return;
    }
    setLoading(true);
    try {
      const files = await getFiles();
      setLocalFiles(files.length);

      const res = await apiClient.get('/api/share/me?skip=0&limit=200');
      const items: ShareItem[] = Array.isArray(res?.data?.items) ? res.data.items : [];
      const now = Date.now();
      const active = items.filter((item) => {
        if (!item?.expires_at) return true;
        const ts = new Date(item.expires_at).getTime();
        return !Number.isNaN(ts) && ts > now;
      }).length;
      setShareTotal(typeof res?.data?.total === 'number' ? res.data.total : items.length);
      setShareActive(active);
    } catch {
      setShareTotal(0);
      setShareActive(0);
    } finally {
      setLoading(false);
    }
  }, [navigation, token]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const initial = (username?.[0] || 'U').toUpperCase();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title">Profile</ThemedText>
        <TouchableOpacity onPress={loadStats} style={styles.headerBtn} accessibilityLabel="Refresh profile stats">
          <Ionicons name="refresh-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <ThemedView card style={styles.heroCard}>
          <View style={[styles.heroAvatar, { backgroundColor: colors.primary, borderColor: colors.border }]}>
            <ThemedText type="subtitle" style={{ color: '#111', fontFamily: 'SpaceGrotesk-Bold' }}>{initial}</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle" numberOfLines={1}>{username || 'Unknown user'}</ThemedText>
            <ThemedText type="caption" muted numberOfLines={1}>{backendHost}</ThemedText>
          </View>
          <View style={[styles.themePill, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={14} color={colors.text} />
            <ThemedText type="caption">{isDark ? 'Dark' : 'Light'}</ThemedText>
          </View>
        </ThemedView>

        <View style={styles.statsGrid}>
          <ThemedView card style={styles.statCard}>
            {loading ? <ActivityIndicator color={colors.text} /> : <ThemedText type="display">{localFiles}</ThemedText>}
            <ThemedText type="caption" muted>Local Files</ThemedText>
          </ThemedView>
          <ThemedView card style={styles.statCard}>
            {loading ? <ActivityIndicator color={colors.text} /> : <ThemedText type="display">{shareActive}</ThemedText>}
            <ThemedText type="caption" muted>Active Links</ThemedText>
          </ThemedView>
          <ThemedView card style={styles.statCard}>
            {loading ? <ActivityIndicator color={colors.text} /> : <ThemedText type="display">{shareTotal}</ThemedText>}
            <ThemedText type="caption" muted>Total Shares</ThemedText>
          </ThemedView>
        </View>

        <ThemedView card style={styles.actionsCard}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => navigation.navigate('Share', {})}>
            <Ionicons name="link-outline" size={18} color={colors.text} />
            <ThemedText type="label">My Links</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={toggleTheme}>
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text} />
            <ThemedText type="label">Toggle Theme</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: isDark ? '#3A1F1F' : '#FEE2E2' }]}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <ThemedText type="label" style={{ color: colors.error }}>Log Out</ThemedText>
          </TouchableOpacity>
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
    borderBottomWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
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
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themePill: {
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  actionsCard: {
    padding: 10,
    gap: 10,
  },
  actionBtn: {
    borderWidth: 2,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});

