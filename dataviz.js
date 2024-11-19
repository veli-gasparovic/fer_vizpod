// https://en.wikipedia.org/wiki/Warming_stripes

const svg = d3.select(".chart");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

// svg.style("background-color", "purple");

//read the data form a local wordl_annual.json file
await d3.json("world_annual.json").then(async (data) => {
  console.log(data);
  //   debugger;

  //   enrich data with years
  data = data.map((d, i) => {
    return {
      year: 1850 + i,
      anomaly: d,
    };
  });

  console.log(data);

  await render(data);
});

async function render(data) {
  // create a scaleBand for the x axis, spanning full width of the chart
  const xScale = d3
    .scaleBand()
    .domain(data.map((_, i) => i))
    .range([0, width]);

  console.log(xScale.bandwidth());
  console.log(xScale.domain().length);

  //rects:
  // data.forEach((d, i) => {
  //   svg
  //     .append("rect")
  //     .attr("x", xScale(i))
  //     .attr("y", 0)
  //     .attr("width", xScale.bandwidth())
  //     .attr("fill", "white")
  //     .attr("height", height)
  //     .attr("stroke", "black");
  // });

  //diverging color schemes:
  //https://d3js.org/d3-scale-chromatic/diverging
  //https://d3js.org/d3-scale/diverging

  // console.log(d3.extent(data, (d) => d.anomaly));

  const maxAnomaly = d3.max(data, (d) => Math.abs(d.anomaly));

  // let's contruct a color scale for the rectangles, divergent (blue to red, white in the middle)
  const colorScale = d3.scaleDiverging(
    [maxAnomaly, 0, -maxAnomaly],
    // d3.interpolateRdBu
    d3.interpolatePiYG
  );

  // let's iterate data and drawing full heigh rectangles:
  const rectGroup = svg.append("g");

  const rects = data.map((d, i) => {
    return rectGroup
      .append("rect")
      .attr("x", xScale(i))
      .attr("y", 0)
      .attr("width", xScale.bandwidth())
      .attr("fill", "white")
      .attr("height", height);
  });

  // Create and await all transitions
  await Promise.all(
    rects.map((rect, i) => {
      const t = rect
        .transition()
        .duration(1000)
        .delay(20 * i)
        .attr("fill", colorScale(data[i].anomaly));

      return t.end();
    })
  );

  // After all transitions complete, add the interactions
  rects.forEach((rect, i) => {
    const d = data[i];
    const offset = 30;

    rect.on("mouseover", () => {
      rect.transition().duration(250).attr("y", -offset);
      rect.attr("stroke", "black").attr("stroke-width", 1).raise();

      const tooltipGroup = svg
        .append("g")
        .attr("class", "tooltip")
        .attr(
          "transform",
          `translate(${xScale(i) + xScale.bandwidth() + 4}, ${-offset})`
        )
        .style("pointer-events", "none")
        .style("font-size", "11px")
        .style("font-family", "sans-serif")
        .style("dominant-baseline", "hanging");

      tooltipGroup
        .style("opacity", 0)
        .transition()
        .duration(250)
        .style("opacity", 1);

      tooltipGroup.append("text").text(`${d.year}.`);
      tooltipGroup
        .append("text")
        .attr("dy", 12)
        .text(`${d.anomaly.toFixed(2)}°C`);
    });

    rect.on("mouseout", function (event) {
      d3.select(this).transition().attr("y", 0).attr("stroke", "none");
      svg.selectAll("g.tooltip").remove();
    });
  });

  //   let's add x axis to the bottom:
  const xAxis = d3
    .axisBottom(xScale)
    .tickValues(xScale.domain().filter((d, i) => i % 20 === 0))
    .tickFormat((i) => data[i].year);

  const axisGroup = svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(xAxis)
    .call((g) => g.selectAll(".domain").remove())
    .attr("opacity", 0)
    .transition()
    .duration(1000)
    .attr("opacity", 1);
}
