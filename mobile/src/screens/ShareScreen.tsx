import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Switch, Share, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
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

export const ShareScreen: React.FC<ShareScreenProps> = ({ navigation, route }) => {
  const { uri, filename } = route.params || {};
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiryHours, setExpiryHours] = useState<number | null>(24);
  const [loading, setLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(true);
  const [myLinks, setMyLinks] = useState<GeneratedLink[]>([]);
  const { colors } = useTheme();

  useEffect(() => {
    fetchMyLinks();
  }, []);

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
      
      formData.append('file', {
        uri: uri,
        name: filename,
        type: 'text/markdown',
      } as any);
      
      if (expiryHours) formData.append('expires_in_hours', expiryHours.toString());
      formData.append('is_anonymous', isAnonymous.toString());

      const response = await apiClient.post('/api/share', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      Toast.show({ position: 'bottom', type: 'success', text1: 'Link generated successfully!' });
      
      // Native Share Sheet
      await Share.share({
        message: `Check out my markdown file: ${response.data.url}`,
        url: response.data.url, // iOS specific
      });
      
      fetchMyLinks();
      
    } catch (error: any) {
      console.error(error);
      const detail = error.response?.data?.detail;
      const errorMessage = Array.isArray(detail) 
        ? detail.map((d: any) => d.msg).join(', ') 
        : (detail || 'Please check your connection');

      Toast.show({ position: 'bottom', 
        type: 'error', 
        text1: 'Sharing failed', 
        text2: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeLink = async (token: string) => {
    try {
      await apiClient.delete(`/api/share/${token}`);
      Toast.show({ position: 'bottom', type: 'success', text1: 'Link revoked' });
      fetchMyLinks();
    } catch (error) {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Failed to revoke link' });
    }
  };

  const renderExpiryButton = (label: string, value: number | null) => (
    <TouchableOpacity 
      style={[
        styles.expiryBtn, 
        { borderColor: colors.border },
        expiryHours === value && { backgroundColor: colors.primary }
      ]}
      onPress={() => setExpiryHours(value)}
    >
      <ThemedText style={{ color: '#111', fontWeight: expiryHours === value ? 'bold' : 'normal' }}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
            {uri && (
              <ThemedView card style={styles.configCard}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Share Configuration</ThemedText>
                
                <View style={styles.row}>
                  <ThemedText>Share Anonymously</ThemedText>
                  <Switch 
                    value={isAnonymous} 
                    onValueChange={setIsAnonymous} 
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={isAnonymous ? '#111' : '#f4f3f4'}
                  />
                </View>
                
                <ThemedText style={styles.label}>Link Expiry</ThemedText>
                <View style={styles.expiryRow}>
                  {renderExpiryButton('1h', 1)}
                  {renderExpiryButton('24h', 24)}
                  {renderExpiryButton('7d', 168)}
                  {renderExpiryButton('Never', null)}
                </View>

                <BrutalButton 
                  title="Generate & Share Link" 
                  onPress={generateLink} 
                  loading={loading}
                  style={styles.generateBtn}
                />
              </ThemedView>
            )}

            <ThemedText type="subtitle" style={styles.sectionTitle}>My Active Links</ThemedText>
          </View>
        }
        data={myLinks}
        keyExtractor={item => item.token}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          linksLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} /> :
          <ThemedText style={styles.emptyText}>No active share links found.</ThemedText>
        }
        renderItem={({ item }) => (
          <ThemedView card style={styles.linkItem}>
            <View style={styles.linkInfo}>
              <ThemedText type="label" numberOfLines={1}>{item.original_filename}</ThemedText>
              <ThemedText style={{ fontSize: 12, opacity: 0.7 }} numberOfLines={1}>{item.url}</ThemedText>
              {item.expires_at && (
                <ThemedText style={{ fontSize: 12, color: colors.error }}>
                  Expires: {new Date(item.expires_at).toLocaleString()}
                </ThemedText>
              )}
            </View>
            <View style={styles.linkActions}>
              <TouchableOpacity onPress={() => Share.share({ url: item.url, message: item.url })} style={styles.actionBtn}>
                <Ionicons name="share-social-outline" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => revokeLink(item.token)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </ThemedView>
        )}
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
    padding: 12,
    borderBottomWidth: 3,
  },
  iconButton: { padding: 8 },
  content: { padding: 16 },
  configCard: { marginBottom: 24 },
  sectionTitle: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: { marginBottom: 8, fontWeight: 'bold' },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  expiryBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: '#F5F5F5',
  },
  generateBtn: { marginTop: 8 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 32 },
  linkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
  },
  linkInfo: { flex: 1, marginRight: 12 },
  linkActions: { flexDirection: 'row' },
  actionBtn: { padding: 8, marginLeft: 8 },
  emptyText: { textAlign: 'center', opacity: 0.6, marginTop: 20 },
});
