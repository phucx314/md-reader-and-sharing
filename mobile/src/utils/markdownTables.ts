export type MarkdownBlock =
  | { type: 'markdown'; content: string }
  | { type: 'table'; content: string; columns: number };

const SEP_RE = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;

const countColumns = (line: string): number => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  if (!trimmed) return 0;
  return trimmed.split('|').length;
};

const looksLikeTableHeader = (line: string): boolean => {
  return line.includes('|') && countColumns(line) >= 2;
};

export const splitMarkdownWithTables = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.split('\n');
  const blocks: MarkdownBlock[] = [];
  let mdBuffer: string[] = [];
  let i = 0;

  const flushMarkdown = () => {
    if (mdBuffer.length === 0) return;
    blocks.push({ type: 'markdown', content: mdBuffer.join('\n') });
    mdBuffer = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';
    const isTableStart = looksLikeTableHeader(line) && SEP_RE.test(next);
    if (!isTableStart) {
      mdBuffer.push(line);
      i += 1;
      continue;
    }

    flushMarkdown();
    const tableLines = [line, next];
    i += 2;

    while (i < lines.length) {
      const current = lines[i];
      if (current.trim() === '' || !current.includes('|')) break;
      tableLines.push(current);
      i += 1;
    }

    const columns = countColumns(tableLines[0]);
    blocks.push({ type: 'table', content: tableLines.join('\n'), columns });
  }

  flushMarkdown();
  return blocks.length > 0 ? blocks : [{ type: 'markdown', content: markdown }];
};

const escapeHtml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
};

export const markdownTableToHtml = (tableMarkdown: string, isDark: boolean): string => {
  const lines = tableMarkdown.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return '<p>Invalid table</p>';

  const header = parseRow(lines[0]);
  const bodyRows = lines.slice(2).map(parseRow);
  const bg = isDark ? '#1C1C1C' : '#FFFEF2';
  const card = isDark ? '#2C2C2C' : '#FFFFFF';
  const text = isDark ? '#F5F0E8' : '#111111';
  const border = isDark ? '#F5F0E8' : '#111111';
  const headerBg = '#FACC15';
  const headerText = '#111111';

  const headerHtml = header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
  const rowsHtml = bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=8, user-scalable=yes">
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: 100%;
        background: ${bg};
        color: ${text};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .wrap {
        padding: 14px;
        white-space: nowrap;
      }
      table {
        border-collapse: collapse;
        background: ${card};
        border: 2px solid ${border};
        width: max-content;
        min-width: 100%;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: ${headerBg};
        color: ${headerText};
      }
      th, td {
        border: 2px solid ${border};
        padding: 10px 12px;
        white-space: nowrap;
        text-align: left;
        font-size: 14px;
        line-height: 18px;
        color: ${text};
      }
      th {
        font-weight: 700;
      }
      tbody tr:nth-child(odd) td {
        background: ${isDark ? '#252525' : '#FAFAF4'};
      }
      .right-spacer {
        display: inline-block;
        width: 14px;
        height: 1px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="right-spacer"></div>
    </div>
  </body>
</html>`;
};

export const parseMarkdownTable = (tableMarkdown: string): { header: string[]; rows: string[][] } => {
  const lines = tableMarkdown.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return { header: [], rows: [] };
  const header = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);
  return { header, rows };
};
