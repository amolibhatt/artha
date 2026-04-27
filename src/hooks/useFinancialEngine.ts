import { useMemo } from 'react';
import { Transaction, Goal, StressTestState } from '../types';

export function useFinancialEngine(
  transactions: Transaction[], 
  goals: Goal[], 
  monthlyBudget: number,
  stressTest: StressTestState
) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const totalIncome = useMemo(() => 
    transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0),
  [transactions]);

  const totalExpenses = useMemo(() => 
    transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0),
  [transactions]);

  const mandatoryExpenses = useMemo(() => 
    transactions.filter(t => t.type === 'expense' && t.isMandatory).reduce((acc, t) => acc + t.amount, 0),
  [transactions]);

  const discretionaryExpenses = totalExpenses - mandatoryExpenses;

  const spentThisMonth = useMemo(() => {
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    return transactions.filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, t) => acc + t.amount, 0);
  }, [transactions, today]);

  const liquidAssets = useMemo(() => 
    goals.filter(g => g.type === 'savings' || g.type === 'investment' || g.type === 'lifestyle')
         .reduce((acc, g) => acc + g.currentAmount, 0),
  [goals]);

  // Derived Business Metrics
  const adjustedIncome = totalIncome * (stressTest.incomeShock || 1);
  const adjustedExpenses = totalExpenses * (stressTest.expenseShock || 1);
  const balance = totalIncome - totalExpenses;

  const activeDailyPace = spentThisMonth / Math.max(1, today.getDate());
  const projectedMonthlyBurn = activeDailyPace * 30;
  const monthlyBurn = useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    if (expenseTransactions.length === 0) return 0;

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

  const spentToday = useMemo(() => 
    transactions.filter(t => t.type === 'expense' && new Date(t.date).getTime() >= today.getTime())
                .reduce((acc, t) => acc + t.amount, 0),
  [transactions, today]);

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
      if (t.type === 'expense') {
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0);
        if (tDate >= sevenDaysAgo) {
          const dateStr = tDate.toDateString();
          if (dailyMap[dateStr] !== undefined) {
            dailyMap[dateStr] += t.amount;
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

  return {
    totalIncome,
    totalExpenses,
    mandatoryExpenses,
    discretionaryExpenses,
    spentThisMonth,
    spentToday,
    liquidAssets,
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
    remainingDays
  };
}
