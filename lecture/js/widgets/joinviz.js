/* joinviz: the data join, visualized.
   Top row = the data array D (chips). Bottom row = DOM nodes N (real <g> elements
   joined with selection.data(data, key).join(enter, update, exit)).
   Steps: 0 intro (key on) · 1 try it (auto "add") · 2 key off (auto "remove B")
          3 relational algebra (auto A..F → A,C,D,F,G,H)                      */
(function () {
  Deck.css("joinviz", `
    .jv { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; gap: 1.4rem; height: 100%; }
    .jv-main { display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; }
    .jv-svg { flex: 1 1 auto; min-height: 0; width: 100%; background: var(--surface); border: 1px solid var(--rule); border-radius: 0.55rem; }
    .jv-side { display: flex; flex-direction: column; gap: 0.8rem; min-height: 0; }
    .jv-counts { display: flex; gap: 0.9rem; font: 600 0.7rem var(--font-mono); }
    .jv-counts span { display: inline-flex; align-items: center; gap: 0.35em; }
    .jv-counts i { width: 0.7em; height: 0.7em; border-radius: 50%; display: inline-block; }
    .jv-code { margin: 0; background: var(--code-bg); color: var(--code-ink); border-radius: 0.5rem; padding: 0.7rem 0.85rem; font: 0.58rem/1.55 var(--font-mono); white-space: pre; }
    .jv-code .k { color: var(--tok-d3); background: rgba(255, 211, 107, 0.14); border-radius: 0.2em; padding: 0 0.15em; }
    .jv-code .c { color: var(--tok-com); font-style: italic; }
    .jv-code .e { color: #5fd3a5; } .jv-code .u { color: #b5b3aa; } .jv-code .x { color: #ff8a88; }
    .jv-caption { font-size: 0.68rem; color: var(--ink-2); line-height: 1.45; }
    .jv-caption b { color: var(--ink); }
    .jv-algebra { display: none; flex-direction: column; gap: 0.45rem; border-top: 1px solid var(--rule); padding-top: 0.7rem; }
    .jv-algebra.show { display: flex; }
    .jv-algebra div { font: 0.62rem/1.35 var(--font-mono); }
    .jv-algebra div b { font: 600 0.8rem var(--font-serif); font-style: italic; margin-right: 0.3em; }
    .jv-algebra div small { display: block; font: 0.55rem var(--font-sans); color: var(--muted); }
    .jv-algebra .set { font-weight: 600; }
    .jv svg text { font-family: var(--font-sans); }
    .jv .rowlabel { font-size: 0.55rem; fill: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
    .jv .rowlabel tspan.sym { font: italic 600 0.9rem var(--font-serif); fill: var(--ink-2); text-transform: none; letter-spacing: 0; }
    .jv .chip rect { fill: var(--surface-2); stroke: var(--rule); stroke-width: 2; }
    .jv .chip text { font: 600 0.85rem var(--font-mono); fill: var(--ink); text-anchor: middle; dominant-baseline: central; }
    .jv .chip .idx { font: 0.5rem var(--font-mono); fill: var(--muted); }
    .jv .chip.s-enter rect { stroke: var(--enter); }
    .jv .chip.s-update rect { stroke: var(--update); }
    .jv .node circle { fill: var(--surface); stroke: var(--update); stroke-width: 3; }
    .jv .node .lbl { font: 600 0.85rem var(--font-mono); fill: var(--ink); text-anchor: middle; dominant-baseline: central; }
    .jv .node .tag { font: 600 0.52rem var(--font-sans); text-anchor: middle; letter-spacing: 0.06em; text-transform: uppercase; fill: var(--muted); }
    .jv .node .nid { font: 0.48rem var(--font-mono); text-anchor: middle; fill: var(--muted); }
    .jv .node.s-enter circle { stroke: var(--enter); fill: color-mix(in srgb, var(--enter) 16%, var(--surface)); }
    .jv .node.s-enter .tag { fill: var(--enter); }
    .jv .node.s-update circle { stroke: var(--update); }
    .jv .node.s-update .tag { fill: var(--update); }
    .jv .node.s-exit circle { stroke: var(--exit); fill: color-mix(in srgb, var(--exit) 16%, var(--surface)); }
    .jv .node.s-exit .tag { fill: var(--exit); }
    .jv .node.s-bound .tag { fill: transparent; }
    .jv .link { stroke: var(--muted); stroke-opacity: 0.45; stroke-width: 1.5; stroke-dasharray: 3 3; fill: none; }
      .jv *, .jv *::before { font-variant-ligatures: none !important; font-feature-settings: "liga" 0, "calt" 0 !important; }
  `);

  const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const MAX = 11;

  Deck.widget("joinviz", {
    steps: 3,
    mount(el) {
      el.innerHTML = `
        <div class="jv">
          <div class="jv-main">
            <div class="controls">
              <button class="btn" data-a="add">+ add</button>
              <button class="btn" data-a="remove">− remove random</button>
              <button class="btn" data-a="shuffle">shuffle</button>
              <button class="btn" data-a="random">new random data</button>
              <span style="flex:1"></span>
              <button class="btn" data-a="key" aria-pressed="true">key function: <code style="background:none;color:inherit">d =&gt; d</code></button>
            </div>
            <svg class="jv-svg"></svg>
          </div>
          <div class="jv-side">
            <div class="jv-counts"></div>
            <pre class="jv-code"></pre>
            <div class="jv-caption"></div>
            <div class="jv-algebra"></div>
          </div>
        </div>`;
      const svg = d3.select(el).select(".jv-svg");
      const gLinks = svg.append("g");
      const gChips = svg.append("g");
      const gNodes = svg.append("g");
      const gLabels = svg.append("g");
      const countsEl = el.querySelector(".jv-counts");
      const codeEl = el.querySelector(".jv-code");
      const capEl = el.querySelector(".jv-caption");
      const algEl = el.querySelector(".jv-algebra");
      const keyBtn = el.querySelector('[data-a="key"]');

      let W = 800, H = 400, rem = 16;
      let data = ["A", "B", "C", "D", "E"];
      let keyOn = true;
      let nextId = 0;
      let last = null; // last join sets
      let timers = [];
      let curStep = 0;
      const later = (f, t) => timers.push(setTimeout(f, t));

      function measure() {
        rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const r = svg.node().getBoundingClientRect();
        if (r.width > 10) { W = r.width; H = r.height; }
        svg.attr("viewBox", `0 0 ${W} ${H}`);
      }
      const chipY = () => H * 0.26;
      const nodeY = () => H * 0.66;
      function xAt(i, n) {
        const left = 7 * rem, right = 1.5 * rem;
        const s = Math.min(4.6 * rem, (W - left - right) / Math.max(1, n));
        const x0 = left + (W - left - right) / 2 - (s * (n - 1)) / 2;
        return x0 + i * s;
      }

      function drawLabels() {
        const lab = gLabels.selectAll("text").data([
          { y: chipY(), sym: "D", t: "data array" },
          { y: nodeY(), sym: "N", t: "DOM nodes" },
        ]).join("text").attr("class", "rowlabel").attr("x", 1.2 * rem).attr("y", (d) => d.y).attr("dominant-baseline", "central");
        lab.selectAll("tspan").data((d) => [d]).join((e) => {
          const t = e.append("tspan").attr("class", "sym").text((d) => d.sym);
          e.append("tspan").attr("dx", 6).text((d) => d.t);
          return t;
        });
      }

      // ---------------------------------------------------------- the join
      function render(opts = {}) {
        const dur = opts.instant ? 0 : 750;
        const n = data.length;
        const t = svg.transition("jv").duration(dur).ease(d3.easeCubicInOut);
        const cs = 2.5 * rem, r = 1.3 * rem;

        // 1) THE REAL JOIN (this is what the code panel shows)
        let enterVals = [], updateVals = [], exitVals = [];
        const nodes = gNodes.selectAll("g.node:not(.leaving)")
          .data(data, keyOn ? (d) => d : undefined)
          .join(
            (enter) => {
              enterVals = enter.data();
              const g = enter.append("g").attr("class", "node s-enter")
                .each(function () { this.__nid = ++nextId; })
                .attr("transform", (d, i) => `translate(${xAt(i, n)},${chipY()})`)
                .attr("opacity", 0);
              g.append("circle").attr("r", r);
              g.append("text").attr("class", "lbl").text((d) => d);
              g.append("text").attr("class", "tag").attr("y", r + 0.95 * rem).text("enter");
              g.append("text").attr("class", "nid").attr("y", r + 1.75 * rem).text(function () { return "node #" + this.parentNode.__nid; });
              return g;
            },
            (update) => {
              updateVals = update.data();
              update.attr("class", "node s-update").select(".tag").text("update");
              // with an index join the datum can change under a node: relabel + pulse
              update.each(function (d) {
                const lbl = d3.select(this).select(".lbl");
                if (lbl.text() !== d) {
                  lbl.text(d);
                  d3.select(this).select("circle").attr("stroke-width", 7).transition(t).attr("stroke-width", 3);
                }
              });
              return update;
            },
            (exit) => {
              exitVals = exit.data();
              exit.classed("leaving", true).attr("class", "node s-exit leaving").select(".tag").text("exit");
              exit.transition(t).delay(dur * 0.35).duration(dur * 1.2)
                .attr("transform", function () {
                  const m = /translate\(([^,]+),([^)]+)\)/.exec(this.getAttribute("transform"));
                  return `translate(${m ? m[1] : 0},${nodeY() + 3.2 * rem})`;
                })
                .attr("opacity", 0).remove();
              return exit;
            }
          );
        if (dur === 0) gNodes.selectAll("g.leaving").remove();

        nodes.transition(t).attr("opacity", 1).attr("transform", (d, i) => `translate(${xAt(i, n)},${nodeY()})`);

        // 2) chips: the data array itself, always keyed by value (it's the array, not the DOM)
        const state = new Map();
        enterVals.forEach((v) => state.set(v, "s-enter"));
        updateVals.forEach((v) => state.set(v, "s-update"));
        gChips.selectAll("g.chip").data(data, (d) => d).join(
          (enter) => {
            const g = enter.append("g").attr("class", "chip").attr("opacity", 0)
              .attr("transform", (d, i) => `translate(${xAt(i, n)},${chipY() - 1.5 * rem})`);
            g.append("rect").attr("x", -cs / 2).attr("y", -cs / 2).attr("width", cs).attr("height", cs).attr("rx", 0.35 * rem);
            g.append("text").text((d) => d);
            g.append("text").attr("class", "idx").attr("y", -cs / 2 - 0.45 * rem);
            return g;
          },
          (update) => update,
          (exit) => exit.transition(t).attr("opacity", 0).remove()
        )
          .attr("class", (d) => "chip " + (opts.neutral ? "" : state.get(d) || ""))
          .call((g) => g.select(".idx").text((d, i) => `[${i}]`))
          .transition(t).attr("opacity", 1).attr("transform", (d, i) => `translate(${xAt(i, n)},${chipY()})`);

        // 3) links: datum i ↔ the node now bound to it
        const linkData = nodes.nodes().map((node, i) => ({ id: node.__nid, i, value: data[i] }));
        gLinks.selectAll("line").data(linkData, (d) => d.id).join(
          (enter) => enter.append("line").attr("class", "link")
            .attr("x1", (d) => xAt(d.i, n)).attr("x2", (d) => xAt(d.i, n))
            .attr("y1", chipY() + cs / 2).attr("y2", chipY() + cs / 2).attr("opacity", 0),
          (update) => update,
          (exit) => exit.remove()
        ).transition(t)
          .attr("opacity", 1)
          .attr("x1", (d) => xAt(d.i, n)).attr("y1", chipY() + cs / 2 + 2)
          .attr("x2", (d) => xAt(d.i, n)).attr("y2", nodeY() - r - 2);

        if (opts.neutral) {
          nodes.attr("class", "node s-bound").select(".tag").text("");
          last = null;
        } else {
          last = { enter: enterVals, update: updateVals, exit: exitVals };
        }
        renderSide();
      }

      // ------------------------------------------------------------ side panel
      const setStr = (a) => `{ ${a.length ? a.join(", ") : "∅"} }`;
      function renderSide() {
        if (curStep === 1 || curStep === 2) capEl.innerHTML = CAPTIONS[keyOn ? 1 : 2];
        const c = last || { enter: [], update: [], exit: [] };
        countsEl.innerHTML = last
          ? `<span style="color:var(--enter)"><i style="background:var(--enter)"></i>enter ${c.enter.length}</span>
             <span style="color:var(--update)"><i style="background:var(--update)"></i>update ${c.update.length}</span>
             <span style="color:var(--exit)"><i style="background:var(--exit)"></i>exit ${c.exit.length}</span>`
          : `<span class="muted" style="font-weight:400">press a button to run the join</span>`;
        codeEl.innerHTML =
`svg.selectAll("g.node")
  ${keyOn ? `<span class="k">.data(data, d =&gt; d)</span>` : `<span class="k">.data(data)</span> <span class="c">// by index!</span>`}
  .join(
    <span class="e">enter</span>  =&gt; enter.append("g"),
    <span class="u">update</span> =&gt; update,
    <span class="x">exit</span>   =&gt; exit.remove()
  );`;
        algEl.innerHTML = `
          <div><b>enter</b> = D ▷ N = <span class="set" style="color:var(--enter)">${setStr(c.enter)}</span><small>data with no matching node: create it</small></div>
          <div><b>update</b> = D ⋈ N = <span class="set" style="color:var(--update)">${setStr(c.update)}</span><small>data that found its node: modify it</small></div>
          <div><b>exit</b> = N ▷ D = <span class="set" style="color:var(--exit)">${setStr(c.exit)}</span><small>nodes whose datum is gone: remove them</small></div>
          <div class="muted" style="font:0.52rem var(--font-sans)">${keyOn ? "matched by key: <code>d => d</code>" : "matched by <b>index</b>: keys are 0, 1, 2…"} · Bostock, Ogievetsky &amp; Heer 2011</div>`;
        keyBtn.setAttribute("aria-pressed", keyOn);
      }

      const CAPTIONS = [
        `Top: the data array <b>D</b>. Bottom: real DOM nodes <b>N</b>, each with one datum attached. Every button runs the same join.`,
        `Try it: <b>add</b> inserts a new letter at a random position, <b>remove</b> drops one, <b>shuffle</b> reorders. With a key, each node keeps its datum and follows it: <b>object constancy</b>.`,
        `<b>Key off:</b> D3 matches by index. Remove a value and the <b>last</b> node exits while the others get new labels. Shuffle and no node moves; only the labels change.`,
        `The paper's relational algebra. <b>▷</b> is an anti-join ("in the left, not in the right"), <b>⋈</b> a join. The sets shown are from the last update.`,
      ];

      // ---------------------------------------------------------------- actions
      function act(a) {
        if (a === "add") {
          if (data.length >= MAX) return Deck.toast("That's enough letters");
          const free = POOL.filter((l) => !data.includes(l));
          const v = free[Math.floor(Math.random() * Math.min(free.length, 6))];
          const at = Math.floor(Math.random() * (data.length + 1));
          data = [...data.slice(0, at), v, ...data.slice(at)];
        } else if (a === "remove") {
          if (data.length <= 1) return;
          const at = Math.floor(Math.random() * data.length);
          data = data.filter((_, i) => i !== at);
        } else if (a === "shuffle") {
          let s; do { s = d3.shuffle(data.slice()); } while (data.length > 1 && s.join() === data.join());
          data = s;
        } else if (a === "random") {
          data = d3.shuffle(POOL.slice(0, 10)).slice(0, 3 + Math.floor(Math.random() * 6));
        } else if (a === "key") {
          keyOn = !keyOn; renderSide(); return;
        }
        render();
      }
      el.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => act(b.dataset.a)));

      function reset(values, key) {
        keyOn = key;
        data = values.slice();
        gNodes.selectAll("*").remove(); gChips.selectAll("*").remove(); gLinks.selectAll("*").remove();
        render({ instant: true, neutral: true });
      }

      measure(); drawLabels(); reset(data, true);

      return {
        step(n, info) {
          timers.forEach(clearTimeout); timers = [];
          curStep = n;
          capEl.innerHTML = CAPTIONS[n];
          algEl.classList.toggle("show", n >= 3);
          const fwd = info && info.dir > 0;
          if (n === 0) { if (info && info.changedSlide) reset(["A", "B", "C", "D", "E"], true); else { keyOn = true; renderSide(); } }
          if (n === 1) { keyOn = true; renderSide(); if (fwd) later(() => act("add"), 650); }
          if (n === 2) {
            if (fwd || (info && info.changedSlide)) { reset(["A", "B", "C", "D", "E", "F"], false); later(() => { data = data.filter((d) => d !== "B"); render(); }, 800); }
            else { keyOn = false; renderSide(); }
          }
          if (n === 3) {
            if (fwd || (info && info.changedSlide)) { reset(["A", "B", "C", "D", "E", "F"], true); later(() => { data = ["A", "C", "D", "F", "G", "H"]; render(); }, 800); }
            else { keyOn = true; renderSide(); }
          }
        },
        leave() { timers.forEach(clearTimeout); timers = []; },
        resize() { measure(); drawLabels(); render({ instant: true, neutral: !last }); },
      };
    },
  });
})();
