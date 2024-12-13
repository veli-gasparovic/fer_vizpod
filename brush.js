const svg = d3.select(".chart");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

svg.style("background-color", "purple");

function createStarPath(radius, points = 5) {
  const angleStep = (Math.PI * 2) / points;
  const innerRadius = radius * 0.4; // unutarnji radius na 40% od vanjskog

  // Generate the path using d3.line
  const curve = d3.curveLinearClosed;
  //   const curve = d3.curveBasisClosed;
  const lineGenerator = d3.line().curve(curve);

  const coordinates = [];

  // Generate star points
  for (let i = 0; i < points; i++) {
    // Outer point
    const outerAngle = i * angleStep - Math.PI / 2; // Start at top
    coordinates.push([
      radius * Math.cos(outerAngle),
      radius * Math.sin(outerAngle),
    ]);

    // Inner point
    const innerAngle = outerAngle + angleStep / 2;
    coordinates.push([
      innerRadius * Math.cos(innerAngle),
      innerRadius * Math.sin(innerAngle),
    ]);
  }

  // Close the path by connecting back to first point
  coordinates.push(coordinates[0]);

  return lineGenerator(coordinates);
}

const centerX = width / 2;
const centerY = height / 2;

const zoomGroup = svg.append("g");

const starGroup = zoomGroup
  .append("g")
  .attr("transform", `translate(${centerX}, ${centerY})`);

let dataset = [];
// let's add 10 stars
for (let i = 0; i < 10; i++) {
  const x = Math.random();
  const y = Math.random();

  dataset.push({ x, y });
}

starGroup
  .selectAll("path")
  .data(dataset)
  .enter()
  .append("path")
  .attr("d", (d, i) => createStarPath(50, 5 + i))
  .attr(
    "transform",
    (d) => `translate(${d.x * width - centerX}, ${d.y * height - centerY})`
  )
  .attr("stroke", "white")
  .attr("stroke-width", 2)
  .attr("fill", "white")
  .attr("fill-opacity", 0.2)
  .style("cursor", "pointer");

//   dodajem zoom i pan:
const zoom = d3.zoom().on("zoom", (event) => {
  zoomGroup.attr("transform", event.transform);
});

// svg.style('overflow', 'hidden');
svg.call(zoom);

// fetch the .brush svg element and expand it to its parent
const brushSvg = d3.select(".brush");
const parent = brushSvg.node().parentNode;

const brushWidth = parent.clientWidth;
const brushHeight = parent.clientHeight;
const brushCenterX = brushWidth / 2;
const brushCenterY = brushHeight / 2;

brushSvg
  .style("background-color", "lightgray")
  .attr("width", "100%")
  .attr("height", "100%");

//   let's add the same shapes to the brushSvg
const brushGroup = brushSvg
  .append("g")
  .attr("transform", `translate(${brushWidth / 2}, ${brushHeight / 2})`);

console.log(dataset);

brushGroup
  .selectAll("path")
  .data(dataset)
  .enter()
  .append("path")
  .attr("d", (d, i) => createStarPath(50, 5 + i))
  .attr(
    "transform",
    (d) =>
      `translate(${d.x * brushWidth - brushCenterX}, ${d.y * brushHeight - brushCenterY})`
  )
  .attr("stroke", "black")
  .attr("stroke-width", 2)
  .attr("stroke-opacity", 0.2)
  .attr("fill", "black")
  .attr("fill-opacity", 0.1);

if (false) {
  // create a brush to select stars
  const brush = d3.brush().on("start brush end", (event) => {
    // get the selection
    const selection = event.selection;

    starGroup.selectAll("path").classed("selected", false);

    //   get the selected stars and fill them with yellow
    const selectedStars = starGroup.selectAll("path").filter((d, i) => {
      const x = d.x * brushWidth;
      const y = d.y * brushHeight;

      return (
        x > selection[0][0] &&
        x < selection[1][0] &&
        y > selection[0][1] &&
        y < selection[1][1]
      );
    });

    selectedStars.classed("selected", true);
  });

  // add the brush to the brushSvg
  brushSvg.call(brush);
}

if (false) {
  // create a brush to select stars
  const brush = d3.brush().on("start brush end", (event) => {
    if (!event.selection) return;

    const selection = event.selection;
    const [[x0, y0], [x1, y1]] = selection;

    // Calculate scale based on selection size
    const scaleX = width / (x1 - x0);
    const scaleY = height / (y1 - y0);
    const scale = Math.min(scaleX, scaleY);

    // Calculate translation accounting for center offset
    const translateX = -x0 * scale;
    const translateY = -y0 * scale;

    zoomGroup.call(
      zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    );
  });

  // add the brush to the brushSvg
  brushSvg.call(brush);
}

// set overflow hidden to both svgs
svg.style("overflow", "hidden");
brushSvg.style("overflow", "hidden");
