import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import { getDb } from './db.js';

export function registerIpcHandlers() {
  const db = getDb();
  function notifyAllRecentChanged() {
    for (const win of BrowserWindow.getAllWindows()) {
      try { win.webContents.send('recent:changed'); } catch {}
    }
  }

  function notifyAllToolsChanged() {
    for (const win of BrowserWindow.getAllWindows()) {
      try { win.webContents.send('tools:changed'); } catch {}
    }
  }

  ipcMain.handle('tools:list', () => {
    const rows = db
      .prepare(
        `SELECT id, name, docs_url AS docsUrl, app_url AS appUrl, exec_path AS execPath, icon_path AS iconPath, images_folder AS imagesFolder, files_folder AS filesFolder, created_at AS createdAt, updated_at AS updatedAt, settings_json AS settingsJson FROM tools ORDER BY name`
      )
      .all();
    return rows;
  });

  ipcMain.handle('tools:create', (_evt, input) => {
    const stmt = db.prepare(
      `INSERT INTO tools (name, docs_url, app_url, exec_path, icon_path, images_folder, files_folder, settings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(
      input.name,
      input.docsUrl ?? null,
      input.appUrl ?? null,
      input.execPath ?? null,
      input.iconPath ?? null,
      input.imagesFolder ?? null,
      input.filesFolder ?? null,
      input.settings ? JSON.stringify(input.settings) : null
    );
    notifyAllToolsChanged();
    return { id: Number(info.lastInsertRowid) };
  });

  ipcMain.handle('tools:update', (_evt, id, input) => {
    const row = db.prepare(`SELECT * FROM tools WHERE id = ?`).get(id);
    if (!row) throw new Error('Tool not found');
    const merged = {
      name: input.name ?? row.name,
      docsUrl: input.docsUrl ?? row.docs_url,
      appUrl: input.appUrl ?? row.app_url,
      execPath: input.execPath ?? row.exec_path,
      iconPath: input.iconPath ?? row.icon_path,
      imagesFolder: input.imagesFolder ?? row.images_folder,
      filesFolder: input.filesFolder ?? row.files_folder,
      settingsJson: input.settings ? JSON.stringify(input.settings) : row.settings_json
    };
    db.prepare(
      `UPDATE tools SET name=?, docs_url=?, app_url=?, exec_path=?, icon_path=?, images_folder=?, files_folder=?, settings_json=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      merged.name,
      merged.docsUrl,
      merged.appUrl,
      merged.execPath,
      merged.iconPath,
      merged.imagesFolder,
      merged.filesFolder,
      merged.settingsJson,
      id
    );
    notifyAllToolsChanged();
    return { ok: true };
  });

  ipcMain.handle('tools:delete', (_evt, id) => {
    db.prepare(`DELETE FROM tools WHERE id = ?`).run(id);
    notifyAllToolsChanged();
    return { ok: true };
  });

  ipcMain.handle('open:url', (_evt, url) => {
    shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('open:selectFolder', async (evt, options) => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      defaultPath: options?.defaultPath
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('open:selectFile', async (evt, options) => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      defaultPath: options?.defaultPath,
      filters: options?.filters || []
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('file:readAsDataUrl', async (_evt, filePath) => {
    try {
      const fs = await import('node:fs/promises');
      const buffer = await fs.readFile(filePath);
      const base64 = buffer.toString('base64');
      // Detect mime type from extension
      const ext = filePath.split('.').pop().toLowerCase();
      const mimeMap = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        webp: 'image/webp'
      };
      const mime = mimeMap[ext] || 'image/png';
      return `data:${mime};base64,${base64}`;
    } catch (e) {
      console.error('Failed to read image file:', e);
      return null;
    }
  });

  // Save a template icon from data URL to user data directory
  ipcMain.handle('file:saveTemplateIcon', async (_evt, dataUrl, templateId) => {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      
      // Parse data URL (handles optional charset parameter)
      const matches = dataUrl.match(/^data:([^;]+)(?:;[^;]+)*;base64,(.+)$/);
      if (!matches) throw new Error('Invalid data URL format');
      
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Determine file extension from mime type
      const extMap = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/svg+xml': 'svg',
        'image/webp': 'webp',
        'image/x-icon': 'ico'
      };
      const ext = extMap[mimeType] || 'png';
      
      // Save to user data directory
      const userData = app.getPath('userData');
      const iconsDir = path.join(userData, 'template-icons');
      await fs.mkdir(iconsDir, { recursive: true });
      
      // Use template ID and timestamp to ensure uniqueness
      const fileName = `${templateId}-${Date.now()}.${ext}`;
      const filePath = path.join(iconsDir, fileName);
      
      await fs.writeFile(filePath, buffer);
      return filePath;
    } catch (e) {
      console.error('Failed to save template icon:', e);
      throw e;
    }
  });

  // Prompts CRUD
  ipcMain.handle('prompts:list', (_evt, toolId) => {
    const rows = db
      .prepare(
        `SELECT id, tool_id AS toolId, title, content, tags, history_json AS historyJson, created_at AS createdAt, updated_at AS updatedAt FROM prompts WHERE tool_id = ? ORDER BY updated_at DESC`
      )
      .all(toolId);
    return rows;
  });

  ipcMain.handle('prompts:create', (_evt, toolId, { title, content, tags }) => {
    const info = db
      .prepare(
        `INSERT INTO prompts (tool_id, title, content, tags, history_json) VALUES (?, ?, ?, ?, NULL)`
      )
      .run(toolId, title, content, tags ?? null);
    return { id: Number(info.lastInsertRowid) };
  });

  ipcMain.handle('prompts:update', (_evt, id, { title, content, tags }) => {
    const row = db.prepare(`SELECT * FROM prompts WHERE id = ?`).get(id);
    if (!row) throw new Error('Prompt not found');
    db.prepare(
      `UPDATE prompts SET title = ?, content = ?, tags = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(title ?? row.title, content ?? row.content, tags ?? row.tags, id);
    notifyAllRecentChanged();
    return { ok: true };
  });

  ipcMain.handle('prompts:delete', (_evt, id) => {
    db.prepare(`DELETE FROM prompts WHERE id = ?`).run(id);
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Prompts: export as JSON
  ipcMain.handle('prompts:exportAsJson', (_evt, toolId) => {
    const rows = db
      .prepare(
        `SELECT id, tool_id AS toolId, title, content, tags, history_json AS historyJson, created_at AS createdAt, updated_at AS updatedAt FROM prompts WHERE tool_id = ? ORDER BY updated_at DESC`
      )
      .all(toolId);
    return JSON.stringify(rows, null, 2);
  });

  // Launch local executable or open site, also record recent usage of tool
  ipcMain.handle('tools:open', async (_evt, toolId) => {
    const tool = db.prepare(`SELECT * FROM tools WHERE id = ?`).get(toolId);
    if (!tool) {
      console.error(`Tool not found with ID: ${toolId}`);
      throw new Error('Tool not found');
    }
    console.log(`Opening tool ID ${toolId}: exec_path="${tool.exec_path}", app_url="${tool.app_url}"`);
    if (tool.exec_path) {
      try {
        const fs = await import('node:fs/promises');
        const pathMod = await import('node:path');
        // Verify the file exists first
        await fs.access(tool.exec_path);
        console.log(`Launching executable: ${tool.exec_path}`);
        
        const isWindows = process.platform === 'win32';
        const ext = pathMod.extname(tool.exec_path).toLowerCase();
        
        let child;
        if (isWindows && (ext === '.bat' || ext === '.cmd')) {
          // For .bat and .cmd files on Windows, use cmd.exe to run them
          const cmdPath = process.env.COMSPEC || 'cmd.exe';
          child = spawn(cmdPath, ['/c', tool.exec_path], {
            detached: true,
            stdio: 'ignore',
            cwd: pathMod.dirname(tool.exec_path)
          });
        } else {
          // For executables and other files
          child = spawn(tool.exec_path, [], {
            detached: true,
            stdio: 'ignore',
            shell: isWindows && ext === '.exe', // Use shell for .exe on Windows if needed
            cwd: pathMod.dirname(tool.exec_path)
          });
        }
        
        // Handle errors from the spawned process
        child.on('error', (error) => {
          console.error(`Failed to spawn executable: ${error.message}`);
        });
        
        // Wait a moment to see if an error event fires
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            clearTimeout(timeout);
            child.removeAllListeners('error');
            resolve();
          }, 100);
          
          child.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
        
        child.unref();
        console.log(`Successfully launched: ${tool.exec_path}`);
      } catch (e) {
        console.error(`Failed to launch executable: ${e.message}`);
        throw new Error(`Failed to launch executable: ${e.message}`);
      }
    } else if (tool.app_url) {
      console.log(`Opening URL: ${tool.app_url}`);
      shell.openExternal(tool.app_url);
    } else {
      console.error(`No exec_path or app_url for tool ID ${toolId}`);
      throw new Error('No execPath or appUrl configured');
    }
    db.prepare(
      `INSERT INTO recent (kind, ref_id, last_used_at) VALUES ('tool', ?, datetime('now'))`
    ).run(toolId);
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Images: get by ID
  ipcMain.handle('images:getById', async (_evt, imageId) => {
    const image = db.prepare(`SELECT * FROM images WHERE id = ?`).get(imageId);
    if (!image) return null;
    const tool = db.prepare(`SELECT images_folder FROM tools WHERE id = ?`).get(image.tool_id);
    if (!tool) return null;
    
    const pathMod = await import('node:path');
    const relativePath = pathMod.relative(tool.images_folder, image.path);
    const folderPath = pathMod.dirname(relativePath);
    
    return {
      id: image.id,
      path: image.path,
      name: pathMod.basename(image.path),
      folderPath: folderPath === '.' ? '' : folderPath.replace(/\\/g, '/')
    };
  });

  // Images: scan folder and sync with DB (recursive)
  ipcMain.handle('images:scan', async (_evt, toolId, subPath = '') => {
    const tool = db.prepare(`SELECT * FROM tools WHERE id = ?`).get(toolId);
    if (!tool || !tool.images_folder) throw new Error('No images folder configured');
    
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    
    const currentPath = path.join(tool.images_folder, subPath);
    
    // Security check: ensure we're still within the images folder
    if (!currentPath.startsWith(tool.images_folder)) {
      throw new Error('Invalid path: attempted to access outside images folder');
    }
    
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      const folders = [];
      const images = [];
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(tool.images_folder, fullPath);
        
        if (entry.isDirectory()) {
          folders.push({
            name: entry.name,
            path: relativePath,
            isFolder: true
          });
        } else if (entry.isFile() && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(entry.name)) {
          const stats = await fs.stat(fullPath);
          
          // Check if already in DB
          let dbImage = db.prepare(`SELECT * FROM images WHERE tool_id = ? AND path = ?`).get(toolId, fullPath);
          
          if (!dbImage) {
            // Add to DB
            const info = db.prepare(`INSERT INTO images (tool_id, path, thumbnail_path, metadata_json) VALUES (?, ?, NULL, NULL)`).run(toolId, fullPath);
            dbImage = { id: Number(info.lastInsertRowid), tool_id: toolId, path: fullPath, thumbnail_path: null, metadata_json: null, tags: null, added_at: new Date().toISOString() };
          }
          
          images.push({
            id: dbImage.id,
            path: fullPath,
            name: entry.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            thumbnailPath: dbImage.thumbnail_path,
            metadata: dbImage.metadata_json ? JSON.parse(dbImage.metadata_json) : null,
            tags: dbImage.tags
          });
        }
      }
      
      return { folders, images, currentPath: subPath };
    } catch (e) {
      console.error('Failed to scan images folder:', e);
      throw new Error('Failed to scan images folder: ' + e.message);
    }
  });

  // Images: generate and cache thumbnail
  ipcMain.handle('images:getThumbnail', async (_evt, imagePath, imageId) => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const sharp = (await import('sharp')).default;
    
    const userData = app.getPath('userData');
    const thumbsDir = path.join(userData, 'thumbnails');
    await fs.mkdir(thumbsDir, { recursive: true });
    
    const thumbPath = path.join(thumbsDir, `thumb_${imageId}.jpg`);
    
    try {
      // Check if thumbnail exists
      await fs.access(thumbPath);
      // Read and return as base64
      const buffer = await fs.readFile(thumbPath);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (e) {
      // Generate thumbnail
      try {
        await sharp(imagePath)
          .resize(400, 300, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
        
        const buffer = await fs.readFile(thumbPath);
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
      } catch (err) {
        console.error('Failed to generate thumbnail:', err);
        return null;
      }
    }
  });

  // Images: read metadata (including AI metadata)
  ipcMain.handle('images:readMetadata', async (_evt, imagePath) => {
    try {
      const ExifReader = (await import('exifreader')).default;
      const fs = await import('node:fs/promises');
      const buffer = await fs.readFile(imagePath);
      const tags = ExifReader.load(buffer.buffer, { expanded: true });
      
      const metadata = {};

      // Helper function to normalize software names
      function normalizeSoftware(software) {
        if (!software) return null;
        const lower = software.toLowerCase();
        if (lower.includes('automatic1111') || lower.includes('a1111')) {
          return 'Stable Diffusion WebUI (A1111)';
        }
        if (lower.includes('invokeai')) {
          return 'InvokeAI';
        }
        return software;
      }

      // Helper function to find case-insensitive key in object
      function findCaseInsensitiveKey(obj, targetKey) {
        if (!obj) return null;
        const lowerTarget = targetKey.toLowerCase();
        for (const key in obj) {
          if (key.toLowerCase() === lowerTarget) {
            return key;
          }
        }
        return null;
      }

      // Basic EXIF
      if (tags.exif?.Make) metadata.camera = tags.exif.Make.description;
      if (tags.exif?.Model) metadata.cameraModel = tags.exif.Model.description;
      if (tags.exif?.DateTime) metadata.dateTaken = tags.exif.DateTime.description;
      if (tags.file?.['Image Width']) metadata.width = tags.file['Image Width'].value;
      if (tags.file?.['Image Height']) metadata.height = tags.file['Image Height'].value;
      if (tags.exif?.Software) metadata.software = normalizeSoftware(tags.exif.Software.description);
      if (tags.exif?.Artist) metadata.artist = tags.exif.Artist.description;
      
      // AI Metadata parsing
      const aiMetadata = {};
      
      // Check PNG chunks (NovelAI, Stable Diffusion, etc.)
      if (tags.png) {
        // Store raw values for fallback
        if (tags.png.Description) aiMetadata.description = tags.png.Description.description;
        if (tags.png.Comment) aiMetadata.comment = tags.png.Comment.description;
        if (tags.png.Software) aiMetadata.software = normalizeSoftware(tags.png.Software.description);
        
        // Priority 1: Try to parse JSON from Comment (NovelAI format takes priority, then SD JSON format)
        if (tags.png.Comment) {
          try {
            const parsed = JSON.parse(tags.png.Comment.description);
            
            // NovelAI format (preferred)
            if (parsed.prompt) aiMetadata.prompt = parsed.prompt;
            if (parsed.uc) aiMetadata.negativePrompt = parsed.uc; // NovelAI uses "uc" for negative prompt
            if (parsed.steps) aiMetadata.steps = parsed.steps;
            if (parsed.sampler) aiMetadata.sampler = parsed.sampler;
            if (parsed.scale) aiMetadata.cfgScale = parsed.scale; // NovelAI uses "scale"
            if (parsed.seed) aiMetadata.seed = parsed.seed;
            
            // Also check for v4_negative_prompt (NovelAI v4 format)
            if (parsed.v4_negative_prompt?.caption?.base_caption) {
              aiMetadata.negativePrompt = parsed.v4_negative_prompt.caption.base_caption;
            }
            
            // Stable Diffusion JSON format (only fill if NovelAI didn't populate)
            if (!aiMetadata.negativePrompt && parsed.negative_prompt) aiMetadata.negativePrompt = parsed.negative_prompt;
            if (!aiMetadata.cfgScale && parsed.cfg_scale) aiMetadata.cfgScale = parsed.cfg_scale;
            if (!aiMetadata.model && parsed.model) aiMetadata.model = parsed.model;
            if (!aiMetadata.steps && parsed.steps) aiMetadata.steps = parsed.steps;
            if (!aiMetadata.sampler && parsed.sampler) aiMetadata.sampler = parsed.sampler;
            if (!aiMetadata.seed && parsed.seed) aiMetadata.seed = parsed.seed;
          } catch (e) {
            // Not JSON, might be plain text prompt - try parsing as text
            if (!aiMetadata.prompt) {
              const commentText = tags.png.Comment.description;
              parseTextMetadata(commentText, aiMetadata);
            }
          }
        }
        
        // Priority 2: Check SD "parameters" chunk (fill any fields NovelAI didn't populate)
        const parametersKey = findCaseInsensitiveKey(tags.png, 'parameters');
        if (parametersKey && tags.png[parametersKey]) {
          const parametersText = tags.png[parametersKey].description;
          // parseTextMetadata will only set fields that aren't already set
          parseTextMetadata(parametersText, aiMetadata);
        }
        
        // Priority 3: NovelAI/A1111 format in Description (only if no prompt found yet)
        if (tags.png.Description && !aiMetadata.prompt) {
          const desc = tags.png.Description.description;
          parseTextMetadata(desc, aiMetadata);
        }
      }
      
      // Helper function to parse text-based metadata
      function parseTextMetadata(text, target) {
        // Extract prompt (everything before "Negative prompt:" or generation params)
        const promptMatch = text.match(/^([\s\S]*?)(?:\nNegative prompt:|Negative prompt:|\nSteps:)/i);
        if (promptMatch && !target.prompt) target.prompt = promptMatch[1].trim();
        
        // Extract negative prompt
        const negMatch = text.match(/Negative prompt:\s*([\s\S]*?)(?:\nSteps:|Steps:|$)/i);
        if (negMatch && !target.negativePrompt) target.negativePrompt = negMatch[1].trim();
        
        // Extract generation parameters (only if not already set)
        const stepsMatch = text.match(/Steps:\s*(\d+)/i);
        if (stepsMatch && !target.steps) target.steps = stepsMatch[1];
        
        const samplerMatch = text.match(/(?:Sampler|Sampling method):\s*([^,\n]+)/i);
        if (samplerMatch && !target.sampler) target.sampler = samplerMatch[1].trim();
        
        const cfgMatch = text.match(/(?:CFG scale|CFG Scale|Scale):\s*([\d.]+)/i);
        if (cfgMatch && !target.cfgScale) target.cfgScale = cfgMatch[1];
        
        const seedMatch = text.match(/Seed:\s*(\d+)/i);
        if (seedMatch && !target.seed) target.seed = seedMatch[1];
        
        const modelMatch = text.match(/Model:\s*([^,\n]+)/i);
        if (modelMatch && !target.model) target.model = modelMatch[1].trim();
        
        // NovelAI specific: look for "Undesired content" as negative prompt alternative
        if (!target.negativePrompt) {
          const undesiredMatch = text.match(/Undesired content:\s*([\s\S]*?)(?:\n\w+:|$)/i);
          if (undesiredMatch) target.negativePrompt = undesiredMatch[1].trim();
        }
        
        // Stable Diffusion specific fields
        const sizeMatch = text.match(/(?:Size|Hires size):\s*(\d+x\d+)/i);
        if (sizeMatch && !target.size) {
          target.size = sizeMatch[1];
          // If width/height missing from EXIF, populate from parsed size
          if (!metadata.width || !metadata.height) {
            const [width, height] = sizeMatch[1].split('x').map(Number);
            if (width && height) {
              metadata.width = width;
              metadata.height = height;
            }
          }
        }
        
        const modelHashMatch = text.match(/Model hash:\s*([^\s,\n]+)/i);
        if (modelHashMatch && !target.modelHash) target.modelHash = modelHashMatch[1].trim();
        
        const vaeMatch = text.match(/VAE:\s*([^,\n]+)/i);
        if (vaeMatch && !target.vae) target.vae = vaeMatch[1].trim();
        
        const vaeHashMatch = text.match(/VAE hash:\s*([^\s,\n]+)/i);
        if (vaeHashMatch && !target.vaeHash) target.vaeHash = vaeHashMatch[1].trim();
        
        const clipSkipMatch = text.match(/Clip skip:\s*(\d+)/i);
        if (clipSkipMatch && !target.clipSkip) target.clipSkip = clipSkipMatch[1];
        
        const schedulerMatch = text.match(/(?:Scheduler|Schedule):\s*([^,\n]+)/i);
        if (schedulerMatch && !target.scheduler) target.scheduler = schedulerMatch[1].trim();
        
        const hiresUpscalerMatch = text.match(/Hires upscaler:\s*([^,\n]+)/i);
        if (hiresUpscalerMatch && !target.hiresUpscaler) target.hiresUpscaler = hiresUpscalerMatch[1].trim();
        
        const hiresStepsMatch = text.match(/Hires steps:\s*(\d+)/i);
        if (hiresStepsMatch && !target.hiresSteps) target.hiresSteps = hiresStepsMatch[1];
        
        const hiresUpscaleMatch = text.match(/Hires upscale:\s*([\d.]+)/i);
        if (hiresUpscaleMatch && !target.hiresUpscale) target.hiresUpscale = hiresUpscaleMatch[1];
        
        const denoisingStrengthMatch = text.match(/Denoising strength:\s*([\d.]+)/i);
        if (denoisingStrengthMatch && !target.denoisingStrength) target.denoisingStrength = denoisingStrengthMatch[1];
        
        const ensdMatch = text.match(/ENSD:\s*([^\s,\n]+)/i);
        if (ensdMatch && !target.ensd) target.ensd = ensdMatch[1].trim();
        
        // Collect Lora entries (may appear multiple times)
        const loraMatches = text.matchAll(/Lora:\s*([^,\n]+)/gi);
        if (loraMatches) {
          const loras = Array.from(loraMatches).map(m => m[1].trim());
          if (loras.length > 0 && !target.loras) {
            target.loras = loras.length === 1 ? loras[0] : loras;
          }
        }
        
        const loraHashesMatch = text.match(/Lora hashes:\s*([^\n]+)/i);
        if (loraHashesMatch && !target.loraHashes) target.loraHashes = loraHashesMatch[1].trim();
        
        const tiHashesMatch = text.match(/TI hashes:\s*([^\n]+)/i);
        if (tiHashesMatch && !target.tiHashes) target.tiHashes = tiHashesMatch[1].trim();
      }
      
      // Check EXIF/XMP/IPTC for JPEG/WebP (some tools store prompts here)
      // Check multiple fields for SD-style metadata
      const exifSources = [
        tags.exif?.UserComment?.description,
        tags.exif?.ImageDescription?.description,
        tags.iptc?.Caption?.description,
        tags.xmp?.Parameters?.description
      ].filter(Boolean);
      
      for (const source of exifSources) {
        if (source && !aiMetadata.prompt) {
          // Check if it looks like SD format (contains "prompt" or "Steps:" or "Negative prompt:")
          if (/prompt|Steps:|Negative prompt:/i.test(source)) {
            parseTextMetadata(source, aiMetadata);
            if (aiMetadata.prompt) break; // Stop after first successful parse
          } else if (source === exifSources[0] && tags.exif?.UserComment) {
            // Store UserComment as fallback if it doesn't look like SD format
            aiMetadata.userComment = source;
          }
        }
      }
      
      if (Object.keys(aiMetadata).length > 0) {
        metadata.ai = aiMetadata;
      }
      
      return metadata;
    } catch (e) {
      console.error('Failed to read metadata:', e);
      return null;
    }
  });

  // Images: delete
  ipcMain.handle('images:delete', async (_evt, imageId, deleteDiskFile) => {
    const image = db.prepare(`SELECT * FROM images WHERE id = ?`).get(imageId);
    if (!image) throw new Error('Image not found');
    
    if (deleteDiskFile) {
      const fs = await import('node:fs/promises');
      try {
        await fs.unlink(image.path);
      } catch (e) {
        console.error('Failed to delete file:', e);
      }
    }
    
    db.prepare(`DELETE FROM images WHERE id = ?`).run(imageId);
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Images: update tags (DB-only, never modifies the actual image file)
  ipcMain.handle('images:updateTags', async (_evt, imageId, tags) => {
    db.prepare(`UPDATE images SET tags = ? WHERE id = ?`).run(tags, imageId);
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Images: open in explorer/finder
  ipcMain.handle('images:showInFolder', async (_evt, imagePath) => {
    shell.showItemInFolder(imagePath);
    return { ok: true };
  });

  // Images: open in default image viewer
  ipcMain.handle('images:openInViewer', async (_evt, imagePath) => {
    await shell.openPath(imagePath);
    // record recent by path lookup
    try {
      const row = db.prepare(`SELECT id FROM images WHERE path = ?`).get(imagePath);
      if (row) {
        db.prepare(`INSERT INTO recent (kind, ref_id, last_used_at) VALUES ('image', ?, datetime('now'))`).run(row.id);
      }
    } catch {}
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Images: open folder in explorer
  ipcMain.handle('images:openFolder', async (_evt, toolId) => {
    const tool = db.prepare(`SELECT images_folder AS imagesFolder FROM tools WHERE id = ?`).get(toolId);
    if (tool && tool.imagesFolder) {
      await shell.openPath(tool.imagesFolder);
    }
    return { ok: true };
  });

  // Files: get by ID
  ipcMain.handle('files:getById', async (_evt, fileId) => {
    const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(fileId);
    if (!file) return null;
    const tool = db.prepare(`SELECT files_folder FROM tools WHERE id = ?`).get(file.tool_id);
    if (!tool) return null;
    
    const pathMod = await import('node:path');
    const relativePath = pathMod.relative(tool.files_folder, file.path);
    const folderPath = pathMod.dirname(relativePath);
    
    return {
      id: file.id,
      path: file.path,
      name: pathMod.basename(file.path),
      folderPath: folderPath === '.' ? '' : folderPath.replace(/\\/g, '/')
    };
  });

  // Files: scan folder and sync with DB (recursive)
  ipcMain.handle('files:scan', async (_evt, toolId, subPath = '') => {
    const tool = db.prepare(`SELECT * FROM tools WHERE id = ?`).get(toolId);
    if (!tool || !tool.files_folder) throw new Error('No files folder configured');
    
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    
    const currentPath = path.join(tool.files_folder, subPath);
    
    // Security check: ensure we're still within the files folder
    if (!currentPath.startsWith(tool.files_folder)) {
      throw new Error('Invalid path: attempted to access outside files folder');
    }
    
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      const folders = [];
      const files = [];
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(tool.files_folder, fullPath);
        
        if (entry.isDirectory()) {
          folders.push({
            name: entry.name,
            path: relativePath,
            isFolder: true
          });
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          
          // Check if already in DB
          let dbFile = db.prepare(`SELECT * FROM files WHERE tool_id = ? AND path = ?`).get(toolId, fullPath);
          
          if (!dbFile) {
            // Add to DB
            const info = db.prepare(`INSERT INTO files (tool_id, path, metadata_json) VALUES (?, ?, NULL)`).run(toolId, fullPath);
            dbFile = { id: Number(info.lastInsertRowid), tool_id: toolId, path: fullPath, metadata_json: null, tags: null, added_at: new Date().toISOString() };
          }
          
          files.push({
            id: dbFile.id,
            path: fullPath,
            name: entry.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            extension: ext,
            metadata: dbFile.metadata_json ? JSON.parse(dbFile.metadata_json) : null,
            tags: dbFile.tags
          });
        }
      }
      
      return { folders, files, currentPath: subPath };
    } catch (e) {
      console.error('Failed to scan files folder:', e);
      throw new Error('Failed to scan files folder: ' + e.message);
    }
  });

  // Files: update tags (DB-only, never modifies the actual file)
  ipcMain.handle('files:updateTags', async (_evt, fileId, tags) => {
    db.prepare(`UPDATE files SET tags = ? WHERE id = ?`).run(tags, fileId);
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Files: delete
  ipcMain.handle('files:delete', async (_evt, fileId, deleteDiskFile) => {
    const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(fileId);
    if (!file) throw new Error('File not found');
    
    if (deleteDiskFile) {
      const fs = await import('node:fs/promises');
      try {
        await fs.unlink(file.path);
      } catch (e) {
        console.error('Failed to delete file:', e);
      }
    }
    
    db.prepare(`DELETE FROM files WHERE id = ?`).run(fileId);
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Files: open in explorer/finder
  ipcMain.handle('files:showInFolder', async (_evt, filePath) => {
    shell.showItemInFolder(filePath);
    try {
      const row = db.prepare(`SELECT id FROM files WHERE path = ?`).get(filePath);
      if (row) {
        db.prepare(`INSERT INTO recent (kind, ref_id, last_used_at) VALUES ('file', ?, datetime('now'))`).run(row.id);
      }
    } catch {}
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Files: open in default application
  ipcMain.handle('files:openInApp', async (_evt, filePath) => {
    await shell.openPath(filePath);
    try {
      const row = db.prepare(`SELECT id FROM files WHERE path = ?`).get(filePath);
      if (row) {
        db.prepare(`INSERT INTO recent (kind, ref_id, last_used_at) VALUES ('file', ?, datetime('now'))`).run(row.id);
      }
    } catch {}
    notifyAllRecentChanged();
    return { ok: true };
  });

  // Files: open folder in explorer
  ipcMain.handle('files:openFolder', async (_evt, toolId) => {
    const tool = db.prepare(`SELECT files_folder AS filesFolder FROM tools WHERE id = ?`).get(toolId);
    if (tool && tool.filesFolder) {
      await shell.openPath(tool.filesFolder);
    }
    return { ok: true };
  });

  // Recent: list per tool (files/images/prompts) using latest of added/opened/modified
  ipcMain.handle('recent:list', async (_evt, toolId) => {
    const fs = await import('node:fs/promises');
    const pathMod = await import('node:path');

    // Pre-aggregate last opened per kind
    const lastOpenedImage = Object.fromEntries(
      db
        .prepare(`SELECT ref_id as id, MAX(last_used_at) as last_used_at FROM recent WHERE kind='image' GROUP BY ref_id`)
        .all()
        .map((r) => [r.id, r.last_used_at])
    );
    const lastOpenedFile = Object.fromEntries(
      db
        .prepare(`SELECT ref_id as id, MAX(last_used_at) as last_used_at FROM recent WHERE kind='file' GROUP BY ref_id`)
        .all()
        .map((r) => [r.id, r.last_used_at])
    );
    const lastOpenedPrompt = Object.fromEntries(
      db
        .prepare(`SELECT ref_id as id, MAX(last_used_at) as last_used_at FROM recent WHERE kind='prompt' GROUP BY ref_id`)
        .all()
        .map((r) => [r.id, r.last_used_at])
    );

    const images = db
      .prepare(`SELECT id, path, added_at FROM images WHERE tool_id = ?`)
      .all(toolId);
    const files = db
      .prepare(`SELECT id, path, added_at FROM files WHERE tool_id = ?`)
      .all(toolId);
    const prompts = db
      .prepare(`SELECT id, title, content, created_at, updated_at FROM prompts WHERE tool_id = ?`)
      .all(toolId);

    async function statMtime(p) {
      try {
        const st = await fs.stat(p);
        return st.mtime.toISOString();
      } catch {
        return null;
      }
    }

    const imageItems = await Promise.all(
      images.map(async (i) => {
        const m = await statMtime(i.path);
        const ts = [i.added_at, lastOpenedImage[i.id], m].filter(Boolean).sort().pop();
        return ts
          ? {
              kind: 'image',
              refId: i.id,
              path: i.path,
              name: pathMod.default.basename(i.path),
              lastUsedAt: ts,
              imageId: i.id, // For thumbnail
            }
          : null;
      })
    );

    const fileItems = await Promise.all(
      files.map(async (f) => {
        const m = await statMtime(f.path);
        const ts = [f.added_at, lastOpenedFile[f.id], m].filter(Boolean).sort().pop();
        return ts
          ? {
              kind: 'file',
              refId: f.id,
              path: f.path,
              name: pathMod.default.basename(f.path),
              lastUsedAt: ts,
            }
          : null;
      })
    );

    const promptItems = prompts.map((p) => {
      const ts = [p.updated_at, p.created_at, lastOpenedPrompt[p.id]].filter(Boolean).sort().pop();
      return ts
        ? {
            kind: 'prompt',
            refId: p.id,
            title: p.title,
            content: p.content,
            lastUsedAt: ts,
          }
        : null;
    });

    const combined = [...imageItems, ...fileItems, ...promptItems].filter(Boolean);
    combined.sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
    return combined.slice(0, 5);
  });

  // Export: Export all tool data and optionally files/images
  ipcMain.handle('tools:export', async (_evt, options = {}) => {
    const { includeFiles = false, includeImages = false } = options;
    const fs = await import('node:fs/promises');
    const fsSync = await import('node:fs');
    const path = await import('node:path');
    const archiver = await import('archiver');
    
    // Track temp directory for cleanup
    let tempDir = null;
    // Track if we're returning a Promise with internal cleanup
    let promiseReturned = false;
    
    try {
      // Get all tools
      const tools = db.prepare(`
        SELECT id, name, docs_url AS docsUrl, app_url AS appUrl, exec_path AS execPath, 
               icon_path AS iconPath, images_folder AS imagesFolder, files_folder AS filesFolder, 
               settings_json AS settingsJson, created_at AS createdAt, updated_at AS updatedAt 
        FROM tools ORDER BY name
      `).all();

      // Get all prompts
      const prompts = db.prepare(`
        SELECT id, tool_id AS toolId, title, content, tags, history_json AS historyJson, 
               created_at AS createdAt, updated_at AS updatedAt 
        FROM prompts ORDER BY tool_id, created_at DESC
      `).all();

      // Get all files metadata
      const files = db.prepare(`
        SELECT id, tool_id AS toolId, path, thumbnail_path AS thumbnailPath, 
               metadata_json AS metadataJson, tags, added_at AS addedAt 
        FROM files ORDER BY tool_id, added_at DESC
      `).all();

      // Get all images metadata
      const images = db.prepare(`
        SELECT id, tool_id AS toolId, path, thumbnail_path AS thumbnailPath, 
               metadata_json AS metadataJson, tags, added_at AS addedAt 
        FROM images ORDER BY tool_id, added_at DESC
      `).all();

      // Create export data structure
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        tools,
        prompts,
        files: files.map(f => ({
          ...f,
          metadata: f.metadataJson ? JSON.parse(f.metadataJson) : null
        })),
        images: images.map(i => ({
          ...i,
          metadata: i.metadataJson ? JSON.parse(i.metadataJson) : null
        }))
      };

      // Create temporary directory for export
      tempDir = path.join(app.getPath('temp'), `aiverse-export-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      // Copy icon files if they exist (export all icons, not just ones in userData)
      // Update icon paths in exportData to relative paths before writing data.json
      for (const tool of tools) {
        if (tool.iconPath) {
          // Skip data URLs, HTTP URLs, and bundled assets
          if (tool.iconPath.startsWith('data:') || 
              tool.iconPath.startsWith('http://') || 
              tool.iconPath.startsWith('https://') ||
              (tool.iconPath.startsWith('/') && (tool.iconPath.includes('/assets/') || tool.iconPath.includes('/_vite/')))) {
            // These are external/bundled resources, keep as-is in export
            continue;
          }
          
          try {
            const iconExists = await fs.access(tool.iconPath).then(() => true).catch(() => false);
            if (iconExists) {
              const iconDir = path.join(tempDir, 'icons');
              await fs.mkdir(iconDir, { recursive: true });
              const iconExt = path.extname(tool.iconPath);
              const iconFileName = `tool-${tool.id}${iconExt}`;
              await fs.copyFile(tool.iconPath, path.join(iconDir, iconFileName));
              // Update icon path in export data to relative path
              const toolInExportData = exportData.tools.find(t => t.id === tool.id);
              if (toolInExportData) {
                toolInExportData.iconPath = `icons/${iconFileName}`;
              }
            }
          } catch (e) {
            console.warn(`Failed to copy icon for tool ${tool.id}:`, e);
          }
        }
      }

      // Write data.json after icon paths have been updated to relative paths
      await fs.writeFile(
        path.join(tempDir, 'data.json'),
        JSON.stringify(exportData, null, 2)
      );

      // Copy files if requested
      if (includeFiles) {
        const filesDir = path.join(tempDir, 'files');
        await fs.mkdir(filesDir, { recursive: true });
        
        for (const file of files) {
          try {
            const fileExists = await fs.access(file.path).then(() => true).catch(() => false);
            if (fileExists) {
              const tool = tools.find(t => t.id === file.toolId);
              if (tool && tool.filesFolder && file.path.startsWith(tool.filesFolder)) {
                const relativePath = path.relative(tool.filesFolder, file.path);
                const targetPath = path.join(filesDir, `tool-${file.toolId}`, relativePath);
                const targetDir = path.dirname(targetPath);
                await fs.mkdir(targetDir, { recursive: true });
                await fs.copyFile(file.path, targetPath);
              }
            }
          } catch (e) {
            console.warn(`Failed to copy file ${file.path}:`, e);
          }
        }
      }

      // Copy images if requested
      if (includeImages) {
        const imagesDir = path.join(tempDir, 'images');
        await fs.mkdir(imagesDir, { recursive: true });
        
        for (const image of images) {
          try {
            const imageExists = await fs.access(image.path).then(() => true).catch(() => false);
            if (imageExists) {
              const tool = tools.find(t => t.id === image.toolId);
              if (tool && tool.imagesFolder && image.path.startsWith(tool.imagesFolder)) {
                const relativePath = path.relative(tool.imagesFolder, image.path);
                const targetPath = path.join(imagesDir, `tool-${image.toolId}`, relativePath);
                const targetDir = path.dirname(targetPath);
                await fs.mkdir(targetDir, { recursive: true });
                await fs.copyFile(image.path, targetPath);
              }
            }
          } catch (e) {
            console.warn(`Failed to copy image ${image.path}:`, e);
          }
        }
      }

      // Ask user where to save the export file BEFORE creating zip
      // This allows us to stream directly to the output file
      const windows = BrowserWindow.getAllWindows();
      const win = windows.length > 0 ? windows[0] : null;
      const result = await dialog.showSaveDialog(win, {
        title: 'Export Tool Data',
        defaultPath: `aiverse-export-${new Date().toISOString().split('T')[0]}.zip`,
        filters: [
          { name: 'ZIP Files', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
        return { canceled: true };
      }

      // Track that we're returning a Promise with internal cleanup
      // This prevents the finally block from cleaning up while the archive is being written
      promiseReturned = true;

      // Create ZIP file using archiver with streaming
      // This streams files directly from disk to the zip file without loading everything into memory
      const archivePromise = new Promise(async (resolve, reject) => {
        const output = fsSync.createWriteStream(result.filePath);
        // Handle both default export and named export
        const Archiver = archiver.default || archiver;
        const archive = Archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });

        // Pipe archive data to the file
        archive.pipe(output);

        // Cleanup helper
        const cleanup = async () => {
          try {
            await fs.rm(tempDir, { recursive: true, force: true });
          } catch (cleanupErr) {
            console.warn('Failed to clean up temp directory:', cleanupErr);
          }
        };

        // Handle archive errors
        archive.on('error', async (err) => {
          await cleanup();
          reject(new Error(`Archive error: ${err.message}`));
        });

        // Handle output stream errors
        output.on('error', async (err) => {
          await cleanup();
          reject(new Error(`File write error: ${err.message}`));
        });

        // Handle successful completion
        output.on('close', async () => {
          await cleanup();
          resolve({ 
            ok: true, 
            filePath: result.filePath,
            stats: {
              tools: tools.length,
              prompts: prompts.length,
              files: files.length,
              images: images.length
            }
          });
        });

        // Add the entire temp directory to the archive
        // This streams files directly from disk, avoiding memory issues
        archive.directory(tempDir, false);

        // Finalize the archive (this will trigger the 'close' event)
        archive.finalize();
      });
      
      return archivePromise;
    } catch (e) {
      console.error('Export failed:', e);
      throw new Error(`Export failed: ${e.message}`);
    } finally {
      // Only clean up temp directory if we're not returning a Promise with internal cleanup
      // The Promise's cleanup handler will handle cleanup when the archive completes
      if (tempDir && !promiseReturned) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          // Log cleanup errors but don't throw - we don't want to mask the original error
          console.warn('Failed to clean up temp directory:', cleanupErr);
        }
      }
    }
  });

  // Import: Import tool data and optionally files/images from ZIP
  ipcMain.handle('tools:import', async (_evt, filePath, options = {}) => {
    const { includeFiles = false, includeImages = false, mergeMode = 'skip' } = options; // mergeMode: 'skip' | 'replace' | 'merge'
    const fs = await import('node:fs/promises');
    const fsSync = await import('node:fs');
    const path = await import('node:path');
    const yauzlModule = await import('yauzl');
    const yauzl = yauzlModule.default || yauzlModule.default?.default || yauzlModule;
    
    // Track temp directory for cleanup
    let tempDir = null;
    
    try {
      // Verify file exists and is actually a file (not a directory)
      try {
        const fileStats = await fs.stat(filePath);
        if (!fileStats.isFile()) {
          throw new Error('Import path must be a file, not a directory');
        }
      } catch (e) {
        if (e.code === 'ENOENT') {
          throw new Error('Import file not found');
        }
        throw new Error(`Invalid import file: ${e.message}`);
      }
      
      // Extract ZIP to temp directory using yauzl for streaming (handles files >2GiB)
      tempDir = path.join(app.getPath('temp'), `aiverse-import-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      // Use yauzl for streaming extraction (handles large files without loading into memory)
      await new Promise((resolve, reject) => {
        let pendingExtractions = 0;
        let hasError = false;
        let entriesFinished = false;
        
        const checkComplete = () => {
          if (entriesFinished && pendingExtractions === 0 && !hasError) {
            resolve();
          }
        };
        
        yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
          if (err) return reject(err);
          
          zipfile.readEntry();
          
          zipfile.on('entry', (entry) => {
            // Normalize path separators (Windows uses backslashes, ZIP uses forward slashes)
            const normalizedFileName = entry.fileName.replace(/\\/g, '/');
            
            if (/\/$/.test(normalizedFileName)) {
              // Directory entry - create directory
              const dirPath = path.join(tempDir, normalizedFileName);
              try {
                fsSync.mkdirSync(dirPath, { recursive: true });
              } catch (dirErr) {
                // Ignore errors if directory already exists
                if (dirErr.code !== 'EEXIST') {
                  console.warn(`Failed to create directory ${normalizedFileName}:`, dirErr);
                }
              }
              zipfile.readEntry();
            } else {
              // File entry - extract file
              pendingExtractions++;
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err) {
                  console.warn(`Failed to extract ${normalizedFileName}:`, err);
                  pendingExtractions--;
                  zipfile.readEntry();
                  checkComplete();
                  return;
                }
                
                const targetFilePath = path.join(tempDir, normalizedFileName);
                const dirPath = path.dirname(targetFilePath);
                try {
                  fsSync.mkdirSync(dirPath, { recursive: true });
                } catch (dirErr) {
                  // Ignore errors if directory already exists
                  if (dirErr.code !== 'EEXIST') {
                    console.warn(`Failed to create directory for ${normalizedFileName}:`, dirErr);
                  }
                }
                
                const writeStream = fsSync.createWriteStream(targetFilePath);
                
                readStream.on('error', (err) => {
                  console.warn(`Read error for ${normalizedFileName}:`, err);
                  pendingExtractions--;
                  zipfile.readEntry();
                  checkComplete();
                });
                
                writeStream.on('close', () => {
                  pendingExtractions--;
                  zipfile.readEntry();
                  checkComplete();
                });
                
                writeStream.on('error', (err) => {
                  console.warn(`Failed to write ${normalizedFileName}:`, err);
                  hasError = true;
                  pendingExtractions--;
                  zipfile.readEntry();
                  checkComplete();
                });
                
                readStream.pipe(writeStream);
              });
            }
          });
          
          zipfile.on('end', () => {
            entriesFinished = true;
            checkComplete();
          });
          
          zipfile.on('error', (err) => {
            hasError = true;
            reject(new Error(`ZIP file error: ${err.message}`));
          });
        });
      });
      
      // Read data.json
      const dataPath = path.join(tempDir, 'data.json');
      
      // Verify data.json exists and is a file
      try {
        const stats = await fs.stat(dataPath);
        if (!stats.isFile()) {
          throw new Error('Invalid export file: data.json is not a file (it\'s a directory)');
        }
      } catch (e) {
        if (e.code === 'ENOENT') {
          throw new Error('Invalid export file: data.json not found in ZIP');
        }
        if (e.message.startsWith('Invalid export file:')) {
          throw e; // Re-throw if already wrapped
        }
        throw new Error(`Invalid export file: ${e.message}`);
      }
      
      const dataContent = await fs.readFile(dataPath, 'utf-8');
      const importData = JSON.parse(dataContent);
      
      if (!importData.tools || !Array.isArray(importData.tools)) {
        throw new Error('Invalid export file: missing tools data');
      }

      const stats = {
        tools: { created: 0, skipped: 0, replaced: 0 },
        prompts: { created: 0, skipped: 0 },
        files: { created: 0, skipped: 0 },
        images: { created: 0, skipped: 0 }
      };

      // Create tool ID mapping for all tools
      const toolIdMap = {};
      
      // Import tools
      for (const toolData of importData.tools) {
        const existing = db.prepare(`SELECT id FROM tools WHERE name = ?`).get(toolData.name);
        
        let toolId;
        if (existing) {
          if (mergeMode === 'skip') {
            toolId = existing.id;
            stats.tools.skipped++;
          } else if (mergeMode === 'replace') {
            // Update existing tool (set icon_path to null initially, will be updated after icon copy)
            db.prepare(`
              UPDATE tools SET 
                docs_url = ?, app_url = ?, exec_path = ?, icon_path = ?, 
                images_folder = ?, files_folder = ?, settings_json = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(
              toolData.docsUrl ?? null,
              toolData.appUrl ?? null,
              toolData.execPath ?? null,
              null, // icon_path set to null, will be updated after icon copy
              toolData.imagesFolder ?? null,
              toolData.filesFolder ?? null,
              toolData.settingsJson ?? null,
              existing.id
            );
            toolId = existing.id;
            stats.tools.replaced++;
          } else {
            // merge: create new with different name
            const newName = `${toolData.name} (imported)`;
            const info = db.prepare(`
              INSERT INTO tools (name, docs_url, app_url, exec_path, icon_path, images_folder, files_folder, settings_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              newName,
              toolData.docsUrl ?? null,
              toolData.appUrl ?? null,
              toolData.execPath ?? null,
              null, // icon_path set to null, will be updated after icon copy
              toolData.imagesFolder ?? null,
              toolData.filesFolder ?? null,
              toolData.settingsJson ?? null
            );
            toolId = Number(info.lastInsertRowid);
            stats.tools.created++;
          }
        } else {
          // Create new tool (set icon_path to null initially, will be updated after icon copy)
          const info = db.prepare(`
            INSERT INTO tools (name, docs_url, app_url, exec_path, icon_path, images_folder, files_folder, settings_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            toolData.name,
            toolData.docsUrl ?? null,
            toolData.appUrl ?? null,
            toolData.execPath ?? null,
            null, // icon_path set to null, will be updated after icon copy
            toolData.imagesFolder ?? null,
            toolData.filesFolder ?? null,
            toolData.settingsJson ?? null
          );
          toolId = Number(info.lastInsertRowid);
          stats.tools.created++;
        }

        // Map old tool ID to new tool ID
        toolIdMap[toolData.id] = toolId;

        // Copy icon if it exists in the import
        // Similar approach to files/images: always try to copy from export if available
        let iconTargetPath = null;
        
        if (toolData.iconPath) {
          // Handle data URLs, HTTP URLs, and bundled assets - set directly
          if (toolData.iconPath.startsWith('data:') || 
              toolData.iconPath.startsWith('http://') || 
              toolData.iconPath.startsWith('https://') ||
              (toolData.iconPath.startsWith('/') && (toolData.iconPath.includes('/assets/') || toolData.iconPath.includes('/_vite/')))) {
            // These are external/bundled resources, set directly
            iconTargetPath = toolData.iconPath;
          }
          // Handle relative paths from export (icons/...)
          else if (toolData.iconPath.startsWith('icons/')) {
            const iconSourcePath = path.join(tempDir, toolData.iconPath);
            try {
              const iconExists = await fs.access(iconSourcePath).then(() => true).catch(() => false);
              if (iconExists) {
                const userData = app.getPath('userData');
                const iconsDir = path.join(userData, 'template-icons');
                await fs.mkdir(iconsDir, { recursive: true });
                const iconExt = path.extname(toolData.iconPath);
                const iconFileName = `tool-${toolId}-${Date.now()}${iconExt}`;
                iconTargetPath = path.join(iconsDir, iconFileName);
                await fs.copyFile(iconSourcePath, iconTargetPath);
              } else {
                console.warn(`Icon file not found in export: ${iconSourcePath}`);
              }
            } catch (e) {
              console.warn(`Failed to copy icon for tool ${toolId}:`, e);
            }
          } else {
            // Handle absolute paths - first check if it exists, otherwise try to find in export
            let iconNeedsUpdate = false;
            
            // Check if the icon path exists and is accessible
            try {
              const stats = await fs.stat(toolData.iconPath);
              if (!stats.isFile()) {
                // Path exists but isn't a file
                iconNeedsUpdate = true;
              } else {
                // Path exists and is valid, use it
                iconTargetPath = toolData.iconPath;
              }
            } catch (e) {
              // Path doesn't exist or isn't accessible, try to find in export
              iconNeedsUpdate = true;
            }
            
            if (iconNeedsUpdate) {
              // Try to find the icon in the temp directory (in case it was exported)
              // First try with the exact filename from the path
              const iconFileName = path.basename(toolData.iconPath);
              let possibleSourcePath = path.join(tempDir, 'icons', iconFileName);
              let iconExistsInTemp = await fs.access(possibleSourcePath).then(() => true).catch(() => false);
              
              // If not found, try to find any icon for this tool (export uses tool-{id}.{ext} format)
              if (!iconExistsInTemp) {
                try {
                  const iconsDir = path.join(tempDir, 'icons');
                  const iconFiles = await fs.readdir(iconsDir);
                  // Look for icon file that matches the tool ID pattern
                  const matchingIcon = iconFiles.find(f => f.startsWith(`tool-${toolData.id}.`) || f.startsWith(`tool-${toolData.id}-`));
                  if (matchingIcon) {
                    possibleSourcePath = path.join(iconsDir, matchingIcon);
                    iconExistsInTemp = true;
                  }
                } catch (e) {
                  // Icons directory doesn't exist or can't be read
                }
              }
              
              if (iconExistsInTemp) {
                // Copy from temp directory
                const userData = app.getPath('userData');
                const iconsDir = path.join(userData, 'template-icons');
                await fs.mkdir(iconsDir, { recursive: true });
                const iconExt = path.extname(possibleSourcePath) || path.extname(toolData.iconPath) || '.png';
                const newIconFileName = `tool-${toolId}-${Date.now()}${iconExt}`;
                iconTargetPath = path.join(iconsDir, newIconFileName);
                await fs.copyFile(possibleSourcePath, iconTargetPath);
              } else {
                // Icon not found, skip it
                console.warn(`Icon not found for tool ${toolId}: ${toolData.iconPath} (also not in export)`);
              }
            }
          }
        } else {
          // No iconPath in data, but try to find icon in export anyway (in case it was exported but path wasn't saved)
          try {
            const iconsDir = path.join(tempDir, 'icons');
            const iconFiles = await fs.readdir(iconsDir);
            // Look for icon file that matches the tool ID pattern
            const matchingIcon = iconFiles.find(f => f.startsWith(`tool-${toolData.id}.`) || f.startsWith(`tool-${toolData.id}-`));
            if (matchingIcon) {
              const iconSourcePath = path.join(iconsDir, matchingIcon);
              const userData = app.getPath('userData');
              const targetIconsDir = path.join(userData, 'template-icons');
              await fs.mkdir(targetIconsDir, { recursive: true });
              const iconExt = path.extname(matchingIcon) || '.png';
              const newIconFileName = `tool-${toolId}-${Date.now()}${iconExt}`;
              iconTargetPath = path.join(targetIconsDir, newIconFileName);
              await fs.copyFile(iconSourcePath, iconTargetPath);
            }
          } catch (e) {
            // Icons directory doesn't exist or can't be read, that's okay
          }
        }
        
        // Update tool icon path if we have a valid path
        if (iconTargetPath) {
          db.prepare(`UPDATE tools SET icon_path = ? WHERE id = ?`).run(iconTargetPath, toolId);
        }
      }

      // Import prompts
      if (importData.prompts && Array.isArray(importData.prompts)) {
        for (const promptData of importData.prompts) {
          const newToolId = toolIdMap[promptData.toolId];
          if (!newToolId) continue;
          
          db.prepare(`
            INSERT INTO prompts (tool_id, title, content, tags, history_json)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            newToolId,
            promptData.title,
            promptData.content,
            promptData.tags ?? null,
            promptData.historyJson ?? null
          );
          stats.prompts.created++;
        }
      }

      // Import files metadata
      if (importData.files && Array.isArray(importData.files)) {
        for (const fileData of importData.files) {
          const newToolId = toolIdMap[fileData.toolId];
          if (!newToolId) continue;
          
          const tool = db.prepare(`SELECT files_folder FROM tools WHERE id = ?`).get(newToolId);
          
          // Determine target folder - use tool's folder if it exists and is accessible, otherwise use app folder
          let targetFolder = tool?.files_folder;
          let folderNeedsUpdate = false;
          
          if (!targetFolder) {
            // No folder configured, create one in userData
            const userData = app.getPath('userData');
            targetFolder = path.join(userData, 'tool-files', `tool-${newToolId}`);
            folderNeedsUpdate = true;
          } else {
            // Check if the folder exists and is accessible
            // Use fs.stat() which is more reliable for non-existent drives on Windows
            let folderIsValid = false;
            try {
              const stats = await fs.stat(targetFolder);
              if (stats.isDirectory()) {
                // Try to verify write access by attempting to create a test file
                const testFile = path.join(targetFolder, `.aiverse-write-test-${Date.now()}`);
                try {
                  await fs.writeFile(testFile, '');
                  await fs.unlink(testFile);
                  folderIsValid = true;
                } catch (writeErr) {
                  // Can't write to folder, it's not valid
                  folderIsValid = false;
                }
              }
            } catch (e) {
              // Path doesn't exist, drive doesn't exist, or other error
              folderIsValid = false;
            }
            
            if (!folderIsValid) {
              // Folder doesn't exist or isn't accessible, create one in userData instead
              const userData = app.getPath('userData');
              targetFolder = path.join(userData, 'tool-files', `tool-${newToolId}`);
              folderNeedsUpdate = true;
            }
          }
          
          // Create folder and update database if needed
          if (folderNeedsUpdate) {
            await fs.mkdir(targetFolder, { recursive: true });
            db.prepare(`UPDATE tools SET files_folder = ? WHERE id = ?`).run(targetFolder, newToolId);
          }
          
          // Only import files if includeFiles is true
          if (!includeFiles) {
            // Skip creating database entries for files when not importing them
            continue;
          }
          
          // Copy the file and preserve folder structure by extracting relative path from export
          const originalTool = importData.tools.find(t => t.id === fileData.toolId);
          const relativePath = originalTool?.filesFolder 
            ? path.relative(originalTool.filesFolder, fileData.path)
            : path.basename(fileData.path);
          
          const fileSourcePath = path.join(tempDir, 'files', `tool-${fileData.toolId}`, relativePath);
          let targetPath = fileData.path;
          
          try {
            const fileExists = await fs.access(fileSourcePath).then(() => true).catch(() => false);
            if (fileExists) {
              // Preserve folder structure by using the relative path
              targetPath = path.join(targetFolder, relativePath);
              const targetDir = path.dirname(targetPath);
              await fs.mkdir(targetDir, { recursive: true });
              await fs.copyFile(fileSourcePath, targetPath);
              
              // Only create database entry if file was successfully copied
              db.prepare(`
                INSERT INTO files (tool_id, path, thumbnail_path, metadata_json, tags)
                VALUES (?, ?, ?, ?, ?)
              `).run(
                newToolId,
                targetPath,
                fileData.thumbnailPath ?? null,
                fileData.metadata ? JSON.stringify(fileData.metadata) : null,
                fileData.tags ?? null
              );
              stats.files.created++;
            }
          } catch (e) {
            console.warn(`Failed to copy file ${fileData.path}:`, e);
            continue;
          }
        }
      }

      // Import images metadata
      if (importData.images && Array.isArray(importData.images)) {
        for (const imageData of importData.images) {
          const newToolId = toolIdMap[imageData.toolId];
          if (!newToolId) continue;
          
          const tool = db.prepare(`SELECT images_folder FROM tools WHERE id = ?`).get(newToolId);
          
          // Determine target folder - use tool's folder if it exists and is accessible, otherwise use app folder
          let targetFolder = tool?.images_folder;
          let folderNeedsUpdate = false;
          
          if (!targetFolder) {
            // No folder configured, create one in userData
            const userData = app.getPath('userData');
            targetFolder = path.join(userData, 'tool-images', `tool-${newToolId}`);
            folderNeedsUpdate = true;
          } else {
            // Check if the folder exists and is accessible
            // Use fs.stat() which is more reliable for non-existent drives on Windows
            let folderIsValid = false;
            try {
              const stats = await fs.stat(targetFolder);
              if (stats.isDirectory()) {
                // Try to verify write access by attempting to create a test file
                const testFile = path.join(targetFolder, `.aiverse-write-test-${Date.now()}`);
                try {
                  await fs.writeFile(testFile, '');
                  await fs.unlink(testFile);
                  folderIsValid = true;
                } catch (writeErr) {
                  // Can't write to folder, it's not valid
                  folderIsValid = false;
                }
              }
            } catch (e) {
              // Path doesn't exist, drive doesn't exist, or other error
              folderIsValid = false;
            }
            
            if (!folderIsValid) {
              // Folder doesn't exist or isn't accessible, create one in userData instead
              const userData = app.getPath('userData');
              targetFolder = path.join(userData, 'tool-images', `tool-${newToolId}`);
              folderNeedsUpdate = true;
            }
          }
          
          // Create folder and update database if needed
          if (folderNeedsUpdate) {
            await fs.mkdir(targetFolder, { recursive: true });
            db.prepare(`UPDATE tools SET images_folder = ? WHERE id = ?`).run(targetFolder, newToolId);
          }
          
          // Only import images if includeImages is true
          if (!includeImages) {
            // Skip creating database entries for images when not importing them
            continue;
          }
          
          // Copy the image and preserve folder structure by extracting relative path from export
          const originalTool = importData.tools.find(t => t.id === imageData.toolId);
          const relativePath = originalTool?.imagesFolder 
            ? path.relative(originalTool.imagesFolder, imageData.path)
            : path.basename(imageData.path);
          
          const imageSourcePath = path.join(tempDir, 'images', `tool-${imageData.toolId}`, relativePath);
          let targetPath = imageData.path;
          
          try {
            const imageExists = await fs.access(imageSourcePath).then(() => true).catch(() => false);
            if (imageExists) {
              // Preserve folder structure by using the relative path
              targetPath = path.join(targetFolder, relativePath);
              const targetDir = path.dirname(targetPath);
              await fs.mkdir(targetDir, { recursive: true });
              await fs.copyFile(imageSourcePath, targetPath);
              
              // Only create database entry if image was successfully copied
              db.prepare(`
                INSERT INTO images (tool_id, path, thumbnail_path, metadata_json, tags)
                VALUES (?, ?, ?, ?, ?)
              `).run(
                newToolId,
                targetPath,
                imageData.thumbnailPath ?? null,
                imageData.metadata ? JSON.stringify(imageData.metadata) : null,
                imageData.tags ?? null
              );
              stats.images.created++;
            }
          } catch (e) {
            console.warn(`Failed to copy image ${imageData.path}:`, e);
            continue;
          }
        }
      }

      notifyAllToolsChanged();
      notifyAllRecentChanged();

      return { ok: true, stats };
    } catch (e) {
      console.error('Import failed:', e);
      throw new Error(`Import failed: ${e.message}`);
    } finally {
      // Always clean up temp directory, even if an error occurred
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          // Log cleanup errors but don't throw - we don't want to mask the original error
          console.warn('Failed to clean up temp directory:', cleanupErr);
        }
      }
    }
  });
}


