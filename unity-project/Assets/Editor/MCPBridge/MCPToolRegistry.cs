using System;
using System.Reflection;
using System.Diagnostics;
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
            DiscoverAndRegisterTools();
        }

        public static void Register(string name, ToolHandler handler)
        {
            _handlers[name] = handler;
        }

        private static void DiscoverAndRegisterTools()
        {
            _handlers.Clear();
            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                try
                {
                    foreach (var type in assembly.GetTypes())
                    {
                        if (typeof(IMCPToolProvider).IsAssignableFrom(type) && !type.IsInterface && !type.IsAbstract)
                        {
                            try
                            {
                                var provider = (IMCPToolProvider)Activator.CreateInstance(type);
                                provider.RegisterTools();
                            }
                            catch (Exception ex)
                            {
                                UnityEngine.Debug.LogError($"[MCPBridge] Failed to instantiate tool provider '{type.FullName}': {ex.Message}");
                            }
                        }
                    }
                }
                catch (ReflectionTypeLoadException ex)
                {
                    // Fallback to loadable types if assembly contains loading errors
                    foreach (var type in ex.Types)
                    {
                        if (type != null && typeof(IMCPToolProvider).IsAssignableFrom(type) && !type.IsInterface && !type.IsAbstract)
                        {
                            try
                            {
                                var provider = (IMCPToolProvider)Activator.CreateInstance(type);
                                provider.RegisterTools();
                            }
                            catch (Exception) { /* Ignored */ }
                        }
                    }
                }
                catch (Exception)
                {
                    // Ignore assembly loading errors for external plugins
                }
            }
        }

        public static string Dispatch(string toolName, string jsonArgs)
        {
            var stopwatch = Stopwatch.StartNew();
            string unityVersion = Application.unityVersion;

            if (_handlers.TryGetValue(toolName, out var handler))
            {
                try
                {
                    string handlerResult = handler(jsonArgs);
                    stopwatch.Stop();

                    bool isSuccess = handlerResult.Contains("\"success\":true");
                    string dataBlock = "null";
                    string errorBlock = "null";

                    if (isSuccess)
                    {
                        dataBlock = handlerResult;
                    }
                    else
                    {
                        string errorMsg = "Unknown error";
                        int errIndex = handlerResult.IndexOf("\"error\":\"");
                        if (errIndex != -1)
                        {
                            int start = errIndex + 9;
                            int end = handlerResult.IndexOf("\"", start);
                            if (end != -1)
                            {
                                errorMsg = handlerResult.Substring(start, end - start);
                            }
                        }

                        string codeStr = "ERROR";
                        if (handlerResult.Contains("\"dry_run\":true"))
                        {
                            codeStr = "DRY_RUN";
                        }

                        errorBlock = $"{{\"code\":\"{codeStr}\",\"message\":\"{EscapeJson(errorMsg)}\",\"details\":{handlerResult}}}";
                    }

                    return $"{{\"success\":{isSuccess.ToString().ToLower()},\"data\":{dataBlock},\"error\":{errorBlock},\"meta\":{{\"duration_ms\":{stopwatch.ElapsedMilliseconds},\"unity_version\":\"{unityVersion}\"}}}}";
                }
                catch (Exception ex)
                {
                    stopwatch.Stop();
                    string escapedMsg = EscapeJson(ex.Message);
                    string escapedStack = EscapeJson(ex.StackTrace);

                    return $"{{\"success\":false,\"data\":null,\"error\":{{\"code\":\"EXCEPTION\",\"message\":\"{escapedMsg}\",\"details\":\"{escapedStack}\"}},\"meta\":{{\"duration_ms\":{stopwatch.ElapsedMilliseconds},\"unity_version\":\"{unityVersion}\"}}}}";
                }
            }

            stopwatch.Stop();
            return $"{{\"success\":false,\"data\":null,\"error\":{{\"code\":\"NOT_FOUND\",\"message\":\"Tool '{EscapeJson(toolName)}' not registered.\"}},\"meta\":{{\"duration_ms\":{stopwatch.ElapsedMilliseconds},\"unity_version\":\"{unityVersion}\"}}}}";
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
