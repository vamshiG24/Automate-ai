import { getMCPTools } from "../mcp/langgraph-mcp.js";

// General chat has no tools, so when the user attaches an image we run the
// MCP "analyze_image" tool (Gemini vision, with the SSRF checks) once and
// give its description to the LLM as context.

const IMAGE_URL_LINE = /^Image URL:\s*(https:\/\/\S+)/im;

export const findImageUrl = (message = "") => message.match(IMAGE_URL_LINE)?.[1] || "";

// MCP results arrive as a string, or as content parts with .text
const resultText = (result) => {
  if (typeof result === "string") return result;
  if (Array.isArray(result)) return result.map((part) => part?.text || "").join("\n");
  return JSON.stringify(result);
};

export const analyzeImageForChat = async (imageUrl, question) => {
  const tools = await getMCPTools();
  const analyzeTool = tools.find((tool) => tool.name.endsWith("analyze_image"));

  if (!analyzeTool) {
    throw new Error("Image analysis is not available.");
  }

  const text = resultText(await analyzeTool.invoke({
    imageUrl,
    prompt: question?.trim() || "Describe this image clearly and accurately.",
  }));

  try {
    return JSON.parse(text).analysis || text;
  } catch {
    return text;
  }
};
