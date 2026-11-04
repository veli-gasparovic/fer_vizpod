// From ../geo.js: TopoJSON → projection → zoom → join census → choropleth → legend
Deck.script("geo", {
  file: "geo.js",
  args: {
    topology: () => HRVATSKA_TOPO,
    population: () => d3.csvParse(POPULATION_CSV, d3.autoType),
  },
  stageLabel: "<svg> · scroll to zoom",
  explain: [
    "TopoJSON (shared borders, small file) → GeoJSON features: one per municipality.",
    "A <b>projection</b> is a layout: it maps lon/lat to x/y. <code>geoPath</code> turns each feature into a path string.",
    "<b>d3.zoom()</b>: a behaviour you <code>.call()</code>. Scroll / drag the map.",
    "Join the 2011 census CSV to the shapes <b>by name</b>, then hover for details.",
    "<b>Choropleth</b>: people per km² on a <b>log</b> scale. Density spans four orders of magnitude.",
    "A legend is just another scale + axis.",
  ],
  chunks: [
    { code: `
      // TopoJSON → GeoJSON
      const geojson = topojson.feature(topology, topology.objects.hrvatska);
      console.log(geojson.features.length, "features", geojson.features[0].properties);

      const svg = d3.select(root).append("svg")
        .attr("viewBox", [0, 0, width, height]);
    ` },
    { at: 1, label: "projection + path", code: `

      const projection = d3.geoAlbers()
        .rotate([-15, 0])
        .fitSize([width, height], geojson);
      const path = d3.geoPath(projection);

      const g = svg.append("g");
      const municipalities = g.selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", path)
        .attr("fill", "#d8dde6")
        .attr("stroke", "#888")
        .attr("stroke-width", 0.5);
    ` },
    { at: 2, label: "zoom", code: `

      svg.call(d3.zoom()
        .scaleExtent([1, 12])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
          municipalities.attr("stroke-width", 0.5 / event.transform.k);
        }));
    ` },
    { at: 3, label: "join census + tooltip", code: `

      // join the census rows to the shapes, by name
      const byName = new Map(population.map((r) => [r.Name.trim().toUpperCase(), r]));
      geojson.features.forEach((f) => {
        f.properties.census = byName.get(f.properties.NAME_2.trim().toUpperCase()) || null;
      });

      const tip = d3.select(root).append("div").attr("class", "tip");
      municipalities
        .on("pointermove", (event, d) => {
          const { NAME_2, NAME_1, census } = d.properties;
          const [mx, my] = d3.pointer(event, root);
          tip.style("opacity", 1)
            .style("left", \`\${mx + 14}px\`).style("top", \`\${my + 14}px\`)
            .html(\`<b>\${NAME_2}</b> · \${NAME_1}<br>\` + (census
              ? \`\${d3.format(",")(census.Population)} people · \${d3.format(",.0f")(census.Area / 1e6)} km²\`
              : "no census match"));
        })
        .on("pointerleave", () => tip.style("opacity", 0));
    ` },
    { at: 4, label: "choropleth", code: `

      // people per km² (Area is in m²)
      const density = (d) => d.properties.census &&
        d.properties.census.Population / (d.properties.census.Area / 1e6);
      const color = d3.scaleSequentialLog(d3.interpolateYlGnBu)
        .domain(d3.extent(geojson.features, density));

      municipalities.transition().duration(1200)
        .attr("fill", (d) => (density(d) ? color(density(d)) : "#eee"));
    ` },
    { at: 5, label: "legend", code: `

      const legendW = 240;
      const lx = d3.scaleLog().domain(color.domain()).range([0, legendW]);
      const legend = svg.append("g")
        .attr("transform", \`translate(30, \${height - 50})\`);   // bottom-left: the Adriatic is empty
      legend.selectAll("rect")
        .data(d3.range(0, legendW, 4))
        .join("rect")
        .attr("x", (px) => px).attr("width", 4.5).attr("height", 10)
        .attr("fill", (px) => color(lx.invert(px)));
      legend.append("g")
        .attr("transform", "translate(0, 10)")
        .call(d3.axisBottom(lx).ticks(4, "~s"));
      legend.append("text").attr("y", -6).attr("font-size", 12).text("people per km²");
    ` },
  ],
});
