import { openaiWhisper } from '@/features/openaiWhisper/openaiWhisper';
import { whispercpp } from '@/features/whispercpp/whispercpp';
import { askVisionLLM, askLLM } from '@/utils/askLlm';
import { storedSubconcious, TimestampedPrompt } from '@/features/amicaLife/eventHandler';
import { config } from '@/utils/config';

import { randomBytes } from 'crypto';
import sharp from 'sharp';
import type { NextApiRequest, NextApiResponse } from 'next';

interface ApiResponse {
  sessionId?: string;
  outputType?: string;
  response?: string | TimestampedPrompt[];
  error?: string;
}

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

  if (!inputType || !payload) {
    return sendError(res, currentSessionId, "inputType and payload are required.");
  }

  let response: string | undefined | TimestampedPrompt[];
  let outputType: string | undefined;

  try {
    switch (inputType) {
      case "Normal Chat Message":
        response = await processNormalChat(payload);
        outputType = "Complete stream";
        break;

      case "Voice":
        response = await transcribeVoice(payload);
        outputType = "Text";
        break;

      case "Twitter Message":
      case "Brain Message":
        response = payload; // Direct return
        outputType = "Text";
        break;

      case "Image":
        response = await processImage(payload);
        outputType = "Text";
        break;

      case "Memory Request":
        response = await requestMemory();
        outputType = "Memory Array";
        break;

      case "RPC Webhook":
        sendToClient({ output: `All outputs to client: ${JSON.stringify(payload)}` });
        outputType = "Webhook";
        response = "RPC webhook triggered";
        break;

      case "Reasoning Server":
        triggerAmicaActions(payload);
        outputType = "Action Triggered";
        response = `Actions triggered with flags: ${JSON.stringify(payload)}`;
        break;

      default:
        return sendError(res, currentSessionId, "Unknown input type.");
    }

    res.status(200).json({ sessionId: currentSessionId, outputType, response });
  } catch (error) {
    console.error("Handler error:", error);
    return sendError(res, currentSessionId, "An error occurred while processing the request.", 500);
  }
}

// Function to process Normal Chat Message
async function processNormalChat(message: string): Promise<string> {
  return await askLLM("Respond with emotional", message, null);
}

// Transcribe voice input to text
async function transcribeVoice(audio: File): Promise<string> {
    try {
      switch (config("stt_backend")) {
        case 'whisper_openai': {
          const result = await openaiWhisper(audio);
          return result?.text; // Assuming the transcription is in result.text
        }
        case 'whispercpp': {
          const result = await whispercpp(audio);
          return result?.text; // Assuming the transcription is in result.text
        }
        default:
          throw new Error("Invalid STT backend configuration.");
      }
    } catch (error) {
      console.error("Transcription error:", error);
      throw new Error("Failed to transcribe audio.");
    }
}
  

// Process image using Vision LLM
async function processImage(payload: any): Promise<string> {
  const jpegImg = await convertToJpeg(payload);
  if (!jpegImg) throw new Error("Failed to process image");
  return await askVisionLLM(jpegImg);
}

// Convert image to JPEG and return as base64
async function convertToJpeg(payload: any): Promise<string | null> {
  try {
    const jpegBuffer = await sharp(payload).jpeg().toBuffer();
    return jpegBuffer.toString('base64');
  } catch (error) {
    console.error("Error converting image to .jpeg:", error);
    return null;
  }
}

async function requestMemory(): Promise<TimestampedPrompt[]> {
    const data = await fetch(dataHandlerUrl);
    const currentStoredSubconscious: TimestampedPrompt[] = await data.json();
    return currentStoredSubconscious;
}

// Mock function to simulate sending data to client in case of a webhook
function sendToClient(data: { output: string }) {
  console.log("Sending data to client:", data.output);
}

// Function to trigger actions based on Reasoning Server flags
function triggerAmicaActions(payload: any) {
  const { json, textStream, animation, normal, tg, twitter } = payload;
  console.log(`Triggering actions with flags: ${JSON.stringify({ json, textStream, animation, normal, tg, twitter })}`);
}


