import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { UnityClient } from './unityClient.js';
import * as schemas from './schemas/index.js';

// Initialize the MCP Server
const server = new Server(
  {
    name: 'unity-mcp-bridge',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register list of tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_gameobject',
        description: 'Creates a new GameObject in the active Unity scene hierarchy.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The name of the GameObject.' },
            position: {
              type: 'array',
              items: { type: 'number' },
              minItems: 3,
              maxItems: 3,
              description: 'Optional position as [x, y, z] array.'
            },
            parent_path: { type: 'string', description: 'Optional path of parent GameObject (e.g., /Parent).' }
          },
          required: ['name']
        }
      },
      {
        name: 'delete_gameobject',
        description: 'Deletes a GameObject from the hierarchy. Requires confirm: true for safety.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'The exact path of the GameObject (e.g., /Parent/Child).' },
            confirm: { type: 'boolean', description: 'Set to true to verify this destructive action.' }
          },
          required: ['path', 'confirm']
        }
      },
      {
        name: 'get_scene_hierarchy',
        description: 'Retrieves the complete active scene hierarchy including GameObjects, active states, paths, transforms (position/rotation/scale), and components.',
        inputSchema: {
          type: 'object',
          properties: {
            max_depth: { type: 'number', description: 'Optional depth limit for serialization (e.g. 1 returns only root objects, 0 or omitted is unlimited).' }
          }
        }
      },
      {
        name: 'add_component',
        description: 'Adds a component (e.g., Rigidbody, Camera, or custom scripts) to a GameObject.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The path of the target GameObject.' },
            component_type: { type: 'string', description: 'The class name of the component (e.g., Rigidbody).' }
          },
          required: ['gameobject_path', 'component_type']
        }
      },
      {
        name: 'remove_component',
        description: 'Removes a component from a GameObject.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The path of the target GameObject.' },
            component_type: { type: 'string', description: 'The class name of the component to remove.' }
          },
          required: ['gameobject_path', 'component_type']
        }
      },
      {
        name: 'set_component_property',
        description: 'Sets a public field or property value on a component using reflection.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The path of the GameObject.' },
            component_type: { type: 'string', description: 'The class name of the component.' },
            property: { type: 'string', description: 'The property or field name (case-insensitive).' },
            value: { type: 'string', description: 'The value to assign as string (e.g., "10", "true", "[0, 5, 0]" for vectors, or "[1, 0, 0]" for colors).' }
          },
          required: ['gameobject_path', 'component_type', 'property', 'value']
        }
      },
      {
        name: 'read_script',
        description: 'Reads the code of a C# script file in the project.',
        inputSchema: {
          type: 'object',
          properties: {
            asset_path: { type: 'string', description: 'Relative path under Assets/ (e.g., Assets/Scripts/Player.cs).' }
          },
          required: ['asset_path']
        }
      },
      {
        name: 'write_script',
        description: 'Overwrites or writes a C# script file in the project and triggers compilation.',
        inputSchema: {
          type: 'object',
          properties: {
            asset_path: { type: 'string', description: 'Relative path under Assets/.' },
            content: { type: 'string', description: 'Full source code of the script.' }
          },
          required: ['asset_path', 'content']
        }
      },
      {
        name: 'create_script',
        description: 'Generates a new C# script file with an optional custom template.',
        inputSchema: {
          type: 'object',
          properties: {
            asset_path: { type: 'string', description: 'Relative path under Assets/ ending in .cs.' },
            template: { type: 'string', description: 'Optional custom template content. Defaults to a standard MonoBehaviour.' }
          },
          required: ['asset_path']
        }
      },
      {
        name: 'get_compile_status',
        description: 'Queries the compilation status of the project, including compilation errors and warnings.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_console_logs',
        description: 'Retrieves logs and stack traces from the Unity Editor console.',
        inputSchema: {
          type: 'object',
          properties: {
            count: { type: 'number', description: 'Max number of logs to return (default: 50).' },
            log_type: {
              type: 'string',
              enum: ['Log', 'Warning', 'Error', 'Assert', 'Exception'],
              description: 'Optional log type filter.'
            }
          }
        }
      },
      {
        name: 'run_tests',
        description: 'Runs Unity Test Runner EditMode or PlayMode tests. Returns a job ID immediately (asynchronous).',
        inputSchema: {
          type: 'object',
          properties: {
            test_mode: { type: 'string', enum: ['EditMode', 'PlayMode'], description: 'The test mode (default: EditMode).' },
            filter: { type: 'string', description: 'Optional search filter to run a specific test by name.' }
          }
        }
      },
      {
        name: 'get_test_status',
        description: 'Polls the status and results of an asynchronous test execution job.',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: { type: 'string', description: 'The job ID returned by run_tests.' }
          },
          required: ['job_id']
        }
      },
      {
        name: 'create_prefab',
        description: 'Saves a GameObject hierarchy as a reusable Prefab Asset.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The path of the target GameObject.' },
            save_path: { type: 'string', description: 'The save path under Assets/ ending with .prefab.' }
          },
          required: ['gameobject_path', 'save_path']
        }
      },
      {
        name: 'list_assets',
        description: 'Lists all assets in a specific folder path in the project.',
        inputSchema: {
          type: 'object',
          properties: {
            folder_path: { type: 'string', description: 'The folder path starting with Assets/ (default: Assets).' },
            filter: { type: 'string', description: 'Optional search filter (e.g., "t:Prefab" or "t:Material").' }
          }
        }
      },
      {
        name: 'get_project_info',
        description: 'Retrieves metadata about the Unity project (version, active Render Pipeline, target platform, etc.).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'capture_game_view',
        description: 'Captures a PNG screenshot from the main Game View camera.',
        inputSchema: {
          type: 'object',
          properties: {
            quality: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Resolution of screenshot (low=640x480, medium=1280x720, high=1920x1080).'
            }
          }
        }
      },
      {
        name: 'capture_scene_view',
        description: 'Captures a PNG screenshot from the Editor Scene View camera.',
        inputSchema: {
          type: 'object',
          properties: {
            quality: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Resolution of screenshot (low=640x480, medium=1280x720, high=1920x1080).'
            }
          }
        }
      },
      {
        name: 'capture_annotated_view',
        description: 'Captures a screenshot with colored dots marking GameObject positions.',
        inputSchema: {
          type: 'object',
          properties: {
            quality: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Resolution of screenshot.'
            },
            target_paths: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths of specific GameObjects to annotate. Default is root objects & renderers.'
            }
          }
        }
      },
      {
        name: 'enter_play_mode',
        description: 'Enters Play Mode in the Unity Editor.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'exit_play_mode',
        description: 'Exits Play Mode in the Unity Editor.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'pause_play_mode',
        description: 'Pauses the execution of the game in Play Mode.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'step_frame',
        description: 'Steps the execution of the game by a single frame (requires game to be paused).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'inspect_runtime_value',
        description: 'Reads the live value of a public field or property on a component of a GameObject.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The hierarchy path of the GameObject (e.g., /Player).' },
            component_type: { type: 'string', description: 'The Component class name (e.g., Transform).' },
            member_name: { type: 'string', description: 'The public field or property to read (e.g., position).' }
          },
          required: ['gameobject_path', 'component_type', 'member_name']
        }
      },
      {
        name: 'set_runtime_value',
        description: 'Dynamically writes/assigns a new value to a public field or property on a component of a GameObject at runtime.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The hierarchy path of the GameObject.' },
            component_type: { type: 'string', description: 'The Component class name.' },
            member_name: { type: 'string', description: 'The public field or property to write.' },
            value: { type: 'string', description: 'The string-formatted value to assign (e.g., "15", "true", "[0, 5, 0]").' }
          },
          required: ['gameobject_path', 'component_type', 'member_name', 'value']
        }
      },
      {
        name: 'wait_for_condition',
        description: 'Asynchronously polls a condition on a component property and returns once the comparison evaluates to true (or times out).',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The hierarchy path of the GameObject to watch.' },
            component_type: { type: 'string', description: 'The Component class name to check.' },
            member_name: { type: 'string', description: 'The public field or property name to evaluate.' },
            op: { type: 'string', enum: ['==', '!=', '<', '>', '<=', '>='], description: 'Comparison operator.' },
            value: { type: 'string', description: 'The target value to compare against.' },
            timeout_ms: { type: 'number', description: 'Maximum timeout in milliseconds (default: 5000, max: 10000).' }
          },
          required: ['gameobject_path', 'component_type', 'member_name', 'op', 'value']
        }
      },
      {
        name: 'download_asset',
        description: 'Downloads an asset file (e.g. .obj, .fbx, .png, or .unitypackage) from a public URL directly into the Assets/ folder and imports it.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The public direct download URL of the asset.' },
            save_path: { type: 'string', description: 'The destination path under Assets/ (e.g. Assets/Models/car.obj).' }
          },
          required: ['url', 'save_path']
        }
      },
      {
        name: 'manage_package',
        description: 'Manages Unity Package Manager packages (installs, removes, or lists packages). Use com.unity.probuilder for 3D modeling, com.unity.cinemachine for cameras, com.unity.ugui for UI, etc.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['install', 'remove', 'list'], description: 'The package manager action.' },
            package_name: { type: 'string', description: 'The package ID (e.g. com.unity.probuilder) - only required for install/remove actions.' }
          },
          required: ['action']
        }
      },
      {
        name: 'create_probuilder_shape',
        description: 'Generates a 3D geometry shape (cube, plane) using the Unity ProBuilder API programmatically.',
        inputSchema: {
          type: 'object',
          properties: {
            shape_type: { type: 'string', description: 'The ProBuilder shape to create ("cube", "plane").' },
            size: { type: 'array', items: { type: 'number' }, description: 'Size dimensions of the shape as [x, y, z].' },
            position: { type: 'array', items: { type: 'number' }, description: 'World space position [x, y, z] to place the shape.' }
          },
          required: ['shape_type']
        }
      },
      {
        name: 'apply_material',
        description: 'Assigns a Material asset from the project to a target GameObject Renderer.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The path of the target GameObject (e.g., "/Cube").' },
            material_path: { type: 'string', description: 'The project path to the material asset (e.g., "Assets/Materials/Red.mat").' }
          },
          required: ['gameobject_path', 'material_path']
        }
      },
      {
        name: 'set_material_properties',
        description: 'Dynamically updates properties (color, metallic, smoothness) of a GameObject material.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The path of the target GameObject.' },
            color: { type: 'string', description: 'Hex color (e.g. "#FF0000") or RGB float array "[1,0,0]".' },
            metallic: { type: 'number', description: 'Metallic value between 0.0 and 1.0.' },
            smoothness: { type: 'number', description: 'Smoothness/Glossiness value between 0.0 and 1.0.' }
          },
          required: ['gameobject_path']
        }
      },
      {
        name: 'set_physics_properties',
        description: 'Configures Rigidbody physics (mass, gravity) and add/update Collider components on a GameObject.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The path of the target GameObject.' },
            add_rigidbody: { type: 'boolean', description: 'Whether to force add a Rigidbody if not present.' },
            mass: { type: 'number', description: 'The mass of the Rigidbody.' },
            use_gravity: { type: 'string', enum: ['true', 'false'], description: 'Whether to enable or disable gravity.' },
            collider_type: { type: 'string', enum: ['box', 'sphere', 'capsule', 'mesh', 'none'], description: 'The collider shape to add.' }
          },
          required: ['gameobject_path']
        }
      },
      {
        name: 'configure_cinemachine',
        description: 'Sets follow and look-at targets, and offset distances on a Cinemachine camera component.',
        inputSchema: {
          type: 'object',
          properties: {
            gameobject_path: { type: 'string', description: 'The path of the Cinemachine camera GameObject.' },
            follow_path: { type: 'string', description: 'The path of the GameObject to follow.' },
            lookat_path: { type: 'string', description: 'The path of the GameObject to look at.' },
            distance: { type: 'number', description: 'Camera offset distance.' }
          },
          required: ['gameobject_path']
        }
      },
      {
        name: 'instantiate_prefab',
        description: 'Spawns a linked prefab asset at a specified position and parents it under a parent GameObject.',
        inputSchema: {
          type: 'object',
          properties: {
            prefab_path: { type: 'string', description: 'The project path to the prefab asset (e.g. "Assets/Prefabs/Car.prefab").' },
            position: { type: 'array', items: { type: 'number' }, description: 'Position [x, y, z] to place the instance.' },
            parent_path: { type: 'string', description: 'The path of the parent GameObject.' },
            name: { type: 'string', description: 'New name for the instantiated GameObject.' }
          },
          required: ['prefab_path']
        }
      },
      {
        name: 'execute_editor_code',
        description: 'Compiles and runs arbitrary Editor C# code blocks on the fly inside the Unity Editor.',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'The complete C# script code to compile and execute. Must contain a public static method: public static string Execute()' }
          },
          required: ['code']
        }
      },
      {
        name: 'perform_undo',
        description: 'Performs the last undo action in the Unity Editor.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'perform_redo',
        description: 'Performs the last redo action in the Unity Editor.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let validatedArgs: any = args;

    // Validate inputs using corresponding Zod schemas
    switch (name) {
      case 'create_gameobject':
        validatedArgs = schemas.CreateGameObjectSchema.parse(args);
        break;
      case 'delete_gameobject':
        validatedArgs = schemas.DeleteGameObjectSchema.parse(args);
        break;
      case 'add_component':
        validatedArgs = schemas.AddComponentSchema.parse(args);
        break;
      case 'remove_component':
        validatedArgs = schemas.RemoveComponentSchema.parse(args);
        break;
      case 'set_component_property':
        validatedArgs = schemas.SetComponentPropertySchema.parse(args);
        break;
      case 'read_script':
        validatedArgs = schemas.ReadScriptSchema.parse(args);
        break;
      case 'write_script':
        validatedArgs = schemas.WriteScriptSchema.parse(args);
        break;
      case 'create_script':
        validatedArgs = schemas.CreateScriptSchema.parse(args);
        break;
      case 'get_console_logs':
        validatedArgs = schemas.GetConsoleLogsSchema.parse(args);
        break;
      case 'run_tests':
        validatedArgs = schemas.RunTestsSchema.parse(args);
        break;
      case 'get_test_status':
        validatedArgs = schemas.GetTestStatusSchema.parse(args);
        break;
      case 'create_prefab':
        validatedArgs = schemas.CreatePrefabSchema.parse(args);
        break;
      case 'list_assets':
        validatedArgs = schemas.ListAssetsSchema.parse(args);
        break;
      case 'capture_game_view':
      case 'capture_scene_view':
        validatedArgs = schemas.CaptureViewSchema.parse(args);
        break;
      case 'capture_annotated_view':
        validatedArgs = schemas.CaptureAnnotatedViewSchema.parse(args);
        break;
      case 'enter_play_mode':
      case 'exit_play_mode':
      case 'pause_play_mode':
      case 'step_frame':
        validatedArgs = schemas.PlayModeActionSchema.parse(args);
        break;
      case 'inspect_runtime_value':
        validatedArgs = schemas.InspectRuntimeValueSchema.parse(args);
        break;
      case 'set_runtime_value':
        validatedArgs = schemas.SetRuntimeValueSchema.parse(args);
        break;
      case 'wait_for_condition':
        validatedArgs = schemas.WaitConditionSchema.parse(args);
        break;
      case 'download_asset':
        validatedArgs = schemas.DownloadAssetSchema.parse(args);
        break;
      case 'manage_package':
        validatedArgs = schemas.ManagePackageSchema.parse(args);
        break;
      case 'get_scene_hierarchy':
        validatedArgs = schemas.GetSceneHierarchySchema.parse(args);
        break;
      case 'create_probuilder_shape':
        validatedArgs = schemas.CreateProbuilderShapeSchema.parse(args);
        break;
      case 'apply_material':
        validatedArgs = schemas.ApplyMaterialSchema.parse(args);
        break;
      case 'set_material_properties':
        validatedArgs = schemas.SetMaterialPropertiesSchema.parse(args);
        break;
      case 'set_physics_properties':
        validatedArgs = schemas.SetPhysicsPropertiesSchema.parse(args);
        break;
      case 'configure_cinemachine':
        validatedArgs = schemas.ConfigureCinemachineSchema.parse(args);
        break;
      case 'instantiate_prefab':
        validatedArgs = schemas.InstantiatePrefabSchema.parse(args);
        break;
      case 'execute_editor_code':
        validatedArgs = schemas.ExecuteEditorCodeSchema.parse(args);
        break;
      case 'perform_undo':
        validatedArgs = schemas.PerformUndoSchema.parse(args);
        break;
      case 'perform_redo':
        validatedArgs = schemas.PerformRedoSchema.parse(args);
        break;
      // get_compile_status, get_project_info have no schema parameters
    }

    // Call Unity HTTP Bridge endpoint
    const result = await UnityClient.post(`/tools/${name}`, validatedArgs || {});

    // Check if the Unity tool returned success flag
    const isError = result.success === false;

    // Special handling for Vision tools to return actual base64 images
    if (!isError && (name === 'capture_game_view' || name === 'capture_scene_view' || name === 'capture_annotated_view')) {
      const imgData = result.data?.image;
      const mimeType = result.data?.mimeType || 'image/png';
      
      const contents: any[] = [
        {
          type: 'image',
          data: imgData,
          mimeType: mimeType
        }
      ];

      if (name === 'capture_annotated_view' && result.data?.annotations) {
        contents.push({
          type: 'text',
          text: `Annotations:\n${JSON.stringify(result.data.annotations, null, 2)}`
        });
      }

      return {
        content: contents,
        isError: false
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: false, // Set to false to prevent buggy MCP Inspector from crashing with a blank screen
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || String(error),
          }, null, 2),
        },
      ],
      isError: false, // Set to false to avoid crashing the MCP Inspector frontend
    };
  }
});

// Run server using Stdio transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Unity MCP Bridge running on stdio');
}

run().catch((error) => {
  console.error('Fatal error starting Unity MCP Bridge:', error);
  process.exit(1);
});
