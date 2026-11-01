import {
  connectMcpServer,
  getMcpTools,
  disconnectMcpServer,
} from "./client.js" ;

async function testMcp() {
  try {
    await connectMcpServer({
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        process.cwd(),
      ],
    });

    const tools = await getMcpTools();

    console.log("\nAvailable MCP tools:");

    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description || ""}`);
    }
  } catch (error) {
    console.error("MCP test failed:", error);
  } finally {
    await disconnectMcpServer();
  }
}

testMcp();