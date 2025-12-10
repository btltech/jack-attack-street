#!/usr/bin/env node
/**
 * Icon Generation Script for Ayò Ọlọ́pọ́n
 * 
 * This script helps generate PNG icons from SVG sources.
 * 
 * Prerequisites:
 *   npm install sharp
 * 
 * Or use online converters:
 *   - https://cloudconvert.com/svg-to-png
 *   - https://www.iloveimg.com/resize-image/resize-svg
 * 
 * Required output files:
 * 
 * PWA Icons (place in public/):
 *   - icon-192.png (192x192)
 *   - icon-512.png (512x512)
 *   - apple-touch-icon.png (180x180)
 *   - favicon.ico (32x32)
 * 
 * iOS App Icons (if using React Native):
 *   - Icon-20.png, Icon-20@2x.png, Icon-20@3x.png
 *   - Icon-29.png, Icon-29@2x.png, Icon-29@3x.png
 *   - Icon-40.png, Icon-40@2x.png, Icon-40@3x.png
 *   - Icon-60@2x.png, Icon-60@3x.png
 *   - Icon-76.png, Icon-76@2x.png
 *   - Icon-83.5@2x.png
 *   - Icon-1024.png (App Store)
 * 
 * Android App Icons (if using React Native):
 *   - mipmap-mdpi/ic_launcher.png (48x48)
 *   - mipmap-hdpi/ic_launcher.png (72x72)
 *   - mipmap-xhdpi/ic_launcher.png (96x96)
 *   - mipmap-xxhdpi/ic_launcher.png (144x144)
 *   - mipmap-xxxhdpi/ic_launcher.png (192x192)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if sharp is available
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.log('Sharp not installed. Install with: npm install sharp');
  console.log('Or use the SVG files directly / convert online.');
  process.exit(0);
}

const sizes = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon.png': 180,
  'favicon-32.png': 32,
  'favicon-16.png': 16,
};

const sourceFile = path.join(__dirname, 'icon.svg');
const outputDir = __dirname;

async function generateIcons() {
  console.log('Generating PNG icons from SVG...\n');
  
  for (const [filename, size] of Object.entries(sizes)) {
    try {
      await sharp(sourceFile)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, filename));
      console.log(`✓ Generated ${filename} (${size}x${size})`);
    } catch (err) {
      console.error(`✗ Failed to generate ${filename}:`, err.message);
    }
  }
  
  console.log('\nDone! Icons generated in public/ folder.');
}

generateIcons();
