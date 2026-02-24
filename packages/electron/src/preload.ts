import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  serverUrl: "http://localhost:3001",
  explorerUrl: "http://localhost:3002",
  send: (channel: string, data: unknown) => ipcRenderer.invoke(channel, data),
});
