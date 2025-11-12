import { contextBridge, ipcRenderer } from 'electron';

const api = {
  tools: {
    list: () => ipcRenderer.invoke('tools:list'),
    create: (input) => ipcRenderer.invoke('tools:create', input),
    update: (id, input) => ipcRenderer.invoke('tools:update', id, input),
    delete: (id) => ipcRenderer.invoke('tools:delete', id),
    open: (id) => ipcRenderer.invoke('tools:open', id),
    onChanged: (cb) => {
      const listener = () => cb();
      ipcRenderer.on('tools:changed', listener);
      return () => ipcRenderer.removeListener('tools:changed', listener);
    }
  },
  open: {
    url: (url) => ipcRenderer.invoke('open:url', url),
    selectFolder: (options) => ipcRenderer.invoke('open:selectFolder', options),
    selectFile: (options) => ipcRenderer.invoke('open:selectFile', options)
  },
  file: {
    readAsDataUrl: (filePath) => ipcRenderer.invoke('file:readAsDataUrl', filePath),
    saveTemplateIcon: (dataUrl, templateId) => ipcRenderer.invoke('file:saveTemplateIcon', dataUrl, templateId)
  },
  prompts: {
    list: (toolId) => ipcRenderer.invoke('prompts:list', toolId),
    create: (toolId, payload) => ipcRenderer.invoke('prompts:create', toolId, payload),
    update: (id, payload) => ipcRenderer.invoke('prompts:update', id, payload),
    delete: (id) => ipcRenderer.invoke('prompts:delete', id),
    exportAsJson: (toolId) => ipcRenderer.invoke('prompts:exportAsJson', toolId)
  },
  images: {
    scan: (toolId, subPath) => ipcRenderer.invoke('images:scan', toolId, subPath),
    getById: (imageId) => ipcRenderer.invoke('images:getById', imageId),
    getThumbnail: (imagePath, imageId) => ipcRenderer.invoke('images:getThumbnail', imagePath, imageId),
    readMetadata: (imagePath) => ipcRenderer.invoke('images:readMetadata', imagePath),
    delete: (imageId, deleteDiskFile) => ipcRenderer.invoke('images:delete', imageId, deleteDiskFile),
    updateTags: (imageId, tags) => ipcRenderer.invoke('images:updateTags', imageId, tags),
    showInFolder: (imagePath) => ipcRenderer.invoke('images:showInFolder', imagePath),
    openInViewer: (imagePath) => ipcRenderer.invoke('images:openInViewer', imagePath),
    openFolder: (toolId) => ipcRenderer.invoke('images:openFolder', toolId)
  },
  files: {
    scan: (toolId, subPath) => ipcRenderer.invoke('files:scan', toolId, subPath),
    getById: (fileId) => ipcRenderer.invoke('files:getById', fileId),
    delete: (fileId, deleteDiskFile) => ipcRenderer.invoke('files:delete', fileId, deleteDiskFile),
    updateTags: (fileId, tags) => ipcRenderer.invoke('files:updateTags', fileId, tags),
    showInFolder: (filePath) => ipcRenderer.invoke('files:showInFolder', filePath),
    openInApp: (filePath) => ipcRenderer.invoke('files:openInApp', filePath),
    openFolder: (toolId) => ipcRenderer.invoke('files:openFolder', toolId)
  },
  recent: {
    list: (toolId) => ipcRenderer.invoke('recent:list', toolId),
    onChanged: (cb) => {
      const listener = () => cb();
      ipcRenderer.on('recent:changed', listener);
      return () => ipcRenderer.removeListener('recent:changed', listener);
    }
  }
};

contextBridge.exposeInMainWorld('aiverse', api);


