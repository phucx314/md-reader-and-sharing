import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { MarkdownView } from './MarkdownView';
import { ConfirmDialog } from './ConfirmDialog';
import { useTheme } from './useTheme';

type FileState = {
  path: string | null;
  content: string;
  saved: string;
  isDirty: boolean;
};

type Toast = { kind: 'success' | 'error' | 'info'; text: string };
type PendingOpen = { kind: 'dialog' } | { kind: 'path'; path: string };

const EMPTY: FileState = { path: null, content: '', saved: '', isDirty: false };
const RECENT_FILES_KEY = 'md-reader-recent-files';
const MAX_RECENT_FILES = 8;

export function App() {
  const { theme, toggle } = useTheme();
  const [file, setFile] = useState<FileState>(EMPTY);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [view, setView] = useState<'edit' | 'preview' | 'split'>('split');
  const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    setRecentFiles(readRecentFiles());
  }, []);

  const syncRecentFiles = useCallback((updater: (previous: string[]) => string[]) => {
    setRecentFiles((previous) => {
      const next = updater(previous);
      window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const showToast = useCallback((kind: Toast['kind'], text: string) => {
    setToast({ kind, text });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const setContent = useCallback((content: string) => {
    setFile((prev) => ({
      ...prev,
      content,
      isDirty: content !== lastSavedRef.current,
    }));
  }, []);

  const loadFromPath = useCallback(async (path: string) => {
    try {
      const text = await invoke<string>('read_text_file', { path });
      lastSavedRef.current = text;
      setFile({ path, content: text, saved: text, isDirty: false });
      syncRecentFiles((previous) => {
        const deduped = previous.filter((item) => item !== path);
        return [path, ...deduped].slice(0, MAX_RECENT_FILES);
      });
      showToast('success', `Opened ${basename(path)}`);
    } catch (error: unknown) {
      showToast('error', `Open failed: ${formatError(error)}`);
    }
  }, [showToast, syncRecentFiles]);

  const requestOpenPath = useCallback(async (path: string) => {
    if (file.isDirty) {
      setPendingOpen({ kind: 'path', path });
      return;
    }
    await loadFromPath(path);
  }, [file.isDirty, loadFromPath]);

  const handleOpen = useCallback(async () => {
    if (file.isDirty) {
      setPendingOpen({ kind: 'dialog' });
      return;
    }
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] }],
    });
    if (typeof selected === 'string') {
      await loadFromPath(selected);
    }
  }, [file.isDirty, loadFromPath]);

  const handleSave = useCallback(async (forceDialog = false) => {
    if (!file.path || forceDialog) {
      const target = await saveDialog({
        defaultPath: file.path || 'untitled.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!target) return;
      try {
        await invoke('write_text_file', { path: target, content: file.content });
        lastSavedRef.current = file.content;
        setFile((prev) => ({ ...prev, path: target, saved: prev.content, isDirty: false }));
        syncRecentFiles((previous) => {
          const deduped = previous.filter((item) => item !== target);
          return [target, ...deduped].slice(0, MAX_RECENT_FILES);
        });
        showToast('success', 'Saved');
      } catch (error: unknown) {
        showToast('error', `Save failed: ${formatError(error)}`);
      }
      return;
    }
    try {
      await invoke('write_text_file', { path: file.path, content: file.content });
      lastSavedRef.current = file.content;
      setFile((prev) => ({ ...prev, saved: prev.content, isDirty: false }));
      showToast('success', 'Saved');
    } catch (error: unknown) {
      showToast('error', `Save failed: ${formatError(error)}`);
    }
  }, [file.path, file.content, showToast, syncRecentFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); handleOpen(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (e.shiftKey) handleSave(true); else handleSave(false); }
      else if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleOpen, handleSave, toggle]);

  // Listen for "open file" events from Tauri (CLI args)
  useEffect(() => {
    const unlistenPromises: Array<Promise<() => void>> = [];

    unlistenPromises.push(
      listen<string>('open-file', async (event) => {
        await requestOpenPath(event.payload);
      }),
    );

    Promise.all(unlistenPromises).then((fns) => {
      fns.forEach((fn) => fn());
    });

    // Also fetch initial CLI file at startup
    invoke<string | null>('get_initial_file').then((path) => {
      if (path) return requestOpenPath(path);
      return undefined;
    }).catch(() => undefined);

    return () => {
      unlistenPromises.forEach((p) => p.then((fn) => fn()).catch(() => undefined));
    };
  }, [requestOpenPath]);

  // Window close guard
  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await win.onCloseRequested(async (event) => {
        if (file.isDirty) {
          event.preventDefault();
          const confirmed = window.confirm('You have unsaved changes. Close anyway?');
          if (confirmed) {
            await win.destroy();
          }
        }
      });
    })();
    return () => { unlisten?.(); };
  }, [file.isDirty]);

  const onConfirmDiscard = useCallback(async () => {
    const nextOpen = pendingOpen;
    setPendingOpen(null);
    if (!nextOpen) return;
    if (nextOpen.kind === 'dialog') {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'txt'] }],
      });
      if (typeof selected === 'string') await loadFromPath(selected);
    } else {
      await loadFromPath(nextOpen.path);
    }
  }, [pendingOpen, loadFromPath]);

  const clearRecentFiles = useCallback(() => {
    window.localStorage.removeItem(RECENT_FILES_KEY);
    setRecentFiles([]);
    showToast('info', 'Cleared recent files');
  }, [showToast]);

  const filename = useMemo(() => (file.path ? basename(file.path) : 'Untitled.md'), [file.path]);

  return (
    <div className="app">
      <header className="app-header">
        <span className="title">MD Reader</span>
        <input
          className="filename"
          value={filename}
          readOnly
          aria-label="Filename"
        />
        {file.isDirty ? <span className="dirty-dot" title="Unsaved changes" /> : null}
        <span className="spacer" />
        <button onClick={handleOpen}>Open</button>
        <button onClick={() => handleSave(false)} disabled={!file.path && !file.content}>Save</button>
        <button className="secondary" onClick={() => handleSave(true)}>Save As…</button>
        <button className="secondary" onClick={toggle} title="Toggle theme (Ctrl+P)">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      <div className="toolbar">
        <div className="toggle" role="tablist" aria-label="View mode">
          <button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>Edit</button>
          <button className={view === 'split' ? 'active' : ''} onClick={() => setView('split')}>Split</button>
          <button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>Preview</button>
        </div>
        <span className="meta">
          {file.isDirty ? '● Unsaved' : '✓ Saved'}{' · '}
          {file.content.length} chars · {file.content.split(/\s+/).filter(Boolean).length} words
        </span>
      </div>

      {file.path || file.content ? (
        <div className={`editor ${view === 'split' ? '' : 'single'}`}>
          {view !== 'preview' ? (
            <textarea
              value={file.content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              placeholder="# Start writing…"
            />
          ) : null}
          {view !== 'edit' ? (
            <MarkdownView content={file.content || '*Nothing to preview yet…*'} />
          ) : null}
        </div>
      ) : (
        <div className="empty">
          <h1>No file open</h1>
          <p>Open a <code>.md</code> file to start reading and editing.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleOpen}>Open File</button>
            <button className="secondary" onClick={() => handleSave(true)}>New File</button>
          </div>
          {recentFiles.length ? (
            <div className="recent-files brutal-card">
              <div className="recent-files-header">
                <strong>Recent files</strong>
                <button className="secondary recent-clear" onClick={clearRecentFiles}>Clear</button>
              </div>
              <div className="recent-files-list">
                {recentFiles.map((path) => (
                  <button
                    key={path}
                    className="secondary recent-file"
                    onClick={() => requestOpenPath(path)}
                    title={path}
                  >
                    <span>{basename(path)}</span>
                    <small>{path}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <p style={{ marginTop: 18, fontSize: 13 }}>
            Tip: right-click any <code>.md</code> file in your file manager and choose <b>Open With → MD Reader</b>.
          </p>
          <p style={{ fontSize: 12 }}>
            Shortcuts: <kbd>Ctrl</kbd>+<kbd>O</kbd> open · <kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> save as · <kbd>Ctrl</kbd>+<kbd>P</kbd> theme
          </p>
        </div>
      )}

      <ConfirmDialog
        open={pendingOpen !== null}
        title="Unsaved changes"
        message="You have unsaved changes that will be lost. Continue?"
        confirmText="Discard & open"
        danger
        onCancel={() => { setPendingOpen(null); }}
        onConfirm={onConfirmDiscard}
      />

      {toast ? <div className={`toast ${toast.kind}`}>{toast.text}</div> : null}
    </div>
  );
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function readRecentFiles(): string[] {
  const raw = window.localStorage.getItem(RECENT_FILES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
