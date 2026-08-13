// image-upload.js - Handles image upload and OCR functionality

let ocrText = '';
let imageObjectURL = ''; // keep the URL so we can embed it in the message bubble

function handleFileSelect(event) {
    const file = event.target.files[0];
    // Reset so same file can be re-selected
    event.target.value = '';
    if (!file) return;

    if (!file.type.match('image.*')) {
        alert('Please select an image file');
        return;
    }

    const addFileBtn = document.getElementById('add-file');
    addFileBtn.disabled = true;
    addFileBtn.classList.add('processing');

    // Generate object URL immediately for preview
    if (imageObjectURL) URL.revokeObjectURL(imageObjectURL);
    imageObjectURL = URL.createObjectURL(file);

    // Show chip preview inside the input bar straight away
    showImageChip(imageObjectURL, file.name);

    Tesseract.recognize(file, 'eng', {})
        .then(({ data: { text } }) => {
            ocrText = text.trim();
        })
        .catch(err => {
            console.error('OCR Error:', err);
            ocrText = ''; // send without OCR text if it fails
        })
        .finally(() => {
            addFileBtn.disabled = false;
            addFileBtn.classList.remove('processing');
        });
}

function showImageChip(url, name) {
    const container = document.getElementById('attachment-preview');
    // Remove previous image chip if any
    const old = container.querySelector('.attach-chip[data-type="image"]');
    if (old) old.remove();

    const chip = document.createElement('div');
    chip.className = 'attach-chip';
    chip.dataset.type = 'image';

    const thumb = document.createElement('img');
    thumb.src = url;
    thumb.className = 'attach-chip-thumb';
    thumb.alt = name;

    const info = document.createElement('div');
    info.className = 'attach-chip-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'attach-chip-name';
    nameEl.textContent = name.length > 24 ? name.slice(0, 22) + '…' : name;

    const typeEl = document.createElement('span');
    typeEl.className = 'attach-chip-type';
    typeEl.textContent = 'Image';

    info.appendChild(nameEl);
    info.appendChild(typeEl);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'attach-chip-remove';
    removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    removeBtn.onclick = () => {
        chip.remove();
        ocrText = '';
        if (imageObjectURL) { URL.revokeObjectURL(imageObjectURL); imageObjectURL = ''; }
        hideAttachmentPreview();
    };

    chip.appendChild(thumb);
    chip.appendChild(info);
    chip.appendChild(removeBtn);
    container.appendChild(chip);
    container.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
    const addFileBtn = document.getElementById('add-file');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    addFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
});

function hideAttachmentPreview() {
    const container = document.getElementById('attachment-preview');
    if (container && !container.hasChildNodes()) {
        container.style.display = 'none';
    }
}

export function getOcrText() { return ocrText; }
export function getImageURL() { return imageObjectURL; }

export function clearOcrText() {
    ocrText = '';
    imageObjectURL = '';
    const container = document.getElementById('attachment-preview');
    if (container) {
        const chip = container.querySelector('.attach-chip[data-type="image"]');
        if (chip) chip.remove();
        if (!container.hasChildNodes()) container.style.display = 'none';
    }
}
