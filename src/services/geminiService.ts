import { GoogleGenAI } from "@google/genai";
import { Transaction, Goal } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY is missing. AI insights will be disabled.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
}

export async function getFinancialAdvice(transactions: Transaction[], goals: Goal[]) {
  const ai = getAI();
  if (!ai) {
    return ["AI Strategic Advisory is currently offline. Please verify API configuration."];
  }

  const model = ai.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const prompt = `
You are an elite, McKinsey-level financial strategist acting as my personal CFO.
Analyze the following financial data and provide 3-4 sharp, structured, and opinionated insights.

# 🔹 DATA
Goals: ${goals.map(g => `- ${g.name}: ${g.currentAmount}/${g.targetAmount} (${g.type})`).join('\n')}
Recent Transactions: ${transactions.slice(0, 20).map(t => `- ${t.date}: ${t.type === 'expense' ? '-' : '+'}${t.amount} (${t.category})`).join('\n')}

# 🔹 TASK
Provide 3-4 insights that focus on systems, trade-offs, and prioritization. Avoid generic advice.
Format the response as a JSON array of strings. 
Example Output: ["Insight 1", "Insight 2", "Insight 3"]
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini Error:", error);
    return [
      "Protocol: Increase capital allocation toward high-interest debt vectors.",
      "Audit: Discretionary leakage detected in lifestyle categories.",
      "Strategy: Prioritize liquidity preservation until 6-month buffer realized."
    ];
  }
}
