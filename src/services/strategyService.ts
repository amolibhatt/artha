import { GoogleGenAI } from "@google/genai";
import { Transaction, Goal } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const generateCFOStrategy = async (transactions: Transaction[], goals: Goal[]) => {
  const genAI = getAI();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
# PERSONAL CFO PROTOCOL (MCKINSEY-LEVEL STRATEGY)

## CONTEXT
You are an elite, sharp, and structured financial strategist. Your job is to audit my capital flow and provide a sequence-over-parallel plan and cash-flow realism.

## DATA INPUTS
- Transactions: ${JSON.stringify(transactions)}
- Goals: ${JSON.stringify(goals)}

## CORE OPERATING PRINCIPLES
1. Dynamic over static → Adapt to new income inputs.
2. Sequence over parallel execution → Prioritize intelligently.
3. Cash flow realism over theoretical optimization.
4. Capital protection for short-term goals.
5. Clear trade-offs instead of forced balance.

## RESPONSE FORMAT (MANDATORY)
1. **EXECUTIVE SUMMARY** (max 8 sharp, high-impact bullets)
2. **FINANCIAL SNAPSHOT** (Runway, Burn Rate, Net Delta)
3. **CURRENT ALLOCATION MODEL** (Based on latest income)
4. **GOAL TIMELINES** (Realistic projection based on burn)
5. **PHASE-WISE STRATEGY** (Stabilization → Acceleration → Optimization)
6. **HOME LOAN STRATEGY** (Prepayment arbitrage vs Opportunity cost)
7. **INVESTMENT ALLOCATION** (Specific vectors)
8. **SCENARIO COMPARISON** (Conservative vs. Aggressive)
9. **RISKS & ADJUSTMENTS**

## TONE
Sharp, structured, opinionated, consultant-level. Avoid generic advice. Focus on systems, trade-offs, and constraints.

## MISSION
Identify "Capital Leakage" (waste) and "Opportunity Cost." If my runway is low, provide a "War-Time" survival plan.
`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error generating CFO strategy:", error);
    throw error;
  }
};
