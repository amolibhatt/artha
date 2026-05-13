import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Gemini API Proxy
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  app.post("/api/ai/strategy", async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Strategy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/insights", async (req, res) => {
    try {
      const { prompt, responseMimeType, responseSchema } = req.body;
      const response = await ai.models.generateContent({ 
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: responseMimeType || "text/plain",
          responseSchema: responseSchema || undefined,
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Insights Error:", error);
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
