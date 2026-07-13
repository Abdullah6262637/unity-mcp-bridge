using System;
using System.Reflection;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public class ProBuilderTools : IMCPToolProvider
    {
        [Serializable]
        private class CreateShapeArgs
        {
            public string shape_type; // "cube", "plane"
            public float[] size;
            public float[] position;
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("create_probuilder_shape", CreateProbuilderShape);
        }

        private static string CreateProbuilderShape(string jsonArgs)
        {
            var args = JsonUtility.FromJson<CreateShapeArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.shape_type))
            {
                return "{\"success\":false,\"error\":\"shape_type is required.\"}";
            }

            Type pbMeshType = null;
            Type shapeGenType = null;
            Type pivotType = null;

            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                if (pbMeshType == null) pbMeshType = assembly.GetType("UnityEngine.ProBuilder.ProBuilderMesh");
                if (shapeGenType == null) shapeGenType = assembly.GetType("UnityEngine.ProBuilder.ShapeGenerator");
                if (pivotType == null) pivotType = assembly.GetType("UnityEngine.ProBuilder.PivotLocation");
            }

            if (pbMeshType == null || shapeGenType == null || pivotType == null)
            {
                return "{\"success\":false,\"error\":\"ProBuilder package is not installed in this project. Install com.unity.probuilder first.\"}";
            }

            try
            {
                Vector3 size = Vector3.one;
                if (args.size != null && args.size.Length == 3)
                {
                    size = new Vector3(args.size[0], args.size[1], args.size[2]);
                }

                object pivotVal = Enum.Parse(pivotType, "Center");
                object pbMesh = null;

                string shapeName = args.shape_type.ToLower();
                if (shapeName == "cube")
                {
                    var method = shapeGenType.GetMethod("GenerateCube", new Type[] { pivotType, typeof(Vector3) });
                    if (method != null)
                    {
                        pbMesh = method.Invoke(null, new object[] { pivotVal, size });
                    }
                }
                else if (shapeName == "plane")
                {
                    var method = shapeGenType.GetMethod("GeneratePlane");
                    if (method != null)
                    {
                        pbMesh = method.Invoke(null, new object[] { pivotVal, size.x, size.z, 1, 1, 0 });
                    }
                }
                else
                {
                    var method = shapeGenType.GetMethod("GenerateCube", new Type[] { pivotType, typeof(Vector3) });
                    if (method != null)
                    {
                        pbMesh = method.Invoke(null, new object[] { pivotVal, size });
                    }
                }

                if (pbMesh == null)
                {
                    return "{\"success\":false,\"error\":\"Failed to generate ProBuilder shape mesh.\"}";
                }

                PropertyInfo goProp = pbMeshType.GetProperty("gameObject");
                GameObject go = (GameObject)goProp.GetValue(pbMesh, null);

                if (args.position != null && args.position.Length == 3)
                {
                    go.transform.position = new Vector3(args.position[0], args.position[1], args.position[2]);
                }

                MethodInfo rebuildMethod = pbMeshType.GetMethod("ToMesh");
                if (rebuildMethod != null) rebuildMethod.Invoke(pbMesh, null);

                MethodInfo refreshMethod = pbMeshType.GetMethod("Refresh");
                if (refreshMethod != null) refreshMethod.Invoke(pbMesh, null);

                Undo.RegisterCreatedObjectUndo(go, "Create ProBuilder " + args.shape_type);

                return $"{{\"success\":true,\"name\":\"{MCPToolRegistry.EscapeJson(go.name)}\",\"instanceId\":{go.GetInstanceID()}}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"ProBuilder creation error: {MCPToolRegistry.EscapeJson(ex.Message)}\"}}";
            }
        }
    }
}
