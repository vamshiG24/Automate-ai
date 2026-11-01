import dotenv from "dotenv"
dotenv.config()
import { ChatGroq } from "@langchain/groq";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";

import { getCheckpointer } from "../config/langgraph-checkpointer.js";

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
});

const chatNode = async (state) => {
  const response = await model.invoke(state.messages);

  return {
    messages: [response],
  };
};

const builder = new StateGraph(MessagesAnnotation)
  .addNode("chat", chatNode)
  .addEdge(START, "chat")
  .addEdge("chat", END);

let chatGraphPromise;

export const getChatGraph = async () => {
  if (!chatGraphPromise) {
    chatGraphPromise = (async () => {
      const checkpointer = await getCheckpointer();

      return builder.compile({
        checkpointer,
      });
    })().catch((error) => {
      chatGraphPromise = undefined;
      throw error;
    });
  }

  return chatGraphPromise;
};
