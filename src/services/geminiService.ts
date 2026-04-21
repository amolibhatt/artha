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

  const prompt = `
You are an elite, McKinsey-level financial strategist acting as my personal CFO.
Analyze the following financial data and provide 3-4 sharp, structured, and opinionated insights.

# 🔹 CORE OPERATING PRINCIPLES
1. Dynamic over static
2. Sequence over parallel execution
3. Cash flow realism
4. Capital protection
5. Clear trade-offs

# 🔹 DATA
Goals: ${goals.map(g => `- ${g.name}: ${g.currentAmount}/${g.targetAmount} (${g.type})`).join('\n')}
Recent Transactions: ${transactions.slice(0, 20).map(t => `- ${t.date}: ${t.type === 'expense' ? '-' : '+'}${t.amount} (${t.category})`).join('\n')}

# 🔹 TASK
Provide 3-4 insights that focus on systems, trade-offs, and prioritization. Avoid generic advice.
Format the response as a JSON array of strings.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini Error:", error);
    return ["Focus on consistent SIP contributions to build long-term wealth.", "Try to reduce discretionary spending in high-expense categories.", "Consider making small prepayments towards your home loan to save on interest."];
  }
}
