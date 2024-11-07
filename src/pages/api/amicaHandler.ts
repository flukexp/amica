import { askLLM } from "@/utils/askLlm";
import { TimestampedPrompt } from "@/features/amicaLife/eventHandler";

import { randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import { twitterClientInstance as twitterClient } from "@/features/socialMedia/twitterClient";
import { config } from "@/utils/config";

interface ApiResponse {
  sessionId?: string;
  outputType?: string;
  response?: any;
  error?: string;
}

interface LogEntry {
  sessionId: string;
  timestamp: string;
  inputType: string;
  outputType: string;
  response?: any;
  error?: string;
}

export const logs: LogEntry[] = [];

const generateSessionId = (sessionId?: string) =>
  sessionId || randomBytes(8).toString("hex");

// Helper for setting error responses
const sendError = (
  res: NextApiResponse<ApiResponse>,
  sessionId: string,
  message: string,
  status = 400,
) => res.status(status).json({ sessionId, error: message });

let dataHandlerUrl = new URL("http://localhost:3000/api/dataHandler");
dataHandlerUrl.searchParams.append("type", "subconscious");

// Main API handler
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>,
) {
  if (process.env.API_ENABLED !== "true") {
    return sendError(res, "", "API is currently disabled.", 503);
  }

  const { sessionId, inputType, noProcessChat = false, payload } = req.body;
  const currentSessionId = generateSessionId(sessionId);
  const timestamp = new Date().toISOString();

  if (!inputType || !payload) {
    return sendError(
      res,
      currentSessionId,
      "inputType and payload are required.",
    );
  }

  let response: any;
  let outputType: string | undefined;

  try {
    switch (inputType) {
      case "Normal Chat Message":
        response = await processNormalChat(payload);
        outputType = "Complete stream";
        break;

      case "Memory Request":
        response = await requestMemory();
        outputType = "Memory Array";
        break;

      case "RPC Webhook":
        response = `${JSON.stringify(logs)}`;
        outputType = "Webhook";
        break;

      case "Twitter Message":
      case "Brain Message":
        response = payload; // Direct return
        outputType = "Text";
        break;

      case "Reasoning Server":
        outputType = "Action Triggered";
        response = await triggerAmicaActions(payload);
        break;

      default:
        return sendError(res, currentSessionId, "Unknown input type.");
    }

    logs.push({
      sessionId: currentSessionId,
      timestamp,
      inputType,
      outputType,
      response,
    });
    res.status(200).json({ sessionId: currentSessionId, outputType, response });
  } catch (error) {
    console.error("Handler error:", error);
    logs.push({
      sessionId: currentSessionId,
      timestamp,
      inputType,
      outputType: "Error",
      error: String(error),
    });
    return sendError(
      res,
      currentSessionId,
      "An error occurred while processing the request.",
      500,
    );
  }
}

// Function to process Normal Chat Message
async function processNormalChat(message: string): Promise<string> {
  return await askLLM(config("system_prompt"), message, null);
}

async function requestMemory(): Promise<TimestampedPrompt[]> {
  const data = await fetch(dataHandlerUrl);
  const currentStoredSubconscious: TimestampedPrompt[] = await data.json();
  return currentStoredSubconscious;
}

// Function to trigger actions based on Reasoning Server flags
async function triggerAmicaActions(payload: any) {
  const { text, playback, reprocess, socialMedia, animation } = payload;

  // Initialize response
  let response;

  // Check if 'text' is provided for social media posting
  if (text) {
    // Handle reprocess if true
    let message = text;
    if (reprocess) {
        message = await processNormalChat(text);
    }
    switch (socialMedia) {
      case "twitter":
        response = await twitterClient.postTweet(message);
        break;

      case "tg":
        // Assuming there is a telegramClient available
        //   response = await telegramClient.sendMessage(text);
        break;

      default:
        console.log("No social media selected for posting.");
        response = "No action taken for social media.";
    }
  } 

  // Handle playback if true
  if (playback) {
    console.log("Triggering playback...");
    // Add playback logic here
  }

  // Handle animation if provided
  if (animation) {
    console.log(`Triggering animation: ${animation}`);
    // Add animation handling logic here
  }

  return response;
}
