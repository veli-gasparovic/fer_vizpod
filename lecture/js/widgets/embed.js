/* embed: a live web page inside a slide. data-opt {"src": "...", "label": "...", "href"?: "...", "video"?: true}.
   video: a 16:9 YouTube player (no sandbox, needs a referrer); it pauses when you leave the slide.
   The iframe only loads when the slide is first entered. A click on the frame hands it the keyboard;
   a click anywhere outside gives the arrow keys back to the deck. */
(function () {
  Deck.css("embed", `
    .emb { position: relative; height: 100%; display: flex; flex-direction: column; gap: 0.35rem; min-height: 0; }
    .emb-frame { position: relative; flex: 1 1 auto; min-height: 0; border: 1px solid var(--rule); border-radius: 0.5rem; overflow: hidden; background: #fff; }
    .emb iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .emb-bar { display: flex; align-items: baseline; gap: 0.8rem; font: 0.5rem var(--font-mono); color: var(--muted); }
    .emb-bar a { color: var(--ink-2); }
    .emb-bar .emb-key { margin-left: auto; }
    .emb.inside .emb-frame { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent); }
    .emb.inside .emb-key { color: var(--accent); }
    .emb.video .emb-frame { flex: 0 1 auto; align-self: center; height: calc(100% - 1.2rem); aspect-ratio: 16 / 9; max-width: 100%; background: #000; }
    .emb.video .emb-bar { align-self: center; }
  `);

  Deck.widget("embed", {
    mount(el) {
      const o = Deck.opts(el);
      const href = o.href || o.src;
      const attrs = o.video
        ? `referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen`
        : `referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"`;
      el.innerHTML = `<div class="emb${o.video ? " video" : ""}">
        <div class="emb-frame"><iframe title="${o.label || o.src}" loading="lazy" ${attrs}></iframe></div>
        <div class="emb-bar"><a href="${href}" target="_blank" rel="noopener">${o.video ? o.label : href.replace(/^https?:\/\//, "")} ↗</a>
          <span class="emb-key">${o.video ? "click ▶ to play" : "click the page to use it"} · click outside it for the arrow keys</span></div></div>`;
      const root = el.querySelector(".emb"), frame = el.querySelector("iframe");
      // the iframe takes keyboard focus when clicked; show that state, and hand focus back on any outside click
      window.addEventListener("blur", () => { if (document.activeElement === frame) root.classList.add("inside"); });
      document.addEventListener("pointerdown", (e) => {
        if (!root.contains(e.target) && document.activeElement === frame) { frame.blur(); window.focus(); }
        root.classList.remove("inside");
      });
      // the player ignores (and throws on) commands sent before it is ready
      let loadedAt = 0;
      frame.addEventListener("load", () => { if (frame.src) loadedAt = Date.now(); });
      // video: keep the link bar exactly as wide as the 16:9 frame
      const fitBar = () => { if (o.video) el.querySelector(".emb-bar").style.width = el.querySelector(".emb-frame").offsetWidth + "px"; };
      return {
        enter() { if (!frame.src) frame.src = o.src; fitBar(); },
        resize: fitBar,
        leave() {
          // YouTube's iframe API (enablejsapi=1 in the src) accepts commands over postMessage
          if (o.video && loadedAt && Date.now() - loadedAt > 2000) frame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: "" }), "*");
          root.classList.remove("inside");
        },
      };
    },
  });
})();
