// Audio pool from the 0.16.0 Electron renderer, optimized for low-end mobile WebKit.
const AUDIO_POOL_SIZE = 18;
const DEFAULT_VOLUME = 0.9;

export class AudioEngine {
    constructor(manifest, audioRoot) {
        this.audioRoot = audioRoot;
        this.manifest = manifest;
        this.pool = [];
        this.nextId = 1;
        this.byId = new Map();
        this.isSuspended = false;
    }

    async init() {
        for (let i = 0; i < AUDIO_POOL_SIZE; i++) {
            const el = new Audio();
            try { el.preload = 'auto'; } catch (_) {}
            try { el.preservesPitch = false; } catch (_) {}
            try { el.webkitPreservesPitch = false; } catch (_) {}
            this.pool.push({
                el: el,
                id: null,
                playing: false,
                fading: false,
                speed: 1,
                volume: DEFAULT_VOLUME,
                restartBeforeEnd: null,
                restartTimer: null,
                fadeTimer: null,
                wasPlayingBeforeSuspend: false,
            });
        }
    }

    nameToPath(name) {
        return this.manifest[name] ?? null;
    }

    getFreeSlot() {
        return this.pool.find(s => !s.playing) || null;
    }

    play(name, speed = 1, volume = DEFAULT_VOLUME) {
        const slot = this.getFreeSlot();
        if (!slot) {
            console.warn('[audio] pool exhausted, drop:', name);
            return null;
        }

        const relPath = this.nameToPath(name);
        if (!relPath) {
            console.warn('[audio] unknown clip:', name);
            return null;
        }
        const src = new URL(relPath.split('/').map(encodeURIComponent).join('/'), this.audioRoot).href;

        const el = slot.el;
        if (slot.restartTimer) { clearTimeout(slot.restartTimer); slot.restartTimer = null; }
        if (slot.fadeTimer) { clearInterval(slot.fadeTimer); slot.fadeTimer = null; }

        el.pause();
        if (el.src === src) {
            try { el.currentTime = 0; } catch (_) {}
        } else {
            el.src = src;
        }
        el.playbackRate = speed;
        el.preservesPitch = false;
        el.volume = Math.min(1, Math.max(0, volume));

        slot.id = this.nextId++;
        slot.playing = true;
        slot.fading = false;
        slot.speed = speed;
        slot.volume = volume;
        slot.restartBeforeEnd = null;
        slot.wasPlayingBeforeSuspend = false;

        this.byId.set(slot.id, slot);

        el.onended = () => this.releaseSlot(slot);
        el.onerror = () => {
            console.error('[audio] load error:', src);
            this.releaseSlot(slot);
        };

        if (this.isSuspended) {
            slot.wasPlayingBeforeSuspend = true;
            return slot.id;
        }

        el.play().catch(err => {
            console.error('[audio] play failed:', err);
            this.releaseSlot(slot);
        });

        return slot.id;
    }

    releaseSlot(slot) {
        if (!slot.playing) return;
        slot.playing = false;
        slot.fading = false;
        slot.wasPlayingBeforeSuspend = false;
        slot.restartBeforeEnd = null;

        if (slot.restartTimer) {
            clearTimeout(slot.restartTimer);
            slot.restartTimer = null;
        }
        if (slot.fadeTimer) {
            clearInterval(slot.fadeTimer);
            slot.fadeTimer = null;
        }

        const el = slot.el;
        el.onended = null;
        el.onerror = null;
        el.pause();
        el.removeAttribute('src');
        el.load();

        if (slot.id !== null) this.byId.delete(slot.id);
        slot.id = null;
    }

    getSlot(id) {
        return this.byId.get(id) || null;
    }

    setVolume(id, volume) {
        const slot = this.getSlot(id);
        if (!slot) return;
        slot.volume = Math.min(1, Math.max(0, volume));
        slot.el.volume = slot.volume;
    }

    setPlaying(id, playing) {
        const slot = this.getSlot(id);
        if (!slot) return;
        if (playing) {
            if (!this.isSuspended) {
                slot.el.play().catch(() => { });
            } else {
                slot.wasPlayingBeforeSuspend = true;
            }
        } else {
            slot.wasPlayingBeforeSuspend = false;
            slot.el.pause();
        }
    }

    seek(id, seconds) {
        const slot = this.getSlot(id);
        if (!slot) return;
        const el = slot.el;
        const target = Math.max(0, seconds);

        const apply = () => {
            if (el.seekable.length > 0) {
                el.currentTime = Math.min(target, el.duration || target);
            } else {
                console.warn('[audio] seekable still empty');
            }
        };

        if (el.readyState >= 1 && el.seekable.length > 0) {
            apply();
        } else {
            el.addEventListener('loadedmetadata', apply, { once: true });
        }
    }

    getPosition(id) {
        const slot = this.getSlot(id);
        if (!slot) return [0, null];
        const el = slot.el;
        const total = isFinite(el.duration) ? el.duration : null;
        return [el.currentTime, total];
    }

    getDuration(id) {
        const slot = this.getSlot(id);
        if (!slot) return null;
        return isFinite(slot.el.duration) ? slot.el.duration : null;
    }

    fadeOut(id, durationMs) {
        const slot = this.getSlot(id);
        if (!slot || slot.fading) return;
        slot.fading = true;

        const startVol = slot.el.volume;
        const steps = 30;
        const stepMs = durationMs / steps;
        let i = 0;

        slot.fadeTimer = setInterval(() => {
            i++;
            const v = startVol * (1 - i / steps);
            slot.el.volume = Math.max(0, v);
            if (i >= steps) {
                clearInterval(slot.fadeTimer);
                slot.fadeTimer = null;
                this.destroy(id);
            }
        }, stepMs);
    }

    _scheduleRestart(slot) {
        if (!slot.playing || slot.restartBeforeEnd === null || this.isSuspended) return;
        if (slot.restartTimer) {
            clearTimeout(slot.restartTimer);
            slot.restartTimer = null;
        }
        const schedule = () => {
            if (!slot.playing || slot.restartBeforeEnd === null || this.isSuspended) return;
            const el = slot.el;
            if (!isFinite(el.duration)) {
                slot.restartTimer = setTimeout(schedule, 100);
                return;
            }
            const target = el.duration - slot.restartBeforeEnd / slot.speed;
            const remaining = (target - el.currentTime) * 1000 / slot.speed;
            if (remaining <= 0) {
                el.currentTime = 0;
                schedule();
            } else {
                slot.restartTimer = setTimeout(() => {
                    if (!slot.playing || this.isSuspended) return;
                    el.currentTime = 0;
                    schedule();
                }, remaining);
            }
        };
        schedule();
    }

    setRestartBeforeEnd(id, beforeMs) {
        const slot = this.getSlot(id);
        if (!slot) return;
        slot.restartBeforeEnd = beforeMs / 1000;
        this._scheduleRestart(slot);
    }

    destroy(id) {
        const slot = this.getSlot(id);
        if (!slot) return;
        this.releaseSlot(slot);
    }

    pauseAll() {
        if (this.isSuspended) return;
        this.isSuspended = true;
        for (const slot of this.pool) {
            if (slot.playing) {
                slot.wasPlayingBeforeSuspend = true;
                if (slot.restartTimer) {
                    clearTimeout(slot.restartTimer);
                    slot.restartTimer = null;
                }
                try {
                    slot.el.pause();
                } catch (_) {}
            } else {
                slot.wasPlayingBeforeSuspend = false;
            }
        }
    }

    resumeAll() {
        if (!this.isSuspended) return;
        this.isSuspended = false;
        for (const slot of this.pool) {
            if (slot.wasPlayingBeforeSuspend && slot.playing) {
                slot.wasPlayingBeforeSuspend = false;
                try {
                    slot.el.play().catch(() => {});
                } catch (_) {}
                if (slot.restartBeforeEnd !== null) {
                    this._scheduleRestart(slot);
                }
            }
        }
    }

    cleanupFinished() {
        let count = 0;
        for (const slot of this.pool) {
            if (!slot.playing && slot.el.src) {
                slot.el.removeAttribute('src');
                slot.el.load();
                if (slot.id !== null) this.byId.delete(slot.id);
                slot.id = null;
                count++;
            }
        }
        return count;
    }

    listClips() {
        return Object.keys(this.manifest);
    }
}

export async function initializeGameAudio() {
    try {
        const audioRoot = new URL('audio/', document.baseURI);
        const response = await fetch(new URL('manifest.json', audioRoot));
        if (!response.ok) throw new Error(`Audio manifest HTTP ${response.status}`);
        const engine = new AudioEngine(await response.json(), audioRoot);
        await engine.init();
        window.audioEngine = engine;

        // Automatically pause all audio when app is hidden or backgrounded, resume when active
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                engine.pauseAll();
            } else {
                engine.resumeAll();
            }
        });
        window.addEventListener('pagehide', () => engine.pauseAll());
        window.addEventListener('pageshow', () => engine.resumeAll());
        window.addEventListener('blur', () => {
            if (document.hidden) {
                engine.pauseAll();
            }
        });
        window.addEventListener('focus', () => {
            if (!document.hidden) {
                engine.resumeAll();
            }
        });
    } catch (e) {
        console.warn('[Audio] Failed to load audio manifest:', e);
        window.audioEngine = {
            play: () => null,
            stop: () => {},
            setVolume: () => {},
            pause: () => {},
            resume: () => {},
            destroy: () => {},
            seek: () => {},
            fadeOut: () => {},
            setPlaying: () => {},
            setRestartBeforeEnd: () => {},
            getPosition: () => [0, null],
            getDuration: () => null,
            cleanupFinished: () => 0,
            listClips: () => [],
            pauseAll: () => {},
            resumeAll: () => {}
        };
    }
}
