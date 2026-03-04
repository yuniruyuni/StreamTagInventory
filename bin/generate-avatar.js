#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateAvatar() {
  const inputPath = path.join(__dirname, "..", "yuniruyuni.png");
  const outputPath = path.join(__dirname, "..", "static", "yuniruyuni.webp");

  try {
    // Ensure static directory exists
    const staticDir = path.dirname(outputPath);
    if (!fs.existsSync(staticDir)) {
      fs.mkdirSync(staticDir, { recursive: true });
    }

    // Resize to 128x128 and convert to WebP
    await sharp(inputPath)
      .resize(128, 128)
      .webp({ quality: 80 })
      .toFile(outputPath);

    console.log("✓ Generated yuniruyuni.webp");
  } catch (error) {
    console.error("Error generating avatar:", error);
    process.exit(1);
  }
}

generateAvatar();
