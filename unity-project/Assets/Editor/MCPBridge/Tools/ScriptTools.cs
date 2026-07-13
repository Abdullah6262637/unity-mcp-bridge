using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.Compilation;

namespace UnityMCPBridge
{
    [InitializeOnLoad]
    public class ScriptTools : IMCPToolProvider
    {
        [Serializable]
        private class ReadArgs
        {
            public string asset_path;
        }

        [Serializable]
        private class WriteArgs
        {
            public string asset_path;
            public string content;
        }

        [Serializable]
        private class CreateArgs
        {
            public string asset_path;
            public string template;
        }

        private static readonly List<CompilerMessage> _latestMessages = new List<CompilerMessage>();

        static ScriptTools()
        {
            // Subscribe to compilation finished events to cache compiler warnings/errors
            CompilationPipeline.assemblyCompilationFinished += OnAssemblyCompilationFinished;
        }

        private static void OnAssemblyCompilationFinished(string assemblyPath, CompilerMessage[] messages)
        {
            _latestMessages.Clear();
            _latestMessages.AddRange(messages);
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("read_script", ReadScript);
            MCPToolRegistry.Register("write_script", WriteScript);
            MCPToolRegistry.Register("create_script", CreateScript);
            MCPToolRegistry.Register("get_compile_status", GetCompileStatus);
        }

        private static string ReadScript(string jsonArgs)
        {
            var args = JsonUtility.FromJson<ReadArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.asset_path))
            {
                return "{\"success\":false,\"error\":\"asset_path is required.\"}";
            }

            if (!MCPToolRegistry.IsPathSafe(args.asset_path))
            {
                return "{\"success\":false,\"error\":\"Path must be inside 'Assets/' directory and not perform traversal for security.\"}";
            }

            string fullPath = Path.Combine(Directory.GetCurrentDirectory(), args.asset_path);
            if (!File.Exists(fullPath))
            {
                return $"{{\"success\":false,\"error\":\"Script file not found at path: {MCPToolRegistry.EscapeJson(args.asset_path)}\"}}";
            }

            try
            {
                string content = File.ReadAllText(fullPath);
                return $"{{\"success\":true,\"content\":\"{MCPToolRegistry.EscapeJson(content)}\"}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Failed to read script: {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }

        private static string WriteScript(string jsonArgs)
        {
            var args = JsonUtility.FromJson<WriteArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.asset_path) || args.content == null)
            {
                return "{\"success\":false,\"error\":\"asset_path and content are required.\"}";
            }

            if (!MCPToolRegistry.IsPathSafe(args.asset_path))
            {
                return "{\"success\":false,\"error\":\"Path must be inside 'Assets/' directory and not perform traversal for security.\"}";
            }

            string fullPath = Path.Combine(Directory.GetCurrentDirectory(), args.asset_path);
            try
            {
                string directory = Path.GetDirectoryName(fullPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                File.WriteAllText(fullPath, args.content);
                AssetDatabase.ImportAsset(args.asset_path, ImportAssetOptions.ForceUpdate);
                AssetDatabase.Refresh();

                // Check if compilation starts immediately.
                bool compilationFailed = EditorUtility.scriptCompilationFailed;
                return $"{{\"success\":true,\"compilationTriggered\":true,\"compilationFailed\":{compilationFailed.ToString().ToLower()}}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Failed to write script: {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }

        private static string CreateScript(string jsonArgs)
        {
            var args = JsonUtility.FromJson<CreateArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.asset_path))
            {
                return "{\"success\":false,\"error\":\"asset_path is required.\"}";
            }

            if (!MCPToolRegistry.IsPathSafe(args.asset_path))
            {
                return "{\"success\":false,\"error\":\"Path must be inside 'Assets/' directory and not perform traversal for security.\"}";
            }

            string fullPath = Path.Combine(Directory.GetCurrentDirectory(), args.asset_path);
            if (File.Exists(fullPath))
            {
                return $"{{\"success\":false,\"error\":\"File already exists at path: {MCPToolRegistry.EscapeJson(args.asset_path)}\"}}";
            }

            try
            {
                string directory = Path.GetDirectoryName(fullPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                string className = Path.GetFileNameWithoutExtension(args.asset_path);
                string content = args.template;
                if (string.IsNullOrEmpty(content))
                {
                    content = GetDefaultTemplate(className);
                }

                File.WriteAllText(fullPath, content);
                AssetDatabase.ImportAsset(args.asset_path, ImportAssetOptions.ForceUpdate);
                AssetDatabase.Refresh();

                return "{\"success\":true}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Failed to create script: {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }

        private static string GetCompileStatus(string jsonArgs)
        {
            bool hasErrors = EditorUtility.scriptCompilationFailed;

            var msgList = new List<string>();
            foreach (var msg in _latestMessages)
            {
                string typeStr = msg.type == CompilerMessageType.Error ? "error" : "warning";
                string escapedMsg = MCPToolRegistry.EscapeJson(msg.message);
                string escapedFile = MCPToolRegistry.EscapeJson(msg.file);

                msgList.Add($"{{\"type\":\"{typeStr}\",\"message\":\"{escapedMsg}\",\"file\":\"{escapedFile}\",\"line\":{msg.line},\"column\":{msg.column}}}");
            }

            string messagesJson = "[" + string.Join(",", msgList) + "]";
            return $"{{\"success\":true,\"hasErrors\":{hasErrors.ToString().ToLower()},\"messages\":{messagesJson}}}";
        }

        private static string GetDefaultTemplate(string className)
        {
            return "using UnityEngine;\n\n" +
                   "public class " + className + " : MonoBehaviour\n" +
                   "{\n" +
                   "    // Start is called before the first frame update\n" +
                   "    void Start()\n" +
                   "    {\n" +
                   "        \n" +
                   "    }\n\n" +
                   "    // Update is called once per frame\n" +
                   "    void Update()\n" +
                   "    {\n" +
                   "        \n" +
                   "    }\n" +
                   "}\n";
        }
    }
}
