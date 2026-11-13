(function () {
  'use strict';

  // Fix: Cocos Engine screenToWorld NaN fallback on mobile touch
  window.patchScreenToWorld = function (ccEngine) {
    try {
      var cc = ccEngine || window.cc;
      if (!cc || !cc.Camera) {
        console.warn('[TouchFix] cc or cc.Camera not available to patch');
        return;
      }
      var CameraProto = cc.Camera.prototype;
      var origScreenToWorld = CameraProto.screenToWorld;

      if (!origScreenToWorld) {
        CameraProto = (cc._camera || cc).Camera;
        if (CameraProto && CameraProto.prototype) {
          origScreenToWorld = CameraProto.prototype.screenToWorld;
        }
      }

      if (origScreenToWorld) {
        CameraProto.screenToWorld = function (screenPos, out) {
          if (!screenPos || isNaN(screenPos.x) || isNaN(screenPos.y)) {
            return out || new cc.Vec3(0, 0, 0);
          }

          var result = origScreenToWorld.call(this, screenPos, out);

          if (isNaN(result.x) || isNaN(result.y)) {
            try {
              var view = cc.view;
              if (view) {
                var visibleSize = view.getVisibleSize();
                var designSize = view.getDesignResolutionSize();
                var canvasSize = view.getFrameSize();

                if (visibleSize && designSize && canvasSize &&
                    visibleSize.width > 0 && visibleSize.height > 0 &&
                    canvasSize.width > 0 && canvasSize.height > 0) {

                  var scaleX = designSize.width / canvasSize.width;
                  var scaleY = designSize.height / canvasSize.height;
                  var cx = screenPos.x * scaleX;
                  var cy = (canvasSize.height - screenPos.y) * scaleY;

                  out = out || new cc.Vec3();
                  out.x = cx;
                  out.y = cy;
                  out.z = 0;
                }
              }
            } catch (e) {
              console.error('[TouchFix] Fallback failed:', e);
            }

            if (isNaN(out.x)) out.x = 0;
            if (isNaN(out.y)) out.y = 0;
          }

          return result;
        };

        console.log('[TouchFix] Camera.screenToWorld patched successfully');
      }
    } catch (e) {
      console.error('[TouchFix] Failed to patch:', e);
    }
  };

  // Poll in case engine is loaded without calling patchScreenToWorld
  var pollInterval = setInterval(function () {
    if (window.cc && window.cc.Camera) {
      clearInterval(pollInterval);
      window.patchScreenToWorld(window.cc);
    }
  }, 100);
})();

const electron = {
  isFullscreen: () => {
    return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  },
  enterFullscreen: (element = document.documentElement) => {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  },
  exitFullscreen: () => {
    if (electron.isFullscreen() && document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  },
  ipcRenderer: {
    send: function (channel, ...data) {
      switch (channel) {
        case "e_isFullScreen":
          return electron.isFullscreen();
        case "e_fullScreen":
          return electron.isFullscreen() ? electron.exitFullscreen() : electron.enterFullscreen();
        case "e_window":
          return electron.exitFullscreen();
        case "e_openURL":
          return electron.shell.openExternal(data[0]);
      }
    },
    sendSync: function (channel, data) {
      switch (channel) {
        case "e_isFullScreen":
          return electron.isFullscreen();
      }
    },
    on: function (channel, callback) {
    }
  },
  shell: {
    openExternal: function (url) {
      return window.open(url, '_blank');
    }
  }
};

window.electron = electron;

// Safe IndexedDB initialization with fallbacks
const levelDatabase = new Promise((resolve) => {
  try {
    if (typeof indexedDB === 'undefined') {
      console.warn('[DB] indexedDB is undefined');
      resolve(null);
      return;
    }
    const request = indexedDB.open('pvzge-github-levels', 1);
    request.onupgradeneeded = () => {
      try { request.result.createObjectStore('levels'); } catch (_) {}
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => {
      console.warn('[DB] indexedDB open error:', e);
      resolve(null);
    };
  } catch (e) {
    console.warn('[DB] indexedDB exception:', e);
    resolve(null);
  }
});

async function levelRequest(mode, operation) {
  try {
    const database = await levelDatabase;
    if (!database) return null;
    return new Promise((resolve, reject) => {
      try {
        const transaction = database.transaction('levels', mode);
        const request = operation(transaction.objectStore('levels'));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (_) {
    return null;
  }
}

const listenWindow = (event, callback) => {
  window.addEventListener(event, callback);
  return () => window.removeEventListener(event, callback);
};

window.electronAPI = {
  center: () => window.moveTo((screen.availWidth - window.outerWidth) / 2, (screen.availHeight - window.outerHeight) / 2),
  setSize: (width, height) => window.resizeTo(width, height),
  quit: () => window.close(),
  openDevTools: () => false,
  closeDevTools: () => false,
  toggleDevTools: () => false,
  isFullScreen: () => Boolean(electron.isFullscreen()),
  fullScreen: () => electron.enterFullscreen(),
  window: () => electron.exitFullscreen(),
  openUrl: url => electron.shell.openExternal(url),
  getCurrentResolutionSync: () => '',
  captureScreenshot: async () => {
    try {
      const { captureGameScreenshot } = await import('./game-screenshot.js');
      return captureGameScreenshot(async (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return filename;
      });
    } catch (e) {
      console.warn('[Screenshot] capture error:', e);
      return '';
    }
  },
  onWindowFocused: callback => listenWindow('focus', callback),
  onWindowUnfocused: callback => listenWindow('blur', callback),
  saveLevel: (path, content) => levelRequest('readwrite', store => store.put(content, path)),
  loadLevel: path => levelRequest('readonly', store => store.get(path)).then(value => value ?? null),
  removeLevel: path => levelRequest('readwrite', store => store.delete(path)),
  listLevels: () => levelRequest('readonly', store => store.getAllKeys()),
  checkRemoteUpdate: (lang) => { console.log('[UpdateCheck] remote update check invoked for:', lang); return Promise.resolve(null); },
  openMarkdownWindow: (filePath, title, tag) => window.open('https://github.com/Manan2004/PvZ2-Gardendless-iOS#readme', '_blank'),
  closeUpdateWindow: () => {},
  closeMusicPackWindow: () => {},
  openMusicPackWindow: () => {},
  isMarkdownWindowOpen: () => Promise.resolve(false),
  isGithubWindowOpen: () => Promise.resolve(false),
  openKeybindWindow: () => {},
  listMusicPacks: () => Promise.resolve([]),
  getMusicPackAudioUrl: () => '',
  onMusicPackChanged: (callback) => () => {},
  getVersionInfo: () => Promise.resolve({ Version: "v0.16.26", InsideVersion: "0.16.26" }),
  getMassageSync: () => '',
  getAllResolutionsSync: () => [],
};

// Wrap in Proxy to guarantee no missing Electron API method will ever throw or break scene transitions
window.electronAPI = new Proxy(window.electronAPI, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    return (...args) => {
      console.log(`[ElectronAPI Mock] No-op call for: ${String(prop)}`, args);
      return Promise.resolve(null);
    };
  }
});

// Audio extension compatibility fallback (.m4a <-> .mp3) and version intercept
(function () {
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = async function (input, init) {
      // Intercept upstream gameinfo update checks so iOS port stays on 0.16.8 without false alerts
      try {
        var urlStr = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
        if (urlStr && urlStr.indexOf('pvzge.com/jsons/gameinfo.json') !== -1) {
          return new Response(JSON.stringify({
            Name: "PvZ2_Prerelease_GitHubLevels",
            Version: "v0.16.26",
            InsideVersion: "0.16.26",
            Updates: [
              {
                en: "iOS port v0.16.26 up to date.",
                zh: "iOS 移植版 v0.16.26 已是最新版本。"
              }
            ]
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (_) {}

      let resolvedInput = input;
      if (typeof input === 'string' && input.endsWith('.m4a')) {
        resolvedInput = input.slice(0, -4) + '.mp3';
      } else if (input instanceof Request && input.url.endsWith('.m4a')) {
        resolvedInput = new Request(input.url.slice(0, -4) + '.mp3', input);
      }
      try {
        const response = await origFetch.call(this, resolvedInput, init);
        if (!response.ok && resolvedInput !== input) {
          return origFetch.call(this, input, init);
        }
        return response;
      } catch (err) {
        if (resolvedInput !== input) {
          return origFetch.call(this, input, init);
        }
        throw err;
      }
    };
  }

  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.open) {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (typeof url === 'string' && url.endsWith('.m4a')) {
        url = url.slice(0, -4) + '.mp3';
      }
      return origOpen.apply(this, arguments);
    };
  }
})();

// Universal Safe Lane Proxy: Prevents out-of-bounds row crashes (lanes < 0 or > 4)
// whenever plants/zombies/projectiles query UpperLane or LowerLane.
(function () {
  var dummyNode = null;
  function getDummyNode() {
    if (!dummyNode && window.cc && window.cc.Node) {
      dummyNode = new window.cc.Node('DummyLaneNode');
    }
    return dummyNode || {};
  }

  var returnEmptyArr = function () { return []; };
  var returnFalse = function () { return false; };
  var noop = function () {};

  var safeLaneProxy = new Proxy({}, {
    get: function (target, prop) {
      if (prop === 'UpperLane' || prop === 'LowerLane') return safeLaneProxy;
      if (prop === 'LaneIndex') return -1;
      if (prop === 'isInLawn' || prop === 'hurrikaleBlowing' || prop === 'readHaveDeepWater') return returnFalse;
      if (prop === 'isSea') return false;
      if (prop === 'midY' || prop === 'floorY' || prop === 'hurrikaleDuration' || prop === 'meltCountdown' || prop === 'zombieSpawnOffset') return 0;
      if (prop === 'zombiePool' || prop === 'hypnoZombiePool' || prop === 'tombPool' || prop === 'tntPool' || prop === 'icecubePool' || prop === 'prjPool' || prop === 'plantPool' || prop === 'dinosaurPool' || prop === 'gumPool') {
        return returnEmptyArr;
      }
      if (prop === 'iceTiles' || prop === 'plants' || prop === 'zombies' || prop === 'hypnoZombies' || prop === 'dinosaurs' || prop === 'gums' || prop === 'tombStones' || prop === 'plantProjectiles' || prop === 'laneLnCs') {
        return [];
      }
      if (prop === 'prjLayer' || prop === 'tileLayer' || prop === 'icetileLayer' || prop === 'tombLayer' || prop === 'glitterLayer' || prop === 'dinoLayer' || prop === 'zombieLayer' || prop === 'hypnoZombieLayer' || prop === 'foodPlantLayer' || prop === 'node') {
        return getDummyNode();
      }
      if (typeof prop === 'string' && (prop.startsWith('add') || prop.startsWith('delete') || prop.startsWith('clear') || prop.startsWith('set'))) {
        return noop;
      }
      if (prop === 'spawnMower') return function () { return Promise.resolve(null); };
      if (prop === 'chillWind') return function () { return { PSD: null }; };
      if (prop in target) return target[prop];
      return returnEmptyArr;
    }
  });

  window.__dummyLane = safeLaneProxy;
})();
