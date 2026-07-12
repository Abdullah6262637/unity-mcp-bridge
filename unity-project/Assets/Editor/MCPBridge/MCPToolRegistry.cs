using System;
using System.Collections.Generic;
using UnityEngine;

namespace UnityMCPBridge
{
    public static class MCPToolRegistry
    {
        public delegate string ToolHandler(string jsonArgs);
        private static readonly Dictionary<string, ToolHandler> _handlers = new Dictionary<string, ToolHandler>();

        static MCPToolRegistry()
        {
            // Register tools from various components
            SceneTools.Register();
            ScriptTools.Register();
            ComponentTools.Register();
            AssetTools.Register();
            ConsoleTools.Register();
            TestTools.Register();
        }

        public static void Register(string name, ToolHandler handler)
        {
            _handlers[name] = handler;
        }

        public static string Dispatch(string toolName, string jsonArgs)
        {
            if (_handlers.TryGetValue(toolName, out var handler))
            {
                try
                {
                    return handler(jsonArgs);
                }
                catch (Exception ex)
                {
                    return $"{{\"success\":false,\"error\":\"{EscapeJson(ex.Message)}\",\"stackTrace\":\"{EscapeJson(ex.StackTrace)}\"}}";
                }
            }
            return $"{{\"success\":false,\"error\":\"Tool '{EscapeJson(toolName)}' not registered on the Unity Editor bridge.\"}}";
        }

        public static string EscapeJson(string value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            return value.Replace("\\", "\\\\")
                        .Replace("\"", "\\\"")
                        .Replace("\n", "\\n")
                        .Replace("\r", "\\r")
                        .Replace("\t", "\\t");
        }
    }
}
