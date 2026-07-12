// Unity MCP Bridge Web Client

// Default connection settings
const UNITY_URL = 'http://127.0.0.1:8090';

// Mode States
let currentMode = 'plan'; // 'plan' or 'build'
let isChatActive = false;
let messageHistory = [];

// DOM Elements
const planModeBtn = document.getElementById('planModeBtn');
const buildModeBtn = document.getElementById('buildModeBtn');
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

// List of all Unity MCP Tools (Highly optimized to minimize token context size)
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

// Connection polling
async function checkUnityConnection() {
    try {
        const res = await fetch(`${UNITY_URL}/health`, { method: 'GET' });
        if (res.ok) {
            const data = await res.json();
            statusDot.classList.add('online');
            statusText.textContent = `Unity: Çevrimiçi (v${data.unityVersion})`;
        } else {
            throw new Error();
        }
    } catch {
        statusDot.classList.remove('online');
        statusText.textContent = 'Unity: Çevrimdışı (Unity Editor Açık Değil)';
    }
}
setInterval(checkUnityConnection, 3000);
checkUnityConnection();

// Mode switches
planModeBtn.addEventListener('click', () => {
    if (isChatActive) return;
    currentMode = 'plan';
    planModeBtn.classList.add('active');
    buildModeBtn.classList.remove('active');
});

buildModeBtn.addEventListener('click', () => {
    if (isChatActive) return;
    currentMode = 'build';
    buildModeBtn.classList.add('active');
    planModeBtn.classList.remove('active');
});

// Settings Drawer Actions
toggleSettingsBtn.addEventListener('click', () => {
    settingsDrawer.classList.toggle('open');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsDrawer.classList.remove('open');
});

// Clear Chat Action
clearChatBtn.addEventListener('click', () => {
    if (isChatActive) return;
    messageHistory = [];
    chatFeed.innerHTML = `
        <div class="message-row assistant">
            <div class="bubble">
                <p>Sohbet geçmişi temizlendi! 🧹 Yeni bir çalışma başlatabilirsiniz.</p>
                <p>Şu anda **${currentMode === 'plan' ? 'Plan' : 'Build'} Modu**'ndayım.</p>
            </div>
        </div>
    `;
});

// Auto-size input box
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
});

// UI helpers
function appendMessage(role, text) {
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
    chatFeed.appendChild(row);
    chatFeed.scrollTop = chatFeed.scrollHeight;
    return bubble;
}

function appendToolBox(name, args) {
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
    
    chatFeed.appendChild(box);
    chatFeed.scrollTop = chatFeed.scrollHeight;
    
    return {
        updateStatus: (statusText, isError = false) => {
            const statusSpan = header.querySelector('.tool-status');
            statusSpan.textContent = statusText;
            statusSpan.className = `tool-status ${isError ? 'error' : 'success'}`;
        },
        appendOutput: (output) => {
            body.textContent += `\n\nYanıt:\n${JSON.stringify(output, null, 2)}`;
            chatFeed.scrollTop = chatFeed.scrollHeight;
        }
    };
}

function appendPlanConfirmPanel() {
    const box = document.createElement('div');
    box.className = 'plan-confirmation-box';
    box.innerHTML = `
        <h4>Plan Hazırlandı! 🔮</h4>
        <p>Planı onaylayıp Build Moduna geçerek değişiklikleri uygulamak ister misiniz?</p>
        <button class="plan-confirm-btn" id="confirmPlanBtn">Planı Onayla ve Derle</button>
    `;
    chatFeed.appendChild(box);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    document.getElementById('confirmPlanBtn').addEventListener('click', () => {
        box.remove();
        currentMode = 'build';
        buildModeBtn.classList.add('active');
        planModeBtn.classList.remove('active');
        appendMessage('assistant', 'Plan onaylandı! 🛠️ Build Moduna geçildi. Değişiklikleri uygulamaya başlıyorum.');
        runBuildProcess();
    });
}

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

sendBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

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
    } finally {
        isChatActive = false;
        sendBtn.disabled = false;
    }
}

async function runPlanProcess() {
    const apiMessages = [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        ...messageHistory
    ];

    appendMessage('assistant', 'Plan hazırlanıyor...');
    const result = await callLLM(apiMessages, false);
    
    if (chatFeed.lastElementChild && chatFeed.lastElementChild.textContent.includes('Plan hazırlanıyor...')) {
        chatFeed.lastElementChild.remove();
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

        if (chatFeed.lastElementChild && chatFeed.lastElementChild.textContent.includes('İşlem yapılıyor...')) {
            chatFeed.lastElementChild.remove();
        }
        if (chatFeed.lastElementChild && chatFeed.lastElementChild.textContent.includes('Sonuçlar analiz ediliyor...')) {
            chatFeed.lastElementChild.remove();
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
                
                uiBox.updateStatus(output.success !== false ? 'Tamamlandı' : 'Hata Oluştu', output.success === false);
                uiBox.appendOutput(output);

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
