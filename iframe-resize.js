// Meldt de hoogte van deze pagina aan de parent (de WordPress-pagina met de iframe),
// zodat de iframe nooit meer afkapt. Gebaseerd op
// https://jacobfilipp.com/iframe-height-autoresize-crossdomain/ (MIT, (c) 2019 Jacob Filipp),
// maar met een ResizeObserver i.p.v. MutationObserver: die vangt ook late layoutwijzigingen
// (afbeeldingen, fonts, tabellen na het laden van de JSON, window-resize) en laat de iframe
// ook weer krimpen. De parent-kant staat in README.md.

(function () {
  if (window.parent === window) return; // niet in een iframe: niets te doen

  var lastHeight = 0;

  function sendHeight() {
    // html-element i.p.v. scrollHeight: scrollHeight is nooit kleiner dan de iframe zelf
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({ width: window.innerWidth, height: height }, "*");
  }

  if (window.ResizeObserver) {
    new ResizeObserver(sendHeight).observe(document.documentElement);
  } else {
    setInterval(sendHeight, 300);
  }
  window.addEventListener("load", sendHeight);
  sendHeight();
})();
