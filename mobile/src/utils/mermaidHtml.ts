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
        touch-action: manipulation;
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
      let svgRef = null;
      let baseWidth = 0;
      let baseHeight = 0;
      let fitScale = 1;
      let currentScale = 1;
      let tapScales = [1, 1.8, 3];
      let tapScaleIndex = 0;
      let lastTapTs = 0;
      let lastTapX = 0;
      let lastTapY = 0;
      let zoomAnimTimer = null;
      const scrollEl = document.scrollingElement || document.documentElement || document.body;

      function post(payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function applyScale(nextScale, anchorClientX, anchorClientY, animated) {
        if (!svgRef || !baseWidth || !baseHeight) return;
        const prevScale = currentScale;
        currentScale = clamp(nextScale, fitScale, 6);
        if (currentScale === prevScale) return;

        const prevRect = svgRef.getBoundingClientRect();
        const anchorPageX = scrollEl.scrollLeft + anchorClientX;
        const anchorPageY = scrollEl.scrollTop + anchorClientY;
        const prevLeft = scrollEl.scrollLeft + prevRect.left;
        const prevTop = scrollEl.scrollTop + prevRect.top;
        const logicalX = clamp((anchorPageX - prevLeft) / prevScale, 0, baseWidth);
        const logicalY = clamp((anchorPageY - prevTop) / prevScale, 0, baseHeight);

        if (zoomAnimTimer) {
          clearTimeout(zoomAnimTimer);
          zoomAnimTimer = null;
        }
        if (animated) {
          svgRef.style.transition = 'width 180ms cubic-bezier(0.2, 0.8, 0.2, 1), height 180ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        } else {
          svgRef.style.transition = 'none';
        }

        svgRef.style.width = (baseWidth * currentScale) + 'px';
        svgRef.style.height = (baseHeight * currentScale) + 'px';

        const nextRect = svgRef.getBoundingClientRect();
        const nextLeft = scrollEl.scrollLeft + nextRect.left;
        const nextTop = scrollEl.scrollTop + nextRect.top;
        const nextAnchorX = nextLeft + (logicalX * currentScale);
        const nextAnchorY = nextTop + (logicalY * currentScale);
        const maxScrollX = Math.max(0, scrollEl.scrollWidth - window.innerWidth);
        const maxScrollY = Math.max(0, scrollEl.scrollHeight - window.innerHeight);
        const targetX = clamp(nextAnchorX - anchorClientX, 0, maxScrollX);
        const targetY = clamp(nextAnchorY - anchorClientY, 0, maxScrollY);
        scrollEl.scrollTo(targetX, targetY);

        if (animated) {
          zoomAnimTimer = setTimeout(() => {
            if (!svgRef) return;
            svgRef.style.transition = 'none';
            zoomAnimTimer = null;
          }, 210);
        }
      }

      function computeTapScales() {
        const scale1 = clamp(fitScale * 1.8, fitScale, 6);
        const scale2 = clamp(fitScale * 3, fitScale, 6);
        if (Math.abs(scale2 - scale1) < 0.08) {
          tapScales = [fitScale, scale1, clamp(scale1 + 0.5, fitScale, 6)];
        } else {
          tapScales = [fitScale, scale1, scale2];
        }
      }

      function handleTouchEnd(event) {
        if (!isFullScreen || !svgRef || !event.changedTouches || event.changedTouches.length !== 1) return;
        const t = event.changedTouches[0];
        const now = Date.now();
        const dt = now - lastTapTs;
        const dx = t.clientX - lastTapX;
        const dy = t.clientY - lastTapY;
        const move = Math.sqrt((dx * dx) + (dy * dy));
        lastTapTs = now;
        lastTapX = t.clientX;
        lastTapY = t.clientY;

        if (dt < 300 && move < 28) {
          event.preventDefault();
          tapScaleIndex = (tapScaleIndex + 1) % 3;
          applyScale(tapScales[tapScaleIndex], t.clientX, t.clientY, true);
        }
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
              const availableWidth = Math.max(1, window.innerWidth - 36);
              fitScale = clamp(availableWidth / baseWidth, 0.1, 1);
              currentScale = fitScale;
              computeTapScales();
              tapScaleIndex = 0;
              svg.style.width = (baseWidth * currentScale) + 'px';
              svg.style.height = (baseHeight * currentScale) + 'px';
              svg.style.maxWidth = 'none';
              document.addEventListener('touchend', handleTouchEnd, { passive: false });
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
