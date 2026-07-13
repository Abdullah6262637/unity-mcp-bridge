using System;
using System.Reflection;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public class CinemachineTools : IMCPToolProvider
    {
        [Serializable]
        private class CinemachineArgs
        {
            public string gameobject_path;
            public string follow_path;
            public string lookat_path;
            public float distance; // Offset distance
        }

        public void RegisterTools()
        {
            MCPToolRegistry.Register("configure_cinemachine", ConfigureCinemachine);
        }

        private static string ConfigureCinemachine(string jsonArgs)
        {
            var args = JsonUtility.FromJson<CinemachineArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.gameobject_path))
            {
                return "{\"success\":false,\"error\":\"gameobject_path is required.\"}";
            }

            GameObject camGo = SceneTools.FindGameObjectByPath(args.gameobject_path);
            if (camGo == null)
            {
                camGo = new GameObject(args.gameobject_path.TrimStart('/'));
                Undo.RegisterCreatedObjectUndo(camGo, "Create Cinemachine Camera");
            }

            Type vcamType = null;
            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                vcamType = assembly.GetType("Cinemachine.CinemachineVirtualCamera") ?? 
                           assembly.GetType("Unity.Cinemachine.CinemachineCamera");
                if (vcamType != null) break;
            }

            if (vcamType == null)
            {
                return "{\"success\":false,\"error\":\"Cinemachine package is not installed in the project. Install com.unity.cinemachine first.\"}";
            }

            Component vcam = camGo.GetComponent(vcamType);
            if (vcam == null)
            {
                vcam = Undo.AddComponent(camGo, vcamType);
            }

            Undo.RecordObject(vcam, "Configure Cinemachine");

            if (!string.IsNullOrEmpty(args.follow_path))
            {
                GameObject followGo = SceneTools.FindGameObjectByPath(args.follow_path);
                if (followGo != null)
                {
                    PropertyInfo followProp = vcamType.GetProperty("Follow") ?? vcamType.GetProperty("m_Follow");
                    if (followProp != null)
                    {
                        followProp.SetValue(vcam, followGo.transform, null);
                    }
                    else
                    {
                        FieldInfo followField = vcamType.GetField("m_Follow", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                        if (followField != null) followField.SetValue(vcam, followGo.transform);
                    }
                }
            }

            if (!string.IsNullOrEmpty(args.lookat_path))
            {
                GameObject lookatGo = SceneTools.FindGameObjectByPath(args.lookat_path);
                if (lookatGo != null)
                {
                    PropertyInfo lookatProp = vcamType.GetProperty("LookAt") ?? vcamType.GetProperty("m_LookAt");
                    if (lookatProp != null)
                    {
                        lookatProp.SetValue(vcam, lookatGo.transform, null);
                    }
                    else
                    {
                        FieldInfo lookatField = vcamType.GetField("m_LookAt", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                        if (lookatField != null) lookatField.SetValue(vcam, lookatGo.transform);
                    }
                }
            }

            if (args.distance > 0f)
            {
                try
                {
                    Type transposerType = null;
                    foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        transposerType = assembly.GetType("Cinemachine.CinemachineTransposer") ??
                                         assembly.GetType("Unity.Cinemachine.CinemachineSimpleFollow");
                        if (transposerType != null) break;
                    }

                    if (transposerType != null)
                    {
                        var transposer = camGo.GetComponent(transposerType);
                        if (transposer != null)
                        {
                            FieldInfo offsetField = transposerType.GetField("m_FollowOffset", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance) ??
                                                    transposerType.GetField("m_Offset", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                            if (offsetField != null)
                            {
                                offsetField.SetValue(transposer, new Vector3(0, 2, -args.distance));
                            }
                        }
                    }
                }
                catch {}
            }

            EditorUtility.SetDirty(camGo);
            return "{\"success\":true}";
        }
    }
}
