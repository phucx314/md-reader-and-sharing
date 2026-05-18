import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const SCAN_FOLDERS_KEY = '@device_scan_folders_v1';
const SCAN_RECURSIVE_KEY = '@device_scan_recursive_all_v1';

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
  mtime: number | null;
};

const getFolderLabelFromUri = (uri: string) => {
  const clean = String(uri || '').replace(/\/+$/, '');
  const parts = clean.split('/');
  return decodeURIComponent(parts[parts.length - 1] || 'Folder');
};

const getDisplayNameFromEntryUri = (entryUri: string) => {
  const decoded = decodeURIComponent(entryUri);
  const rawTail = decoded.split('/').pop() || '';
  const afterColon = rawTail.includes(':') ? rawTail.split(':').slice(1).join(':') : rawTail;
  const normalized = afterColon.replace(/\\/g, '/');
  return normalized.split('/').pop() || afterColon || rawTail || 'unknown.md';
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

export const getScanRecursiveAll = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(SCAN_RECURSIVE_KEY);
    if (raw == null) return false;
    return raw === '1';
  } catch {
    return false;
  }
};

export const setScanRecursiveAll = async (enabled: boolean) => {
  await AsyncStorage.setItem(SCAN_RECURSIVE_KEY, enabled ? '1' : '0');
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
  const recursiveAll = await getScanRecursiveAll();
  const all: DeviceMarkdownFile[] = [];
  console.log('[DeviceScan] start scan folders:', folders.map((f) => ({ label: f.label, uri: f.uri })), 'recursiveAll=', recursiveAll);

  const walk = async (folder: ScanFolder, dirUri: string, depth: number): Promise<void> => {
    const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
    console.log(`[DeviceScan] folder=${folder.label} depth=${depth} entries=${entries.length}`);
    for (const entryUri of entries) {
      const info = await FileSystem.getInfoAsync(entryUri);
      const name = getDisplayNameFromEntryUri(entryUri);
      if ((info as any).isDirectory) {
        if (recursiveAll) {
          await walk(folder, entryUri, depth + 1);
        }
        continue;
      }
      if (!name.toLowerCase().endsWith('.md')) continue;
      all.push({
        uri: entryUri,
        name,
        parentUri: folder.uri,
        parentLabel: folder.label,
        size: info.exists ? ((info as any).size ?? 0) : 0,
        mtime: info.exists
          ? (((info as any).modificationTime ?? (info as any).mtime ?? (info as any).lastModified ?? null) as number | null)
          : null,
      });
    }
  };

  for (const folder of folders) {
    try {
      await walk(folder, folder.uri, 0);
    } catch (error) {
      console.error('[DeviceScan] scan folder failed', { folder, error });
      continue;
    }
  }

  console.log(`[DeviceScan] total markdown files=${all.length}`);
  return all;
};
