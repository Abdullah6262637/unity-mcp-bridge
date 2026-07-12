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
        description: 'Retrieves the complete active scene hierarchy including GameObjects, active states, paths, and components.',
        inputSchema: {
          type: 'object',
          properties: {}
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
      // get_scene_hierarchy, get_compile_status, get_project_info have no schema parameters
    }

    // Call Unity HTTP Bridge endpoint
    const result = await UnityClient.post(`/tools/${name}`, validatedArgs || {});

    // Check if the Unity tool returned success flag
    const isError = result.success === false;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError,
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
      isError: true,
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
