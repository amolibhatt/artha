import { GoogleGenAI } from "@google/genai";
import { Transaction, Goal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export const generateCFOStrategy = async (transactions: Transaction[], goals: Goal[]) => {
  const prompt = `
You are an elite, McKinsey-level financial strategist acting as my personal CFO. 
Your tone is sharp, direct, and focused on "Financial Leakage" and "Capital Efficiency." 
You do not give generic advice; you provide a high-pressure audit of my spending.

# 🔹 CORE OPERATING PRINCIPLES
1. Financial Leakage is a failure of strategy.
2. Every dollar spent on "unnecessary" categories is a direct delay to my Freedom Date.
3. Urgency is required: If my runway is low, your advice should be aggressive.

# 🔹 DATA INPUTS
Transactions: ${JSON.stringify(transactions)}
Goals: ${JSON.stringify(goals)}

# 🔹 TASK
Analyze the data and provide a structured financial audit:

1. LEAKAGE REPORT: Identify exactly where capital is being wasted. Flag discretionary spending as "Capital Leakage."
2. SURVIVAL ANALYSIS: Analyze the "Financial Runway." If it's under 180 days, provide a "Stabilization Plan" to cut all non-essential burn.
3. COST OF DELAY: Calculate how much my current spending habits are delaying my primary goals (e.g., "Your dining habit is delaying your Home Loan payoff by X months").
4. AGGRESSIVE ALLOCATION: Provide a "War-Time" allocation model for cutting fat and a "Peace-Time" model for growth.
5. HOME LOAN ARBITRAGE: Sharp analysis on prepayment vs. investment opportunity cost.

# 🔹 OUTPUT STRUCTURE (MANDATORY)
1. EXECUTIVE AUDIT (8 sharp, high-pressure bullets)
2. LEAKAGE ANALYSIS (Flag specific categories)
3. RUNWAY & SURVIVAL STRATEGY
4. GOAL PROJECTIONS & COST OF DELAY
5. WAR-TIME ALLOCATION MODEL
6. HOME LOAN & INVESTMENT ARBITRAGE
7. RISKS & IMMEDIATE ADJUSTMENTS
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating CFO strategy:", error);
    throw error;
  }
};
