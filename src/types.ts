export type TransactionType = 'income' | 'expense';
export type GoalType = 'savings' | 'debt' | 'investment' | 'lifestyle';

export interface Transaction {
  id?: string;
  amount: number;
  category: string;
  subcategory?: string;
  date: string;
  description?: string;
  type: TransactionType;
  userId: string;
  isMandatory?: boolean;
  isRecurring?: boolean;
  isAvoidable?: boolean;
  linkedGoalId?: string;
}

export interface Goal {
  id?: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution?: number;
  type: GoalType;
  priority?: 'high' | 'medium' | 'low';
  userId: string;
  deadline?: string;
  // Loan specific fields
  interestRate?: number;
  tenureMonths?: number;
  emi?: number;
  startDate?: string;
}

export interface SIP {
  id?: string;
  name: string;
  amount: number;
  category: string;
  dayOfMonth: number;
  startDate: string;
  status: 'active' | 'paused' | 'stopped';
  userId: string;
  linkedGoalId?: string;
}

export interface StressTestState {
  incomeShock: number; // e.g., 0.8 for 20% drop
  expenseShock: number; // e.g., 1.2 for 20% increase
}
