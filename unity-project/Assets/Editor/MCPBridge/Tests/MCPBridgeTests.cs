using NUnit.Framework;
using UnityEngine;
using UnityEditor;
using System.IO;

namespace UnityMCPBridge.Tests
{
    public class MCPBridgeTests
    {
        [Test]
        public void TestGameObjectPathResolution()
        {
            // Arrange
            GameObject parent = new GameObject("TestParent");
            GameObject child = new GameObject("TestChild");
            child.transform.SetParent(parent.transform);

            // Act
            string parentPath = SceneTools.GetGameObjectPath(parent);
            string childPath = SceneTools.GetGameObjectPath(child);

            // Assert
            Assert.AreEqual("/TestParent", parentPath);
            Assert.AreEqual("/TestParent/TestChild", childPath);

            // Test lookup
            GameObject resolvedParent = SceneTools.FindGameObjectByPath("/TestParent");
            GameObject resolvedChild = SceneTools.FindGameObjectByPath("/TestParent/TestChild");

            Assert.AreSame(parent, resolvedParent);
            Assert.AreSame(child, resolvedChild);

            // Cleanup
            Object.DestroyImmediate(child);
            Object.DestroyImmediate(parent);
        }

        [Test]
        public void TestToolRegistryDispatch_CreateAndDelete()
        {
            // Act: Create
            string createArgs = "{\"name\":\"RegistryTestObject\",\"position\":[1,2,3]}";
            string response = MCPToolRegistry.Dispatch("create_gameobject", createArgs);

            // Assert
            Assert.IsTrue(response.Contains("\"success\":true"), "Failed to create GameObject via dispatcher.");

            GameObject createdGo = GameObject.Find("RegistryTestObject");
            Assert.IsNotNull(createdGo);
            Assert.AreEqual(new Vector3(1, 2, 3), createdGo.transform.position);

            // Act: Dry-run delete (confirm = false)
            string deleteArgsDry = "{\"path\":\"/RegistryTestObject\",\"confirm\":false}";
            string responseDry = MCPToolRegistry.Dispatch("delete_gameobject", deleteArgsDry);

            // Assert dry run
            Assert.IsTrue(responseDry.Contains("\"dry_run\":true"), "Delete should have triggered dry_run without confirmation.");
            Assert.IsNotNull(GameObject.Find("RegistryTestObject"), "GameObject was deleted without confirmation.");

            // Act: Confirmed delete (confirm = true)
            string deleteArgsConfirm = "{\"path\":\"/RegistryTestObject\",\"confirm\":true}";
            string responseConfirm = MCPToolRegistry.Dispatch("delete_gameobject", deleteArgsConfirm);

            // Assert deletion
            Assert.IsTrue(responseConfirm.Contains("\"success\":true"), "Failed to delete GameObject with confirmation.");
            Assert.IsNull(GameObject.Find("RegistryTestObject"), "GameObject still exists after confirmed deletion.");
        }

        [Test]
        public void TestGetCompileStatus()
        {
            // Act
            string response = MCPToolRegistry.Dispatch("get_compile_status", "{}");

            // Assert
            Assert.IsTrue(response.Contains("\"success\":true"));
            Assert.IsTrue(response.Contains("\"hasErrors\":"));
        }

        [Test]
        public void TestGetConsoleLogs()
        {
            // Arrange
            string uniqueMessage = "Test log output for console test - " + System.Guid.NewGuid().ToString();
            Debug.Log(uniqueMessage);

            // Act
            string response = MCPToolRegistry.Dispatch("get_console_logs", "{\"count\":10}");

            // Assert
            Assert.IsTrue(response.Contains("\"success\":true"));
            Assert.IsTrue(response.Contains(uniqueMessage), "The logged message was not retrieved from get_console_logs.");
        }
    }
}
