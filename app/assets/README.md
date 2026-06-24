# Assets Folder

This folder contains the app's visual assets. You need to add the following images:

## Required Images

### 1. icon.png
- **Size**: 1024x1024 pixels
- **Format**: PNG
- **Purpose**: App icon for iOS and Android
- **Design**: Should feature the Zenvest logo with a clean, modern design

### 2. splash.png
- **Size**: 1284x2778 pixels (for iPhone X and later)
- **Format**: PNG
- **Purpose**: Splash screen for iOS
- **Design**: Should feature the Zenvest logo on a white or colored background

### 3. adaptive-icon.png
- **Size**: 1024x1024 pixels
- **Format**: PNG
- **Purpose**: Adaptive icon for Android
- **Design**: Should be a simple version of the logo that works within the safe zone

### 4. favicon.png
- **Size**: 48x48 pixels
- **Format**: PNG
- **Purpose**: Favicon for web version
- **Design**: Small version of the logo

## Design Guidelines

- Use the Zenvest brand colors:
  - Primary: #4F46E5 (Indigo)
  - Secondary: #10B981 (Emerald)
  - Accent: #F59E0B (Amber)
  - Background: #FFFFFF (White)
  - Surface: #F9FAFB (Light Gray)

- Keep the design clean and modern
- Ensure good contrast and readability
- Follow platform-specific design guidelines (iOS Human Interface Guidelines, Android Material Design)

## Temporary Solution

For development purposes, you can use placeholder images or the Expo default assets. The app will work without these assets, but they should be added before production deployment.

## How to Add Assets

1. Create or obtain the images with the specifications above
2. Place them in this `assets` folder
3. The Expo build process will automatically use these assets

Alternatively, you can use Expo's online asset generator:
https://icon.expo.fun/

This tool can generate all required assets from a single source image.
