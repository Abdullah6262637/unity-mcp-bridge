using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.SceneManagement;

namespace UnityMCPBridge
{
    public class SceneTools : IMCPToolProvider
    {
        private static int _serializedCount = 0;
        private const int MaxSerializedObjects = 2000;
        [Serializable]
        private class CreateArgs
        {
            public string name;
            public float[] position;
            public string parent_path;
        }

        [Serializable]
        private class DeleteArgs
        {
            public string path;
            public bool confirm;
        }

        [Serializable]
        private class HierarchyArgs
        {
            public int max_depth;
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("create_gameobject", CreateGameObject);
            MCPToolRegistry.Register("delete_gameobject", DeleteGameObject);
            MCPToolRegistry.Register("get_scene_hierarchy", GetSceneHierarchy);
            MCPToolRegistry.Register("perform_undo", PerformUndo);
            MCPToolRegistry.Register("perform_redo", PerformRedo);
        }

        private static string PerformUndo(string jsonArgs)
        {
            Undo.PerformUndo();
            return "{\"success\":true}";
        }

        private static string PerformRedo(string jsonArgs)
        {
            Undo.PerformRedo();
            return "{\"success\":true}";
        }

        private static string CreateGameObject(string jsonArgs)
        {
            var args = JsonUtility.FromJson<CreateArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.name))
            {
                return "{\"success\":false,\"error\":\"GameObject name is required.\"}";
            }

            GameObject parent = null;
            if (!string.IsNullOrEmpty(args.parent_path))
            {
                parent = FindGameObjectByPath(args.parent_path);
                if (parent == null)
                {
                    return $"{{\"success\":false,\"error\":\"Parent GameObject at path '{MCPToolRegistry.EscapeJson(args.parent_path)}' was not found.\"}}";
                }
            }

            GameObject go = null;
            string nameLower = args.name.ToLower();

            // Auto-instantiate primitives based on name keywords to avoid blank empty GameObjects
            if (nameLower.Contains("cube") || nameLower.Contains("küp"))
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            }
            else if (nameLower.Contains("sphere") || nameLower.Contains("küre"))
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            }
            else if (nameLower.Contains("cylinder") || nameLower.Contains("silindir"))
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            }
            else if (nameLower.Contains("capsule") || nameLower.Contains("kapsül"))
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            }
            else if (nameLower.Contains("plane") || nameLower.Contains("zemin"))
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Plane);
            }
            else if (nameLower.Contains("quad"))
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            }
            else
            {
                go = new GameObject(args.name);
            }

            go.name = args.name;

            if (parent != null)
            {
                go.transform.SetParent(parent.transform, false);
            }

            if (args.position != null && args.position.Length == 3)
            {
                Vector3 pos = new Vector3(args.position[0], args.position[1], args.position[2]);
                if (parent != null)
                {
                    go.transform.localPosition = pos;
                }
                else
                {
                    go.transform.position = pos;
                }
            }

            // Register undo for editor compatibility
            Undo.RegisterCreatedObjectUndo(go, "Create " + args.name);

            string path = GetGameObjectPath(go);
            return $"{{\"success\":true,\"instanceId\":{go.GetInstanceID()},\"name\":\"{MCPToolRegistry.EscapeJson(go.name)}\",\"path\":\"{MCPToolRegistry.EscapeJson(path)}\"}}";
        }

        private static string DeleteGameObject(string jsonArgs)
        {
            var args = JsonUtility.FromJson<DeleteArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.path))
            {
                return "{\"success\":false,\"error\":\"GameObject path is required.\"}";
            }

            GameObject go = FindGameObjectByPath(args.path);
            if (go == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject at path '{MCPToolRegistry.EscapeJson(args.path)}' was not found.\"}}";
            }

            var settings = MCPBridgeSettings.GetOrCreateSettings();
            if (settings.requireConfirmationForDestructive && !args.confirm)
            {
                return $"{{\"success\":false,\"dry_run\":true,\"message\":\"Confirmation required to delete GameObject at path: '{MCPToolRegistry.EscapeJson(args.path)}'. Re-run with confirm: true to execute.\"}}";
            }

            Undo.DestroyObjectImmediate(go);
            return "{\"success\":true}";
        }

        private static string GetSceneHierarchy(string jsonArgs)
        {
            int maxDepth = 3; // Default to 3 for safety
            try
            {
                var args = JsonUtility.FromJson<HierarchyArgs>(jsonArgs);
                if (args != null && args.max_depth > 0)
                {
                    maxDepth = args.max_depth;
                }
            }
            catch {}

            _serializedCount = 0;
            var rootObjects = SceneManager.GetActiveScene().GetRootGameObjects();
            var rootsJson = new List<string>();
            foreach (var root in rootObjects)
            {
                if (_serializedCount >= MaxSerializedObjects)
                {
                    rootsJson.Add($"{{\"name\":\"... [Daha fazla kök obje listelenmedi (Limit: {MaxSerializedObjects})]\"}}");
                    break;
                }
                rootsJson.Add(SerializeGameObject(root, string.Empty, 1, maxDepth));
            }
            string hierarchyJson = "[" + string.Join(",", rootsJson) + "]";
            return $"{{\"success\":true,\"hierarchy\":{hierarchyJson}}}";
        }

        public static GameObject FindGameObjectByPath(string path)
        {
            if (string.IsNullOrEmpty(path)) return null;

            string[] parts = path.Split(new char[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return null;

            var rootObjects = SceneManager.GetActiveScene().GetRootGameObjects();
            GameObject current = null;

            foreach (var root in rootObjects)
            {
                if (root.name.Equals(parts[0], StringComparison.OrdinalIgnoreCase))
                {
                    current = root;
                    break;
                }
            }

            if (current == null) return null;

            for (int i = 1; i < parts.Length; i++)
            {
                Transform child = current.transform.Find(parts[i]);
                if (child == null) return null;
                current = child.gameObject;
            }

            return current;
        }

        public static string GetGameObjectPath(GameObject go)
        {
            if (go == null) return string.Empty;
            string path = go.name;
            Transform t = go.transform;
            while (t.parent != null)
            {
                t = t.parent;
                path = t.name + "/" + path;
            }
            return "/" + path;
        }

        private static string SerializeGameObject(GameObject go, string parentPath, int currentDepth, int maxDepth)
        {
            _serializedCount++;
            string path = string.IsNullOrEmpty(parentPath) ? $"/{go.name}" : $"{parentPath}/{go.name}";

            var components = go.GetComponents<Component>();
            var componentList = new List<string>();
            foreach (var comp in components)
            {
                if (comp != null)
                {
                    componentList.Add(comp.GetType().Name);
                }
            }

            string compJson = "[" + string.Join(",", componentList.ConvertAll(c => $"\"{MCPToolRegistry.EscapeJson(c)}\"")) + "]";

            var childrenJson = new List<string>();
            if (maxDepth <= 0 || currentDepth < maxDepth)
            {
                for (int i = 0; i < go.transform.childCount; i++)
                {
                    if (_serializedCount >= MaxSerializedObjects)
                    {
                        childrenJson.Add($"{{\"name\":\"... [Daha fazla alt obje listelenmedi (Limit: {MaxSerializedObjects})]\"}}");
                        break;
                    }
                    childrenJson.Add(SerializeGameObject(go.transform.GetChild(i).gameObject, path, currentDepth + 1, maxDepth));
                }
            }
            string childJson = "[" + string.Join(",", childrenJson) + "]";

            Vector3 pos = go.transform.position;
            Vector3 rot = go.transform.eulerAngles;
            Vector3 scale = go.transform.localScale;

            string transformJson = $"{{\"position\":[{pos.x.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)},{pos.y.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)},{pos.z.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}]," +
                                   $"\"rotation\":[{rot.x.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)},{rot.y.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)},{rot.z.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}]," +
                                   $"\"scale\":[{scale.x.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)},{scale.y.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)},{scale.z.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)}]}}";

            string escapedName = MCPToolRegistry.EscapeJson(go.name);
            return $"{{\"name\":\"{escapedName}\",\"path\":\"{MCPToolRegistry.EscapeJson(path)}\",\"instanceId\":{go.GetInstanceID()},\"active\":{go.activeSelf.ToString().ToLower()},\"transform\":{transformJson},\"components\":{compJson},\"children\":{childJson}}}";
        }
    }
}
