import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export interface LocalFile {
  id: string;
  filename: string;
  uri: string;
  createdAt: number;
  origin?: 'local' | 'imported';
}

const STORE_KEY = '@local_files';

export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const getFiles = async (): Promise<LocalFile[]> => {
  try {
    const data = await AsyncStorage.getItem(STORE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get files from store', error);
    return [];
  }
};

export const saveFiles = async (files: LocalFile[]) => {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(files));
  } catch (error) {
    console.error('Failed to save files to store', error);
  }
};

export const getFileByName = async (filename: string): Promise<LocalFile | undefined> => {
  const files = await getFiles();
  return files.find(f => f.filename === filename);
};

export const saveFile = async (file: LocalFile) => {
  const files = await getFiles();
  const index = files.findIndex(f => f.id === file.id);
  if (index >= 0) {
    files[index] = { ...files[index], ...file };
  } else {
    files.push(file);
  }
  await saveFiles(files);
};

export const deleteFile = async (id: string) => {
  const files = await getFiles();
  const filtered = files.filter(f => f.id !== id);
  await saveFiles(filtered);
};

export const renameFileInStore = async (id: string, newFilename: string, newUri: string) => {
  const files = await getFiles();
  const index = files.findIndex(f => f.id === id);
  if (index >= 0) {
    files[index].filename = newFilename;
    files[index].uri = newUri;
    await saveFiles(files);
  }
};

export const syncFilesWithFS = async () => {
  try {
    const rootDir = FileSystem.documentDirectory;
    if (!rootDir) {
      return [];
    }
    
    const dir = `${rootDir}markdown_files/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    
    const fsFiles = await FileSystem.readDirectoryAsync(dir);
    const mdFiles = fsFiles.filter(f => f.endsWith('.md'));
    
    let dbFiles = await getFiles();
    let isDirty = false;
    
    // Remove files from DB that don't exist in FS
    const validDbFiles = dbFiles.filter(dbFile => {
      if (mdFiles.includes(dbFile.filename)) return true;
      isDirty = true;
      return false;
    });
    
    // Add files to DB that exist in FS but not in DB
    const dbFilenames = validDbFiles.map(f => f.filename);
    for (const fsFile of mdFiles) {
      if (!dbFilenames.includes(fsFile)) {
        validDbFiles.push({
          id: generateUUID(),
          filename: fsFile,
          uri: `${dir}${fsFile}`,
          createdAt: Date.now(),
          origin: 'local',
        });
        isDirty = true;
      }
    }
    
    if (isDirty) {
      await saveFiles(validDbFiles);
    }
    
    return validDbFiles;
  } catch (error) {
    console.error('Sync failed', error);
    return [];
  }
};
