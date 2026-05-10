import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
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
import { BrutalSwitch } from '../components/BrutalSwitch';
import { ConfirmModal } from '../components/ConfirmModal';
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
  local_file_id: string | null;
  is_anonymous: boolean;
  created_at: string;
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

const normalizeFilename = (str: string) => {
  if (!str) return str;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
};

export const ShareScreen: React.FC<ShareScreenProps> = ({ navigation, route }) => {
  const { uri, filename, fileId } = route.params || {};
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiryHours, setExpiryHours] = useState<number | null>(24);
  const [loading, setLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(true);
  const [myLinks, setMyLinks] = useState<GeneratedLink[]>([]);
  const [skip, setSkip] = useState(0);
  const [totalLinks, setTotalLinks] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 10;
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [linkToRevoke, setLinkToRevoke] = useState<string | null>(null);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const { colors } = useTheme();

  useEffect(() => { fetchMyLinks(); }, []);

  const fetchMyLinks = async (loadMore = false) => {
    console.log(`\n\n[DEBUG ShareScreen] fetchMyLinks called with loadMore=${loadMore}`);
    console.log(`[DEBUG ShareScreen] current state: myLinks.length=${myLinks.length}, totalLinks=${totalLinks}, skip=${skip}, fileId=${fileId}, filename=${filename}`);
    if (loadMore) {
      if (myLinks.length >= totalLinks || loadingMore) {
        console.log(`[DEBUG ShareScreen] returning early from loadMore: myLinks.length (${myLinks.length}) >= totalLinks (${totalLinks}) OR loadingMore (${loadingMore}) is true`);
        return;
      }
      setLoadingMore(true);
    } else {
      setLinksLoading(true);
    }

    try {
      const currentSkip = loadMore ? skip + LIMIT : 0;
      let url = `/api/share/me?skip=${currentSkip}&limit=${LIMIT}`;
      if (fileId) {
        url += `&local_file_id=${fileId}`;
      } else if (filename) {
        url += `&filename=${encodeURIComponent(normalizeFilename(filename))}&fallback=${encodeURIComponent(filename)}`;
      }
      console.log(`[DEBUG ShareScreen] Fetching URL: ${url}`);
      const response = await apiClient.get(url);
      console.log(`[DEBUG ShareScreen] API Response: total=${response.data?.total}, items length=${response.data?.items?.length || 0}`);

      if (loadMore) {
        setMyLinks(prev => {
          const validPrev = Array.isArray(prev) ? prev : [];
          const items = response.data?.items || response.data || [];
          const validItems = Array.isArray(items) ? items : [];
          const existingTokens = new Set(validPrev.map((l: any) => l.token));
          const newItems = validItems.filter((i: any) => !existingTokens.has(i.token));
          console.log(`[DEBUG ShareScreen] loadMore=true. Prev length=${validPrev.length}, newly fetched items=${validItems.length}, actually added (not dupes)=${newItems.length}`);
          return [...validPrev, ...newItems];
        });
        setSkip(currentSkip);
      } else {
        const items = response.data?.items || response.data || [];
        const validItems = Array.isArray(items) ? items : [];
        console.log(`[DEBUG ShareScreen] loadMore=false. Setting myLinks to exactly these ${validItems.length} items.`);
        validItems.forEach((i: any, idx: number) => console.log(`   item ${idx}: token=${i.token}, local_file_id=${i.local_file_id}, orig_name=${i.original_filename}`));
        setMyLinks(validItems);
        setSkip(0);
      }
      const newTotal = response.data?.total || (Array.isArray(response.data) ? response.data.length : 0);
      console.log(`[DEBUG ShareScreen] Setting totalLinks to: ${newTotal}`);
      setTotalLinks(newTotal);
    } catch (error) {
      console.error('[DEBUG ShareScreen] Failed to fetch links', error);
    } finally {
      setLinksLoading(false);
      setLoadingMore(false);
    }
  };

  const generateLink = async (overwrite = false, forceNew = false) => {
    if (!uri || !filename) return;
    setLoading(true);
    try {
      const formData = new FormData();
      const normalizedName = normalizeFilename(filename);
      formData.append('file', { uri, name: normalizedName, type: 'text/markdown' } as any);
      if (expiryHours) formData.append('expires_in_hours', expiryHours.toString());
      formData.append('is_anonymous', isAnonymous.toString());
      if (overwrite) formData.append('overwrite', 'true');
      if (forceNew) formData.append('force_new', 'true');
      if (fileId) formData.append('local_file_id', fileId);

      const response = await apiClient.post('/api/share', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Toast.show({ position: 'bottom', type: 'success', text1: 'Link generated!' });

      await Share.share({
        message: `Check out my markdown: ${response.data.url}`,
        url: response.data.url,
      });

      // When overwrite is true, the backend DELETES the old links for this file.
      // So we must fetch the fresh list from the backend to reflect the true state.
      fetchMyLinks(false);

      setDuplicateModalVisible(false);
    } catch (error: any) {
      if (error.response?.status === 409) {
        setDuplicateModalVisible(true);
      } else {
        const detail = error.response?.data?.detail;
        const errorMessage = Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join(', ')
          : detail || 'Please check your connection';
        Toast.show({ position: 'bottom', type: 'error', text1: 'Sharing failed', text2: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmRevoke = (token: string) => {
    setLinkToRevoke(token);
    setRevokeModalVisible(true);
  };

  const executeRevoke = async () => {
    if (!linkToRevoke) return;
    try {
      await apiClient.delete(`/api/share/${linkToRevoke}`);
      Toast.show({ position: 'bottom', type: 'success', text1: 'Link revoked' });
      fetchMyLinks();
    } catch {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to revoke link' });
    } finally {
      setRevokeModalVisible(false);
      setLinkToRevoke(null);
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
                  <BrutalSwitch
                    value={isAnonymous}
                    onValueChange={setIsAnonymous}
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
                  onPress={() => generateLink()}
                  loading={loading}
                  fullWidth
                />
              </ThemedView>
            )}

            <ThemedText type="subtitle" style={styles.sectionLabel}>My Links</ThemedText>
          </View>
        }
        data={[...(Array.isArray(myLinks) ? myLinks : [])]
          .filter(link => {
            if (fileId && link.local_file_id) {
              const matches = link.local_file_id === fileId;
              if (!matches) console.log(`[DEBUG ShareScreen] Filtered OUT item ${link.token}: local_file_id ${link.local_file_id} !== ${fileId}`);
              return matches;
            }
            if (!filename) return true;
            const normName = normalizeFilename(filename);
            try {
              const decodedOriginal = decodeURIComponent(link.original_filename);
              const decodedNorm = decodeURIComponent(normName);
              const matches = decodedOriginal === decodedNorm || link.original_filename === normName || link.original_filename === filename;
              if (!matches) console.log(`[DEBUG ShareScreen] Filtered OUT item ${link.token}: no match for filename ${filename}`);
              return matches;
            } catch {
              const matches = link.original_filename === normName || link.original_filename === filename;
              if (!matches) console.log(`[DEBUG ShareScreen] Filtered OUT item ${link.token}: no match for filename ${filename}`);
              return matches;
            }
          })
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())}
        keyExtractor={(item) => item.token}
        onEndReached={() => fetchMyLinks(true)}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} /> : null}
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
                {/* Status badges */}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {item.is_anonymous && (
                    <View style={[
                      styles.statusBadge,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}>
                      <ThemedText type="caption" style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold' }}>
                        ANON
                      </ThemedText>
                    </View>
                  )}
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

      <ConfirmModal
        visible={revokeModalVisible}
        title="Revoke Link"
        message="This will permanently delete the share link. Anyone with the link will lose access."
        onCancel={() => { setRevokeModalVisible(false); setLinkToRevoke(null); }}
        onConfirm={executeRevoke}
        confirmText="Revoke"
      />
      <ConfirmModal
        visible={duplicateModalVisible}
        title="Link Already Exists"
        message="One or more identical active share links for this file already exist. What would you like to do?"
        cancelText="New Link"
        confirmText="Overwrite All"
        onCancel={() => {
          setDuplicateModalVisible(false);
          generateLink(false, true);
        }}
        onConfirm={() => {
          setDuplicateModalVisible(false);
          generateLink(true, false);
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
  content: { paddingTop: 16, paddingBottom: 8 },
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
