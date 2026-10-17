// Website demo only: stands in for the Mac app's message handlers, so the real preview code can
// talk to the demo window around it (demo/app.js) the same way it talks to the app.
(function () {
  "use strict";
  function host() {
    try { return window.parent && window.parent !== window ? window.parent.mdDemo : null; } catch (e) { return null; }
  }
  window.webkit = {
    messageHandlers: {
      review: { postMessage: function (m) { var h = host(); if (h) h.message(m); } },
      link: { postMessage: function (href) { var h = host(); if (h) h.link(href); } }
    }
  };
})();
