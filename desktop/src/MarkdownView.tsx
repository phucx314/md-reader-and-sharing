import { useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import 'highlight.js/styles/github.css';

type Props = { content: string };

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'SpaceGrotesk, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
});

function useMermaidOnIdle(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!root.current) return;
    const blocks = Array.from(root.current.querySelectorAll('pre > code.language-mermaid')) as HTMLElement[];
    blocks.forEach((code) => {
      const pre = code.parentElement!;
      if (pre.dataset.rendered === '1') return;
      pre.dataset.rendered = '1';
      const source = code.textContent || '';
      const container = document.createElement('div');
      container.className = 'mermaid';
      pre.replaceWith(container);
      mermaid.render(`mermaid-${Math.random().toString(36).slice(2)}`, source)
        .then(({ svg }) => { container.innerHTML = svg; })
        .catch((err) => { container.textContent = `Mermaid error: ${err?.message || err}`; });
    });
  });
}

export function MarkdownView({ content }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useMermaidOnIdle(rootRef);

  const components = useMemo(
    () => ({
      // Custom ==highlight== spans get rendered as <mark> in raw HTML;
      // rehype-raw preserves them. (We also pass through HTML to allow
      // the source author to use <mark> directly if they prefer.)
    }),
    [],
  );

  return (
    <div className="preview" ref={rootRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={components as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
