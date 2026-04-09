export type TransactionType = 'income' | 'expense';
export type GoalType = 'savings' | 'debt' | 'investment';

export interface Transaction {
  id?: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  type: TransactionType;
  userId: string;
}

export interface Goal {
  id?: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution?: number;
  type: GoalType;
  userId: string;
  deadline?: string;
}
