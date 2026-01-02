# Offline AI (CORE-CHAT)

An offline, privacy-focused chat application built with Electron, powered by local LLMs via [Ollama](https://ollama.ai/). This application allows you to chat with AI models, extract text from images (OCR), and analyze PDF documents directly on your machine without sending data to the cloud.

## Features

- **🔒 Fully Offline**: Powered by local LLMs using Ollama. No internet required for chat.
- **💬 Familiar UI**: Clean, responsive chat interface with history support.
- **🖼️ Image OCR**: Upload images to extract text using Tesseract.js.
- **📄 PDF Analysis**: Upload and parse PDF content for the AI to analyze.
- **🎨 Syntax Highlighting**: Automatic code highlighting for better readability.

## Prerequisites

Before running the application, ensure you have the following installed:

1. **[Node.js](https://nodejs.org/)**: Required to run the Electron app.
2. **[Ollama](https://ollama.ai/)**: The local LLM server.

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd CORE_CHAT-Git
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Prepare Ollama**
   Start the Ollama application and pull the default model used by the app (`gemma2:2b`). You can change this in `renderer.js` if you prefer another model.
   ```bash
   ollama pull gemma2:2b
   ```
   *Make sure Ollama is running in the background (default port 11434).*

4. **Run the Application**
   ```bash
   npm start
   ```

## Development

The project structure is as follows:

- `electron/main.js`: Main process entry point.
- `renderer.js`: Handles frontend logic and Ollama API communication.
- `index.html` & `style.css`: UI layout and styling.
- `image-upload.js` & `pdf-upload.js`: Utility modules for file handling.

To modify the LLM model, edit the `model` field in `renderer.js`:
```javascript
body: JSON.stringify({
    model: 'mistral', // Change to your preferred model
    prompt: fullMessage,
    stream: true
})
```

## Git Workflow

This project includes a `.gitignore` to exclude node modules and build artifacts. When contributing:

1. Stage your changes: `git add .`
2. Commit: `git commit -m "Description of changes"`
3. Push: `git push origin main`

## License

ISC
