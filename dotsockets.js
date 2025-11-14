(() => {
  const ENDPOINT_POST = 'https://dotsockets.swvc.workers.dev/points';
  const ENDPOINT_WS = 'wss://dotsockets.swvc.workers.dev/ws';

  const svg = d3.select('#viz');
  const g = svg.append('g');

  let width = 0;
  let height = 0;

  // Normalized domain [0, 100] mapped to pixels
  const xScale = d3.scaleLinear().domain([0, 100]).clamp(true);
  const yScale = d3.scaleLinear().domain([0, 100]).clamp(true);

  let currentPoints = [];
  
  const deletePointByTimestamp = (timestamp) => {
    // Optimistic remove by timestamp
    const next = currentPoints.filter((d) => d.timestamp !== timestamp);
    render(next);
    fetch(`${ENDPOINT_POST}?timestamp=${timestamp}`, {
      method: 'DELETE'
    })
      .then(async (res) => {
        try {
          const data = await res.json();
          console.log('DELETE response:', data);
        } catch (e) {
          console.log('DELETE response (non-JSON or empty body)');
        }
      })
      .catch(() => {
        console.error('Error deleting point');
      });
  };

  function resize() {
    const node = svg.node();
    if (!node) return;
    const rect = node.getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    xScale.range([0, width]);
    yScale.range([0, height]);

    render(currentPoints);
  }

  window.addEventListener('resize', resize);
  // Initialize size after first layout
  requestAnimationFrame(resize);

  // Click handler: map pixels -> [0,100] (rounded integers) and POST
  svg.on('click', (event) => {
    const [px, py] = d3.pointer(event, svg.node());
    const xn = Math.round(xScale.invert(px), 0, 100);
    const yn = Math.round(yScale.invert(py), 0, 100);
    const ts = Date.now();

    // Optimistic add with timestamp identity
    const newPoint = { x: xn, y: yn, timestamp: ts };
    render([...currentPoints, newPoint]);

    fetch(ENDPOINT_POST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: ts, x: xn, y: yn })
    }).catch(() => {
      console.error('Error posting points');
    });
  });

  function render(points) {
    currentPoints = Array.isArray(points) ? points : [];
    // Cancel any ongoing transitions to avoid mid-state freezes on re-render
    g.selectAll('circle.point').interrupt();
    const t = svg.transition().duration(300);

    const circles = g.selectAll('circle.point')
      .data(currentPoints, (d) => d.timestamp);

    const RADIUS = 16;

    const circlesEnter = circles.enter()
      .append('circle')
      .attr('class', 'point')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', 0)
      .attr('opacity', 0)
      .on('click', (event, d) => {
        event.stopPropagation();
        deletePointByTimestamp(d.timestamp);
      });

    circlesEnter.transition(t)
      .attr('r', RADIUS)
      .attr('opacity', 1);

    const circlesUpdate = circles.merge(circlesEnter);
    circlesUpdate.transition(t)
        .attr('cx', (d) => xScale(d.x))
        .attr('cy', (d) => yScale(d.y))
        // Reassert final visual state on updates so interrupted enters finish
        .attr('r', RADIUS)
        .attr('opacity', 1)
        .selection()
        .on('click', (event, d) => {
          event.stopPropagation();
          deletePointByTimestamp(d.timestamp);
        });

    circles.exit()
        .transition(t)
        .attr('r', 0)
        .attr('opacity', 0)
        .remove();
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
        // Expect [{x, y, timestamp}, ...] normalized to [0,100]
        if (Array.isArray(msg)) {
          const valid = msg.filter((d) => d && typeof d.x === 'number' && typeof d.y === 'number' && typeof d.timestamp === 'number');
          render(valid);
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


