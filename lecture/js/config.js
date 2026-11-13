// Edit these before the lecture.
window.LECTURE = {
  title: "A chart is not a picture",
  subtitle: "Interactive data visualization for the web, with D3.js",
  course: "VizPod",
  author: "Velimir Gasparovic",
  // Shown on the title slide (with a QR code) so students can open the deck themselves.
  publicUrl: "fer-vizpod.pages.dev/lecture",
  date: "2026",

  // Live audience participation (slides "Break" and "Where are you?").
  // Reuses the existing dotsockets Cloudflare worker from ../dotsockets.js.
  dotsockets: {
    post: "https://dotsockets.swvc.workers.dev/points",
    ws: "wss://dotsockets.swvc.workers.dev/ws",
    // The page students open on their phones (lecture/join.html), shown big on screen.
    // When the deck is served over http(s) (Cloudflare Pages, GitHub Pages, ...) this is
    // worked out from the deck's own URL below; this value is only used from file://.
    joinUrl: "fer-vizpod.pages.dev/lecture/join",
  },

  breakMinutes: 15,
};

if (/^https?:$/.test(location.protocol)) {
  LECTURE.dotsockets.joinUrl = location.host + location.pathname.replace(/[^/]*$/, "") + "join";
}
