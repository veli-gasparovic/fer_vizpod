// From ../d3.html createBulletedList(): .data().enter().append() → .join() → click to remove → live updates
Deck.script("join-list", {
  file: "d3.html  createBulletedList()",
  rootClass: "padded list-stage",
  stageLabel: "<div id=\"chart\"> · live document",
  explain: [
    `<div class="ex"><p><b>What:</b> an array of the numbers 0–9 in random order (logged below). Nothing on the page yet.</p>
     <p><b>Why:</b> data alone draws nothing. D3's job is to connect this array to elements in the document.</p></div>`,
    `<div class="ex"><p><b>What:</b> <code>.selectAll("li")</code> finds <i>no</i> elements. <code>.data(data)</code> pairs the 10 numbers with those 0 elements, and the 10 without a partner form the <b class="en">enter</b> selection. <code>.append("li")</code> creates one element for each.</p>
     <div class="ex-tally"><span>10 data</span><span>vs</span><span>0 elements</span><span>→</span><span class="en">enter 10</span><span class="up">update 0</span><span class="xt">exit 0</span></div>
     <p><b>Try:</b> press <kbd>X</kbd> and hover an item: its number sits on the element as <code>__data__</code>.</p></div>`,
    `<div class="ex"><p><b>What changed:</b> <code>.enter().append("li")</code> became <code>.join("li")</code>. The page looks the same.</p>
     <p><b>Why:</b> <code>enter().append()</code> only handles <i>new</i> data. When the data changes, old elements whose number is gone would stay, and elements that are still there wouldn't get their new text. <code>.join()</code> handles all three cases: <b class="en">enter</b> → append, <b class="up">update</b> → keep, <b class="xt">exit</b> → remove. Old tutorials (and AI) still write the first form.</p></div>`,
    `<div class="ex"><p><b>What:</b> click an item: it fades out and is <code>.remove()</code>d from the document.</p>
     <p><b>Notice:</b> the <i>array</i> still has that number. The document and the data now disagree, and the next join (step 4) puts them back in sync.</p></div>`,
    `<div class="ex"><p><b>What:</b> every 2 s, a random subset of the numbers 0–11 (logged below) is joined against the list, using the number itself as the key.</p>
     <div class="ex-tally ex-legend"><span class="en">enter</span><span>a new number: appended, green</span><span class="up">update</span><span>still there: keeps its element, gets a new index</span><span class="xt">exit</span><span>gone: turns red, fades, removed</span></div>
     <p><b>Why:</b> this is the whole pattern. The same three-way split drives every chart in this course.</p></div>`,
  ],
  chunks: [
    { code: `
      // DATA
      const data = d3.shuffle(d3.range(10));
      console.log(data);

      // in the HTML: <div id="chart"></div>  (here: the live preview)
      const ul = d3.select("#chart").append("ul");
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
        console.log(next);
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
