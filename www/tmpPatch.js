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
  onWindowFocused: callback => listenWindow('focus', callback),
  onWindowUnfocused: callback => listenWindow('blur', callback),
  saveLevel: (path, content) => levelRequest('readwrite', store => store.put(content, path)),
  loadLevel: path => levelRequest('readonly', store => store.get(path)).then(value => value ?? null),
  removeLevel: path => levelRequest('readwrite', store => store.delete(path)),
  listLevels: () => levelRequest('readonly', store => store.getAllKeys()),
};
