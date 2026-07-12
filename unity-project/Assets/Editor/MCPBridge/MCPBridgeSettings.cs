using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public class MCPBridgeSettings : ScriptableObject
    {
        [Header("Connection Settings")]
        [Tooltip("Port for the local HTTP bridge server.")]
        public int port = 8090;

        [Tooltip("IP address to bind the listener to. Keep as 127.0.0.1 for security.")]
        public string bindAddress = "127.0.0.1";

        [Header("Behavior")]
        [Tooltip("Automatically start the HTTP server when the Editor loads.")]
        public bool autoStart = true;

        [Tooltip("Require confirm: true parameter for destructive operations like deleting GameObjects.")]
        public bool requireConfirmationForDestructive = true;

        private const string SettingsPath = "Assets/Editor/MCPBridge/MCPBridgeSettings.asset";

        public static MCPBridgeSettings GetOrCreateSettings()
        {
            var settings = AssetDatabase.LoadAssetAtPath<MCPBridgeSettings>(SettingsPath);
            if (settings == null)
            {
                settings = CreateInstance<MCPBridgeSettings>();
                
                string directory = System.IO.Path.GetDirectoryName(SettingsPath);
                if (!System.IO.Directory.Exists(directory))
                {
                    System.IO.Directory.CreateDirectory(directory);
                }

                AssetDatabase.CreateAsset(settings, SettingsPath);
                AssetDatabase.SaveAssets();
            }
            return settings;
        }
    }
}
