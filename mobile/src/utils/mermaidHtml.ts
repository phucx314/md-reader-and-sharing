export const buildMermaidHtml = (chart: string, isDark: boolean, fullScreen: boolean) => {
  const encodedChart = JSON.stringify(chart);
  const theme = isDark ? 'dark' : 'default';
  const background = isDark ? '#1C1C1C' : '#FFFEF2';
  const text = isDark ? '#F5F0E8' : '#111111';

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
        background: ${background};
        color: ${text};
        overflow: ${fullScreen ? 'auto' : 'hidden'};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        display: flex;
        align-items: ${fullScreen ? 'flex-start' : 'center'};
        justify-content: ${fullScreen ? 'flex-start' : 'center'};
      }
      #graph {
        box-sizing: border-box;
        width: auto;
        padding: ${fullScreen ? '18px' : '10px'};
        min-width: ${fullScreen ? '100%' : '0'};
      }
      #graph svg {
        display: block;
        width: ${fullScreen ? 'auto' : '100%'};
        max-width: ${fullScreen ? 'none' : '100%'};
        height: auto;
      }
      .error {
        box-sizing: border-box;
        padding: 16px;
        white-space: pre-wrap;
        font-size: 14px;
        line-height: 20px;
      }
    </style>
  </head>
  <body>
    <div id="graph"></div>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
      const source = ${encodedChart};

      function post(payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      async function renderGraph() {
        const graph = document.getElementById('graph');
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: '${theme}',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: true, htmlLabels: true },
            sequence: { useMaxWidth: true },
            gantt: { useMaxWidth: true }
          });
          const result = await mermaid.render('graph-' + Date.now(), source);
          graph.innerHTML = result.svg;
          const svg = graph.querySelector('svg');
          if (svg) {
            svg.removeAttribute('width');
            svg.removeAttribute('height');
            if (!${fullScreen ? 'true' : 'false'}) {
              svg.style.width = '100%';
              svg.style.maxWidth = '100%';
              svg.style.height = 'auto';
            } else {
              svg.style.width = 'auto';
              svg.style.maxWidth = 'none';
              svg.style.height = 'auto';
            }
          }
          post({ type: 'rendered' });
        } catch (error) {
          graph.innerHTML = '<div class="error">Mermaid render failed\\n\\n' +
            String(error && (error.message || error)).replace(/[<>&]/g, function(char) {
              return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char];
            }) +
            '</div>';
          post({ type: 'error' });
        }
      }

      if (window.mermaid) {
        renderGraph();
      } else {
        window.addEventListener('load', renderGraph);
      }
    </script>
  </body>
</html>`;
};
