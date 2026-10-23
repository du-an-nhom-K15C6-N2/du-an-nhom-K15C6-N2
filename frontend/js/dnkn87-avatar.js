// DNKN87 - Doi anh dai dien
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('dnkn87-avatar-input');
    const cropContainer = document.getElementById('dnkn87-crop-container');
    const cropImage = document.getElementById('dnkn87-crop-image');
    const cropBtn = document.getElementById('dnkn87-crop-btn');
    const previewContainer = document.getElementById('dnkn87-preview-container');
    const preview = document.getElementById('dnkn87-preview');
    const saveBtn = document.getElementById('dnkn87-save-btn');
    const status = document.getElementById('dnkn87-avatar-status');

    if (!fileInput || !cropContainer || !cropImage ||
        !cropBtn || !previewContainer || !preview ||
        !saveBtn || !status) {
        return;
    }
    // DNKN87: Chon anh, cat vuong va xem truoc
    let cropper = null;
    let croppedBlob = null;
    let imageUrl = null;

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            status.textContent = 'Chỉ chấp nhận ảnh JPG hoặc PNG.';
            fileInput.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            status.textContent = 'Ảnh không được vượt quá 2 MB.';
            fileInput.value = '';
            return;
        }

        if (typeof Cropper === 'undefined') {
            status.textContent = 'Không tải được công cụ cắt ảnh.';
            return;
        }

        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        if (imageUrl) URL.revokeObjectURL(imageUrl);

        croppedBlob = null;
        previewContainer.style.display = 'none';
        saveBtn.style.display = 'none';

        imageUrl = URL.createObjectURL(file);
        cropImage.src = imageUrl;
        cropContainer.style.display = 'block';

        cropper = new Cropper(cropImage, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
            movable: true,
            zoomable: true,
            scalable: false,
            rotatable: false
        });

        status.textContent = 'Kéo ảnh để chọn vùng cắt vuông.';
    });

    cropBtn.addEventListener('click', () => {
        if (!cropper) {
            status.textContent = 'Vui lòng chọn ảnh trước.';
            return;
        }

        const canvas = cropper.getCroppedCanvas({
            width: 300,
            height: 300,
            imageSmoothingQuality: 'high'
        });

        if (!canvas) {
            status.textContent = 'Không thể cắt ảnh.';
            return;
        }

        canvas.toBlob((blob) => {
            if (!blob) {
                status.textContent = 'Không tạo được ảnh xem trước.';
                return;
            }

            croppedBlob = blob;
            preview.src = canvas.toDataURL('image/png');
            previewContainer.style.display = 'block';
            saveBtn.style.display = 'inline-block';

            status.textContent = 'Đã cắt ảnh. Hãy kiểm tra ảnh xem trước.';
        }, 'image/png');
    });

});
