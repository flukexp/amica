import { askLLM } from '@/utils/askLlm';
import { TimestampedPrompt } from '@/features/amicaLife/eventHandler';

import { randomBytes } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

interface ApiResponse {
  sessionId?: string;
  outputType?: string;
  response?: string | TimestampedPrompt[] | LogEntry[];
  error?: string;
}

interface LogEntry {
    sessionId: string;
    timestamp: string;
    inputType: string;
    outputType: string;
    response?: string | TimestampedPrompt[] | LogEntry[];
    error?: string;
  }
  
export const logs: LogEntry[] = [];

const generateSessionId = (sessionId?: string) => sessionId || randomBytes(8).toString('hex');

// Helper for setting error responses
const sendError = (res: NextApiResponse<ApiResponse>, sessionId: string, message: string, status = 400) => 
  res.status(status).json({ sessionId, error: message });

let dataHandlerUrl = new URL("http://localhost:3000/api/dataHandler");
dataHandlerUrl.searchParams.append('type', 'subconscious');

// Main API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (process.env.API_ENABLED !== 'true') {
    return sendError(res, "", "API is currently disabled.", 503);
  }

  const { sessionId, inputType, noProcessChat = false, payload } = req.body;
  const currentSessionId = generateSessionId(sessionId);
  const timestamp = new Date().toISOString();

  if (!inputType || !payload) {
    return sendError(res, currentSessionId, "inputType and payload are required.");
  }

  let response: string | undefined | TimestampedPrompt[] | LogEntry[];
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
        triggerAmicaActions(payload);
        outputType = "Action Triggered";
        response = `Actions triggered with flags: ${JSON.stringify(payload)}`;
        break;

      default:
        return sendError(res, currentSessionId, "Unknown input type.");
    }

    logs.push({ sessionId: currentSessionId, timestamp, inputType, outputType, response });
    res.status(200).json({ sessionId: currentSessionId, outputType, response });
  } catch (error) {
    console.error("Handler error:", error);
    logs.push({ sessionId: currentSessionId, timestamp, inputType, outputType: "Error", error: String(error) });
    return sendError(res, currentSessionId, "An error occurred while processing the request.", 500);
  }
}

// Function to process Normal Chat Message
async function processNormalChat(message: string): Promise<string> {
  return await askLLM("Respond with emotional", message, null);
}

async function requestMemory(): Promise<TimestampedPrompt[]> {
    const data = await fetch(dataHandlerUrl);
    const currentStoredSubconscious: TimestampedPrompt[] = await data.json();
    return currentStoredSubconscious;
}

// Function to trigger actions based on Reasoning Server flags
function triggerAmicaActions(payload: any) {
  const { json, textStream, animation, normal, tg, twitter } = payload;
  logs.push({
    sessionId: "Action-Log",
    timestamp: new Date().toISOString(),
    inputType: "Reasoning Server",
    outputType: "Action Log",
    response: `Triggering actions with flags: ${JSON.stringify({ json, textStream, animation, normal, tg, twitter })}`,
  });
}

