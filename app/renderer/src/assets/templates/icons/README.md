# Template Icons

This folder contains icon images for pre-bundled tool templates.

## Adding Icons

To add an icon for a template:

1. Place the icon image file in this folder with the naming convention: `{template-id}.png`
   - Example: `chatgpt.png`, `claude.png`, `github.png`, etc.

2. Update `app/renderer/src/data/toolTemplates.js` to import and use the icon:
   ```javascript
   import chatgptIcon from '../assets/templates/icons/chatgpt_logo.png';
   
   {
     id: 'chatgpt',
     name: 'ChatGPT',
     iconPath: chatgptIcon, // Use the imported icon
     // ... other properties
   }
   ```

## Supported Formats

- PNG (recommended)
- SVG
- JPG/JPEG
- WebP

## Icon Specifications

- Recommended size: 64x64px or 128x128px
- Format: Square aspect ratio works best
- Background: Transparent PNGs are preferred

