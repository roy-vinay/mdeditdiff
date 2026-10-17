// Website demo only: stands in for the Mac app's message handlers, so the real preview code can
// talk to the demo window around it (demo/app.js) the same way it talks to the app.
(function () {
  "use strict";
  function host() {
    try { return window.parent && window.parent !== window ? window.parent.mdDemo : null; } catch (e) { return null; }
  }
  // In the browser, scrollIntoView and focus would also scroll the page around the demo.
  // Keep both inside the preview.
  Element.prototype.scrollIntoView = function (o) {
    var r = this.getBoundingClientRect();
    var block = (o && typeof o === "object" && o.block) || "start";
    var dy = block === "center" ? r.top + r.height / 2 - window.innerHeight / 2 : block === "end" ? r.bottom - window.innerHeight : r.top;
    window.scrollTo({ top: Math.max(0, window.scrollY + dy), behavior: (o && o.behavior) || "auto" });
  };
  var focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (o) {
    focus.call(this, Object.assign({}, o || {}, { preventScroll: true }));
  };

  window.webkit = {
    messageHandlers: {
      review: { postMessage: function (m) { var h = host(); if (h) h.message(m); } },
      link: { postMessage: function (href) { var h = host(); if (h) h.link(href); } }
    }
  };
})();
