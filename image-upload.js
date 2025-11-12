// image-upload.js - Handles image upload and OCR functionality

// Store OCR text in a variable
let ocrText = '';

// Function to handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.match('image.*')) {
        alert('Please select an image file');
        return;
    }

    // Show loading state
    const addFileBtn = document.getElementById('add-file');
    addFileBtn.disabled = true;
    addFileBtn.classList.add('processing');

    // Create FormData and append the file
    const formData = new FormData();
    formData.append('file', file);

    // Call OCR API (using Tesseract.js)
    Tesseract.recognize(
        file,
        'eng', // Language code for English
        { logger: m => console.log(m) } // Optional: log progress
    ).then(({ data: { text } }) => {
        // Store the extracted text
        ocrText = text.trim();
        console.log('Extracted text:', ocrText);
        
        // Create and display image preview
        const preview = createImagePreview(file);
        const previewContainer = document.getElementById('image-preview');
        previewContainer.innerHTML = '';
        previewContainer.appendChild(preview);
        previewContainer.style.display = 'block';
        
        // Update input placeholder to show image is ready
        document.getElementById('input').placeholder = 'Type your message...'; 
    }).catch(err => {
        console.error('OCR Error:', err);
        alert('Error processing image. Please try another image.');
    }).finally(() => {
        // Reset button state
        addFileBtn.disabled = false;
        addFileBtn.classList.remove('processing');
    });
}

// Create image preview element
function createImagePreview(file) {
    const preview = document.createElement('div');
    preview.className = 'image-preview-item';
    
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = 'Uploaded image';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = () => {
        preview.remove();
        ocrText = '';
        document.getElementById('input').placeholder = 'Enter your message';
        if (!document.querySelector('.image-preview-item')) {
            document.getElementById('image-preview').style.display = 'none';
        }
    };
    
    preview.appendChild(img);
    preview.appendChild(removeBtn);
    return preview;
}

// Initialize the file input
document.addEventListener('DOMContentLoaded', () => {
    const addFileBtn = document.getElementById('add-file');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Handle plus button click
    addFileBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle file selection
    fileInput.addEventListener('change', handleFileSelect);
});

// Function to get the OCR text (to be called when sending the message)
function getOcrText() {
    return ocrText;
}

// Function to clear the OCR text (after sending)
function clearOcrText() {
    ocrText = '';
    const previewContainer = document.getElementById('image-preview');
    previewContainer.innerHTML = '';
    previewContainer.style.display = 'none';
}

export { getOcrText, clearOcrText };
