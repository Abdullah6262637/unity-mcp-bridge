using System;
using System.IO;
using System.Net;
using System.Text;
using System.Collections.Generic;

namespace UnityMCPBridge
{
    class Program
    {
        static void Main(string[] args)
        {
            // Set console inputs and outputs to UTF-8
            Console.InputEncoding = Encoding.UTF8;
            Console.OutputEncoding = Encoding.UTF8;
            
            Console.Error.WriteLine("Unity C# MCP Server starting...");
            
            string line;
            while ((line = Console.ReadLine()) != null)
            {
                if (string.IsNullOrEmpty(line.Trim())) continue;
                
                try
                {
                    var request = (Dictionary<string, object>)Json.Parse(line);
                    if (request == null) continue;
                    
                    string jsonrpc = request.ContainsKey("jsonrpc") ? (string)request["jsonrpc"] : "2.0";
                    object id = request.ContainsKey("id") ? request["id"] : null;
                    string method = request.ContainsKey("method") ? (string)request["method"] : "";
                    
                    if (method == "initialize")
                    {
                        var response = new Dictionary<string, object>();
                        response["jsonrpc"] = "2.0";
                        response["id"] = id;
                        
                        var result = new Dictionary<string, object>();
                        result["protocolVersion"] = "2024-11-05";
                        
                        var capabilities = new Dictionary<string, object>();
                        capabilities["tools"] = new Dictionary<string, object>();
                        result["capabilities"] = capabilities;
                        
                        var serverInfo = new Dictionary<string, object>();
                        serverInfo["name"] = "unity-mcp-bridge-cs";
                        serverInfo["version"] = "1.0.0";
                        result["serverInfo"] = serverInfo;
                        
                        response["result"] = result;
                        
                        Console.WriteLine(Json.Stringify(response));
                    }
                    else if (method == "tools/list" || method == "listTools")
                    {
                        var response = new Dictionary<string, object>();
                        response["jsonrpc"] = "2.0";
                        response["id"] = id;
                        
                        var result = new Dictionary<string, object>();
                        result["tools"] = Json.Parse(ToolsListJson);
                        response["result"] = result;
                        
                        Console.WriteLine(Json.Stringify(response));
                    }
                    else if (method == "tools/call" || method == "callTool")
                    {
                        var @params = request.ContainsKey("params") ? (Dictionary<string, object>)request["params"] : new Dictionary<string, object>();
                        string toolName = @params.ContainsKey("name") ? (string)@params["name"] : "";
                        var toolArgs = @params.ContainsKey("arguments") ? @params["arguments"] : new Dictionary<string, object>();
                        
                        var response = new Dictionary<string, object>();
                        response["jsonrpc"] = "2.0";
                        response["id"] = id;
                        
                        try
                        {
                            string unityResponseJson = PostToUnity(toolName, Json.Stringify(toolArgs));
                            var unityResult = (Dictionary<string, object>)Json.Parse(unityResponseJson);
                            
                            bool isSuccess = true;
                            if (unityResult != null && unityResult.ContainsKey("success"))
                            {
                                isSuccess = Convert.ToBoolean(unityResult["success"]);
                            }
                            
                            // Special handling for Vision tools base64 image captures
                            if (isSuccess && (toolName == "capture_game_view" || toolName == "capture_scene_view" || toolName == "capture_annotated_view"))
                            {
                                var contents = new List<object>();
                                string base64Data = "";
                                string mimeType = "image/png";
                                
                                if (unityResult != null && unityResult.ContainsKey("image_base64"))
                                {
                                    base64Data = (string)unityResult["image_base64"];
                                }
                                
                                var imageContent = new Dictionary<string, object>();
                                imageContent["type"] = "image";
                                imageContent["data"] = base64Data;
                                imageContent["mimeType"] = mimeType;
                                contents.Add(imageContent);
                                
                                if (toolName == "capture_annotated_view" && unityResult.ContainsKey("annotations"))
                                {
                                    var textContent = new Dictionary<string, object>();
                                    textContent["type"] = "text";
                                    textContent["text"] = "Annotations:\n" + Json.Stringify(unityResult["annotations"]);
                                    contents.Add(textContent);
                                }
                                
                                var result = new Dictionary<string, object>();
                                result["content"] = contents;
                                response["result"] = result;
                            }
                            else
                            {
                                var contents = new List<object>();
                                var textContent = new Dictionary<string, object>();
                                textContent["type"] = "text";
                                textContent["text"] = unityResponseJson;
                                contents.Add(textContent);
                                
                                var result = new Dictionary<string, object>();
                                result["content"] = contents;
                                response["result"] = result;
                            }
                        }
                        catch (Exception ex)
                        {
                            var contents = new List<object>();
                            var textContent = new Dictionary<string, object>();
                            textContent["type"] = "text";
                            
                            var errBody = new Dictionary<string, object>();
                            errBody["success"] = false;
                            errBody["error"] = ex.Message;
                            
                            textContent["text"] = Json.Stringify(errBody);
                            contents.Add(textContent);
                            
                            var result = new Dictionary<string, object>();
                            result["content"] = contents;
                            response["result"] = result;
                        }
                        
                        Console.WriteLine(Json.Stringify(response));
                    }
                    else if (method.StartsWith("notifications/"))
                    {
                        // Ignore notifications silently
                    }
                    else
                    {
                        // Return method not found
                        if (id != null)
                        {
                            var response = new Dictionary<string, object>();
                            response["jsonrpc"] = "2.0";
                            response["id"] = id;
                            
                            var error = new Dictionary<string, object>();
                            error["code"] = -32601;
                            error["message"] = "Method not found: " + method;
                            response["error"] = error;
                            
                            Console.WriteLine(Json.Stringify(response));
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error processing message: " + ex.ToString());
                }
            }
        }

        private static string PostToUnity(string toolName, string jsonPayload)
        {
            string host = Environment.GetEnvironmentVariable("UNITY_HOST") ?? "127.0.0.1";
            string port = Environment.GetEnvironmentVariable("UNITY_PORT") ?? "8090";
            string url = string.Format("http://{0}:{1}/tools/{2}", host, port, toolName);
            
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "POST";
            request.ContentType = "application/json";
            
            byte[] bytes = System.Text.Encoding.UTF8.GetBytes(jsonPayload);
            request.ContentLength = bytes.Length;
            
            using (var stream = request.GetRequestStream())
            {
                stream.Write(bytes, 0, bytes.Length);
            }
            
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        #region JSON Parser / Serializer
        public class Json
        {
            public static object Parse(string json)
            {
                int index = 0;
                return ParseValue(json, ref index);
            }
            
            private static object ParseValue(string json, ref int index)
            {
                SkipWhitespace(json, ref index);
                if (index >= json.Length) return null;
                char c = json[index];
                if (c == '"') return ParseString(json, ref index);
                if (c == '{') return ParseObject(json, ref index);
                if (c == '[') return ParseArray(json, ref index);
                if (c == 't' || c == 'f') return ParseBool(json, ref index);
                if (c == 'n') { index += 4; return null; }
                return ParseNumber(json, ref index);
            }
            
            private static void SkipWhitespace(string json, ref int index)
            {
                while (index < json.Length && char.IsWhiteSpace(json[index])) index++;
            }
            
            private static string ParseString(string json, ref int index)
            {
                index++; // skip start quote
                int start = index;
                bool escaped = false;
                while (index < json.Length)
                {
                    if (json[index] == '\\') { escaped = true; index += 2; continue; }
                    if (json[index] == '"') break;
                    index++;
                }
                string s = json.Substring(start, index - start);
                index++; // skip end quote
                if (escaped)
                {
                    s = s.Replace("\\\"", "\"").Replace("\\\\", "\\").Replace("\\n", "\n").Replace("\\r", "\r").Replace("\\t", "\t");
                }
                return s;
            }
            
            private static Dictionary<string, object> ParseObject(string json, ref int index)
            {
                index++; // skip '{'
                var dict = new Dictionary<string, object>();
                while (index < json.Length)
                {
                    SkipWhitespace(json, ref index);
                    if (json[index] == '}') { index++; break; }
                    string key = ParseString(json, ref index);
                    SkipWhitespace(json, ref index);
                    if (json[index] == ':') index++;
                    object val = ParseValue(json, ref index);
                    dict[key] = val;
                    SkipWhitespace(json, ref index);
                    if (json[index] == ',') index++;
                }
                return dict;
            }
            
            private static List<object> ParseArray(string json, ref int index)
            {
                index++; // skip '['
                var list = new List<object>();
                while (index < json.Length)
                {
                    SkipWhitespace(json, ref index);
                    if (json[index] == ']') { index++; break; }
                    object val = ParseValue(json, ref index);
                    list.Add(val);
                    SkipWhitespace(json, ref index);
                    if (json[index] == ',') index++;
                }
                return list;
            }
            
            private static bool ParseBool(string json, ref int index)
            {
                if (json[index] == 't') { index += 4; return true; }
                index += 5; return false;
            }
            
            private static double ParseNumber(string json, ref int index)
            {
                int start = index;
                while (index < json.Length && (char.IsDigit(json[index]) || json[index] == '-' || json[index] == '.' || json[index] == 'e' || json[index] == 'E' || json[index] == '+'))
                {
                    index++;
                }
                return double.Parse(json.Substring(start, index - start), System.Globalization.CultureInfo.InvariantCulture);
            }

            public static string Stringify(object obj)
            {
                if (obj == null) return "null";
                if (obj is string) return "\"" + EscapeString((string)obj) + "\"";
                if (obj is bool) return (bool)obj ? "true" : "false";
                if (obj is double || obj is float || obj is int || obj is long) return Convert.ToString(obj, System.Globalization.CultureInfo.InvariantCulture);
                if (obj is IDictionary<string, object> || obj is Dictionary<string, object>)
                {
                    var dict = (System.Collections.IDictionary)obj;
                    var parts = new List<string>();
                    foreach (System.Collections.DictionaryEntry entry in dict)
                    {
                        parts.Add("\"" + EscapeString((string)entry.Key) + "\":" + Stringify(entry.Value));
                    }
                    return "{" + string.Join(",", parts.ToArray()) + "}";
                }
                if (obj is IEnumerable<object> || obj is System.Collections.IList)
                {
                    var list = (System.Collections.IEnumerable)obj;
                    var parts = new List<string>();
                    foreach (var item in list)
                    {
                        parts.Add(Stringify(item));
                    }
                    return "[" + string.Join(",", parts.ToArray()) + "]";
                }
                return "\"" + EscapeString(obj.ToString()) + "\"";
            }

            private static string EscapeString(string value)
            {
                return value.Replace("\\", "\\\\")
                            .Replace("\"", "\\\"")
                            .Replace("\n", "\\n")
                            .Replace("\r", "\\r")
                            .Replace("\t", "\\t");
            }
        }
        #endregion

        #region Tool Schemas Json
        private static readonly string ToolsListJson = @"[
  {
    ""name"": ""create_gameobject"",
    ""description"": ""Creates a new GameObject in the active Unity scene hierarchy."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""name"": { ""type"": ""string"", ""description"": ""The name of the GameObject."" },
        ""position"": {
          ""type"": ""array"",
          ""items"": { ""type"": ""number"" },
          ""minItems"": 3,
          ""maxItems"": 3,
          ""description"": ""Optional position as [x, y, z] array.""
        },
        ""parent_path"": { ""type"": ""string"", ""description"": ""Optional path of parent GameObject (e.g., /Parent)."" }
      },
      ""required"": [""name""]
    }
  },
  {
    ""name"": ""delete_gameobject"",
    ""description"": ""Deletes a GameObject from the hierarchy. Requires confirm: true for safety."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""path"": { ""type"": ""string"", ""description"": ""The exact path of the GameObject (e.g., /Parent/Child)."" },
        ""confirm"": { ""type"": ""boolean"", ""description"": ""Set to true to verify this destructive action."" }
      },
      ""required"": [""path"", ""confirm""]
    }
  },
  {
    ""name"": ""get_scene_hierarchy"",
    ""description"": ""Retrieves the complete active scene hierarchy including GameObjects, active states, paths, transforms (position/rotation/scale), and components."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""max_depth"": { ""type"": ""integer"", ""description"": ""Optional depth limit for serialization (e.g. 1 returns only root objects, 0 or omitted is unlimited)."" }
      }
    }
  },
  {
    ""name"": ""add_component"",
    ""description"": ""Adds a component (e.g., Rigidbody, Camera, or custom scripts) to a GameObject."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The path of the target GameObject."" },
        ""component_type"": { ""type"": ""string"", ""description"": ""The class name of the component (e.g., Rigidbody)."" }
      },
      ""required"": [""gameobject_path"", ""component_type""]
    }
  },
  {
    ""name"": ""remove_component"",
    ""description"": ""Removes a component from a GameObject."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The path of the target GameObject."" },
        ""component_type"": { ""type"": ""string"", ""description"": ""The class name of the component to remove."" }
      },
      ""required"": [""gameobject_path"", ""component_type""]
    }
  },
  {
    ""name"": ""set_component_property"",
    ""description"": ""Sets a public field or property value on a component using reflection."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The path of the GameObject."" },
        ""component_type"": { ""type"": ""string"", ""description"": ""The class name of the component."" },
        ""property"": { ""type"": ""string"", ""description"": ""The property or field name (case-insensitive)."" },
        ""value"": { ""type"": ""string"", ""description"": ""The value to assign as string (e.g., \""10\"", \""true\"", \""[0, 5, 0]\"" for vectors, or \""[1, 0, 0]\"" for colors)."" }
      },
      ""required"": [""gameobject_path"", ""component_type"", ""property"", ""value""]
    }
  },
  {
    ""name"": ""read_script"",
    ""description"": ""Reads the code of a C# script file in the project."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""asset_path"": { ""type"": ""string"", ""description"": ""Relative path under Assets/ (e.g., Assets/Scripts/Player.cs)."" }
      },
      ""required"": [""asset_path""]
    }
  },
  {
    ""name"": ""write_script"",
    ""description"": ""Overwrites or writes a C# script file in the project and triggers compilation."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""asset_path"": { ""type"": ""string"", ""description"": ""Relative path under Assets/."" },
        ""content"": { ""type"": ""string"", ""description"": ""Full source code of the script."" }
      },
      ""required"": [""asset_path"", ""content""]
    }
  },
  {
    ""name"": ""create_script"",
    ""description"": ""Generates a new C# script file with an optional custom template."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""asset_path"": { ""type"": ""string"", ""description"": ""Relative path under Assets/ ending in .cs."" },
        ""template"": { ""type"": ""string"", ""description"": ""Optional custom template content. If omitted, a default MonoBehaviour is generated."" }
      },
      ""required"": [""asset_path""]
    }
  },
  {
    ""name"": ""get_compile_status"",
    ""description"": ""Queries the compilation status of the project, including compilation errors and warnings."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {}
    }
  },
  {
    ""name"": ""get_console_logs"",
    ""description"": ""Retrieves logs and stack traces from the Unity Editor console."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""count"": { ""type"": ""number"", ""description"": ""Max number of logs to return (default: 50)."" },
        ""log_type"": {
          ""type"": ""string"",
          ""enum"": [""Log"", ""Warning"", ""Error"", ""Assert"", ""Exception""],
          ""description"": ""Optional log type filter.""
        }
      }
    }
  },
  {
    ""name"": ""run_tests"",
    ""description"": ""Runs Unity Test Runner EditMode or PlayMode tests. Returns a job ID immediately (asynchronous)."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""test_mode"": { ""type"": ""string"", ""enum"": [""EditMode"", ""PlayMode""], ""description"": ""The test mode (default: EditMode)."" },
        ""filter"": { ""type"": ""string"", ""description"": ""Optional search filter to run a specific test by name."" }
      }
    }
  },
  {
    ""name"": ""get_test_status"",
    ""description"": ""Polls the status and results of an asynchronous test execution job."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""job_id"": { ""type"": ""string"", ""description"": ""The job ID returned by run_tests."" }
      },
      ""required"": [""job_id""]
    }
  },
  {
    ""name"": ""create_prefab"",
    ""description"": ""Saves a GameObject hierarchy as a reusable Prefab Asset."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The path of the target GameObject."" },
        ""save_path"": { ""type"": ""string"", ""description"": ""The save path under Assets/ ending with .prefab."" }
      },
      ""required"": [""gameobject_path"", ""save_path""]
    }
  },
  {
    ""name"": ""list_assets"",
    ""description"": ""Lists all assets in a specific folder path in the project."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""folder_path"": { ""type"": ""string"", ""description"": ""The folder path starting with Assets/ (default: Assets)."" },
        ""filter"": { ""type"": ""string"", ""description"": ""Optional search filter (e.g., \""t:Prefab\"" or \""t:Material\"")."" }
      }
    }
  },
  {
    ""name"": ""get_project_info"",
    ""description"": ""Retrieves metadata about the Unity project (version, active Render Pipeline, target platform, etc.)."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {}
    }
  },
  {
    ""name"": ""capture_game_view"",
    ""description"": ""Captures a PNG screenshot from the main Game View camera."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""quality"": {
          ""type"": ""string"",
          ""enum"": [""low"", ""medium"", ""high""],
          ""description"": ""Resolution of screenshot (low=640x480, medium=1280x720, high=1920x1080).""
        }
      }
    }
  },
  {
    ""name"": ""capture_scene_view"",
    ""description"": ""Captures a PNG screenshot from the Editor Scene View camera."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""quality"": {
          ""type"": ""string"",
          ""enum"": [""low"", ""medium"", ""high""],
          ""description"": ""Resolution of screenshot (low=640x480, medium=1280x720, high=1920x1080).""
        }
      }
    }
  },
  {
    ""name"": ""capture_annotated_view"",
    ""description"": ""Captures a screenshot with colored dots marking GameObject positions."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""quality"": {
          ""type"": ""string"",
          ""enum"": [""low"", ""medium"", ""high""],
          ""description"": ""Resolution of screenshot.""
        },
        ""target_paths"": {
          ""type"": ""array"",
          ""items"": { ""type"": ""string"" },
          ""description"": ""Paths of specific GameObjects to annotate. Default is root objects & renderers.""
        }
      }
    }
  },
  {
    ""name"": ""enter_play_mode"",
    ""description"": ""Enters Play Mode in the Unity Editor."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {}
    }
  },
  {
    ""name"": ""exit_play_mode"",
    ""description"": ""Exits Play Mode in the Unity Editor."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {}
    }
  },
  {
    ""name"": ""pause_play_mode"",
    ""description"": ""Pauses the execution of the game in Play Mode."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {}
    }
  },
  {
    ""name"": ""step_frame"",
    ""description"": ""Steps the execution of the game by a single frame (requires game to be paused)."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {}
    }
  },
  {
    ""name"": ""inspect_runtime_value"",
    ""description"": ""Reads the live value of a public field or property on a component of a GameObject."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The hierarchy path of the GameObject (e.g., /Player)."" },
        ""component_type"": { ""type"": ""string"", ""description"": ""The Component class name (e.g., Transform)."" },
        ""member_name"": { ""type"": ""string"", ""description"": ""The public field or property to read (e.g., position)."" }
      },
      ""required"": [""gameobject_path"", ""component_type"", ""member_name""]
    }
  },
  {
    ""name"": ""set_runtime_value"",
    ""description"": ""Dynamically writes/assigns a new value to a public field or property on a component of a GameObject at runtime."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The hierarchy path of the GameObject."" },
        ""component_type"": { ""type"": ""string"", ""description"": ""The Component class name."" },
        ""member_name"": { ""type"": ""string"", ""description"": ""The public field or property to write."" },
        ""value"": { ""type"": ""string"", ""description"": ""The string-formatted value to assign (e.g., \""15\"", \""true\"", \""[0, 5, 0]\"")."" }
      },
      ""required"": [""gameobject_path"", ""component_type"", ""member_name"", ""value""]
    }
  },
  {
    ""name"": ""wait_for_condition"",
    ""description"": ""Asynchronously polls a condition on a component property and returns once the comparison evaluates to true (or times out)."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The hierarchy path of the GameObject to watch."" },
        ""component_type"": { ""type"": ""string"", ""description"": ""The Component class name to check."" },
        ""member_name"": { ""type"": ""string"", ""description"": ""The public field or property name to evaluate."" },
        ""op"": { ""type"": ""string"", ""enum"": [""=="", ""!="", ""<"", "">"", ""<="", "">=""], ""description"": ""Comparison operator."" },
        ""value"": { ""type"": ""string"", ""description"": ""The target value to compare against."" },
        ""timeout_ms"": { ""type"": ""number"", ""description"": ""Maximum timeout in milliseconds (default: 5000, max: 10000)."" }
      },
      ""required"": [""gameobject_path"", ""component_type"", ""member_name"", ""op"", ""value""]
    }
  },
  {
    ""name"": ""download_asset"",
    ""description"": ""Downloads an asset file (e.g. .obj, .fbx, .png, or .unitypackage) from a public URL directly into the Assets/ folder and imports it."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""url"": { ""type"": ""string"", ""description"": ""The public direct download URL of the asset."" },
        ""save_path"": { ""type"": ""string"", ""description"": ""The destination path under Assets/ (e.g. Assets/Models/car.obj)."" }
      },
      ""required"": [""url"", ""save_path""]
    }
  },
  {
    ""name"": ""manage_package"",
    ""description"": ""Manages Unity Package Manager packages (installs, removes, or lists packages). Use com.unity.probuilder for 3D modeling, com.unity.cinemachine for cameras, com.unity.ugui for UI, etc."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""action"": { ""type"": ""string"", ""enum"": [""install"", ""remove"", ""list""], ""description"": ""The package manager action."" },
        ""package_name"": { ""type"": ""string"", ""description"": ""The package ID (e.g. com.unity.probuilder) - only required for install/remove actions."" }
      },
      ""required"": [""action""]
    }
  },
  {
    ""name"": ""create_probuilder_shape"",
    ""description"": ""Generates a 3D geometry shape (cube, plane) using the Unity ProBuilder API programmatically."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""shape_type"": { ""type"": ""string"", ""description"": ""The ProBuilder shape to create (\""cube\"", \""plane\"")."" },
        ""size"": { ""type"": ""array"", ""items"": { ""type"": ""number"" }, ""description"": ""Size dimensions of the shape as [x, y, z]."" },
        ""position"": { ""type"": ""array"", ""items"": { ""type"": ""number"" }, ""description"": ""World space position [x, y, z] to place the shape."" }
      },
      ""required"": [""shape_type""]
    }
  },
  {
    ""name"": ""apply_material"",
    ""description"": ""Assigns a Material asset from the project to a target GameObject Renderer."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The path of the target GameObject (e.g., \""'/Cube'\"")."" },
        ""material_path"": { ""type"": ""string"", ""description"": ""The project path to the material asset (e.g., \""Assets/Materials/Red.mat\"")."" }
      },
      ""required"": [""gameobject_path"", ""material_path""]
    }
  },
  {
    ""name"": ""set_material_properties"",
    ""description"": ""Dynamically updates properties (color, metallic, smoothness) of a GameObject material."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The path of the target GameObject."" },
        ""color"": { ""type"": ""string"", ""description"": ""Hex color (e.g. \""#FF0000\"") or RGB float array \""[1,0,0]\"". "" },
        ""metallic"": { ""type"": ""number"", ""description"": ""Metallic value between 0.0 and 1.0."" },
        ""smoothness"": { ""type"": ""number"", ""description"": ""Smoothness/Glossiness value between 0.0 and 1.0."" }
      },
      ""required"": [""gameobject_path""]
    }
  },
  {
    ""name"": ""set_physics_properties"",
    ""description"": ""Configures Rigidbody physics (mass, gravity) and add/update Collider components on a GameObject."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The path of the target GameObject."" },
        ""add_rigidbody"": { ""type"": ""boolean"", ""description"": ""Whether to force add a Rigidbody if not present."" },
        ""mass"": { ""type"": ""number"", ""description"": ""The mass of the Rigidbody."" },
        ""use_gravity"": { ""type"": ""string"", ""enum"": [""true"", ""false""], ""description"": ""Whether to enable or disable gravity."" },
        ""collider_type"": { ""type"": ""string"", ""enum"": [""box"", ""sphere"", ""capsule"", ""mesh"", ""none""], ""description"": ""The collider shape to add."" }
      },
      ""required"": [""gameobject_path""]
    }
  },
  {
    ""name"": ""configure_cinemachine"",
    ""description"": ""Sets follow and look-at targets, and offset distances on a Cinemachine camera component."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""gameobject_path"": { ""type"": ""string"", ""description"": ""The path of the Cinemachine camera GameObject."" },
        ""follow_path"": { ""type"": ""string"", ""description"": ""The path of the GameObject to follow."" },
        ""lookat_path"": { ""type"": ""string"", ""description"": ""The path of the GameObject to look at."" },
        ""distance"": { ""type"": ""number"", ""description"": ""Camera offset distance."" }
      },
      ""required"": [""gameobject_path""]
    }
  },
  {
    ""name"": ""instantiate_prefab"",
    ""description"": ""Spawns a linked prefab asset at a specified position and parents it under a parent GameObject."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""prefab_path"": { ""type"": ""string"", ""description"": ""The project path to the prefab asset (e.g. \""Assets/Prefabs/Car.prefab\"")."" },
        ""position"": { ""type"": ""array"", ""items"": { ""type"": ""number"" }, ""description"": ""Position [x, y, z] to place the instance."" },
        ""parent_path"": { ""type"": ""string"", ""description"": ""The path of the parent GameObject."" },
        ""name"": { ""type"": ""string"", ""description"": ""New name for the instantiated GameObject."" }
      },
      ""required"": [""prefab_path""]
    }
  },
  {
    ""name"": ""execute_editor_code"",
    ""description"": ""Compiles and runs arbitrary Editor C# code blocks on the fly inside the Unity Editor."",
    ""inputSchema"": {
      ""type"": ""object"",
      ""properties"": {
        ""code"": { ""type"": ""string"", ""description"": ""The complete C# script code to compile and execute. Must contain a public static method: public static string Execute()"" }
      },
      ""required"": [""code""]
    }
  }
]";
        #endregion
    }
}
