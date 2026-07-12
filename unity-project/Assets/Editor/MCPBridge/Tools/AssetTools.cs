using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.Rendering;

namespace UnityMCPBridge
{
    public class AssetTools : IMCPToolProvider
    {
        [Serializable]
        private class PrefabArgs
        {
            public string gameobject_path;
            public string save_path;
        }

        [Serializable]
        private class ListAssetsArgs
        {
            public string folder_path;
            public string filter;
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("create_prefab", CreatePrefab);
            MCPToolRegistry.Register("list_assets", ListAssets);
            MCPToolRegistry.Register("get_project_info", GetProjectInfo);
        }

        private static string CreatePrefab(string jsonArgs)
        {
            var args = JsonUtility.FromJson<PrefabArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path) || string.IsNullOrEmpty(args.save_path))
            {
                return "{\"success\":false,\"error\":\"gameobject_path and save_path are required.\"}";
            }

            if (!args.save_path.StartsWith("Assets/", StringComparison.OrdinalIgnoreCase))
            {
                return "{\"success\":false,\"error\":\"save_path must start with 'Assets/' for security.\"}";
            }

            if (!args.save_path.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase))
            {
                return "{\"success\":false,\"error\":\"save_path must end with '.prefab'.\"}";
            }

            GameObject go = SceneTools.FindGameObjectByPath(args.gameobject_path);
            if (go == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject at path '{MCPToolRegistry.EscapeJson(args.gameobject_path)}' was not found.\"}}";
            }

            try
            {
                string directory = Path.GetDirectoryName(Path.Combine(Directory.GetCurrentDirectory(), args.save_path));
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                GameObject prefab = PrefabUtility.SaveAsPrefabAsset(go, args.save_path, out bool success);
                if (success && prefab != null)
                {
                    return $"{{\"success\":true,\"prefabPath\":\"{MCPToolRegistry.EscapeJson(args.save_path)}\",\"instanceId\":{prefab.GetInstanceID()}}}";
                }
                else
                {
                    return "{\"success\":false,\"error\":\"Prefab creation failed.\"}";
                }
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Failed to create prefab: {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }

        private static string ListAssets(string jsonArgs)
        {
            var args = JsonUtility.FromJson<ListAssetsArgs>(jsonArgs);
            string folder = args?.folder_path ?? "Assets";
            string filter = args?.filter ?? string.Empty;

            if (!folder.StartsWith("Assets", StringComparison.OrdinalIgnoreCase))
            {
                return "{\"success\":false,\"error\":\"folder_path must start with 'Assets' for security.\"}";
            }

            try
            {
                var assets = new List<string>();
                if (string.IsNullOrEmpty(filter))
                {
                    // Scan folders recursively when filter query is empty
                    string currentDir = Directory.GetCurrentDirectory();
                    string fullFolderPath = Path.GetFullPath(Path.Combine(currentDir, folder));
                    if (Directory.Exists(fullFolderPath))
                    {
                        string[] files = Directory.GetFiles(fullFolderPath, "*.*", SearchOption.AllDirectories);
                        foreach (string file in files)
                        {
                            string relativePath = file.Substring(currentDir.Length + 1).Replace('\\', '/');
                            
                            // Exclude meta files and hidden paths
                            if (!relativePath.EndsWith(".meta", StringComparison.OrdinalIgnoreCase) && 
                                !relativePath.Contains("/.") && 
                                !relativePath.Contains("\\."))
                            {
                                assets.Add(relativePath);
                            }
                        }
                    }
                }
                else
                {
                    // Fall back to Unity's FindAssets database search index
                    string[] searchFolders = new string[] { folder };
                    string[] guids = AssetDatabase.FindAssets(filter, searchFolders);
                    foreach (var guid in guids)
                    {
                        string path = AssetDatabase.GUIDToAssetPath(guid);
                        if (!string.IsNullOrEmpty(path) && !assets.Contains(path) && !Directory.Exists(Path.Combine(Directory.GetCurrentDirectory(), path)))
                        {
                            assets.Add(path);
                        }
                    }
                }

                string assetsJson = "[" + string.Join(",", assets.ConvertAll(a => $"\"{MCPToolRegistry.EscapeJson(a)}\"")) + "]";
                return $"{{\"success\":true,\"assets\":{assetsJson}}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Failed to list assets: {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }

        private static string GetProjectInfo(string jsonArgs)
        {
            string rpName = "Built-in Render Pipeline";
            if (GraphicsSettings.currentRenderPipeline != null)
            {
                rpName = GraphicsSettings.currentRenderPipeline.GetType().Name;
            }

            string platform = EditorUserBuildSettings.activeBuildTarget.ToString();
            string unityVersion = Application.unityVersion;
            string scriptingBackend = PlayerSettings.GetScriptingBackend(BuildPipeline.GetBuildTargetGroup(EditorUserBuildSettings.activeBuildTarget)).ToString();

            return $"{{\"success\":true," +
                   $"\"unityVersion\":\"{MCPToolRegistry.EscapeJson(unityVersion)}\"," +
                   $"\"renderPipeline\":\"{MCPToolRegistry.EscapeJson(rpName)}\"," +
                   $"\"targetPlatform\":\"{MCPToolRegistry.EscapeJson(platform)}\"," +
                   $"\"scriptingBackend\":\"{MCPToolRegistry.EscapeJson(scriptingBackend)}\"," +
                   $"\"companyName\":\"{MCPToolRegistry.EscapeJson(PlayerSettings.companyName)}\"," +
                   $"\"productName\":\"{MCPToolRegistry.EscapeJson(PlayerSettings.productName)}\"}}";
        }
    }
}
