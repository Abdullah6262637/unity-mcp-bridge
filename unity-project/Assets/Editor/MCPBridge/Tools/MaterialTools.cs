using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public class MaterialTools : IMCPToolProvider
    {
        [Serializable]
        private class ApplyMaterialArgs
        {
            public string gameobject_path;
            public string material_path;
        }

        [Serializable]
        private class MaterialPropsArgs
        {
            public string gameobject_path;
            public string color; // hex string e.g. "#FF0000" or rgb float array "[1,0,0]"
            public float metallic; // 0 to 1
            public float smoothness; // 0 to 1
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("apply_material", ApplyMaterial);
            MCPToolRegistry.Register("set_material_properties", SetMaterialProperties);
        }

        private static string ApplyMaterial(string jsonArgs)
        {
            var args = JsonUtility.FromJson<ApplyMaterialArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path) || string.IsNullOrEmpty(args.material_path))
            {
                return "{\"success\":false,\"error\":\"gameobject_path and material_path are required.\"}";
            }

            GameObject go = SceneTools.FindGameObjectByPath(args.gameobject_path);
            if (go == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject not found: {MCPToolRegistry.EscapeJson(args.gameobject_path)}\"}}";
            }

            Material mat = AssetDatabase.LoadAssetAtPath<Material>(args.material_path);
            if (mat == null)
            {
                return $"{{\"success\":false,\"error\":\"Material not found at path: {MCPToolRegistry.EscapeJson(args.material_path)}\"}}";
            }

            var renderer = go.GetComponent<Renderer>();
            if (renderer == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject does not have a Renderer component: {MCPToolRegistry.EscapeJson(args.gameobject_path)}\"}}";
            }

            Undo.RecordObject(renderer, "Apply Material");
            renderer.sharedMaterial = mat;
            EditorUtility.SetDirty(go);

            return "{\"success\":true}";
        }

        private static string SetMaterialProperties(string jsonArgs)
        {
            var args = JsonUtility.FromJson<MaterialPropsArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path))
            {
                return "{\"success\":false,\"error\":\"gameobject_path is required.\"}";
            }

            GameObject go = SceneTools.FindGameObjectByPath(args.gameobject_path);
            if (go == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject not found: {MCPToolRegistry.EscapeJson(args.gameobject_path)}\"}}";
            }

            var renderer = go.GetComponent<Renderer>();
            if (renderer == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject does not have a Renderer component: {MCPToolRegistry.EscapeJson(args.gameobject_path)}\"}}";
            }

            Material mat = renderer.sharedMaterial;
            if (mat == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null)
                {
                    shader = Shader.Find("Standard");
                }
                mat = new Material(shader);
                renderer.sharedMaterial = mat;
            }

            Undo.RecordObject(mat, "Modify Material Properties");

            if (!string.IsNullOrEmpty(args.color))
            {
                Color col;
                if (ColorUtility.TryParseHtmlString(args.color, out col))
                {
                    mat.color = col;
                }
                else if (args.color.StartsWith("[") && args.color.EndsWith("]"))
                {
                    try
                    {
                        string[] parts = args.color.Trim('[', ']').Split(',');
                        if (parts.Length >= 3)
                        {
                            float r = float.Parse(parts[0], System.Globalization.CultureInfo.InvariantCulture);
                            float g = float.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture);
                            float b = float.Parse(parts[2], System.Globalization.CultureInfo.InvariantCulture);
                            float a = parts.Length > 3 ? float.Parse(parts[3], System.Globalization.CultureInfo.InvariantCulture) : 1f;
                            mat.color = new Color(r, g, b, a);
                        }
                    }
                    catch {}
                }
            }

            if (args.metallic >= 0f && args.metallic <= 1f)
            {
                if (mat.HasProperty("_Metallic"))
                {
                    mat.SetFloat("_Metallic", args.metallic);
                }
            }

            if (args.smoothness >= 0f && args.smoothness <= 1f)
            {
                if (mat.HasProperty("_Glossiness"))
                {
                    mat.SetFloat("_Glossiness", args.smoothness);
                }
                else if (mat.HasProperty("_Smoothness"))
                {
                    mat.SetFloat("_Smoothness", args.smoothness);
                }
            }

            EditorUtility.SetDirty(mat);
            return "{\"success\":true}";
        }
    }
}
