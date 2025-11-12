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

      // Basic EXIF
      if (tags.exif?.Make) metadata.camera = tags.exif.Make.description;
      if (tags.exif?.Model) metadata.cameraModel = tags.exif.Model.description;
      if (tags.exif?.DateTime) metadata.dateTaken = tags.exif.DateTime.description;
      if (tags.file?.['Image Width']) metadata.width = tags.file['Image Width'].value;
      if (tags.file?.['Image Height']) metadata.height = tags.file['Image Height'].value;
      if (tags.exif?.Software) metadata.software = tags.exif.Software.description;
      if (tags.exif?.Artist) metadata.artist = tags.exif.Artist.description;
      
      // AI Metadata parsing
      const aiMetadata = {};
      
      // Check PNG chunks (NovelAI, Stable Diffusion, etc.)
      if (tags.png) {
        // Store raw values for fallback
        if (tags.png.Description) aiMetadata.description = tags.png.Description.description;
        if (tags.png.Comment) aiMetadata.comment = tags.png.Comment.description;
        if (tags.png.Software) aiMetadata.software = tags.png.Software.description;
        
        // Try to parse JSON from Comment (NovelAI, Stable Diffusion WebUI format)
        if (tags.png.Comment) {
          try {
            const parsed = JSON.parse(tags.png.Comment.description);
            
            // NovelAI format
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
            
            // Stable Diffusion format
            if (parsed.negative_prompt) aiMetadata.negativePrompt = parsed.negative_prompt;
            if (parsed.cfg_scale) aiMetadata.cfgScale = parsed.cfg_scale;
            if (parsed.model) aiMetadata.model = parsed.model;
          } catch (e) {
            // Not JSON, might be plain text prompt - try parsing as text
            if (!aiMetadata.prompt) {
              const commentText = tags.png.Comment.description;
              parseTextMetadata(commentText, aiMetadata);
            }
          }
        }
        
        // NovelAI/A1111 format in Description
        if (tags.png.Description && !aiMetadata.prompt) {
          const desc = tags.png.Description.description;
          parseTextMetadata(desc, aiMetadata);
        }
      }
      
      // Helper function to parse text-based metadata
      function parseTextMetadata(text, target) {
        // Extract prompt (everything before "Negative prompt:" or generation params)
        const promptMatch = text.match(/^([\s\S]*?)(?:\nNegative prompt:|Negative prompt:|\nSteps:)/i);
        if (promptMatch) target.prompt = promptMatch[1].trim();
        
        // Extract negative prompt
        const negMatch = text.match(/Negative prompt:\s*([\s\S]*?)(?:\nSteps:|Steps:|$)/i);
        if (negMatch) target.negativePrompt = negMatch[1].trim();
        
        // Extract generation parameters
        const stepsMatch = text.match(/Steps:\s*(\d+)/i);
        if (stepsMatch) target.steps = stepsMatch[1];
        
        const samplerMatch = text.match(/Sampler:\s*([^,\n]+)/i);
        if (samplerMatch) target.sampler = samplerMatch[1].trim();
        
        const cfgMatch = text.match(/(?:CFG scale|Scale):\s*([\d.]+)/i);
        if (cfgMatch) target.cfgScale = cfgMatch[1];
        
        const seedMatch = text.match(/Seed:\s*(\d+)/i);
        if (seedMatch) target.seed = seedMatch[1];
        
        const modelMatch = text.match(/Model:\s*([^,\n]+)/i);
        if (modelMatch) target.model = modelMatch[1].trim();
        
        // NovelAI specific: look for "Undesired content" as negative prompt alternative
        if (!target.negativePrompt) {
          const undesiredMatch = text.match(/Undesired content:\s*([\s\S]*?)(?:\n\w+:|$)/i);
          if (undesiredMatch) target.negativePrompt = undesiredMatch[1].trim();
        }
      }
      
      // Check EXIF UserComment (some tools store prompts here)
      if (tags.exif?.UserComment) {
        const userComment = tags.exif.UserComment.description;
        if (userComment && !aiMetadata.prompt) {
          aiMetadata.userComment = userComment;
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
}


