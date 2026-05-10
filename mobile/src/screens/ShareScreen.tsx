import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Switch,
  Share,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { BrutalButton } from '../components/BrutalButton';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';

type ShareScreenProps = {
  navigation: StackNavigationProp<any, any>;
  route: RouteProp<any, any>;
};

type GeneratedLink = {
  id: number;
  token: string;
  url: string;
  original_filename: string;
  is_anonymous: boolean;
  expires_at: string | null;
};

const parseDate = (dateString: string | null) => {
  if (!dateString) return null;
  const isNaive = !dateString.endsWith('Z') && !dateString.match(/[+-]\d{2}:\d{2}$/);
  return new Date(isNaive ? `${dateString}Z` : dateString);
};

const isExpired = (expiresAt: string | null) => {
  const date = parseDate(expiresAt);
  if (!date) return false;
  return date < new Date();
};

export const ShareScreen: React.FC<ShareScreenProps> = ({ navigation, route }) => {
  const { uri, filename } = route.params || {};
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiryHours, setExpiryHours] = useState<number | null>(24);
  const [loading, setLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(true);
  const [myLinks, setMyLinks] = useState<GeneratedLink[]>([]);
  const { colors } = useTheme();

  useEffect(() => { fetchMyLinks(); }, []);

  const fetchMyLinks = async () => {
    try {
      const response = await apiClient.get('/api/share/me');
      setMyLinks(response.data);
    } catch (error) {
      console.error('Failed to fetch links', error);
    } finally {
      setLinksLoading(false);
    }
  };

  const generateLink = async () => {
    if (!uri) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: 'text/markdown' } as any);
      if (expiryHours) formData.append('expires_in_hours', expiryHours.toString());
      formData.append('is_anonymous', isAnonymous.toString());

      const response = await apiClient.post('/api/share', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Toast.show({ position: 'bottom', type: 'success', text1: 'Link generated!' });

      await Share.share({
        message: `Check out my markdown: ${response.data.url}`,
        url: response.data.url,
      });

      fetchMyLinks();
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const errorMessage = Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : detail || 'Please check your connection';
      Toast.show({ position: 'bottom', type: 'error', text1: 'Sharing failed', text2: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const confirmRevoke = (token: string) => {
    Alert.alert(
      'Revoke Link',
      'This will permanently delete the share link. Anyone with the link will lose access.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeLink(token) },
      ]
    );
  };

  const revokeLink = async (token: string) => {
    try {
      await apiClient.delete(`/api/share/${token}`);
      Toast.show({ position: 'bottom', type: 'success', text1: 'Link revoked' });
      fetchMyLinks();
    } catch {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to revoke link' });
    }
  };

  const copyLink = (url: string) => {
    Clipboard.setString(url);
    Toast.show({ position: 'bottom', type: 'success', text1: 'Link copied!' });
  };

  const renderExpiryButton = (label: string, value: number | null) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.expiryBtn,
        { borderColor: colors.border, backgroundColor: colors.card },
        expiryHours === value && { backgroundColor: colors.primary },
      ]}
      onPress={() => setExpiryHours(value)}
    >
      <ThemedText type="label" style={{ color: expiryHours === value ? '#111' : colors.text, fontWeight: expiryHours === value ? '700' : '400' }}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Header ─────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title">Share File</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={styles.content}>
            {/* ─── Config card ─────────────────── */}
            {uri && (
              <ThemedView card style={styles.configCard}>
                <ThemedText type="subtitle" style={styles.sectionLabel}>Share Settings</ThemedText>

                <View style={styles.row}>
                  <View>
                    <ThemedText type="label">Share Anonymously</ThemedText>
                    <ThemedText type="caption" muted>Hide your username from viewers</ThemedText>
                  </View>
                  <Switch
                    value={isAnonymous}
                    onValueChange={setIsAnonymous}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor="#111"
                  />
                </View>

                <ThemedText type="label" style={styles.sectionLabel}>Link Expiry</ThemedText>
                <View style={styles.expiryRow}>
                  {renderExpiryButton('1h', 1)}
                  {renderExpiryButton('24h', 24)}
                  {renderExpiryButton('7d', 168)}
                  {renderExpiryButton('∞', null)}
                </View>

                <BrutalButton
                  title="Generate & Share Link"
                  onPress={generateLink}
                  loading={loading}
                  fullWidth
                />
              </ThemedView>
            )}

            <ThemedText type="subtitle" style={styles.sectionLabel}>My Links</ThemedText>
          </View>
        }
        data={myLinks}
        keyExtractor={(item) => item.token}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          linksLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <ThemedText muted style={styles.emptyText}>No active share links.</ThemedText>
          )
        }
        renderItem={({ item }) => {
          const expired = isExpired(item.expires_at);
          return (
            <ThemedView card style={styles.linkCard}>
              <View style={styles.linkTopRow}>
                <ThemedText type="label" numberOfLines={1} style={{ flex: 1 }}>
                  {item.original_filename}
                </ThemedText>
                {/* Status badge */}
                <View style={[
                  styles.statusBadge,
                  {
                    backgroundColor: expired ? colors.error : colors.success,
                    borderColor: colors.border,
                  },
                ]}>
                  <ThemedText type="caption" style={{ color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>
                    {expired ? 'EXPIRED' : 'ACTIVE'}
                  </ThemedText>
                </View>
              </View>

              <ThemedText type="caption" muted numberOfLines={1} style={{ marginTop: 4 }}>
                {item.url}
              </ThemedText>

              {item.expires_at && (
                <ThemedText type="caption" style={{ color: expired ? colors.error : colors.textMuted, marginTop: 2 }}>
                  {expired ? 'Expired' : 'Expires'}: {parseDate(item.expires_at)?.toLocaleString()}
                </ThemedText>
              )}

              {/* Actions */}
              <View style={styles.linkActions}>
                <TouchableOpacity style={[styles.actionChip, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => copyLink(item.url)}>
                  <Ionicons name="copy-outline" size={14} color={colors.text} />
                  <ThemedText type="caption" style={{ marginLeft: 4 }}>Copy</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionChip, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => Share.share({ url: item.url, message: item.url })}>
                  <Ionicons name="share-social-outline" size={14} color={colors.text} />
                  <ThemedText type="caption" style={{ marginLeft: 4 }}>Share</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionChip, { borderColor: colors.error, backgroundColor: colors.error + '22' }]} onPress={() => confirmRevoke(item.token)}>
                  <Ionicons name="trash-outline" size={14} color={colors.error} />
                  <ThemedText type="caption" style={{ marginLeft: 4, color: colors.error }}>Revoke</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          );
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
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 2,
  },
  iconButton: { padding: 8 },
  content: { padding: 16 },
  configCard: { marginBottom: 24 },
  sectionLabel: { marginBottom: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  expiryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  expiryBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  listContainer: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyText: { textAlign: 'center', marginTop: 20 },
  linkCard: { marginBottom: 14, padding: 14 },
  linkTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderRadius: 4,
  },
  linkActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
  },
});
