import React, { useState, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { BrutalButton } from '../components/BrutalButton';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const DIR_URI = `${(FileSystem as any).documentDirectory}markdown_files/`;

type FileInfo = {
  name: string;
  uri: string;
  size: number;
};

type HomeScreenProps = {
  navigation: StackNavigationProp<any, any>;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, logout } = useAuth();

  const loadFiles = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DIR_URI);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DIR_URI, { intermediates: true });
      }
      const dirContents = await FileSystem.readDirectoryAsync(DIR_URI);
      
      const fileInfos = await Promise.all(
        dirContents.map(async (filename) => {
          const uri = `${DIR_URI}${filename}`;
          const info = await FileSystem.getInfoAsync(uri);
          return { name: filename, uri, size: info.exists ? info.size : 0 };
        })
      );
      setFiles(fileInfos.filter(f => f.name.endsWith('.md')));
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFiles();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFiles();
    setRefreshing(false);
  };

  const createNewFile = () => {
    navigation.navigate('Editor', { isNew: true });
  };

  const importFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/markdown', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newUri = `${DIR_URI}${asset.name.endsWith('.md') ? asset.name : asset.name + '.md'}`;
        await FileSystem.copyAsync({ from: asset.uri, to: newUri });
        await loadFiles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteFile = async (uri: string) => {
    await FileSystem.deleteAsync(uri);
    await loadFiles();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText type="title">MD Reader</ThemedText>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconButton}>
            <Ionicons name={isDark ? "sunny" : "moon"} size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={token ? logout : () => navigation.navigate('Auth')} 
            style={styles.iconButton}
          >
            <Ionicons name={token ? "log-out" : "person"} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actions}>
        <BrutalButton title="New File" onPress={createNewFile} style={{ flex: 1, marginRight: 8 }} />
        <BrutalButton title="Import" variant="secondary" onPress={importFile} style={{ flex: 1, marginLeft: 8 }} />
      </View>

      <FlatList
        data={files}
        keyExtractor={(item) => item.uri}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <ThemedText>No markdown files found. Create or import one to get started!</ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Editor', { uri: item.uri, name: item.name })}
          >
            <ThemedView card style={styles.fileItem}>
              <View style={styles.fileInfo}>
                <Ionicons name="document-text-outline" size={24} color={colors.text} style={styles.fileIcon} />
                <View>
                  <ThemedText type="subtitle">{item.name}</ThemedText>
                  <ThemedText type="label" style={{ opacity: 0.7 }}>{(item.size / 1024).toFixed(1)} KB</ThemedText>
                </View>
              </View>
              <TouchableOpacity onPress={() => deleteFile(item.uri)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </ThemedView>
          </TouchableOpacity>
        )}
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
    padding: 16,
    borderBottomWidth: 3,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 16,
    padding: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
  },
  list: {
    padding: 16,
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIcon: {
    marginRight: 12,
  },
  deleteButton: {
    padding: 8,
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
    padding: 20,
  },
});
