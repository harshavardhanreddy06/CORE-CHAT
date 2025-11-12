// pdf-upload.js - Handles PDF upload and text extraction with OCR support

// Store extracted text in a variable
let pdfText = '';

// Initialize PDF.js worker
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Function to convert PDF page to image
async function pageToImage(page) {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    return {
        imageData: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
    };
}

// Function to extract text from image using Tesseract
async function extractTextFromImage(imageData) {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imageData,
            'eng',
            { 
                logger: m => console.log(m),
                // Optimize for document text recognition
                tessedit_pageseg_mode: 6, // Assume a single uniform block of text
                tessedit_ocr_engine_mode: 3, // Default OCR engine mode with LSTM
                preserve_interword_spaces: '1' // Preserve spaces between words
            }
        );
        return text.trim();
    } catch (error) {
        console.error('Tesseract error:', error);
        return '';
    }
}

// Function to extract text from PDF
async function extractTextFromPdf(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        // Try to extract text directly first
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            if (textContent.items.length > 0) {
                // If text is selectable, use it directly
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n\n';
            } else {
                // If no selectable text, use OCR on the page image
                console.log(`Page ${i} has no selectable text, using OCR...`);
                const { imageData } = await pageToImage(page);
                const ocrText = await extractTextFromImage(imageData);
                if (ocrText) {
                    fullText += ocrText + '\n\n';
                }
            }
        }
        
        return fullText.trim() || 'No text could be extracted from the PDF';
    } catch (error) {
        console.error('Error processing PDF:', error);
        throw new Error('Failed to process PDF. The file might be corrupted or password protected.');
    }
}

// Function to handle file selection
async function handlePdfSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if file is a PDF
    if (!file.type.match('application/pdf') && !file.name.endsWith('.pdf')) {
        alert('Please select a PDF file');
        return;
    }

    const addPdfBtn = document.getElementById('add-pdf');
    addPdfBtn.disabled = true;
    addPdfBtn.classList.add('processing');

    try {
        // Extract text from PDF
        const extractedText = await extractTextFromPdf(file);
        pdfText = extractedText;
        
        // Create and display PDF preview
        const preview = createPdfPreview(file);
        const previewContainer = document.getElementById('pdf-preview');
        previewContainer.innerHTML = '';
        previewContainer.appendChild(preview);
        previewContainer.style.display = 'block';
        
        // Update input placeholder
        document.getElementById('input').placeholder = 'Type your message...';
        // Update input placeholder if text was extracted
        if (pdfText && pdfText !== 'No text could be extracted from the PDF') {
            document.getElementById('input').placeholder = 'Type your message... ';
        } else {
            alert('No text could be extracted from the PDF. Please try another file.');
        }
    } catch (error) {
        console.error('PDF Processing Error:', error);
        alert(error.message || 'Error processing PDF. Please try another file.');
    } finally {
        addPdfBtn.disabled = false;
        addPdfBtn.classList.remove('processing');
    }
}

// Create PDF preview element
function createPdfPreview(file) {
    const preview = document.createElement('div');
    preview.className = 'pdf-preview-item';
    
    const icon = document.createElement('div');
    icon.className = 'pdf-icon';
    icon.innerHTML = '📄';
    
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-pdf';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = () => {
        preview.remove();
        pdfText = '';
        document.getElementById('input').placeholder = 'Enter your message';
        if (!document.querySelector('.pdf-preview-item')) {
            document.getElementById('pdf-preview').style.display = 'none';
        }
    };
    
    preview.appendChild(icon);
    preview.appendChild(fileName);
    preview.appendChild(removeBtn);
    return preview;
}

// Initialize the PDF file input
document.addEventListener('DOMContentLoaded', () => {
    const addPdfBtn = document.getElementById('add-pdf');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Handle PDF button click
    addPdfBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle file selection
    fileInput.addEventListener('change', handlePdfSelect);
});

// Function to get the extracted PDF text
function getPdfText() {
    return pdfText;
}

// Function to clear the PDF text
function clearPdfText() {
    pdfText = '';
    const previewContainer = document.getElementById('pdf-preview');
    previewContainer.innerHTML = '';
    previewContainer.style.display = 'none';
}

export { getPdfText, clearPdfText };
