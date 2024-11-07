const svg = d3.select(".chart");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

//read the data form a local wordl_annual.json file
d3.json("world_annual.json").then((data) => {
  console.log(data);
  //   debugger;

  //   enrich data with years
  data = data.map((d, i) => {
    return {
      year: 1850 + i,
      anomaly: d,
    };
  });

  render(data);
});

function render(data) {
  // create a scaleBand for the x axis, spanning full width of the chart
  const xScale = d3
    .scaleBand()
    .domain(data.map((_, i) => i))
    .range([0, width]);

  const maxAnomaly = d3.max(data, (d) => Math.abs(d.anomaly));

  // let's contruct a color scale for the rectangles, divergent (blue to red, white in the middle)
  const colorScale = d3.scaleDiverging(
    [maxAnomaly, 0, -maxAnomaly],
    // d3.interpolateRdBu
    d3.interpolatePiYG
  );

  // let's iterate data and drawing full heigh rectangles:
  const rectGroup = svg.append("g");
  data.forEach((d, i) => {
    const rect = rectGroup
      .append("rect")
      .attr("x", xScale(i))
      .attr("y", 0)
      .attr("width", xScale.bandwidth())
      .attr("fill", "white")
      .attr("height", height);

    rect
      .transition()
      .duration(1000)
      .delay(20 * i)
      .attr("fill", colorScale(d.anomaly));

    const offset = 30;

    //   add a mouseover to transition the rect 10 pixels up and add a text showing the year and anomaly
    rect.on("mouseover", (event) => {
      rect.transition().attr("y", -offset);

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

      tooltipGroup.append("text").text(`${d.year}.`);

      tooltipGroup
        .append("text")
        .attr("dy", 12)
        .text(`${d.anomaly.toFixed(2)}°C`);
    });

    // add a mouseout to transition the rect back to its original position and remove the text
    rect.on("mouseout", (event) => {
      rect.transition().attr("y", 0);
      svg.selectAll("g.tooltip").remove();
    });
  });

  //   let's add x axis to the bottom:
  const xAxis = d3
    .axisBottom(xScale)
    .tickValues(xScale.domain().filter((d, i) => i % 20 === 0))
    .tickFormat((i) => data[i].year);

  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(xAxis)
    .call((g) => g.selectAll(".domain").remove());
}
