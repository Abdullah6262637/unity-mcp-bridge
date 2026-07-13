using System;
using System.IO;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public class PhysicsTools : IMCPToolProvider
    {
        [Serializable]
        private class PhysicsArgs
        {
            public string gameobject_path;
            public bool add_rigidbody;
            public float mass; // -1 means do not set
            public string use_gravity; // "true" or "false"
            public string collider_type; // "box", "sphere", "capsule", "mesh", "none"
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("set_physics_properties", SetPhysicsProperties);
        }

        private static string SetPhysicsProperties(string jsonArgs)
        {
            var args = JsonUtility.FromJson<PhysicsArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path))
            {
                return "{\"success\":false,\"error\":\"gameobject_path is required.\"}";
            }

            GameObject go = SceneTools.FindGameObjectByPath(args.gameobject_path);
            if (go == null)
            {
                return $"{{\"success\":false,\"error\":\"GameObject not found: {MCPToolRegistry.EscapeJson(args.gameobject_path)}\"}}";
            }

            var rb = go.GetComponent<Rigidbody>();
            if (rb == null && args.add_rigidbody)
            {
                rb = Undo.AddComponent<Rigidbody>(go);
            }

            if (rb != null)
            {
                Undo.RecordObject(rb, "Modify Rigidbody Properties");
                if (args.mass > 0f)
                {
                    rb.mass = args.mass;
                }

                if (!string.IsNullOrEmpty(args.use_gravity))
                {
                    rb.useGravity = args.use_gravity.Equals("true", StringComparison.OrdinalIgnoreCase);
                }
            }

            if (!string.IsNullOrEmpty(args.collider_type))
            {
                string collType = args.collider_type.ToLower();
                if (collType != "none")
                {
                    // Remove existing colliders first
                    var colliders = go.GetComponents<Collider>();
                    foreach (var col in colliders)
                    {
                        Undo.DestroyObjectImmediate(col);
                    }

                    if (collType == "box")
                    {
                        Undo.AddComponent<BoxCollider>(go);
                    }
                    else if (collType == "sphere")
                    {
                        Undo.AddComponent<SphereCollider>(go);
                    }
                    else if (collType == "capsule")
                    {
                        Undo.AddComponent<CapsuleCollider>(go);
                    }
                    else if (collType == "mesh")
                    {
                        Undo.AddComponent<MeshCollider>(go);
                    }
                }
            }

            EditorUtility.SetDirty(go);
            return "{\"success\":true}";
        }
    }
}
