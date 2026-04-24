import { describe, it, expect } from 'vitest';

// Core math logic extracted for testing (Artha AI Protocol)
export function calculateFinancialMetrics(
  transactions: any[],
  goals: any[],
  monthlyBudget: number,
  stressTest: { incomeShock: number, expenseShock: number },
  today: Date = new Date()
) {
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const liquidAssets = goals.filter(g => g.type === 'savings' || g.type === 'investment').reduce((acc, g) => acc + g.currentAmount, 0);
  
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const spentThisMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return t.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((acc, t) => acc + t.amount, 0);

  const activeDailyPace = spentThisMonth / Math.max(1, today.getDate());
  const projectedMonthlyBurn = activeDailyPace * 30;
  const monthlyBurn = projectedMonthlyBurn > 0 ? projectedMonthlyBurn : (totalExpenses / Math.max(1, transactions.length / 30 || 1));
  
  const runwayMonths = monthlyBurn > 0 ? (liquidAssets / (monthlyBurn * (stressTest.expenseShock || 1))) : 0;
  const budgetPercentage = (spentThisMonth / Math.max(1, monthlyBudget)) * 100;

  return { runwayMonths, budgetPercentage, monthlyBurn, liquidAssets };
}

describe('Artha AI Financial Engine Protocol', () => {
  const mockTransactions = [
    { type: 'income', amount: 100000, date: '2024-01-01', category: 'Salary' },
    { type: 'expense', amount: 20000, date: '2024-01-02', category: 'Rent' },
    { type: 'expense', amount: 5000, date: '2024-01-05', category: 'Food' }
  ];

  const mockGoals = [
    { type: 'savings', currentAmount: 100000, targetAmount: 500000 }
  ];

  it('calculates runway correctly with default stress test', () => {
    const today = new Date('2024-01-10'); // Mid month
    const result = calculateFinancialMetrics(mockTransactions, mockGoals, 50000, { incomeShock: 1, expenseShock: 1 }, today);
    
    // Day 10, spent 25k -> daily pace 2.5k -> monthly burn 75k
    // liquid assets 100k
    // runway = 100k / 75k = 1.33 months
    expect(result.runwayMonths).toBeCloseTo(1.33, 1);
  });

  it('guards against division by zero for monthly budget', () => {
    const result = calculateFinancialMetrics(mockTransactions, mockGoals, 0, { incomeShock: 1, expenseShock: 1 });
    expect(result.budgetPercentage).toBeDefined();
    expect(isFinite(result.budgetPercentage)).toBe(true);
  });

  it('adjusts runway during expense shock scenario', () => {
    const today = new Date('2024-01-10');
    const result = calculateFinancialMetrics(mockTransactions, mockGoals, 50000, { incomeShock: 1, expenseShock: 2 }, today);
    
    // monthly burn 75k * 2 = 150k
    // runway = 100k / 150k = 0.66 months
    expect(result.runwayMonths).toBeCloseTo(0.66, 1);
  });
});
