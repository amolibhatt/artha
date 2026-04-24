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
          <p className="text-xl font-sans font-bold uppercase tracking-tight text-brand-primary">No Debt Protocols Identified</p>
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
          <h3 className="text-2xl md:text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1">Debt Architect</h3>
          <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em] leading-relaxed py-0.5">Interest Minimization Engine</p>
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
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest">Monthly Prepayment</p>
                  <p className="text-2xl md:text-3xl font-mono font-bold text-brand-primary leading-tight tabular-nums py-0.5">{formatCurrency(prepayment)}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest">Interest Saved</p>
                  <p className="text-xl md:text-2xl font-mono font-bold text-brand-accent leading-tight py-0.5">{formatCurrency(impact.interestSaved)}</p>
                </div>
              </div>
              
              <input 
                type="range"
                min="0"
                max={Math.max(200000, (selectedLoan.targetAmount - selectedLoan.currentAmount) / 2)}
                step="5000"
                value={prepayment}
                onChange={(e) => setPrepayment(parseInt(e.target.value))}
                className="w-full h-1 bg-brand-bg rounded-full appearance-none cursor-pointer accent-brand-primary"
              />
              
              <div className="flex items-center gap-3 p-4 bg-brand-bg/50 rounded-xl border border-brand-border">
                <Zap className="w-4 h-4 text-brand-accent" />
                <p className="text-[10px] font-bold text-brand-primary/70 uppercase tracking-widest leading-relaxed">
                  Tenure Reduction: <span className="text-brand-accent inline-block px-1">{impact.monthsSaved} Months</span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Info className="w-3 h-3 text-brand-primary/30" />
                <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest">Opportunity Cost Analysis</p>
              </div>
              <p className="text-xs text-brand-primary/70 leading-relaxed">
                Deploying <span className="font-bold text-brand-primary inline-block px-1">{formatCurrency(prepayment)}</span> monthly saves <span className="font-bold text-brand-accent inline-block px-1">{formatCurrency(impact.interestSaved)}</span> in interest. 
                This is equivalent to a guaranteed <span className="font-bold text-brand-primary inline-block px-1">{(selectedLoan.interestRate || 8.5)}%</span> post-tax return.
              </p>
            </div>
          </div>

            <div className="bg-brand-bg/50 p-8 md:p-12 rounded-[2.5rem] border border-brand-border flex flex-col justify-center space-y-10 md:space-y-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:scale-150" />
              
              <div className="space-y-4 text-center relative z-10">
                <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-[0.4em] font-mono">Interest Trajectory</p>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center space-y-2">
                    <p className="text-[10px] text-brand-primary/20 uppercase font-bold tracking-widest whitespace-nowrap">Market Baseline</p>
                    <p className="text-lg md:text-xl font-mono font-bold text-brand-primary/20 line-through tabular-nums">{formatCurrency(impact.totalInterestWithoutPrepayment)}</p>
                  </div>
                  <div className="w-12 h-px bg-brand-primary/10 relative">
                    <ArrowRight className="w-4 h-4 text-brand-primary/20 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-[10px] text-brand-accent uppercase font-bold tracking-widest whitespace-nowrap">Optimized State</p>
                    <p className="text-2xl md:text-3xl font-mono font-bold text-brand-primary tabular-nums drop-shadow-sm leading-tight py-1">{formatCurrency(impact.totalInterestWithPrepayment)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="h-3 w-full bg-brand-bg rounded-full overflow-hidden flex border border-brand-border/50 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${impact.totalInterestWithoutPrepayment > 0 ? (impact.totalInterestWithPrepayment / impact.totalInterestWithoutPrepayment) * 100 : 0}%` }}
                    className="h-full bg-brand-accent rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  />
                </div>
                <div className="flex justify-center flex-col items-center gap-2">
                  <p className="text-4xl md:text-5xl font-mono font-bold text-brand-accent leading-tight py-2">
                    {impact.totalInterestWithoutPrepayment > 0 
                      ? (( (impact.totalInterestWithoutPrepayment - impact.totalInterestWithPrepayment) / impact.totalInterestWithoutPrepayment * 100 ).toFixed(0))
                      : '0'}%
                  </p>
                  <p className="text-[10px] text-brand-primary/30 font-bold uppercase tracking-[0.3em] font-mono">Interest Reduction Reclaimed</p>
                </div>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
