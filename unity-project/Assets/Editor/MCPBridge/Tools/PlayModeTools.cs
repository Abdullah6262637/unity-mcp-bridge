using System;
using System.Reflection;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    [InitializeOnLoad]
    public class PlayModeTools : IMCPToolProvider
    {
        [Serializable]
        private class InspectArgs
        {
            public string gameobject_path;
            public string component_type;
            public string member_name;
        }

        [Serializable]
        private class SetArgs
        {
            public string gameobject_path;
            public string component_type;
            public string member_name;
            public string value;
        }

        [Serializable]
        private class WaitArgs
        {
            public string gameobject_path;
            public string component_type;
            public string member_name;
            public string op;
            public string value;
            public int timeout_ms = 5000;
        }

        private class PendingWait
        {
            public PendingRequest request;
            public string gameobject_path;
            public string component_type;
            public string member_name;
            public string op;
            public string target_value;
            public double timeoutTime;
        }

        private static readonly List<PendingWait> _pendingWaits = new List<PendingWait>();
        private static readonly object _lock = new object();

        static PlayModeTools()
        {
            // Register frame-rate update loop to check wait conditions
            EditorApplication.update += Update;
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("enter_play_mode", EnterPlayMode);
            MCPToolRegistry.Register("exit_play_mode", ExitPlayMode);
            MCPToolRegistry.Register("pause_play_mode", PausePlayMode);
            MCPToolRegistry.Register("step_frame", StepFrame);
            MCPToolRegistry.Register("inspect_runtime_value", InspectRuntimeValue);
            MCPToolRegistry.Register("set_runtime_value", SetRuntimeValue);
            MCPToolRegistry.Register("wait_for_condition", WaitForCondition);
        }

        private static string EnterPlayMode(string jsonArgs)
        {
            EditorApplication.isPlaying = true;
            return "{\"success\":true,\"isPlaying\":true}";
        }

        private static string ExitPlayMode(string jsonArgs)
        {
            EditorApplication.isPlaying = false;
            return "{\"success\":true,\"isPlaying\":false}";
        }

        private static string PausePlayMode(string jsonArgs)
        {
            EditorApplication.isPaused = true;
            return "{\"success\":true,\"isPaused\":true}";
        }

        private static string StepFrame(string jsonArgs)
        {
            EditorApplication.Step();
            return "{\"success\":true}";
        }

        private static string InspectRuntimeValue(string jsonArgs)
        {
            var args = JsonUtility.FromJson<InspectArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path) || string.IsNullOrEmpty(args.component_type) || string.IsNullOrEmpty(args.member_name))
            {
                return "{\"success\":false,\"error\":\"gameobject_path, component_type, and member_name are required.\"}";
            }

            try
            {
                object val = ReadMemberValue(args.gameobject_path, args.component_type, args.member_name);
                string strVal = val != null ? val.ToString() : "null";
                return $"{{\"success\":true,\"value\":\"{MCPToolRegistry.EscapeJson(strVal)}\"}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"{MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }

        private static string SetRuntimeValue(string jsonArgs)
        {
            var args = JsonUtility.FromJson<SetArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path) || string.IsNullOrEmpty(args.component_type) || string.IsNullOrEmpty(args.member_name) || args.value == null)
            {
                return "{\"success\":false,\"error\":\"gameobject_path, component_type, member_name, and value are required.\"}";
            }

            try
            {
                WriteMemberValue(args.gameobject_path, args.component_type, args.member_name, args.value);
                return "{\"success\":true}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"{MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }

        private static string WaitForCondition(string jsonArgs)
        {
            var args = JsonUtility.FromJson<WaitArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path) || string.IsNullOrEmpty(args.component_type) || string.IsNullOrEmpty(args.member_name) || string.IsNullOrEmpty(args.op) || args.value == null)
            {
                return "{\"success\":false,\"error\":\"gameobject_path, component_type, member_name, op, and value are required.\"}";
            }

            var req = MCPHttpServer.CurrentRequest;
            if (req == null)
            {
                return "{\"success\":false,\"error\":\"No active HTTP request context available.\"}";
            }

            try
            {
                // Evaluate immediately in the same frame
                if (EvaluateCondition(args.gameobject_path, args.component_type, args.member_name, args.op, args.value))
                {
                    return "{\"success\":true,\"message\":\"Condition met immediately.\"}";
                }
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Condition evaluation error: {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }

            // Otherwise, defer the request
            double timeoutTime = EditorApplication.timeSinceStartup + (args.timeout_ms / 1000.0);
            var wait = new PendingWait
            {
                request = req,
                gameobject_path = args.gameobject_path,
                component_type = args.component_type,
                member_name = args.member_name,
                op = args.op,
                target_value = args.value,
                timeoutTime = timeoutTime
            };

            lock (_lock)
            {
                _pendingWaits.Add(wait);
            }

            return "__DEFERRED__";
        }

        private static void Update()
        {
            lock (_lock)
            {
                if (_pendingWaits.Count == 0) return;

                double now = EditorApplication.timeSinceStartup;
                for (int i = _pendingWaits.Count - 1; i >= 0; i--)
                {
                    var wait = _pendingWaits[i];
                    bool conditionMet = false;
                    string errorMsg = null;

                    try
                    {
                        conditionMet = EvaluateCondition(wait.gameobject_path, wait.component_type, wait.member_name, wait.op, wait.target_value);
                    }
                    catch (Exception ex)
                    {
                        errorMsg = ex.Message;
                    }

                    if (conditionMet)
                    {
                        wait.request.ResponseBody = $"{{\"success\":true,\"data\":{{\"message\":\"Condition met successfully.\"}}}}";
                        wait.request.ResponseStatus = 200;
                        wait.request.WaitHandle.Set();
                        _pendingWaits.RemoveAt(i);
                    }
                    else if (errorMsg != null)
                    {
                        wait.request.ResponseBody = $"{{\"success\":false,\"error\":\"{MCPToolRegistry.EscapeJson(errorMsg)}\"}}";
                        wait.request.ResponseStatus = 400;
                        wait.request.WaitHandle.Set();
                        _pendingWaits.RemoveAt(i);
                    }
                    else if (now >= wait.timeoutTime)
                    {
                        wait.request.ResponseBody = "{\"success\":false,\"error\":\"Timeout elapsed before condition was met.\"}";
                        wait.request.ResponseStatus = 408;
                        wait.request.WaitHandle.Set();
                        _pendingWaits.RemoveAt(i);
                    }
                }
            }
        }

        private static bool EvaluateCondition(string path, string compType, string member, string op, string targetStr)
        {
            object rawVal = ReadMemberValue(path, compType, member);
            if (rawVal == null)
            {
                return op == "!=" && targetStr.Equals("null", StringComparison.OrdinalIgnoreCase);
            }

            // Compare as booleans if possible
            if (rawVal is bool bVal && bool.TryParse(targetStr, out bool bTarget))
            {
                if (op == "==") return bVal == bTarget;
                if (op == "!=") return bVal != bTarget;
                throw new InvalidOperationException("Operator " + op + " not supported for booleans.");
            }

            // Compare as numbers if possible
            if (double.TryParse(rawVal.ToString(), System.Globalization.CultureInfo.InvariantCulture, out double dVal) &&
                double.TryParse(targetStr, System.Globalization.CultureInfo.InvariantCulture, out double dTarget))
            {
                switch (op)
                {
                    case "==": return Math.Abs(dVal - dTarget) < 0.0001f;
                    case "!=": return Math.Abs(dVal - dTarget) >= 0.0001f;
                    case "<": return dVal < dTarget;
                    case ">": return dVal > dTarget;
                    case "<=": return dVal <= dTarget;
                    case ">=": return dVal >= dTarget;
                    default: throw new InvalidOperationException("Unsupported comparison operator: " + op);
                }
            }

            // Fallback to string comparison
            string sVal = rawVal.ToString();
            switch (op)
            {
                case "==": return sVal.Equals(targetStr, StringComparison.OrdinalIgnoreCase);
                case "!=": return !sVal.Equals(targetStr, StringComparison.OrdinalIgnoreCase);
                default: throw new InvalidOperationException("Unsupported operator for string comparison: " + op);
            }
        }

        private static object ReadMemberValue(string path, string compType, string member)
        {
            GameObject go = SceneTools.FindGameObjectByPath(path);
            if (go == null) throw new ArgumentException($"GameObject at path '{path}' was not found.");

            Type t = FindType(compType);
            if (t == null) throw new ArgumentException($"Component type '{compType}' was not found.");

            Component comp = go.GetComponent(t);
            if (comp == null) throw new ArgumentException($"GameObject does not have a component of type '{compType}'.");

            // Look up fields/properties
            FieldInfo field = t.GetField(member, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (field != null) return field.GetValue(comp);

            PropertyInfo prop = t.GetProperty(member, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (prop != null && prop.CanRead) return prop.GetValue(comp, null);

            throw new ArgumentException($"Field or property '{member}' was not found on component '{compType}'.");
        }

        private static void WriteMemberValue(string path, string compType, string member, string value)
        {
            GameObject go = SceneTools.FindGameObjectByPath(path);
            if (go == null) throw new ArgumentException($"GameObject at path '{path}' was not found.");

            Type t = FindType(compType);
            if (t == null) throw new ArgumentException($"Component type '{compType}' was not found.");

            Component comp = go.GetComponent(t);
            if (comp == null) throw new ArgumentException($"GameObject does not have a component of type '{compType}'.");

            Undo.RecordObject(comp, "Change Runtime Value " + member);

            FieldInfo field = t.GetField(member, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (field != null)
            {
                object convertedVal = ConvertValue(value, field.FieldType);
                field.SetValue(comp, convertedVal);
                EditorUtility.SetDirty(comp);
                return;
            }

            PropertyInfo prop = t.GetProperty(member, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (prop != null && prop.CanWrite)
            {
                object convertedVal = ConvertValue(value, prop.PropertyType);
                prop.SetValue(comp, convertedVal, null);
                EditorUtility.SetDirty(comp);
                return;
            }

            throw new ArgumentException($"Field or property '{member}' was not found on component '{compType}' or is read-only.");
        }

        private static Type FindType(string typeName)
        {
            var type = Type.GetType(typeName);
            if (type != null) return type;

            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                type = assembly.GetType(typeName);
                if (type != null) return type;

                foreach (var t in assembly.GetTypes())
                {
                    if (t.Name.Equals(typeName, StringComparison.OrdinalIgnoreCase) ||
                        t.FullName.Equals(typeName, StringComparison.OrdinalIgnoreCase))
                    {
                        return t;
                    }
                }
            }
            return null;
        }

        private static object ConvertValue(string rawValue, Type targetType)
        {
            if (targetType == typeof(string)) return rawValue;
            if (targetType == typeof(int)) return int.Parse(rawValue);
            if (targetType == typeof(float)) return float.Parse(rawValue, System.Globalization.CultureInfo.InvariantCulture);
            if (targetType == typeof(double)) return double.Parse(rawValue, System.Globalization.CultureInfo.InvariantCulture);
            if (targetType == typeof(bool)) return bool.Parse(rawValue);

            if (targetType == typeof(Vector3))
            {
                string cleaned = rawValue.Trim('[', ']', '(', ')');
                string[] parts = cleaned.Split(',');
                if (parts.Length == 3)
                {
                    return new Vector3(
                        float.Parse(parts[0], System.Globalization.CultureInfo.InvariantCulture),
                        float.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture),
                        float.Parse(parts[2], System.Globalization.CultureInfo.InvariantCulture)
                    );
                }
            }
            if (targetType == typeof(Vector2))
            {
                string cleaned = rawValue.Trim('[', ']', '(', ')');
                string[] parts = cleaned.Split(',');
                if (parts.Length == 2)
                {
                    return new Vector2(
                        float.Parse(parts[0], System.Globalization.CultureInfo.InvariantCulture),
                        float.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture)
                    );
                }
            }
            if (targetType == typeof(Color))
            {
                string cleaned = rawValue.Trim('[', ']', '(', ')');
                string[] parts = cleaned.Split(',');
                if (parts.Length >= 3)
                {
                    float r = float.Parse(parts[0], System.Globalization.CultureInfo.InvariantCulture);
                    float g = float.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture);
                    float b = float.Parse(parts[2], System.Globalization.CultureInfo.InvariantCulture);
                    float a = parts.Length > 3 ? float.Parse(parts[3], System.Globalization.CultureInfo.InvariantCulture) : 1f;

                    if (r > 1f || g > 1f || b > 1f)
                    {
                        r /= 255f; g /= 255f; b /= 255f; a /= 255f;
                    }
                    return new Color(r, g, b, a);
                }
            }

            return Convert.ChangeType(rawValue, targetType);
        }
    }
}
