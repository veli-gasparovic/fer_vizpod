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
    const msgSubs = new Set();    // network log: fn(bytes, count) for every WebSocket message
    let ws = null, points = [], status = "offline", backoff = 1000, timer = null;
    // Deletes: the worker broadcasts the full array after every change, and concurrent DELETEs can
    // overwrite each other on the worker. So deletes go out one at a time, the dots stay hidden while
    // `pending`, and anything the server still has after a round is deleted again.
    let raw = [];                 // the last array the server sent
    const pending = new Set();    // timestamps we are deleting
    let queue = Promise.resolve();
    const has = (arr, ts) => arr.some((d) => d.timestamp === ts);
    const visible = () => raw.filter((d) => !pending.has(d.timestamp));

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
          if (Array.isArray(msg)) {
            raw = msg.filter(valid);
            msgSubs.forEach((fn) => { try { fn(evt.data.length, raw.length); } catch (e) {} });
            for (const ts of pending) if (!has(raw, ts)) pending.delete(ts); // confirmed gone
            points = visible(); notify();
          }
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
      /** fn(bytes, count) for every message the server pushes; returns an unsubscribe function */
      onMessage(fn) { msgSubs.add(fn); return () => msgSubs.delete(fn); },
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
      remove(ts) { return this.removeMany([ts]); },
      /** delete several dots; resolves with how many the server still has afterwards */
      removeMany(list) {
        list.forEach((ts) => pending.add(ts));
        points = points.filter((d) => !pending.has(d.timestamp)); notify(); // optimistic
        if (!cfg.post) return Promise.resolve(0);
        const del = (ts) => fetch(`${cfg.post}?timestamp=${ts}`, { method: "DELETE" })
          .then((r) => { if (r.ok) raw = raw.filter((d) => d.timestamp !== ts); })
          .catch(() => console.warn("dotsockets: DELETE failed"));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        queue = queue.then(async () => {
          for (let round = 0; round < 4; round++) {
            const todo = round === 0 ? list : list.filter((ts) => has(raw, ts));
            if (!todo.length) break;
            for (const ts of todo) await del(ts);   // one at a time
            await wait(round === 0 ? 800 : 1500);   // let the last broadcast arrive
          }
          const left = list.filter((ts) => has(raw, ts)).length;
          list.forEach((ts) => pending.delete(ts));
          points = visible(); notify();
          return left;
        });
        return queue;
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
    .ds-net { display: none; flex-direction: column; gap: 0.55rem; min-height: 0; }
    .ds-net.show { display: flex; animation: ds-in .4s ease; }
    @keyframes ds-in { from { opacity: 0; transform: translateY(0.4rem); } }
    .ds-flow { display: flex; align-items: center; gap: 0.35rem; font: 0.56rem var(--font-mono); color: var(--ink-2); flex-wrap: wrap; }
    .ds-flow b { font: 600 0.62rem var(--font-sans); color: var(--ink); background: var(--surface); border: 1px solid var(--rule); border-radius: 0.35rem; padding: 0.2rem 0.5rem; }
    .ds-flow span { position: relative; display: inline-flex; flex-direction: column; align-items: center; line-height: 1.1; }
    .ds-flow b { transition: box-shadow .6s, border-color .6s; }
    .ds-flow b.glow { border-color: var(--enter); box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--enter) 30%, transparent); transition: none; }
    .ds-flow .pk { position: absolute; left: 0; bottom: 0.18em; width: 0.5rem; height: 0.5rem; margin-left: -0.25rem; border-radius: 50%;
      background: var(--enter); box-shadow: 0 0 0.4rem var(--enter); opacity: 0; pointer-events: none; }
    .ds-flow .pk.go { animation: ds-pk .55s ease-in forwards; }
    @keyframes ds-pk { 0% { left: 0; opacity: 1; } 90% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
    .ds-behind { font-size: 0.62rem; line-height: 1.45; color: var(--ink-2); margin: 0; }
    .ds-behind b { color: var(--ink); }
    .ds-dot.ping { animation: ds-ping 0.9s ease-out; }
    @keyframes ds-ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--enter) 75%, transparent); } 100% { box-shadow: 0 0 0 1.1rem transparent; } }
    .ds-flow span::after { content: "──────▶"; letter-spacing: -0.12em; color: var(--muted); }
    .ds-net pre { margin: 0; background: var(--code-bg); color: var(--code-ink); border-radius: 0.5rem; padding: 0.6rem 0.85rem;
      font: 0.58rem/1.55 var(--font-mono); overflow: auto; white-space: pre; }
    .ds-log { font: 0.54rem/1.6 var(--font-mono); color: var(--ink-2); background: var(--surface); border: 1px solid var(--rule); border-radius: 0.45rem; padding: 0.35rem 0.7rem; min-height: 4.4em; flex: none; }
    .ds-log div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ds-log div:first-child { color: var(--ink); }
    .ds-log .fresh { animation: ds-fresh 1.2s ease; }
    @keyframes ds-fresh { from { background: color-mix(in srgb, var(--enter) 30%, transparent); } }
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

  const NET = `<span class="tk-com">// a file that doesn't change: ONE request, one answer</span>
<span class="tk-kw">const</span> rows = <span class="tk-kw">await</span> d3.<span class="tk-fn">csv</span>(<span class="tk-str">"population.csv"</span>);

<span class="tk-com">// live data: open a connection and keep it open.</span>
<span class="tk-com">// The server pushes the whole array on connect + on every change.</span>
<span class="tk-kw">const</span> ws = <span class="tk-kw">new</span> <span class="tk-fn">WebSocket</span>(<span class="tk-str">"wss://dotsockets.swvc.workers.dev/ws"</span>);
ws.onmessage = (e) <span class="tk-kw">=&gt;</span> {
  <span class="tk-kw">const</span> points = JSON.<span class="tk-fn">parse</span>(e.data);   <span class="tk-com">// [{x, y, timestamp}, …]</span>
  <span class="tk-fn">render</span>(points);                       <span class="tk-com">// the join from step 1</span>
};

<span class="tk-com">// your phone (join.html) sends a tap as an HTTP POST</span>
<span class="tk-fn">fetch</span>(<span class="tk-str">"https://dotsockets.swvc.workers.dev/points"</span>, {
  method: <span class="tk-str">"POST"</span>,
  headers: { <span class="tk-str">"Content-Type"</span>: <span class="tk-str">"application/json"</span> },
  body: JSON.<span class="tk-fn">stringify</span>({ x, y, timestamp: Date.<span class="tk-fn">now</span>() }),
});`;

  // "clear all dots" lives only in the presenter window (the public deck has no delete button).
  // Three clicks, no browser dialogs.
  Deck.presenterTool(["poll", "break"], (box) => {
    const client = window.DotSocketsClient;
    box.innerHTML = `<button class="btn ds-pclear">clear all dots…</button> <span class="pv-sub ds-pmsg"></span>`;
    const btn = box.querySelector("button"), msg = box.querySelector(".ds-pmsg");
    let points = [], status = "offline", unsub = null, arm = 0, armTimer = null, busy = false;
    const idle = () => { arm = 0; btn.style.cssText = ""; btn.textContent = `clear all ${points.length} dots…`; };
    btn.onclick = () => {
      if (busy) return;
      clearTimeout(armTimer);
      arm++;
      if (arm === 1) { btn.style.cssText = "color: var(--exit); border-color: var(--exit)"; btn.textContent = `delete all ${points.length} dots for everyone?`; }
      else if (arm === 2) { btn.style.cssText = "color: #fff; background: var(--exit); border-color: var(--exit)"; btn.textContent = "sure? click once more"; }
      else {
        const ts = points.map((d) => d.timestamp);
        busy = true; idle(); msg.textContent = `deleting ${ts.length}…`;
        client.removeMany(ts).then((left) => { busy = false; msg.textContent = left ? `${left} would not delete, try again` : `cleared ${ts.length}`; idle(); });
        return;
      }
      armTimer = setTimeout(idle, 4000);
    };
    return {
      show() {
        msg.textContent = "";
        if (!unsub) unsub = client.subscribe((p, s) => { points = p; status = s; if (!arm) idle(); if (!busy && status !== "connected") msg.textContent = status; else if (!busy && /^(offline|connecting)$/.test(msg.textContent)) msg.textContent = ""; });
      },
      hide() { if (unsub) { unsub(); unsub = null; } clearTimeout(armTimer); idle(); },
    };
  });

  Deck.widget("dotsockets", {
    steps: 2,
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
            <div class="ds-net">
              <div class="ds-flow"><b>your phone</b><span>POST</span><b class="fw-worker">Cloudflare worker</b><span>WebSocket<i class="pk"></i></span><b class="fw-screen">every screen</b></div>
              <p class="ds-behind"><b>Behind the scenes:</b> your tap goes to the worker as a POST; the worker saves it and pushes the whole list down an open WebSocket to every screen in the room. Each push (green flash, log below) re-runs the join.</p>
              <pre>${NET}</pre>
              <div class="ds-log"><div class="muted">← waiting for the server to push…</div></div>
            </div>
          </div>
        </div>`;
      el.querySelector(".ds-url").textContent = client.joinUrl || "(set LECTURE.dotsockets.joinUrl)";

      const chartBox = el.querySelector(".ds-chart");
      const svg = d3.select(chartBox).select("svg");
      const codeBox = el.querySelector(".ds-code");
      const netBox = el.querySelector(".ds-net"), logBox = el.querySelector(".ds-log");
      let unMsg = null;
      const pk = el.querySelector(".ds-flow .pk"), fwWorker = el.querySelector(".fw-worker"), fwScreen = el.querySelector(".fw-screen");
      const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
      const pulse = () => {
        restart(el.querySelector(".ds-dot"), "ping");
        restart(fwWorker, "glow"); setTimeout(() => fwWorker.classList.remove("glow"), 50);
        restart(pk, "go");
        setTimeout(() => { restart(fwScreen, "glow"); setTimeout(() => fwScreen.classList.remove("glow"), 50); }, 520);
      };
      const logMsg = (bytes, n) => {
        pulse();
        const t = new Date().toTimeString().slice(0, 8);
        const kb = bytes >= 1024 ? (bytes / 1024).toFixed(1) + " KB" : bytes + " bytes";
        const row = document.createElement("div");
        row.className = "fresh";
        row.textContent = `${t}  ← ${n} ${n === 1 ? "point" : "points"} · ${kb} of JSON`;
        logBox.querySelector(".muted")?.remove();
        logBox.prepend(row);
        while (logBox.children.length > 3) logBox.lastChild.remove();
      };
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
        dotEl.classList.remove("connected", "connecting", "offline"); dotEl.classList.add(status);
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

      layout();
      return {
        enter() {
          if (!unMsg) unMsg = client.onMessage(logMsg);
          if (!unsub) unsub = client.subscribe((p, s) => { points = p; status = s; render(true); });
        },
        leave() { if (unsub) { unsub(); unsub = null; } if (unMsg) { unMsg(); unMsg = null; } },
        resize: layout,
        step(n) { codeBox.classList.toggle("show", n === 1); codeBox.style.display = n >= 2 ? "none" : ""; netBox.classList.toggle("show", n >= 2); },
      };
    },
  });
})();
