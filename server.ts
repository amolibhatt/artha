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

  // Gemini API Proxy Helper
  const getGeminiClient = () => {
    const activeKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
    if (!activeKey) {
      throw new Error("Gemini API key is missing. Please select an API Key in the Secrets panel (Settings > Secrets).");
    }
    return {
      client: new GoogleGenAI({ 
        apiKey: activeKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      }),
      apiKey: activeKey
    };
  };

  app.post("/api/ai/strategy", async (req, res) => {
    try {
      const activeKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
      if (!activeKey) {
        console.warn("AI CFO Notice: Gemini API key is missing in environment.");
        return res.status(401).json({
          error: "Gemini API key is missing. Please select an API Key in the Secrets panel (Settings > Secrets).",
          details: "Gemini API key is missing. Please select an API Key in the Secrets panel (Settings > Secrets)."
        });
      }

      const { prompt } = req.body;
      const { client } = getGeminiClient();
      
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.warn("AI CFO Notice - Strategy calculation warning:", error.message || error);
      res.status(error.status || 500).json({ 
        error: error.message,
        details: error.status === 403 ? "Authentication failed. Please ensure you have selected a valid Gemini API Key in the 'Secrets' panel in AI Studio Settings." : "Internal AI Error"
      });
    }
  });

  app.post("/api/ai/insights", async (req, res) => {
    try {
      const activeKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
      if (!activeKey) {
        console.warn("AI CFO Notice: Gemini API key is missing in environment.");
        return res.status(401).json({
          error: "Gemini API key is missing. Please select an API Key in the Secrets panel (Settings > Secrets).",
          details: "Gemini API key is missing. Please select an API Key in the Secrets panel (Settings > Secrets)."
        });
      }

      const { prompt, responseMimeType, responseSchema } = req.body;
      const { client } = getGeminiClient();

      const response = await client.models.generateContent({ 
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: responseMimeType || "text/plain",
          responseSchema: responseSchema || undefined,
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.warn("AI CFO Notice - Insights generation warning:", error.message || error);
      res.status(error.status || 500).json({ 
        error: error.message,
        details: error.status === 403 ? "Authentication failed. Please ensure you have selected a valid Gemini API Key in the 'Secrets' panel in AI Studio Settings." : "Internal AI Error"
      });
    }
  });

  app.get("/api/ai/health", (req, res) => {
    const activeKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
    res.json({ 
      status: "ok", 
      ai_configured: !!activeKey,
      key_prefix: activeKey ? activeKey.substring(0, 4) + "..." : "NONE"
    });
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
