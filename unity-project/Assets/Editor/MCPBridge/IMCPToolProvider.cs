namespace UnityMCPBridge
{
    public interface IMCPToolProvider
    {
        /// <summary>
        /// Registers tool handlers with the MCPToolRegistry.
        /// </summary>
        void RegisterTools();
    }
}
