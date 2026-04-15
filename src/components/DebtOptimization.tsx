import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Landmark, TrendingDown, ArrowRight, Zap, Info } from 'lucide-react';
import { Goal } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface DebtOptimizationProps {
  goals: Goal[];
}

export function DebtOptimization({ goals }: DebtOptimizationProps) {
  const loans = goals.filter(g => g.type === 'debt');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(loans[0]?.id || null);
  const [prepayment, setPrepayment] = useState(10000);

  const selectedLoan = loans.find(l => l.id === selectedLoanId);

  if (loans.length === 0) {
    return (
      <div className="bg-brand-surface p-8 md:p-12 border border-brand-border rounded-3xl shadow-sm text-center space-y-6">
        <div className="w-16 h-16 bg-brand-bg rounded-2xl flex items-center justify-center mx-auto">
          <Landmark className="w-8 h-8 text-brand-primary/20" />
        </div>
        <div className="space-y-2">
          <p className="text-xl font-serif italic text-brand-primary">No Debt Protocols Identified</p>
          <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-widest">Add a debt-type goal to enable optimization</p>
        </div>
      </div>
    );
  }

  // Basic EMI and Interest Calculation
  const calculateImpact = (loan: Goal, extraPayment: number) => {
    const p = loan.targetAmount - loan.currentAmount;
    const r = (loan.interestRate || 8.5) / 12 / 100;
    const n = loan.tenureMonths || 240;

    if (p <= 0) return null;

    const emi = r > 0 
      ? (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      : p / n;
    
    const totalInterestWithoutPrepayment = r > 0 ? (emi * n) - p : 0;

    // Simplified prepayment impact (reducing tenure)
    let balance = p;
    let months = 0;
    let totalInterestWithPrepayment = 0;

    while (balance > 0 && months < n) {
      const interest = r > 0 ? balance * r : 0;
      const principal = emi + extraPayment - interest;
      totalInterestWithPrepayment += interest;
      balance -= principal;
      months++;
    }

    const interestSaved = totalInterestWithoutPrepayment - totalInterestWithPrepayment;
    const monthsSaved = n - months;

    return {
      interestSaved,
      monthsSaved,
      totalInterestWithoutPrepayment,
      totalInterestWithPrepayment
    };
  };

  const impact = selectedLoan ? calculateImpact(selectedLoan, prepayment) : null;

  return (
    <div className="bg-brand-surface p-6 md:p-12 border border-brand-border rounded-3xl shadow-sm space-y-8 md:space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h3 className="text-2xl md:text-3xl font-serif italic text-brand-primary">Debt Architect</h3>
          <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em]">Interest Minimization Engine</p>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {loans.map(loan => (
            <button
              key={loan.id}
              onClick={() => setSelectedLoanId(loan.id || null)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                selectedLoanId === loan.id 
                  ? "bg-brand-primary text-brand-surface border-brand-primary shadow-lg" 
                  : "bg-brand-bg text-brand-primary/40 border-brand-border hover:bg-brand-primary/5"
              )}
            >
              {loan.name}
            </button>
          ))}
        </div>
      </div>

      {selectedLoan && impact && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          <div className="space-y-8 md:space-y-10">
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest">Monthly Prepayment</p>
                  <p className="text-2xl md:text-3xl font-serif italic text-brand-primary leading-none tabular-nums">{formatCurrency(prepayment)}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest">Interest Saved</p>
                  <p className="text-xl md:text-2xl font-serif italic text-brand-accent leading-none">{formatCurrency(impact.interestSaved)}</p>
                </div>
              </div>
              
              <input 
                type="range"
                min="0"
                max="100000"
                step="5000"
                value={prepayment}
                onChange={(e) => setPrepayment(parseInt(e.target.value))}
                className="w-full h-1 bg-brand-bg rounded-full appearance-none cursor-pointer accent-brand-primary"
              />
              
              <div className="flex items-center gap-3 p-4 bg-brand-bg/50 rounded-xl border border-brand-border">
                <Zap className="w-4 h-4 text-brand-accent" />
                <p className="text-[10px] font-bold text-brand-primary/60 uppercase tracking-widest">
                  Tenure Reduction: <span className="text-brand-accent">{impact.monthsSaved} Months</span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Info className="w-3 h-3 text-brand-primary/30" />
                <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest">Opportunity Cost Analysis</p>
              </div>
              <p className="text-xs text-brand-primary/60 leading-relaxed">
                Deploying <span className="font-bold text-brand-primary">{formatCurrency(prepayment)}</span> monthly saves <span className="font-bold text-brand-accent">{formatCurrency(impact.interestSaved)}</span> in interest. 
                This is equivalent to a guaranteed <span className="font-bold text-brand-primary">{(selectedLoan.interestRate || 8.5)}%</span> post-tax return.
              </p>
            </div>
          </div>

            <div className="bg-brand-bg/50 p-6 md:p-8 rounded-2xl border border-brand-border flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-2 text-center">
                <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Interest Trajectory</p>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-brand-primary/30 uppercase font-bold">Original</p>
                    <p className="text-base md:text-lg font-serif italic text-brand-primary/40 line-through">{formatCurrency(impact.totalInterestWithoutPrepayment)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-brand-primary/20" />
                  <div className="text-center">
                    <p className="text-[10px] text-brand-accent uppercase font-bold">Optimized</p>
                    <p className="text-xl md:text-2xl font-serif italic text-brand-primary">{formatCurrency(impact.totalInterestWithPrepayment)}</p>
                  </div>
                </div>
              </div>

            <div className="h-2 w-full bg-brand-bg rounded-full overflow-hidden flex">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${impact.totalInterestWithoutPrepayment > 0 ? (impact.totalInterestWithPrepayment / impact.totalInterestWithoutPrepayment) * 100 : 0}%` }}
                className="h-full bg-brand-accent"
              />
            </div>
            <p className="text-[10px] text-center text-brand-primary/30 font-bold uppercase tracking-widest">
              {impact.totalInterestWithoutPrepayment > 0 
                ? (( (impact.totalInterestWithoutPrepayment - impact.totalInterestWithPrepayment) / impact.totalInterestWithoutPrepayment * 100 ).toFixed(0))
                : '0'}% Interest Reduction
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
