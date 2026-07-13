using System;
using System.IO;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public class PrefabTools : IMCPToolProvider
    {
        [Serializable]
        private class InstantiatePrefabArgs
        {
            public string prefab_path;
            public float[] position;
            public string parent_path;
            public string name;
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("instantiate_prefab", InstantiatePrefab);
        }

        private static string InstantiatePrefab(string jsonArgs)
        {
            var args = JsonUtility.FromJson<InstantiatePrefabArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.prefab_path))
            {
                return "{\"success\":false,\"error\":\"prefab_path is required.\"}";
            }

            if (!MCPToolRegistry.IsPathSafe(args.prefab_path))
            {
                return "{\"success\":false,\"error\":\"prefab_path must be inside 'Assets/' and not perform traversal for security.\"}";
            }

            GameObject prefabAsset = AssetDatabase.LoadAssetAtPath<GameObject>(args.prefab_path);
            if (prefabAsset == null)
            {
                return $"{{\"success\":false,\"error\":\"Prefab not found at path: {MCPToolRegistry.EscapeJson(args.prefab_path)}\"}}";
            }

            GameObject parent = null;
            if (!string.IsNullOrEmpty(args.parent_path))
            {
                parent = SceneTools.FindGameObjectByPath(args.parent_path);
                if (parent == null)
                {
                    return $"{{\"success\":false,\"error\":\"Parent GameObject not found: {MCPToolRegistry.EscapeJson(args.parent_path)}\"}}";
                }
            }

            GameObject go = (GameObject)PrefabUtility.InstantiatePrefab(prefabAsset);
            if (go == null)
            {
                return "{\"success\":false,\"error\":\"Failed to instantiate prefab.\"}";
            }

            if (!string.IsNullOrEmpty(args.name))
            {
                go.name = args.name;
            }

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

            Undo.RegisterCreatedObjectUndo(go, "Instantiate Prefab " + go.name);
            string path = SceneTools.GetGameObjectPath(go);

            return $"{{\"success\":true,\"instanceId\":{go.GetInstanceID()},\"name\":\"{MCPToolRegistry.EscapeJson(go.name)}\",\"path\":\"{MCPToolRegistry.EscapeJson(path)}\"}}";
        }
    }
}
