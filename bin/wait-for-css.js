#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const cssPath = resolve("static/index.css");
const maxAttempts = 60; // 60秒まで待つ
let attempts = 0;

console.log("Waiting for CSS build to complete...");

const checkInterval = setInterval(() => {
  attempts++;

  if (existsSync(cssPath)) {
    console.log("✓ CSS file found!");
    clearInterval(checkInterval);
    process.exit(0);
  }

  if (attempts >= maxAttempts) {
    console.error("✗ Timeout: CSS file was not generated within 60 seconds");
    clearInterval(checkInterval);
    process.exit(1);
  }

  if (attempts % 10 === 0) {
    console.log(`Still waiting... (${attempts}s)`);
  }
}, 1000);
