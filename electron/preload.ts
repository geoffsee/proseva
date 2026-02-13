import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  serverUrl: "http://localhost:3001",
});
