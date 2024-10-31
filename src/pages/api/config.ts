import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const configFilePath = path.resolve('config.json');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const data = fs.readFileSync(configFilePath, 'utf8');
      const config = JSON.parse(data);
      res.status(200).json(config);
    } catch (error) {
      console.error('Failed to load config:', error);
      res.status(500).json({ error: 'Failed to load config' });
    }
  } else if (req.method === 'POST') {
    try {
      const { key, value } = req.body;

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
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
