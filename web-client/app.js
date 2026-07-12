// Unity MCP Bridge Web Client (Integrated Workspace Edition)

// Connection Settings
const UNITY_URL = 'http://127.0.0.1:8090';

// Mode & Tab States
let currentMode = 'plan'; // 'plan' or 'build'
let isChatActive = false;
let messageHistory = [];
let currentTab = 'inspector'; // 'inspector' or 'chat'

// Parent DOM Elements
const settingsDrawer = document.getElementById('settingsDrawer');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const endpointInput = document.getElementById('endpointInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');

// References to elements injected inside the IFrame
let docSendBtn, docChatInput, docChatFeed, docPlanModeBtn, docBuildModeBtn, docClearChatBtn, docToggleSettingsBtn, docStatusDot, docStatusText;

// Parent close settings listener
closeSettingsBtn.addEventListener('click', () => {
    settingsDrawer.classList.remove('open');
});

// Dynamic Class Copier for Tabs
function getTabClasses(headerContainer) {
    const buttons = Array.from(headerContainer.querySelectorAll('button')).filter(b => b.id !== 'customChatTabBtn');
    if (buttons.length === 0) return { activeClass: '', inactiveClass: '' };

    const classGroups = {};
    buttons.forEach(btn => {
        const cls = btn.className;
        classGroups[cls] = classGroups[cls] || [];
        classGroups[cls].push(btn);
    });

    let activeClass = '';
    let inactiveClass = '';

    const keys = Object.keys(classGroups);
    if (keys.length === 2) {
        if (classGroups[keys[0]].length === 1) {
            activeClass = keys[0];
            inactiveClass = keys[1];
        } else if (classGroups[keys[1]].length === 1) {
            activeClass = keys[1];
            inactiveClass = keys[0];
        }
    } else if (keys.length === 1) {
        inactiveClass = keys[0];
    } else {
        // Statistical fallback: find the most common as inactive, and the unique one as active
        let maxCount = 0;
        let mostCommonKey = keys[0];
        keys.forEach(k => {
            if (classGroups[k].length > maxCount) {
                maxCount = classGroups[k].length;
                mostCommonKey = k;
            }
        });
        inactiveClass = mostCommonKey;
        activeClass = keys.find(k => k !== mostCommonKey) || mostCommonKey;
    }

    return { activeClass, inactiveClass };
}

// Injected CSS Styles inside the IFrame
const INJECTED_CSS = `
    /* Custom light-themed scrollbars inside the iframe */
    ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    
    ::-webkit-scrollbar-track {
        background: transparent;
    }
    
    ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
        transition: background 0.3s;
    }
    
    ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }

    .custom-chat-pane {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: #ffffff;
        font-family: inherit;
    }
    
    .chat-header {
        height: 50px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        flex-shrink: 0;
        background: #ffffff;
    }
    
    .chat-header h2 {
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
    }
    
    .chat-feed {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f8fafc;
    }
    
    .message-row {
        display: flex;
        width: 100%;
    }
    
    .message-row.user {
        justify-content: flex-end;
    }
    
    .message-row.assistant {
        justify-content: flex-start;
    }
    
    .bubble {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 8px;
        line-height: 1.5;
        font-size: 13px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    }
    
    .message-row.user .bubble {
        background: #dbeafe;
        color: #1e40af;
        border: 1px solid #bfdbfe;
        border-bottom-right-radius: 2px;
    }
    
    .message-row.assistant .bubble {
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 2px;
    }
    
    .bubble p {
        margin-bottom: 4px;
    }
    .bubble p:last-child {
        margin-bottom: 0;
    }
    
    .bubble code {
        font-family: monospace;
        font-size: 11px;
        background: #f1f5f9;
        padding: 2px 4px;
        border-radius: 3px;
        color: #0f172a;
    }
    
    .bubble pre {
        background: #f8fafc;
        padding: 8px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 6px 0;
        border: 1px solid #e2e8f0;
    }
    
    .bubble pre code {
        background: transparent;
        padding: 0;
        font-size: 11px;
    }
    
    .input-area {
        padding: 12px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 8px;
        background: #ffffff;
        flex-shrink: 0;
    }
    
    .chat-input {
        flex: 1;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 10px;
        color: #0f172a;
        font-family: inherit;
        font-size: 13px;
        outline: none;
        resize: none;
        height: 36px;
        max-height: 80px;
        transition: border-color 0.15s;
    }
    
    .chat-input:focus {
        border-color: #2563eb;
    }
    
    .send-btn {
        width: 36px;
        height: 36px;
        border-radius: 6px;
        border: none;
        background: #2563eb;
        color: #ffffff;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 1px 2px rgba(37, 99, 235, 0.1);
    }
    
    .send-btn:hover {
        background: #1d4ed8;
    }
    
    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .chat-action-btn {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        color: #475569;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: 6px;
    }
    
    .chat-action-btn:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
        color: #0f172a;
    }
    
    .mode-toggle-container {
        background: #f1f5f9;
        padding: 2px;
        border-radius: 12px;
        display: flex;
        border: 1px solid #e2e8f0;
    }
    
    .mode-btn {
        border: none;
        background: transparent;
        color: #475569;
        padding: 4px 12px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        border-radius: 10px;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .mode-btn.active {
        color: #ffffff;
    }
    
    .mode-btn.plan.active {
        background: #7c3aed;
    }
    
    .mode-btn.build.active {
        background: #2563eb;
    }
    
    .tool-execution-box {
        width: 100%;
        margin-top: 6px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        overflow: hidden;
    }
    
    .tool-header {
        background: #f8fafc;
        padding: 4px 8px;
        font-size: 10px;
        font-weight: 600;
        font-family: monospace;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
        color: #475569;
    }
    
    .tool-header .tool-status {
        color: #059669;
    }
    
    .tool-header .tool-status.running {
        color: #2563eb;
    }
    
    .tool-body {
        padding: 8px;
        font-family: monospace;
        font-size: 10px;
        max-height: 100px;
        overflow-y: auto;
        white-space: pre-wrap;
        background: #fafafa;
        color: #334155;
    }
    
    .plan-confirmation-box {
        margin-top: 8px;
        background: #faf5ff;
        border: 1px solid #e9d5ff;
        border-radius: 6px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
        text-align: center;
    }
    
    .plan-confirmation-box h4 {
        font-size: 12px;
        font-weight: 600;
        color: #6b21a8;
    }
    
    .plan-confirmation-box p {
        font-size: 10px;
        color: #475569;
    }
    
    .plan-confirm-btn {
        border: none;
        background: #059669;
        color: #ffffff;
        padding: 6px 14px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 11px;
        cursor: pointer;
    }
`;

// OpenLLM-compatible Tools List (Compacted to save token space)
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
                    content: { type: 'string', description: 'Complete file code.' }
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
Analyze the user request, inspect the project, and present a detailed implementation plan.
Provide a clear markdown checklist of tasks that need to be accomplished.
DO NOT execute or suggest calling any tools in this mode. Only explain the plan and wait for approval.`;

const BUILD_SYSTEM_PROMPT = `You are a Unity AI Givelopment Assistant running in BUILD MODE.
Execute the approved plan using the available Unity tools.
You have access to tools to modify the scene, write scripts, build prefabs, run tests, and capture screenshots.
Always call the tools to execute changes, and verify success.`;

// Polling Unity HTTP connection status
async function checkUnityConnection() {
    try {
        const res = await fetch(`${UNITY_URL}/health`, { method: 'GET' });
        if (res.ok) {
            const data = await res.json();
            if (docStatusDot) docStatusDot.style.backgroundColor = '#059669'; // Emerald Green
            if (docStatusText) docStatusText.textContent = `Unity: Çevrimiçi (v${data.unityVersion})`;
        } else {
            throw new Error();
        }
    } catch {
        if (docStatusDot) docStatusDot.style.backgroundColor = '#dc2626'; // Red
        if (docStatusText) docStatusText.textContent = 'Unity: Çevrimdışı';
    }
}
setInterval(checkUnityConnection, 3000);

// Core integration mechanism
const iframe = document.getElementById('inspectorIFrame');

function startIntegrationLoop() {
    let interval = setInterval(() => {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return;

        const buttons = Array.from(doc.querySelectorAll('button'));
        // Find the Tools button inside the inspector's header row
        const toolsBtn = buttons.find(b => b.textContent.trim().includes('Tools'));
        
        if (toolsBtn) {
            clearInterval(interval);
            setupIntegratedChat(doc, toolsBtn);
        }
    }, 150);
}

function setupIntegratedChat(doc, toolsBtn) {
    console.log("[Integration] Target 'Tools' tab found. Injecting 'Chat' tab...");

    // 1. Inject Stylesheets into the IFrame
    const styleTag = doc.createElement('style');
    styleTag.innerHTML = INJECTED_CSS;
    doc.head.appendChild(styleTag);

    const headerContainer = toolsBtn.parentElement;
    const contentContainer = headerContainer.nextElementSibling;
    const mainRightPane = headerContainer.parentElement;

    // 2. Create the custom Chat Tab Button
    const chatTabBtn = doc.createElement('button');
    chatTabBtn.id = 'customChatTabBtn';
    chatTabBtn.className = toolsBtn.className; // Inherit styling classes
    chatTabBtn.innerHTML = '💬 Chat';
    
    // Insert it next to the Tools tab
    toolsBtn.parentNode.insertBefore(chatTabBtn, toolsBtn.nextSibling);

    // 3. Clone and Inject the Chat Pane Template
    const template = document.getElementById('chatPaneTemplate');
    const chatPaneClone = doc.importNode(template.content, true);
    mainRightPane.appendChild(chatPaneClone);

    const chatPane = doc.getElementById('customChatPane');

    // 4. Resolve Injected DOM Elements
    docSendBtn = doc.getElementById('sendBtn');
    docChatInput = doc.getElementById('chatInput');
    docChatFeed = doc.getElementById('chatFeed');
    docPlanModeBtn = doc.getElementById('planModeBtn');
    docBuildModeBtn = doc.getElementById('buildModeBtn');
    docClearChatBtn = doc.getElementById('clearChatBtn');
    docToggleSettingsBtn = doc.getElementById('toggleSettingsBtn');
    docStatusDot = doc.getElementById('statusDot');
    docStatusText = doc.getElementById('statusText');

    // Run connection health check immediately
    checkUnityConnection();

    // 5. Setup Action Handlers inside the IFrame
    docSendBtn.addEventListener('click', handleSendMessage);
    docChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    docChatInput.addEventListener('input', () => {
        docChatInput.style.height = 'auto';
        docChatInput.style.height = docChatInput.scrollHeight + 'px';
    });

    docPlanModeBtn.addEventListener('click', () => {
        if (isChatActive) return;
        currentMode = 'plan';
        docPlanModeBtn.classList.add('active');
        docBuildModeBtn.classList.remove('active');
    });

    docBuildModeBtn.addEventListener('click', () => {
        if (isChatActive) return;
        currentMode = 'build';
        docBuildModeBtn.classList.add('active');
        docPlanModeBtn.classList.remove('active');
    });

    docClearChatBtn.addEventListener('click', () => {
        if (isChatActive) return;
        messageHistory = [];
        docChatFeed.innerHTML = `
            <div class="message-row assistant">
                <div class="bubble">
                    <p>Sohbet geçmişi temizlendi! 🧹 Yeni bir çalışma başlatabilirsiniz.</p>
                    <p>Şu anda **${currentMode === 'plan' ? 'Plan' : 'Build'} Modu**'ndayım.</p>
                </div>
            </div>
        `;
    });

    docToggleSettingsBtn.addEventListener('click', () => {
        settingsDrawer.classList.toggle('open');
    });

    // 6. Navigation Event Delegation (Click Tab toggles)
    headerContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.id === 'customChatTabBtn') {
            currentTab = 'chat';
        } else {
            currentTab = 'inspector';
        }
        syncLayoutState(doc, headerContainer, contentContainer, chatPane, chatTabBtn);
    });

    // Initial state sync
    syncLayoutState(doc, headerContainer, contentContainer, chatPane, chatTabBtn);

    // 7. MutationObserver to fight off React virtual DOM updates
    const observer = new MutationObserver(() => {
        // Verify custom chat button is still in DOM
        if (!doc.getElementById('customChatTabBtn')) {
            const currentToolsBtn = Array.from(headerContainer.querySelectorAll('button')).find(b => b.textContent.trim().includes('Tools'));
            if (currentToolsBtn) {
                currentToolsBtn.parentNode.insertBefore(chatTabBtn, currentToolsBtn.nextSibling);
            }
        }

        // Verify custom chat pane is still appended
        if (!doc.getElementById('customChatPane')) {
            mainRightPane.appendChild(chatPane);
        }

        // Keep layouts in sync
        syncLayoutState(doc, headerContainer, contentContainer, chatPane, chatTabBtn);
    });

    observer.observe(mainRightPane, { childList: true, subtree: true });
}

function syncLayoutState(doc, headerContainer, contentContainer, chatPane, chatTabBtn) {
    const { activeClass, inactiveClass } = getTabClasses(headerContainer);

    if (currentTab === 'chat') {
        contentContainer.style.display = 'none';
        chatPane.style.display = 'flex';

        if (activeClass) chatTabBtn.className = activeClass;
        if (inactiveClass) {
            Array.from(headerContainer.querySelectorAll('button')).forEach(btn => {
                if (btn.id !== 'customChatTabBtn') {
                    btn.className = inactiveClass;
                }
            });
        }
    } else {
        contentContainer.style.display = '';
        chatPane.style.display = 'none';

        if (inactiveClass) chatTabBtn.className = inactiveClass;
    }
}

// Start watching the iframe load
iframe.addEventListener('load', startIntegrationLoop);
if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
    startIntegrationLoop();
}

// UI messages
function appendMessage(role, text) {
    if (!docChatFeed) return;
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    let formattedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
        
    bubble.innerHTML = formattedText;
    row.appendChild(bubble);
    docChatFeed.appendChild(row);
    docChatFeed.scrollTop = docChatFeed.scrollHeight;
    return bubble;
}

function appendToolBox(name, args) {
    if (!docChatFeed) return null;
    const box = document.createElement('div');
    box.className = 'tool-execution-box';
    
    const header = document.createElement('div');
    header.className = 'tool-header';
    header.innerHTML = `<span>⚙️ Araç Çağrısı: <strong>${name}</strong></span><span class="tool-status running">Çalıştırılıyor...</span>`;
    box.appendChild(header);
    
    const body = document.createElement('div');
    body.className = 'tool-body';
    body.textContent = `Argümanlar:\n${JSON.stringify(args, null, 2)}`;
    box.appendChild(body);
    
    docChatFeed.appendChild(box);
    docChatFeed.scrollTop = docChatFeed.scrollHeight;
    
    return {
        updateStatus: (statusText, isError = false) => {
            const statusSpan = header.querySelector('.tool-status');
            statusSpan.textContent = statusText;
            statusSpan.className = `tool-status ${isError ? 'error' : 'success'}`;
        },
        appendOutput: (output) => {
            body.textContent += `\n\nYanıt:\n${JSON.stringify(output, null, 2)}`;
            docChatFeed.scrollTop = docChatFeed.scrollHeight;
        }
    };
}

function appendPlanConfirmPanel() {
    if (!docChatFeed) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const box = doc.createElement('div');
    box.className = 'plan-confirmation-box';
    box.innerHTML = `
        <h4>Plan Hazırlandı! 🔮</h4>
        <p>Planı onaylayıp Build Moduna geçerek değişiklikleri uygulamak ister misiniz?</p>
        <button class="plan-confirm-btn" id="confirmPlanBtn">Planı Onayla ve Derle</button>
    `;
    docChatFeed.appendChild(box);
    docChatFeed.scrollTop = docChatFeed.scrollHeight;

    doc.getElementById('confirmPlanBtn').addEventListener('click', () => {
        box.remove();
        currentMode = 'build';
        docBuildModeBtn.classList.add('active');
        docPlanModeBtn.classList.remove('active');
        appendMessage('assistant', 'Plan onaylandı! 🛠️ Build Moduna geçildi. Değişiklikleri uygulamaya başlıyorum.');
        runBuildProcess();
    });
}

// Bridge execution to local node server
async function executeUnityTool(name, args) {
    try {
        const response = await fetch(`${UNITY_URL}/tools/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
        });
        return await response.json();
    } catch (err) {
        return { success: false, error: `Unity bağlantı hatası: ${err.message}` };
    }
}

// Request LLM endpoint
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

async function handleSendMessage() {
    if (!docChatInput) return;
    const text = docChatInput.value.trim();
    if (!text || isChatActive) return;

    docChatInput.value = '';
    docChatInput.style.height = 'auto';
    
    appendMessage('user', text);
    messageHistory.push({ role: 'user', content: text });

    isChatActive = true;
    docSendBtn.disabled = true;

    try {
        if (currentMode === 'plan') {
            await runPlanProcess();
        } else {
            await runBuildProcess();
        }
    } catch (error) {
        appendMessage('assistant', `⚠️ Hata oluştu: ${error.message}`);
    } finally {
        isChatActive = false;
        docSendBtn.disabled = false;
    }
}

async function runPlanProcess() {
    const apiMessages = [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        ...messageHistory
    ];

    appendMessage('assistant', 'Plan hazırlanıyor...');
    const result = await callLLM(apiMessages, false);
    
    if (docChatFeed.lastElementChild && docChatFeed.lastElementChild.textContent.includes('Plan hazırlanıyor...')) {
        docChatFeed.lastElementChild.remove();
    }

    const text = result.choices[0].message.content;
    appendMessage('assistant', text);
    messageHistory.push({ role: 'assistant', content: text });

    appendPlanConfirmPanel();
}

async function runBuildProcess() {
    let continueLoop = true;
    let loopCount = 0;
    const maxLoops = 10;

    appendMessage('assistant', 'İşlem yapılıyor...');

    while (continueLoop && loopCount < maxLoops) {
        loopCount++;
        
        const apiMessages = [
            { role: 'system', content: BUILD_SYSTEM_PROMPT },
            ...messageHistory
        ];

        const result = await callLLM(apiMessages, true);
        const choice = result.choices[0];
        const msg = choice.message;

        if (docChatFeed.lastElementChild && docChatFeed.lastElementChild.textContent.includes('İşlem yapılıyor...')) {
            docChatFeed.lastElementChild.remove();
        }
        if (docChatFeed.lastElementChild && docChatFeed.lastElementChild.textContent.includes('Sonuçlar analiz ediliyor...')) {
            docChatFeed.lastElementChild.remove();
        }

        if (msg.content) {
            appendMessage('assistant', msg.content);
            messageHistory.push({ role: 'assistant', content: msg.content });
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
            messageHistory.push(msg);

            const toolResponses = [];
            for (const toolCall of msg.tool_calls) {
                const name = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                
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
            appendMessage('assistant', 'Sonuçlar analiz ediliyor...');
        } else {
            continueLoop = false;
        }
    }
}
