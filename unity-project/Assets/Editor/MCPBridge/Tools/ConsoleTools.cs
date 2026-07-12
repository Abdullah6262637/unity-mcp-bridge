using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    [InitializeOnLoad]
    public static class ConsoleTools
    {
        [Serializable]
        private class GetLogsArgs
        {
            public int count = 50;
            public string log_type;
        }

        private struct LogEntry
        {
            public string message;
            public string stackTrace;
            public LogType type;
            public string timeStamp;
        }

        private static readonly List<LogEntry> _logs = new List<LogEntry>();
        private static readonly object _lock = new object();
        private const int MaxLogs = 1000;

        static ConsoleTools()
        {
            // Subscribe to catch all logs in the Unity console
            Application.logMessageReceivedThreaded += OnLogMessageReceived;
        }

        private static void OnLogMessageReceived(string condition, string stackTrace, LogType type)
        {
            lock (_lock)
            {
                _logs.Add(new LogEntry
                {
                    message = condition,
                    stackTrace = stackTrace,
                    type = type,
                    timeStamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff")
                });

                if (_logs.Count > MaxLogs)
                {
                    _logs.RemoveAt(0);
                }
            }
        }

        public static void Register()
        {
            MCPToolRegistry.Register("get_console_logs", GetConsoleLogs);
        }

        private static string GetConsoleLogs(string jsonArgs)
        {
            var args = JsonUtility.FromJson<GetLogsArgs>(jsonArgs);
            int count = (args != null && args.count > 0) ? args.count : 50;
            string filterType = args?.log_type;

            var resultLogs = new List<string>();
            lock (_lock)
            {
                int added = 0;
                for (int i = _logs.Count - 1; i >= 0 && added < count; i--)
                {
                    var log = _logs[i];

                    if (!string.IsNullOrEmpty(filterType))
                    {
                        if (!log.type.ToString().Equals(filterType, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }
                    }

                    string escapedMsg = MCPToolRegistry.EscapeJson(log.message);
                    string escapedStack = MCPToolRegistry.EscapeJson(log.stackTrace);
                    resultLogs.Add($"{{\"message\":\"{escapedMsg}\",\"stackTrace\":\"{escapedStack}\",\"type\":\"{log.type}\",\"timestamp\":\"{log.timeStamp}\"}}");
                    added++;
                }
            }

            string logsJson = "[" + string.Join(",", resultLogs) + "]";
            return $"{{\"success\":true,\"logs\":{logsJson}}}";
        }
    }
}
