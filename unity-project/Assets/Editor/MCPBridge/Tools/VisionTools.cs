using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.SceneManagement;

namespace UnityMCPBridge
{
    public class VisionTools : IMCPToolProvider
    {
        [Serializable]
        private class CaptureArgs
        {
            public string quality = "medium";
        }

        [Serializable]
        private class AnnotatedCaptureArgs
        {
            public string quality = "medium";
            public string[] target_paths;
        }

        private static readonly Color[] MarkerColors = new Color[]
        {
            Color.red,
            Color.green,
            Color.blue,
            Color.yellow,
            Color.cyan,
            Color.magenta
        };

        private static readonly string[] MarkerColorNames = new string[]
        {
            "Red",
            "Green",
            "Blue",
            "Yellow",
            "Cyan",
            "Magenta"
        };

        public void RegisterTools()
        {
            MCPToolRegistry.Register("capture_game_view", CaptureGameView);
            MCPToolRegistry.Register("capture_scene_view", CaptureSceneView);
            MCPToolRegistry.Register("capture_annotated_view", CaptureAnnotatedView);
        }

        private string CaptureGameView(string jsonArgs)
        {
            var args = JsonUtility.FromJson<CaptureArgs>(jsonArgs);
            string quality = args?.quality ?? "medium";

            Camera cam = Camera.main;
            if (cam == null)
            {
                cam = UnityEngine.Object.FindFirstObjectByType<Camera>();
            }

            if (cam == null)
            {
                return "{\"success\":false,\"error\":\"No camera found in the active scene to render the game view.\"}";
            }

            return CaptureCamera(cam, quality);
        }

        private string CaptureSceneView(string jsonArgs)
        {
            var args = JsonUtility.FromJson<CaptureArgs>(jsonArgs);
            string quality = args?.quality ?? "medium";

            Camera cam = GetSceneViewCamera();
            if (cam == null)
            {
                return "{\"success\":false,\"error\":\"No Scene View active or available to capture.\"}";
            }

            return CaptureCamera(cam, quality);
        }

        private string CaptureAnnotatedView(string jsonArgs)
        {
            var args = JsonUtility.FromJson<AnnotatedCaptureArgs>(jsonArgs);
            string quality = args?.quality ?? "medium";

            Camera cam = Camera.main;
            if (cam == null)
            {
                cam = GetSceneViewCamera();
            }

            if (cam == null)
            {
                return "{\"success\":false,\"error\":\"No camera (MainCamera or SceneView) available for annotated render.\"}";
            }

            int width = 1280;
            int height = 720;

            if (quality.Equals("low", System.StringComparison.OrdinalIgnoreCase))
            {
                width = 640;
                height = 480;
            }
            else if (quality.Equals("high", System.StringComparison.OrdinalIgnoreCase))
            {
                width = 1920;
                height = 1080;
            }

            // Find target game objects to annotate
            var targets = new List<GameObject>();
            if (args != null && args.target_paths != null && args.target_paths.Length > 0)
            {
                foreach (var path in args.target_paths)
                {
                    GameObject go = SceneTools.FindGameObjectByPath(path);
                    if (go != null)
                    {
                        targets.Add(go);
                    }
                }
            }
            else
            {
                // Fallback: annotate all root GameObjects and objects with renderers
                var rootObjects = SceneManager.GetActiveScene().GetRootGameObjects();
                targets.AddRange(rootObjects);

                // Add active renderers up to 20 to prevent cluttering the scene
                var allRenderers = UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None);
                int count = 0;
                foreach (var r in allRenderers)
                {
                    if (r != null && r.gameObject.activeInHierarchy && !targets.Contains(r.gameObject))
                    {
                        targets.Add(r.gameObject);
                        count++;
                        if (count >= 20) break;
                    }
                }
            }

            RenderTexture rt = new RenderTexture(width, height, 24);
            Texture2D screenShot = new Texture2D(width, height, TextureFormat.RGB24, false);

            var oldTarget = cam.targetTexture;
            var oldActive = RenderTexture.active;

            var annotations = new List<string>();
            int colorIndex = 0;

            try
            {
                cam.targetTexture = rt;
                cam.Render();

                RenderTexture.active = rt;
                screenShot.ReadPixels(new Rect(0, 0, width, height), 0, 0);

                foreach (var go in targets)
                {
                    if (go == null) continue;

                    Vector3 worldPos = go.transform.position;
                    Vector3 screenPos = cam.WorldToScreenPoint(worldPos);

                    // Check if object is in front of camera and inside screen bounds
                    if (screenPos.z > 0 &&
                        screenPos.x >= 0 && screenPos.x < width &&
                        screenPos.y >= 0 && screenPos.y < height)
                    {
                        Color color = MarkerColors[colorIndex];
                        string colorName = MarkerColorNames[colorIndex];

                        // Convert coordinates (Unity has y starting from bottom, images start from top-left)
                        int px = (int)screenPos.x;
                        int py = height - (int)screenPos.y;

                        DrawMarker(screenShot, px, height - py, color); // Draw on texture (using bottom-left y for SetPixel)

                        string path = SceneTools.GetGameObjectPath(go);
                        string escapedPath = MCPToolRegistry.EscapeJson(path);
                        string escapedName = MCPToolRegistry.EscapeJson(go.name);

                        annotations.Add($"{{\"path\":\"{escapedPath}\",\"name\":\"{escapedName}\",\"x\":{px},\"y\":{py},\"markerColor\":\"{colorName}\"}}");

                        colorIndex = (colorIndex + 1) % MarkerColors.Length;
                    }
                }

                screenShot.Apply();
            }
            finally
            {
                cam.targetTexture = oldTarget;
                RenderTexture.active = oldActive;
            }

            byte[] bytes = screenShot.EncodeToPNG();
            
            UnityEngine.Object.DestroyImmediate(rt);
            UnityEngine.Object.DestroyImmediate(screenShot);

            string base64 = Convert.ToBase64String(bytes);
            string annotationsJson = "[" + string.Join(",", annotations) + "]";

            return $"{{\"success\":true,\"image\":\"{base64}\",\"mimeType\":\"image/png\",\"width\":{width},\"height\":{height},\"annotations\":{annotationsJson}}}";
        }

        private static string CaptureCamera(Camera cam, string quality)
        {
            int width = 1280;
            int height = 720;

            if (quality.Equals("low", System.StringComparison.OrdinalIgnoreCase))
            {
                width = 640;
                height = 480;
            }
            else if (quality.Equals("high", System.StringComparison.OrdinalIgnoreCase))
            {
                width = 1920;
                height = 1080;
            }

            RenderTexture rt = new RenderTexture(width, height, 24);
            Texture2D screenShot = new Texture2D(width, height, TextureFormat.RGB24, false);

            var oldTarget = cam.targetTexture;
            var oldActive = RenderTexture.active;

            try
            {
                cam.targetTexture = rt;
                cam.Render();

                RenderTexture.active = rt;
                screenShot.ReadPixels(new Rect(0, 0, width, height), 0, 0);
                screenShot.Apply();
            }
            finally
            {
                cam.targetTexture = oldTarget;
                RenderTexture.active = oldActive;
            }

            byte[] bytes = screenShot.EncodeToPNG();
            
            UnityEngine.Object.DestroyImmediate(rt);
            UnityEngine.Object.DestroyImmediate(screenShot);

            string base64 = Convert.ToBase64String(bytes);
            return $"{{\"success\":true,\"image\":\"{base64}\",\"mimeType\":\"image/png\",\"width\":{width},\"height\":{height}}}";
        }

        private static Camera GetSceneViewCamera()
        {
            var sceneView = SceneView.lastActiveSceneView;
            if (sceneView == null && SceneView.sceneViews.Count > 0)
            {
                sceneView = (SceneView)SceneView.sceneViews[0];
            }
            return sceneView != null ? sceneView.camera : null;
        }

        private static void DrawMarker(Texture2D tex, int centerX, int centerY, Color color)
        {
            int size = 5;
            for (int x = centerX - size; x <= centerX + size; x++)
            {
                for (int y = centerY - size; y <= centerY + size; y++)
                {
                    if (x >= 0 && x < tex.width && y >= 0 && y < tex.height)
                    {
                        // Draw black outline border, colored core inside
                        if (x == centerX - size || x == centerX + size || y == centerY - size || y == centerY + size)
                        {
                            tex.SetPixel(x, y, Color.black);
                        }
                        else
                        {
                            tex.SetPixel(x, y, color);
                        }
                    }
                }
            }
        }
    }
}
