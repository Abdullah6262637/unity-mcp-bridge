// Unity MCP Bridge Web Client (Direct Unity Studio Edition)

// Connection Settings
const UNITY_URL = 'http://127.0.0.1:8090';

// Mode & Tab States
let currentMode = 'plan'; // 'plan' or 'build'
let isChatActive = false;
let messageHistory = [];
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
const clearChatBtn = document.getElementById('clearChatBtn');
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
    { btn: tabCameraBtn, screen: cameraScreen, name: 'camera' }
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

// --- Settings Drawer Bindings ---
const deepThinkingToggle = document.getElementById('deepThinkingToggle');
if (deepThinkingToggle) {
    deepThinkingToggle.checked = localStorage.getItem('deep_thinking_enabled') === 'true';
    deepThinkingToggle.addEventListener('change', () => {
        localStorage.setItem('deep_thinking_enabled', deepThinkingToggle.checked);
    });
}

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
        renderHierarchy(data.hierarchy);
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
        const res = await fetch(`${UNITY_URL}/health`, { method: 'GET' });
        if (res.ok) {
            const data = await res.json();
            statusDot.classList.add('online');
            statusText.textContent = `CONNECTED (v${data.unityVersion})`;
            
            // Auto refresh active tab dynamically
            if (activeDashboardTab === 'hierarchy') refreshHierarchy();
            if (activeDashboardTab === 'assets') refreshAssets();
            if (activeDashboardTab === 'console') refreshConsoleLogs();
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
5. Do not suggest or write code inside the plan itself, just describe the changes and structure. Wait for the user to approve the plan.`;

const BUILD_SYSTEM_PROMPT = `You are a Unity AI Givelopment Assistant running in BUILD MODE.
Execute the approved plan using the available Unity tools.
You have access to tools to modify the scene, write scripts, build prefabs, run tests, and capture screenshots.
Always call the tools to execute changes, and verify success.`;

function appendMessage(role, text, reasoningText = '', durationSeconds = 0) {
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
    const box = document.createElement('div');
    box.className = 'plan-confirmation-box';
    box.innerHTML = `
        <h4>PLAN HAZIRLANDI! 🔮</h4>
        <p>Planı onaylayıp Build Moduna geçerek değişiklikleri uygulamak ister misiniz?</p>
        <button class="plan-confirm-btn" id="confirmPlanBtn">PLANi ONAYLA VE DERLE</button>
    `;
    chatFeed.appendChild(box);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    document.getElementById('confirmPlanBtn').addEventListener('click', () => {
        box.remove();
        currentMode = 'build';
        buildModeBtn.classList.add('active');
        planModeBtn.classList.remove('active');
        modeStatusText.textContent = 'BUILD MODU AKTİF';
        appendMessage('assistant', 'Plan onaylandı! 🛠️ Build Moduna geçildi. Değişiklikleri uygulamaya başlıyorum.');
        runBuildProcess();
    });
}

// --- Network HTTP Calls ---
async function executeUnityTool(name, args) {
    try {
        const response = await fetch(`${UNITY_URL}/tools/${name}`, {
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
            if (window.electronAPI && window.electronAPI.logToTerminal) {
                window.electronAPI.logToTerminal('warn', `Unity Tool Hatası (${name}): ${innerData.error}`);
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

async function callLLM(apiMessages, useTools = false) {
    const endpoint = endpointInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    const requestBody = {
        model: model,
        messages: apiMessages,
        temperature: 0.2
    };

    if (useTools) {
        requestBody.tools = TOOLS;
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
    if (!text || isChatActive) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    appendMessage('user', text);
    messageHistory.push({ role: 'user', content: text });

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
        
        // Prune intermediate tool details to save LLM context window space and avoid limit failures
        messageHistory = messageHistory.filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.content));

        // Keep only the last 14 messages (approx. 7 turns) to prevent 400 Bad Request Context Limit Exceeded errors
        const MAX_HISTORY = 14;
        if (messageHistory.length > MAX_HISTORY) {
            messageHistory = messageHistory.slice(messageHistory.length - MAX_HISTORY);
        }

        // Auto refresh hierarchy after tools execution loop ends
        setTimeout(refreshHierarchy, 1000);
    }
}

async function runPlanProcess() {
    let continueLoop = true;
    let loopCount = 0;
    const maxLoops = 6; // Limit loops for planning to avoid infinite tool calls
    let hasExecutedTools = false;
    let hasSentTextMessageAfterTools = false;

    while (continueLoop && loopCount < maxLoops) {
        loopCount++;
        
        let systemPrompt = PLAN_SYSTEM_PROMPT;
        if (deepThinkingToggle && deepThinkingToggle.checked) {
            systemPrompt += "\n\nÖNEMLİ: Cevap vermeden önce detaylı ve aşamalı düşünme sürecini mutlaka <think>...</think> etiketleri arasında yaz.";
        }

        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messageHistory
        ];

        setStatusMessage("🤖 Yapay zeka yanıt/plan taslağı hazırlıyor...");
        const startTime = Date.now();
        const result = await callLLM(apiMessages, true);
        const durationSeconds = Math.round((Date.now() - startTime) / 1000);
        const choice = result.choices[0];
        const msg = choice.message;

        if (msg.content) {
            clearStatusMessage();
            appendMessage('assistant', msg.content, msg.reasoning_content || '', durationSeconds);
            messageHistory.push({ role: 'assistant', content: msg.content });
            if (hasExecutedTools) {
                hasSentTextMessageAfterTools = true;
            }
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
            hasExecutedTools = true;
            messageHistory.push(msg);

            const toolResponses = [];
            for (const toolCall of msg.tool_calls) {
                const name = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                
                let details = '';
                if (args.asset_path) details = `: ${args.asset_path}`;
                else if (args.gameobject_path) details = `: ${args.gameobject_path}`;
                else if (args.path) details = `: ${args.path}`;
                
                setStatusMessage(`⚙️ Unity aracı çalıştırılıyor: <strong>${name}</strong>${details}...`);
                
                // Show tools execution inside the chat
                const uiBox = appendToolBox(name, args);
                
                // Execute the tool
                const output = await executeUnityTool(name, args);
                
                if (uiBox) {
                    uiBox.updateStatus(output.success !== false ? 'Tamamlandı' : 'Hata Oluştu', output.success === false);
                    uiBox.appendOutput(output);
                }

                toolResponses.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: name,
                    content: JSON.stringify(output)
                });
            }

            messageHistory.push(...toolResponses);
        } else {
            continueLoop = false;
        }
    }

    clearStatusMessage();
    
    if (hasExecutedTools && !hasSentTextMessageAfterTools) {
        const fallbackMsg = "📋 İnceleme tamamlandı. Lütfen yukarıdaki araç çıktılarından plan detaylarını kontrol edin.";
        appendMessage('assistant', fallbackMsg);
        messageHistory.push({ role: 'assistant', content: fallbackMsg });
    }
    
    appendPlanConfirmPanel();
}

async function runBuildProcess() {
    let continueLoop = true;
    let loopCount = 0;
    const maxLoops = 10;
    let hasExecutedTools = false;
    let hasSentTextMessageAfterTools = false;

    while (continueLoop && loopCount < maxLoops) {
        loopCount++;
        
        let systemPrompt = BUILD_SYSTEM_PROMPT;
        if (deepThinkingToggle && deepThinkingToggle.checked) {
            systemPrompt += "\n\nÖNEMLİ: Cevap vermeden önce detaylı ve aşamalı düşünme sürecini mutlaka <think>...</think> etiketleri arasında yaz.";
        }

        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messageHistory
        ];

        setStatusMessage("🤖 Yapay zeka kodu yazıyor ve sahneyi güncelliyor...");
        const startTime = Date.now();
        const result = await callLLM(apiMessages, true);
        const durationSeconds = Math.round((Date.now() - startTime) / 1000);
        const choice = result.choices[0];
        const msg = choice.message;

        if (msg.content) {
            clearStatusMessage();
            appendMessage('assistant', msg.content, msg.reasoning_content || '', durationSeconds);
            messageHistory.push({ role: 'assistant', content: msg.content });
            if (hasExecutedTools) {
                hasSentTextMessageAfterTools = true;
            }
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
            hasExecutedTools = true;
            messageHistory.push(msg);

            const toolResponses = [];
            for (const toolCall of msg.tool_calls) {
                const name = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                
                let details = '';
                if (args.asset_path) details = `: ${args.asset_path}`;
                else if (args.gameobject_path) details = `: ${args.gameobject_path}`;
                else if (args.path) details = `: ${args.path}`;
                
                setStatusMessage(`🛠️ Değişiklikler Unity'ye aktarılıyor: <strong>${name}</strong>${details}...`);
                
                const uiBox = appendToolBox(name, args);
                const output = await executeUnityTool(name, args);
                
                if (uiBox) {
                    uiBox.updateStatus(output.success !== false ? 'Tamamlandı' : 'Hata Oluştu', output.success === false);
                    uiBox.appendOutput(output);
                }

                toolResponses.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: name,
                    content: JSON.stringify(output)
                });
            }

            messageHistory.push(...toolResponses);
        } else {
            continueLoop = false;
        }
    }
    
    clearStatusMessage();
    
    if (hasExecutedTools && !hasSentTextMessageAfterTools) {
        const fallbackMsg = "🛠️ Tüm araç çağrıları başarıyla tamamlandı ve sahne güncellendi.";
        appendMessage('assistant', fallbackMsg);
        messageHistory.push({ role: 'assistant', content: fallbackMsg });
    }
}
