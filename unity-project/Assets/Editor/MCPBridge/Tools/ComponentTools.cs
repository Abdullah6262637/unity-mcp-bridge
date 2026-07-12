using System;
using System.Reflection;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public static class ComponentTools
    {
        [Serializable]
        private class ComponentArgs
        {
            public string gameobject_path;
            public string component_type;
        }

        [Serializable]
        private class SetPropertyArgs
        {
            public string gameobject_path;
            public string component_type;
            public string property;
            public string value;
        }

        public static void Register()
        {
            MCPToolRegistry.Register("add_component", AddComponent);
            MCPToolRegistry.Register("remove_component", RemoveComponent);
            MCPToolRegistry.Register("set_component_property", SetComponentProperty);
        }

        private static string AddComponent(string jsonArgs)
        {
            var args = JsonUtility.FromJson<ComponentArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path) || string.IsNullOrEmpty(args.component_type))
            {
                return "{\"success\":false,\"error\":\"gameobject_path and component_type are required.\"}";
            }

            GameObject go = SceneTools.FindGameObjectByPath(args.gameobject_path);
            if (go == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject at path '{MCPToolRegistry.EscapeJson(args.gameobject_path)}' was not found.\"}}";
            }

            Type compType = FindType(args.component_type);
            if (compType == null)
            {
                return $"{{\"success\":false,\"error\":\"Component type '{MCPToolRegistry.EscapeJson(args.component_type)}' was not found in loaded assemblies.\"}}";
            }

            if (!typeof(Component).IsAssignableFrom(compType))
            {
                return $"{{\"success\":false,\"error\":\"Type '{MCPToolRegistry.EscapeJson(args.component_type)}' is not a Component.\"}}";
            }

            // Register undo for editor safety
            Component comp = Undo.AddComponent(go, compType);
            return $"{{\"success\":true,\"componentId\":{comp.GetInstanceID()}}}";
        }

        private static string RemoveComponent(string jsonArgs)
        {
            var args = JsonUtility.FromJson<ComponentArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path) || string.IsNullOrEmpty(args.component_type))
            {
                return "{\"success\":false,\"error\":\"gameobject_path and component_type are required.\"}";
            }

            GameObject go = SceneTools.FindGameObjectByPath(args.gameobject_path);
            if (go == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject at path '{MCPToolRegistry.EscapeJson(args.gameobject_path)}' was not found.\"}}";
            }

            Type compType = FindType(args.component_type);
            if (compType == null)
            {
                return $"{{\"success\":false,\"error\":\"Component type '{MCPToolRegistry.EscapeJson(args.component_type)}' was not found.\"}}";
            }

            Component comp = go.GetComponent(compType);
            if (comp == null)
            {
                return $"{{\"success\":false,\"error\":\"Component of type '{MCPToolRegistry.EscapeJson(args.component_type)}' was not found on the GameObject.\"}}";
            }

            Undo.DestroyObjectImmediate(comp);
            return "{\"success\":true}";
        }

        private static string SetComponentProperty(string jsonArgs)
        {
            var args = JsonUtility.FromJson<SetPropertyArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path) || string.IsNullOrEmpty(args.component_type) || string.IsNullOrEmpty(args.property) || args.value == null)
            {
                return "{\"success\":false,\"error\":\"gameobject_path, component_type, property, and value are required.\"}";
            }

            GameObject go = SceneTools.FindGameObjectByPath(args.gameobject_path);
            if (go == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject at path '{MCPToolRegistry.EscapeJson(args.gameobject_path)}' was not found.\"}}";
            }

            Type compType = FindType(args.component_type);
            if (compType == null)
            {
                return $"{{\"success\":false,\"error\":\"Component type '{MCPToolRegistry.EscapeJson(args.component_type)}' was not found.\"}}";
            }

            Component comp = go.GetComponent(compType);
            if (comp == null)
            {
                return $"{{\"success\":false,\"error\":\"Component of type '{MCPToolRegistry.EscapeJson(args.component_type)}' was not found on the GameObject.\"}}";
            }

            // Register undo before modifying property
            Undo.RecordObject(comp, "Set Property " + args.property);

            // Reflection lookup for fields or properties
            FieldInfo field = compType.GetField(args.property, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (field != null)
            {
                try
                {
                    object val = ConvertValue(args.value, field.FieldType);
                    field.SetValue(comp, val);
                    EditorUtility.SetDirty(comp);
                    return "{\"success\":true}";
                }
                catch (Exception ex)
                {
                    return $"{{\"success\":false,\"error\":\"Failed to set field '{args.property}': {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
                }
            }

            PropertyInfo prop = compType.GetProperty(args.property, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (prop != null && prop.CanWrite)
            {
                try
                {
                    object val = ConvertValue(args.value, prop.PropertyType);
                    prop.SetValue(comp, val, null);
                    EditorUtility.SetDirty(comp);
                    return "{\"success\":true}";
                }
                catch (Exception ex)
                {
                    return $"{{\"success\":false,\"error\":\"Failed to set property '{args.property}': {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
                }
            }

            return $"{{\"success\":false,\"error\":\"Field or property '{args.property}' was not found on component '{args.component_type}' or is read-only.\"}}";
        }

        private static Type FindType(string typeName)
        {
            var type = Type.GetType(typeName);
            if (type != null) return type;

            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                type = assembly.GetType(typeName);
                if (type != null) return type;

                // Namespace fallback search
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
