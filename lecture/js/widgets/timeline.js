/* Timeline 1995–2026: ideas, standards, browsers, toolkits, D3, plugins.
   step 0: lanes + faint dots · 1 standards on paper · 2 plugin era · 3 browsers catch up
   step 4: the fall of Flash · 5: D3 */
(function () {
  Deck.css("timeline", `
    .tl { position: relative; height: 100%; display: flex; flex-direction: column; gap: 0.3rem; }
    .tl-cap { display: flex; align-items: baseline; gap: 0.8rem; min-height: 1.4rem; }
    .tl-cap b { font: 600 0.85rem var(--font-serif); color: var(--ink); }
    .tl-cap span { font-size: 0.62rem; color: var(--ink-2); }
    .tl-svgwrap { position: relative; flex: 1 1 auto; min-height: 0; }
    .tl svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .tl .lane-label { font: 600 0.5rem var(--font-sans); letter-spacing: 0.1em; text-transform: uppercase; fill: var(--muted); }
    .tl .lane-rule { stroke: var(--rule); stroke-width: 1; }
    .tl .grid line { stroke: var(--rule); stroke-dasharray: 2 4; }
    .tl .grid text { font: 0.52rem var(--font-mono); fill: var(--muted); }
    .tl .ev circle { stroke: var(--bg); stroke-width: 2; transition: r .3s; }
    .tl .ev text { font: 0.55rem var(--font-sans); fill: var(--ink); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round; }
    .tl .ev text tspan.yr { fill: var(--muted); font-family: var(--font-mono); font-size: 0.48rem; }
    .tl .ev line { stroke: var(--rule); }
    .tl .ev { cursor: default; }
    .tl .ev.cur text { font-weight: 600; }
    .tl .ev.d3 circle { fill: var(--accent); }
    .tl .ev:hover circle { r: 7; }
    .tl .bar-label { font: 600 0.5rem var(--font-sans); letter-spacing: 0.04em; }
    .tl .now line { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 3 3; }
    .tl .now text { font: 600 0.55rem var(--font-sans); fill: var(--accent); }
  `);

  const P = d3.timeParse("%Y-%m-%d");
  const lanes = [
    { id: "ideas", label: "Ideas" },
    { id: "std", label: "Standards" },
    { id: "browser", label: "Browsers & devices" },
    { id: "tool", label: "Toolkits" },
    { id: "d3", label: "D3" },
    { id: "plugin", label: "Plugins" },
  ];
  // g = the step that introduces the event
  const events = [
    { d: "1996-09-01", lane: "ideas", g: 1, label: "Shneiderman's mantra", date: "Sep 1996", desc: '"Overview first, zoom and filter, then details-on-demand." The Eyes Have It, IEEE VL.' },
    { d: "1999-01-01", lane: "plugin", g: 1, label: "VML · Adobe SVG Viewer", date: "~1998–2000s", desc: "Vector graphics on the web: IE-only VML, or a plugin for SVG. Fragmented." },
    { d: "2001-09-04", lane: "std", g: 1, label: "SVG 1.0", date: "4 Sep 2001", desc: "W3C Recommendation. An open vector standard exists, but browsers lag for a decade." },
    { d: "2003-01-14", lane: "std", g: 1, label: "SVG 1.1", date: "14 Jan 2003", desc: "W3C Recommendation." },
    { d: "2005-04-01", lane: "tool", g: 2, label: "prefuse (Java)", date: "Apr 2005", desc: "Heer, Card & Landay, CHI 2005. Interactive visualization, delivered as Java applets." },
    { d: "2007-10-22", lane: "tool", g: 2, label: "Flare (Flash)", date: "22 Oct 2007", desc: 'First alpha. ActionScript 3; "brings the visualization capabilities of prefuse to the web."' },
    { d: "2007-11-01", lane: "ideas", g: 2, label: "Animated transitions", date: "2007", desc: "Heer & Robertson, IEEE TVCG: animated transitions can significantly improve graphical perception." },
    { d: "2004-07-01", lane: "browser", g: 3, label: "<canvas> in WebKit", date: "~2004", desc: "Apple introduces canvas for Dashboard; later standardized in HTML5. Immediate-mode raster." },
    { d: "2005-11-29", lane: "browser", g: 3, label: "Firefox 1.5: native SVG", date: "29 Nov 2005", desc: 'Ships "native support for a subset of SVG 1.1 Full". First mainstream native SVG.' },
    { d: "2006-01-14", lane: "tool", g: 3, label: "jQuery", date: "Jan 2006", desc: 'John Resig. Popularizes "select, then operate".' },
    { d: "2006-05-01", lane: "std", g: 3, label: "Selectors API draft", date: "May 2006", desc: "First W3C Working Draft: CSS selectors from JavaScript." },
    { d: "2008-02-01", lane: "browser", g: 3, label: "querySelectorAll", date: "Feb 2008", desc: "WebKit ships querySelector / querySelectorAll natively." },
    { d: "2008-09-02", lane: "browser", g: 3, label: "Chrome + V8", date: "2 Sep 2008", desc: "Start of the JIT JavaScript performance race." },
    { d: "2009-11-01", lane: "tool", g: 3, label: "Protovis (JS + SVG)", date: "Nov 2009", desc: "InfoVis 2009. JavaScript and SVG, but with its own mark abstraction and scenegraph." },
    { d: "2011-03-14", lane: "browser", g: 3, label: "IE9: native SVG", date: "14 Mar 2011", desc: "Released at SXSW. The last major browser holdout falls." },
    { d: "2011-08-16", lane: "std", g: 3, label: "SVG 1.1 2nd ed.", date: "16 Aug 2011", desc: "W3C Recommendation, six months after D3's release." },
    { d: "2013-02-21", lane: "std", g: 3, label: "Selectors API Rec.", date: "21 Feb 2013", desc: "Standard formalized years after it shipped." },
    { d: "2010-04-29", lane: "plugin", g: 4, label: '"Thoughts on Flash"', date: "29 Apr 2010", desc: 'Steve Jobs: "The mobile era is about low power devices, touch interfaces and open web standards."' },
    { d: "2010-05-25", lane: "ideas", g: 4, label: "Responsive web design", date: "25 May 2010", desc: "Ethan Marcotte, A List Apart: fluid grids, flexible images, media queries." },
    { d: "2010-06-24", lane: "browser", g: 4, label: "iPhone 4 · Retina", date: "Jun 2010", desc: "devicePixelRatio = 2. A fixed-size PNG chart is now physically blurry." },
    { d: "2016-10-01", lane: "browser", g: 4, label: "Mobile > desktop", date: "Oct 2016", desc: "StatCounter: mobile + tablet 51.3% of web use worldwide, the first time ever." },
    { d: "2017-07-25", lane: "plugin", g: 4, label: "Flash EOL announced", date: "Jul 2017", desc: "Adobe announces the end of Flash." },
    { d: "2021-01-12", lane: "plugin", g: 4, label: "Flash blocked", date: "12 Jan 2021", desc: 'Adobe blocks Flash content: "Open standards such as HTML5, WebGL and WebAssembly… serve as viable alternatives."' },
    { d: "2011-02-17", lane: "d3", g: 5, label: "D3 v1.0.0", date: "17 Feb 2011", desc: "Tagged on GitHub. Bostock, Ogievetsky & Heer." },
    { d: "2011-10-23", lane: "d3", g: 5, label: "InfoVis paper", date: "Oct 2011", desc: '"D³: Data-Driven Documents", IEEE TVCG 17(12). "The document is the scenegraph."' },
    { d: "2011-03-10", lane: "ideas", g: 5, label: "Explorable Explanations", date: "10 Mar 2011", desc: "Bret Victor. One month after D3's release." },
    { d: "2012-11-02", lane: "ideas", g: 5, label: "512 Paths", date: "2 Nov 2012", desc: "NYT, Bostock & Shan Carter: the showcase for the data join." },
    { d: "2016-06-28", lane: "d3", g: 5, label: "v4: modular", date: "28 Jun 2016", desc: '"D3 is now many small libraries." About thirty microlibraries in the default bundle.' },
    { d: "2019-01-23", lane: "d3", g: 5, label: "selection.join", date: "Jan 2019", desc: "d3-selection 1.4.0: \"Add selection.join!\"" },
    { d: "2021-06-11", lane: "d3", g: 5, label: "v7", date: "11 Jun 2021", desc: "ES modules." },
    { d: "2024-03-12", lane: "d3", g: 5, label: "7.9.0", date: "12 Mar 2024", desc: "Still the current release. This deck runs on it." },
    { d: "2021-05-04", lane: "tool", g: 5, label: "Observable Plot", date: "4 May 2021", desc: '"Informed by ten years of maintaining D3 but does not replace it… Plot is built on D3!"' },
  ].map((e) => ({ ...e, t: P(e.d) }));

  const captions = [
    ["Thirty years of the web as a visualization platform", "hover any event for details"],
    ["1 · Standards, on paper", "SVG is a W3C Recommendation in 2001, but browsers don't follow"],
    ["2 · Interactive, inside plugins", "prefuse runs as a Java applet, Flare in Flash: closed runtimes"],
    ["3 · Browsers catch up", "native SVG, CSS selectors from JS, fast JavaScript; IE9 falls last, in March 2011"],
    ["4 · The fall of Flash", "touch, battery, Retina, responsive layouts: the plugin can't follow"],
    ["5 · D3 bets on the standards", "released February 2011, still on v7 in 2026"],
  ];

  Deck.widget("timeline", {
    steps: 5,
    mount(el) {
      el.classList.add("tl");
      el.innerHTML = `<div class="tl-cap"><b></b><span></span></div><div class="tl-svgwrap"></div>`;
      const wrap = el.querySelector(".tl-svgwrap");
      const tip = Deck.tooltip(wrap);
      let step = 0, svg, x, yLane, laneH;
      const fs = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

      function build() {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!W || !H) return;
        const f = fs();
        const m = { top: 4, right: f * 3.2, bottom: f * 1.3, left: f * 7.2 };
        d3.select(wrap).selectAll("svg").remove();
        svg = d3.select(wrap).append("svg").attr("viewBox", `0 0 ${W} ${H}`)
          .attr("role", "img").attr("aria-label", "Timeline of web visualization technology, 1995–2026");
        x = d3.scaleTime().domain([P("1995-01-01"), P("2026-12-31")]).range([m.left, W - m.right]);
        laneH = (H - m.top - m.bottom) / lanes.length;
        yLane = (id) => m.top + lanes.findIndex((l) => l.id === id) * laneH;

        // grid
        const g = svg.append("g").attr("class", "grid");
        const yrs = d3.range(1995, 2027, 5).map((y) => P(`${y}-01-01`));
        g.selectAll("line").data(yrs).join("line").attr("x1", x).attr("x2", x).attr("y1", m.top).attr("y2", H - m.bottom);
        g.selectAll("text").data(yrs).join("text").attr("x", x).attr("y", H - m.bottom + f * 0.95).attr("text-anchor", "middle").text(d3.timeFormat("%Y"));

        // lanes
        const lg = svg.append("g").selectAll("g").data(lanes).join("g").attr("transform", (d) => `translate(0,${yLane(d.id)})`);
        lg.append("line").attr("class", "lane-rule").attr("x1", 0).attr("x2", W - m.right).attr("y1", laneH).attr("y2", laneH);
        lg.append("text").attr("class", "lane-label").attr("x", 0).attr("y", laneH * 0.78).text((d) => d.label);

        // lifespan bars (bottom of lane)
        const bars = svg.append("g").attr("class", "bars");
        const defs = svg.append("defs");
        const grad = defs.append("linearGradient").attr("id", "tl-fade");
        grad.append("stop").attr("offset", "0%").attr("stop-color", "var(--muted)").attr("stop-opacity", 0.7);
        grad.append("stop").attr("offset", "100%").attr("stop-color", "var(--muted)").attr("stop-opacity", 0);
        const barY = (lane) => yLane(lane) + laneH * 0.8;
        bars.append("rect").attr("class", "bar-java").attr("x", x(P("2005-04-01"))).attr("y", barY("tool") - 3)
          .attr("height", 6).attr("rx", 3).attr("width", x(P("2012-01-01")) - x(P("2005-04-01"))).attr("fill", "url(#tl-fade)");
        bars.append("text").attr("class", "bar-label bar-java-l").attr("x", x(P("2005-04-01"))).attr("y", barY("tool") + f * 0.8)
          .attr("fill", "var(--muted)").text("Java applets: faded away");
        bars.append("rect").attr("class", "bar-flash").attr("x", x(P("2007-10-22"))).attr("y", barY("plugin") - 3)
          .attr("height", 6).attr("rx", 3).attr("width", 0).attr("fill", "var(--muted)");
        bars.append("text").attr("class", "bar-label bar-flash-l").attr("x", x(P("2007-10-22"))).attr("y", barY("plugin") + f * 0.8)
          .attr("fill", "var(--muted)").text("Flash-era dataviz");
        const fx = x(P("2021-01-12")), fy = barY("plugin"), xs = f * 0.42;
        bars.append("path").attr("class", "bar-flash-x").attr("d", `M${fx - xs},${fy - xs}L${fx + xs},${fy + xs}M${fx + xs},${fy - xs}L${fx - xs},${fy + xs}`)
          .attr("stroke", "var(--exit)").attr("stroke-width", 3).attr("stroke-linecap", "round");
        bars.append("rect").attr("class", "bar-d3").attr("x", x(P("2011-02-17"))).attr("y", barY("d3") - 3.5)
          .attr("height", 7).attr("rx", 3.5).attr("width", 0).attr("fill", "var(--accent)");
        bars.append("path").attr("class", "bar-d3-arrow").attr("d", `M${x(P("2026-12-31"))},${barY("d3") - 7} l${f * 0.6},7 l${-f * 0.6},7 z`).attr("fill", "var(--accent)");
        bars.append("text").attr("class", "bar-label bar-d3-l").attr("x", x(P("2026-12-31")) + f * 0.8).attr("y", barY("d3") + 4)
          .attr("fill", "var(--accent)").text("still v7");

        // events with a simple per-lane row-packing for labels
        const rows = 3;
        const placed = [];
        d3.groups(events, (e) => e.lane).forEach(([lane, evs]) => {
          const ends = new Array(rows).fill(-Infinity);
          evs.slice().sort((a, b) => a.t - b.t).forEach((e) => {
            const cx = x(e.t);
            const w = e.label.length * f * 0.55 * 0.56 + f * 0.6;
            let r = ends.findIndex((end) => end < cx - 2);
            if (r < 0) r = ends.indexOf(d3.min(ends));
            ends[r] = cx + w;
            placed.push({ ...e, cx, row: r, cy: yLane(lane) + laneH * 0.8, ly: yLane(lane) + laneH * (0.2 + r * 0.2) });
          });
        });
        const evg = svg.append("g").selectAll("g.ev").data(placed, (d) => d.label).join("g")
          .attr("class", (d) => `ev ${d.lane === "d3" ? "d3" : ""}`);
        evg.append("line").attr("x1", (d) => d.cx).attr("x2", (d) => d.cx).attr("y1", (d) => d.ly + 3).attr("y2", (d) => d.cy);
        evg.append("circle").attr("cx", (d) => d.cx).attr("cy", (d) => d.cy).attr("r", 4.5);
        const tx = evg.append("text").attr("x", (d) => d.cx + 3).attr("y", (d) => d.ly);
        tx.append("tspan").text((d) => d.label);
        // a generous invisible hit target
        evg.append("rect").attr("x", (d) => d.cx - 8).attr("y", (d) => d.ly - f * 0.7).attr("width", (d) => d.label.length * f * 0.32 + 16)
          .attr("height", (d) => d.cy - d.ly + f * 0.7 + 8).attr("fill", "transparent");
        evg.style("cursor", "help").on("pointerenter", function (ev, d) {
          d3.select(this).select("circle").attr("r", 7);
          tip.show(`<b>${d.date}</b> · ${d.label}<br><span style="white-space:normal;display:block;max-width:22rem;opacity:.85">${d.desc}</span>`, ev);
        }).on("pointermove", (ev) => tip.el.style.display === "block" && tip.show(tip.el.innerHTML, ev))
          .on("pointerleave", function () { d3.select(this).select("circle").attr("r", 4.5); tip.hide(); });

        // 2011 "now ready" marker for step 5
        const now = svg.append("g").attr("class", "now").attr("opacity", 0);
        now.append("line").attr("x1", x(P("2011-02-17"))).attr("x2", x(P("2011-02-17"))).attr("y1", m.top).attr("y2", H - m.bottom);
        apply(false);
      }

      function apply(animate) {
        if (!svg) return;
        const dur = animate ? 600 : 0;
        const fill = (d) => (d.lane === "d3" ? "var(--accent)" : d.g === step ? "var(--ink)" : "var(--muted)");
        svg.selectAll("g.ev").each(function (d) {
          const g = d3.select(this);
          const vis = d.g <= step;
          g.classed("cur", d.g === step);
          g.select("circle").transition().duration(dur).attr("fill", fill(d)).attr("opacity", vis ? 1 : step === 0 ? 0.35 : 0.12);
          g.select("text").transition().duration(dur).attr("opacity", vis ? (d.g === step || step === 5 && d.lane === "d3" ? 1 : 0.5) : 0);
          g.select("line").transition().duration(dur).attr("opacity", vis ? 0.9 : 0);
        });
        const T = (sel) => sel.transition().duration(animate ? 900 : 0).ease(d3.easeCubicInOut);
        T(svg.selectAll(".bar-java, .bar-java-l")).attr("opacity", step >= 2 ? 1 : 0);
        const flashEnd = step >= 4 ? P("2021-01-12") : P("2010-04-29");
        T(svg.select(".bar-flash")).attr("opacity", step >= 2 ? 1 : 0).attr("width", step >= 2 ? x(flashEnd) - x(P("2007-10-22")) : 0);
        T(svg.select(".bar-flash-l")).attr("opacity", step >= 2 ? 1 : 0);
        T(svg.select(".bar-flash-x")).attr("opacity", step >= 4 ? 1 : 0);
        T(svg.select(".bar-d3")).attr("width", step >= 5 ? x(P("2026-12-31")) - x(P("2011-02-17")) : 0);
        T(svg.selectAll(".bar-d3-arrow, .bar-d3-l")).attr("opacity", step >= 5 ? 1 : 0);
        T(svg.select(".now")).attr("opacity", step >= 5 ? 1 : 0);
        const [a, b] = captions[step];
        el.querySelector(".tl-cap b").textContent = a;
        el.querySelector(".tl-cap span").textContent = b;
      }

      build();
      Deck.onTheme(() => apply(false));
      return {
        step(n, info) { const was = step; step = n; apply(!info || !info.changedSlide || was !== n); },
        resize() { build(); },
      };
    },
  });
})();
