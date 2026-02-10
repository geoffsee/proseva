/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  plugins: [
    react(),
    {
      name: "serve-case-documents",
      configureServer(server) {
        const base = path.resolve(__dirname, "app-data");
        server.middlewares.use("/index-documents.json", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          import("fs").then((fs) => {
            try {
              const content = fs.readFileSync(
                path.join(base, "index.json"),
                "utf-8",
              );
              res.end(content);
            } catch (err) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Index not found" }));
            }
          });
        });
        server.middlewares.use("/texts/", (req, res, next) => {
          const file = req.url?.replace(/^\//, "");
          if (!file) return next();
          const filePath = path.join(base, "texts", file);
          import("fs").then((fs) => {
            try {
              if (fs.existsSync(filePath)) {
                res.setHeader("Content-Type", "text/plain");
                res.end(fs.readFileSync(filePath, "utf-8"));
              } else {
                res.statusCode = 404;
                res.end("Not found");
              }
            } catch (err) {
              res.statusCode = 500;
              res.end("Error reading file");
            }
          });
        });
      },
    },
  ],
});
