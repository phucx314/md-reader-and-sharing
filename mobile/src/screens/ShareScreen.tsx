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
  Modal,
  TouchableWithoutFeedback,
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

const formatExpiryDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  const date = parseDate(dateString);
  if (!date) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');
  const [filterMode, setFilterMode] = useState<'all' | 'anon' | 'non-anon'>('all');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [revokeAllConfirmVisible, setRevokeAllConfirmVisible] = useState(false);
  const [revokeSelectedConfirmVisible, setRevokeSelectedConfirmVisible] = useState(false);
  const { colors, isDark } = useTheme();

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

  const getFilteredLinks = () => {
    return [...myLinks]
      .filter(link => {
        if (fileId && link.local_file_id) {
          if (link.local_file_id !== fileId) return false;
        } else if (filename) {
          const normName = normalizeFilename(filename);
          try {
            const decodedOriginal = decodeURIComponent(link.original_filename);
            const decodedNorm = decodeURIComponent(normName);
            if (!(decodedOriginal === decodedNorm || link.original_filename === normName || link.original_filename === filename)) return false;
          } catch {
            if (!(link.original_filename === normName || link.original_filename === filename)) return false;
          }
        }
        
        const expired = isExpired(link.expires_at);
        if (activeTab === 'active' && expired) return false;
        if (activeTab === 'expired' && !expired) return false;

        if (filterMode === 'anon' && !link.is_anonymous) return false;
        if (filterMode === 'non-anon' && link.is_anonymous) return false;

        return true;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  };

  const filteredLinks = getFilteredLinks();

  const toggleSelection = (token: string) => {
    setSelectedTokens(prev => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTokens.size === filteredLinks.length && filteredLinks.length > 0) {
      setSelectedTokens(new Set());
    } else {
      setSelectedTokens(new Set(filteredLinks.map(l => l.token)));
    }
  };

  const executeRevokeAll = async () => {
    try {
      setLoading(true);
      await apiClient.delete('/api/share/all');
      Toast.show({ position: 'bottom', type: 'success', text1: 'All links revoked' });
      setMyLinks([]);
      setTotalLinks(0);
      setIsSelectionMode(false);
      setSelectedTokens(new Set());
    } catch {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to revoke links' });
    } finally {
      setLoading(false);
      setRevokeAllConfirmVisible(false);
    }
  };

  const executeRevokeSelected = async () => {
    if (selectedTokens.size === 0) return;
    try {
      setLoading(true);
      await apiClient.post('/api/share/batch-revoke', {
        tokens: Array.from(selectedTokens)
      });
      Toast.show({ position: 'bottom', type: 'success', text1: 'Selected links revoked' });
      setMyLinks(prev => prev.filter(l => !selectedTokens.has(l.token)));
      setTotalLinks(prev => prev - selectedTokens.size);
      setIsSelectionMode(false);
      setSelectedTokens(new Set());
    } catch {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to revoke links' });
    } finally {
      setLoading(false);
      setRevokeSelectedConfirmVisible(false);
    }
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
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.card, shadowColor: isDark ? 'transparent' : colors.shadow }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle">{!uri ? "My Links" : "Share File"}</ThemedText>
        <TouchableOpacity style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.card, shadowColor: isDark ? 'transparent' : colors.shadow }]} onPress={() => setHeaderMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <Modal visible={headerMenuVisible} transparent animationType="fade" onRequestClose={() => setHeaderMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setHeaderMenuVisible(false)}>
          <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: isDark ? 'transparent' : colors.shadow }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setHeaderMenuVisible(false); setIsSelectionMode(!isSelectionMode); setSelectedTokens(new Set()); }}>
              <Ionicons name={isSelectionMode ? "close-outline" : "checkbox-outline"} size={20} color={colors.text} />
              <ThemedText style={styles.menuText}>{isSelectionMode ? "Cancel Selection" : "Select Links"}</ThemedText>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setHeaderMenuVisible(false); setRevokeAllConfirmVisible(true); }}>
              <Ionicons name="trash-bin-outline" size={20} color={colors.error} />
              <ThemedText style={[styles.menuText, { color: colors.error }]}>Revoke All</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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

            <View style={styles.toggleRow}>
              <View style={[styles.togglePill, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <TouchableOpacity
                  style={[styles.toggleOption, activeTab === 'active' && { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab('active')}
                >
                  <ThemedText type="caption" style={{ color: activeTab === 'active' ? '#111' : colors.text, fontFamily: 'SpaceGrotesk-Bold' }}>Active</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleOption, activeTab === 'expired' && { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab('expired')}
                >
                  <ThemedText type="caption" style={{ color: activeTab === 'expired' ? '#111' : colors.text, fontFamily: 'SpaceGrotesk-Bold' }}>Expired</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterRow}>
              <TouchableOpacity style={[styles.filterChip, { borderColor: colors.border, backgroundColor: filterMode === 'all' ? colors.primary : colors.card }]} onPress={() => setFilterMode('all')}>
                <ThemedText type="caption" style={{ color: filterMode === 'all' ? '#111' : colors.text, fontFamily: filterMode === 'all' ? 'SpaceGrotesk-Bold' : 'SpaceGrotesk-Regular' }}>All</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, { borderColor: colors.border, backgroundColor: filterMode === 'anon' ? colors.primary : colors.card }]} onPress={() => setFilterMode('anon')}>
                <ThemedText type="caption" style={{ color: filterMode === 'anon' ? '#111' : colors.text, fontFamily: filterMode === 'anon' ? 'SpaceGrotesk-Bold' : 'SpaceGrotesk-Regular' }}>Anonymous</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, { borderColor: colors.border, backgroundColor: filterMode === 'non-anon' ? colors.primary : colors.card }]} onPress={() => setFilterMode('non-anon')}>
                <ThemedText type="caption" style={{ color: filterMode === 'non-anon' ? '#111' : colors.text, fontFamily: filterMode === 'non-anon' ? 'SpaceGrotesk-Bold' : 'SpaceGrotesk-Regular' }}>Non-Anonymous</ThemedText>
              </TouchableOpacity>
            </View>

            {isSelectionMode && filteredLinks.length > 0 && (
              <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
                <Ionicons name={selectedTokens.size === filteredLinks.length ? "checkbox" : "square-outline"} size={22} color={selectedTokens.size === filteredLinks.length ? colors.primary : colors.text} />
                <ThemedText type="label" style={{ marginLeft: 8 }}>Select All</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        }
        data={filteredLinks}
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
          const isSelected = selectedTokens.has(item.token);
          return (
            <TouchableOpacity 
              activeOpacity={isSelectionMode ? 0.7 : 1} 
              onPress={() => isSelectionMode ? toggleSelection(item.token) : null}
            >
              <ThemedView card style={[styles.linkCard, isSelectionMode && isSelected && { backgroundColor: colors.primary + '22' }]}>
                {isSelectionMode && (
                  <View style={styles.checkboxContainer}>
                    <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={24} color={isSelected ? colors.primary : colors.text} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.linkTopRow}>
                    <ThemedText type="label" numberOfLines={1} style={{ flex: 1 }}>
                      {item.original_filename}
                    </ThemedText>
                    {/* Status badges */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {item.is_anonymous && (
                        <View style={[styles.statusBadge, { backgroundColor: colors.card, borderColor: colors.border, paddingHorizontal: 6 }]}>
                          <Ionicons name="glasses-outline" size={16} color={colors.text} />
                        </View>
                      )}
                      <View style={[styles.statusBadge, { backgroundColor: expired ? colors.error : colors.success, borderColor: colors.border }]}>
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
                      {expired ? 'Expired' : 'Expires'}: {formatExpiryDate(item.expires_at)}
                    </ThemedText>
                  )}

                  {/* Actions */}
                  {!isSelectionMode && (
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
                  )}
                </View>
              </ThemedView>
            </TouchableOpacity>
          );
        }}
      />

      {isSelectionMode && (
        <View style={[styles.selectionBottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity style={[styles.selectionBtn, { borderColor: colors.border }]} onPress={() => { setIsSelectionMode(false); setSelectedTokens(new Set()); }}>
            <ThemedText style={{ fontFamily: 'SpaceGrotesk-Bold' }}>Cancel</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.selectionBtn, { backgroundColor: colors.error, borderColor: colors.border, opacity: selectedTokens.size === 0 ? 0.5 : 1 }]} 
            disabled={selectedTokens.size === 0}
            onPress={() => setRevokeSelectedConfirmVisible(true)}
          >
            <ThemedText style={{ color: '#fff', fontFamily: 'SpaceGrotesk-Bold' }}>Revoke Selected ({selectedTokens.size})</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      <ConfirmModal
        visible={revokeAllConfirmVisible}
        title="Revoke All Links"
        message={`Are you sure you want to permanently revoke ALL share links you have ever created? This action cannot be undone.`}
        onCancel={() => setRevokeAllConfirmVisible(false)}
        onConfirm={executeRevokeAll}
        confirmText="Revoke All"
      />

      <ConfirmModal
        visible={revokeSelectedConfirmVisible}
        title="Revoke Selected Links"
        message={`Are you sure you want to permanently revoke ${selectedTokens.size} selected link(s)?`}
        onCancel={() => setRevokeSelectedConfirmVisible(false)}
        onConfirm={executeRevokeSelected}
        confirmText="Revoke Selected"
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
        cancelText="Cancel"
        neutralText="New Link"
        confirmText="Overwrite All"
        onCancel={() => setDuplicateModalVisible(false)}
        onDismiss={() => setDuplicateModalVisible(false)}
        onNeutral={() => {
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
  iconButton: { 
    width: 36, 
    height: 36, 
    borderWidth: 2, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
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
  linkCard: { marginBottom: 14, padding: 14, flexDirection: 'row', alignItems: 'center' },
  checkboxContainer: { marginRight: 12 },
  linkTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  togglePill: {
    flexDirection: 'row',
    borderWidth: 2,
    overflow: 'hidden',
    flex: 1,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  selectionBottomBar: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 2,
    gap: 12,
    paddingBottom: 32, // SafeArea padding roughly
  },
  selectionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    right: 16,
    borderWidth: 2,
    width: 200,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuText: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 15,
  },
  menuDivider: {
    height: 2,
  },
});
