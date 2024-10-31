import { Chat } from '@/features/chat/chat';
import askLLM from '@/utils/askLlm';
import type { NextApiRequest, NextApiResponse } from 'next';

interface ApiResponse {
  outputType?: string;
  response?: string;
  error?: string;
}

const chat = Chat.getInstance();

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const apiEnabled = process.env.API_ENABLED === 'true';
  if (!apiEnabled) {
    return res.status(503).json({ error: "API is currently disabled." });
  }

  const { inputType, payload } = req.body as { inputType: string; payload: any };

  if (!inputType || !payload) {
    return res.status(400).json({ error: "inputType and payload are required." });
  }

  switch (inputType) {
    case "Normal Chat Message":
      // Process normally and stream response
      const result = await askLLM("Respond with emotional","Hello, Nice to meet you", null);
      return res.status(200).json({ outputType: "Complete stream", response: `Processed ChatMessage: ${result}` });

    case "Voice":
      // Transcribe voice input to words
      return res.json({ outputType: "Text", response: "Transcribed Voice into Words" });

    case "Twitter Message":
      // Skip processing, return as-is
      return res.json({ outputType: "Text", response: "Twitter Message received" });

    case "Brain Message":
      // Skip processing, return as-is
      return res.json({ outputType: "Text", response: "Brain Message received" });

    case "Image":
      // Process using Vision Model
      return res.json({ outputType: "Text", response: "Image transcribed into words" });

    case "Memory Request":
      // Return memory array from subconscious subroutines (placeholder for actual memory data)
      return res.json({ outputType: "Memory Array", response: "Memory data from subconscious subroutines" });

    case "RPC Webhook":
      // Send all outputs to the client requesting the webhook
      // Assuming a mocked function `sendToClient` for demonstration
      sendToClient({ output: `All outputs to client: ${JSON.stringify(payload)}` });
      return res.json({ outputType: "Webhook", response: "RPC webhook triggered" });

    case "Reasoning Server":
      // Trigger actions based on inputs from the reasoning server
      const { json, textStream, animation, normal, tg, twitter } = payload;
      // Trigger AMICA to perform actions based on these flags (this would interface with AMICA directly)
      return res.json({ outputType: "Action Triggered", response: `Actions triggered with flags: ${JSON.stringify(payload)}` });

    default:
      return res.status(400).json({ error: "Unknown input type." });
  }
}

// Mock function to simulate sending data to client in case of a webhook
function sendToClient(data: { output: string }) {
  // In a real implementation, this would handle sending data to a client via webhook, WebSocket, etc.
  console.log("Sending data to client:", data.output);
}
