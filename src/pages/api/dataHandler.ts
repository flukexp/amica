import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { TimestampedPrompt } from '@/features/amicaLife/eventHandler';

// Define paths for config and subconscious files
const configFilePath = path.resolve('config.json');
const subconsciousFilePath = path.resolve('src/features/amicaLife/subconscious.json');

// Clear the subconscious.json file by overwriting it with an empty array
fs.writeFileSync(subconsciousFilePath, JSON.stringify([]), 'utf8');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle requests to both config and subconscious data
  const { type } = req.query; // Expecting `type` parameter to determine which file to operate on

  if (req.method === 'GET') {
    if (type === 'config') {
      try {
        const data = fs.readFileSync(configFilePath, 'utf8');
        const config = JSON.parse(data);
        res.status(200).json(config);
      } catch (error) {
        console.error('Failed to load config:', error);
        res.status(500).json({ error: 'Failed to load config' });
      }
    } else if (type === 'subconscious') {
      try {
        const data = fs.readFileSync(subconsciousFilePath, 'utf8');
        const subconscious: TimestampedPrompt[] = JSON.parse(data);
        res.status(200).json(subconscious);
      } catch (error) {
        console.error('Failed to load subconscious data:', error);
        res.status(500).json({ error: 'Failed to load subconscious data' });
      }
    } else {
      res.status(400).json({ error: 'Invalid type parameter. Use "config" or "subconscious."' });
    }
  } else if (req.method === 'POST') {
    if (type === 'config') {
      const { key, value } = req.body;
      try {
        // Read the existing config
        const data = fs.readFileSync(configFilePath, 'utf8');
        const config = JSON.parse(data);

        // Update the config with the new key-value pair
        if (config.hasOwnProperty(key)) {
          config[key] = value;

          // Write the updated config back to the file
          fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
          res.status(200).json({ message: 'Config updated successfully' });
        } else {
          res.status(400).json({ error: `Config key "${key}" not found` });
        }
      } catch (error) {
        console.error('Failed to update config:', error);
        res.status(500).json({ error: 'Failed to update config' });
      }
    } else if (type === 'subconscious') {
      const { subconscious } = req.body;
      try {
        // Write the updated subconscious data back to the file
        fs.writeFileSync(subconsciousFilePath, JSON.stringify(subconscious, null, 2));
        res.status(200).json({ message: 'Subconscious data updated successfully' })
      } catch (error) {
        console.error('Failed to update subconscious data:', error);
        res.status(500).json({ error: 'Failed to update subconscious data' });
      }
    } else {
      res.status(400).json({ error: 'Invalid type parameter. Use "config" or "subconscious."' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
