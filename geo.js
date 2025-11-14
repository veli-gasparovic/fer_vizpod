const mapContainer = document.getElementById("map");

if (!mapContainer) {
  throw new Error("Element with id `map` not found. Cannot render map.");
}

const width = Math.min(mapContainer.clientWidth || 800, 1200);
const height = mapContainer.clientHeight || 600;

const svg = d3
  .select(mapContainer)
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .style("overflow", "visible")
  .attr("viewBox", `0 0 ${width} ${height}`);

const tooltip = (() => {
  let element = document.getElementById("geo-tooltip");
  if (!element) {
    element = document.createElement("div");
    element.id = "geo-tooltip";
    element.style.position = "absolute";
    element.style.pointerEvents = "none";
    element.style.padding = "8px 12px";
    element.style.background = "rgba(0, 0, 0, 0.75)";
    element.style.color = "#fff";
    element.style.fontFamily = "sans-serif";
    element.style.fontSize = "12px";
    element.style.borderRadius = "4px";
    element.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.25)";
    element.style.display = "none";
    element.style.zIndex = "1000";
    document.body.appendChild(element);
  }
  return element;
})();

Promise.all(
  [d3.json("hrvatska.topo.json"),
  d3.csv("stanovnistvo_povrsina.csv", d3.autoType)]
)
  .then(([topology, populationRows]) => {
    const geojson = topojson.feature(topology, topology.objects.hrvatska);

    const populationLookup = new Map(
      populationRows.map((row) => [row.Name.trim().toUpperCase(), row])
    );

    geojson.features.forEach((feature) => {
      const name = feature.properties?.NAME_2;
      if (!name) return;
      const match = populationLookup.get(name.trim().toUpperCase());
      feature.properties.populationRecord = match || null;
    });

    const projection = d3
      .geoAlbers()
      .rotate([-15, 0])
      .fitSize([width, height], geojson);

    const path = d3.geoPath(projection);

    const municipalityGroup = svg
      .append("g")
      .attr("class", "municipalities");

    municipalityGroup
      .selectAll("path")
      .data(geojson.features)
      .join("path")
      .attr("d", path)
      .attr("fill", "#d8dde6")
      .attr("stroke", "#888")
      .attr("stroke-width", 0.5)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-width", 2).attr("stroke", "#333").raise();

        if (!d?.properties) return;

        const { NAME_2, NAME_1, populationRecord } = d.properties;
        const content = [
          `<strong>${NAME_2 || "Nepoznato"}</strong>`,
          NAME_1 ? `<div>Županija: ${NAME_1}</div>` : "",
        ];

        if (populationRecord) {
          content.push(
            `<div>Stanovništvo: ${d3.format(",")(populationRecord.Population)}</div>`
          );
          content.push(
            `<div>Površina: ${d3.format(",")(populationRecord.Area)} m²</div>`
          );
          content.push(
            `<div>DEGURBA: ${populationRecord.DEGURBA}</div>`
          );
        } else {
          content.push(`<div>Podaci nisu dostupni</div>`);
        }

        tooltip.innerHTML = content.join("");
        tooltip.style.display = "block";
      })
      .on("mousemove", function (event) {
        const offset = 12;
        tooltip.style.left = `${event.pageX + offset}px`;
        tooltip.style.top = `${event.pageY + offset}px`;
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 0.5).attr("stroke", "#888").lower();        
        tooltip.style.display = "none";
      });

    const zoom = d3
      .zoom()
      .scaleExtent([1, 12])
      .on("zoom", (event) => {
        municipalityGroup.attr("transform", event.transform);

        municipalityGroup
          .selectAll("path")
          .attr("stroke-width", 0.5 / event.transform.k);
      });

    svg.call(zoom);
  })
  .catch((error) => {
    console.error("Failed to load or render map resources:", error);
  });


