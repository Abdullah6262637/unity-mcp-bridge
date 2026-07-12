using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.TestTools.TestRunner.Api;

namespace UnityMCPBridge
{
    public class TestTools : IMCPToolProvider
    {
        [Serializable]
        private class RunTestsArgs
        {
            public string test_mode;
            public string filter;
        }

        [Serializable]
        private class TestStatusArgs
        {
            public string job_id;
        }

        [Serializable]
        private class TestResultInfo
        {
            public string name;
            public string fullName;
            public bool passed;
            public string resultState;
            public double duration;
            public string message;
            public string stackTrace;
        }

        private class TestJob
        {
            public string jobId;
            public bool isFinished;
            public bool hasErrors;
            public string errorMsg;
            public List<TestResultInfo> results = new List<TestResultInfo>();
        }

        private static readonly Dictionary<string, TestJob> _jobs = new Dictionary<string, TestJob>();

        public void RegisterTools()
        {
            MCPToolRegistry.Register("run_tests", RunTests);
            MCPToolRegistry.Register("get_test_status", GetTestStatus);
        }

        private static string RunTests(string jsonArgs)
        {
            var args = JsonUtility.FromJson<RunTestsArgs>(jsonArgs);
            string testModeStr = args?.test_mode ?? "EditMode";
            string filterStr = args?.filter;

            TestMode mode = TestMode.EditMode;
            if (testModeStr.Equals("PlayMode", StringComparison.OrdinalIgnoreCase))
            {
                mode = TestMode.PlayMode;
            }

            string jobId = "test_run_" + Guid.NewGuid().ToString("N").Substring(0, 8);
            var job = new TestJob { jobId = jobId, isFinished = false };
            _jobs[jobId] = job;

            // Create test runner and start execution
            var runner = ScriptableObject.CreateInstance<TestRunnerApi>();
            
            var filter = new Filter();
            filter.testMode = mode;
            if (!string.IsNullOrEmpty(filterStr))
            {
                filter.testNames = new string[] { filterStr };
            }

            var callback = new TestRunnerCallback(job);
            runner.RegisterCallbacks(callback);
            runner.Execute(new ExecutionSettings(filter));

            return $"{{\"success\":true,\"job_id\":\"{jobId}\",\"status\":\"started\"}}";
        }

        private static string GetTestStatus(string jsonArgs)
        {
            var args = JsonUtility.FromJson<TestStatusArgs>(jsonArgs);
            if (args == null || string.IsNullOrEmpty(args.job_id))
            {
                return "{\"success\":false,\"error\":\"job_id is required.\"}";
            }

            if (!_jobs.TryGetValue(args.job_id, out var job))
            {
                return "{\"success\":false,\"error\":\"Job not found.\"}";
            }

            if (!job.isFinished)
            {
                return $"{{\"success\":true,\"job_id\":\"{job.jobId}\",\"status\":\"running\"}}";
            }

            if (job.hasErrors)
            {
                return $"{{\"success\":false,\"job_id\":\"{job.jobId}\",\"status\":\"failed\",\"error\":\"{MCPToolRegistry.EscapeJson(job.errorMsg)}\"}}";
            }

            var resultsJson = new List<string>();
            foreach (var res in job.results)
            {
                string escapedMsg = MCPToolRegistry.EscapeJson(res.message);
                string escapedStack = MCPToolRegistry.EscapeJson(res.stackTrace);
                resultsJson.Add($"{{\"name\":\"{MCPToolRegistry.EscapeJson(res.name)}\"," +
                               $"\"fullName\":\"{MCPToolRegistry.EscapeJson(res.fullName)}\"," +
                               $"\"passed\":{res.passed.ToString().ToLower()}," +
                               $"\"resultState\":\"{MCPToolRegistry.EscapeJson(res.resultState)}\"," +
                               $"\"duration\":{res.duration.ToString(System.Globalization.CultureInfo.InvariantCulture)}," +
                               $"\"message\":\"{escapedMsg}\"," +
                               $"\"stackTrace\":\"{escapedStack}\"}}");
            }

            string resultsArray = "[" + string.Join(",", resultsJson) + "]";
            return $"{{\"success\":true,\"job_id\":\"{job.jobId}\",\"status\":\"completed\",\"results\":{resultsArray}}}";
        }

        private class TestRunnerCallback : ICallback
        {
            private readonly TestJob _job;

            public TestRunnerCallback(TestJob job)
            {
                _job = job;
            }

            public void RunStarted(ITestAdaptor testsToRun) { }

            public void RunFinished(ITestResultAdaptor testResults)
            {
                var flatResults = new List<TestResultInfo>();
                try
                {
                    ExtractResults(testResults, flatResults);
                    _job.results = flatResults;
                    _job.isFinished = true;
                }
                catch (Exception ex)
                {
                    _job.hasErrors = true;
                    _job.errorMsg = ex.Message;
                    _job.isFinished = true;
                }
            }

            public void TestStarted(ITestAdaptor test) { }

            public void TestFinished(ITestResultAdaptor result) { }

            private void ExtractResults(ITestResultAdaptor result, List<TestResultInfo> list)
            {
                // Note: The top level nodes are suites, we only gather results from leaf test cases
                if (result.HasChildren)
                {
                    foreach (var child in result.Children)
                    {
                        ExtractResults(child, list);
                    }
                }
                else
                {
                    // Filter out assembly suites that don't represent actual test runs
                    if (result.ResultState != "Inconclusive" || !string.IsNullOrEmpty(result.Name))
                    {
                        list.Add(new TestResultInfo
                        {
                            name = result.Name,
                            fullName = result.FullName,
                            passed = result.ResultState == "Passed",
                            resultState = result.ResultState,
                            duration = result.Duration,
                            message = result.Message,
                            stackTrace = result.StackTrace
                        });
                    }
                }
            }
        }
    }
}
