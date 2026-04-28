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
      
      // Safety break for negative amortization
      if (principal <= 0) break;
      
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
    <div id="debt-optimization-engine" className="bg-brand-surface p-8 md:p-12 border border-brand-border rounded-[2.5rem] shadow-sm space-y-12 md:space-y-16 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-bg rounded-full blur-[120px] -mr-32 -mt-32 opacity-50" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <h3 className="section-header">Debt Architect</h3>
          <p className="data-label">Interest Minimization Engine</p>
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
                  : "bg-brand-bg/50 text-brand-primary/30 border-brand-border hover:bg-brand-primary/5"
              )}
            >
              {loan.name}
            </button>
          ))}
        </div>
      </div>

      {selectedLoan && impact && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 relative z-10">
          <div className="space-y-10">
            <div className="space-y-8">
              <div className="flex justify-between items-end border-b border-brand-border pb-6">
                <div className="space-y-2">
                  <p className="data-label">Monthly Prepayment</p>
                  <p className="text-3xl md:text-4xl font-mono font-bold text-brand-primary tracking-tight">{formatCurrency(prepayment)}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="data-label !text-brand-accent">Capital Reclaimed</p>
                  <p className="text-xl md:text-2xl font-mono font-bold text-brand-accent">{formatCurrency(impact.interestSaved)}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <input 
                  type="range"
                  min="0"
                  max={Math.max(200000, (selectedLoan.targetAmount - selectedLoan.currentAmount) / 2)}
                  step="5000"
                  value={prepayment}
                  onChange={(e) => setPrepayment(parseInt(e.target.value))}
                  className="w-full h-1 bg-brand-bg rounded-full appearance-none cursor-pointer accent-brand-accent"
                />
                <div className="flex justify-between items-center opacity-30">
                  <p className="data-label">Conservative</p>
                  <p className="data-label">Aggressive</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-5 bg-brand-primary text-brand-surface rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group/alert">
                <div className="w-10 h-10 bg-brand-accent/20 rounded-xl flex items-center justify-center border border-brand-accent/20 relative z-10">
                  <Zap className="w-5 h-5 text-brand-accent" />
                </div>
                <div className="relative z-10">
                  <p className="data-label !text-brand-accent">Tenure Reduction</p>
                  <p className="text-base font-bold uppercase tracking-tight mt-0.5">
                    acceleration: <span className="text-brand-accent font-mono">{impact.monthsSaved} Months</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-brand-bg/30 p-5 rounded-2xl border border-brand-border">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-brand-primary/20" />
                <p className="data-label">Opportunity Cost Audit</p>
              </div>
              <p className="text-xs text-brand-primary/60 font-medium leading-relaxed">
                Deploying <span className="font-bold text-brand-primary">{formatCurrency(prepayment)}</span> monthly into this protocol generates a risk-adjusted return of <span className="font-bold text-brand-accent">{(selectedLoan.interestRate || 8.5)}%</span> IRR.
              </p>
            </div>
          </div>

          <div className="bg-brand-primary text-brand-surface p-8 md:p-10 rounded-[2rem] flex flex-col justify-center space-y-10 md:space-y-12 relative overflow-hidden shadow-xl border border-white/10 group/metrics">
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-accent rounded-full blur-[100px] -mr-24 -mt-24 opacity-10" />
            
            <div className="space-y-6 text-center relative z-10">
              <p className="data-label !text-brand-surface/30">Interest Trajectory</p>
              <div className="flex items-center justify-center gap-6 md:gap-10">
                <div className="text-center space-y-2 opacity-30">
                  <p className="data-label !text-brand-surface/60">Passive</p>
                  <p className="text-lg md:text-xl font-mono font-bold line-through">{formatCurrency(impact.totalInterestWithoutPrepayment)}</p>
                </div>
                <div className="w-12 h-[1px] bg-white/20 relative">
                  <ArrowRight className="w-4 h-4 text-brand-accent absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center space-y-2">
                  <p className="data-label !text-brand-accent">Active</p>
                  <p className="text-2xl md:text-3xl font-mono font-bold text-brand-surface">{formatCurrency(impact.totalInterestWithPrepayment)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6 relative z-10 text-center">
               <div className="relative inline-flex items-center justify-center">
                 <div className="w-40 h-40 md:w-44 md:h-44 rounded-full border-8 border-white/5 flex flex-col items-center justify-center gap-1">
                    <p className="text-5xl md:text-6xl font-mono font-bold text-brand-accent tracking-tighter leading-none">
                      {impact.totalInterestWithoutPrepayment > 0 
                        ? (( (impact.totalInterestWithoutPrepayment - impact.totalInterestWithPrepayment) / impact.totalInterestWithoutPrepayment * 100 ).toFixed(0))
                        : '0'}
                    </p>
                    <p className="data-label !text-brand-surface/30">% RECLAIMED</p>
                 </div>
               </div>
               <p className="data-label !text-brand-surface/10">Systemic Liability Reduction</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
