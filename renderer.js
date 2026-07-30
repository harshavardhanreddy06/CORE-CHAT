// renderer.js - Handles UI interactions and Ollama API calls

import { getOcrText, clearOcrText } from './image-upload.js';
import { getPdfText, clearPdfText } from './pdf-upload.js';
import { addCodeBlockHeader } from './codeBlockUtils.js';

const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const chatContainer = document.getElementById('chat-container');
const modelSelect = document.getElementById('model-select');
const refreshBtn = document.getElementById('refresh-models');
const statusDot = document.getElementById('model-status');
const statusLabel = document.getElementById('model-status-label');

// Get message templates
const userMessageTemplate = document.getElementById('user-message-template');
const assistantMessageTemplate = document.getElementById('assistant-message-template');
const errorMessageTemplate = document.getElementById('error-message-template');

// Ollama base URL
const OLLAMA_BASE = 'http://localhost:11434';

// ── IPC bridge (Electron main ↔ renderer) ─────────────────────────────────────
// nodeIntegration is enabled so we can use require() directly
const { ipcRenderer } = require('electron');

// Listen for Ollama status pushed by main process
ipcRenderer.on('ollama-status', (_event, state) => {
    setStatus(state);
    if (state === 'online') {
        // Ollama just came up — load the model list automatically
        loadModels();
    } else if (state === 'loading') {
        modelSelect.innerHTML = '<option value="" disabled selected>Starting Ollama…</option>';
        setStatusLabel('Starting Ollama…');
    } else if (state === 'offline') {
        modelSelect.innerHTML = '<option value="" disabled selected>Ollama not reachable</option>';
        setStatusLabel('Ollama offline');
    }
});

// ── Configure marked ──────────────────────────────────────────────────────────
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

// ── Model Loader ──────────────────────────────────────────────────────────────
async function loadModels() {
    modelSelect.innerHTML = '<option value="" disabled selected>Loading…</option>';
    setStatus('loading');

    try {
        const res = await fetch(`${OLLAMA_BASE}/api/tags`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const models = data.models || [];

        if (models.length === 0) {
            modelSelect.innerHTML = '<option value="" disabled selected>No models found</option>';
            setStatus('offline');
            return;
        }

        modelSelect.innerHTML = '';
        models.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            if (i === 0) opt.selected = true;
            modelSelect.appendChild(opt);
        });

        setStatus('online');
    } catch (err) {
        console.error('Could not reach Ollama:', err);
        modelSelect.innerHTML = '<option value="" disabled selected>Ollama not running</option>';
        setStatus('offline');
    }
}

function setStatus(state) {
    statusDot.className = 'status-dot';
    if (state === 'online')  statusDot.classList.add('online');
    else if (state === 'offline') statusDot.classList.add('offline');
    else statusDot.classList.add('loading');

    const labels = { online: 'Ollama connected', offline: 'Ollama not reachable', loading: 'Starting Ollama…' };
    statusDot.title = labels[state] || '';
    setStatusLabel(labels[state] || '');

}

function setStatusLabel(text) {
    if (statusLabel) statusLabel.textContent = text;
}

function getSelectedModel() {
    return modelSelect.value || null;
}

// Load models on startup and on refresh button click
loadModels();
refreshBtn.addEventListener('click', loadModels);

// ── Send message ──────────────────────────────────────────────────────────────
sendBtn.addEventListener('click', sendMessage);

input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const message = input.value.trim();
    const ocrText = getOcrText();
    const pdfText = getPdfText();

    if (!message && !ocrText && !pdfText) return;

    const selectedModel = getSelectedModel();
    if (!selectedModel) {
        addMessage('Please select a model first. Make sure Ollama is running and has at least one model installed.', 'error');
        return;
    }

    // Combine message and extracted text
    let fullMessage = message;
    if (ocrText) fullMessage += (fullMessage ? '\n\n' : '') + `[Image content: ${ocrText}]`;
    if (pdfText) fullMessage += (fullMessage ? '\n\n' : '') + `[PDF content: ${pdfText}]`;

    // Clear input
    input.value = '';

    // Display user message (show indicators for attachments)
    let messageToShow = message;
    if (ocrText && pdfText)   messageToShow = (message || '') + ' 📎📄';
    else if (ocrText)          messageToShow = (message || '') + ' 📎';
    else if (pdfText)          messageToShow = (message || '') + ' 📄';

    if (!message && (ocrText || pdfText)) {
        messageToShow = (ocrText ? '📎 Image' : '') +
                        (ocrText && pdfText ? ' + ' : '') +
                        (pdfText ? '📄 PDF' : '');
    }

    addMessage(messageToShow, 'user');

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
        const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                prompt: fullMessage,
                stream: true
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        fullResponse += json.response;
                        if (typeof marked !== 'undefined') {
                            messageDiv.innerHTML = marked.parse(fullResponse);
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
        addMessage(`Error: Could not connect to Ollama using model "${selectedModel}". Make sure Ollama is running.`, 'error');
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function addMessage(text, type, isLoading = false) {
    const messageId = Date.now();
    let messageDiv;

    if (type === 'user')       messageDiv = userMessageTemplate.content.cloneNode(true).firstElementChild;
    else if (type === 'error') messageDiv = errorMessageTemplate.content.cloneNode(true).firstElementChild;
    else                       messageDiv = assistantMessageTemplate.content.cloneNode(true).firstElementChild;

    messageDiv.id = `msg-${messageId}`;
    if (isLoading) messageDiv.classList.add('loading');
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return messageId;
}

function removeMessage(messageId) {
    const message = document.getElementById(`msg-${messageId}`);
    if (message) message.remove();
}
