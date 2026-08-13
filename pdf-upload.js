// pdf-upload.js - Handles PDF upload and text extraction

let pdfText = '';
let pdfFileName = '';

const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function pageToImage(page) {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    return { imageData: canvas.toDataURL('image/png') };
}

async function extractTextFromImage(imageData) {
    try {
        const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {});
        return text.trim();
    } catch {
        return '';
    }
}

async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        if (textContent.items.length > 0) {
            fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
        } else {
            const { imageData } = await pageToImage(page);
            const ocr = await extractTextFromImage(imageData);
            if (ocr) fullText += ocr + '\n\n';
        }
    }
    return fullText.trim() || 'No text could be extracted from the PDF';
}

async function handlePdfSelect(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.match('application/pdf') && !file.name.endsWith('.pdf')) {
        alert('Please select a PDF file');
        return;
    }

    const addPdfBtn = document.getElementById('add-pdf');
    addPdfBtn.disabled = true;
    addPdfBtn.classList.add('processing');

    // Show chip immediately with a loading state
    pdfFileName = file.name;
    showPdfChip(file.name, true);

    try {
        const extractedText = await extractTextFromPdf(file);
        pdfText = extractedText;
        // Update chip to loaded state
        showPdfChip(file.name, false);

        if (!pdfText || pdfText === 'No text could be extracted from the PDF') {
            alert('No text could be extracted from this PDF.');
        }
    } catch (error) {
        console.error('PDF Processing Error:', error);
        alert(error.message || 'Error processing PDF. Please try another file.');
        removePdfChip();
    } finally {
        addPdfBtn.disabled = false;
        addPdfBtn.classList.remove('processing');
    }
}

function showPdfChip(name, loading = false) {
    const container = document.getElementById('attachment-preview');
    const old = container.querySelector('.attach-chip[data-type="pdf"]');
    if (old) old.remove();

    const chip = document.createElement('div');
    chip.className = 'attach-chip';
    chip.dataset.type = 'pdf';

    // PDF icon
    const iconWrap = document.createElement('div');
    iconWrap.className = 'attach-chip-pdf-icon';
    iconWrap.innerHTML = loading
        ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>`
        : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="6" y="20" font-size="5" fill="#ff6b6b" stroke="none" font-weight="bold">PDF</text></svg>`;

    const info = document.createElement('div');
    info.className = 'attach-chip-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'attach-chip-name';
    nameEl.textContent = name.length > 26 ? name.slice(0, 24) + '…' : name;

    const typeEl = document.createElement('span');
    typeEl.className = 'attach-chip-type';
    typeEl.textContent = loading ? 'Extracting text…' : 'PDF Document';

    info.appendChild(nameEl);
    info.appendChild(typeEl);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'attach-chip-remove';
    removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    removeBtn.onclick = removePdfChip;

    chip.appendChild(iconWrap);
    chip.appendChild(info);
    chip.appendChild(removeBtn);
    container.appendChild(chip);
    container.style.display = 'flex';
}

function removePdfChip() {
    pdfText = '';
    pdfFileName = '';
    const container = document.getElementById('attachment-preview');
    const chip = container && container.querySelector('.attach-chip[data-type="pdf"]');
    if (chip) chip.remove();
    if (container && !container.hasChildNodes()) container.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const addPdfBtn = document.getElementById('add-pdf');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    addPdfBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handlePdfSelect);
});

export function getPdfText() { return pdfText; }
export function getPdfFileName() { return pdfFileName; }

export function clearPdfText() {
    removePdfChip();
}
