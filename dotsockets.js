(() => {
  const ENDPOINT_POST = 'https://dotsockets.swvc.workers.dev/points';
  const ENDPOINT_WS = 'wss://dotsockets.swvc.workers.dev/ws';

  const svg = d3.select('#viz');
  const g = svg.append('g');

  let width = 0;
  let height = 0;

  // Normalized domain [0, 100] mapped to pixels
  const xScale = d3.scaleLinear().domain([0, 100]);
  const yScale = d3.scaleLinear().domain([0, 100]);

  let currentPoints = [];

  // Local clamp helper to avoid relying on d3.clamp availability
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function resize() {
    const node = svg.node();
    if (!node) return;
    const rect = node.getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    xScale.range([0, width]);
    yScale.range([0, height]);

    // Re-position existing points after resize
    render(currentPoints, { transition: false });
  }

  window.addEventListener('resize', resize);
  // Initialize size after first layout
  requestAnimationFrame(resize);

  // Click handler: map pixels -> [0,100] (rounded integers) and POST
  svg.on('click', (event) => {
    const [px, py] = d3.pointer(event, svg.node());
    const xn = Math.round(clamp(xScale.invert(px), 0, 100));
    const yn = Math.round(clamp(yScale.invert(py), 0, 100));

    fetch(ENDPOINT_POST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [xn, yn] })
    }).catch(() => {
      // best-effort; ignore errors for now
    });
  });

  function render(points, opts = { transition: true }) {
    currentPoints = Array.isArray(points) ? points : [];
    const t = opts.transition ? svg.transition().duration(300) : null;

    const circles = g.selectAll('circle.point')
      .data(currentPoints, (d) => `${d[0]},${d[1]}`);

    const circlesEnter = circles.enter()
      .append('circle')
      .attr('class', 'point')
      .attr('cx', (d) => xScale(d[0]))
      .attr('cy', (d) => yScale(d[1]))
      .attr('r', 0)
      .attr('opacity', 0);

    if (t) {
      circlesEnter.transition(t)
        .attr('r', 6)
        .attr('opacity', 1);
    } else {
      circlesEnter
        .attr('r', 6)
        .attr('opacity', 1);
    }

    const circlesUpdate = circles.merge(circlesEnter);
    if (t) {
      circlesUpdate.transition(t)
        .attr('cx', (d) => xScale(d[0]))
        .attr('cy', (d) => yScale(d[1]));
    } else {
      circlesUpdate
        .attr('cx', (d) => xScale(d[0]))
        .attr('cy', (d) => yScale(d[1]));
    }

    if (t) {
      circles.exit()
        .transition(t)
        .attr('r', 0)
        .attr('opacity', 0)
        .remove();
    } else {
      circles.exit().remove();
    }
  }

  // WebSocket with simple exponential backoff reconnect
  let ws;
  let backoffMs = 1000;
  const maxBackoffMs = 10000;

  function connectWs() {
    try {
      ws = new WebSocket(ENDPOINT_WS);
    } catch (_) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      backoffMs = 1000; // reset backoff on successful connect
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        // Expect [[x,y], [x,y], ...] normalized to [0,100]
        if (Array.isArray(msg)) {
          render(msg, { transition: true });
        }
      } catch (_) {
        // ignore malformed
      }
    };

    ws.onclose = scheduleReconnect;
    ws.onerror = scheduleReconnect;
  }

  function scheduleReconnect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    const delay = backoffMs;
    backoffMs = Math.min(maxBackoffMs, backoffMs * 2);
    setTimeout(connectWs, delay);
  }

  connectWs();
})();


