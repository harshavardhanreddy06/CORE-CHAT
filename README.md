# CORE CHAT

An elegant, privacy-focused desktop chat application built with Electron. It brings the ChatGPT-like experience entirely offline by using local Large Language Models (LLMs) via [Ollama](https://ollama.ai/).

Your data never leaves your machine.

## ✨ Features

- **🔒 Fully Offline & Private**: Powered by local LLMs using Ollama. No internet required for chat, and absolutely zero telemetry or cloud syncing.
- **💬 Modern UI/UX**: A clean, premium dark-themed interface modeled after ChatGPT. Features responsive design, message bubbles, and smooth animations.
- **🧠 Conversation Memory**: Stateful chat history with a sliding window (keeps the last 20 exchanges) so the AI remembers context. Automatically resets when you switch models or start a "New Session".
- **🤖 Dynamic Model Loading**: Automatically detects and lists all models installed in your local Ollama instance.
- **🖼️ Image OCR**: Attach images directly to the chat! Extracts text locally using Tesseract.js and feeds it to the AI as context.
- **📄 PDF Analysis**: Attach PDFs to parse their text content locally via PDF.js, allowing the AI to summarize or answer questions about your documents.
- **🎨 Code Highlighting**: Automatic syntax highlighting for code blocks with one-click "Copy Code" functionality.

## 🚀 Prerequisites

1. **[Node.js](https://nodejs.org/)**
2. **[Ollama](https://ollama.ai/)**: The local LLM runner.

## 🛠️ Installation & Setup

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd CORE-CHAT
   ```
2. **Install dependencies**

   ```bash
   npm install
   ```
3. **Prepare Ollama**
   Make sure you have at least one model downloaded in Ollama. For example, to get Qwen 2.5 (3B):

   ```bash
   ollama run qwen2.5:3b
   ```
4. **Run the Application**

   ```bash
   npm start
   ```

   *Note: CORE CHAT will attempt to start the Ollama background service automatically if it is not already running.*

## 📦 Packaging for Distribution

You can build standalone executables for your operating system using `electron-builder`:

- **Mac (.dmg)**: `npm run dist:mac`
- **Windows (.exe)**: `npm run dist:win`
- **Linux (.AppImage)**: `npm run dist:linux`
- **Auto-detect OS**: `npm run dist`

The built application will be placed in the `dist/` directory.
*(Note: Builds are currently unsigned, so macOS/Windows may show a security prompt on first launch).*

## 🧩 Architecture

- **`electron/main.js`**: Main Electron process. Manages the window lifecycle and spawns the Ollama background daemon automatically.
- **`renderer.js`**: Core frontend logic. Handles the UI state, conversation memory (`/api/chat`), and streaming responses from the Ollama API.
- **`index.html` & `style.css`**: The structural layout and modern dark-theme styling system.
- **`image-upload.js` & `pdf-upload.js`**: Modular components handling file attachments and local text extraction.
- **`codeBlockUtils.js`**: Markdown parsing and syntax highlighting utilities.
