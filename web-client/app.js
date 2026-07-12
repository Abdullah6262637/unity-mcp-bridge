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
const endpointInput = document.getElementById('endpointInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const chatFeed = document.getElementById('chatFeed');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const modeBadge = document.getElementById('modeBadge');

// List of all Unity MCP Tools with OpenAI-compatible schemas
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_gameobject',
            description: 'Creates a new GameObject in the active Unity scene hierarchy.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'The name of the GameObject.' },
                    position: { type: 'array', items: { type: 'number' }, description: 'Optional position as [x, y, z] array.' },
                    parent_path: { type: 'string', description: 'Optional path of parent GameObject (e.g., /Parent).' }
                },
                required: ['name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_gameobject',
            description: 'Deletes a GameObject from the hierarchy. Requires confirm: true for safety.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'The exact path of the GameObject (e.g., /Parent/Child).' },
                    confirm: { type: 'boolean', description: 'Set to true to verify this destructive action.' }
                },
                required: ['path', 'confirm']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_scene_hierarchy',
            description: 'Retrieves the complete active scene hierarchy including GameObjects, active states, paths, and components.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'add_component',
            description: 'Adds a component (e.g., Rigidbody, Camera, or custom scripts) to a GameObject.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string', description: 'The path of the target GameObject.' },
                    component_type: { type: 'string', description: 'The class name of the component (e.g., Rigidbody).' }
                },
                required: ['gameobject_path', 'component_type']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'remove_component',
            description: 'Removes a component from a GameObject.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string', description: 'The path of the target GameObject.' },
                    component_type: { type: 'string', description: 'The class name of the component to remove.' }
                },
                required: ['gameobject_path', 'component_type']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'set_component_property',
            description: 'Sets a public field or property value on a component using reflection.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string', description: 'The path of the GameObject.' },
                    component_type: { type: 'string', description: 'The class name of the component.' },
                    property: { type: 'string', description: 'The property or field name (case-insensitive).' },
                    value: { type: 'string', description: 'The value to assign as string (e.g., "10", "true", "[0, 5, 0]").' }
                },
                required: ['gameobject_path', 'component_type', 'property', 'value']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_script',
            description: 'Reads the code of a C# script file in the project.',
            parameters: {
                type: 'object',
                properties: {
                    asset_path: { type: 'string', description: 'Relative path under Assets/ (e.g., Assets/Scripts/Player.cs).' }
                },
                required: ['asset_path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'write_script',
            description: 'Overwrites a C# script file or writes a new one and triggers compilation.',
            parameters: {
                type: 'object',
                properties: {
                    asset_path: { type: 'string', description: 'Relative path under Assets/.' },
                    content: { type: 'string', description: 'Complete file contents.' }
                },
                required: ['asset_path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_script',
            description: 'Creates a new C# MonoBehaviour script with standard template.',
            parameters: {
                type: 'object',
                properties: {
                    asset_path: { type: 'string', description: 'Relative path under Assets/ ending in .cs.' },
                    template: { type: 'string', description: 'Optional custom class body.' }
                },
                required: ['asset_path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_compile_status',
            description: 'Queries project compilation status, errors, and warnings.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_console_logs',
            description: 'Fetches recent Unity Editor console logs.',
            parameters: {
                type: 'object',
                properties: {
                    count: { type: 'number', description: 'Max logs to fetch (default: 50).' },
                    log_type: { type: 'string', enum: ['Log', 'Warning', 'Error', 'Assert', 'Exception'], description: 'Filter type.' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'run_tests',
            description: 'Triggers Unity Test Runner execution.',
            parameters: {
                type: 'object',
                properties: {
                    test_mode: { type: 'string', enum: ['EditMode', 'PlayMode'], description: 'Test suite type.' },
                    filter: { type: 'string', description: 'Optional test name filter.' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_test_status',
            description: 'Queries status of NUnit test job.',
            parameters: {
                type: 'object',
                properties: {
                    job_id: { type: 'string', description: 'The job ID.' }
                },
                required: ['job_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_prefab',
            description: 'Converts a hierarchy GameObject into a Prefab asset.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string', description: 'GameObject path.' },
                    save_path: { type: 'string', description: 'Destination Asset path (e.g. Assets/MyPrefab.prefab).' }
                },
                required: ['gameobject_path', 'save_path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_assets',
            description: 'Lists all assets in a specific project folder.',
            parameters: {
                type: 'object',
                properties: {
                    folder_path: { type: 'string', description: 'Path starting with Assets/.' },
                    filter: { type: 'string', description: 'Search term or asset type.' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_project_info',
            description: 'Retrieves Unity project settings and version metadata.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'capture_game_view',
            description: 'Captures a PNG screenshot from the main Game View camera.',
            parameters: {
                type: 'object',
                properties: {
                    quality: { type: 'string', enum: ['low', 'medium', 'high'] }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'capture_scene_view',
            description: 'Captures a PNG screenshot from the Editor Scene View camera.',
            parameters: {
                type: 'object',
                properties: {
                    quality: { type: 'string', enum: ['low', 'medium', 'high'] }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'capture_annotated_view',
            description: 'Captures a screenshot with colored dots marking GameObject positions.',
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
            description: 'Enters Play Mode in the Unity Editor.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'exit_play_mode',
            description: 'Exits Play Mode in the Unity Editor.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'pause_play_mode',
            description: 'Pauses the execution of the game in Play Mode.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'step_frame',
            description: 'Steps the execution of the game by a single frame (requires game to be paused).',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'inspect_runtime_value',
            description: 'Reads the live value of a public field or property on a component of a GameObject.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string', description: 'The hierarchy path of the GameObject.' },
                    component_type: { type: 'string', description: 'The Component class name.' },
                    member_name: { type: 'string', description: 'The public field or property to read.' }
                },
                required: ['gameobject_path', 'component_type', 'member_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'set_runtime_value',
            description: 'Dynamically writes/assigns a new value to a public field or property on a component of a GameObject at runtime.',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string', description: 'The hierarchy path of the GameObject.' },
                    component_type: { type: 'string', description: 'The Component class name.' },
                    member_name: { type: 'string', description: 'The public field or property to write.' },
                    value: { type: 'string', description: 'The string value to assign.' }
                },
                required: ['gameobject_path', 'component_type', 'member_name', 'value']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'wait_for_condition',
            description: 'Asynchronously polls a condition on a component property and returns once the comparison evaluates to true (or times out).',
            parameters: {
                type: 'object',
                properties: {
                    gameobject_path: { type: 'string', description: 'The hierarchy path of the GameObject to watch.' },
                    component_type: { type: 'string', description: 'The Component class name to check.' },
                    member_name: { type: 'string', description: 'The public field or property name to evaluate.' },
                    op: { type: 'string', enum: ['==', '!=', '<', '>', '<=', '>='] },
                    value: { type: 'string', description: 'The target value to compare against.' },
                    timeout_ms: { type: 'number', description: 'Timeout in ms (default: 5000).' }
                },
                required: ['gameobject_path', 'component_type', 'member_name', 'op', 'value']
            }
        }
    }
];

// System Prompts for Modes
const PLAN_SYSTEM_PROMPT = `You are a Unity AI Development Assistant running in PLAN MODE.
Your goal is to analyze the user's request, gather any context if needed, and design a detailed, comprehensive implementation plan.
Provide a clear markdown checklist of tasks that need to be accomplished.
DO NOT execute or suggest calling any tools in this mode. Simply explain the plan and wait for the user's approval.`;

const BUILD_SYSTEM_PROMPT = `You are a Unity AI Development Assistant running in BUILD MODE.
Your goal is to execute the approved plan using the available Unity Editor tools.
You have access to tools that can inspect the hierarchy, add components, read/write/create scripts, build prefabs, run tests, and capture screenshots.
Always call the tools to execute changes, and then verify that they succeeded.`;

// Polling check for Unity Editor
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

// Mode switching handlers
planModeBtn.addEventListener('click', () => {
    if (isChatActive) return;
    currentMode = 'plan';
    planModeBtn.classList.add('active');
    buildModeBtn.classList.remove('active');
    modeBadge.textContent = 'Plan Modu Aktif';
    modeBadge.className = 'current-mode-badge plan';
});

buildModeBtn.addEventListener('click', () => {
    if (isChatActive) return;
    currentMode = 'build';
    buildModeBtn.classList.add('active');
    planModeBtn.classList.remove('active');
    modeBadge.textContent = 'Build Modu Aktif';
    modeBadge.className = 'current-mode-badge build';
});

// Auto size text area
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
});

// Append message bubble to UI
function appendMessage(role, text) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    // Parse simple markdown-like code block highlights
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

// Append tool execution state to UI
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

// Append Plan Confirmation panel
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
        modeBadge.textContent = 'Build Modu Aktif';
        modeBadge.className = 'current-mode-badge build';
        appendMessage('assistant', 'Plan onaylandı! 🛠️ Build Moduna geçildi. Değişiklikleri uygulamaya başlıyorum.');
        runBuildProcess();
    });
}

// Direct local Unity tool execution
async function executeUnityTool(name, args) {
    try {
        const response = await fetch(`${UNITY_URL}/tools/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
        });
        
        if (!response.ok) {
            throw new Error(`Unity status: ${response.status}`);
        }
        
        return await response.json();
    } catch (err) {
        return { success: false, error: `Unity bağlantı hatası: ${err.message}` };
    }
}

// Call custom LLM Endpoint
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

// Chat Send Trigger
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

// Plan execution loop
async function runPlanProcess() {
    const apiMessages = [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        ...messageHistory
    ];

    appendMessage('assistant', 'Plan hazırlanıyor...');
    const result = await callLLM(apiMessages, false);
    
    // Clear the "Plan hazırlanıyor..." placeholder message
    chatFeed.lastElementChild.remove();

    const text = result.choices[0].message.content;
    appendMessage('assistant', text);
    messageHistory.push({ role: 'assistant', content: text });

    appendPlanConfirmPanel();
}

// Build execution loop with tool call handling
async function runBuildProcess() {
    let continueLoop = true;
    let loopCount = 0;
    const maxLoops = 10; // Protect against infinite recursion

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

        // Clear loading placeholder
        if (chatFeed.lastElementChild && chatFeed.lastElementChild.textContent.includes('İşlem yapılıyor...')) {
            chatFeed.lastElementChild.remove();
        }

        if (msg.content) {
            appendMessage('assistant', msg.content);
            messageHistory.push({ role: 'assistant', content: msg.content });
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
            // Store assistant's tool intent in history
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

            // Feed tool results back
            messageHistory.push(...toolResponses);
            appendMessage('assistant', 'Sonuçlar analiz ediliyor...');
        } else {
            continueLoop = false;
        }
    }
}
