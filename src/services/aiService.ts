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

  const avoidableLeaks = transactions
    .filter(t => t.type === 'expense' && t.isAvoidable)
    .reduce((acc, t) => acc + t.amount, 0);

  const prompt = `
# PERSONAL CFO STRATEGY (MCKINSEY-LEVEL AUDIT)
You are a top-tier financial strategist. Analyze the provided data and generate a world-class financial strategy.

## DATA INPUT
- Category Net Flow: ${JSON.stringify(categorySummary)}
- Avoidable Capital Leakage: ${avoidableLeaks}
- Goal Inventory: ${goals.map(g => `${g.name} (${g.type}): ${g.currentAmount}/${g.targetAmount} @ ${g.interestRate || 'N/A'}%`).join(', ')}
- High-Volume/High-Value Outflows: ${JSON.stringify(recentAnomalies)}

## CORE OPERATING PRINCIPLES
1. Dynamic over static -> Adapt to flow
2. Sequence over parallel execution -> Prioritize junk debt payoff, then emergency fund, then growth
3. Cash flow realism over theoretical optimization
4. Capital protection for short-term goals
5. Clear trade-offs instead of forced balance

## REQUIRED RESPONSE STRUCTURE
1. **Executive Summary** (max 8 sharp bullets identifying the most critical tactical moves)
2. **Financial Snapshot** (Income vs Core Burn vs Growth Allocation)
3. **Current Allocation Model** (Analysis of where capital is flowing vs where it should flow)
4. **Goal Timelines** (Calculated ETAs based on current velocity)
5. **Phase-wise Strategy** (Stabilization -> Acceleration -> Optimization)
6. **Home Loan Strategy** (Aggressive prepayment vs market arbitrage if interest rates < 8%)
7. **Investment Allocation** (Core/Satellite model suggestions)
8. **Scenario Comparison** (Impact of reducing discretionary spend by 20%)
9. **Risks & Adjustments** (Tail-risk events and mitigation)

## TONE & STYLE
- Sharp, structured, and slightly opinionated.
- Professional consultant style. No generic advice.
- Focus on systems, trade-offs, and constraints.
- Use Markdown for structure.
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
    const jsonMatch = text.match(/\[.*\]/s);
    const cleaned = jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as string[];
  } catch (error) {
    return [
      "Try to put more money towards your high-interest loans first.",
      "Small extra spends are adding up. Take a look at your recent entries!",
      "Focus on building 6 months of savings for a safe emergency fund."
    ];
  }
};
