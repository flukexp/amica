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

let clients: any[] = []; // This stores all the connected clients (for broadcasting)

// Function to send structured data to all connected clients
const sendToClients = (message: { type: string; data: any }) => {
    const formattedMessage = JSON.stringify(message);
    clients.forEach((client) => {
      client.res.write(`data: ${formattedMessage}\n\n`);
    });
  };
  

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

  // Handle GET requests to establish the SSE connection
  if (req.method === 'GET') {
    // Set the necessary SSE headers for the response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buferring', 'no');
    res.setHeader('Connection', 'keep-alive');

    // Save the client connection (useful if broadcasting is needed)
    const client = { res };
    clients.push(client);

    // Clean up and close the connection if the client disconnects
    req.on('close', () => {
      console.log('Client disconnected');
      clients = clients.filter((client) => client.res !== res); // Remove disconnected client from the list
      res.end(); // Close the SSE connection properly
    });

    return; // End the function here to prevent further execution
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
        response = await triggerAmicaActions(req, res, payload);
        outputType = "Action Triggered";
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
async function triggerAmicaActions(req: NextApiRequest, res: NextApiResponse, payload: any) {
    const { text, socialMedia, playback, reprocess, animation } = payload;
    let response;
  
    if (text) {
      // Process text if reprocess is true
      let message = text;
      if (reprocess) {
        message = await askLLM(config("system_prompt"), text, null);
      }
  
      // Handle social media actions
      switch (socialMedia) {
        case "twitter":
          response = await twitterClient.postTweet(message);
          break;
        case "tg":
          response = "Telegram response placeholder"; // Adjust as needed
          break;
        case "none":
          response = sendToClients({type: "normal", data : message});
          break;
        default:
          console.log("No social media selected for posting.");
          response = "No action taken for social media.";
      }
    }
  
    // Handle playback if true, data = time in ms.
    if (playback) {
        response = sendToClients({type: "playback", data : 10000})
    }

    // Handle animation if provided
    if (animation) {
        response = sendToClients({type: "animation", data : animation})
    }

    return response;
  }
