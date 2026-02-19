import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  serverUrl: "http://localhost:3001",
  send: (channel: string, data: unknown) => ipcRenderer.invoke(channel, data),
});
