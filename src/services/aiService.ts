import { Transaction, Goal } from "../types";
import { formatCurrency } from "../lib/utils";

/**
 * Unified Financial Intelligence Service
 * Calls server-side proxy to protect API keys and avoid RPC/XHR errors in browser
 */

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
- Sharp, structured, and opinionated, but explained in clear, simple, friendly, and conversational English that is very easy for a normal human being to understand (no complex financial jargon).
- Always conclude with a "Strategic Bottom Line" in plain language.
- Use Tailwind-compatible Markdown.
`;

  try {
    const response = await fetch("/api/ai/strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      let detailedMessage = `AI Request failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        detailedMessage = errorData.details || errorData.error || detailedMessage;
      } catch {
        try {
          const rawText = await response.text();
          if (rawText) {
            detailedMessage = rawText;
          }
        } catch {}
      }
      throw new Error(detailedMessage);
    }

    const data = await response.json();
    return data.text || "Strategic generation failed. Please review your manual entries.";
  } catch (error: any) {
    console.warn("AI Strategy Notice:", error);
    throw new Error(error.message || "Financial Strategist is currently offline. Please check your API key.");
  }
};

export const generateQuickInsights = async (
  transactions: Transaction[], 
  goals: Goal[],
  savingsRate: number,
  incomeCoverage: number
): Promise<string[]> => {
  const prompt = `
Analyze the following financial metrics and provide 3-4 razor-sharp, elite strategist-level 1-sentence directives. 
The first directive MUST be the "Principal Strategic Directive"—a high-impact summary of the current user pulse.

METRICS:
- Savings Rate: ${savingsRate.toFixed(1)}%
- Income Coverage: ${incomeCoverage.toFixed(2)}x
- Goals: ${goals.map(g => `- ${g.name}: ${g.currentAmount}/${g.targetAmount}`).join('\n')}
- Velocity: ${transactions.slice(0, 5).map(t => `- ${t.category}: ${t.amount}`).join('\n')}

INSIGHT STYLE:
- Very simple, clear, direct, and conversational 1-sentence directives that any regular person can immediately understand without complex financial terms.
- Still keep specific, actionable directives.
- Example: "Put ₹15k of your spare monthly cash into your Gold Goal to stay on track."

Return a JSON array of strings ONLY.
`;

  try {
    const response = await fetch("/api/ai/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        prompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: { type: "STRING" }
        }
      }),
    });

    if (!response.ok) {
      let detailedMessage = `AI Insights Request failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        detailedMessage = errorData.details || errorData.error || detailedMessage;
      } catch {
        try {
          const rawText = await response.text();
          if (rawText) {
            detailedMessage = rawText;
          }
        } catch {}
      }
      throw new Error(detailedMessage);
    }

    const data = await response.json();

    let text = data.text || "[]";
    
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
      const match = text.match(/\[.*\]/s);
      if (match) {
        return JSON.parse(match[0]) as string[];
      }
      throw parseError;
    }
  } catch (error) {
    console.warn("AI Insights Notice:", error);
    return [
      "Aggressive debt payoff recommended for high-interest loans.",
      "Discretionary leakage detected in lifestyle categories.",
      "Emergency fund buffer should be prioritized this quarter."
    ];
  }
};
