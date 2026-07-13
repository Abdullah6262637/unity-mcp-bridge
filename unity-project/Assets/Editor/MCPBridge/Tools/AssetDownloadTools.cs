using System;
using System.IO;
using System.Net;
using UnityEngine;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEditor.PackageManager.Requests;

namespace UnityMCPBridge
{
    public class AssetDownloadTools : IMCPToolProvider
    {
        [Serializable]
        private class DownloadArgs
        {
            public string url;
            public string save_path;
        }

        [Serializable]
        private class PackageArgs
        {
            public string package_name;
            public string action; // "install", "remove", "list"
        }

        private static AddRequest _activeAddRequest;
        private static RemoveRequest _activeRemoveRequest;
        private static ListRequest _activeListRequest;
        private static PendingRequest _pendingRequest;

        public void RegisterTools()
        {
            MCPToolRegistry.Register("download_asset", DownloadAsset);
            MCPToolRegistry.Register("manage_package", ManagePackage);
            EditorApplication.update += Update;
        }

        private string DownloadAsset(string jsonArgs)
        {
            var args = JsonUtility.FromJson<DownloadArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.url) || string.IsNullOrEmpty(args.save_path))
            {
                return "{\"success\":false,\"error\":\"url and save_path are required.\"}";
            }

            if (!MCPToolRegistry.IsPathSafe(args.save_path))
            {
                return "{\"success\":false,\"error\":\"save_path must be inside 'Assets/' directory and not perform traversal for security.\"}";
            }

            try
            {
                string directory = Path.GetDirectoryName(Path.Combine(Directory.GetCurrentDirectory(), args.save_path));
                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                using (var webClient = new WebClient())
                {
                    webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    webClient.DownloadFile(args.url, args.save_path);
                }

                AssetDatabase.ImportAsset(args.save_path, ImportAssetOptions.ForceUpdate);
                
                return $"{{\"success\":true,\"message\":\"Asset downloaded and imported successfully.\",\"path\":\"{EscapeJson(args.save_path)}\"}}";
            }
            catch (Exception ex)
            {
                return $"{{\"success\":false,\"error\":\"Failed to download asset: {EscapeJson(ex.Message)}\"}}";
            }
        }

        private string ManagePackage(string jsonArgs)
        {
            var args = JsonUtility.FromJson<PackageArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.action))
            {
                return "{\"success\":false,\"error\":\"action is required (install, remove, list).\"}";
            }

            string action = args.action.ToLower();

            if (action == "install")
            {
                if (string.IsNullOrEmpty(args.package_name))
                {
                    return "{\"success\":false,\"error\":\"package_name is required for install action.\"}";
                }

                if (_pendingRequest != null)
                {
                    return "{\"success\":false,\"error\":\"Another package manager task is already active.\"}";
                }

                _activeAddRequest = Client.Add(args.package_name);
                _pendingRequest = MCPHttpServer.CurrentRequest;
                return "__DEFERRED__";
            }
            else if (action == "remove")
            {
                if (string.IsNullOrEmpty(args.package_name))
                {
                    return "{\"success\":false,\"error\":\"package_name is required for remove action.\"}";
                }

                if (_pendingRequest != null)
                {
                    return "{\"success\":false,\"error\":\"Another package manager task is already active.\"}";
                }

                _activeRemoveRequest = Client.Remove(args.package_name);
                _pendingRequest = MCPHttpServer.CurrentRequest;
                return "__DEFERRED__";
            }
            else if (action == "list")
            {
                if (_pendingRequest != null)
                {
                    return "{\"success\":false,\"error\":\"Another package manager task is already active.\"}";
                }

                _activeListRequest = Client.List(true);
                _pendingRequest = MCPHttpServer.CurrentRequest;
                return "__DEFERRED__";
            }
            else
            {
                return "{\"success\":false,\"error\":\"Invalid action. Must be install, remove, or list.\"}";
            }
        }

        private static void Update()
        {
            if (_pendingRequest == null) return;

            if (_activeAddRequest != null && _activeAddRequest.IsCompleted)
            {
                if (_activeAddRequest.Status == StatusCode.Success)
                {
                    _pendingRequest.ResponseBody = $"{{\"success\":true,\"data\":{{\"message\":\"Package installed successfully: {EscapeJson(_activeAddRequest.Result.name)}\"}}}}";
                    _pendingRequest.ResponseStatus = 200;
                }
                else
                {
                    _pendingRequest.ResponseBody = $"{{\"success\":false,\"error\":\"Failed to install package: {EscapeJson(_activeAddRequest.Error.message)}\"}}";
                    _pendingRequest.ResponseStatus = 200;
                }
                _pendingRequest.WaitHandle.Set();
                _activeAddRequest = null;
                _pendingRequest = null;
            }
            else if (_activeRemoveRequest != null && _activeRemoveRequest.IsCompleted)
            {
                if (_activeRemoveRequest.Status == StatusCode.Success)
                {
                    _pendingRequest.ResponseBody = "{\"success\":true,\"data\":{\"message\":\"Package removed successfully.\"}}";
                    _pendingRequest.ResponseStatus = 200;
                }
                else
                {
                    _pendingRequest.ResponseBody = $"{{\"success\":false,\"error\":\"Failed to remove package: {EscapeJson(_activeRemoveRequest.Error.message)}\"}}";
                    _pendingRequest.ResponseStatus = 200;
                }
                _pendingRequest.WaitHandle.Set();
                _activeRemoveRequest = null;
                _pendingRequest = null;
            }
            else if (_activeListRequest != null && _activeListRequest.IsCompleted)
            {
                if (_activeListRequest.Status == StatusCode.Success)
                {
                    var packageNames = new System.Collections.Generic.List<string>();
                    foreach (var package in _activeListRequest.Result)
                    {
                        packageNames.Add($"\"{EscapeJson(package.name)}\"");
                    }
                    string jsonArray = "[" + string.Join(",", packageNames.ToArray()) + "]";
                    _pendingRequest.ResponseBody = $"{{\"success\":true,\"data\":{{\"packages\":{jsonArray}}}}}";
                    _pendingRequest.ResponseStatus = 200;
                }
                else
                {
                    _pendingRequest.ResponseBody = $"{{\"success\":false,\"error\":\"Failed to list packages: {EscapeJson(_activeListRequest.Error.message)}\"}}";
                    _pendingRequest.ResponseStatus = 200;
                }
                _pendingRequest.WaitHandle.Set();
                _activeListRequest = null;
                _pendingRequest = null;
            }
        }

        private static string EscapeJson(string value)
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
