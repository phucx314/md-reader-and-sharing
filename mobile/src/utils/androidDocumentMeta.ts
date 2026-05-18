import { NativeModules, Platform } from 'react-native';

export type AndroidDocumentMeta = {
  lastModified: number | null;
  size: number | null;
  displayName: string | null;
  mimeType?: string | null;
  isDirectory?: boolean;
};

type SafMetadataModuleType = {
  getMetadata: (uri: string) => Promise<AndroidDocumentMeta>;
};

const SafMetadataModule: SafMetadataModuleType | undefined = NativeModules.SafMetadataModule;

export const getAndroidDocumentMeta = async (uri: string): Promise<AndroidDocumentMeta | null> => {
  if (Platform.OS !== 'android') return null;
  if (!uri.startsWith('content://')) return null;
  if (!SafMetadataModule?.getMetadata) return null;

  try {
    const result = await SafMetadataModule.getMetadata(uri);
    return result ?? null;
  } catch {
    return null;
  }
};
