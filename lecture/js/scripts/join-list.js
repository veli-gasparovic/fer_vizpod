// From ../d3.html createBulletedList(): .data().enter().append() → .join() → click to remove → live updates
Deck.script("join-list", {
  file: "d3.html  createBulletedList()",
  rootClass: "padded list-stage",
  stageLabel: "live document",
  explain: [
    "An array of 10 shuffled numbers. Nothing on the page yet.",
    "<b>.data(data).enter().append(\"li\")</b>: one new <code>&lt;li&gt;</code> per datum that has no element yet. Press <kbd>X</kbd> and hover an item.",
    "The modern spelling: <b>.join(\"li\")</b> handles enter, update and exit for you (d3-selection 1.4, 2019).",
    "Click an item: transition, then <code>.remove()</code>.",
    "Every 2 s, new data: <span style='color:var(--enter)'>enter</span>, update, <span style='color:var(--exit)'>exit</span>, all from one join.",
  ],
  chunks: [
    { code: `
      // DATA
      const data = d3.shuffle(d3.range(10));
      console.log(data);

      const ul = d3.select(root).append("ul");
    ` },
    { at: 1, until: 2, label: "enter + append", code: `

      const items = ul
        .selectAll("li")
        .data(data, (d) => d)
        .enter()
        .append("li")
        .text((d, i) => \`\${i}: number \${d}\`);
    ` },
    { at: 2, label: "selection.join", code: `

      const items = ul
        .selectAll("li")
        .data(data, (d) => d)
        .join("li")
        .text((d, i) => \`\${i}: number \${d}\`);
    ` },
    { at: 3, label: "click to remove", code: `

      items.on("click", function () {
        d3.select(this)
          .transition()
          .duration(800)
          .style("opacity", 0)
          .style("font-size", "0px")
          .remove();
      });
    ` },
    { at: 4, label: "enter / update / exit", code: `

      setInterval(() => {
        const next = d3.shuffle(d3.range(12)).slice(0, d3.randomInt(4, 11)());
        ul.selectAll("li")
          .data(next, (d) => d)
          .join(
            (enter) => enter.append("li").style("color", "seagreen"),
            (update) => update.style("color", null),
            (exit) => exit.style("color", "crimson")
              .transition().duration(900).style("opacity", 0).remove()
          )
          .text((d, i) => \`\${i}: number \${d}\`);
      }, 2000);
    ` },
  ],
});
