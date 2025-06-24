#!/usr/bin/env bun
import sharp from 'sharp';
import toIco from 'sharp-ico';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateFavicon() {
  const inputPath = path.join(__dirname, '..', 'favicon.png');
  const outputPath = path.join(__dirname, '..', 'static', 'favicon.ico');
  
  try {
    // Ensure static directory exists
    const staticDir = path.dirname(outputPath);
    if (!fs.existsSync(staticDir)) {
      fs.mkdirSync(staticDir, { recursive: true });
    }

    // Read the PNG file
    const pngBuffer = await sharp(inputPath)
      .resize(32, 32) // Standard favicon size
      .toBuffer();

    // Convert to ICO format
    const icoBuffer = await toIco.encode([pngBuffer]);
    
    // Write the ICO file
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log('✓ Generated favicon.ico');
  } catch (error) {
    console.error('Error generating favicon:', error);
    process.exit(1);
  }
}

generateFavicon();