import { describe, it, expect } from 'vitest';
import { toolTemplates } from '../app/renderer/src/data/toolTemplates.js';

describe('Tool Templates', () => {
  it('should export an array of templates', () => {
    expect(Array.isArray(toolTemplates)).toBe(true);
    expect(toolTemplates.length).toBeGreaterThan(0);
  });

  it('should have required properties for each template', () => {
    toolTemplates.forEach(template => {
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('iconPath');
      expect(template).toHaveProperty('isLocal');
      
      expect(typeof template.id).toBe('string');
      expect(typeof template.name).toBe('string');
      expect(typeof template.isLocal).toBe('boolean');
    });
  });

  it('should have unique IDs', () => {
    const ids = toolTemplates.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid URL properties for online tools', () => {
    toolTemplates
      .filter(t => !t.isLocal)
      .forEach(template => {
        if (template.appUrl) {
          expect(template.appUrl).toMatch(/^https?:\/\//);
        }
        if (template.docsUrl) {
          expect(template.docsUrl).toMatch(/^https?:\/\//);
        }
      });
  });

  it('should have known templates', () => {
    const templateIds = toolTemplates.map(t => t.id);
    
    expect(templateIds).toContain('chatgpt');
    expect(templateIds).toContain('novelai');
    expect(templateIds).toContain('t3chat');
    expect(templateIds).toContain('characterai');
    expect(templateIds).toContain('ElevenLabs');
  });

  it('should have descriptions for templates', () => {
    toolTemplates.forEach(template => {
      expect(template).toHaveProperty('description');
      expect(typeof template.description).toBe('string');
      expect(template.description.length).toBeGreaterThan(0);
    });
  });

  it('should have correct isLocal value', () => {
    toolTemplates.forEach(template => {
      expect(template.isLocal).toBe(false); // All current templates are online tools
    });
  });
});

