/* D3 as a toolbox: circle packing (d3.hierarchy + d3.pack) of the 30 modules in the default bundle.
   step 0: all · 1: modules used by d3js.org's stacked-area example · 2: DOM vs renderer-agnostic */
(function () {
  Deck.css("toolbox", `
    .tb { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2rem; height: 100%; min-height: 0; align-items: center; }
    .tb-pack { position: relative; height: 100%; aspect-ratio: 1; min-height: 0; }
    .tb-pack svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .tb .cat circle { fill: var(--surface-2); stroke: none; }
    .tb .cat text { font: 600 0.5rem var(--font-sans); letter-spacing: 0.1em; text-transform: uppercase; fill: var(--muted); }
    .tb .leaf circle { fill: var(--surface); stroke: var(--rule); stroke-width: 1; transition: fill .5s, stroke .5s, opacity .5s; cursor: default; }
    .tb .leaf text { font: 0.52rem var(--font-mono); fill: var(--ink); text-anchor: middle; pointer-events: none; transition: fill .5s, opacity .5s; }
    .tb .leaf text .pre { fill: var(--muted); font-size: 0.42rem; }
    .tb .leaf.hot circle { fill: var(--accent); stroke: var(--accent); }
    .tb .leaf.hot text, .tb .leaf.hot text .pre { fill: #fff; }
    .tb .leaf.cool circle { fill: var(--accent-2); stroke: var(--accent-2); }
    .tb .leaf.cool text, .tb .leaf.cool text .pre { fill: #fff; }
    .tb .leaf.dim circle, .tb .leaf.dim text { opacity: 0.35; }
    .tb .leaf:hover circle { stroke: var(--ink); stroke-width: 2; }
    .tb-side { display: flex; flex-direction: column; gap: 1rem; }
    .tb-big { font: 600 1.25rem/1.25 var(--font-serif); color: var(--ink); }
    .tb-big em { font-style: normal; color: var(--accent); }
    .tb-big em.cool { color: var(--accent-2); }
    .tb-sub { font-size: 0.72rem; color: var(--ink-2); line-height: 1.45; }
    .tb-sub code { font-size: 0.85em; }
    .tb-legend { display: flex; gap: 1.2rem; font-size: 0.62rem; color: var(--ink-2); }
    .tb-legend i { display: inline-block; width: 0.8em; height: 0.8em; border-radius: 50%; margin-right: 0.35em; vertical-align: -0.1em; }
  `);

  const M = (name, desc, fns) => ({ name, desc, fns });
  const tree = { name: "d3", children: [
    { name: "Data", children: [
      M("d3-array", "Statistics, search, grouping and binning", "extent · max · group · rollup · bin"),
      M("d3-dsv", "Parse and format CSV / TSV", "csvParse · autoType"),
      M("d3-fetch", "Load files with fetch", "csv · json"),
      M("d3-format", "Format numbers for humans", "format"),
      M("d3-random", "Random numbers from distributions", "randomNormal · randomUniform"),
      M("d3-time", "Calendar intervals", "timeDay · timeMonth · timeYear"),
      M("d3-time-format", "Parse and format dates", "timeParse · timeFormat"),
    ] },
    { name: "DOM & interaction", children: [
      M("d3-selection", "Select elements and join data to them", "select · selectAll · join · on"),
      M("d3-transition", "Animated changes to the DOM", "transition · duration · delay"),
      M("d3-brush", "Select a region by clicking and dragging", "brush · brushX"),
      M("d3-zoom", "Pan and zoom with mouse, wheel and touch", "zoom · zoomIdentity"),
      M("d3-drag", "Drag and drop", "drag"),
      M("d3-dispatch", "Named callbacks for custom events", "dispatch"),
    ] },
    { name: "Scales, axes & colour", children: [
      M("d3-scale", "Map data (domain) to visual values (range)", "scaleLinear · scaleBand · scaleTime · scaleOrdinal"),
      M("d3-scale-chromatic", "Colour schemes and ramps", "interpolateRdBu · schemeTableau10"),
      M("d3-color", "Colour spaces", "rgb · hsl · lab"),
      M("d3-interpolate", "Blend between two values", "interpolate · interpolateRgb"),
      M("d3-axis", "Draw a scale as an axis", "axisBottom · axisLeft"),
    ] },
    { name: "Shapes, layouts & geo", children: [
      M("d3-shape", "Data → SVG path: lines, areas, arcs, pies, stacks", "line · area · arc · pie · stack"),
      M("d3-path", "Canvas path commands → SVG path strings", "path"),
      M("d3-hierarchy", "Trees, treemaps and circle packing (this slide!)", "hierarchy · pack · treemap · tree"),
      M("d3-force", "Force-directed layouts", "forceSimulation · forceLink"),
      M("d3-chord", "Chord diagrams", "chord · ribbon"),
      M("d3-contour", "Contours and density estimation", "contours · contourDensity"),
      M("d3-delaunay", "Voronoi diagrams; nearest-point lookup", "Delaunay · voronoi"),
      M("d3-polygon", "Polygon geometry", "polygonArea · polygonHull"),
      M("d3-quadtree", "Spatial index for fast hit-testing", "quadtree"),
      M("d3-geo", "Map projections and spherical geometry", "geoPath · geoAlbers · geoMercator"),
    ] },
    { name: "Animation", children: [
      M("d3-ease", "Easing functions", "easeCubic · easeBounce"),
      M("d3-timer", "An efficient animation loop", "timer · interval"),
    ] },
  ] };

  const stackedArea = new Set(["d3-dsv", "d3-scale", "d3-scale-chromatic", "d3-shape", "d3-axis", "d3-selection"]);
  const domModules = new Set(["d3-selection", "d3-transition", "d3-axis", "d3-brush", "d3-zoom", "d3-drag"]);

  const captions = [
    { big: `<em>30</em> small libraries, one default bundle.`,
      sub: `Since v4 (June 2016): "There isn't a 'core' D3 anymore; there's just a default bundle." This picture is <code>d3.hierarchy</code> + <code>d3.pack</code>: D3 drawing its own table of contents. Hover a module.` },
    { big: `One stacked-area chart, <em>six modules</em>.`,
      sub: `d3js.org's example: a CSV parser, time, linear and ordinal scales, a categorical scheme, the stack layout, the area shape, axes and selections. Eight pieces, picked from the toolbox.` },
    { big: `Only <em>6</em> modules touch the DOM. The other <em class="cool">24</em> don't care how you draw.`,
      sub: `Scales, shapes, layouts and projections are just functions: they work with SVG, Canvas, WebGL, React… That's why D3 outlived the SVG-only era, and why other libraries build on it.` },
  ];

  Deck.widget("toolbox", {
    steps: 2,
    mount(el) {
      el.classList.add("tb");
      el.innerHTML = `<div class="tb-pack"></div>
        <div class="tb-side"><div class="tb-big"></div><div class="tb-sub"></div><div class="tb-legend"></div></div>`;
      const packEl = el.querySelector(".tb-pack");
      const tip = Deck.tooltip(el);
      let step = 0, svg;

      function build() {
        const S = packEl.clientHeight;
        if (!S) return;
        const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const root = d3.hierarchy(tree).sum((d) => (d.children ? 0 : 1)).sort((a, b) => d3.ascending(a.data.name, b.data.name));
        d3.pack().size([S, S]).padding((d) => (d.depth === 0 ? fs * 1.05 : d.depth === 1 ? fs * 0.08 : 0))(root);
        // leave room at the top of each category circle for its label
        d3.select(packEl).selectAll("svg").remove();
        svg = d3.select(packEl).append("svg").attr("viewBox", `0 0 ${S} ${S}`)
          .attr("role", "img").attr("aria-label", "The 30 modules of D3 v7, grouped by purpose");
        const cats = svg.append("g").selectAll("g.cat").data(root.children, (d) => d.data.name).join("g").attr("class", "cat");
        cats.append("circle").attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", (d) => d.r);
        // category label on an arc along the top of its circle
        cats.append("path").attr("id", (d, i) => `tb-arc-${i}`).attr("fill", "none")
          .attr("d", (d) => { const r = d.r + fs * 0.12; return `M${d.x - r},${d.y} A${r},${r} 0 0,1 ${d.x + r},${d.y}`; });
        cats.append("text").append("textPath").attr("href", (d, i) => `#tb-arc-${i}`).attr("startOffset", "50%")
          .attr("text-anchor", "middle").text((d) => d.data.name);

        const leaves = svg.append("g").selectAll("g.leaf").data(root.leaves(), (d) => d.data.name).join("g")
          .attr("class", "leaf").attr("transform", (d) => `translate(${d.x},${d.y})`);
        leaves.append("circle").attr("r", (d) => d.r - 1.5);
        const t = leaves.append("text");
        t.append("tspan").attr("class", "pre").attr("x", 0).attr("dy", "-0.35em").text("d3-");
        leaves.each(function (d) {
          const parts = d.data.name.slice(3).split("-");
          const tx = d3.select(this).select("text");
          parts.forEach((p, i) => tx.append("tspan").attr("x", 0).attr("dy", i === 0 ? "1.15em" : "1.05em").text(p + (i < parts.length - 1 ? "-" : "")));
          if (parts.length > 1) tx.attr("transform", "translate(0,-6)");
          // shrink the label until its longest line fits inside the circle
          const longest = d3.max(parts, (p) => p.length + 1);
          const size = Math.max(fs * 0.44, Math.min(fs * 0.56, (2 * d.r * 0.9) / (longest * 0.6)));
          tx.style("font-size", size + "px");
          tx.select(".pre").style("font-size", size * 0.8 + "px");
        });
        leaves.on("pointerenter", (ev, d) => tip.show(`<b>${d.data.name}</b> · ${d.data.desc}<br><span style="opacity:.75;font-family:var(--font-mono)">${d.data.fns}</span>`, ev))
          .on("pointermove", (ev) => tip.el.style.display === "block" && tip.show(tip.el.innerHTML, ev))
          .on("pointerleave", () => tip.hide());
        apply();
      }

      function apply() {
        if (!svg) return;
        svg.selectAll("g.leaf")
          .classed("hot", (d) => (step === 1 && stackedArea.has(d.data.name)) || (step === 2 && domModules.has(d.data.name)))
          .classed("cool", (d) => step === 2 && !domModules.has(d.data.name))
          .classed("dim", (d) => step === 1 && !stackedArea.has(d.data.name));
        const c = captions[step];
        el.querySelector(".tb-big").innerHTML = c.big;
        el.querySelector(".tb-sub").innerHTML = c.sub;
        el.querySelector(".tb-legend").innerHTML = step === 2
          ? `<span><i style="background:var(--accent)"></i>touches the DOM</span><span><i style="background:var(--accent-2)"></i>renderer-agnostic</span>`
          : step === 1 ? `<span><i style="background:var(--accent)"></i>used by the stacked-area chart</span>` : "";
      }

      build();
      return { step(n) { step = n; apply(); }, resize: build };
    },
  });
})();
