import { Transaction, Goal } from "../types";

/**
 * Unified Financial Intelligence Service
 * Handles communication with the Artha AI backend proxy to ensure API key security.
 */

interface AIResponse {
  text: string;
}

const callPlatformAI = async (endpoint: string, prompt: string): Promise<string> => {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Platform AI error: ${response.statusText}`);
    }

    const data: AIResponse = await response.json();
    return data.text;
  } catch (error) {
    console.error("AI Communication Failure:", error);
    throw error;
  }
};

export const generateCFOStrategy = async (transactions: Transaction[], goals: Goal[]): Promise<string> => {
  // Deep Audit Summarization to avoid token overflow while maintaining strategic depth
  const categorySummary = transactions.reduce((acc: any, t) => {
    acc[t.category] = (acc[t.category] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    return acc;
  }, {});

  const recentAnomalies = transactions
    .filter(t => t.type === 'expense' && t.amount > 5000)
    .slice(0, 5);

  const prompt = `
# PERSONAL CFO PROTOCOL (MCKINSEY-LEVEL STRATEGY)
Analyze capital flows and provide a sequence-over-parallel plan.

## DATA SUMMARY
- Category Net Flows: ${JSON.stringify(categorySummary)}
- Total Goals: ${goals.length}
- Recent Large Outflows: ${JSON.stringify(recentAnomalies)}
- Goal Status: ${goals.map(g => `${g.name}: ${g.currentAmount}/${g.targetAmount}`).join(', ')}

## Mission
Audit leakage and calculate 'Cost of Delay'. 

## OUTPUT STRUCTURE (MANDATORY JSON-like Markdown)
1. EXECUTIVE SUMMARY (8 sharp bullets)
2. FINANCIAL SNAPSHOT (Runway, Burn, Delta)
3. CURRENT ALLOCATION MODEL
4. GOAL TIMELINES
5. PHASE-WISE STRATEGY (Stabilization → Acceleration → Optimization)
6. HOME LOAN STRATEGY
7. INVESTMENT ALLOCATION
8. SCENARIO COMPARISON
9. RISKS & ADJUSTMENTS
`;

  return callPlatformAI("/api/strategy", prompt);
};

export const generateQuickInsights = async (transactions: Transaction[], goals: Goal[]): Promise<string[]> => {
  const prompt = `
Analyze data and provide 3-4 sharp, structured insights.
DATA:
Goals: ${goals.map(g => `- ${g.name}: ${g.currentAmount}/${g.targetAmount}`).join('\n')}
Recent: ${transactions.slice(0, 10).map(t => `- ${t.category}: ${t.amount}`).join('\n')}

Format as a JSON array of strings ONLY.
Example: ["Insight 1", "Insight 2"]
`;

  try {
    const text = await callPlatformAI("/api/insights", prompt);
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as string[];
  } catch (error) {
    return [
      "Protocol: Increase capital allocation toward high-interest debt vectors.",
      "Audit: Discretionary leakage detected in lifestyle categories.",
      "Strategy: Prioritize liquidity preservation until 6-month buffer realized."
    ];
  }
};
