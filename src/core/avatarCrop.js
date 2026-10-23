
export function cropAvatar(file) {
    return new Promise((resolve, reject) => {
        const imageUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');

            const overlay = document.createElement('div');
            overlay.style.cssText = `
        position:fixed; inset:0; z-index:99999;
        background:rgba(0,0,0,.7);
        display:flex; align-items:center; justify-content:center;
        padding:16px;
      `;

            const panel = document.createElement('div');
            panel.style.cssText = `
        background:white; padding:24px; border-radius:16px;
        width:100%; max-width:380px; text-align:center;
        color:#1e293b; box-sizing:border-box;
      `;

            panel.innerHTML = `
        <h3 style="margin-top:0">Cắt ảnh đại diện</h3>
        <p>Kéo ảnh để chọn vùng cắt</p>
        <div id="crop-area" style="
          width:300px; max-width:100%;
          aspect-ratio:1; margin:auto;
          overflow:hidden; touch-action:none;
          cursor:grab; border:2px solid #6366f1;
          box-sizing:border-box;">
        </div>
        <p>Phóng to / thu nhỏ</p>
        <input id="crop-zoom" type="range"
          min="1" max="3" step="0.01" value="1"
          style="width:100%">
        <div style="margin-top:20px;display:flex;gap:12px">
          <button id="crop-cancel" type="button"
            style="flex:1;padding:12px">Hủy</button>
          <button id="crop-save" type="button"
            style="flex:1;padding:12px;background:#6366f1;
            color:white;border:0;border-radius:8px">
            Cắt và lưu
          </button>
        </div>
      `;

            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            const area = panel.querySelector('#crop-area');
            const preview = document.createElement('canvas');
            preview.width = 300;
            preview.height = 300;
            preview.style.cssText = 'width:100%;height:100%;display:block;';
            area.appendChild(preview);
            const previewCtx = preview.getContext('2d');

            let zoom = 1;
            let offsetX = 0;
            let offsetY = 0;
            let dragging = false;
            let lastX = 0;
            let lastY = 0;
            let finished = false;

            function draw() {
                const baseScale = Math.max(
                    300 / image.width,
                    300 / image.height
                );
                const scale = baseScale * zoom;
                const w = image.width * scale;
                const h = image.height * scale;

                const maxX = Math.max(0, (w - 300) / 2);
                const maxY = Math.max(0, (h - 300) / 2);
                offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
                offsetY = Math.max(-maxY, Math.min(maxY, offsetY));

                previewCtx.clearRect(0, 0, 300, 300);
                previewCtx.drawImage(
                    image,
                    (300 - w) / 2 + offsetX,
                    (300 - h) / 2 + offsetY,
                    w, h
                );
            }

            area.addEventListener('pointerdown', e => {
                dragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                area.setPointerCapture(e.pointerId);
            });

            area.addEventListener('pointermove', e => {
                if (!dragging) return;
                const factor = 300 / area.getBoundingClientRect().width;
                offsetX += (e.clientX - lastX) * factor;
                offsetY += (e.clientY - lastY) * factor;
                lastX = e.clientX;
                lastY = e.clientY;
                draw();
            });

            area.addEventListener('pointerup', () => {
                dragging = false;
            });

            area.addEventListener('pointercancel', () => {
                dragging = false;
            });

            panel.querySelector('#crop-zoom')
                .addEventListener('input', e => {
                    zoom = Number(e.target.value);
                    draw();
                });

            function cleanup() {
                if (finished) return false;
                finished = true;
                overlay.remove();
                URL.revokeObjectURL(imageUrl);
                return true;
            }

            panel.querySelector('#crop-cancel').onclick = () => {
                if (cleanup()) resolve(null);
            };

            panel.querySelector('#crop-save').onclick = () => {
                ctx.clearRect(0, 0, 300, 300);
                ctx.drawImage(preview, 0, 0);

                canvas.toBlob(blob => {
                    if (!blob) {
                        if (cleanup()) reject(new Error('Không thể cắt ảnh.'));
                        return;
                    }

                    const croppedFile = new File(
                        [blob],
                        'avatar.jpg',
                        { type: 'image/jpeg' }
                    );

                    if (cleanup()) resolve(croppedFile);
                }, 'image/jpeg', 0.9);
            };

            draw();
        };

        image.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error('Không thể mở ảnh đã chọn.'));
        };

        image.src = imageUrl;
    });
}
