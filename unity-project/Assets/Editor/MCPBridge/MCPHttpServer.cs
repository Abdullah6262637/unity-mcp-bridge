using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Collections.Concurrent;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public class PendingRequest
    {
        public HttpListenerContext Context { get; }
        public string Body { get; }
        public string ResponseBody { get; set; } = "{}";
        public int ResponseStatus { get; set; } = 200;
        public ManualResetEvent WaitHandle { get; }

        public PendingRequest(HttpListenerContext context, string body)
        {
            Context = context;
            Body = body;
            WaitHandle = new ManualResetEvent(false);
        }
    }

    [InitializeOnLoad]
    public static class MCPHttpServer
    {
        private static HttpListener _listener;
        private static Thread _listenerThread;
        private static readonly ConcurrentQueue<PendingRequest> _pendingRequests = new ConcurrentQueue<PendingRequest>();
        private static readonly ConcurrentQueue<Action> _mainThreadQueue = new ConcurrentQueue<Action>();
        private static bool _isRunning = false;

        public static void EnqueueOnMainThread(Action action)
        {
            _mainThreadQueue.Enqueue(action);
        }

        public static PendingRequest CurrentRequest { get; private set; }

        static MCPHttpServer()
        {
            // Register callback to run update loop in Editor
            EditorApplication.update += Update;
            AssemblyReloadEvents.beforeAssemblyReload += OnBeforeAssemblyReload;
            
            // Auto start if configured
            var settings = MCPBridgeSettings.GetOrCreateSettings();
            if (settings.autoStart)
            {
                StartServer();
            }
        }

        public static void StartServer()
        {
            if (_isRunning) return;

            var settings = MCPBridgeSettings.GetOrCreateSettings();
            string url = $"http://{settings.bindAddress}:{settings.port}/";

            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add(url);
                _listener.Start();
                _isRunning = true;

                _listenerThread = new Thread(ListenLoop);
                _listenerThread.IsBackground = true;
                _listenerThread.Start();

                Debug.Log($"[MCPBridge] HTTP Server started and listening at {url}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MCPBridge] Failed to start HTTP Server: {ex.Message}");
            }
        }

        public static void StopServer()
        {
            if (!_isRunning) return;
            _isRunning = false;

            if (_listener != null)
            {
                try
                {
                    _listener.Stop();
                    _listener.Close();
                }
                catch (Exception) { /* Ignored */ }
                _listener = null;
            }

            // Flush pending requests with Service Unavailable
            while (_pendingRequests.TryDequeue(out var request))
            {
                request.ResponseBody = "{\"error\":\"Assembly reload or server shutdown in progress\"}";
                request.ResponseStatus = 503;
                request.WaitHandle.Set();
            }

            Debug.Log("[MCPBridge] HTTP Server stopped.");
        }

        private static void OnBeforeAssemblyReload()
        {
            StopServer();
        }

        private static void ListenLoop()
        {
            while (_isRunning && _listener != null && _listener.IsListening)
            {
                try
                {
                    HttpListenerContext context = _listener.GetContext();

                    // Direct CORS handling for OPTIONS preflight
                    if (context.Request.HttpMethod == "OPTIONS")
                    {
                        context.Response.StatusCode = 200;
                        context.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                        context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                        context.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                        context.Response.OutputStream.Close();
                        continue;
                    }

                    // Read request body on background thread
                    string body = string.Empty;
                    if (context.Request.HasEntityBody)
                    {
                        using (var reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding ?? Encoding.UTF8))
                        {
                            body = reader.ReadToEnd();
                        }
                    }

                    var request = new PendingRequest(context, body);
                    _pendingRequests.Enqueue(request);

                    // Block this request thread until the main thread processes it
                    request.WaitHandle.WaitOne();

                    // Send response
                    byte[] responseBytes = Encoding.UTF8.GetBytes(request.ResponseBody);
                    context.Response.ContentLength64 = responseBytes.Length;
                    context.Response.ContentType = "application/json";
                    context.Response.StatusCode = request.ResponseStatus;

                    // CORS Headers for POST/GET responses
                    context.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                    context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                    context.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

                    context.Response.OutputStream.Write(responseBytes, 0, responseBytes.Length);
                    context.Response.OutputStream.Close();
                }
                catch (HttpListenerException)
                {
                    // Triggered when listener is stopped, normal behavior
                }
                catch (Exception ex)
                {
                    if (_isRunning)
                    {
                        Debug.LogError($"[MCPBridge] Error in HTTP listener loop: {ex.Message}");
                    }
                }
            }
        }

        private static void Update()
        {
            // Process actions dispatched from background thread on main thread
            while (_mainThreadQueue.TryDequeue(out var action))
            {
                try
                {
                    action();
                }
                catch (Exception ex)
                {
                    Debug.LogException(ex);
                }
            }

            // Process queued requests on Unity's main thread
            while (_pendingRequests.TryDequeue(out var request))
            {
                bool isDeferred = false;
                try
                {
                    CurrentRequest = request;
                    string path = request.Context.Request.Url.AbsolutePath;

                    if (path == "/health")
                    {
                        request.ResponseBody = $"{{\"status\":\"ok\",\"unityVersion\":\"{Application.unityVersion}\",\"platform\":\"{Application.platform}\"}}";
                        request.ResponseStatus = 200;
                    }
                    else if (path == "/chat/send")
                    {
                        isDeferred = true;
                        // Run asynchronous multi-agent orchestrator in background task
                        System.Threading.Tasks.Task.Run(() => AgentOrchestrator.ProcessChatAsync(request));
                    }
                    else if (path.StartsWith("/tools/"))
                    {
                        string toolName = path.Substring("/tools/".Length);
                        string jsonResponse = MCPToolRegistry.Dispatch(toolName, request.Body);
                        
                        if (jsonResponse == "__DEFERRED__")
                        {
                            isDeferred = true;
                        }
                        else
                        {
                            request.ResponseBody = jsonResponse;
                            request.ResponseStatus = 200;
                        }
                    }
                    else
                    {
                        request.ResponseBody = "{\"error\":\"Not Found\"}";
                        request.ResponseStatus = 404;
                    }
                }
                catch (Exception ex)
                {
                    string escapedMsg = ex.Message.Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
                    request.ResponseBody = $"{{\"error\":\"{escapedMsg}\"}}";
                    request.ResponseStatus = 500;
                }
                finally
                {
                    CurrentRequest = null;
                    if (!isDeferred)
                    {
                        // Resume background thread to send response
                        request.WaitHandle.Set();
                    }
                }
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
