/* sortbars: transitions & object constancy.
   Population by county (2011 census). Sort A→Z / by population, with or without a key.
   Steps: 0 no key (auto sort) · 1 key = county (auto sort) · 2 easing / duration / stagger */
(function () {
  Deck.css("sortbars", `
    .sb { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; gap: 1.4rem; height: 100%; }
    .sb-main { display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; }
    .sb-svg { flex: 1 1 auto; min-height: 0; width: 100%; }
    .sb-side { display: flex; flex-direction: column; gap: 0.8rem; min-height: 0; }
    .sb-code { margin: 0; background: var(--code-bg); color: var(--code-ink); border-radius: 0.5rem; padding: 0.7rem 0.85rem; font: 0.56rem/1.55 var(--font-mono); white-space: pre; overflow: hidden; }
    .sb-code .k { color: var(--tok-d3); background: rgba(255, 211, 107, 0.14); border-radius: 0.2em; padding: 0 0.15em; }
    .sb-code .c { color: var(--tok-com); font-style: italic; } .sb-code .d3 { color: var(--tok-d3); font-weight: 600; }
    .sb-caption { font-size: 0.68rem; color: var(--ink-2); line-height: 1.45; }
    .sb-caption b { color: var(--ink); }
    .sb-timing { display: none; flex-direction: column; gap: 0.5rem; font-size: 0.62rem; border-top: 1px solid var(--rule); padding-top: 0.7rem; }
    .sb-timing.show { display: flex; }
    .sb-timing label { display: flex; align-items: center; gap: 0.5rem; }
    .sb-timing select { font-size: 0.6rem; padding: 0.15rem 0.3rem; background: var(--surface); color: var(--ink); border: 1px solid var(--rule); border-radius: 0.3rem; }
    .sb-timing input[type=range] { flex: 1; }
    .sb .row rect { fill: color-mix(in srgb, var(--accent-2) 62%, var(--bg)); }
    .sb .row.hl rect { fill: var(--accent); fill-opacity: 1; }
    .sb .row text { font: 0.55rem var(--font-sans); fill: var(--ink-2); dominant-baseline: central; }
    .sb .row.hl text { fill: var(--ink); font-weight: 700; }
    .sb .row .val { font-family: var(--font-mono); font-size: 0.5rem; fill: var(--muted); }
    .sb .axis text { font-size: 0.5rem; fill: var(--muted); }
    .sb .axis line { stroke: var(--rule); } .sb .axis .domain { display: none; }
      .sb *, .sb *::before { font-variant-ligatures: none !important; font-feature-settings: "liga" 0, "calt" 0 !important; }
  `);

  const HL = "Grad Zagreb";
  const EASES = ["easeCubicInOut", "easeLinear", "easeBounceOut", "easeElasticOut", "easeBackInOut"];
  const CAPTIONS = [
    `<b>No key:</b> D3 matches bars by index. After a sort, row 1 is still row 1; it just gets new data. Bars morph, labels jump, and the eye loses <b style="color:var(--accent)">Grad Zagreb</b>.`,
    `<b>Key = county:</b> each bar keeps its county and travels to its new place. That's <b>object constancy</b>; Heer &amp; Robertson (2007) showed it helps people follow the change.`,
    `Timing is a design decision too: easing, duration, stagger. Use them sparingly; <code>easeBounceOut</code> is fun exactly once.`,
  ];

  Deck.widget("sortbars", {
    steps: 2,
    mount(el) {
      el.innerHTML = `
        <div class="sb">
          <div class="sb-main">
            <div class="controls">
              <button class="btn" data-o="alpha">sort A→Z</button>
              <button class="btn" data-o="pop">sort by population</button>
              <span style="flex:1"></span>
              <button class="btn" data-a="key" aria-pressed="false">key: <code style="background:none;color:inherit">d =&gt; d.county</code></button>
            </div>
            <svg class="sb-svg"></svg>
          </div>
          <div class="sb-side">
            <pre class="sb-code"></pre>
            <div class="sb-caption"></div>
            <div class="sb-timing">
              <label>ease <select>${EASES.map((e) => `<option>${e}</option>`).join("")}</select></label>
              <label>duration <input type="range" min="250" max="3000" step="50" value="900"><span class="dur">900 ms</span></label>
              <label><input type="checkbox" class="stagger"> stagger <code>.delay((d, i) =&gt; i * 30)</code></label>
            </div>
            <p class="src">Population by county, 2011 census (repo CSV), grouped by GADM county boundaries.</p>
          </div>
        </div>`;
      const svg = d3.select(el).select(".sb-svg");
      const gAxis = svg.append("g").attr("class", "axis");
      const g = svg.append("g");
      const codeEl = el.querySelector(".sb-code");
      const capEl = el.querySelector(".sb-caption");
      const timing = el.querySelector(".sb-timing");
      const sel = timing.querySelector("select");
      const durIn = timing.querySelector('input[type=range]');
      const stagIn = timing.querySelector(".stagger");

      let W = 800, H = 500, rem = 16;
      let order = "alpha", keyOn = false, ease = "easeCubicInOut", dur = 900, stagger = false;
      let timers = [];
      const later = (f, t) => timers.push(setTimeout(f, t));
      const fmt = d3.format(",");
      const data = (window.COUNTIES || []).slice();

      function measure() {
        rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const r = svg.node().getBoundingClientRect();
        if (r.width > 10) { W = r.width; H = r.height; }
        svg.attr("viewBox", `0 0 ${W} ${H}`);
      }
      const left = () => 10.5 * rem, right = () => 4.2 * rem, top = () => 1.4 * rem;
      const x = () => d3.scaleLinear([0, d3.max(data, (d) => d.population)], [left(), W - right()]);
      const y = () => d3.scaleBand(d3.range(data.length), [top(), H]).paddingInner(0.18);

      function sorted() {
        return order === "alpha" ? d3.sort(data, (d) => d.county) : d3.sort(data, (a, b) => b.population - a.population);
      }

      function render(animate = true) {
        const X = x(), Y = y(), rows = sorted();
        const t = svg.transition("sort").duration(animate ? dur : 0).ease(d3[ease]);
        const delay = (d, i) => (stagger && animate ? i * 30 : 0);

        gAxis.attr("transform", `translate(0,${top() - 0.3 * rem})`)
          .call(d3.axisTop(X).ticks(5).tickFormat(d3.format("~s")).tickSize(-(H - top())))
          .call((a) => a.selectAll(".tick line").attr("stroke-opacity", 0.6));

        const bars = g.selectAll("g.row")
          .data(rows, keyOn ? (d) => d.county : undefined)
          .join((enter) => {
            const r = enter.append("g").attr("class", "row").attr("transform", (d, i) => `translate(0,${Y(i)})`);
            r.append("text").attr("class", "name").attr("x", left() - 0.5 * rem).attr("text-anchor", "end");
            r.append("rect").attr("x", left()).attr("rx", 2).attr("width", 0);
            r.append("text").attr("class", "val");
            return r;
          });

        // labels and highlight follow the datum instantly (that's the "jump" without a key)
        bars.classed("hl", (d) => d.county === HL);
        bars.select(".name").text((d) => d.county).attr("y", Y.bandwidth() / 2);
        bars.select(".val").text((d) => fmt(d.population)).attr("y", Y.bandwidth() / 2);
        bars.select("rect").attr("height", Y.bandwidth());

        bars.transition(t).delay(delay).attr("transform", (d, i) => `translate(0,${Y(i)})`);
        bars.select("rect").transition(t).delay(delay).attr("width", (d) => X(d.population) - left());
        bars.select(".val").transition(t).delay(delay).attr("x", (d) => X(d.population) + 0.4 * rem);

        renderSide();
      }

      function renderSide() {
        codeEl.innerHTML =
`bars.selectAll("g.row")
  ${keyOn ? `<span class="k">.data(counties, d =&gt; d.county)</span>` : `<span class="k">.data(counties)</span> <span class="c">// by index!</span>`}
  .join("g")
  .transition()
    .duration(${dur})
    .ease(<span class="d3">d3</span>.${ease})${stagger ? `\n    .delay((d, i) =&gt; i * 30)` : ""}
    .attr("transform", (d, i) =&gt;
      \`translate(0, \${y(i)})\`);`;
        el.querySelectorAll("[data-o]").forEach((b) => b.classList.toggle("on", b.dataset.o === order));
        el.querySelector('[data-a="key"]').setAttribute("aria-pressed", keyOn);
      }

      el.querySelectorAll("[data-o]").forEach((b) => (b.onclick = () => { order = b.dataset.o; render(); }));
      el.querySelector('[data-a="key"]').onclick = () => { keyOn = !keyOn; renderSide(); };
      sel.onchange = () => { ease = sel.value; renderSide(); };
      durIn.oninput = () => { dur = +durIn.value; timing.querySelector(".dur").textContent = dur + " ms"; renderSide(); };
      stagIn.onchange = () => { stagger = stagIn.checked; renderSide(); };

      measure(); render(false);

      return {
        step(n, info) {
          timers.forEach(clearTimeout); timers = [];
          capEl.innerHTML = CAPTIONS[n];
          timing.classList.toggle("show", n >= 2);
          const fresh = info && (info.dir > 0 || info.changedSlide);
          if (n === 0) {
            keyOn = false;
            if (info && info.changedSlide) { order = "alpha"; g.selectAll("*").remove(); render(false); later(() => { order = "pop"; render(); }, 900); }
            else renderSide();
          }
          if (n === 1) { keyOn = true; renderSide(); if (fresh) later(() => { order = order === "pop" ? "alpha" : "pop"; render(); }, 600); }
          if (n === 2) { keyOn = true; renderSide(); }
        },
        leave() { timers.forEach(clearTimeout); timers = []; },
        resize() { measure(); render(false); },
      };
    },
  });
})();
