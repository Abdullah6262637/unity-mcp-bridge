# Unity MCP Bridge

An end-to-end bridge transforming **Unity Editor** into an **MCP Server**, allowing any Model Context Protocol (MCP) client (Claude Desktop, Cursor, Cline, Windsurf, Claude Code) to inspect, script, test, and control Unity projects in real-time using natural language.

```
[MCP Client: Claude/Cline/Cursor]
        │  (stdio, JSON-RPC 2.0)
        ▼
[MCP Server Process — Node.js/TypeScript]
        │  (HTTP/WebSocket, localhost)
        ▼
[Unity Editor Plugin — C#, Editor script]
        │  (UnityEditor API, main thread)
        ▼
[Unity Editor: Scene, Assets, Scripts]
```

## Features

- **Scene Editing**: Create/delete GameObjects, set positions, adjust hierarchy paths.
- **Components & Properties**: Add/remove components, and modify properties/fields using Reflection (supports primitives, `Vector3`, `Vector2`, `Color`).
- **Asset Management**: List project assets (supports search/filter), create Prefabs.
- **Code Operations**: Create new MonoBehaviour scripts from templates, edit files, and check compiler errors (`CompilationPipeline`).
- **Unity Test Runner**: Run EditMode and PlayMode tests asynchronously with a polling status reporter.
- **Console Monitoring**: Read and filter Editor console logs and stack traces.
- **Security Confirmation**: Destructive tools (e.g. `delete_gameobject`) default to dry-run mode and require explicit confirmation (`confirm: true`).
- **Assembly Reload Proof**: Listener automatically shuts down before domain reloads and resumes immediately afterwards.

---

## Installation & Setup

### 1. Add C# Editor Plugin to Unity
Copy the `Assets/Editor/MCPBridge` folder from this repository into your Unity project's `Assets` folder:
- **Source**: `unity-project/Assets/Editor/MCPBridge/`
- **Destination**: `<YourUnityProject>/Assets/Editor/MCPBridge/`

Once imported, Unity will compile the scripts. By default, it will instantiate a settings file at `Assets/Editor/MCPBridge/MCPBridgeSettings.asset` and start listening on `http://127.0.0.1:8090/`.

### 2. Configure MCP Server and Client
Open PowerShell (with administrator rights if required for user config writing) and run the automated script in the root directory:

```powershell
./setup.ps1
```

This script will:
1. Navigate to the `mcp-server` directory and run `npm install`.
2. Compile the TypeScript server code to JavaScript (`dist/index.js`).
3. Backup and configure your **Claude Desktop** config (`%APPDATA%/Claude/claude_desktop_config.json`) to register the server.

*Note: If you are using Cursor, Cline, or other clients, you can configure them to execute the node command targeting the built server:*
```json
{
  "unity-bridge": {
    "command": "node",
    "args": ["C:/Users/HP/Desktop/mcp-bridge/mcp-server/dist/index.js"]
  }
}
```

Restart your MCP client (e.g., Claude Desktop) to connect.

---

## Tool Reference

| Tool Name | Parameters | Description |
|---|---|---|
| `create_gameobject` | `name`, `position?` `[x,y,z]`, `parent_path?` | Spawns a GameObject and returns its Instance ID and path. |
| `delete_gameobject` | `path`, `confirm` | Removes a GameObject. Requires `confirm: true`. |
| `get_scene_hierarchy` | (None) | Returns the entire scene tree with GameObject active states, paths, and components. |
| `add_component` | `gameobject_path`, `component_type` | Attaches a component class (e.g., `Rigidbody`, `BoxCollider`, or custom script). |
| `remove_component` | `gameobject_path`, `component_type` | Removes a component from a GameObject. |
| `set_component_property`| `gameobject_path`, `component_type`, `property`, `value` | Modifies properties/fields (e.g. `center` as `"[0,1,0]"`). |
| `read_script` | `asset_path` | Reads code content of a project file. |
| `write_script` | `asset_path`, `content` | Writes/overwrites a file and triggers compilation. |
| `create_script` | `asset_path`, `template?` | Generates a new script (Monobehaviour by default). |
| `get_compile_status` | (None) | Returns compilation errors and warnings. |
| `get_console_logs` | `count?`, `log_type?` | Retrieves log output, stack traces, and severity types. |
| `run_tests` | `test_mode?` ("EditMode"/"PlayMode"), `filter?` | Launches Unity Test Runner. Returns a polling job ID. |
| `get_test_status` | `job_id` | Returns the state and results of a test execution job. |
| `create_prefab` | `gameobject_path`, `save_path` | Saves a GameObject structure as a reusable `.prefab`. |
| `list_assets` | `folder_path?`, `filter?` | Scans directories for assets (supports search syntax like `t:Prefab`). |
| `get_project_info` | (None) | Returns Unity version, platform, target backend, rendering pipeline. |

---

## Example Prompts

Try these prompt ideas inside your MCP-enabled editor or chat interface:

- **Scene building**:
  > "Get the active scene hierarchy. Create a Cube named 'MyCube' at position [0, 2, 0]. Attach a Rigidbody and a BoxCollider component to it. Then verify it by listing the hierarchy again."
- **Script editing and compilation check**:
  > "Create a script at Assets/Scripts/Rotator.cs that rotates the GameObject around the Y-axis. After writing, check the project compile status to make sure there are no compiler errors."
- **Testing**:
  > "Run the EditMode unit tests. Let's poll its job ID until it compiles and outputs the result details."
- **Debugging**:
  > "Let's read the latest 20 logs from the Unity console to find out why the asset failed to import."

---

## Security & Design Notes

1. **Local Access Only**: The HTTP Server in Unity is hardcoded to bind to `127.0.0.1`. It will reject outer network traffic for safety.
2. **Main Thread Safety**: Unity APIs can only be touched from the main thread. The plugin listener runs on a background thread and queues requests in a thread-safe queue. The main thread processes them during the editor's update loop (`EditorApplication.update`) and signals the worker thread when the payload is ready.
3. **Domain Reloads**: When C# scripts compile, Unity resets assembly state. The HTTP server hooks into compile start events to stop gracefully, preventing port lockups and crashes, and automatically restarts.
