using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;

namespace UnityMCPBridge
{
    public static class AgentOrchestrator
    {
        private static readonly HttpClient _httpClient = new HttpClient();

        private class TokenUsage
        {
            public int promptTokens = 0;
            public int completionTokens = 0;
        }

        private static readonly Dictionary<string, List<string>> AGENT_TOOLS = new Dictionary<string, List<string>>
        {
            { "orchestrator", new List<string> { "capture_scene_view", "capture_game_view", "get_project_info", "get_scene_hierarchy" } },
            { "scripting", new List<string> { "write_script", "get_compile_status" } },
            { "modeling", new List<string> { "create_probuilder_shape", "set_component_property", "list_assets" } },
            { "gui", new List<string> { "add_component", "set_component_property", "prefab_tools" } },
            { "audio", new List<string> { "add_component", "set_component_property", "list_assets" } },
            { "layout", new List<string> { "add_component", "set_component_property", "perform_undo", "perform_redo" } }
        };

        private static readonly Dictionary<string, string> AGENT_PROMPTS = new Dictionary<string, string>
        {
            { "orchestrator", "Sen Orkestra Şefi (Orchestrator Agent) ajansın. Görevin, kullanıcının Unity geliştirme hedefini alıp analiz etmek, sahne durumunu incelemek ve alt uzman ajanlara (Kod Ajanı, Model Ajanı vb.) görev dağıtımı yapmaktır.\nAlt ajanları çağırmak için doğrudan metninde \"[GÖREV] <AjanAdı>: <GörevDetayı>\" biçiminde yönerge ver. \nÖrnek: \"[GÖREV] scripting: CarController.cs dosyasına hız limiti ekle.\"\nMevcut sahnede neler olduğunu anlamak için kamera ve hiyerarşi araçlarını kullanabilirsin." },
            { "scripting", "Sen Kod ve Mekanik Ajanı (Scripting Agent) ajansın. Sadece C# kodları yazmak, düzenlemek ve Unity derleme hatalarını gidermek senin uzmanlığındır. \nGereksiz sahne düzenlemeleri veya materyal atamaları yapma, sadece kod dosyaları oluştur/düzenle. \nKod yazdıktan sonra mutlaka derleme durumunu kontrol et ve hata varsa otomatik düzelt." },
            { "modeling", "Sen 3D Varlık ve Model Ajanı (Modeling/Mesh Agent) ajansın. Sahneye 3D mesh'ler yerleştirmek, model atamaları yapmak (sharedMesh) ve ProBuilder ile geometrik şekiller üretmek senin uzmanlığındır. \nKod yazmaya çalışma, sadece objelerin mesh ve model özelliklerini değiştir." },
            { "gui", "Sen Arayüz Tasarım Ajanı (GUI/UI Agent) ajansın. Sahneye Canvas, Panel, TMP (TextMeshPro) metinler, Butonlar ve HUD elemanları eklemek, UI düzenlerini ayarlamak senin uzmanlığındır." },
            { "audio", "Sen Ses ve Müzik Ajanı (Audio Agent) ajansın. Sahnedeki ses kaynaklarını (AudioSource), çalınacak müzikleri (AudioClip) ve ses tetikleyicilerini yönetmek senin uzmanlığındır." },
            { "layout", "Sen Düzen ve Fizik Ajanı (Layout & Physics Agent) ajansın. Sahnedeki nesnelerin RigidBody, Collider ve fiziksel özelliklerini ayarlamak, nesneleri konumlandırmak (transform) senin uzmanlığındır." }
        };

        public static async Task ProcessChatAsync(PendingRequest request)
        {
            try
            {
                var payload = MiniJSON.Parse(request.Body) as Dictionary<string, object>;
                if (payload == null)
                {
                    request.ResponseBody = "{\"success\":false,\"error\":\"Invalid JSON request body\"}";
                    request.ResponseStatus = 400;
                    request.WaitHandle.Set();
                    return;
                }

                string apiKey = payload.ContainsKey("apiKey") ? payload["apiKey"] as string : "";
                string endpoint = payload.ContainsKey("endpoint") ? payload["endpoint"] as string : "";
                string model = payload.ContainsKey("model") ? payload["model"] as string : "";
                string mode = payload.ContainsKey("mode") ? payload["mode"] as string : "";
                var messages = payload.ContainsKey("messages") ? payload["messages"] as List<object> : new List<object>();
                var toolsSchema = payload.ContainsKey("tools") ? payload["tools"] as List<object> : new List<object>();
                bool deepThinking = payload.ContainsKey("deepThinking") && (bool)payload["deepThinking"];
                double temperature = payload.ContainsKey("temperature") ? Convert.ToDouble(payload["temperature"]) : 0.2;
                int maxTokens = payload.ContainsKey("maxTokens") ? Convert.ToInt32(payload["maxTokens"]) : 4096;
                string customPrompt = payload.ContainsKey("customPrompt") ? payload["customPrompt"] as string : "";
                int maxLoops = payload.ContainsKey("maxLoops") ? Convert.ToInt32(payload["maxLoops"]) : 6;
                var disabledAgentsList = payload.ContainsKey("disabledAgents") ? payload["disabledAgents"] as List<object> : new List<object>();

                var disabledAgents = new HashSet<string>();
                if (disabledAgentsList != null)
                {
                    foreach (var item in disabledAgentsList)
                    {
                        if (item is string s) disabledAgents.Add(s);
                    }
                }

                var response = await RunOrchestratorLoop(
                    messages, toolsSchema, apiKey, endpoint, model, mode, deepThinking,
                    temperature, maxTokens, customPrompt, maxLoops, disabledAgents);

                request.ResponseBody = MiniJSON.Serialize(response);
                request.ResponseStatus = 200;
            }
            catch (Exception ex)
            {
                request.ResponseBody = $"{{\"success\":false,\"error\":\"{ex.Message}\"}}";
                request.ResponseStatus = 500;
            }
            finally
            {
                request.WaitHandle.Set();
            }
        }

        private static async Task<Dictionary<string, object>> RunOrchestratorLoop(
            List<object> messages,
            List<object> toolsSchema,
            string apiKey,
            string endpoint,
            string model,
            string mode,
            bool deepThinking,
            double temperature,
            int maxTokens,
            string customPrompt,
            int maxLoops,
            HashSet<string> disabledAgents)
        {
            var finalMessages = new List<object>(messages);
            var toolExecutions = new List<object>();
            var agentStates = new List<object>();
            var tokenUsage = new TokenUsage();
            var newMessages = new List<object>();

            bool continueLoop = true;
            int loopCount = 0;

            if (deepThinking)
            {
                agentStates.Add(new Dictionary<string, object> { { "agent", "orchestrator" }, { "status", "Derin Düşünme..." } });
                Debug.Log("[Orkestra Şefi] Derin Düşünme Aktif! Sahne mimarisi analiz ediliyor...");

                // 1. Fetch current scene state locally
                string hierarchyJson = await DispatchToolToMainThread("get_scene_hierarchy", "{}");
                string projectInfoJson = await DispatchToolToMainThread("get_project_info", "{}");

                // Get last user message prompt
                string lastUserPrompt = "";
                for (int i = messages.Count - 1; i >= 0; i--)
                {
                    var msg = messages[i] as Dictionary<string, object>;
                    if (msg != null && msg.ContainsKey("role") && (msg["role"] as string) == "user")
                    {
                        if (msg.ContainsKey("content"))
                        {
                            lastUserPrompt = msg["content"] as string;
                            break;
                        }
                    }
                }

                // 2. Formulate pre-planning reasoning pass
                string reasonerSystemPrompt = "Sen Unity Uzman Mimarı ve Düşünme Motorusun. Sana iletilen hedefi ve mevcut sahne durumunu incele. Hedefe ulaşmak için olası derleme hataları, fizik çakışmaları, bileşen eksiklikleri ve mesh ayarlamaları gibi tüm riskleri/senaryoları derinlemesine analiz et. Çözüm için adım adım teknik bir yol haritası çıkart. Yanıtını sadece teknik analiz ve düşünme süreci olarak kurgula.";
                var reasonerMessages = new List<object>
                {
                    new Dictionary<string, object> { { "role", "system" }, { "content", reasonerSystemPrompt } },
                    new Dictionary<string, object> { { "role", "user" }, { "content", $"Kullanıcı Hedefi: {lastUserPrompt}\n\nMevcut Sahne Hiyerarşisi:\n{hierarchyJson}\n\nProje Bilgileri:\n{projectInfoJson}" } }
                };

                // Call LLM for reasoning plan
                Debug.Log("[Orkestra Şefi] Mimari teknik plan hazırlanıyor...");
                var reasoningResponse = await CallLLMAsync(reasonerMessages, new List<object>(), apiKey, endpoint, model, "orchestrator", temperature, maxTokens, customPrompt);
                if (reasoningResponse != null && reasoningResponse.ContainsKey("usage") && reasoningResponse["usage"] is Dictionary<string, object> usageDict)
                {
                    if (usageDict.ContainsKey("prompt_tokens")) tokenUsage.promptTokens += Convert.ToInt32(usageDict["prompt_tokens"]);
                    if (usageDict.ContainsKey("completion_tokens")) tokenUsage.completionTokens += Convert.ToInt32(usageDict["completion_tokens"]);
                }

                var reasonerChoice = reasoningResponse["choices"] as List<object>;
                if (reasonerChoice != null && reasonerChoice.Count > 0)
                {
                    var firstRChoice = reasonerChoice[0] as Dictionary<string, object>;
                    var rMsg = firstRChoice["message"] as Dictionary<string, object>;
                    if (rMsg != null && rMsg.ContainsKey("content"))
                    {
                        string deepThoughtText = rMsg["content"] as string;
                        Debug.Log($"[Derin Düşünme Planı Hazırlandı]:\n{deepThoughtText}");

                        // Append a visual reasoning message for the user
                        var reasoningFeedbackMsg = new Dictionary<string, object>
                        {
                            { "role", "assistant" },
                            { "content", "🧠 **[Derin Düşünme Süreci Tamamlandı]**\n\nMimari plan hazırlandı. Bu plana sadık kalınarak sahne güncellemeleri başlatılıyor." },
                            { "reasoning_content", deepThoughtText }
                        };
                        newMessages.Add(reasoningFeedbackMsg);
                        finalMessages.Add(reasoningFeedbackMsg);

                        // Inject the plan into the orchestration context
                        var deepThoughtContextMsg = new Dictionary<string, object>
                        {
                            { "role", "system" },
                            { "content", $"[DERİN DÜŞÜNME RAPORU & TEKNİK PLAN]:\n{deepThoughtText}\n\nLütfen tüm ajanlar olarak yukarıdaki teknik plana ve mimariye harfiyen uyun!" }
                        };
                        finalMessages.Insert(1, deepThoughtContextMsg);
                    }
                }
            }

            agentStates.Add(new Dictionary<string, object> { { "agent", "orchestrator" }, { "status", "Düşünüyor..." } });

            while (continueLoop && loopCount < maxLoops)
            {
                loopCount++;

                if (loopCount == 1)
                {
                    string[] subKeys = { "scripting", "modeling", "gui", "audio", "layout" };
                    foreach (var sk in subKeys)
                    {
                        string status = disabledAgents.Contains(sk) ? "Devre Dışı" : "Boşta";
                        agentStates.Add(new Dictionary<string, object> { { "agent", sk }, { "status", status } });
                    }
                }

                var response = await CallLLMAsync(finalMessages, toolsSchema, apiKey, endpoint, model, "orchestrator", temperature, maxTokens, customPrompt);
                if (response != null && response.ContainsKey("usage") && response["usage"] is Dictionary<string, object> usageDict)
                {
                    if (usageDict.ContainsKey("prompt_tokens")) tokenUsage.promptTokens += Convert.ToInt32(usageDict["prompt_tokens"]);
                    if (usageDict.ContainsKey("completion_tokens")) tokenUsage.completionTokens += Convert.ToInt32(usageDict["completion_tokens"]);
                }

                var choice = response["choices"] as List<object>;
                if (choice == null || choice.Count == 0) break;

                var firstChoice = choice[0] as Dictionary<string, object>;
                var msg = firstChoice["message"] as Dictionary<string, object>;
                if (msg == null) break;

                newMessages.Add(msg);
                finalMessages.Add(msg);

                string content = msg.ContainsKey("content") ? msg["content"] as string : "";

                if (!string.IsNullOrEmpty(content))
                {
                    var delegations = ParseDelegations(content);
                    if (delegations.Count > 0)
                    {
                        agentStates.Add(new Dictionary<string, object> { { "agent", "orchestrator" }, { "status", "Boşta" } });

                        var reports = new List<string>();
                        foreach (var del in delegations)
                        {
                            if (disabledAgents.Contains(del.Key))
                            {
                                reports.Add($"[{getAgentDisplayName(del.Key)} Raporu]: Bu ajan kullanıcı tarafından devre dışı bırakıldığı için görevi atlandı.");
                                continue;
                            }
                            var subReport = await RunSubAgentLoop(
                                del.Key, del.Value, toolsSchema, apiKey, endpoint, model, agentStates, newMessages,
                                temperature, maxTokens, customPrompt, tokenUsage);
                            reports.Add(subReport);
                        }

                        var feedbackContent = $"### Uzman Ajanların Raporları:\n";
                        foreach (var r in reports)
                        {
                            feedbackContent += $"- {r}\n";
                        }
                        feedbackContent += "\nOrkestra Şefi olarak lütfen yapılan değişiklikleri kontrol et, gerekiyorsa başka bir ajanı çağır veya nihai durumu raporla.";

                        var userFeedbackMsg = new Dictionary<string, object>
                        {
                            { "role", "user" },
                            { "content", feedbackContent }
                        };
                        finalMessages.Add(userFeedbackMsg);
                        newMessages.Add(userFeedbackMsg);

                        agentStates.Add(new Dictionary<string, object> { { "agent", "orchestrator" }, { "status", "Düşünüyor..." } });
                        continue;
                    }
                }

                if (msg.ContainsKey("tool_calls"))
                {
                    var toolCalls = msg["tool_calls"] as List<object>;
                    if (toolCalls != null && toolCalls.Count > 0)
                    {
                        var toolResponses = new List<object>();
                        foreach (var tc in toolCalls)
                        {
                            var toolCallDict = tc as Dictionary<string, object>;
                            string id = toolCallDict["id"] as string;
                            var functionDict = toolCallDict["function"] as Dictionary<string, object>;
                            string name = functionDict["name"] as string;
                            string argsStr = functionDict["arguments"] as string;

                            string toolOutput = await DispatchToolToMainThread(name, argsStr);

                            var toolExec = new Dictionary<string, object>
                            {
                                { "name", name },
                                { "arguments", argsStr },
                                { "output", toolOutput }
                            };
                            toolExecutions.Add(toolExec);

                            var toolResponse = new Dictionary<string, object>
                            {
                                { "role", "tool" },
                                { "tool_call_id", id },
                                { "name", name },
                                { "content", toolOutput }
                            };
                            toolResponses.Add(toolResponse);
                        }

                        finalMessages.AddRange(toolResponses);
                        newMessages.AddRange(toolResponses);
                    }
                    else
                    {
                        continueLoop = false;
                    }
                }
                else
                {
                    continueLoop = false;
                }
            }

            agentStates.Add(new Dictionary<string, object> { { "agent", "orchestrator" }, { "status", "Boşta" } });

            return new Dictionary<string, object>
            {
                { "success", true },
                { "messages", newMessages },
                { "toolExecutions", toolExecutions },
                { "agentStates", agentStates },
                { "promptTokens", tokenUsage.promptTokens },
                { "completionTokens", tokenUsage.completionTokens },
                { "totalTokens", tokenUsage.promptTokens + tokenUsage.completionTokens }
            };
        }

        private static async Task<string> RunSubAgentLoop(
            string agentKey,
            string taskDescription,
            List<object> toolsSchema,
            string apiKey,
            string endpoint,
            string model,
            List<object> agentStates,
            List<object> newMessages,
            double temperature,
            int maxTokens,
            string customPrompt,
            TokenUsage tokenUsage)
        {
            agentStates.Add(new Dictionary<string, object> { { "agent", agentKey }, { "status", "Çalışıyor..." } });

            var subHistory = new List<object>
            {
                new Dictionary<string, object> { { "role", "user" }, { "content", taskDescription } }
            };

            bool subLoop = true;
            int subLoopCount = 0;
            int maxSubLoops = 6;
            string lastContent = "";

            while (subLoop && subLoopCount < maxSubLoops)
            {
                subLoopCount++;

                var response = await CallLLMAsync(subHistory, toolsSchema, apiKey, endpoint, model, agentKey, temperature, maxTokens, customPrompt);
                if (response != null && response.ContainsKey("usage") && response["usage"] is Dictionary<string, object> usageDict)
                {
                    if (usageDict.ContainsKey("prompt_tokens")) tokenUsage.promptTokens += Convert.ToInt32(usageDict["prompt_tokens"]);
                    if (usageDict.ContainsKey("completion_tokens")) tokenUsage.completionTokens += Convert.ToInt32(usageDict["completion_tokens"]);
                }

                var choice = response["choices"] as List<object>;
                if (choice == null || choice.Count == 0) break;

                var firstChoice = choice[0] as Dictionary<string, object>;
                var msg = firstChoice["message"] as Dictionary<string, object>;
                if (msg == null) break;

                newMessages.Add(msg);
                subHistory.Add(msg);

                string content = msg.ContainsKey("content") ? msg["content"] as string : "";
                if (!string.IsNullOrEmpty(content))
                {
                    lastContent = content;
                }

                if (msg.ContainsKey("tool_calls"))
                {
                    var toolCalls = msg["tool_calls"] as List<object>;
                    if (toolCalls != null && toolCalls.Count > 0)
                    {
                        var toolResponses = new List<object>();
                        foreach (var tc in toolCalls)
                        {
                            var toolCallDict = tc as Dictionary<string, object>;
                            string id = toolCallDict["id"] as string;
                            var functionDict = toolCallDict["function"] as Dictionary<string, object>;
                            string name = functionDict["name"] as string;
                            string argsStr = functionDict["arguments"] as string;

                            string toolOutput = await DispatchToolToMainThread(name, argsStr);

                            var toolResponse = new Dictionary<string, object>
                            {
                                { "role", "tool" },
                                { "tool_call_id", id },
                                { "name", name },
                                { "content", toolOutput }
                            };
                            toolResponses.Add(toolResponse);
                        }

                        subHistory.AddRange(toolResponses);
                        newMessages.AddRange(toolResponses);
                    }
                    else
                    {
                        subLoop = false;
                    }
                }
                else
                {
                    subLoop = false;
                }
            }

            agentStates.Add(new Dictionary<string, object> { { "agent", agentKey }, { "status", "Tamamladı" } });
            return $"[{getAgentDisplayName(agentKey)} Raporu]: Görevi başarıyla tamamladı. Sonuç: {lastContent}";
        }

        private static async Task<Dictionary<string, object>> CallLLMAsync(
            List<object> messages,
            List<object> toolsSchema,
            string apiKey,
            string endpoint,
            string model,
            string agentName,
            double temperature = 0.2,
            int maxTokens = 4096,
            string customPrompt = "")
        {
            var apiMessages = new List<object>();

            bool hasSystemMsg = false;
            if (messages.Count > 0)
            {
                var firstMsg = messages[0] as Dictionary<string, object>;
                if (firstMsg != null && firstMsg.ContainsKey("role") && (firstMsg["role"] as string) == "system")
                {
                    hasSystemMsg = true;
                }
            }

            if (!hasSystemMsg)
            {
                var systemMsg = new Dictionary<string, object> { { "role", "system" } };
                string basePrompt = AGENT_PROMPTS.ContainsKey(agentName) ? AGENT_PROMPTS[agentName] : "";
                if (!string.IsNullOrEmpty(customPrompt))
                {
                    systemMsg["content"] = basePrompt + "\n\n[Ek Sistem Talimatı]:\n" + customPrompt;
                }
                else
                {
                    systemMsg["content"] = basePrompt;
                }
                apiMessages.Add(systemMsg);
            }

            for (int i = 0; i < messages.Count; i++)
            {
                var originalMsg = messages[i] as Dictionary<string, object>;
                if (originalMsg == null) continue;

                var copy = new Dictionary<string, object>();
                foreach (var kv in originalMsg)
                {
                    copy[kv.Key] = kv.Value;
                }

                if (i == 0 && hasSystemMsg)
                {
                    if (!string.IsNullOrEmpty(customPrompt))
                    {
                        string originalContent = copy.ContainsKey("content") ? copy["content"] as string : "";
                        copy["content"] = originalContent + "\n\n[Ek Sistem Talimatı]:\n" + customPrompt;
                    }
                }
                else if (copy.ContainsKey("role") && (copy["role"] as string) == "tool")
                {
                    if (copy.ContainsKey("content"))
                    {
                        string contentStr = copy["content"] as string;
                        if (!string.IsNullOrEmpty(contentStr))
                        {
                            try
                            {
                                var parsed = MiniJSON.Parse(contentStr) as Dictionary<string, object>;
                                if (parsed != null)
                                {
                                    bool modified = false;

                                     if (parsed.ContainsKey("image") && parsed["image"] is string imgStr && imgStr.Length > 100)
                                     {
                                         parsed["image"] = "[Görsel verisi token limitini aşmamak için sıkıştırıldı]";
                                         modified = true;
                                     }
                                     else if (parsed.ContainsKey("data") && parsed["data"] is Dictionary<string, object> dataDict)
                                     {
                                         if (dataDict.ContainsKey("image") && dataDict["image"] is string dataImgStr && dataImgStr.Length > 100)
                                         {
                                             dataDict["image"] = "[Görsel verisi token limitini aşmamak için sıkıştırıldı]";
                                             modified = true;
                                         }
                                     }

                                    if (i < messages.Count - 1)
                                    {
                                        if (parsed.ContainsKey("hierarchy") && parsed["hierarchy"] is List<object> hierarchyList)
                                        {
                                            parsed["hierarchy_summary"] = $"[Kısaltıldı: {hierarchyList.Count} kök obje bulundu. Sahne ağacı token sınırını korumak için sıkıştırıldı.]";
                                            parsed.Remove("hierarchy");
                                            modified = true;
                                        }
                                        if (parsed.ContainsKey("assets") && parsed["assets"] is List<object> assetsList)
                                        {
                                            parsed["assets_summary"] = $"[Kısaltıldı: {assetsList.Count} dosya listelendi. Klasör yapısı token sınırını korumak için sıkıştırıldı.]";
                                            parsed.Remove("assets");
                                            modified = true;
                                        }
                                        if (parsed.ContainsKey("logs") && parsed["logs"] is List<object> logsList)
                                        {
                                            parsed["logs_summary"] = $"[Kısaltıldı: {logsList.Count} konsol satırı listelendi. Loglar sıkıştırıldı.]";
                                            parsed.Remove("logs");
                                            modified = true;
                                        }
                                    }

                                    if (modified)
                                    {
                                        copy["content"] = MiniJSON.Serialize(parsed);
                                    }
                                    else
                                    {
                                        int maxLen = (i < messages.Count - 1) ? 15000 : 45000;
                                        if (contentStr.Length > maxLen)
                                        {
                                            copy["content"] = contentStr.Substring(0, maxLen) + $"\n... [Büyük yanıt içeriği {maxLen} limitine göre sıkıştırıldı] ...";
                                        }
                                    }
                                }
                                else
                                {
                                    int maxLen = (i < messages.Count - 1) ? 15000 : 45000;
                                    if (contentStr.Length > maxLen)
                                    {
                                        copy["content"] = contentStr.Substring(0, maxLen) + $"\n... [Büyük yanıt içeriği {maxLen} limitine göre sıkıştırıldı] ...";
                                    }
                                }
                            }
                            catch (Exception)
                            {
                                int maxLen = (i < messages.Count - 1) ? 15000 : 45000;
                                if (contentStr.Length > maxLen)
                                {
                                    copy["content"] = contentStr.Substring(0, maxLen) + $"\n... [Büyük yanıt içeriği {maxLen} limitine göre sıkıştırıldı] ...";
                                }
                            }
                        }
                    }
                }
                else if (copy.ContainsKey("role") && (copy["role"] as string) == "assistant")
                {
                    if (copy.ContainsKey("content"))
                    {
                        string contentStr = copy["content"] as string;
                        int maxLen = (i < messages.Count - 1) ? 15000 : 45000;
                        if (!string.IsNullOrEmpty(contentStr) && contentStr.Length > maxLen)
                        {
                            copy["content"] = contentStr.Substring(0, maxLen) + $"\n... [Büyük asistan yanıt içeriği {maxLen} limitine göre sıkıştırıldı] ...";
                        }
                    }
                }
                else if (copy.ContainsKey("role") && (copy["role"] as string) == "user")
                {
                    if (copy.ContainsKey("content"))
                    {
                        var contentObj = copy["content"];
                        int maxLen = (i < messages.Count - 1) ? 15000 : 45000;
                        if (contentObj is string contentStr)
                        {
                            if (contentStr.Length > maxLen)
                            {
                                copy["content"] = contentStr.Substring(0, maxLen) + $"\n... [Büyük kullanıcı mesajı içeriği {maxLen} limitine göre sıkıştırıldı] ...";
                            }
                        }
                        else if (contentObj is List<object> contentList)
                        {
                            var newList = new List<object>();
                            foreach (var item in contentList)
                            {
                                if (item is Dictionary<string, object> block)
                                {
                                    if (block.ContainsKey("type") && (block["type"] as string) == "image_url")
                                    {
                                        if (i < messages.Count - 1)
                                        {
                                            newList.Add(new Dictionary<string, object> { { "type", "text" }, { "text", "[Görsel verisi önceki turlardan temizlendi]" } });
                                        }
                                        else
                                        {
                                            newList.Add(block);
                                        }
                                    }
                                    else if (block.ContainsKey("type") && (block["type"] as string) == "text" && block.ContainsKey("text"))
                                    {
                                        string textVal = block["text"] as string;
                                        if (!string.IsNullOrEmpty(textVal) && textVal.Length > maxLen)
                                        {
                                            newList.Add(new Dictionary<string, object> { { "type", "text" }, { "text", textVal.Substring(0, maxLen) + $"\n... [Büyük kullanıcı mesaj bloğu {maxLen} limitine göre sıkıştırıldı] ..." } });
                                        }
                                        else
                                        {
                                            newList.Add(block);
                                        }
                                    }
                                    else
                                    {
                                        newList.Add(block);
                                    }
                                }
                            }
                            copy["content"] = newList;
                        }
                    }
                    if (i < messages.Count - 1 && copy.ContainsKey("image_url"))
                    {
                        copy.Remove("image_url");
                    }
                }

                apiMessages.Add(copy);
            }

            // Find the first user message in apiMessages and prepend the agent prompt to it to bypass proxy system overrides
            for (int i = 0; i < apiMessages.Count; i++)
            {
                var msgDict = apiMessages[i] as Dictionary<string, object>;
                if (msgDict != null && msgDict.ContainsKey("role") && (msgDict["role"] as string) == "user")
                {
                    if (msgDict.ContainsKey("content"))
                    {
                        string basePrompt = AGENT_PROMPTS.ContainsKey(agentName) ? AGENT_PROMPTS[agentName] : "";
                        string systemInstructionBlock = $"[SİSTEM TALİMATI (Bunu mutlaka oku ve buna göre davran!)]:\n{basePrompt}\n";
                        if (!string.IsNullOrEmpty(customPrompt))
                        {
                            systemInstructionBlock += $"[Ek Sistem Talimatı]:\n{customPrompt}\n";
                        }
                        systemInstructionBlock += "--------------------------------------\n\n";

                        var contentObj = msgDict["content"];
                        if (contentObj is string contentStr)
                        {
                            msgDict["content"] = systemInstructionBlock + contentStr;
                        }
                        else if (contentObj is List<object> contentList)
                        {
                            var newBlock = new Dictionary<string, object> { { "type", "text" }, { "text", systemInstructionBlock } };
                            var modifiableList = new List<object>(contentList);
                            modifiableList.Insert(0, newBlock);
                            msgDict["content"] = modifiableList;
                        }
                    }
                    break;
                }
            }

            var activeTools = new List<object>();
            if (AGENT_TOOLS.ContainsKey(agentName))
            {
                var allowed = AGENT_TOOLS[agentName];
                foreach (var tool in toolsSchema)
                {
                    var toolDict = tool as Dictionary<string, object>;
                    if (toolDict != null && toolDict.ContainsKey("function"))
                    {
                        var funcDict = toolDict["function"] as Dictionary<string, object>;
                        if (funcDict != null && funcDict.ContainsKey("name"))
                        {
                            string tName = funcDict["name"] as string;
                            if (allowed.Contains(tName))
                            {
                                activeTools.Add(tool);
                            }
                        }
                    }
                }
            }

            // Prune history if it's too long
            var prunedApiMessages = new List<object>();
            if (apiMessages.Count > 12)
            {
                int startIndex = 0;
                var firstMsg = apiMessages[0] as Dictionary<string, object>;
                if (firstMsg != null && firstMsg.ContainsKey("role") && (firstMsg["role"] as string) == "system")
                {
                    prunedApiMessages.Add(firstMsg);
                    startIndex = 1;
                }
                
                if (startIndex < apiMessages.Count)
                {
                    var firstUser = apiMessages[startIndex] as Dictionary<string, object>;
                    if (firstUser != null && firstUser.ContainsKey("role") && (firstUser["role"] as string) == "user")
                    {
                        prunedApiMessages.Add(firstUser);
                        startIndex++;
                    }
                }

                prunedApiMessages.Add(new Dictionary<string, object>
                {
                    { "role", "system" },
                    { "content", "[Sistem Bilgisi: Token limitini aşmamak için geçmişteki eski sohbet mesajları temizlendi. Lütfen son mesajlara ve ana hedefe odaklanın.]" }
                });

                int startFrom = Math.Max(startIndex, apiMessages.Count - 8);
                for (int i = startFrom; i < apiMessages.Count; i++)
                {
                    prunedApiMessages.Add(apiMessages[i]);
                }
            }
            else
            {
                prunedApiMessages = apiMessages;
            }

            var requestBody = new Dictionary<string, object>
            {
                { "model", model },
                { "messages", prunedApiMessages },
                { "temperature", temperature },
                { "max_tokens", maxTokens }
            };

            if (activeTools.Count > 0)
            {
                requestBody["tools"] = activeTools;
                requestBody["tool_choice"] = "auto";
            }

            string requestJson = MiniJSON.Serialize(requestBody);
            try
            {
                File.WriteAllText("C:\\Users\\HP\\Desktop\\mcp-bridge\\inspector.log", $"[CallLLMAsync Request] Size: {requestJson.Length} bytes\nBody:\n{requestJson}");
            }
            catch {}

            string cleanEndpoint = (endpoint ?? "").Trim();
            if (cleanEndpoint.EndsWith("/"))
            {
                cleanEndpoint = cleanEndpoint.Substring(0, cleanEndpoint.Length - 1);
            }
            if (cleanEndpoint.EndsWith("/chat/completions"))
            {
                cleanEndpoint = cleanEndpoint.Substring(0, cleanEndpoint.Length - "/chat/completions".Length);
            }
            if (cleanEndpoint.EndsWith("/"))
            {
                cleanEndpoint = cleanEndpoint.Substring(0, cleanEndpoint.Length - 1);
            }

            using (var request = new HttpRequestMessage(HttpMethod.Post, $"{cleanEndpoint}/chat/completions"))
            {
                request.Headers.Add("Authorization", $"Bearer {apiKey}");
                request.Content = new StringContent(requestJson, Encoding.UTF8, "application/json");

                using (var response = await _httpClient.SendAsync(request))
                {
                    string responseJson = await response.Content.ReadAsStringAsync();
                    if (!response.IsSuccessStatusCode)
                    {
                        throw new Exception($"LLM API Error ({response.StatusCode}): {responseJson}");
                    }
                    return MiniJSON.Parse(responseJson) as Dictionary<string, object>;
                }
            }
        }

        private static Task<string> DispatchToolToMainThread(string name, string argsJson)
        {
            var tcs = new TaskCompletionSource<string>();
            
            MCPHttpServer.EnqueueOnMainThread(() =>
            {
                try
                {
                    string result = MCPToolRegistry.Dispatch(name, argsJson);
                    tcs.SetResult(result);
                }
                catch (Exception ex)
                {
                    tcs.SetException(ex);
                }
            });

            return tcs.Task;
        }

        private static List<KeyValuePair<string, string>> ParseDelegations(string content)
        {
            var list = new List<KeyValuePair<string, string>>();
            var matches = System.Text.RegularExpressions.Regex.Matches(content, @"\[GÖREV\]\s*(\w+)\s*:\s*([^.\n]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            foreach (System.Text.RegularExpressions.Match match in matches)
            {
                string rawAgent = match.Groups[1].Value;
                string task = match.Groups[2].Value.Trim();
                string mapped = mapAgentName(rawAgent);
                if (!string.IsNullOrEmpty(mapped))
                {
                    list.Add(new KeyValuePair<string, string>(mapped, task));
                }
            }
            return list;
        }

        private static string mapAgentName(string name)
        {
            string clean = name.ToLower().Trim();
            if (clean.Contains("script") || clean.Contains("kod") || clean.Contains("mekanik")) return "scripting";
            if (clean.Contains("model") || clean.Contains("mesh") || clean.Contains("3d")) return "modeling";
            if (clean.Contains("gui") || clean.Contains("ui") || clean.Contains("arayuz") || clean.Contains("arayüz")) return "gui";
            if (clean.Contains("audio") || clean.Contains("sound") || clean.Contains("ses") || clean.Contains("muzik") || clean.Contains("müzik")) return "audio";
            if (clean.Contains("layout") || clean.Contains("physics") || clean.Contains("fizik") || clean.Contains("duzen") || clean.Contains("düzen")) return "layout";
            return null;
        }

        private static string getAgentDisplayName(string key)
        {
            if (key == "orchestrator") return "Orkestra Şefi";
            if (key == "scripting") return "Kod & Mekanik Ajanı";
            if (key == "modeling") return "3D Varlık Ajanı";
            if (key == "gui") return "Arayüz Tasarım Ajanı";
            if (key == "audio") return "Ses & Müzik Ajanı";
            if (key == "layout") return "Düzen & Fizik Ajanı";
            return key;
        }
    }

    public static class MiniJSON
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
            if (c == '{') return ParseObject(json, ref index);
            if (c == '[') return ParseArray(json, ref index);
            if (c == '"') return ParseString(json, ref index);
            if (c == 't' || c == 'f') return ParseBool(json, ref index);
            if (c == 'n') { index += 4; return null; }
            return ParseNumber(json, ref index);
        }

        private static void SkipWhitespace(string json, ref int index)
        {
            while (index < json.Length && char.IsWhiteSpace(json[index])) index++;
        }

        private static Dictionary<string, object> ParseObject(string json, ref int index)
        {
            var dict = new Dictionary<string, object>();
            index++;
            SkipWhitespace(json, ref index);
            while (index < json.Length && json[index] != '}')
            {
                string key = ParseString(json, ref index);
                SkipWhitespace(json, ref index);
                if (index >= json.Length || json[index] != ':') throw new Exception("Expected ':'");
                index++;
                object val = ParseValue(json, ref index);
                dict[key] = val;
                SkipWhitespace(json, ref index);
                if (index < json.Length && json[index] == ',')
                {
                    index++;
                    SkipWhitespace(json, ref index);
                }
            }
            if (index < json.Length) index++;
            return dict;
        }

        private static List<object> ParseArray(string json, ref int index)
        {
            var list = new List<object>();
            index++;
            SkipWhitespace(json, ref index);
            while (index < json.Length && json[index] != ']')
            {
                list.Add(ParseValue(json, ref index));
                SkipWhitespace(json, ref index);
                if (index < json.Length && json[index] == ',')
                {
                    index++;
                    SkipWhitespace(json, ref index);
                }
            }
            if (index < json.Length) index++;
            return list;
        }

        private static string ParseString(string json, ref int index)
        {
            SkipWhitespace(json, ref index);
            if (index >= json.Length || json[index] != '"') throw new Exception("Expected string start");
            index++;
            var sb = new StringBuilder();
            while (index < json.Length && json[index] != '"')
            {
                char c = json[index];
                if (c == '\\')
                {
                    index++;
                    if (index >= json.Length) break;
                    char next = json[index];
                    if (next == 'n') sb.Append('\n');
                    else if (next == 'r') sb.Append('\r');
                    else if (next == 't') sb.Append('\t');
                    else if (next == '"') sb.Append('"');
                    else if (next == '\\') sb.Append('\\');
                    else sb.Append(next);
                }
                else
                {
                    sb.Append(c);
                }
                index++;
            }
            if (index < json.Length) index++;
            return sb.ToString();
        }

        private static bool ParseBool(string json, ref int index)
        {
            if (json[index] == 't') { index += 4; return true; }
            index += 5;
            return false;
        }

        private static object ParseNumber(string json, ref int index)
        {
            int start = index;
            while (index < json.Length && (char.IsDigit(json[index]) || json[index] == '-' || json[index] == '.' || json[index] == 'e' || json[index] == 'E' || json[index] == '+'))
            {
                index++;
            }
            string numStr = json.Substring(start, index - start);
            if (numStr.Contains(".")) return double.Parse(numStr, System.Globalization.CultureInfo.InvariantCulture);
            return long.Parse(numStr, System.Globalization.CultureInfo.InvariantCulture);
        }

        public static string Serialize(object obj)
        {
            if (obj == null) return "null";
            if (obj is string s) return "\"" + EscapeString(s) + "\"";
            if (obj is bool b) return b ? "true" : "false";
            if (obj is Dictionary<string, object> dict)
            {
                var parts = new List<string>();
                foreach (var kv in dict)
                {
                    parts.Add("\"" + EscapeString(kv.Key) + "\":" + Serialize(kv.Value));
                }
                return "{" + string.Join(",", parts) + "}";
            }
            if (obj is List<object> list)
            {
                var parts = new List<string>();
                foreach (var item in list)
                {
                    parts.Add(Serialize(item));
                }
                return "[" + string.Join(",", parts) + "]";
            }
            if (obj is double || obj is float || obj is int || obj is long)
            {
                return Convert.ToString(obj, System.Globalization.CultureInfo.InvariantCulture);
            }
            return "\"" + EscapeString(obj.ToString()) + "\"";
        }

        private static string EscapeString(string s)
        {
            return s.Replace("\\", "\\\\")
                    .Replace("\"", "\\\"")
                    .Replace("\n", "\\n")
                    .Replace("\r", "\\r")
                    .Replace("\t", "\\t");
        }
    }
}
