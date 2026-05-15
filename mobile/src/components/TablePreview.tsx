import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';

import { ThemedText } from './ThemedText';
import type { ThemeColors } from '../constants/theme';

type TablePreviewProps = {
  tableMarkdown: string;
  columns: number;
  colors: ThemeColors;
  isDark: boolean;
  markdownStyles: any;
};

export const TablePreview: React.FC<TablePreviewProps> = ({ tableMarkdown, columns, colors, isDark, markdownStyles }) => {
  const navigation = useNavigation<any>();
  const [showInline, setShowInline] = React.useState(false);

  return (
    <>
      <View
        style={[
          styles.wrap,
          showInline && styles.wrapExpanded,
          { borderColor: colors.border, backgroundColor: isDark ? colors.surface : '#FFFEF2' },
        ]}
      >
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
      </View>
      {showInline && (
        <View style={styles.inlineMarkdownWrap}>
          <Markdown
            style={{
              ...markdownStyles,
              body: { ...(markdownStyles?.body || {}), marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 },
              table: { ...(markdownStyles?.table || {}), marginVertical: 0, marginTop: 0, marginBottom: 0 },
            }}
          >
            {`${tableMarkdown}\n`}
          </Markdown>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 2,
    marginVertical: 12,
    padding: 12,
    gap: 8,
  },
  wrapExpanded: {
    marginBottom: 0,
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
  inlineMarkdownWrap: {
    marginTop: 0,
    marginBottom: 10,
  },
});
