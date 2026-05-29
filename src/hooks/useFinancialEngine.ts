import { useMemo } from 'react';
import { Transaction, Goal, StressTestState, SIP, IncomeStream } from '../types';

export function useFinancialEngine(
  transactions: Transaction[], 
  goals: Goal[], 
  monthlyBudget: number,
  stressTest: StressTestState,
  sips: SIP[] = [],
  incomeStreams: IncomeStream[] = []
) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const totalIncome = useMemo(() => 
    transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
  [transactions]);

  const totalExpenses = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const refunds = transactions.filter(t => t.type === 'refund').reduce((acc, t) => acc + t.amount, 0);
    return Math.max(0, expenses - refunds);
  }, [transactions]);

  const mandatoryExpenses = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense' && t.isMandatory).reduce((acc, t) => acc + t.amount, 0);
    // Usually refunds aren't "mandatory" but if mark them as such they should offset
    const refunds = transactions.filter(t => t.type === 'refund' && t.isMandatory).reduce((acc, t) => acc + t.amount, 0);
    return Math.max(0, expenses - refunds);
  }, [transactions]);

  const discretionaryExpenses = totalExpenses - mandatoryExpenses;

  const spentThisMonth = useMemo(() => {
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const expenses = monthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const refunds = monthTransactions.filter(t => t.type === 'refund').reduce((acc, t) => acc + t.amount, 0);
    
    return Math.max(0, expenses - refunds);
  }, [transactions, today]);

  const liquidAssets = useMemo(() => 
    goals.filter(g => g.type === 'savings' || g.type === 'investment' || g.type === 'lifestyle')
         .reduce((acc, g) => acc + g.currentAmount, 0),
  [goals]);

  // Derived Business Metrics
  const adjustedIncome = totalIncome * (stressTest.incomeShock || 1);
  const adjustedExpenses = totalExpenses * (stressTest.expenseShock || 1);
  const balance = useMemo(() => {
    const rawExp = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const rawRef = transactions.filter(t => t.type === 'refund').reduce((acc, t) => acc + t.amount, 0);
    return totalIncome - (rawExp - rawRef);
  }, [totalIncome, transactions]);

  const activeDailyPace = spentThisMonth / Math.max(1, today.getDate());
  const projectedMonthlyBurn = activeDailyPace * 30;
  const monthlyBurn = useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    if (expenseTransactions.length === 0 || transactions.length === 0) return 0;

    const firstDate = new Date(transactions[transactions.length - 1].date);
    const daysSinceFirst = Math.max(1, (today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Historical monthly burn based on entire transaction ledger
    const historicalMonthlyBurn = (totalExpenses / Math.max(1, daysSinceFirst)) * 30;
    
    // Strategic weighted blend: 
    // 70% current active month trajectory (projectedMonthlyBurn)
    // 30% all-time historical monthly burn
    if (projectedMonthlyBurn > 0) {
      return (projectedMonthlyBurn * 0.7) + (historicalMonthlyBurn * 0.3);
    }
    return historicalMonthlyBurn;
  }, [projectedMonthlyBurn, totalExpenses, transactions, today]);
  
  const runwayMonths = monthlyBurn > 0 ? (liquidAssets / (monthlyBurn * (stressTest.expenseShock || 1))) : 0;
  
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const leftToSpend = Math.max(0, monthlyBudget - spentThisMonth);
  const adjustedLeftToSpend = Math.max(0, (monthlyBudget * (stressTest.incomeShock || 1)) - (spentThisMonth * (stressTest.expenseShock || 1)));
  const budgetPercentage = (spentThisMonth / Math.max(1, monthlyBudget)) * 100;

  // Efficiency scores
  const savingsEfficiency = totalIncome > 0 ? (Math.max(0, totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const fixedRatio = totalExpenses > 0 ? (mandatoryExpenses / totalExpenses) * 100 : 0;

  const spentToday = useMemo(() => {
    const todayStr = today.toDateString();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return (t.type === 'expense' || t.type === 'refund') && d.toDateString() === todayStr;
    }).reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0);
  }, [transactions, today]);

  const last7Days = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return d.toDateString();
    });

    const dailyMap: Record<string, number> = {};
    dates.forEach(date => dailyMap[date] = 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    transactions.forEach(t => {
      if (t.type === 'expense' || t.type === 'refund') {
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0);
        if (tDate >= sevenDaysAgo) {
          const dateStr = tDate.toDateString();
          if (dailyMap[dateStr] !== undefined) {
            dailyMap[dateStr] += (t.type === 'expense' ? t.amount : -t.amount);
          }
        }
      }
    });

    return dates.map(dateStr => {
      const d = new Date(dateStr);
      return { 
        day: d.toLocaleDateString('en-GB', { weekday: 'short' }), 
        amount: dailyMap[dateStr] 
      };
    });
  }, [transactions, today]);

  const avgDailySpend = last7Days.reduce((acc, d) => acc + d.amount, 0) / 7;
  const remainingDays = Math.max(1, daysInMonth - today.getDate() + 1);

  // Strategic Spending Ceiling Logic (Personal CFO Mode)
  const monthlyGoalCommitments = useMemo(() => {
    const goalsCommitment = goals.reduce((acc, g) => {
      if (g.currentAmount >= g.targetAmount) return acc;
      
      // Use explicit EMI for debt goals
      if (g.type === 'debt' && g.emi) return acc + g.emi;
      
      // Use explicit monthlyContribution if defined
      if (g.monthlyContribution) return acc + g.monthlyContribution;

      // Fallback: calculate based on deadline
      if (g.deadline) {
        const deadline = new Date(g.deadline);
        const monthsRemaining = Math.max(1, (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        return acc + ((g.targetAmount - g.currentAmount) / monthsRemaining);
      }

      // Final fallback: 5% of target per month if no deadline
      return acc + (g.targetAmount * 0.05);
    }, 0);

    const sipsCommitment = sips
      .filter(s => s.status === 'active')
      .reduce((acc, s) => acc + s.amount, 0);

    return {
      goalsCommitment,
      sipsCommitment
    };
  }, [goals, today, sips]);

  // Use the average income of the last 3 months (or max available) as baseline
  const estimatedMonthlyIncome = useMemo(() => {
    // 1. Proactive Mandates (Fixed Baseline)
    const activeMandates = incomeStreams
      .filter(s => s.status === 'active')
      .reduce((acc, s) => acc + s.amount, 0);

    // 2. Historical Context (Variable/Freelance Baseline)
    const incomeThisMonth = transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'income' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      })
      .reduce((acc, t) => acc + t.amount, 0);
    
    // If we have mandates, use them as the floor. 
    // If history shows more (bonuses, freelance), we blend but mandates are the 'Continuity Baseline'.
    if (activeMandates > 0) return Math.max(activeMandates, incomeThisMonth);
    
    const incomes = transactions.filter(t => t.type === 'income');
    if (incomes.length === 0 || transactions.length === 0) return 0;
    
    const firstDate = new Date(transactions[transactions.length-1].date);
    const monthsSinceFirst = Math.max(1, (today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
    return totalIncome / monthsSinceFirst;
  }, [transactions, today, totalIncome]);

  // Fixed Costs = Mandatory expenses frequency normalized
  const estimatedFixedCosts = useMemo(() => {
    const mandatories = transactions.filter(t => (t.type === 'expense' || t.type === 'refund') && t.isMandatory);
    if (mandatories.length === 0) return 0;
    
    // Sum of unique mandatory costs in the last 30 days
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    return Math.max(0, mandatories
      .filter(t => new Date(t.date) >= thirtyDaysAgo)
      .reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0));
  }, [transactions, today]);

  const strategicSpendingCeiling = Math.max(0, estimatedMonthlyIncome - estimatedFixedCosts - monthlyGoalCommitments.goalsCommitment - monthlyGoalCommitments.sipsCommitment);
  const dailySpendingPower = strategicSpendingCeiling / daysInMonth;

  const totalDebtOutstanding = useMemo(() => 
    goals.filter(g => g.type === 'debt')
         .reduce((acc, g) => acc + (g.targetAmount - g.currentAmount), 0),
  [goals]);

  return {
    totalIncome,
    totalExpenses,
    mandatoryExpenses,
    discretionaryExpenses,
    spentThisMonth,
    spentToday,
    liquidAssets,
    totalDebtOutstanding,
    balance,
    runwayMonths,
    leftToSpend,
    adjustedLeftToSpend,
    budgetPercentage,
    savingsEfficiency,
    fixedRatio,
    monthlyBurn,
    activeDailyPace,
    today,
    daysInMonth,
    last7Days,
    avgDailySpend,
    remainingDays,
    estimatedFixedCosts,
    strategicSpendingCeiling,
    dailySpendingPower,
    monthlyGoalCommitments: monthlyGoalCommitments.goalsCommitment,
    sipMandates: monthlyGoalCommitments.sipsCommitment,
    estimatedMonthlyIncome,
    savingsRate: estimatedMonthlyIncome > 0 ? ((estimatedMonthlyIncome - monthlyBurn) / estimatedMonthlyIncome) * 100 : 0,
    incomeCoverage: monthlyBurn > 0 ? estimatedMonthlyIncome / monthlyBurn : 0
  };
}
