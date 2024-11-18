import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { TimestampedPrompt } from '@/features/amicaLife/eventHandler';

// Define file paths
const configFilePath = path.resolve('config.json');
const subconsciousFilePath = path.resolve('src/features/amicaLife/subconscious.json');

// Utility functions for file operations
const readFile = (filePath: string): any => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file at ${filePath}:`, error);
    throw new Error(`Failed to read file: ${error}`);
  }
};

const writeFile = (filePath: string, content: any): void => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing file at ${filePath}:`, error);
    throw new Error(`Failed to write file: ${error}`);
  }
};

// Clear subconscious data on startup
writeFile(subconsciousFilePath, []);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type } = req.query;

  if (!['config', 'subconscious'].includes(type as string)) {
    return res.status(400).json({ error: 'Invalid type parameter. Use "config" or "subconscious."' });
  }

  switch (req.method) {
    case 'GET':
      return handleGetRequest(type as string, res);
    case 'POST':
      return handlePostRequest(type as string, req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Handlers
const handleGetRequest = (type: string, res: NextApiResponse) => {
  try {
    const filePath = type === 'config' ? configFilePath : subconsciousFilePath;
    const data = readFile(filePath);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error });
  }
};

const handlePostRequest = (type: string, req: NextApiRequest, res: NextApiResponse) => {
  const { body } = req;

  try {
    if (type === 'config') {
      updateConfig(body, res);
    } else {
      updateSubconscious(body, res);
    }
  } catch (error) {
    res.status(500).json({ error: error });
  }
};

// Sub-functions
const updateConfig = (body: any, res: NextApiResponse) => {
  const { key, value } = body;

  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Key and value are required to update the config.' });
  }

  const config = readFile(configFilePath);

  if (!config.hasOwnProperty(key)) {
    return res.status(400).json({ error: `Config key "${key}" not found.` });
  }

  config[key] = value;
  writeFile(configFilePath, config);
  res.status(200).json({ message: 'Config updated successfully.' });
};

const updateSubconscious = (body: any, res: NextApiResponse) => {
  const { subconscious } = body;

  if (!Array.isArray(subconscious)) {
    return res.status(400).json({ error: 'Subconscious data must be an array.' });
  }

  writeFile(subconsciousFilePath, subconscious);
  res.status(200).json({ message: 'Subconscious data updated successfully.' });
};
