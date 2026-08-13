const { ipcRenderer } = require('electron');

export function addCodeBlockHeader(pre, codeBlock, index) {
    // Prevent double-adding
    if (pre.querySelector('.code-block-header')) return;

    // Detect language from class
    const classes = Array.from(codeBlock.classList);
    const langClass = classes.find(c => c.startsWith('language-'));
    const lang = langClass ? langClass.replace('language-', '') : 'code';

    // Build header
    const header = document.createElement('div');
    header.className = 'code-block-header';

    // Language label (lowercase, monospace)
    const langLabel = document.createElement('span');
    langLabel.className = 'code-block-lang';
    langLabel.textContent = lang;
    header.appendChild(langLabel);

    // Right-side button group
    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '4px';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-block-copy-btn';
    copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy
    `;
    copyBtn.title = 'Copy to clipboard';
    copyBtn.addEventListener('click', (e) => handleCopy(e, codeBlock, copyBtn));

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'code-block-copy-btn';
    saveBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        Save
    `;
    saveBtn.title = 'Save to file';
    saveBtn.addEventListener('click', (e) => handleSave(e, codeBlock, saveBtn, lang, index));

    btnGroup.appendChild(copyBtn);
    btnGroup.appendChild(saveBtn);
    header.appendChild(btnGroup);

    // Insert header as first child of pre
    pre.insertBefore(header, pre.firstChild);

    // Ensure pre styling
    pre.style.paddingTop = '0';
}

async function handleCopy(e, codeBlock, btn) {
    e.stopPropagation();
    try {
        await navigator.clipboard.writeText(codeBlock.textContent);
        const orig = btn.innerHTML;
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
        `;
        btn.style.color = '#6ee7b7';
        setTimeout(() => {
            btn.innerHTML = orig;
            btn.style.color = '';
        }, 2000);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

async function handleSave(e, codeBlock, btn, lang, index) {
    e.stopPropagation();
    try {
        const code = codeBlock.textContent;
        const result = await ipcRenderer.invoke('save-file-dialog', {
            defaultPath: `snippet_${index}.${lang}`,
            filters: [{ name: 'All Files', extensions: ['*'] }]
        });
        if (!result.canceled && result.filePath) {
            await ipcRenderer.invoke('save-file', { content: code, filePath: result.filePath });
            const orig = btn.innerHTML;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Saved!
            `;
            btn.style.color = '#6ee7b7';
            setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
        }
    } catch (err) {
        console.error('Save failed:', err);
    }
}
