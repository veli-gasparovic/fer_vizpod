/* ==========================================================================
   mantra: Shneiderman's "overview first, zoom and filter, then details-on-
   demand" as working code. Focus (bars + line) + context (stripes + brushX),
   d3.zoom on the focus kept in sync with the brush.
   Steps: 0 overview · 1 brush → 1970–2025 · 2 details at 2024 · 3 code.
   ========================================================================== */
(function () {
  "use strict";

  Deck.css("mantra", `
    .mt { position: relative; display: flex; flex-direction: column; gap: 0.5rem; height: 100%; min-height: 0; }
    .mt-focus { position: relative; flex: 1 1 auto; min-height: 0; }
    .mt-context { position: relative; flex: 0 0 calc(var(--u) * 6.2); }
    .mt svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .mt-label { font: 600 0.5rem var(--font-sans); letter-spacing: 0.1em; text-transform: uppercase; fill: var(--muted); }
    .mt .bar { shape-rendering: crispEdges; }
    .mt .line { fill: none; stroke: var(--ink); stroke-width: 1.75; stroke-linejoin: round; }
    .mt .zero { stroke: var(--ink-2); stroke-width: 1; }
    .mt .cross { stroke: var(--ink); stroke-width: 1; stroke-dasharray: 3 3; pointer-events: none; }
    .mt .cross-dot { fill: var(--ink); stroke: var(--surface); stroke-width: 2; pointer-events: none; }
    .mt .ctx rect { shape-rendering: crispEdges; }
    .mt .brush .selection { fill: var(--ink); fill-opacity: 0.08; stroke: var(--ink); stroke-width: 1.5; }
    .mt .brush .handle { fill: var(--ink); rx: 2; }
    .mt .brush.hidden { display: none; }
    .mt .shade { fill: var(--bg); opacity: 0.62; pointer-events: none; }
    .mt-focus svg { cursor: grab; }
    .mt-code { position: absolute; left: calc(var(--u) * 5.2); top: 0.4rem; z-index: 5; max-width: 52%;
      opacity: 0; transform: translateY(0.4rem); transition: opacity 0.4s, transform 0.4s; pointer-events: none; }
    .mt-code.show { opacity: 1; transform: none; pointer-events: auto; }
    .mt-code pre { margin: 0; background: var(--code-bg); color: var(--code-ink); border-radius: 0.5rem; padding: 0.7rem 0.9rem;
      font: 0.56rem/1.55 var(--font-mono); box-shadow: 0 8px 28px rgba(0,0,0,0.25); white-space: pre; }
    .mt-code .cap { font-size: 0.6rem; color: var(--ink-2); margin-top: 0.35rem; background: color-mix(in srgb, var(--bg) 85%, transparent); padding: 0.2rem 0.4rem; border-radius: 0.3rem; display: inline-block; }
  `);

  const CODE = `<span class="tk-kw">const</span> brush = d3.<span class="tk-fn">brushX</span>()
  .<span class="tk-fn">extent</span>([[<span class="tk-num">0</span>, <span class="tk-num">0</span>], [width, <span class="tk-num">40</span>]])
  .<span class="tk-fn">on</span>(<span class="tk-str">"brush end"</span>, brushed);
context.<span class="tk-fn">append</span>(<span class="tk-str">"g"</span>).<span class="tk-fn">call</span>(brush);     <span class="tk-com">// a behaviour</span>

<span class="tk-kw">const</span> zoom = d3.<span class="tk-fn">zoom</span>()
  .<span class="tk-fn">scaleExtent</span>([<span class="tk-num">1</span>, <span class="tk-num">30</span>])
  .<span class="tk-fn">on</span>(<span class="tk-str">"zoom"</span>, zoomed);
focus.<span class="tk-fn">call</span>(zoom);                    <span class="tk-com">// another one</span>

<span class="tk-kw">function</span> <span class="tk-fn">brushed</span>({ selection }) {
  x.<span class="tk-fn">domain</span>(selection.<span class="tk-fn">map</span>(x2.invert));  <span class="tk-com">// pixels → years</span>
  <span class="tk-fn">redraw</span>();
}`;

  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

  Deck.widget("mantra", {
    steps: 3,
    mount(el) {
      const data = CLIMATE.global.values;
      const rank = new Map(data.slice().sort((a, b) => b.anomaly - a.anomaly).map((d, i) => [d.year, i + 1]));
      const maxAbs = d3.max(data, (d) => Math.abs(d.anomaly));
      const color = d3.scaleDiverging([-maxAbs, 0, maxAbs], (t) => d3.interpolateRdBu(1 - t));
      const Y0 = d3.min(data, (d) => d.year) - 0.5, Y1 = d3.max(data, (d) => d.year) + 0.5;

      el.innerHTML = `
        <div class="mt">
          <div class="mt-focus"><svg>
            <defs><clipPath id="mt-clip"><rect></rect></clipPath></defs>
            <g class="focus">
              <rect class="zoom-catch" fill="transparent"></rect>
              <g class="axis y"></g><g class="axis x"></g>
              <g class="plot" clip-path="url(#mt-clip)"><g class="bars"></g><line class="zero"></line><path class="line"></path>
                <line class="cross" style="display:none"></line><circle class="cross-dot" r="5" style="display:none"></circle></g>
              <text class="mt-label flabel"></text>
            </g>
          </svg></div>
          <div class="mt-context"><svg>
            <g class="ctx"></g><rect class="shade sl"></rect><rect class="shade sr"></rect><g class="brush hidden"></g>
            <text class="mt-label clabel">overview · drag to brush a period</text>
          </svg></div>
          <div class="mt-code"><pre>${CODE}</pre><div class="cap">Behaviours are things you <code>.call()</code> on a selection: brush, zoom, drag.</div></div>
        </div>`;

      const focusBox = el.querySelector(".mt-focus"), ctxBox = el.querySelector(".mt-context");
      const fsvg = d3.select(focusBox).select("svg"), csvg = d3.select(ctxBox).select("svg");
      const focus = fsvg.select(".focus"), plot = fsvg.select(".plot");
      const brushG = csvg.select(".brush");
      const tip = Deck.tooltip(focusBox);
      const codeBox = el.querySelector(".mt-code");
      const phrases = () => { const s = el.closest(".slide"); return s ? s.querySelectorAll(".mantra-title [data-m]") : []; };

      const x = d3.scaleLinear().domain([Y0, Y1]);
      const x2 = d3.scaleLinear().domain([Y0, Y1]);
      const y = d3.scaleLinear();
      let L = 0, R = 0, FH = 0, CH = 0, B = 0, syncing = false, pinned = null, hovering = false, zoomTimer = null;

      // ---- mantra phrases
      function light(name, on) {
        phrases().forEach((p) => { if (p.dataset.m === name) p.classList.toggle("lit", on); });
      }
      function pulseZoom() { light("zoom", true); clearTimeout(zoomTimer); zoomTimer = setTimeout(() => light("zoom", !!d3.brushSelection(brushG.node())), 1800); }

      // ---- behaviours
      const brush = d3.brushX().on("brush end", brushed);
      const zoom = d3.zoom().scaleExtent([1, 30]).on("zoom", zoomed)
        .on("start", () => fsvg.style("cursor", "grabbing")).on("end", () => fsvg.style("cursor", null));

      function brushed(event) {
        updateShade(event.selection);
        if (syncing) return;
        const s = event.selection || [L, R];
        x.domain(s.map(x2.invert));
        redraw();
        syncing = true;
        const k = (R - L) / Math.max(1, s[1] - s[0]);
        focus.call(zoom.transform, d3.zoomIdentity.translate(L - k * s[0], 0).scale(k));
        syncing = false;
        if (event.sourceEvent || event.type === "brush") pulseZoom();
      }
      function zoomed(event) {
        if (syncing) return;
        const t = event.transform;
        x.domain(t.rescaleX(x2).domain());
        redraw();
        syncing = true;
        brushG.classed("hidden", false);
        brushG.call(brush.move, t.k === 1 && Math.abs(t.x) < 0.5 ? null : x.range().map(t.invertX, t));
        syncing = false;
        pulseZoom();
      }
      function updateShade(sel) {
        light("zoom", !!sel);
        csvg.select(".sl").attr("x", L).attr("y", 0).attr("height", CH).attr("width", sel ? Math.max(0, sel[0] - L) : 0);
        csvg.select(".sr").attr("x", sel ? sel[1] : R).attr("y", 0).attr("height", CH).attr("width", sel ? Math.max(0, R - sel[1]) : 0);
      }

      // ---- drawing
      function layout() {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const W = focusBox.clientWidth; FH = focusBox.clientHeight; CH = ctxBox.clientHeight - rem * 0.9;
        if (!W || !FH) return;
        L = rem * 2.6; R = W - rem * 0.4; B = FH - rem * 1.4;
        fsvg.attr("viewBox", `0 0 ${W} ${FH}`);
        csvg.attr("viewBox", `0 0 ${W} ${ctxBox.clientHeight}`);
        x.range([L, R]); x2.range([L, R]);
        y.domain(d3.extent(data, (d) => d.anomaly)).nice().range([B, rem * 0.8]);

        fsvg.select("#mt-clip rect").attr("x", L).attr("y", 0).attr("width", R - L).attr("height", B);
        fsvg.select(".zoom-catch").attr("x", L).attr("y", 0).attr("width", R - L).attr("height", B);
        fsvg.select(".flabel").attr("x", R).attr("y", rem * 0.5).attr("text-anchor", "end").text("focus · scroll to zoom, drag to pan");

        // context = warming stripes
        csvg.select(".ctx").attr("transform", `translate(0,0)`).selectAll("rect").data(data, (d) => d.year).join("rect")
          .attr("x", (d) => x2(d.year - 0.5)).attr("width", (d) => x2(d.year + 0.5) - x2(d.year - 0.5) + 0.5)
          .attr("y", 0).attr("height", CH).attr("fill", (d) => color(d.anomaly));
        csvg.select(".clabel").attr("x", L).attr("y", CH + rem * 0.75);
        brush.extent([[L, 0], [R, CH]]);
        brushG.call(brush);
        zoom.extent([[L, 0], [R, B]]).translateExtent([[L, 0], [R, B]]);
        focus.call(zoom).on("dblclick.zoom", null);

        // keep the current selection when re-laying out
        const sel = d3.brushSelection(brushG.node());
        redraw();
        updateShade(sel);
      }

      function redraw() {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const visible = data.filter((d) => d.year >= x.domain()[0] - 1 && d.year <= x.domain()[1] + 1);
        const bw = x(1) - x(0);
        const gap = bw > 6 ? 1.5 : 0;
        plot.select(".bars").selectAll("rect.bar").data(visible, (d) => d.year).join("rect").attr("class", "bar")
          .attr("x", (d) => x(d.year - 0.5) + gap / 2).attr("width", Math.max(0.5, bw - gap + (gap ? 0 : 0.5)))
          .attr("y", (d) => y(Math.max(0, d.anomaly))).attr("height", (d) => Math.abs(y(d.anomaly) - y(0)))
          .attr("fill", (d) => color(d.anomaly));
        plot.select(".zero").attr("x1", L).attr("x2", R).attr("y1", y(0)).attr("y2", y(0));
        plot.select(".line").datum(data).attr("d", d3.line().x((d) => x(d.year)).y((d) => y(d.anomaly)));
        focus.select(".axis.x").attr("transform", `translate(0,${B})`)
          .call(d3.axisBottom(x).ticks(Math.max(3, Math.round((R - L) / (rem * 5)))).tickFormat(d3.format("d")).tickSizeOuter(0));
        focus.select(".axis.y").attr("transform", `translate(${L},0)`)
          .call(d3.axisLeft(y).ticks(6).tickFormat((v) => `${v > 0 ? "+" : ""}${d3.format(".1f")(v)}°`).tickSizeOuter(0));
        if (pinned != null) showDetails(pinned);
      }

      // ---- details on demand
      function showDetails(year, event) {
        const d = data.find((v) => v.year === year);
        if (!d || x(year) < L || x(year) > R) { hideDetails(); return; }
        const cx = x(year), cy = y(d.anomaly);
        plot.select(".cross").style("display", null).attr("x1", cx).attr("x2", cx).attr("y1", 0).attr("y2", B);
        plot.select(".cross-dot").style("display", null).attr("cx", cx).attr("cy", cy);
        const r = rank.get(year);
        const html = `<b>${year}</b> · ${d3.format("+.2f")(d.anomaly)} °C<br>${r === 1 ? "the warmest year on record" : ordinal(r) + " warmest"} of ${data.length}`;
        if (event) tip.show(html, event);
        else {
          const bb = fsvg.node().getBoundingClientRect(), vb = fsvg.node().viewBox.baseVal;
          const sx = bb.width / vb.width, sy = bb.height / vb.height;
          tip.show(html, [cx * sx, cy * sy]);
        }
        light("details", true);
      }
      function hideDetails() {
        plot.select(".cross").style("display", "none"); plot.select(".cross-dot").style("display", "none");
        tip.hide(); light("details", false);
      }
      focus.on("pointermove", (event) => {
        const [mx, my] = d3.pointer(event, fsvg.node());
        if (mx < L || mx > R || my > B) { if (!pinned) hideDetails(); return; }
        hovering = true; pinned = null;
        showDetails(Math.round(x.invert(mx)), event);
      }).on("pointerleave", () => { hovering = false; if (pinned == null) hideDetails(); });

      layout();
      light("overview", true);

      return {
        step(n) {
          light("overview", true);
          codeBox.classList.toggle("show", n >= 3);
          if (n === 0) {
            pinned = null; hideDetails();
            brushG.interrupt().classed("hidden", true).call(brush.move, null);
            light("zoom", false);
          } else if (n >= 1) {
            brushG.classed("hidden", false);
            const target = [x2(1970), x2(Y1)];
            const cur = d3.brushSelection(brushG.node());
            const same = cur && Math.abs(cur[0] - target[0]) < 1 && Math.abs(cur[1] - target[1]) < 1;
            if (!same) brushG.transition().duration(n === 1 ? 1400 : 0).ease(d3.easeCubicInOut).call(brush.move, target)
              .on("end", () => { if (n >= 2) { pinned = 2024; showDetails(2024); } });
            if (n >= 2) { pinned = 2024; if (same) showDetails(2024); }
            else { pinned = null; hideDetails(); }
          }
        },
        resize: layout,
        leave() { clearTimeout(zoomTimer); },
      };
    },
  });
})();
