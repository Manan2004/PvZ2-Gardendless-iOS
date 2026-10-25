System.register(["./application.js"], function (_export, _context) {
  "use strict";

  var Application, canvas, $p, bcr, application;
  function topLevelImport(url) {
    return System["import"](url);
  }
  return {
    setters: [function (_applicationJs) {
      Application = _applicationJs.Application;
    }],
    execute: function () {
      canvas = document.getElementById('GameCanvas');
      $p = canvas.parentElement;
      bcr = $p ? $p.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      canvas.width = bcr.width > 0 ? bcr.width : (window.innerWidth || 1280);
      canvas.height = bcr.height > 0 ? bcr.height : (window.innerHeight || 720);
      application = new Application();
      topLevelImport('cc').then(function (engine) {
        return application.init(engine);
      }).then(function () {
        return application.start();
      })["catch"](function (err) {
        console.error('Cocos bootstrap error:', err);
      });
    }
  };
});