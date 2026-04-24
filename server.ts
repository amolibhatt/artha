import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Secure AI Initialization
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // API Proxy for Financial Strategy
  app.post("/api/strategy", async (req, res) => {
    try {
      const { prompt } = req.body;
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Strategy API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Proxy for Quick Insights
  app.post("/api/insights", async (req, res) => {
    try {
      const { prompt } = req.body;
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Insights API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Artha AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
