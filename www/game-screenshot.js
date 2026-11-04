// Capture during Cocos' draw callback, before WebGL clears its drawing buffer.
export async function captureGameScreenshot(saveImage) {
    try {
        const canvas = document.getElementById('GameCanvas');
        if (!canvas) throw new Error('Game canvas is unavailable');
        const cc = await window.System.import('cc');
        const blob = await new Promise((resolve, reject) => {
            cc.director.once(cc.Director.EVENT_AFTER_DRAW, () => {
                try {
                    canvas.toBlob(image => image ? resolve(image) : reject(new Error('PNG capture failed')), 'image/png');
                } catch (error) {
                    reject(error);
                }
            });
        });
        const path = await saveImage(blob, `PvZ2_GE_${Date.now()}.png`);
        return path ? { ok: true, path, size: blob.size } : { ok: false, error: 'canceled' };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}
