// renderer.js - Handles UI interactions and Ollama API calls

import { getOcrText, getImageURL, clearOcrText } from './image-upload.js';
import { getPdfText, getPdfFileName, clearPdfText } from './pdf-upload.js';
import { addCodeBlockHeader } from './codeBlockUtils.js';

const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const chatContainer = document.getElementById('chat-container');
const modelSelect = document.getElementById('model-select');
const refreshBtn = document.getElementById('refresh-models');
// status elements are hidden in the new UI, kept for compatibility
const statusDot = document.getElementById('model-status');
const statusLabel = document.getElementById('model-status-label');

// ── Textarea auto-resize ─────────────────────────────────────────────────────
function autoResizeTextarea() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
}
input.addEventListener('input', autoResizeTextarea);

// Get message templates
const userMessageTemplate = document.getElementById('user-message-template');
const assistantMessageTemplate = document.getElementById('assistant-message-template');
const errorMessageTemplate = document.getElementById('error-message-template');

// Ollama base URL
const OLLAMA_BASE = 'http://localhost:11434';

// ── IPC bridge (Electron main ↔ renderer) ─────────────────────────────────────
// nodeIntegration is enabled so we can use require() directly
const { ipcRenderer } = require('electron');

// ── Track whether we've already triggered a load to avoid duplicates ─────────────
let modelLoadTriggered = false;

// Listen for Ollama status pushed by main process (handles the case where
// Ollama wasn't running yet when the renderer started).
ipcRenderer.on('ollama-status', (_event, state) => {
    setStatus(state);
    if (state === 'online' && !modelLoadTriggered) {
        modelLoadTriggered = true;
        loadModels();
    } else if (state === 'loading') {
        setSelectPlaceholder('Starting Ollama\u2026');
        setStatusLabel('Starting Ollama\u2026');
    } else if (state === 'offline') {
        setSelectPlaceholder('Ollama not reachable');
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

// ── Model Loader ─────────────────────────────────────────────────────────────
const MODELS_CACHE_KEY = 'corechat_models_cache';
let loadModelsTimer = null;
let hasModels = false; // true once models are successfully shown in the selector

function setSelectPlaceholder(text) {
    // NEVER overwrite real models with a placeholder/error
    if (hasModels) return;
    modelSelect.innerHTML = `<option value="" disabled selected>${text}</option>`;
}

async function fetchModelsWithTimeout(timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

async function loadModels(attempt = 1) {
    // Show cached models instantly on first attempt
    if (attempt === 1) {
        const cached = sessionStorage.getItem(MODELS_CACHE_KEY);
        if (cached) {
            try {
                const cachedModels = JSON.parse(cached);
                if (cachedModels.length > 0) populateSelect(cachedModels);
            } catch (_) {}
        }
        // Only show placeholder if no models have ever been shown
        if (!hasModels) {
            setSelectPlaceholder('Loading…');
        }
    }

    try {
        const data = await fetchModelsWithTimeout(8000);
        const models = data.models || [];

        if (models.length === 0) {
            if (!hasModels) setSelectPlaceholder('No models found');
            setStatus('offline');
            return;
        }

        // Success — cancel any pending retry timer
        if (loadModelsTimer) { clearTimeout(loadModelsTimer); loadModelsTimer = null; }
        sessionStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(models));
        populateSelect(models);
        setStatus('online');
    } catch (err) {
        console.warn(`[Models] Attempt ${attempt} failed:`, err.message);

        // If models are already shown, silently stop retrying — don't disrupt the UI
        if (hasModels) {
            console.info('[Models] Models already loaded — ignoring fetch error.');
            return;
        }

        // No models shown yet — retry up to 5 times with increasing delay
        if (attempt < 5) {
            const delay = Math.min(1000 * attempt, 3000);
            setSelectPlaceholder(`Retrying…`);
            loadModelsTimer = setTimeout(() => loadModels(attempt + 1), delay);
        } else {
            setSelectPlaceholder('Could not reach Ollama — click ↻');
            setStatus('offline');
        }
    }
}

function populateSelect(models) {
    const previous = modelSelect.value;
    modelSelect.innerHTML = '';
    models.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        if (m.name === previous || (!previous && i === 0)) opt.selected = true;
        modelSelect.appendChild(opt);
    });
    hasModels = true; // mark that real models are now displayed
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

// On startup: actively ask the main process for the current Ollama status.
// This fixes the race condition where the 'ollama-status' broadcast fires
// BEFORE the renderer's listener is registered, so the event was missed.
(async () => {
    // Show cached models instantly while we check
    const cached = sessionStorage.getItem(MODELS_CACHE_KEY);
    if (cached) {
        try {
            const cachedModels = JSON.parse(cached);
            if (cachedModels.length > 0) populateSelect(cachedModels);
        } catch (_) {}
    } else {
        setSelectPlaceholder('Connecting to Ollama\u2026');
    }

    try {
        // Ask main: is Ollama already up?
        const status = await ipcRenderer.invoke('get-ollama-status');
        if (status.ready && !modelLoadTriggered) {
            modelLoadTriggered = true;
            loadModels();
        }
        // If not ready yet, the 'ollama-status' event listener above will fire
        // once main.js finishes starting Ollama.
    } catch (err) {
        console.warn('[Startup] Could not get Ollama status:', err.message);
        // Fall back: try loading anyway
        if (!modelLoadTriggered) {
            modelLoadTriggered = true;
            loadModels();
        }
    }
})();

refreshBtn.addEventListener('click', () => {
    if (loadModelsTimer) { clearTimeout(loadModelsTimer); loadModelsTimer = null; }
    modelLoadTriggered = true;
    refreshBtn.classList.add('spinning');
    loadModels().finally(() => refreshBtn.classList.remove('spinning'));
});

// ── Conversation History ───────────────────────────────────────────────────────
// Declared FIRST so all event listeners below can safely reference these.
const MAX_HISTORY_PAIRS = 20;
let conversationHistory = [];
let isGenerating = false; // guard against concurrent sends

function trimHistory() {
    const maxMessages = MAX_HISTORY_PAIRS * 2;
    if (conversationHistory.length > maxMessages) {
        conversationHistory = conversationHistory.slice(conversationHistory.length - maxMessages);
    }
}

function clearHistory() {
    conversationHistory = [];
    updateTurnCounter();
}

function updateTurnCounter() {
    const counter = document.getElementById('turn-counter');
    if (!counter) return;
    const turns = Math.floor(conversationHistory.length / 2);
    if (turns === 0) {
        counter.style.display = 'none';
    } else {
        counter.style.display = 'flex';
        counter.textContent = `${turns} / ${MAX_HISTORY_PAIRS}`;
        counter.title = `${turns} exchange${turns !== 1 ? 's' : ''} in memory (max ${MAX_HISTORY_PAIRS})`;
        counter.classList.toggle('counter-warning', turns >= MAX_HISTORY_PAIRS - 3);
    }
}

// ── New Chat button ────────────────────────────────────────────────────────
document.getElementById('new-chat-btn').addEventListener('click', () => {
    if (isGenerating) return; // don't clear while a response is streaming
    clearHistory();
    chatContainer.innerHTML = '';
});

// NOTE: We do NOT listen to modelSelect 'change' to clear history.
// Chromium fires 'change' when populateSelect() rebuilds the <select> programmatically,
// which was silently wiping history mid-conversation on every background model refresh.

// ── Send message ──────────────────────────────────────────────────────────────
sendBtn.addEventListener('click', sendMessage);

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    if (isGenerating) return; // prevent concurrent sends

    const message = input.value.trim();
    const ocrText = getOcrText();
    const imageURL = getImageURL();
    const pdfText = getPdfText();
    const pdfName = getPdfFileName();

    if (!message && !ocrText && !pdfText) return;

    const selectedModel = getSelectedModel();
    if (!selectedModel) {
        addMessage('Please select a model first. Make sure Ollama is running and has at least one model installed.', 'error');
        return;
    }

    // Build the content for this user turn
    let userContent = message;
    if (ocrText) userContent += (userContent ? '\n\n' : '') + `[Image content: ${ocrText}]`;
    if (pdfText) userContent += (userContent ? '\n\n' : '') + `[PDF content: ${pdfText}]`;

    // Add to conversation history BEFORE clearing input
    conversationHistory.push({ role: 'user', content: userContent });
    trimHistory();

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    isGenerating = true;
    sendBtn.style.opacity = '0.5';
    sendBtn.style.pointerEvents = 'none';

    // Build rich user message bubble
    addUserMessage(message, imageURL, pdfName);
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
        // Use /api/chat with full message history for conversation memory
        const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages: conversationHistory,  // ← full history
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
                    // /api/chat streams: { message: { role, content }, done }
                    const token = json.message?.content;
                    if (token) {
                        fullResponse += token;
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

        // Store assistant reply in history
        if (fullResponse) {
            conversationHistory.push({ role: 'assistant', content: fullResponse });
            trimHistory();
            updateTurnCounter();
        }

    } catch (error) {
        console.error('Error calling Ollama:', error);
        // Remove the failed user turn from history so it doesn't corrupt context
        conversationHistory.pop();
        messageDiv.remove();
        addMessage(`Error: Could not connect to Ollama using model "${selectedModel}". Make sure Ollama is running.`, 'error');
    } finally {
        isGenerating = false;
        sendBtn.style.opacity = '';
        sendBtn.style.pointerEvents = '';
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a ChatGPT-style user message bubble.
 * Shows: image thumbnail (if any) + PDF chip (if any) + text (if any).
 */
function addUserMessage(text, imageURL, pdfName) {
    const messageDiv = userMessageTemplate.content.cloneNode(true).firstElementChild;
    messageDiv.id = `msg-${Date.now()}`;
    messageDiv.classList.add('user-message-rich');

    // Image attachment
    if (imageURL) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'msg-image-wrap';
        const img = document.createElement('img');
        img.src = imageURL;
        img.className = 'msg-image';
        img.alt = 'Attached image';
        imgWrap.appendChild(img);
        messageDiv.appendChild(imgWrap);
    }

    // PDF attachment chip
    if (pdfName) {
        const pdfChip = document.createElement('div');
        pdfChip.className = 'msg-pdf-chip';
        pdfChip.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>${pdfName.length > 30 ? pdfName.slice(0, 28) + '\u2026' : pdfName}</span>
        `;
        messageDiv.appendChild(pdfChip);
    }

    // Text
    if (text) {
        const textEl = document.createElement('span');
        textEl.className = 'msg-text';
        textEl.textContent = text;
        messageDiv.appendChild(textEl);
    }

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage(text, type, isLoading = false) {
    const messageId = Date.now();
    let messageDiv;

    if (type === 'user') {
        addUserMessage(text, '', '');
        return messageId;
    } else if (type === 'error') {
        messageDiv = errorMessageTemplate.content.cloneNode(true).firstElementChild;
    } else {
        messageDiv = assistantMessageTemplate.content.cloneNode(true).firstElementChild;
    }

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
