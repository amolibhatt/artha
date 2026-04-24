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
    goals.filter(g => g.type === 'savings' || g.type === 'investment')
         .reduce((acc, g) => acc + g.currentAmount, 0),
  [goals]);

  // Derived Business Metrics
  const adjustedIncome = totalIncome * (stressTest.incomeShock || 1);
  const adjustedExpenses = totalExpenses * (stressTest.expenseShock || 1);
  const balance = totalIncome - totalExpenses;

  const activeDailyPace = spentThisMonth / Math.max(1, today.getDate());
  const projectedMonthlyBurn = activeDailyPace * 30;
  const monthlyBurn = projectedMonthlyBurn > 0 ? projectedMonthlyBurn : (totalExpenses / Math.max(1, transactions.length / 30 || 1));
  
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

  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const amount = transactions
      .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === d.toDateString())
      .reduce((acc, t) => acc + t.amount, 0);
    return { day: d.toLocaleDateString('en-GB', { weekday: 'short' }), amount };
  }), [transactions]);

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
