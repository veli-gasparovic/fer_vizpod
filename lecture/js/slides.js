// Small per-slide glue: fill in lecture metadata from config.js.
document.querySelectorAll("[data-lecture]").forEach((el) => {
  const v = (window.LECTURE || {})[el.dataset.lecture];
  if (v != null) el.textContent = v;
});
