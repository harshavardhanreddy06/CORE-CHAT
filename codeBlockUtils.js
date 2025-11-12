const { ipcRenderer } = require('electron');

export function addCodeBlockHeader(pre, codeBlock, index) {
    // Create header container
    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '4px 8px';
    header.style.background = '#2d2d2d';
    header.style.borderRadius = '4px 4px 0 0';
    header.style.color = '#fff';
    header.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    header.style.fontSize = '12px';
    
    // Add language label
    const lang = codeBlock.className.split('-').pop() || 'code';
    const langLabel = document.createElement('span');
    langLabel.textContent = lang;
    langLabel.style.textTransform = 'uppercase';
    header.appendChild(langLabel);
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    
    // Create copy button
    const copyButton = createButton('📋 Copy', 'Copy to clipboard');
    
    // Create save button
    const saveButton = createButton('💾 Save', 'Save to file');
    
    // Add hover effects
    setupButtonHover(copyButton);
    setupButtonHover(saveButton);
    
    // Add click handlers
    copyButton.onclick = (e) => handleCopyClick(e, codeBlock, copyButton);
    saveButton.onclick = (e) => handleSaveClick(e, codeBlock, saveButton, lang, index);
    
    // Add buttons to container
    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(saveButton);
    header.appendChild(buttonContainer);
    
    // Insert header before the code block
    pre.insertBefore(header, codeBlock);
    
    // Add some styling to the pre element
    pre.style.position = 'relative';
    pre.style.marginTop = '1.5em';
    pre.style.borderRadius = '0 0 4px 4px';
    
    // Style the code block
    codeBlock.style.display = 'block';
    codeBlock.style.paddingTop = '1em';
    codeBlock.style.borderRadius = '0 0 4px 4px';
}

function createButton(icon, title) {
    const button = document.createElement('button');
    button.className = 'code-block-btn';
    button.innerHTML = icon;
    button.style.background = 'none';
    button.style.border = '1px solid #666';
    button.style.borderRadius = '4px';
    button.style.color = '#fff';
    button.style.padding = '2px 8px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '12px';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.gap = '4px';
    button.title = title;
    return button;
}

function setupButtonHover(button) {
    button.onmouseenter = () => {
        button.style.background = '#444';
    };
    
    button.onmouseleave = () => {
        button.style.background = 'none';
    };
}

async function handleCopyClick(e, codeBlock, button) {
    e.stopPropagation();
    try {
        await navigator.clipboard.writeText(codeBlock.textContent);
        const originalText = button.innerHTML;
        button.innerHTML = ' Copied!';
        setTimeout(() => {
            button.innerHTML = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        button.innerHTML = '❌ Error';
        setTimeout(() => {
            button.innerHTML = '📋 Copy';
        }, 2000);
    }
}

async function handleSaveClick(e, codeBlock, button, lang, index) {
    e.stopPropagation();
    try {
        const code = codeBlock.textContent;
        const defaultName = `${lang}_${index}`;
        
        // Send message to main process to show save dialog
        const result = await ipcRenderer.invoke('save-file-dialog', {
            defaultPath: `${defaultName}.${lang}`,
            filters: [
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePath) {
            // Send the file content and path to main process to save
            await ipcRenderer.invoke('save-file', {
                content: code,
                filePath: result.filePath
            });
            
            // Show success feedback
            const originalText = button.innerHTML;
            button.innerHTML = ' Saved!';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        }
    } catch (err) {
        console.error('Error saving file:', err);
        button.innerHTML = '❌ Error';
        setTimeout(() => {
            button.innerHTML = '💾 Save';
        }, 2000);
    }
}
