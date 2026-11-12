/* Timeline 1995–2026, drawn as lifespans: every plugin ends in ✕, every open standard runs on (→).
   Rows: ideas and devices (events only) · closed runtimes · open standards · D3 (built on the standards).
   step 0: the whole picture, no labels · 1 standards on paper · 2 plugin era · 3 browsers catch up
   step 4: the fall of the plugins · 5: D3 */
(function () {
  Deck.css("timeline", `
    .tl { position: relative; height: 100%; display: flex; flex-direction: column; gap: 0.3rem; }
    .tl-cap { display: flex; align-items: baseline; gap: 0.8rem; min-height: 1.4rem; }
    .tl-cap b { font: 600 0.85rem var(--font-serif); color: var(--ink); }
    .tl-cap span { font-size: 0.62rem; color: var(--ink-2); }
    .tl-svgwrap { position: relative; flex: 1 1 auto; min-height: 0; }
    .tl svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .tl .grid line { stroke: var(--rule); stroke-dasharray: 2 4; }
    .tl .grid text { font: 0.52rem var(--font-mono); fill: var(--muted); }
    .tl .group-label { font: 600 0.46rem var(--font-sans); letter-spacing: 0.12em; text-transform: uppercase; fill: var(--muted); }
    .tl .group-rule { stroke: var(--rule); }
    .tl .row-label { font: 600 0.62rem var(--font-sans); fill: var(--ink); }
    .tl .row-sub { font: 0.46rem var(--font-mono); fill: var(--muted); }
    .tl .bar { stroke-linecap: round; }
    .tl .end-label { font: 600 0.5rem var(--font-sans); }
    .tl .ev circle { stroke: var(--bg); stroke-width: 2; }
    .tl .ev line { stroke: var(--ink-2); stroke-opacity: 0.45; }
    .tl .ev text { font: 0.58rem var(--font-sans); fill: var(--ink); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round; }
    .tl .ev.cur text { font-weight: 700; }
    .tl .ev, .tl .hit { cursor: help; }
    .tl .now line { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 3 3; }
    .tl .now text { font: 600 0.52rem var(--font-sans); fill: var(--accent); }
  `);

  const P = d3.timeParse("%Y-%m-%d");
  const T0 = P("1995-01-01"), T1 = P("2026-12-31");

  // Rows, top to bottom. Bars: start → end (dead, ✕) or start → today (alive, →). `dashed`: an earlier, weaker phase.
  // `g`: the steps at which the row is highlighted.
  const rows = [
    { id: "ideas", label: "Ideas", g: [1, 2, 4, 5] },
    { id: "devices", label: "Browsers & devices", g: [3, 4] },
    { group: "Closed runtimes: plugins" },
    { id: "java", label: "Java applets", kind: "dead", start: "1996-01-23", end: "2018-09-25", endLabel: "plugin removed, 2018", g: [2, 4],
      desc: "JDK 1.0, Jan 1996. Browsers dropped plugins (Chrome 2015, Firefox 2017); the applet API was deprecated in Java 9 and the browser plugin is gone from Java 11 (Sep 2018)." },
    { id: "flash", label: "Flash", kind: "dead", start: "1996-12-01", end: "2021-01-12", endLabel: "blocked, Jan 2021", g: [2, 4],
      desc: 'Macromedia Flash, Dec 1996, later Adobe. End of life 31 Dec 2020; content blocked from 12 Jan 2021. Adobe: "Open standards such as HTML5, WebGL and WebAssembly… serve as viable alternatives."' },
    { id: "silver", label: "Silverlight", kind: "dead", start: "2007-09-05", end: "2021-10-12", endLabel: "ended, Oct 2021", g: [4],
      desc: "Microsoft's answer to Flash, Sep 2007. Support ended 12 Oct 2021." },
    { group: "Open standards" },
    { id: "svg", label: "SVG", kind: "alive", dashed: ["2001-09-04", "2005-11-29"], start: "2005-11-29", g: [1, 3],
      desc: "W3C Recommendation in Sep 2001, but only on paper (dashed) until browsers ship it natively: Firefox 1.5 in Nov 2005 … IE9 in Mar 2011." },
    { id: "canvas", label: "Canvas", kind: "alive", start: "2004-07-01", g: [3],
      desc: "Apple adds <canvas> to WebKit in 2004; standardized in HTML5. Immediate-mode pixels, for when SVG has too many nodes." },
    { id: "dom", label: "JavaScript + DOM", kind: "alive", start: "1995-12-04", g: [3],
      desc: "JavaScript announced Dec 1995. Selecting and changing the document from code: the API D3 builds on." },
    { group: "Built on the standards" },
    { id: "d3", label: "D3", kind: "alive", dashed: ["2009-11-01", "2011-02-17"], start: "2011-02-17", endLabel: "still v7", g: [5], accent: true,
      desc: "Protovis (2009, dashed) → D3 (Feb 2011): no scenegraph of its own, just the document. Still on v7." },
  ];

  // g = the step that labels the event
  const events = [
    { d: "1996-09-01", row: "ideas", g: 1, label: "Shneiderman's mantra", date: "Sep 1996", desc: '"Overview first, zoom and filter, then details-on-demand." The Eyes Have It, IEEE VL.' },
    { d: "2007-11-01", row: "ideas", g: 2, label: "Animated transitions", date: "2007", desc: "Heer & Robertson, IEEE TVCG: animated transitions can significantly improve graphical perception." },
    { d: "2010-05-25", row: "ideas", g: 4, label: "Responsive design", date: "25 May 2010", desc: "Ethan Marcotte, A List Apart: fluid grids, flexible images, media queries." },
    { d: "2011-03-10", row: "ideas", g: 5, label: "Explorable Explanations", date: "10 Mar 2011", desc: "Bret Victor. One month after D3's release." },
    { d: "2012-11-02", row: "ideas", g: 5, label: "512 Paths", date: "2 Nov 2012", desc: "NYT, Bostock & Shan Carter: the showcase for the data join." },
    { d: "2008-09-02", row: "devices", g: 3, label: "Chrome + V8", date: "2 Sep 2008", desc: "Start of the JIT JavaScript performance race." },
    { d: "2010-06-24", row: "devices", g: 4, label: "iPhone 4 · Retina", date: "Jun 2010", desc: "devicePixelRatio = 2. A fixed-size PNG chart is now physically blurry." },
    { d: "2016-10-01", row: "devices", g: 4, label: "Mobile > desktop", date: "Oct 2016", desc: "StatCounter: mobile + tablet 51.3% of web use worldwide, the first time ever." },
    { d: "2005-04-01", row: "java", g: 2, label: "prefuse", date: "Apr 2005", desc: "Heer, Card & Landay, CHI 2005. Interactive visualization, delivered as Java applets." },
    { d: "2007-10-22", row: "flash", g: 2, label: "Flare", date: "22 Oct 2007", desc: 'First alpha. ActionScript 3; "brings the visualization capabilities of prefuse to the web."' },
    { d: "2010-04-29", row: "flash", g: 4, label: '"Thoughts on Flash"', date: "29 Apr 2010", desc: 'Steve Jobs: "The mobile era is about low power devices, touch interfaces and open web standards."' },
    { d: "2017-07-25", row: "flash", g: 4, label: "EOL announced", date: "Jul 2017", desc: "Adobe announces the end of Flash." },
    { d: "1999-01-01", row: "svg", g: 1, label: "before: VML or a plugin", date: "~1998–2005", desc: "Vector graphics on the web: IE-only VML, or the Adobe SVG Viewer plugin. Fragmented." },
    { d: "2001-09-04", row: "svg", g: 1, label: "SVG 1.0", date: "4 Sep 2001", desc: "W3C Recommendation. An open vector standard exists, but browsers lag." },
    { d: "2005-11-29", row: "svg", g: 3, label: "Firefox 1.5", date: "29 Nov 2005", desc: 'Ships "native support for a subset of SVG 1.1 Full". First mainstream native SVG.' },
    { d: "2011-03-14", row: "svg", g: 3, label: "IE9", date: "14 Mar 2011", desc: "Native SVG at last. The last major browser holdout falls." },
    { d: "2004-07-01", row: "canvas", g: 3, label: "<canvas> in WebKit", date: "~2004", desc: "Apple introduces canvas for Dashboard; later standardized in HTML5." },
    { d: "2006-01-14", row: "dom", g: 3, label: "jQuery", date: "Jan 2006", desc: 'John Resig. Popularizes "select, then operate".' },
    { d: "2008-02-01", row: "dom", g: 3, label: "querySelectorAll", date: "Feb 2008", desc: "WebKit ships CSS selectors from JavaScript natively (Selectors API, W3C draft 2006, Recommendation 2013)." },
    { d: "2009-11-01", row: "d3", g: 3, label: "Protovis", date: "Nov 2009", desc: "InfoVis 2009. JavaScript and SVG, but with its own mark abstraction and scenegraph." },
    { d: "2011-02-17", row: "d3", g: 5, label: "D3 v1", date: "17 Feb 2011", desc: "Tagged on GitHub. Bostock, Ogievetsky & Heer; the InfoVis paper follows in Oct 2011." },
    { d: "2016-06-28", row: "d3", g: 5, label: "v4: modular", date: "28 Jun 2016", desc: '"D3 is now many small libraries." About thirty microlibraries in the default bundle.' },
    { d: "2019-01-23", row: "d3", g: 5, label: "selection.join", date: "Jan 2019", desc: 'd3-selection 1.4.0: "Add selection.join!"' },
    { d: "2021-06-11", row: "d3", g: 5, label: "v7", date: "11 Jun 2021", desc: "ES modules. Also 2021: Observable Plot, built on D3." },
    { d: "2024-03-12", row: "d3", g: 5, label: "7.9", date: "12 Mar 2024", desc: "Still the current release. This deck runs on it." },
  ].map((e) => ({ ...e, t: P(e.d) }));

  const captions = [
    ["Every plugin ended in ✕. Every standard is still running.", "hover any bar or dot for details"],
    ["1 · Standards, on paper", "SVG is a W3C Recommendation in 2001, but browsers don't follow (dashed)"],
    ["2 · Interactive, inside plugins", "prefuse runs as a Java applet, Flare in Flash: closed runtimes"],
    ["3 · Browsers catch up", "native SVG, canvas, CSS selectors from JS, fast JavaScript; IE9 falls last, in March 2011"],
    ["4 · The fall of the plugins", "touch, battery, Retina, responsive layouts: the plugins can't follow"],
    ["5 · D3 bets on the standards", "released February 2011, still on v7 in 2026"],
  ];

  Deck.widget("timeline", {
    steps: 5,
    mount(el) {
      el.classList.add("tl");
      el.innerHTML = `<div class="tl-cap"><b></b><span></span></div><div class="tl-svgwrap"></div>`;
      const wrap = el.querySelector(".tl-svgwrap");
      const tip = Deck.tooltip(wrap);
      let step = 0, svg;
      const fs = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
      const showTip = (html, ev) => tip.show(`<span style="white-space:normal;display:block;max-width:22rem">${html}</span>`, ev);

      function build() {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!W || !H) return;
        const f = fs();
        const m = { top: f * 1.6, right: f * 6.2, bottom: f * 1.3, left: f * 7.4 };
        d3.select(wrap).selectAll("svg").remove();
        svg = d3.select(wrap).append("svg").attr("viewBox", `0 0 ${W} ${H}`)
          .attr("role", "img").attr("aria-label", "Timeline 1995–2026: Java applets, Flash and Silverlight all ended; SVG, canvas, JavaScript and D3 are still running.");
        const x = d3.scaleTime([T0, T1], [m.left, W - m.right]);

        // vertical layout: group headers are half a row
        const units = d3.sum(rows, (r) => (r.group ? 0.45 : 1));
        const unit = (H - m.top - m.bottom) / units;
        let yy = m.top;
        rows.forEach((r) => { r.y0 = yy; r.h = r.group ? unit * 0.45 : unit; yy += r.h; r.by = r.y0 + r.h * 0.74; });

        // grid
        const yrs = d3.range(1995, 2027, 5).map((y) => P(`${y}-01-01`));
        const grid = svg.append("g").attr("class", "grid");
        grid.selectAll("line").data(yrs).join("line").attr("x1", x).attr("x2", x).attr("y1", m.top).attr("y2", H - m.bottom);
        grid.selectAll("text").data(yrs).join("text").attr("x", x).attr("y", H - m.bottom + f * 0.95).attr("text-anchor", "middle").text(d3.timeFormat("%Y"));

        // group headers
        const gh = svg.append("g").selectAll("g").data(rows.filter((r) => r.group)).join("g");
        gh.append("line").attr("class", "group-rule").attr("x1", 0).attr("x2", W - m.right).attr("y1", (r) => r.y0 + r.h * 0.85).attr("y2", (r) => r.y0 + r.h * 0.85);
        gh.append("text").attr("class", "group-label").attr("x", 0).attr("y", (r) => r.y0 + r.h * 0.7).text((r) => r.group);

        // rows
        const rg = svg.append("g").selectAll("g.row").data(rows.filter((r) => !r.group)).join("g").attr("class", "row");
        rg.append("text").attr("class", "row-label").attr("x", 0).attr("y", (r) => r.by + f * 0.22).text((r) => r.label);
        const color = (r) => (r.accent ? "var(--accent)" : r.kind === "dead" ? "var(--muted)" : "var(--ink-2)");
        const bw = Math.max(5, f * 0.42);
        rg.filter((r) => r.dashed).append("line").attr("class", "bar")
          .attr("x1", (r) => x(P(r.dashed[0]))).attr("x2", (r) => x(P(r.dashed[1]))).attr("y1", (r) => r.by).attr("y2", (r) => r.by)
          .attr("stroke", color).attr("stroke-width", bw * 0.45).attr("stroke-dasharray", `${bw * 0.6} ${bw * 0.7}`).attr("stroke-linecap", "butt");
        rg.filter((r) => r.kind).append("line").attr("class", "bar")
          .attr("x1", (r) => x(P(r.start))).attr("x2", (r) => (r.kind === "dead" ? x(P(r.end)) : x(T1)))
          .attr("y1", (r) => r.by).attr("y2", (r) => r.by).attr("stroke", color).attr("stroke-width", bw);
        // ends: ✕ for dead, → for alive
        const xs = bw * 0.95;
        rg.filter((r) => r.kind === "dead").append("path")
          .attr("d", (r) => { const ex = x(P(r.end)) + bw * 1.4, ey = r.by; return `M${ex - xs},${ey - xs}L${ex + xs},${ey + xs}M${ex + xs},${ey - xs}L${ex - xs},${ey + xs}`; })
          .attr("stroke", "var(--exit)").attr("stroke-width", Math.max(2.5, bw * 0.45)).attr("stroke-linecap", "round");
        rg.filter((r) => r.kind === "alive").append("path")
          .attr("d", (r) => `M${x(T1) + bw * 0.4},${r.by - bw * 1.1} l${bw * 1.5},${bw * 1.1} l${-bw * 1.5},${bw * 1.1} z`).attr("fill", color);
        rg.filter((r) => r.endLabel).append("text").attr("class", "end-label")
          .attr("x", (r) => (r.kind === "dead" ? x(P(r.end)) + bw * 3.2 : x(T1) + bw * 2.6)).attr("y", (r) => r.by + f * 0.18)
          .attr("fill", (r) => (r.kind === "dead" ? "var(--exit)" : color(r))).text((r) => r.endLabel);
        // a generous hover target over each bar
        rg.filter((r) => r.kind).append("rect").attr("class", "hit")
          .attr("x", (r) => x(P(r.dashed ? r.dashed[0] : r.start)) - 4).attr("y", (r) => r.by - bw * 1.4)
          .attr("width", (r) => (r.kind === "dead" ? x(P(r.end)) + bw * 3 : x(T1) + bw * 2) - x(P(r.dashed ? r.dashed[0] : r.start)) + 8)
          .attr("height", bw * 2.8).attr("fill", "transparent")
          .on("pointerenter pointermove", (ev, r) => showTip(`<b>${r.label}</b><br><span style="opacity:.85">${r.desc}</span>`, ev))
          .on("pointerleave", () => tip.hide());

        // events: dot on the bar, label above, packed into levels so labels never overlap
        const byId = new Map(rows.filter((r) => r.id).map((r) => [r.id, r]));
        const evg = svg.append("g").selectAll("g.ev").data(events, (d) => d.label).join("g").attr("class", "ev");
        evg.each((d) => { d.cx = x(d.t); d.r = byId.get(d.row); });
        const label = evg.append("text").attr("x", (d) => d.cx + 4).text((d) => d.label);
        const lineH = f * 0.78;
        d3.groups(events, (e) => e.row).forEach(([, evs]) => {
          const ends = [];
          evs.slice().sort((a, b) => a.t - b.t).forEach((e) => {
            const w = label.filter((d) => d === e).node().getComputedTextLength() || e.label.length * f * 0.32;
            let lvl = ends.findIndex((end) => end < e.cx - 2);
            if (lvl < 0) lvl = ends.length;
            ends[lvl] = e.cx + 4 + w + f * 0.5;
            e.ly = e.r.by - bw * 1.2 - lvl * lineH;
          });
        });
        label.attr("y", (d) => d.ly);
        evg.insert("line", "text").attr("x1", (d) => d.cx).attr("x2", (d) => d.cx).attr("y1", (d) => d.ly + 2).attr("y2", (d) => d.r.by);
        evg.append("circle").attr("cx", (d) => d.cx).attr("cy", (d) => d.r.by).attr("r", Math.max(4.5, bw * 0.75));
        evg.append("rect").attr("x", (d) => d.cx - 8).attr("y", (d) => d.ly - lineH).attr("height", (d) => d.r.by - d.ly + lineH + 8)
          .attr("width", function () { return this.parentNode.querySelector("text").getComputedTextLength() + 16; }).attr("fill", "transparent");
        evg.on("pointerenter", function (ev, d) {
          d3.select(this).select("circle").attr("r", Math.max(7, bw * 1.1));
          showTip(`<b>${d.date}</b> · ${d.label}<br><span style="opacity:.85">${d.desc}</span>`, ev);
        }).on("pointermove", (ev) => tip.el.style.display === "block" && tip.show(tip.el.innerHTML, ev))
          .on("pointerleave", function () { d3.select(this).select("circle").attr("r", Math.max(4.5, bw * 0.75)); tip.hide(); });

        // Feb 2011 marker for step 5
        const now = svg.append("g").attr("class", "now").attr("opacity", 0);
        now.append("line").attr("x1", x(P("2011-02-17"))).attr("x2", x(P("2011-02-17"))).attr("y1", m.top).attr("y2", H - m.bottom);
        apply(false);
      }

      function apply(animate) {
        if (!svg) return;
        const dur = animate ? 600 : 0;
        const hi = (r) => step === 0 || r.g.includes(step);
        svg.selectAll("g.row").transition().duration(dur).attr("opacity", (r) => (hi(r) ? 1 : 0.5));
        svg.selectAll("g.ev").each(function (d) {
          const g = d3.select(this), on = step > 0 && d.g <= step, cur = d.g === step;
          g.classed("cur", cur);
          const rowOn = hi(d.r);
          g.transition().duration(dur).attr("opacity", rowOn ? 1 : 0.5);
          g.select("circle").transition().duration(dur)
            .attr("fill", d.row === "d3" && d.g === 5 ? "var(--accent)" : cur ? "var(--ink)" : on ? "var(--ink-2)" : "var(--muted)");
          g.select("text").transition().duration(dur).attr("opacity", on ? (cur ? 1 : 0.6) : 0);
          g.select("line").transition().duration(dur).attr("opacity", on ? 1 : 0);
        });
        svg.select(".now").transition().duration(animate ? 900 : 0).attr("opacity", step >= 5 ? 1 : 0);
        const [a, b] = captions[step];
        el.querySelector(".tl-cap b").textContent = a;
        el.querySelector(".tl-cap span").textContent = b;
      }

      build();
      Deck.onTheme(() => apply(false));
      return {
        step(n, info) { const was = step; step = n; apply(!info || !info.changedSlide || was !== n); },
        enter() { build(); },
        resize() { build(); },
      };
    },
  });
})();
