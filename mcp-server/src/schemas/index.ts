import { z } from 'zod';

export const CreateGameObjectSchema = z.object({
  name: z.string().describe('The name of the GameObject to create.'),
  position: z.tuple([z.number(), z.number(), z.number()]).optional().describe('Optional local/global position as [x, y, z].'),
  parent_path: z.string().optional().describe('Optional parent GameObject path (e.g., /Parent/Child).'),
});

export const DeleteGameObjectSchema = z.object({
  path: z.string().describe('The hierarchy path of the GameObject to delete (e.g., /Parent/Child).'),
  confirm: z.boolean().describe('Set to true to confirm deletion. Destructive action.'),
});

export const AddComponentSchema = z.object({
  gameobject_path: z.string().describe('The hierarchy path of the GameObject (e.g., /MyObject).'),
  component_type: z.string().describe('The name of the Component class to add (e.g., Rigidbody, BoxCollider, or a custom script class).'),
});

export const RemoveComponentSchema = z.object({
  gameobject_path: z.string().describe('The hierarchy path of the GameObject.'),
  component_type: z.string().describe('The class name of the Component to remove.'),
});

export const SetComponentPropertySchema = z.object({
  gameobject_path: z.string().describe('The hierarchy path of the GameObject.'),
  component_type: z.string().describe('The Component class name.'),
  property: z.string().describe('The name of the public field or property to change.'),
  value: z.string().describe('The string-formatted value to assign. Supports numbers ("4.2"), booleans ("true"), Vector3 ("[0, 1.2, 3]"), and Colors ("[1,0,0,1]").'),
});

export const ReadScriptSchema = z.object({
  asset_path: z.string().describe('The relative path under Assets/ to read (e.g., Assets/Scripts/Player.cs).'),
});

export const WriteScriptSchema = z.object({
  asset_path: z.string().describe('The relative path under Assets/ to write.'),
  content: z.string().describe('The complete file content to write.'),
});

export const CreateScriptSchema = z.object({
  asset_path: z.string().describe('The path to create (e.g., Assets/Scripts/MyNewScript.cs).'),
  template: z.string().optional().describe('Optional custom template content. If omitted, a default MonoBehaviour class is generated.'),
});

export const GetConsoleLogsSchema = z.object({
  count: z.number().optional().default(50).describe('Maximum number of logs to fetch (default: 50).'),
  log_type: z.enum(['Log', 'Warning', 'Error', 'Assert', 'Exception']).optional().describe('Optional log type filter.'),
});

export const RunTestsSchema = z.object({
  test_mode: z.enum(['EditMode', 'PlayMode']).optional().default('EditMode').describe('The test mode to run (default: EditMode).'),
  filter: z.string().optional().describe('Optional search string/filter to run specific tests by name.'),
});

export const GetTestStatusSchema = z.object({
  job_id: z.string().describe('The test execution job ID returned by run_tests.'),
});

export const CreatePrefabSchema = z.object({
  gameobject_path: z.string().describe('The path of the GameObject in the hierarchy to save as a prefab.'),
  save_path: z.string().describe('The destination path under Assets/ ending with .prefab (e.g., Assets/Prefabs/MyPrefab.prefab).'),
});

export const ListAssetsSchema = z.object({
  folder_path: z.string().optional().default('Assets').describe('The folder path to scan (must start with Assets, default: Assets).'),
  filter: z.string().optional().describe('Optional filter for assets (e.g. name search or type filter like "t:Prefab" or "t:Material").'),
});
