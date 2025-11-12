// renderer.js - Handles UI interactions and Ollama API calls

import { getOcrText, clearOcrText } from './image-upload.js';
import { getPdfText, clearPdfText } from './pdf-upload.js';
import { addCodeBlockHeader } from './codeBlockUtils.js';

const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const chatContainer = document.getElementById('chat-container');

// Get message templates
const userMessageTemplate = document.getElementById('user-message-template');
const assistantMessageTemplate = document.getElementById('assistant-message-template');
const errorMessageTemplate = document.getElementById('error-message-template');

// Configure marked for better code rendering
if (typeof marked !== 'undefined') {
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) {}
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true
    });
}

// Send message on button click
sendBtn.addEventListener('click', sendMessage);

// Send message on Enter key
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const message = input.value.trim();
    const ocrText = getOcrText();
    const pdfText = getPdfText();
    
    // Don't send if there's no message and no extracted text
    if (!message && !ocrText && !pdfText) return;
    
    // Combine message and extracted text if they exist
    let fullMessage = message;
    
    if (ocrText) {
        fullMessage += (fullMessage ? '\n\n' : '') + `[Image content: ${ocrText}]`;
    }
    
    if (pdfText) {
        fullMessage += (fullMessage ? '\n\n' : '') + `[PDF content: ${pdfText}]`;
    }

    // Clear input
    input.value = '';

    // Display user message (show indicators for attachments)
    let messageToShow = message;
    if (ocrText && pdfText) {
        messageToShow = (message || '') + ' 📎📄';
    } else if (ocrText) {
        messageToShow = (message || '') + ' 📎';
    } else if (pdfText) {
        messageToShow = (message || '') + ' 📄';
    }
    
    if (!message && (ocrText || pdfText)) {
        messageToShow = (ocrText ? '📎 Image' : '') + 
                       (ocrText && pdfText ? ' + ' : '') + 
                       (pdfText ? '📄 PDF' : '');
    }
    
    addMessage(messageToShow, 'user');
    
    // Clear the input and extracted text after sending
    input.value = '';
    clearOcrText();
    clearPdfText();

    // Create assistant message container for streaming
    const assistantMessageId = Date.now();
    const messageDiv = assistantMessageTemplate.content.cloneNode(true).firstElementChild;
    messageDiv.id = `msg-${assistantMessageId}`;
    messageDiv.textContent = '|';
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        // Call Ollama API with streaming enabled
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gemma2:2b',
                prompt: fullMessage,  // Use the combined message with OCR text
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            
            // Split by newlines as each line is a separate JSON object
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        fullResponse += json.response;
                        // Render markdown with syntax highlighting
                        if (typeof marked !== 'undefined') {
                            messageDiv.innerHTML = marked.parse(fullResponse);
                            // Apply syntax highlighting and add buttons to code blocks
                            const codeBlocks = messageDiv.querySelectorAll('pre');
                            codeBlocks.forEach((pre, index) => {
                                const codeBlock = pre.querySelector('code');
                                if (codeBlock) {
                                    hljs.highlightElement(codeBlock);
                                    addCodeBlockHeader(pre, codeBlock, index + 1);
                                }
                            });
                        } else {
                            messageDiv.textContent = fullResponse;
                        }
                        
                        // Auto-scroll to bottom
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                } catch (e) {
                    console.error('Error parsing JSON:', e);
                }
            }
        }

    } catch (error) {
        console.error('Error calling Ollama:', error);
        messageDiv.remove();
        addMessage('Error: Could not connect to Ollama. Make sure Ollama is running.', 'error');
    }
}

function addMessage(text, type, isLoading = false) {
    const messageId = Date.now();
    let messageDiv;
    
    // Clone the appropriate template based on type
    if (type === 'user') {
        messageDiv = userMessageTemplate.content.cloneNode(true).firstElementChild;
    } else if (type === 'error') {
        messageDiv = errorMessageTemplate.content.cloneNode(true).firstElementChild;
    } else {
        messageDiv = assistantMessageTemplate.content.cloneNode(true).firstElementChild;
    }
    
    messageDiv.id = `msg-${messageId}`;
    
    if (isLoading) {
        messageDiv.classList.add('loading');
    }
    
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return messageId;
}

function removeMessage(messageId) {
    const message = document.getElementById(`msg-${messageId}`);
    if (message) {
        message.remove();
    }
}

// Code block handling has been moved to codeBlockUtils.js
