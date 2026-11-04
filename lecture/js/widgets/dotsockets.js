/* ==========================================================================
   dotsockets: live audience poll over the existing Cloudflare worker
   (protocol from ../dotsockets.js: WS broadcasts the full array
   [{x, y, timestamp}] with x, y in 0..100 (y top-down); POST {timestamp, x, y};
   DELETE ?timestamp=).
   window.DotSocketsClient is shared by the break slide and join.html.
   ========================================================================== */
(function () {
  "use strict";

  // ------------------------------------------------------------------ client
  window.DotSocketsClient = window.DotSocketsClient || (function () {
    const cfg = (window.LECTURE || {}).dotsockets || {};
    const subs = new Set();
    let ws = null, points = [], status = "offline", backoff = 1000, timer = null;

    const valid = (d) => d && typeof d.x === "number" && typeof d.y === "number" && typeof d.timestamp === "number";
    const notify = () => subs.forEach((fn) => { try { fn(points, status); } catch (e) { console.error(e); } });

    function connect() {
      if (!cfg.ws || typeof WebSocket === "undefined" || !subs.size) return;
      if (ws && ws.readyState <= 1) return;
      status = "connecting"; notify();
      try { ws = new WebSocket(cfg.ws); } catch (e) { ws = null; status = "offline"; notify(); schedule(); return; }
      const me = ws;
      ws.onopen = () => { if (ws !== me) return; status = "connected"; backoff = 1000; notify(); };
      ws.onmessage = (evt) => {
        if (ws !== me) return;
        try {
          const msg = JSON.parse(evt.data);
          if (Array.isArray(msg)) { points = msg.filter(valid); notify(); }
        } catch (e) { /* ignore malformed */ }
      };
      ws.onerror = () => {};
      ws.onclose = () => { if (ws !== me) return; ws = null; status = "offline"; notify(); schedule(); };
    }
    function schedule() {
      clearTimeout(timer);
      if (!subs.size) return;
      timer = setTimeout(connect, backoff);
      backoff = Math.min(10000, backoff * 2);
    }

    return {
      get points() { return points; },
      get status() { return status; },
      joinUrl: cfg.joinUrl || "",
      /** fn(points, status); returns an unsubscribe function */
      subscribe(fn) {
        subs.add(fn);
        fn(points, status);
        connect();
        return () => {
          subs.delete(fn);
          // linger a few seconds so moving between the break and poll slides keeps one socket
          setTimeout(() => {
            if (subs.size) return;
            clearTimeout(timer);
            if (ws) { const w = ws; ws = null; try { w.close(); } catch (e) {} }
            status = "offline";
          }, 4000);
        };
      },
      add(x, y) {
        const p = { x: Math.round(Math.max(0, Math.min(100, x))), y: Math.round(Math.max(0, Math.min(100, y))), timestamp: Date.now() };
        points = [...points, p]; notify(); // optimistic
        if (cfg.post) fetch(cfg.post, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })
          .catch(() => console.warn("dotsockets: POST failed"));
        return p;
      },
      remove(ts) {
        points = points.filter((d) => d.timestamp !== ts); notify(); // optimistic
        if (cfg.post) return fetch(`${cfg.post}?timestamp=${ts}`, { method: "DELETE" }).catch(() => console.warn("dotsockets: DELETE failed"));
        return Promise.resolve();
      },
    };
  })();

  if (!window.Deck) return; // join.html loads this file without the deck

  // ------------------------------------------------------------------ widget
  Deck.css("dotsockets", `
    .ds-wrap { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: calc(var(--u) * 2.4); height: 100%; }
    .ds-chart { position: relative; min-height: 0; min-width: 0; }
    .ds-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; cursor: crosshair; }
    .ds-side { display: flex; flex-direction: column; gap: 0.9rem; min-height: 0; min-width: 0; }
    .ds-join { background: var(--surface); border: 1px solid var(--rule); border-radius: 0.55rem; padding: 0.8rem 1rem; }
    .ds-join .kicker { margin-bottom: 0.35rem; }
    .ds-url { font: 600 1.05rem/1.25 var(--font-mono); color: var(--ink); word-break: break-all; }
    .ds-status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; color: var(--ink-2); }
    .ds-status b { font: 600 1.6rem/1 var(--font-serif); color: var(--ink); }
    .ds-dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--muted); display: inline-block; }
    .ds-dot.connected { background: var(--enter); box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--enter) 25%, transparent); }
    .ds-dot.connecting { background: #eda100; }
    .ds-code { opacity: 0; transform: translateY(0.4rem); transition: opacity 0.4s, transform 0.4s; display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; }
    .ds-code.show { opacity: 1; transform: none; }
    .ds-code pre { margin: 0; background: var(--code-bg); color: var(--code-ink); border-radius: 0.5rem; padding: 0.7rem 0.9rem;
      font: 0.56rem/1.55 var(--font-mono); overflow: auto; white-space: pre; }
    .ds-code pre .hl { border-radius: 0.2em; transition: background 0.6s; }
    .ds-code pre .hl.flash-enter { background: color-mix(in srgb, var(--enter) 45%, transparent); transition: none; }
    .ds-code pre .hl.flash-exit { background: color-mix(in srgb, var(--exit) 45%, transparent); transition: none; }
    .ds-counts { display: flex; gap: 0.6rem; font: 0.6rem var(--font-mono); }
    .ds-counts span { padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--rule); color: var(--ink-2); transition: background 0.6s, color 0.6s; }
    .ds-counts span i { font-style: normal; font-weight: 700; }
    .ds-counts .enter.flash { background: var(--enter); color: #fff; transition: none; }
    .ds-counts .exit.flash { background: var(--exit); color: #fff; transition: none; }
    .ds-clear { margin-top: auto; align-self: flex-start; font-size: 0.55rem; color: var(--muted); background: none; border: 1px dashed var(--rule);
      border-radius: 999px; padding: 0.2rem 0.6rem; cursor: pointer; }
    .ds-clear.arm1 { color: var(--exit); border-color: var(--exit); border-style: solid; }
    .ds-clear.arm2 { color: #fff; background: var(--exit); border-color: var(--exit); border-style: solid; }
    .ds-chart .quad { font: italic 0.62rem var(--font-serif); fill: var(--muted); }
    .ds-chart .axis-label { font: 600 0.58rem var(--font-sans); fill: var(--ink-2); letter-spacing: 0.03em; }
    .ds-chart .tick-label { font: 0.52rem var(--font-sans); fill: var(--muted); }
    .ds-chart .frame { fill: var(--surface); stroke: var(--rule); }
    .ds-chart .mid { stroke: var(--rule); stroke-dasharray: 3 4; }
    .ds-chart circle.pt { fill: var(--accent-2); fill-opacity: 0.55; stroke: var(--ink); stroke-width: 1; }
    .ds-chart circle.pt.newest { fill: var(--accent); fill-opacity: 0.8; }
    .ds-chart .offline { font: 0.7rem var(--font-sans); fill: var(--muted); }
  `);

  const CODE = `<span class="tk-kw">const</span> circles = g.<span class="tk-fn">selectAll</span>(<span class="tk-str">"circle.point"</span>)
  .<span class="tk-fn">data</span>(points, <span class="hl hl-key">(d) <span class="tk-kw">=&gt;</span> d.timestamp</span>);   <span class="tk-com">// key = identity</span>

<span class="hl hl-enter">circles.<span class="tk-fn">enter</span>().<span class="tk-fn">append</span>(<span class="tk-str">"circle"</span>)          <span class="tk-com">// new taps</span>
  .<span class="tk-fn">attr</span>(<span class="tk-str">"r"</span>, <span class="tk-num">0</span>)
  .<span class="tk-fn">transition</span>(t).<span class="tk-fn">attr</span>(<span class="tk-str">"r"</span>, RADIUS);</span>

circles.<span class="tk-fn">transition</span>(t)                     <span class="tk-com">// update</span>
  .<span class="tk-fn">attr</span>(<span class="tk-str">"cx"</span>, (d) <span class="tk-kw">=&gt;</span> x(d.x))
  .<span class="tk-fn">attr</span>(<span class="tk-str">"cy"</span>, (d) <span class="tk-kw">=&gt;</span> y(d.y));

<span class="hl hl-exit">circles.<span class="tk-fn">exit</span>().<span class="tk-fn">transition</span>(t)              <span class="tk-com">// deleted dots</span>
  .<span class="tk-fn">attr</span>(<span class="tk-str">"r"</span>, <span class="tk-num">0</span>).<span class="tk-fn">remove</span>();</span>

<span class="tk-com">// …and the network part is just:</span>
ws.onmessage = (e) <span class="tk-kw">=&gt;</span> <span class="tk-fn">render</span>(JSON.<span class="tk-fn">parse</span>(e.data));`;

  Deck.widget("dotsockets", {
    steps: 1,
    mount(el) {
      const client = window.DotSocketsClient;
      el.innerHTML = `
        <div class="ds-wrap">
          <div class="ds-chart"><svg></svg></div>
          <div class="ds-side">
            <div class="ds-join">
              <div class="kicker">Open on your phone</div>
              <div class="ds-url"></div>
            </div>
            <div class="ds-status"><span class="ds-dot"></span><b class="ds-n">0</b><span class="ds-label">dots</span></div>
            <div class="ds-code">
              <div class="ds-counts"><span class="enter">enter <i>+0</i></span><span class="update">update <i>0</i></span><span class="exit">exit <i>−0</i></span></div>
              <pre>${CODE}</pre>
            </div>
            <button class="ds-clear xray-skip" title="Deletes every dot on the shared worker">clear all dots…</button>
          </div>
        </div>`;
      el.querySelector(".ds-url").textContent = client.joinUrl || "(set LECTURE.dotsockets.joinUrl)";

      const chartBox = el.querySelector(".ds-chart");
      const svg = d3.select(chartBox).select("svg");
      const codeBox = el.querySelector(".ds-code");
      const nEl = el.querySelector(".ds-n"), labelEl = el.querySelector(".ds-label"), dotEl = el.querySelector(".ds-dot");
      const counts = { enter: el.querySelector(".ds-counts .enter"), update: el.querySelector(".ds-counts .update"), exit: el.querySelector(".ds-counts .exit") };

      const x = d3.scaleLinear().domain([0, 100]).clamp(true);
      const y = d3.scaleLinear().domain([0, 100]).clamp(true); // top-down, like dotsockets
      let W = 0, H = 0, S = 0, ox = 0, oy = 0;
      const frame = svg.append("g");
      const dots = svg.append("g");
      const offlineText = svg.append("text").attr("class", "offline").attr("text-anchor", "middle");

      let points = [], status = "offline", unsub = null, prevKeys = new Set();

      function layout() {
        W = chartBox.clientWidth; H = chartBox.clientHeight;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const padL = rem * 1.6, padB = rem * 1.6;
        S = Math.max(50, Math.min(W - padL - rem * 0.5, H - padB - rem * 0.5));
        ox = padL + (W - padL - S) / 2; oy = (H - padB - S) / 2;
        svg.attr("viewBox", `0 0 ${W} ${H}`);
        x.range([ox, ox + S]); y.range([oy, oy + S]);
        frame.selectAll("*").remove();
        frame.append("rect").attr("class", "frame").attr("x", ox).attr("y", oy).attr("width", S).attr("height", S).attr("rx", 6);
        frame.append("line").attr("class", "mid").attr("x1", x(50)).attr("x2", x(50)).attr("y1", oy).attr("y2", oy + S);
        frame.append("line").attr("class", "mid").attr("y1", y(50)).attr("y2", y(50)).attr("x1", ox).attr("x2", ox + S);
        const q = [
          [25, 12, "data-viz yes, JS not yet"], [75, 12, "ready to teach this"],
          [25, 92, "welcome — start here"], [75, 92, "JS dev, new to dataviz"],
        ];
        frame.selectAll("text.quad").data(q).join("text").attr("class", "quad").attr("text-anchor", "middle")
          .attr("x", (d) => x(d[0])).attr("y", (d) => y(d[1])).text((d) => d[2]);
        // axes as words, not numbers
        frame.append("text").attr("class", "axis-label").attr("x", ox + S / 2).attr("y", oy + S + rem * 1.25).attr("text-anchor", "middle").text("JavaScript experience →");
        frame.append("text").attr("class", "tick-label").attr("x", ox).attr("y", oy + S + rem * 1.25).text("none");
        frame.append("text").attr("class", "tick-label").attr("x", ox + S).attr("y", oy + S + rem * 1.25).attr("text-anchor", "end").text("pro");
        frame.append("text").attr("class", "axis-label").attr("transform", `translate(${ox - rem * 0.7},${oy + S / 2}) rotate(-90)`).attr("text-anchor", "middle").text("Data-viz experience →");
        frame.append("text").attr("class", "tick-label").attr("transform", `translate(${ox - rem * 0.7},${oy + S}) rotate(-90)`).text("none");
        frame.append("text").attr("class", "tick-label").attr("transform", `translate(${ox - rem * 0.7},${oy}) rotate(-90)`).attr("text-anchor", "end").text("pro");
        offlineText.attr("x", ox + S / 2).attr("y", oy + S / 2);
        render(false);
      }

      function flash(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); setTimeout(() => node.classList.remove(cls), 700); }

      function render(animate = true) {
        if (!S) return;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const R = Math.max(6, rem * 0.55);
        const keys = new Set(points.map((d) => d.timestamp));
        const nEnter = points.filter((d) => !prevKeys.has(d.timestamp)).length;
        const nExit = [...prevKeys].filter((k) => !keys.has(k)).length;
        const nUpdate = points.length - nEnter;
        prevKeys = keys;
        const newest = d3.max(points, (d) => d.timestamp);
        const t = svg.transition().duration(animate ? 400 : 0);

        dots.selectAll("circle.pt")
          .data(points, (d) => d.timestamp)
          .join(
            (enter) => enter.append("circle").attr("class", "pt")
              .attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.y)).attr("r", 0)
              .call((s) => s.transition(t).attr("r", R)),
            (update) => update.call((s) => s.transition(t).attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.y)).attr("r", R)),
            (exit) => exit.call((s) => s.transition(t).attr("r", 0).remove())
          )
          .classed("newest", (d) => d.timestamp === newest && points.length > 1);

        nEl.textContent = points.length;
        labelEl.textContent = `${points.length === 1 ? "dot" : "dots"} · ${status}`;
        dotEl.className = "ds-dot " + status;
        offlineText.text(points.length ? "" : status === "connected" ? "waiting for the first tap…" : status === "connecting" ? "connecting…" : "offline: no connection to the dotsockets worker");

        if (animate) {
          counts.enter.querySelector("i").textContent = "+" + nEnter;
          counts.update.querySelector("i").textContent = nUpdate;
          counts.exit.querySelector("i").textContent = "−" + nExit;
          if (nEnter) { flash(counts.enter, "flash"); el.querySelectorAll(".hl-enter").forEach((n) => flash(n, "flash-enter")); }
          if (nExit) { flash(counts.exit, "flash"); el.querySelectorAll(".hl-exit").forEach((n) => flash(n, "flash-exit")); }
        }
      }

      // presenter demo: click the chart to add a dot
      svg.on("click", (event) => {
        const [px, py] = d3.pointer(event, svg.node());
        if (px < ox || px > ox + S || py < oy || py > oy + S) return;
        client.add(x.invert(px), y.invert(py));
      });

      // clear all: three clicks, no browser dialogs
      const clearBtn = el.querySelector(".ds-clear");
      let arm = 0, armTimer = null;
      clearBtn.addEventListener("click", () => {
        clearTimeout(armTimer);
        arm++;
        if (arm === 1) { clearBtn.className = "ds-clear xray-skip arm1"; clearBtn.textContent = `delete all ${points.length} dots for everyone?`; }
        else if (arm === 2) { clearBtn.className = "ds-clear xray-skip arm2"; clearBtn.textContent = "sure? click once more"; }
        else {
          const ts = points.map((d) => d.timestamp);
          ts.forEach((t, i) => setTimeout(() => client.remove(t), i * 40));
          Deck.toast(`Deleting ${ts.length} dots`);
          arm = 0;
        }
        if (arm) armTimer = setTimeout(reset, 4000); else reset();
      });
      function reset() { arm = 0; clearBtn.className = "ds-clear xray-skip"; clearBtn.textContent = "clear all dots…"; }

      layout();
      return {
        enter() { if (!unsub) unsub = client.subscribe((p, s) => { points = p; status = s; render(true); }); },
        leave() { if (unsub) { unsub(); unsub = null; } },
        resize: layout,
        step(n) { codeBox.classList.toggle("show", n >= 1); },
      };
    },
  });
})();
