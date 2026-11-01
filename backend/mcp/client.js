import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const client = new Client({
  name: "automate-ai-client",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["./mcp/server.js"],
});

async function main() {
  try {
    // Connect to MCP server
    await client.connect(transport);

    console.log("Connected to AutoMate MCP Server");

    // Discover available tools
    const result = await client.listTools();

    console.log("\nAvailable MCP Tools:");

    for (const tool of result.tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }

    // Execute a tool
    const toolResult = await client.callTool({
      name: "get_current_time",
      arguments: {},
    });

    console.log("\nTool Result:");
    console.log(toolResult.content);
  } catch (error) {
    console.error("MCP Client Error:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();