// Unity MCP Bridge Web Client (Direct Unity Studio Edition)

// Connection Settings
let unityPortInput = null;
function getUnityUrl() {
    if (!unityPortInput) unityPortInput = document.getElementById('unityPortInput');
    const port = unityPortInput ? unityPortInput.value.trim() : '8090';
    return `http://127.0.0.1:${port}`;
}

// Mode & Tab States
let currentMode = 'plan'; // 'plan' or 'build'
let isChatActive = false;
let messageHistory = [];
let currentChatId = null;
let historySummary = '';
let rawHierarchy = [];
let activeDashboardTab = 'hierarchy'; // 'hierarchy', 'console', 'camera'

// --- Custom Titlebar Window Controls Binding ---
if (window.electronAPI) {
    document.getElementById('windowMinimizeBtn').addEventListener('click', () => window.electronAPI.minimize());
    document.getElementById('windowMaximizeBtn').addEventListener('click', () => window.electronAPI.maximize());
    document.getElementById('windowCloseBtn').addEventListener('click', () => window.electronAPI.close());
}

// DOM Elements - Chat & Shell
const planModeBtn = document.getElementById('planModeBtn');
const buildModeBtn = document.getElementById('buildModeBtn');
const modeStatusText = document.getElementById('modeStatusText');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const exportChatBtn = document.getElementById('exportChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const compileErrorModal = document.getElementById('compileErrorModal');
const fixCompileErrorBtn = document.getElementById('fixCompileErrorBtn');
const closeCompileErrorBtn = document.getElementById('closeCompileErrorBtn');
let hasPromptedCompileError = false;
const attachImageBtn = document.getElementById('attachImageBtn');
const imageAttachmentInput = document.getElementById('imageAttachmentInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const attachedImagePreview = document.getElementById('attachedImagePreview');
const removeAttachedImageBtn = document.getElementById('removeAttachedImageBtn');
let attachedImageBase64 = null;
const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsDrawer = document.getElementById('settingsDrawer');
const endpointInput = document.getElementById('endpointInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const chatFeed = document.getElementById('chatFeed');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

// DOM Elements - Dashboard Tabs & Content
const tabHierarchyBtn = document.getElementById('tabHierarchyBtn');
const tabConsoleBtn = document.getElementById('tabConsoleBtn');
const tabCameraBtn = document.getElementById('tabCameraBtn');

const hierarchyScreen = document.getElementById('hierarchyScreen');
const consoleScreen = document.getElementById('consoleScreen');
const cameraScreen = document.getElementById('cameraScreen');

const hierarchyTree = document.getElementById('hierarchyTree');
const consoleLogs = document.getElementById('consoleLogs');
const screenshotContainer = document.getElementById('screenshotContainer');

const refreshHierarchyBtn = document.getElementById('refreshHierarchyBtn');
const refreshConsoleBtn = document.getElementById('refreshConsoleBtn');
const captureSceneBtn = document.getElementById('captureSceneBtn');
const captureGameBtn = document.getElementById('captureGameBtn');

// --- Navigation Tabs Bindings ---
const tabs = [
    { btn: tabHierarchyBtn, screen: hierarchyScreen, name: 'hierarchy' },
    { btn: document.getElementById('tabAssetsBtn'), screen: document.getElementById('assetsScreen'), name: 'assets' },
    { btn: document.getElementById('tabScriptsBtn'), screen: document.getElementById('scriptsScreen'), name: 'scripts' },
    { btn: tabConsoleBtn, screen: consoleScreen, name: 'console' },
    { btn: tabCameraBtn, screen: cameraScreen, name: 'camera' },
    { btn: document.getElementById('tabAgentsBtn'), screen: document.getElementById('agentsScreen'), name: 'agents' }
];

tabs.forEach(t => {
    t.btn.addEventListener('click', () => {
        tabs.forEach(x => {
            x.btn.classList.remove('active');
            x.screen.classList.remove('active');
        });
        t.btn.classList.add('active');
        t.screen.classList.add('active');
        activeDashboardTab = t.name;
        
        // Immediate update on tab activate
        if (t.name === 'hierarchy') refreshHierarchy();
        if (t.name === 'assets') refreshAssets();
        if (t.name === 'console') refreshConsoleLogs();
    });
});

// --- Settings Drawer Bindings & Persistent Load/Save ---
const deepThinkingToggle = document.getElementById('deepThinkingToggle');
unityPortInput = document.getElementById('unityPortInput');
const tempInput = document.getElementById('tempInput');
const tempVal = document.getElementById('tempVal');
const maxTokensInput = document.getElementById('maxTokensInput');
const customPromptInput = document.getElementById('customPromptInput');
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const autoPlayToggle = document.getElementById('autoPlayToggle');
const consoleVerbositySelect = document.getElementById('consoleVerbositySelect');
const maxLoopsInput = document.getElementById('maxLoopsInput');
const execModeSelect = document.getElementById('execModeSelect');
const glowOpacityInput = document.getElementById('glowOpacityInput');
const glowVal = document.getElementById('glowVal');

const agentEnable_scripting = document.getElementById('agentEnable_scripting');
const agentEnable_modeling = document.getElementById('agentEnable_modeling');
const agentEnable_gui = document.getElementById('agentEnable_gui');
const agentEnable_audio = document.getElementById('agentEnable_audio');
const agentEnable_layout = document.getElementById('agentEnable_layout');

function loadSettings() {
    // Basic connections
    if (localStorage.getItem('api_endpoint')) endpointInput.value = localStorage.getItem('api_endpoint');
    if (localStorage.getItem('api_key')) apiKeyInput.value = localStorage.getItem('api_key');
    if (localStorage.getItem('api_model')) modelSelect.value = localStorage.getItem('api_model');
    if (localStorage.getItem('unity_port')) unityPortInput.value = localStorage.getItem('unity_port');

    // Deep Thinking
    if (deepThinkingToggle) {
        deepThinkingToggle.checked = localStorage.getItem('deep_thinking_enabled') === 'true';
    }

    // Advanced Model Tuning
    if (localStorage.getItem('temp')) {
        tempInput.value = localStorage.getItem('temp');
        tempVal.textContent = tempInput.value;
    }
    if (localStorage.getItem('max_tokens')) maxTokensInput.value = localStorage.getItem('max_tokens');
    if (localStorage.getItem('custom_prompt')) customPromptInput.value = localStorage.getItem('custom_prompt');

    // Unity integration
    if (localStorage.getItem('auto_refresh')) autoRefreshToggle.checked = localStorage.getItem('auto_refresh') === 'true';
    if (localStorage.getItem('auto_play')) autoPlayToggle.checked = localStorage.getItem('auto_play') === 'true';
    if (localStorage.getItem('console_verbosity')) consoleVerbositySelect.value = localStorage.getItem('console_verbosity');

    // Orchestrator
    if (localStorage.getItem('max_loops')) maxLoopsInput.value = localStorage.getItem('max_loops');
    
    // Sub-agents toggles
    const agents = ['scripting', 'modeling', 'gui', 'audio', 'layout'];
    agents.forEach(k => {
        const el = document.getElementById(`agentEnable_${k}`);
        if (el) {
            const saved = localStorage.getItem(`agent_enabled_${k}`);
            el.checked = saved !== 'false'; // Default to true if not set
        }
    });

    // Security & UI Glow
    if (localStorage.getItem('exec_mode')) execModeSelect.value = localStorage.getItem('exec_mode');
    if (localStorage.getItem('glow_opacity')) {
        glowOpacityInput.value = localStorage.getItem('glow_opacity');
        glowVal.textContent = `${glowOpacityInput.value}%`;
        document.documentElement.style.setProperty('--glow-opacity', glowOpacityInput.value / 100);
    }
}

function saveSettings() {
    localStorage.setItem('api_endpoint', endpointInput.value.trim());
    localStorage.setItem('api_key', apiKeyInput.value.trim());
    localStorage.setItem('api_model', modelSelect.value);
    localStorage.setItem('unity_port', unityPortInput.value.trim());
    
    if (deepThinkingToggle) localStorage.setItem('deep_thinking_enabled', deepThinkingToggle.checked);
    
    localStorage.setItem('temp', tempInput.value);
    localStorage.setItem('max_tokens', maxTokensInput.value);
    localStorage.setItem('custom_prompt', customPromptInput.value);
    
    localStorage.setItem('auto_refresh', autoRefreshToggle.checked);
    localStorage.setItem('auto_play', autoPlayToggle.checked);
    localStorage.setItem('console_verbosity', consoleVerbositySelect.value);
    
    localStorage.setItem('max_loops', maxLoopsInput.value);
    
    const agents = ['scripting', 'modeling', 'gui', 'audio', 'layout'];
    agents.forEach(k => {
        const el = document.getElementById(`agentEnable_${k}`);
        if (el) {
            localStorage.setItem(`agent_enabled_${k}`, el.checked);
        }
    });
    
    localStorage.setItem('exec_mode', execModeSelect.value);
    localStorage.setItem('glow_opacity', glowOpacityInput.value);
}

// Attach event listeners for real-time saving
[
    endpointInput, apiKeyInput, modelSelect, unityPortInput,
    tempInput, maxTokensInput, customPromptInput,
    autoRefreshToggle, autoPlayToggle, consoleVerbositySelect,
    maxLoopsInput, execModeSelect, glowOpacityInput,
    agentEnable_scripting, agentEnable_modeling, agentEnable_gui,
    agentEnable_audio, agentEnable_layout
].forEach(el => {
    if (el) {
        const evt = (el.type === 'range' || el.type === 'textarea' || el.type === 'text' || el.type === 'password' || el.type === 'number') ? 'input' : 'change';
        el.addEventListener(evt, () => {
            if (el === tempInput) tempVal.textContent = tempInput.value;
            if (el === glowOpacityInput) {
                glowVal.textContent = `${glowOpacityInput.value}%`;
                document.documentElement.style.setProperty('--glow-opacity', glowOpacityInput.value / 100);
            }
            saveSettings();
        });
    }
});

if (deepThinkingToggle) {
    deepThinkingToggle.addEventListener('change', saveSettings);
}

// Load settings immediately on execution
loadSettings();

toggleSettingsBtn.addEventListener('click', () => {
    settingsDrawer.classList.toggle('open');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsDrawer.classList.remove('open');
});

// --- Mode Switches ---
planModeBtn.addEventListener('click', () => {
    if (isChatActive) return;
    currentMode = 'plan';
    planModeBtn.classList.add('active');
    buildModeBtn.classList.remove('active');
    modeStatusText.textContent = 'PLAN MODU AKTİF';
});

buildModeBtn.addEventListener('click', () => {
    if (isChatActive) return;
    currentMode = 'build';
    buildModeBtn.classList.add('active');
    planModeBtn.classList.remove('active');
    modeStatusText.textContent = 'BUILD MODU AKTİF';
});

// --- Clear Chat ---
clearChatBtn.addEventListener('click', () => {
    if (isChatActive) return;
    messageHistory = [];
    chatFeed.innerHTML = `
        <div class="message-row assistant">
            <div class="bubble">
                <p><strong>Sohbet Geçmişi Temizlendi 🧹</strong></p>
                <p>Yeni bir çalışma başlatabilirsiniz. Ben, Unity Editör oturumunuza doğrudan entegre edilmiş gelişmiş yapay zeka geliştirme asistanınızım. Sahne hiyerarşisini kontrol edebilir, C# scriptleri yazıp düzenleyebilir, fizik/bileşen ayarlarını yönetebilir ve testler çalıştırabilirim.</p>
                <p>Şu anda <strong>${currentMode === 'plan' ? 'PLAN MODU' : 'BUILD MODU'}</strong>'ndayım. Hedefinizi yazın; proje durumunu inceleyip onayınız için adım adım bir checklist hazırlayayım.</p>
            </div>
        </div>
    `;
});

// --- Undo / Redo Actions ---
undoBtn.addEventListener('click', async () => {
    if (isChatActive) return;
    setStatusMessage("↺ Unity Editor'de son işlem geri alınıyor...");
    const res = await executeUnityTool('perform_undo', {});
    clearStatusMessage();
    if (res && res.success) {
        appendMessage('assistant', "🔄 Son işlem başarıyla geri alındı (Undo).");
        setTimeout(refreshHierarchy, 500);
    } else {
        appendMessage('assistant', `⚠️ Geri alma başarısız oldu: ${res ? res.error : 'Bilinmeyen hata'}`);
    }
});

redoBtn.addEventListener('click', async () => {
    if (isChatActive) return;
    setStatusMessage("↻ Unity Editor'de son işlem yenileniyor...");
    const res = await executeUnityTool('perform_redo', {});
    clearStatusMessage();
    if (res && res.success) {
        appendMessage('assistant', "🔄 Son işlem başarıyla yenilendi (Redo).");
        setTimeout(refreshHierarchy, 500);
    } else {
        appendMessage('assistant', `⚠️ Yineleme başarısız oldu: ${res ? res.error : 'Bilinmeyen hata'}`);
    }
});

// --- Image Attachment & Analysis (Multimodal AI) ---
if (attachImageBtn && imageAttachmentInput) {
    attachImageBtn.addEventListener('click', () => {
        if (isChatActive) return;
        imageAttachmentInput.click();
    });

    imageAttachmentInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            attachedImageBase64 = event.target.result;
            if (attachedImagePreview && imagePreviewContainer) {
                attachedImagePreview.src = attachedImageBase64;
                imagePreviewContainer.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
        
        // Reset file input value to allow uploading same file again
        imageAttachmentInput.value = '';
    });
}

if (removeAttachedImageBtn) {
    removeAttachedImageBtn.addEventListener('click', () => {
        attachedImageBase64 = null;
        if (imagePreviewContainer && attachedImagePreview) {
            imagePreviewContainer.style.display = 'none';
            attachedImagePreview.src = '';
        }
    });
}

// --- Copy-Paste Image Clipboard Support ---
if (chatInput) {
    chatInput.addEventListener('paste', (e) => {
        const clipboardItems = (e.clipboardData || window.clipboardData).items;
        for (const item of clipboardItems) {
            if (item.type.indexOf('image') === 0) {
                const file = item.getAsFile();
                if (!file) continue;

                // Stop text pasting of image data/filename
                e.preventDefault();

                const reader = new FileReader();
                reader.onload = (event) => {
                    attachedImageBase64 = event.target.result;
                    if (attachedImagePreview && imagePreviewContainer) {
                        attachedImagePreview.src = attachedImageBase64;
                        imagePreviewContainer.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
                break;
            }
        }
    });
}

// --- Agent Matrix Toggle Collapse ---
const toggleAgentMatrixBtn = document.getElementById('toggleAgentMatrixBtn');
const agentMatrixContainer = document.getElementById('agentMatrixContainer');
if (toggleAgentMatrixBtn && agentMatrixContainer) {
    toggleAgentMatrixBtn.addEventListener('click', () => {
        agentMatrixContainer.classList.toggle('collapsed');
    });
}

// --- Export Chat (Markdown File Download) ---
exportChatBtn.addEventListener('click', () => {
    if (messageHistory.length === 0) {
        alert("Dışa aktarılacak sohbet geçmişi yok.");
        return;
    }

    let markdown = `# Unity AI Studio - Sohbet Geçmişi\n\n`;
    markdown += `**Tarih:** ${new Date().toLocaleString()}\n`;
    markdown += `**Mod:** ${currentMode.toUpperCase()}\n`;
    markdown += `**Unity Sürümü:** ${statusText.textContent}\n\n---\n\n`;

    messageHistory.forEach(msg => {
        const roleName = msg.role === 'user' ? 'KULLANICI' : 'UNITY AI ASİSTAN';
        markdown += `### 👤 ${roleName}\n\n`;
        markdown += `${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Unity_AI_Sohbet_Geçmişi_${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- Auto-size Textarea ---
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
});

// --- Refresh Hierarchy ---
async function refreshHierarchy() {
    const hasData = hierarchyTree.querySelector('.tree-node') !== null;
    if (!hasData) {
        hierarchyTree.innerHTML = '<p class="empty-state">Hiyerarşi güncelleniyor...</p>';
    }
    const data = await executeUnityTool('get_scene_hierarchy', {});
    if (data && data.success && data.hierarchy) {
        rawHierarchy = data.hierarchy;
        const searchInput = document.getElementById('hierarchySearchInput');
        const query = searchInput ? searchInput.value : '';
        renderHierarchy(filterHierarchy(rawHierarchy, query));
    } else if (!hasData) {
        let errMsg = '';
        if (data) {
            if (data.error) errMsg = ` (Hata: ${data.error})`;
            else if (data.success === false) errMsg = ' (Sunucu başarısız yanıt döndürdü)';
            else errMsg = ` (Yanıt formatı geçersiz: ${JSON.stringify(data).substring(0, 100)})`;
        } else {
            errMsg = ' (Sunucudan yanıt alınamadı)';
        }
        hierarchyTree.innerHTML = `<p class="empty-state">Hiyerarşi alınamadı${errMsg}. Unity bağlı olmayabilir.</p>`;
    }
}
refreshHierarchyBtn.addEventListener('click', refreshHierarchy);

const hierarchySearchInput = document.getElementById('hierarchySearchInput');
if (hierarchySearchInput) {
    hierarchySearchInput.addEventListener('input', () => {
        renderHierarchy(filterHierarchy(rawHierarchy, hierarchySearchInput.value));
    });
}

function filterHierarchy(nodes, query) {
    if (!query) return nodes;
    
    query = query.toLowerCase().trim();
    const isComponentSearch = query.startsWith('t:');
    const searchTerm = isComponentSearch ? query.substring(2).trim() : query;
    
    if (!searchTerm) return nodes;

    function matches(node) {
        if (isComponentSearch) {
            if (node.components && node.components.some(c => c.toLowerCase().includes(searchTerm))) {
                return true;
            }
        } else {
            if (node.name && node.name.toLowerCase().includes(searchTerm)) {
                return true;
            }
        }
        return false;
    }

    function processNode(node) {
        let filteredChildren = [];
        if (node.children && node.children.length > 0) {
            filteredChildren = node.children
                .map(child => processNode(child))
                .filter(child => child !== null);
        }

        const nodeMatches = matches(node);
        const hasMatchingChildren = filteredChildren.length > 0;

        if (nodeMatches || hasMatchingChildren) {
            return {
                ...node,
                children: filteredChildren
            };
        }
        return null;
    }

    return nodes.map(node => processNode(node)).filter(node => node !== null);
}

function renderHierarchy(hierarchy) {
    hierarchyTree.innerHTML = '';
    if (!hierarchy || hierarchy.length === 0) {
        hierarchyTree.innerHTML = '<p class="empty-state">Sahnede hiç GameObject yok.</p>';
        return;
    }

    const container = document.createElement('div');
    hierarchy.forEach(root => {
        container.appendChild(createNodeRow(root, 0));
    });
    hierarchyTree.appendChild(container);
}

function createNodeRow(node, depth) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node';

    const row = document.createElement('div');
    row.className = 'node-row';
    row.style.paddingLeft = (6 + depth * 16) + 'px';

    const icon = document.createElement('span');
    icon.className = 'node-icon';
    if (node.children && node.children.length > 0) {
        icon.innerHTML = `<svg class="icon tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    } else {
        icon.innerHTML = `<svg class="icon tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
    }

    const name = document.createElement('span');
    name.className = `node-name ${node.active === false ? 'inactive' : ''}`;
    name.textContent = node.name;

    const components = document.createElement('span');
    components.className = 'node-components';
    if (node.components && node.components.length > 0) {
        components.textContent = `(${node.components.join(', ')})`;
    }

    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(components);
    wrapper.appendChild(row);

    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            wrapper.appendChild(createNodeRow(child, depth + 1));
        });
    }

    return wrapper;
}

// --- Refresh Console Logs ---
async function refreshConsoleLogs() {
    const data = await executeUnityTool('get_console_logs', { count: 30 });
    if (data && data.success && data.logs) {
        renderConsoleLogs(data.logs);
    } else {
        let errMsg = '';
        if (data) {
            if (data.error) errMsg = ` (Hata: ${data.error})`;
            else errMsg = ` (Yanıt formatı geçersiz)`;
        } else {
            errMsg = ' (Sunucudan yanıt alınamadı)';
        }
        consoleLogs.innerHTML = `<p class="empty-state">Konsol logları alınamadı${errMsg}. Unity bağlı olmayabilir.</p>`;
    }
}
refreshConsoleBtn.addEventListener('click', refreshConsoleLogs);

function renderConsoleLogs(logs) {
    consoleLogs.innerHTML = '';
    if (!logs || logs.length === 0) {
        consoleLogs.innerHTML = '<p class="empty-state">Konsol logu bulunamadı.</p>';
        return;
    }

    logs.forEach(log => {
        const row = document.createElement('div');
        row.className = 'log-row';

        const meta = document.createElement('div');
        meta.className = 'log-meta';

        const type = document.createElement('span');
        type.className = `log-type ${log.type.toLowerCase()}`;
        type.textContent = log.type.toUpperCase();

        const time = document.createElement('span');
        time.textContent = log.timestamp || '';

        meta.appendChild(type);
        meta.appendChild(time);

        const msg = document.createElement('div');
        msg.className = 'log-message';
        msg.textContent = log.message;

        row.appendChild(meta);
        row.appendChild(msg);

        const stackTrace = log.stackTrace || log.stack_trace;
        if (stackTrace && (log.type === 'Error' || log.type === 'Exception' || log.type === 'Assert')) {
            const stack = document.createElement('pre');
            stack.className = 'log-stack';
            stack.textContent = stackTrace;
            row.appendChild(stack);
        }

        consoleLogs.appendChild(row);
    });
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// --- Screenshot Capture Handlers ---
async function captureScreenshot(viewType) {
    screenshotContainer.innerHTML = '<p class="empty-state">Ekran görüntüsü alınıyor...</p>';
    const toolName = viewType === 'scene' ? 'capture_scene_view' : 'capture_game_view';
    const data = await executeUnityTool(toolName, { quality: 'medium' });
    
    if (data && data.image_base64) {
        screenshotContainer.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'screenshot-image';
        img.src = `data:image/png;base64,${data.image_base64}`;
        screenshotContainer.appendChild(img);
    } else {
        screenshotContainer.innerHTML = '<p class="empty-state">Ekran görüntüsü yakalanamadı. Unity bağlı ve PlayMode aktif veya Editör görünür olmalı.</p>';
    }
}
captureSceneBtn.addEventListener('click', () => captureScreenshot('scene'));
captureGameBtn.addEventListener('click', () => captureScreenshot('game'));

// --- Asset Browser Implementation ---
let allAssetsCached = [];

async function refreshAssets() {
    const assetsList = document.getElementById('assetsList');
    const hasData = assetsList.querySelector('.asset-row') !== null;
    
    const filterInput = document.getElementById('assetsSearchInput');
    const filterVal = filterInput ? filterInput.value.trim() : '';
    
    // Only show loading spinner on the first render or if search input is cleared
    if (!hasData && filterVal === '') {
        assetsList.innerHTML = '<p class="empty-state">Assetler güncelleniyor...</p>';
    }
    
    const data = await executeUnityTool('list_assets', { folder_path: 'Assets', filter: filterVal });
    if (data && data.success && data.assets) {
        allAssetsCached = data.assets;
        renderAssets(data.assets);
    } else if (!hasData) {
        let errMsg = '';
        if (data) {
            if (data.error) errMsg = ` (Hata: ${data.error})`;
            else errMsg = ` (Yanıt formatı geçersiz)`;
        } else {
            errMsg = ' (Sunucudan yanıt alınamadı)';
        }
        assetsList.innerHTML = `<p class="empty-state">Assetler alınamadı${errMsg}. Unity bağlı olmayabilir.</p>`;
    }
}

function getAssetIconAndType(path) {
    const ext = path.split('.').pop().toLowerCase();
    let iconSvg = '';
    let typeLabel = ext;
    
    if (ext === 'cs') {
        iconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="10" y1="9" x2="9" y2="9"></line></svg>`;
        typeLabel = 'C# Script';
    } else if (ext === 'prefab') {
        iconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
        typeLabel = 'Prefab';
    } else if (ext === 'unity') {
        iconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
        typeLabel = 'Scene';
    } else if (ext === 'mat') {
        iconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`;
        typeLabel = 'Material';
    } else if (['png', 'jpg', 'jpeg', 'tga', 'psd'].includes(ext)) {
        iconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
        typeLabel = 'Texture';
    } else {
        iconSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
        typeLabel = ext || 'Asset';
    }
    
    return { iconSvg, typeLabel };
}

function renderAssets(assets) {
    const assetsList = document.getElementById('assetsList');
    assetsList.innerHTML = '';
    if (!assets || assets.length === 0) {
        assetsList.innerHTML = '<p class="empty-state">Hiçbir asset dosyası bulunamadı.</p>';
        return;
    }
    
    assets.forEach(assetPath => {
        const row = document.createElement('div');
        row.className = 'asset-row';
        
        const { iconSvg, typeLabel } = getAssetIconAndType(assetPath);
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'asset-icon';
        iconSpan.innerHTML = iconSvg;
        
        const pathSpan = document.createElement('span');
        pathSpan.className = 'asset-path';
        pathSpan.textContent = assetPath;
        pathSpan.title = assetPath;
        
        const typeSpan = document.createElement('span');
        typeSpan.className = 'asset-type';
        typeSpan.textContent = typeLabel;
        
        row.appendChild(iconSpan);
        row.appendChild(pathSpan);
        row.appendChild(typeSpan);
        
        // Fast click-to-input binding or script viewing
        row.addEventListener('click', () => {
            if (assetPath.toLowerCase().endsWith('.cs')) {
                openScript(assetPath);
            } else {
                chatInput.value += ` "${assetPath}"`;
                chatInput.style.height = 'auto';
                chatInput.style.height = (chatInput.scrollHeight) + 'px';
                chatInput.focus();
            }
        });
        
        assetsList.appendChild(row);
    });
}

document.getElementById('refreshAssetsBtn').addEventListener('click', refreshAssets);

const assetsSearchInput = document.getElementById('assetsSearchInput');
if (assetsSearchInput) {
    assetsSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            refreshAssets();
        }
    });

    assetsSearchInput.addEventListener('input', () => {
        const query = assetsSearchInput.value.trim().toLowerCase();
        if (query === '') {
            renderAssets(allAssetsCached);
        } else {
            const filtered = allAssetsCached.filter(p => p.toLowerCase().includes(query));
            renderAssets(filtered);
        }
    });
}

// --- C# Script Viewer Implementation ---
let currentScriptPath = '';

async function openScript(assetPath) {
    currentScriptPath = assetPath;
    
    const currentScriptTitle = document.getElementById('currentScriptTitle');
    const refreshScriptBtn = document.getElementById('refreshScriptBtn');
    const copyScriptPathBtn = document.getElementById('copyScriptPathBtn');
    const scriptContentArea = document.getElementById('scriptContentArea');
    
    if (currentScriptTitle) currentScriptTitle.textContent = assetPath.toUpperCase();
    if (scriptContentArea) scriptContentArea.innerHTML = '<p class="empty-state">Script okunuyor...</p>';
    
    // Show actions
    if (refreshScriptBtn) refreshScriptBtn.style.display = 'block';
    if (copyScriptPathBtn) copyScriptPathBtn.style.display = 'block';
    
    // Switch active tab to 'scripts'
    tabs.forEach(x => {
        x.btn.classList.remove('active');
        x.screen.classList.remove('active');
    });
    const scriptTab = tabs.find(t => t.name === 'scripts');
    if (scriptTab) {
        scriptTab.btn.classList.add('active');
        scriptTab.screen.classList.add('active');
        activeDashboardTab = 'scripts';
    }
    
    // Fetch script contents
    const data = await executeUnityTool('read_script', { asset_path: assetPath });
    if (data && data.success && data.content !== undefined) {
        if (scriptContentArea) {
            scriptContentArea.innerHTML = '';
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.className = 'script-code-block';
            code.textContent = data.content;
            pre.appendChild(code);
            scriptContentArea.appendChild(pre);
        }
    } else {
        let errMsg = '';
        if (data && data.error) errMsg = ` (Hata: ${data.error})`;
        if (scriptContentArea) {
            scriptContentArea.innerHTML = `<p class="empty-state">Script okunamadı${errMsg}.</p>`;
        }
    }
}

const refreshScriptBtn = document.getElementById('refreshScriptBtn');
if (refreshScriptBtn) {
    refreshScriptBtn.addEventListener('click', () => {
        if (currentScriptPath) openScript(currentScriptPath);
    });
}

const copyScriptPathBtn = document.getElementById('copyScriptPathBtn');
if (copyScriptPathBtn) {
    copyScriptPathBtn.addEventListener('click', () => {
        if (currentScriptPath) {
            chatInput.value += ` "${currentScriptPath}"`;
            chatInput.style.height = 'auto';
            chatInput.style.height = (chatInput.scrollHeight) + 'px';
            chatInput.focus();
        }
    });
}


// --- Connection Polling & Auto Refresh ---
async function checkUnityConnection() {
    try {
        const res = await fetch(`${getUnityUrl()}/health`, { method: 'GET' });
        if (res.ok) {
            const data = await res.json();
            statusDot.classList.add('online');
            statusText.textContent = `CONNECTED (v${data.unityVersion})`;

            // Query compilation status to detect errors and trigger popup
            const compileStatus = await executeUnityTool('get_compile_status', {});
            if (compileStatus && compileStatus.success && compileStatus.hasErrors) {
                if (!hasPromptedCompileError && !isChatActive) {
                    hasPromptedCompileError = true;
                    compileErrorModal.style.display = 'flex';
                }
            } else {
                hasPromptedCompileError = false;
            }
            
            // Auto refresh active tab dynamically (Console/Camera are polled separately)
            if (activeDashboardTab === 'hierarchy') refreshHierarchy();
            if (activeDashboardTab === 'assets') refreshAssets();
        } else {
            throw new Error();
        }
    } catch {
        statusDot.classList.remove('online');
        statusText.textContent = 'OFFLINE';
    }
}
setInterval(checkUnityConnection, 3000);
checkUnityConnection();

// --- Live Streams (Console Logs & Viewport Camera Capture) Polling ---
setInterval(async () => {
    if (isChatActive) return; // Skip polling during active AI tool execution to prevent port/state conflicts
    if (statusText.textContent === 'OFFLINE') return; // Skip if offline

    // Console Live Stream (Task 6)
    if (activeDashboardTab === 'console') {
        await refreshConsoleLogs();
    }
    
    // Viewport Live Stream (Task 9)
    if (activeDashboardTab === 'camera') {
        await captureScreenshot('scene');
    }
}, 1000);

closeCompileErrorBtn.addEventListener('click', () => {
    compileErrorModal.style.display = 'none';
});

fixCompileErrorBtn.addEventListener('click', () => {
    compileErrorModal.style.display = 'none';
    chatInput.value = "Unity'de derleme hatası oluştu. Lütfen get_compile_status aracını kullanarak derleme hatalarını al, dosyaları incele ve hataları otomatik olarak düzelt.";
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
    sendBtn.click();
});

// --- OpenLLM-compatible Tools List (Compacted to save token space) ---
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_gameobject',
            description: 'Creates a GameObject.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Name of object.' },
                    position: { type: 'array', items: { type: 'number' }, description: '[x,y,z]' },
                    parent_path: { type: 'string', description: 'Parent path (optional).' }
                },
                required: ['name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_gameobject',
            description: 'Deletes GameObject.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Path (e.g. /Cube).' },
                    confirm: { type: 'boolean', description: 'Must be true.' }
                },
                required: ['path', 'confirm']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_scene_hierarchy',
            description: 'Gets scene hierarchy.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'add_component',
            description: 'Adds component.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string' },
                    component_type: { type: 'string', description: 'Class (e.g. Rigidbody).' }
                },
                required: ['gameobject_path', 'component_type']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'remove_component',
            description: 'Removes component.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string' },
                    component_type: { type: 'string' }
                },
                required: ['gameobject_path', 'component_type']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'set_component_property',
            description: 'Sets property on component.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string' },
                    component_type: { type: 'string' },
                    property: { type: 'string' },
                    value: { type: 'string', description: 'Value (e.g. "5", "true", "[0,1,0]").' }
                },
                required: ['gameobject_path', 'component_type', 'property', 'value']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_script',
            description: 'Reads C# script file.',
            parameters: {
                type: 'object',
                properties: {
                    asset_path: { type: 'string', description: 'e.g. Assets/Player.cs' }
                },
                required: ['asset_path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'write_script',
            description: 'Writes C# script.',
            parameters: {
                type: 'object',
                properties: {
                    asset_path: { type: 'string' },
                    content: { type: 'string', description: 'Complete code.' }
                },
                required: ['asset_path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_script',
            description: 'Creates C# script.',
            parameters: {
                type: 'object',
                properties: {
                    asset_path: { type: 'string' },
                    template: { type: 'string' }
                },
                required: ['asset_path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_compile_status',
            description: 'Gets C# compiler errors.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_console_logs',
            description: 'Gets Editor console logs.',
            parameters: {
                type: 'object',
                properties: {
                    count: { type: 'number' },
                    log_type: { type: 'string', enum: ['Log', 'Warning', 'Error', 'Assert', 'Exception'] }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'run_tests',
            description: 'Runs NUnit tests.',
            parameters: {
                type: 'object',
                properties: {
                    test_mode: { type: 'string', enum: ['EditMode', 'PlayMode'] },
                    filter: { type: 'string' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_test_status',
            description: 'Gets status of running tests.',
            parameters: {
                type: 'object',
                properties: { job_id: { type: 'string' } },
                required: ['job_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_prefab',
            description: 'Saves GameObject to prefab.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string' },
                    save_path: { type: 'string', description: 'e.g. Assets/Prefab.prefab' }
                },
                required: ['gameobject_path', 'save_path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_assets',
            description: 'Lists assets in folder.',
            parameters: {
                type: 'object',
                properties: {
                    folder_path: { type: 'string' },
                    filter: { type: 'string' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_project_info',
            description: 'Gets project metadata.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'capture_game_view',
            description: 'Takes Game View screenshot.',
            parameters: {
                type: 'object',
                properties: { quality: { type: 'string', enum: ['low', 'medium', 'high'] } }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'capture_scene_view',
            description: 'Takes Scene View screenshot.',
            parameters: {
                type: 'object',
                properties: { quality: { type: 'string', enum: ['low', 'medium', 'high'] } }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'capture_annotated_view',
            description: 'Takes annotated screenshot.',
            parameters: {
                type: 'object',
                properties: {
                    quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                    target_paths: { type: 'array', items: { type: 'string' } }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'enter_play_mode',
            description: 'Enters Play Mode.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'exit_play_mode',
            description: 'Exits Play Mode.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'pause_play_mode',
            description: 'Pauses game play.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'step_frame',
            description: 'Steps game frame.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'inspect_runtime_value',
            description: 'Reads public member value.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string' },
                    component_type: { type: 'string' },
                    member_name: { type: 'string' }
                },
                required: ['gameobject_path', 'component_type', 'member_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'set_runtime_value',
            description: 'Writes public member value.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string' },
                    component_type: { type: 'string' },
                    member_name: { type: 'string' },
                    value: { type: 'string' }
                },
                required: ['gameobject_path', 'component_type', 'member_name', 'value']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'wait_for_condition',
            description: 'Polls C# condition.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string' },
                    component_type: { type: 'string' },
                    member_name: { type: 'string' },
                    op: { type: 'string', enum: ['==', '!=', '<', '>', '<=', '>='] },
                    value: { type: 'string' },
                    timeout_ms: { type: 'number' }
                },
                required: ['gameobject_path', 'component_type', 'member_name', 'op', 'value']
            }
        }
    }
];

// System Prompts
const PLAN_SYSTEM_PROMPT = `You are a Unity AI Givelopment Assistant running in PLAN MODE.
Your goal is to inspect the project structure, locate relevant scripts, prefabs, and scene objects, and draft a deep, comprehensive implementation plan.

RULES FOR PLAN MODE:
1. You MUST use read-only tools (like get_scene_hierarchy, list_assets, read_script, get_project_info) to investigate the current project state first. Do NOT make assumptions about file paths or scene hierarchies.
2. You MUST NOT use write tools (like create_gameobject, delete_gameobject, write_script, create_prefab) to make changes in this mode. Only read and inspect.
3. Once you have gathered sufficient context, write a detailed, step-by-step markdown implementation plan.
4. The plan must include:
   - **Mevcut Durum Analizi**: What files/GameObjects were found.
   - **Değişiklik Planı**: Exactly what scripts will be modified, what new objects/components will be added.
   - **Görev Listesi**: A clear checklist of implementation tasks.
   - **Doğrulama Adımları**: How to verify the changes (e.g., playmode tests, console verification).
5. Do not suggest or write code inside the plan itself, just describe the changes and structure. Wait for the user to approve the plan.
6. If the task has multiple alternative ways to solve (or if you want to let the user select between different choices), you MUST explicitly list them as options in your markdown text using the exact syntax:
   [SEÇENEK 1]: Option Title - Option Description
   [SEÇENEK 2]: Option Title - Option Description
   [SEÇENEK 3]: Option Title - Option Description
   [SEÇENEK 4]: Option Title - Option Description`;

const BUILD_SYSTEM_PROMPT = `You are a Unity AI Givelopment Assistant running in BUILD MODE.
Execute the approved plan using the available Unity tools.
You have access to tools to modify the scene, write scripts, build prefabs, run tests, and capture screenshots.
Always call the tools to execute changes, and verify success.`;

let thinkingInterval = null;

function appendThinkingPlaceholder() {
    const row = document.createElement('div');
    row.className = 'message-row assistant thinking-placeholder-row';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble thinking-placeholder-bubble';
    
    bubble.innerHTML = `
        <div class="thinking-spinner-container">
            <div class="brain-glow-ring"></div>
            <div class="brain-pulse-icon">🧠</div>
            <div class="thinking-text-stream">
                <span class="thinking-word">Yapay Zeka Düşünüyor<span class="thinking-dots">...</span></span>
            </div>
        </div>
        <div class="thinking-sub-status" id="thinkingSubStatus" style="transition: opacity 0.3s ease;">
            Orkestra Şefi sahne mimarisini ve hedefleri analiz ediyor...
        </div>
        <div class="thinking-progress-bar-container">
            <div class="thinking-progress-bar"></div>
        </div>
    `;
    
    row.appendChild(bubble);
    chatFeed.appendChild(row);
    chatFeed.scrollTop = chatFeed.scrollHeight;
    
    const phrases = [
        "Orkestra Şefi sahne mimarisini ve hedefleri analiz ediyor...",
        "Unity sahne hiyerarşisi ve nesneleri taranıyor...",
        "C# kod dosyaları ve derleme durumu kontrol ediliyor...",
        "Görev uzman alt ajanlar arasında koordine ediliyor...",
        "Ajanlar gerekli araç çağrılarını ve değişiklikleri planlıyor...",
        "Derleme planı ve fizik bileşenleri optimize ediliyor..."
    ];
    
    let currentIdx = 0;
    const subStatusEl = bubble.querySelector('#thinkingSubStatus');
    
    if (thinkingInterval) clearInterval(thinkingInterval);
    thinkingInterval = setInterval(() => {
        if (!document.body.contains(row)) {
            clearInterval(thinkingInterval);
            return;
        }
        currentIdx = (currentIdx + 1) % phrases.length;
        if (subStatusEl) {
            subStatusEl.style.opacity = '0';
            setTimeout(() => {
                subStatusEl.textContent = phrases[currentIdx];
                subStatusEl.style.opacity = '1';
            }, 300);
        }
    }, 4000);
    
    return row;
}

function appendMessage(role, text, reasoningText = '', durationSeconds = 0, imageUrl = '') {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    let finalReasoning = reasoningText || '';
    let resultContent = text || '';
    
    if (!finalReasoning && text) {
        const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
        const match = text.match(thinkRegex);
        if (match) {
            finalReasoning = match[1].trim();
            resultContent = text.replace(thinkRegex, '').trim();
        }
    }
    
    const formatHTML = (input) => {
        if (!input) return '';
        return input
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`\n]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    };
    
    if (finalReasoning) {
        const accordion = document.createElement('div');
        accordion.className = 'thinking-accordion';
        
        const header = document.createElement('div');
        header.className = 'thinking-accordion-header';
        
        const durationText = durationSeconds > 0 ? ` (${durationSeconds} saniye sürdü)` : '';
        header.innerHTML = `<span>🧠 DÜŞÜNME SÜRECİ${durationText}</span><span class="chevron">▼</span>`;
        
        const body = document.createElement('div');
        body.className = 'thinking-accordion-body';
        body.innerHTML = formatHTML(finalReasoning);
        
        accordion.appendChild(header);
        accordion.appendChild(body);
        
        header.addEventListener('click', () => {
            accordion.classList.toggle('open');
        });
        
        bubble.appendChild(accordion);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatHTML(resultContent);
    bubble.appendChild(contentDiv);

    if (imageUrl) {
        const attachedImg = document.createElement('img');
        attachedImg.src = imageUrl;
        attachedImg.style.maxWidth = '100%';
        attachedImg.style.maxHeight = '250px';
        attachedImg.style.borderRadius = '8px';
        attachedImg.style.marginTop = '8px';
        attachedImg.style.display = 'block';
        bubble.appendChild(attachedImg);
    }
    
    row.appendChild(bubble);
    chatFeed.appendChild(row);
    chatFeed.scrollTop = chatFeed.scrollHeight;
    return bubble;
}

function appendToolBox(name, args) {
    const box = document.createElement('div');
    box.className = 'tool-execution-box';
    
    const header = document.createElement('div');
    header.className = 'tool-header';
    header.innerHTML = `<span>⚙️ ARAÇ ÇAĞRISI: <strong>${name}</strong></span><span class="tool-status running">ÇALIŞTIRILIYOR...</span>`;
    box.appendChild(header);
    
    const body = document.createElement('div');
    body.className = 'tool-body';
    body.textContent = `Argümanlar:\n${JSON.stringify(args, null, 2)}`;
    box.appendChild(body);
    
    chatFeed.appendChild(box);
    chatFeed.scrollTop = chatFeed.scrollHeight;
    
    return {
        updateStatus: (statusText, isError = false) => {
            const statusSpan = header.querySelector('.tool-status');
            statusSpan.textContent = statusText.toUpperCase();
            statusSpan.className = `tool-status ${isError ? 'error' : 'success'}`;
        },
        appendOutput: (output) => {
            body.textContent += `\n\nYanıt:\n${JSON.stringify(output, null, 2)}`;
            
            // If the response contains a base64 screenshot, render it inside the tool box in the chat feed
            if (output && output.image_base64) {
                const img = document.createElement('img');
                img.className = 'screenshot-image';
                img.style.maxWidth = '100%';
                img.style.marginTop = '12px';
                img.style.border = '1px solid var(--border-color)';
                img.style.borderRadius = '10px';
                img.src = `data:image/png;base64,${output.image_base64}`;
                body.appendChild(img);
                
                // Also update the Camera Tab container inside the dashboard
                const screenshotContainer = document.getElementById('screenshotContainer');
                if (screenshotContainer) {
                    screenshotContainer.innerHTML = '';
                    const mainImg = img.cloneNode(true);
                    mainImg.style.maxWidth = '100%';
                    mainImg.style.marginTop = '0';
                    mainImg.style.border = 'none';
                    mainImg.style.borderRadius = '0';
                    screenshotContainer.appendChild(mainImg);
                }
            }
            chatFeed.scrollTop = chatFeed.scrollHeight;
        }
    };
}

function appendPlanConfirmPanel() {
    const lastMsg = messageHistory[messageHistory.length - 1];
    let options = [];
    let tasks = [];

    if (lastMsg && lastMsg.role === 'assistant') {
        const content = lastMsg.content || '';
        // Match [SEÇENEK X]: Title
        const optionRegex = /\[SEÇENEK\s*(\d+)\]:\s*([^\n\r]+)/gi;
        let match;
        while ((match = optionRegex.exec(content)) !== null) {
            options.push({
                num: match[1],
                title: match[2].trim()
            });
        }

        // If no options exist, parse tasks / checkboxes
        if (options.length === 0) {
            const lines = content.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('`')) return;
                
                // Match - [ ] or - [x]
                if (trimmed.match(/^-\s*\[[ x]\]\s*(.+)/i)) {
                    const tMatch = trimmed.match(/^-\s*\[[ x]\]\s*(.+)/i);
                    tasks.push(tMatch[1].trim());
                }
            });
        }
    }

    const container = document.getElementById('floatingOptionsContainer');
    if (!container) return;

    // Reset container contents and slide up
    container.innerHTML = '';
    container.style.display = 'flex';

    if (options.length > 0) {
        // --- Option Cards Mode ---
        let listHtml = '';
        options.forEach((opt, idx) => {
            const isSelected = idx === 0 ? 'selected' : '';
            listHtml += `
                <div class="floating-option-card ${isSelected}" data-num="${opt.num}" data-title="${opt.title}">
                    <div class="floating-option-num">${opt.num}</div>
                    <div class="floating-option-text">${opt.title}</div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="floating-options-header">
                <span class="floating-options-title">🔮 Alternatif Çözüm Yolları Mevcut</span>
                <button class="floating-options-close" id="floatingCloseBtn">×</button>
            </div>
            <div class="floating-options-grid">
                ${listHtml}
            </div>
            <div class="floating-actions-row">
                <button class="floating-btn-skip" id="floatingSkipBtn">ATLA</button>
                <button class="floating-btn-submit" id="floatingSubmitBtn">SEÇİLEN PLANI DERLE VE UYGULA</button>
            </div>
        `;

        let selectedNum = options[0].num;
        let selectedTitle = options[0].title;

        // Card click handler
        const cards = container.querySelectorAll('.floating-option-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                cards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedNum = card.getAttribute('data-num');
                selectedTitle = card.getAttribute('data-title');
            });
        });

        // Close/Skip handlers
        container.querySelector('#floatingCloseBtn').addEventListener('click', () => {
            container.style.display = 'none';
        });
        container.querySelector('#floatingSkipBtn').addEventListener('click', () => {
            container.style.display = 'none';
            appendMessage('assistant', 'Planlama aşaması atlandı. Karar bekleniyor.');
        });

        // Submit handler
        container.querySelector('#floatingSubmitBtn').addEventListener('click', () => {
            container.style.display = 'none';
            
            // Switch mode
            currentMode = 'build';
            buildModeBtn.classList.add('active');
            planModeBtn.classList.remove('active');
            modeStatusText.textContent = 'BUILD MODU AKTİF';

            // Append choice to history
            const choiceText = `Seçilen ve onaylanan seçenek: [SEÇENEK ${selectedNum}]: ${selectedTitle}. Lütfen sadece bu seçeneğe göre derleme ve entegrasyonu tamamla.`;
            appendMessage('assistant', `🛠️ **Seçenek ${selectedNum} seçildi:** ${selectedTitle}\n\nBuild Moduna geçildi. Değişiklikler uygulanıyor...`);
            
            messageHistory.push({
                role: 'user',
                content: choiceText
            });

            runBuildProcess();
        });

    } else if (tasks.length > 0) {
        // --- Task Checklist Mode ---
        let checklistHtml = '';
        tasks.forEach((task, idx) => {
            checklistHtml += `
                <div class="plan-checklist-item" data-index="${idx}" style="margin-bottom: 4px;">
                    <div class="checklist-checkbox"></div>
                    <span class="checklist-item-text">${task}</span>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="floating-options-header">
                <span class="floating-options-title">🛠️ Plan Görevlerini Seçin</span>
                <button class="floating-options-close" id="floatingCloseBtn">×</button>
            </div>
            <div class="plan-checklist-container" style="max-height: 140px; margin-top: 4px;">
                ${checklistHtml}
            </div>
            <div class="floating-actions-row">
                <button class="floating-btn-skip" id="floatingSkipBtn">ATLA</button>
                <button class="floating-btn-submit" id="floatingSubmitBtn">SEÇİLEN GÖREVLERİ UYGULA</button>
            </div>
        `;

        // Checkbox click handlers
        const items = container.querySelectorAll('.plan-checklist-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('unchecked');
            });
        });

        // Close/Skip handlers
        container.querySelector('#floatingCloseBtn').addEventListener('click', () => {
            container.style.display = 'none';
        });
        container.querySelector('#floatingSkipBtn').addEventListener('click', () => {
            container.style.display = 'none';
            appendMessage('assistant', 'Plan onaylama atlandı.');
        });

        // Submit handler
        container.querySelector('#floatingSubmitBtn').addEventListener('click', () => {
            container.style.display = 'none';

            // Collect approved and skipped tasks
            const approved = [];
            const skipped = [];
            items.forEach(item => {
                const text = item.querySelector('.checklist-item-text').textContent;
                if (item.classList.contains('unchecked')) {
                    skipped.push(text);
                } else {
                    approved.push(text);
                }
            });

            // Switch mode
            currentMode = 'build';
            buildModeBtn.classList.add('active');
            planModeBtn.classList.remove('active');
            modeStatusText.textContent = 'BUILD MODU AKTİF';

            // Construct message content
            let choiceText = 'Plan onaylandı!\n\n**Uygulanacak Görevler:**\n';
            approved.forEach(t => choiceText += `- ${t}\n`);
            if (skipped.length > 0) {
                choiceText += '\n**Atlanacak/Uygulanmayacak Görevler:**\n';
                skipped.forEach(t => choiceText += `- ${t}\n`);
            }

            appendMessage('assistant', `🛠️ **Seçilen plan görevleri onaylandı.** (${approved.length} görev seçildi, ${skipped.length} atlandı).\n\nBuild Moduna geçildi. Değişiklikler uygulanıyor...`);

            messageHistory.push({
                role: 'user',
                content: choiceText + '\nLütfen sadece onaylanan görevleri uygulamaya başla.'
            });

            runBuildProcess();
        });

    } else {
        // --- Default Mode ---
        container.innerHTML = `
            <div class="floating-options-header">
                <span class="floating-options-title">🔮 PLAN HAZIRLANDI</span>
                <button class="floating-options-close" id="floatingCloseBtn">×</button>
            </div>
            <div style="font-size: 11px; color: var(--text-primary); margin-top: 4px; margin-bottom: 8px;">
                Yapay zekanın planını onaylayıp Build Moduna geçerek değişiklikleri uygulamak ister misiniz?
            </div>
            <div class="floating-actions-row">
                <button class="floating-btn-skip" id="floatingSkipBtn">İPTAL</button>
                <button class="floating-btn-submit" id="floatingSubmitBtn">PLANI ONAYLA VE DERLE</button>
            </div>
        `;

        container.querySelector('#floatingCloseBtn').addEventListener('click', () => {
            container.style.display = 'none';
        });
        container.querySelector('#floatingSkipBtn').addEventListener('click', () => {
            container.style.display = 'none';
        });

        container.querySelector('#floatingSubmitBtn').addEventListener('click', () => {
            container.style.display = 'none';
            currentMode = 'build';
            buildModeBtn.classList.add('active');
            planModeBtn.classList.remove('active');
            modeStatusText.textContent = 'BUILD MODU AKTİF';
            appendMessage('assistant', 'Plan onaylandı! 🛠️ Build Moduna geçildi. Değişiklikleri uygulamaya başlıyorum.');
            runBuildProcess();
        });
    }
}

// --- Network HTTP Calls ---
async function executeUnityTool(name, args) {
    try {
        const response = await fetch(`${getUnityUrl()}/tools/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
        });
        const result = await response.json();
        
        let innerData = result;
        // If wrapped in a C# dispatcher response envelope, unwrap the inner tool data
        if (result && result.hasOwnProperty('data') && result.data !== null) {
            innerData = result.data;
        }

        // Forward C# tool execution warnings/errors to command line terminal
        if (innerData && innerData.success === false && innerData.error) {
            let errorMsg = innerData.error;
            if (typeof errorMsg === 'object' && errorMsg !== null) {
                errorMsg = errorMsg.message || JSON.stringify(errorMsg);
            }
            if (window.electronAPI && window.electronAPI.logToTerminal) {
                window.electronAPI.logToTerminal('warn', `Unity Tool Hatası (${name}): ${errorMsg}`);
            }
        }
        return innerData;
    } catch (err) {
        if (window.electronAPI && window.electronAPI.logToTerminal) {
            window.electronAPI.logToTerminal('error', `Unity Bağlantı Hatası (${name}): ${err.message}`);
        }
        return { success: false, error: `Unity bağlantı hatası: ${err.message}` };
    }
}

// --- Multi-Agent (OKS) Configurations & Mappings ---
const AGENT_TOOLS = {
    orchestrator: ['capture_scene_view', 'capture_game_view', 'get_project_info', 'get_scene_hierarchy'],
    scripting: ['write_script', 'get_compile_status'],
    modeling: ['create_probuilder_shape', 'set_component_property', 'list_assets'],
    gui: ['add_component', 'set_component_property', 'prefab_tools'],
    audio: ['add_component', 'set_component_property', 'list_assets'],
    layout: ['add_component', 'set_component_property', 'perform_undo', 'perform_redo']
};

const AGENT_PROMPTS = {
    orchestrator: `Sen Orkestra Şefi (Orchestrator Agent) ajansın. Görevin, kullanıcının Unity geliştirme hedefini alıp analiz etmek, sahne durumunu incelemek ve alt uzman ajanlara (Kod Ajanı, Model Ajanı vb.) görev dağıtımı yapmaktır.
Alt ajanları çağırmak için doğrudan metninde "[GÖREV] <AjanAdı>: <GörevDetayı>" biçiminde yönerge ver. 
Örnek: "[GÖREV] scripting: CarController.cs dosyasına hız limiti ekle."
Mevcut sahnede neler olduğunu anlamak için kamera ve hiyerarşi araçlarını kullanabilirsin.`,

    scripting: `Sen Kod ve Mekanik Ajanı (Scripting Agent) ajansın. Sadece C# kodları yazmak, düzenlemek ve Unity derleme hatalarını gidermek senin uzmanlığındır. 
Gereksiz sahne düzenlemeleri veya materyal atamaları yapma, sadece kod dosyaları oluştur/düzenle. 
Kod yazdıktan sonra mutlaka derleme durumunu kontrol et ve hata varsa otomatik düzelt.`,

    modeling: `Sen 3D Varlık ve Model Ajanı (Modeling/Mesh Agent) ajansın. Sahneye 3D mesh'ler yerleştirmek, model atamaları yapmak (sharedMesh) ve ProBuilder ile geometrik şekiller üretmek senin uzmanlığındır. 
Kod yazmaya çalışma, sadece objelerin mesh ve model özelliklerini değiştir.`,

    gui: `Sen Arayüz Tasarım Ajanı (GUI/UI Agent) ajansın. Sahneye Canvas, Panel, TMP (TextMeshPro) metinler, Butonlar ve HUD elemanları eklemek, UI düzenlerini ayarlamak senin uzmanlığındır.`,

    audio: `Sen Ses ve Müzik Ajanı (Audio Agent) ajansın. Sahnedeki ses kaynaklarını (AudioSource), çalınacak müzikleri (AudioClip) ve ses tetikleyicilerini yönetmek senin uzmanlığındır.`,

    layout: `Sen Düzen ve Fizik Ajanı (Layout & Physics Agent) ajansın. Sahnedeki nesnelerin RigidBody, Collider ve fiziksel özelliklerini ayarlamak, nesneleri konumlandırmak (transform) senin uzmanlığındır.`
};

function mapAgentName(name) {
    const clean = name.toLowerCase().trim();
    if (clean.includes('script') || clean.includes('kod') || clean.includes('mekanik')) return 'scripting';
    if (clean.includes('model') || clean.includes('mesh') || clean.includes('3d')) return 'modeling';
    if (clean.includes('gui') || clean.includes('ui') || clean.includes('arayuz') || clean.includes('arayüz')) return 'gui';
    if (clean.includes('audio') || clean.includes('sound') || clean.includes('ses') || clean.includes('muzik') || clean.includes('müzik')) return 'audio';
    if (clean.includes('layout') || clean.includes('physics') || clean.includes('fizik') || clean.includes('duzen') || clean.includes('düzen')) return 'layout';
    return null;
}

function getAgentDisplayName(key) {
    if (key === 'orchestrator') return 'Orkestra Şefi';
    if (key === 'scripting') return 'Kod & Mekanik Ajanı';
    if (key === 'modeling') return '3D Varlık Ajanı';
    if (key === 'gui') return 'Arayüz Tasarım Ajanı';
    if (key === 'audio') return 'Ses & Müzik Ajanı';
    if (key === 'layout') return 'Düzen & Fizik Ajanı';
    return key;
}

function updateAgentStatus(agentKey, statusText) {
    const card = document.getElementById(`agent-${agentKey}`);
    const statusEl = document.getElementById(`status-${agentKey}`);
    if (statusEl) {
        statusEl.textContent = statusText;
    }
    if (card) {
        card.classList.remove('active', 'success');
        if (statusText.toLowerCase().includes('çalışıyor') || statusText.toLowerCase().includes('düşünüyor')) {
            card.classList.add('active');
            
            // Auto switch to agents tab so user sees active agents
            const agentsTabBtn = document.getElementById('tabAgentsBtn');
            const agentsScreen = document.getElementById('agentsScreen');
            if (agentsTabBtn && agentsScreen && !agentsTabBtn.classList.contains('active')) {
                tabs.forEach(x => {
                    if (x.btn) x.btn.classList.remove('active');
                    if (x.screen) x.screen.classList.remove('active');
                });
                agentsTabBtn.classList.add('active');
                agentsScreen.classList.add('active');
                activeDashboardTab = 'agents';
            }
        } else if (statusText.toLowerCase().includes('tamamladı')) {
            card.classList.add('success');
        }
    }
}

async function callLLM(apiMessages, useTools = false, agentName = 'orchestrator') {
    const endpoint = endpointInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    // Safety check: Truncate/summarize very long intermediate tool/assistant messages to prevent context limit errors
    const sanitizedMessages = apiMessages.map((msg, index) => {
        if (index === 0 || index === apiMessages.length - 1) {
            return msg;
        }

        const copy = { ...msg };

        if (copy.role === 'user') {
            if (Array.isArray(copy.content)) {
                copy.content = copy.content.map(block => {
                    if (block.type === 'image_url') {
                        return { type: 'text', text: '[Görsel verisi önceki turlardan temizlendi]' };
                    }
                    return { ...block };
                });
            }
            if (copy.image_url) {
                delete copy.image_url;
            }
        }

        if (copy.role === 'tool' && copy.content && copy.content.length > 2500) {
            try {
                const parsed = JSON.parse(copy.content);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.hierarchy) {
                        copy.content = JSON.stringify({
                            success: parsed.success,
                            hierarchy_summary: `[Kısaltıldı: ${parsed.hierarchy.length} kök obje bulundu. Sahne ağacı token sınırını korumak için sıkıştırıldı.]`
                        });
                        return copy;
                    }
                    if (parsed.assets) {
                        copy.content = JSON.stringify({
                            success: parsed.success,
                            assets_summary: `[Kısaltıldı: ${parsed.assets.length} dosya listelendi. Klasör yapısı token sınırını korumak için sıkıştırıldı.]`
                        });
                        return copy;
                    }
                    if (parsed.logs) {
                        copy.content = JSON.stringify({
                            success: parsed.success,
                            logs_summary: `[Kısaltıldı: ${parsed.logs.length} konsol satırı listelendi. Loglar sıkıştırıldı.]`
                        });
                        return copy;
                    }
                }
            } catch (e) {}
            copy.content = copy.content.substring(0, 2500) + "\n... [Büyük yanıt içeriği token sınırını aşmamak için sıkıştırıldı] ...";
        }

        if (copy.role === 'assistant' && copy.content && copy.content.length > 3000) {
            copy.content = copy.content.substring(0, 3000) + "\n... [Büyük asistan yanıt içeriği sıkıştırıldı] ...";
        }

        return copy;
    });

    let finalMessages = sanitizedMessages;
    if (agentName && AGENT_PROMPTS[agentName]) {
        finalMessages = [...sanitizedMessages];
        finalMessages[0] = {
            role: 'system',
            content: AGENT_PROMPTS[agentName]
        };
    }

    const requestBody = {
        model: model,
        messages: finalMessages,
        temperature: 0.2
    };

    if (useTools) {
        let activeTools = TOOLS;
        if (agentName && AGENT_TOOLS[agentName]) {
            activeTools = TOOLS.filter(t => AGENT_TOOLS[agentName].includes(t.function.name));
        }
        requestBody.tools = activeTools;
        requestBody.tool_choice = 'auto';
    }

    const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Hatası (${res.status}): ${errorText}`);
    }

    return await res.json();
}

// --- Chat Actions & Loops ---
sendBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

let activeStatusBubble = null;

function setStatusMessage(message) {
    let prefix = '';
    if (message.includes("Yapay zeka") || message.includes("arıyoruz") || message.includes("bekleniyor")) {
        prefix = '<span class="thinking-pulse"></span>';
    }
    if (activeStatusBubble) {
        activeStatusBubble.innerHTML = `${prefix}${message}`;
    } else {
        activeStatusBubble = appendMessage('assistant', `${prefix}${message}`);
        activeStatusBubble.classList.add('status-ticker');
    }
}

function clearStatusMessage() {
    if (activeStatusBubble) {
        const row = activeStatusBubble.closest('.message-row');
        if (row) row.remove();
        activeStatusBubble = null;
    }
}

async function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text && !attachedImageBase64) return;
    if (isChatActive) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    appendMessage('user', text, '', 0, attachedImageBase64 || '');

    let userMsgContent = text;
    if (attachedImageBase64) {
        userMsgContent = [
            { type: 'text', text: text || 'Bu görseli analiz et.' }
        ];
        userMsgContent.push({
            type: 'image_url',
            image_url: { url: attachedImageBase64 }
        });
    }

    const newMsg = { role: 'user', content: userMsgContent };
    if (attachedImageBase64) {
        newMsg.image_url = attachedImageBase64;
    }
    messageHistory.push(newMsg);

    // Clear attached image preview UI immediately on send
    attachedImageBase64 = null;
    if (imagePreviewContainer) {
        imagePreviewContainer.style.display = 'none';
        attachedImagePreview.src = '';
    }

    isChatActive = true;
    sendBtn.disabled = true;

    try {
        if (currentMode === 'plan') {
            await runPlanProcess();
        } else {
            await runBuildProcess();
        }
    } catch (error) {
        appendMessage('assistant', `⚠️ Hata oluştu: ${error.message}`);
        if (window.electronAPI && window.electronAPI.logToTerminal) {
            window.electronAPI.logToTerminal('error', `Sohbet İşlem Hatası: ${error.message}`);
        }
    } finally {
        clearStatusMessage();
        isChatActive = false;
        sendBtn.disabled = false;
        
        attachedImageBase64 = null;
        if (imagePreviewContainer) {
            imagePreviewContainer.style.display = 'none';
            attachedImagePreview.src = '';
        }
        
        // Filter out intermediate tool result messages, and strip tool_calls from assistant messages
        messageHistory = messageHistory
            .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.content))
            .map(msg => {
                if (msg.role === 'assistant' && msg.tool_calls) {
                    return { role: 'assistant', content: msg.content };
                }
                return msg;
            });

        // Keep only the last 14 messages (approx. 7 turns) to prevent 400 Bad Request Context Limit Exceeded errors
        const MAX_HISTORY = 14;
        if (messageHistory.length > MAX_HISTORY) {
            const removedMessages = messageHistory.slice(0, messageHistory.length - MAX_HISTORY);
            messageHistory = messageHistory.slice(messageHistory.length - MAX_HISTORY);

            let newSummaryItems = [];
            removedMessages.forEach(msg => {
                if (msg.role === 'user' && msg.content) {
                    newSummaryItems.push(`User requested: "${msg.content.substring(0, 80)}"`);
                } else if (msg.role === 'assistant' && msg.content) {
                    if (msg.content.includes("```")) {
                        newSummaryItems.push("Assistant performed editor modifications.");
                    } else {
                        newSummaryItems.push(`Assistant replied: "${msg.content.substring(0, 80)}..."`);
                    }
                }
            });

            if (newSummaryItems.length > 0) {
                let aggregate = newSummaryItems.join("\n- ");
                if (historySummary) {
                    historySummary += "\n- " + aggregate;
                } else {
                    historySummary = "Önceki sohbet adımlarının özeti:\n- " + aggregate;
                }

                const lines = historySummary.split("\n");
                if (lines.length > 12) {
                    historySummary = "Önceki sohbet adımlarının özeti:\n" + lines.slice(lines.length - 10).join("\n");
                }
            }
        }

        // Auto-save the current conversation history state
        saveCurrentChat();

        // Auto refresh hierarchy after tools execution loop ends
        setTimeout(refreshHierarchy, 1000);
    }
}

async function sendChatToUnity(mode) {
    const endpoint = endpointInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    const disabledAgents = [];
    ['scripting', 'modeling', 'gui', 'audio', 'layout'].forEach(k => {
        const el = document.getElementById(`agentEnable_${k}`);
        if (el && !el.checked) {
            disabledAgents.push(k);
        }
    });

    const requestPayload = {
        apiKey: apiKey,
        endpoint: endpoint,
        model: model,
        mode: mode,
        messages: messageHistory,
        tools: TOOLS,
        deepThinking: deepThinkingToggle ? deepThinkingToggle.checked : false,
        temperature: parseFloat(tempInput.value) || 0.2,
        maxTokens: parseInt(maxTokensInput.value) || 4096,
        customPrompt: customPromptInput.value.trim(),
        maxLoops: parseInt(maxLoopsInput.value) || 6,
        disabledAgents: disabledAgents
    };

    setStatusMessage("🤖 Orkestra Şefi C# tarafında çalışıyor...");

    if (mode === 'build') {
        ['scripting', 'modeling', 'gui', 'audio', 'layout'].forEach(k => {
            updateAgentStatus(k, 'Boşta');
        });
    }

    const thinkingPlaceholder = appendThinkingPlaceholder();

    try {
        const response = await fetch(`${getUnityUrl()}/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`C# Orkestrasyon Hatası: ${errText}`);
        }

        const result = await response.json();
        clearStatusMessage();

        if (!result || !result.success) {
            throw new Error(result.error || "Bilinmeyen sunucu hatası");
        }

        // Update token usage counter
        const tokenBadge = document.getElementById('tokenCounterBadge');
        const tokenText = document.getElementById('tokenCounterText');
        if (tokenBadge && tokenText && typeof result.totalTokens !== 'undefined') {
            tokenBadge.style.display = 'inline-flex';
            const formatNum = (num) => num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num;
            tokenText.textContent = `${formatNum(result.totalTokens)} / 150k`;
            tokenText.title = `Prompt: ${result.promptTokens.toLocaleString()} | Completion: ${result.completionTokens.toLocaleString()} | Total: ${result.totalTokens.toLocaleString()}`;
        }

        if (result.agentStates && Array.isArray(result.agentStates)) {
            result.agentStates.forEach(update => {
                updateAgentStatus(update.agent, update.status);
            });
        }

        if (result.toolExecutions && Array.isArray(result.toolExecutions)) {
            result.toolExecutions.forEach(exec => {
                let argsObj = {};
                try {
                    argsObj = JSON.parse(exec.arguments);
                } catch(e) {
                    argsObj = exec.arguments;
                }
                let outputObj = {};
                try {
                    outputObj = JSON.parse(exec.output);
                } catch(e) {
                    outputObj = exec.output;
                }
                const uiBox = appendToolBox(exec.name, argsObj);
                if (uiBox) {
                    uiBox.updateStatus(outputObj.success !== false ? 'Tamamlandı' : 'Hata Oluştu', outputObj.success === false);
                    uiBox.appendOutput(outputObj);
                }
            });
        }

        if (result.messages && Array.isArray(result.messages)) {
            result.messages.forEach(msg => {
                messageHistory.push(msg);

                if (msg.role === 'assistant') {
                    appendMessage('assistant', msg.content, msg.reasoning_content || '');
                } else if (msg.role === 'user') {
                    appendMessage('assistant', `ℹ️ *${msg.content}*`);
                }
            });
        }

        const allKeys = ['orchestrator', 'scripting', 'modeling', 'gui', 'audio', 'layout'];
        allKeys.forEach(k => {
            const card = document.getElementById(`agent-${k}`);
            if (card) {
                card.classList.remove('active');
                const statusEl = document.getElementById(`status-${k}`);
                if (statusEl && statusEl.textContent.includes('Tamamladı')) {
                    card.classList.add('success');
                }
            }
        });
    } finally {
        if (thinkingPlaceholder) {
            thinkingPlaceholder.remove();
        }
        if (thinkingInterval) {
            clearInterval(thinkingInterval);
        }
    }
}

async function runPlanProcess() {
    await sendChatToUnity('plan');
    appendPlanConfirmPanel();
}

async function runBuildProcess() {
    await sendChatToUnity('build');
}

// --- Chat History / Saved Conversations Implementation ---
function secureWrite(key, data) {
    try {
        const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
        const cipherKey = 42;
        let scrambled = '';
        for (let i = 0; i < plaintext.length; i++) {
            scrambled += String.fromCharCode(plaintext.charCodeAt(i) ^ cipherKey);
        }
        const encoded = btoa(unescape(encodeURIComponent(scrambled)));
        localStorage.setItem(key, encoded);
    } catch (e) {
        console.error("Storage encryption failed", e);
    }
}

function secureRead(key) {
    try {
        const encoded = localStorage.getItem(key);
        if (!encoded) return null;
        const scrambled = decodeURIComponent(escape(atob(encoded)));
        const cipherKey = 42;
        let plaintext = '';
        for (let i = 0; i < scrambled.length; i++) {
            plaintext += String.fromCharCode(scrambled.charCodeAt(i) ^ cipherKey);
        }
        return plaintext;
    } catch (e) {
        console.error("Storage decryption failed", e);
        return null;
    }
}

function saveCurrentChat() {
    if (!messageHistory || messageHistory.length === 0) return;

    // Retrieve saved chats
    let savedConversations = [];
    try {
        const raw = secureRead('unity_studio_saved_chats');
        if (raw) savedConversations = JSON.parse(raw);
    } catch (e) {
        savedConversations = [];
    }

    // If active chat is new, generate an ID
    if (!currentChatId) {
        currentChatId = Date.now().toString();
    }

    // Try to find if this chat already exists
    let existingChat = savedConversations.find(c => c.id === currentChatId);

    // Compute title based on the first user message
    let title = "Yeni Sohbet";
    const firstUserMsg = messageHistory.find(m => m.role === 'user');
    if (firstUserMsg && firstUserMsg.content) {
        title = firstUserMsg.content.substring(0, 30);
        if (firstUserMsg.content.length > 30) title += "...";
    }

    if (existingChat) {
        existingChat.title = title;
        existingChat.history = messageHistory;
        existingChat.mode = currentMode;
        existingChat.timestamp = Date.now();
    } else {
        savedConversations.push({
            id: currentChatId,
            title: title,
            history: messageHistory,
            mode: currentMode,
            timestamp: Date.now()
        });
    }

    // Sort by most recent timestamp
    savedConversations.sort((a, b) => b.timestamp - a.timestamp);

    secureWrite('unity_studio_saved_chats', savedConversations);
    renderSavedChatsList();
}

function renderSavedChatsList() {
    const listContainer = document.getElementById('savedChatsList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    let savedConversations = [];
    try {
        const raw = secureRead('unity_studio_saved_chats');
        if (raw) savedConversations = JSON.parse(raw);
    } catch (e) {
        savedConversations = [];
    }

    if (savedConversations.length === 0) {
        listContainer.innerHTML = '<p class="empty-state" style="text-align: center; margin-top: 10px;">Kayıtlı sohbet bulunamadı.</p>';
        return;
    }

    savedConversations.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-history-item${chat.id === currentChatId ? ' active' : ''}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-history-title';
        titleSpan.textContent = chat.title;
        titleSpan.title = chat.title;
        
        // Load chat on click
        titleSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            loadChat(chat.id);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-history-delete-btn';
        deleteBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        item.appendChild(titleSpan);
        item.appendChild(deleteBtn);
        listContainer.appendChild(item);
    });
}

function loadChat(chatId) {
    let savedConversations = [];
    try {
        const raw = secureRead('unity_studio_saved_chats');
        if (raw) savedConversations = JSON.parse(raw);
    } catch (e) {
        return;
    }

    const chat = savedConversations.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;
    messageHistory = chat.history;
    currentMode = chat.mode || 'plan';

    // Update Mode button UI
    if (currentMode === 'plan') {
        planModeBtn.classList.add('active');
        buildModeBtn.classList.remove('active');
        modeStatusText.textContent = 'PLAN MODU AKTİF';
    } else {
        buildModeBtn.classList.add('active');
        planModeBtn.classList.remove('active');
        modeStatusText.textContent = 'BUILD MODU AKTİF';
    }

    // Clear feed and re-render messages
    chatFeed.innerHTML = '';
    
    // We recreate message rows one by one
    messageHistory.forEach(msg => {
        if (msg.role === 'user') {
            let text = '';
            let imageUrl = '';
            if (Array.isArray(msg.content)) {
                const textBlock = msg.content.find(c => c.type === 'text');
                const imageBlock = msg.content.find(c => c.type === 'image_url');
                if (textBlock) text = textBlock.text;
                if (imageBlock) imageUrl = imageBlock.image_url.url;
            } else {
                text = msg.content || '';
                imageUrl = msg.image_url || '';
            }
            if (text.trim() !== '' || imageUrl !== '') {
                appendMessage('user', text, '', 0, imageUrl);
            }
        } else if (msg.role === 'assistant') {
            const content = msg.content || '';
            const reasoning = msg.reasoning_content || '';
            if (content.trim() !== '' || reasoning.trim() !== '') {
                appendMessage('assistant', content, reasoning);
            }
        }
    });

    renderSavedChatsList();
    settingsDrawer.classList.remove('open');
    chatFeed.scrollTop = chatFeed.scrollHeight;
}

function deleteChat(chatId) {
    let savedConversations = [];
    try {
        const raw = secureRead('unity_studio_saved_chats');
        if (raw) savedConversations = JSON.parse(raw);
    } catch (e) {
        return;
    }

    savedConversations = savedConversations.filter(c => c.id !== chatId);
    secureWrite('unity_studio_saved_chats', savedConversations);

    // If deleted chat was the active one, start a new chat
    if (currentChatId === chatId) {
        startNewChat();
    } else {
        renderSavedChatsList();
    }
}

function startNewChat() {
    currentChatId = null;
    messageHistory = [];
    chatFeed.innerHTML = `
        <div class="welcome-box">
            <h2>Hoş Geldiniz 🔮</h2>
            <p>Unity AI Givelopment Studio aktif. Plan veya Derleme moduna geçip Unity projenizi yönetmeye başlayabilirsiniz.</p>
        </div>
    `;
    renderSavedChatsList();
    settingsDrawer.classList.remove('open');
}

// Bind New Chat button
const newChatBtn = document.getElementById('newChatBtn');
if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewChat);
}

// Initial render of conversations list
renderSavedChatsList();

