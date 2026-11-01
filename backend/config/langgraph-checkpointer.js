// config/langgraph-checkpointer.js

import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";

let mongoClient;
let checkpointer;

export const getCheckpointer = async () => {
  if (checkpointer) {
    return checkpointer;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }

  mongoClient = new MongoClient(process.env.MONGODB_URI);

  await mongoClient.connect();

  checkpointer = new MongoDBSaver({
    client: mongoClient,
  });

  return checkpointer;
};