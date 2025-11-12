// Pre-bundled tool templates
// Icons are located in: app/renderer/src/assets/templates/icons/

import chatgptIcon from '../assets/templates/icons/chatgpt.png';
import novelaiIcon from '../assets/templates/icons/novelai.png';
import t3chatIcon from '../assets/templates/icons/t3chat.png';
import characteraiIcon from '../assets/templates/icons/characterai.png';
import elevenlabsIcon from '../assets/templates/icons/elevenlabs.png';

export const toolTemplates = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    docsUrl: 'https://chatgpt.com/overview',
    appUrl: 'https://chatgpt.com/',
    iconPath: chatgptIcon,
    isLocal: false,
    description: 'OpenAI ChatGPT - AI conversational assistant'
  },
  {
    id: 't3chat',
    name: 't3 chat',
    docsUrl: 'https://t3.gg/',
    appUrl: 'https://t3.chat/',
    iconPath: t3chatIcon,
    isLocal: false,
    description: 't3 chat - The best AI chat app ever made'
  },
  {
    id: 'novelai',
    name: 'NovelAI',
    docsUrl: 'https://docs.novelai.net/en',
    appUrl: 'https://novelai.net/login',
    iconPath: novelaiIcon,
    isLocal: false,
    description: 'NovelAI - AI-powered storytelling and image generation'
  },
  {
    id: 'characterai',
    name: 'CharacterAI',
    docsUrl: 'https://book.character.ai/',
    appUrl: 'https://character.ai/',
    iconPath: characteraiIcon,
    isLocal: false,
    description: 'CharacterAI - Chat with millions of AI Characters'
  },
  {
    id: 'ElevenLabs',
    name: 'ElevenLabs',
    docsUrl: 'https://elevenlabs.io/docs',
    appUrl: 'https://elevenlabs.io/',
    iconPath: elevenlabsIcon,
    isLocal: false,
    description: 'ElevenLabs - AI-powered voice generation'
  }
];

