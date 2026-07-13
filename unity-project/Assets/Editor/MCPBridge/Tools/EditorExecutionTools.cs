using System;
using System.IO;
using System.Reflection;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public class EditorExecutionTools : IMCPToolProvider
    {
        [Serializable]
        private class ExecuteCodeArgs
        {
            public string code;
        }

        private static string _tempScriptPath = "Assets/Editor/MCPBridge/MCPTempEditorScript.cs";
        private static bool _waitingForExecution = false;
        private static PendingRequest _executionRequest;

        public void RegisterTools()
        {
            MCPToolRegistry.Register("execute_editor_code", ExecuteEditorCode);
            EditorApplication.update += Update;
        }

        private static string ExecuteEditorCode(string jsonArgs)
        {
            var args = JsonUtility.FromJson<ExecuteCodeArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.code))
            {
                return "{\"success\":false,\"error\":\"code is required.\"}";
            }

            try
            {
                string fullPath = Path.Combine(Directory.GetCurrentDirectory(), _tempScriptPath);
                string dir = Path.GetDirectoryName(fullPath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                File.WriteAllText(fullPath, args.code);
                AssetDatabase.ImportAsset(_tempScriptPath, ImportAssetOptions.ForceUpdate);
                AssetDatabase.Refresh();

                _waitingForExecution = true;
                _executionRequest = MCPHttpServer.CurrentRequest;

                return "__DEFERRED__";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Failed to save or compile code: {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }

        private static void Update()
        {
            if (!_waitingForExecution) return;
            if (EditorApplication.isCompiling) return;

            _waitingForExecution = false;
            var request = _executionRequest;
            _executionRequest = null;

            if (request == null) return;

            string result = "";
            bool success = false;

            try
            {
                if (EditorUtility.scriptCompilationFailed)
                {
                    result = "C# Compilation failed. Check get_compile_status for details.";
                }
                else
                {
                    Type targetType = null;
                    MethodInfo targetMethod = null;

                    foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        if (assembly.GetName().Name.Contains("Assembly-CSharp-Editor") || 
                            assembly.GetName().Name.Contains("UnityMCPBridge.Editor"))
                        {
                            foreach (var type in assembly.GetTypes())
                            {
                                var method = type.GetMethod("Execute", BindingFlags.Public | BindingFlags.Static);
                                if (method != null && method.ReturnType == typeof(string))
                                {
                                    targetType = type;
                                    targetMethod = method;
                                    break;
                                }
                            }
                        }
                        if (targetMethod != null) break;
                    }

                    if (targetMethod != null)
                    {
                        string output = (string)targetMethod.Invoke(null, null);
                        result = output;
                        success = true;
                    }
                    else
                    {
                        result = "Could not find a class with a 'public static string Execute()' method in the compiled assembly.";
                    }
                }
            }
            catch (Exception ex)
            {
                result = "Runtime Exception during execution: " + ex.Message;
                if (ex.InnerException != null)
                {
                    result += " -> " + ex.InnerException.Message;
                }
            }
            finally
            {
                try
                {
                    string fullPath = Path.Combine(Directory.GetCurrentDirectory(), _tempScriptPath);
                    if (File.Exists(fullPath))
                    {
                        File.Delete(fullPath);
                        File.Delete(fullPath + ".meta");
                        AssetDatabase.Refresh();
                    }
                }
                catch {}
            }

            if (success)
            {
                request.ResponseBody = $"{{\"success\":true,\"result\":\"{MCPToolRegistry.EscapeJson(result)}\"}}";
            }
            else
            {
                request.ResponseBody = $"{{\"success\":false,\"error\":\"{MCPToolRegistry.EscapeJson(result)}\"}}";
            }
            request.ResponseStatus = 200;
            request.WaitHandle.Set();
        }
    }
}
