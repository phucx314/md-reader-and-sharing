import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { ThemedText } from './ThemedText';
import type { ThemeColors } from '../constants/theme';
import { parseMarkdownTable } from '../utils/markdownTables';

type TablePreviewProps = {
  tableMarkdown: string;
  columns: number;
  colors: ThemeColors;
  isDark: boolean;
};

export const TablePreview: React.FC<TablePreviewProps> = ({ tableMarkdown, columns, colors, isDark }) => {
  const navigation = useNavigation<any>();
  const [showInline, setShowInline] = React.useState(false);
  const parsed = React.useMemo(() => parseMarkdownTable(tableMarkdown), [tableMarkdown]);
  const colCount = parsed.header.length || columns;
  const normalizedRows = React.useMemo(
    () =>
      parsed.rows.map((row) => {
        const next = row.slice(0, colCount);
        while (next.length < colCount) next.push('');
        return next;
      }),
    [parsed.rows, colCount]
  );
  const columnWidths = React.useMemo(() => {
    const allRows = [parsed.header.slice(0, colCount), ...normalizedRows];
    return Array.from({ length: colCount }, (_, colIdx) => {
      let maxLen = 6;
      for (const row of allRows) {
        const cell = String(row[colIdx] ?? '');
        if (cell.length > maxLen) maxLen = cell.length;
      }
      const width = Math.min(260, Math.max(130, maxLen * 7.2 + 26));
      return width;
    });
  }, [parsed.header, normalizedRows, colCount]);

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: isDark ? colors.surface : '#FFFEF2' }]}>
      <View style={styles.row}>
        <ThemedText type="label" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
          Table ({columns} cols)
        </ThemedText>
        <View style={styles.actions}>
          <Pressable
            style={[styles.openBtn, { borderColor: colors.border, backgroundColor: '#FFFFFF' }]}
            onPress={() => setShowInline((prev) => !prev)}
          >
            <Ionicons name={showInline ? 'chevron-up-outline' : 'grid-outline'} size={14} color={colors.text} />
            <ThemedText type="caption" style={[styles.openText, { color: colors.text }]}>{showInline ? 'Hide' : 'Show Here'}</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.openBtn, { borderColor: colors.border, backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('TableViewer', { tableMarkdown })}
          >
            <Ionicons name="expand-outline" size={14} color="#111111" />
            <ThemedText type="caption" style={styles.openText}>Open</ThemedText>
          </Pressable>
        </View>
      </View>
      <ThemedText type="caption" muted>
        Note: wide tables read best in Table Viewer (better spacing + zoom).
      </ThemedText>
      {showInline && (
        <ScrollView horizontal style={styles.inlineScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          <View style={[styles.inlineTable, { borderColor: colors.border }]}>
            <View style={styles.inlineRow}>
              {parsed.header.slice(0, colCount).map((cell, idx) => (
                <View
                  key={`h-${idx}`}
                  style={[
                    styles.inlineCell,
                    styles.inlineHeaderCell,
                    { width: columnWidths[idx], borderColor: colors.border, backgroundColor: isDark ? colors.card : '#FFFFFF' },
                  ]}
                >
                  <ThemedText type="caption" style={{ fontFamily: 'SpaceGrotesk-Bold' }} numberOfLines={2}>
                    {cell}
                  </ThemedText>
                </View>
              ))}
            </View>
            {normalizedRows.map((row, rowIdx) => (
              <View key={`r-${rowIdx}`} style={styles.inlineRow}>
                {row.map((cell, colIdx) => (
                  <View
                    key={`c-${rowIdx}-${colIdx}`}
                    style={[
                      styles.inlineCell,
                      {
                        width: columnWidths[colIdx],
                        borderColor: colors.border,
                        backgroundColor: isDark ? (rowIdx % 2 === 0 ? '#262626' : '#222222') : (rowIdx % 2 === 0 ? '#FAFAF4' : '#FFFFFF'),
                      },
                    ]}
                  >
                    <ThemedText type="caption" numberOfLines={2}>
                      {cell}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 2,
    marginVertical: 12,
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openBtn: {
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openText: {
    fontFamily: 'SpaceGrotesk-Bold',
  },
  inlineScroll: {
    marginTop: 2,
  },
  inlineTable: {
    borderWidth: 2,
  },
  inlineRow: {
    flexDirection: 'row',
  },
  inlineCell: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inlineHeaderCell: {
    minHeight: 40,
    justifyContent: 'center',
  },
});
