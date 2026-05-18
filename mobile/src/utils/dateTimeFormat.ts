import AsyncStorage from '@react-native-async-storage/async-storage';

export type DateTimeFormatOption = 'mdy_12h' | 'dmy_24h' | 'iso_24h';

const KEY = '@date_time_format';

export const DEFAULT_DATE_TIME_FORMAT: DateTimeFormatOption = 'mdy_12h';

export const DATE_TIME_OPTIONS: { key: DateTimeFormatOption; label: string }[] = [
  { key: 'mdy_12h', label: 'MMM dd, yyyy - hh:mmAM/PM' },
  { key: 'dmy_24h', label: 'dd MMM yyyy - HH:mm' },
  { key: 'iso_24h', label: 'yyyy-MM-dd HH:mm' },
];

export const getDateTimeFormat = async (): Promise<DateTimeFormatOption> => {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === 'mdy_12h' || raw === 'dmy_24h' || raw === 'iso_24h') return raw;
  return DEFAULT_DATE_TIME_FORMAT;
};

export const setDateTimeFormat = async (value: DateTimeFormatOption) => {
  await AsyncStorage.setItem(KEY, value);
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export const formatAbsoluteDateTime = (date: Date, option: DateTimeFormatOption): string => {
  if (option === 'iso_24h') {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  if (option === 'dmy_24h') {
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(',', ' -');
  }
  return date
    .toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .replace(',', ' -');
};
