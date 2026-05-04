import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Goal } from "../types";
import { formatCurrency } from "../lib/utils";

/**
 * Unified Financial Intelligence Service
 * Powered by Google Gemini
 */

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateCFOStrategy = async (
  transactions: Transaction[], 
  goals: Goal[],
  mandatoryExpenses: number,
  discretionaryExpenses: number,
  totalIncome: number,
  savingsRate: number,
  incomeCoverage: number
): Promise<string> => {
  // Deep Audit Summarization
  const categorySummary = transactions.reduce((acc: any, t) => {
    acc[t.category] = (acc[t.category] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    return acc;
  }, {});

  const recentAnomalies = transactions
    .filter(t => t.type === 'expense' && t.amount > 5000)
    .slice(0, 5);

  const avoidableLeaks = transactions
    .filter(t => t.type === 'expense' && t.isAvoidable)
    .reduce((acc, t) => acc + t.amount, 0);

  const prompt = `
# PERSONAL CFO STRATEGY (MCKINSEY-LEVEL AUDIT)
You are a world-class financial strategist. Perform a ruthless strategic audit on the provided capital flows.

## FINANCIAL METRICS (AUDITED BASELINE)
- Continuity Baseline (Total Income): ${formatCurrency(totalIncome)}
- Core Expenditures (Mandatory): ${formatCurrency(mandatoryExpenses)}
- Discretionary Burn: ${formatCurrency(discretionaryExpenses)}
- Avoidable Capital Leakage: ${formatCurrency(avoidableLeaks)}
- Surplus Conversion (Savings Rate): ${savingsRate.toFixed(1)}%
- Asset Coverage (Income Multiple): ${incomeCoverage.toFixed(2)}x
- Efficiency Score (Safe Flow Ratio): ${totalIncome > 0 ? (((totalIncome - mandatoryExpenses) / totalIncome) * 100).toFixed(1) : 0}%

## ALLOCATION DATA
- Category Net Flow: ${JSON.stringify(categorySummary)}
- Goal Inventory: ${goals.map(g => `${g.name} (${g.type}): ${formatCurrency(g.currentAmount)}/${formatCurrency(g.targetAmount)} @ ${g.interestRate || 'N/A'}%`).join(', ')}
- High-Volume/High-Value Outflows: ${JSON.stringify(recentAnomalies)}

## CORE OPERATING PRINCIPLES
1. Dynamic over static -> Adapt to current flows
2. Sequence over parallel execution -> Prioritize junk debt payoff, then emergency fund, then growth
3. Cash flow realism over theoretical optimization
4. Capital protection for short-term goals
5. Clear trade-offs instead of forced balance

## REQUIRED RESPONSE STRUCTURE
1. Executive Summary (max 8 sharp bullets)
2. Strategic Allocation Model
3. Goal Timelines & Velocity
4. Phase-wise Implementation
5. Competitive Scenario Comparison
6. Tail-risk Mitigation

## TONE & STYLE
- Sharp, structured, and opinionated. 
- Professional consultant style. No generic advice.
- Always conclude with a "Strategic Bottom Line".
- Use Tailwind-compatible Markdown.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Strategic generation failed. Please review your manual entries.";
  } catch (error) {
    console.error("AI Strategy Error:", error);
    throw error;
  }
};

export const generateQuickInsights = async (
  transactions: Transaction[], 
  goals: Goal[],
  savingsRate: number,
  incomeCoverage: number
): Promise<string[]> => {
  const prompt = `
Analyze financial data and provide 3-4 sharp, structured 1-sentence insights.
DATA:
- Savings Rate: ${savingsRate.toFixed(1)}%
- Income Coverage: ${incomeCoverage.toFixed(2)}x
- Goals: ${goals.map(g => `- ${g.name}: ${g.currentAmount}/${g.targetAmount}`).join('\n')}
- Recent: ${transactions.slice(0, 5).map(t => `- ${t.category}: ${t.amount}`).join('\n')}

Return a JSON array of strings ONLY. Focus on capital efficiency and cash flow health.
Example: ["Insight 1", "Insight 2"]
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });
    
    let text = response.text || "[]";
    // Sanitize the response: extract only the JSON array if the model included extra text
    const bracketIndex = text.indexOf('[');
    const lastBracketIndex = text.lastIndexOf(']');
    
    if (bracketIndex !== -1 && lastBracketIndex !== -1) {
      text = text.substring(bracketIndex, lastBracketIndex + 1);
    }

    try {
      return JSON.parse(text) as string[];
    } catch (parseError) {
      console.warn("JSON Parse Error, attempting recovery:", parseError);
      // Fallback: If it's a list but failed to parse, try to find the match more aggressively
      const match = text.match(/\[.*\]/s);
      if (match) {
        return JSON.parse(match[0]) as string[];
      }
      throw parseError;
    }
  } catch (error) {
    console.error("AI Insights Error:", error);
    return [
      "Aggressive debt payoff recommended for high-interest loans.",
      "Discretionary leakage detected in lifestyle categories.",
      "Emergency fund buffer should be prioritized this quarter."
    ];
  }
};
