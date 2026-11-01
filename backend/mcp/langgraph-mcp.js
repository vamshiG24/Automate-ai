import { MCPAdapter } from "@langchain/mcp-adapters";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, "server.js");

const mcpAdapter = new MCPAdapter({
  servers: {
    automate: {
      transport: "stdio",
      command: process.execPath,
      args: [serverPath],
    },
  },
});

export async function getMCPTools() {
  const tools = await mcpAdapter.listTools();

  console.log(
    "Loaded MCP tools:",
    tools.map((tool) => tool.name)
  );

  return tools;
}

export async function closeMCPAdapter() {
  await mcpAdapter.close();
}