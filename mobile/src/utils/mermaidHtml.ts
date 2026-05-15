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
      const isFullScreen = ${fullScreen ? 'true' : 'false'};
      let zoom = 1;
      let minZoom = 0.25;
      let baseWidth = 0;
      let baseHeight = 0;
      let svgRef = null;

      function post(payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function applyZoom() {
        if (!svgRef || !baseWidth || !baseHeight) return;
        svgRef.style.width = (baseWidth * zoom) + 'px';
        svgRef.style.height = (baseHeight * zoom) + 'px';
      }

      function zoomAtViewportCenter(factor) {
        const prevZoom = zoom;
        zoom = Math.max(minZoom, Math.min(prevZoom * factor, 6));
        if (zoom === prevZoom) return;

        const centerX = window.scrollX + (window.innerWidth / 2);
        const centerY = window.scrollY + (window.innerHeight / 2);

        const logicalX = centerX / prevZoom;
        const logicalY = centerY / prevZoom;
        applyZoom();

        const nextCenterX = logicalX * zoom;
        const nextCenterY = logicalY * zoom;
        const nextScrollX = Math.max(0, nextCenterX - window.innerWidth / 2);
        const nextScrollY = Math.max(0, nextCenterY - window.innerHeight / 2);
        window.scrollTo(nextScrollX, nextScrollY);
      }

      window.zoomIn = function() {
        zoomAtViewportCenter(1.2);
      };

      window.zoomOut = function() {
        zoomAtViewportCenter(1 / 1.2);
      };

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
            const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\\s+/);
            const vbWidth = Number(viewBox[2]);
            const vbHeight = Number(viewBox[3]);
            if (Number.isFinite(vbWidth) && vbWidth > 0 && Number.isFinite(vbHeight) && vbHeight > 0) {
              baseWidth = vbWidth;
              baseHeight = vbHeight;
            } else {
              const rect = svg.getBoundingClientRect();
              baseWidth = rect.width || 1;
              baseHeight = rect.height || 1;
            }
            svgRef = svg;
            if (isFullScreen) {
              const horizontalPadding = 36;
              const availableWidth = Math.max(1, window.innerWidth - horizontalPadding);
              zoom = Math.min(1, availableWidth / baseWidth);
              minZoom = zoom;
            } else {
              zoom = 1;
              minZoom = 0.25;
            }
            applyZoom();
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
