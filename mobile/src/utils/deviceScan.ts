import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const SCAN_FOLDERS_KEY = '@device_scan_folders_v1';

export type ScanFolder = {
  uri: string;
  label: string;
};

export type DeviceMarkdownFile = {
  uri: string;
  name: string;
  parentUri: string;
  parentLabel: string;
  size: number;
  mtime: number;
};

const getFolderLabelFromUri = (uri: string) => {
  const clean = String(uri || '').replace(/\/+$/, '');
  const parts = clean.split('/');
  return decodeURIComponent(parts[parts.length - 1] || 'Folder');
};

export const getScanFolders = async (): Promise<ScanFolder[]> => {
  try {
    const raw = await AsyncStorage.getItem(SCAN_FOLDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveScanFolders = async (folders: ScanFolder[]) => {
  await AsyncStorage.setItem(SCAN_FOLDERS_KEY, JSON.stringify(folders));
};

export const pickAndAddScanFolder = async (): Promise<ScanFolder | null> => {
  if (FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync == null) {
    throw new Error('Folder scan is supported on Android only');
  }
  const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!result.granted || !result.directoryUri) return null;
  const folder: ScanFolder = {
    uri: result.directoryUri,
    label: getFolderLabelFromUri(result.directoryUri),
  };
  const current = await getScanFolders();
  if (current.some((f) => f.uri === folder.uri)) return folder;
  await saveScanFolders([...current, folder]);
  return folder;
};

export const removeScanFolder = async (uri: string) => {
  const current = await getScanFolders();
  const next = current.filter((f) => f.uri !== uri);
  await saveScanFolders(next);
  return next;
};

export const scanMarkdownFiles = async (): Promise<DeviceMarkdownFile[]> => {
  const folders = await getScanFolders();
  const all: DeviceMarkdownFile[] = [];

  for (const folder of folders) {
    try {
      const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(folder.uri);
      for (const entryUri of entries) {
        const name = decodeURIComponent(entryUri.split('/').pop() || '');
        if (!name.toLowerCase().endsWith('.md')) continue;
        const info = await FileSystem.getInfoAsync(entryUri);
        all.push({
          uri: entryUri,
          name,
          parentUri: folder.uri,
          parentLabel: folder.label,
          size: info.exists ? ((info as any).size ?? 0) : 0,
          mtime: info.exists ? ((info as any).modificationTime ?? Date.now() / 1000) : Date.now() / 1000,
        });
      }
    } catch {
      continue;
    }
  }

  return all;
};
