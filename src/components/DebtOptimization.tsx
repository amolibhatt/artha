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
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [prepayment, setPrepayment] = useState(10000);

  // Sync selected loan if list changes or nothing selected
  React.useEffect(() => {
    if (loans.length > 0 && (!selectedLoanId || !loans.find(l => l.id === selectedLoanId))) {
      setSelectedLoanId(loans[0].id || null);
    }
  }, [loans, selectedLoanId]);

  const selectedLoan = loans.find(l => l.id === selectedLoanId);

  if (loans.length === 0) {
    return (
      <div className="bg-brand-surface p-8 md:p-12 border border-brand-border rounded-3xl shadow-sm text-center space-y-6">
        <div className="w-16 h-16 bg-brand-bg rounded-2xl flex items-center justify-center mx-auto">
          <Landmark className="w-8 h-8 text-brand-primary/20" />
        </div>
        <div className="space-y-2">
          <p className="text-xl font-sans font-bold uppercase tracking-tight text-brand-primary">No Loans Found</p>
          <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-widest">Add a loan goal to start planning</p>
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

    // Use user-provided EMI or calculate basic amortization
    const emi = loan.emi && loan.emi > 0 
      ? loan.emi 
      : (r > 0 
        ? (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : p / n);
    
    // Normal case: total interest if just paying EMI
    let normalBalance = p;
    let normalMonths = 0;
    let totalInterestWithoutPrepayment = 0;
    while (normalBalance > 0 && normalMonths < 600) { // Safety limit 50 years
      const interest = r > 0 ? normalBalance * r : 0;
      const principal = emi - interest;
      if (principal <= 0) {
        // If EMI is less than interest, interest is infinite.
        totalInterestWithoutPrepayment = 999999999;
        break;
      }
      totalInterestWithoutPrepayment += interest;
      normalBalance -= principal;
      normalMonths++;
    }

    // Prepayment case
    let balance = p;
    let months = 0;
    let totalInterestWithPrepayment = 0;

    while (balance > 0 && months < 600) {
      const interest = r > 0 ? balance * r : 0;
      const principal = emi + extraPayment - interest;
      
      if (principal <= 0) break;
      
      totalInterestWithPrepayment += interest;
      balance -= principal;
      months++;
    }

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);
    const normalPayoffDate = new Date();
    normalPayoffDate.setMonth(normalPayoffDate.getMonth() + normalMonths);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
    };

    const interestSaved = Math.max(0, totalInterestWithoutPrepayment - totalInterestWithPrepayment);
    const monthsSaved = Math.max(0, normalMonths - months);

    return {
      interestSaved,
      monthsSaved,
      totalInterestWithoutPrepayment,
      totalInterestWithPrepayment,
      emi,
      normalMonths,
      payoffDate: formatDate(payoffDate),
      normalPayoffDate: formatDate(normalPayoffDate)
    };
  };

  const impact = selectedLoan ? calculateImpact(selectedLoan, prepayment) : null;

  return (
    <div id="debt-optimization-engine" className="bg-brand-surface p-8 md:p-12 border border-brand-border rounded-[2.5rem] shadow-sm space-y-12 md:space-y-16 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-bg rounded-full blur-[120px] -mr-32 -mt-32 opacity-50" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <h3 className="section-header">Debt Payoff Plan</h3>
          <p className="data-label">Save on Interest</p>
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
                  <p className="data-label">Outstanding Balance</p>
                  <p className="text-3xl md:text-4xl font-mono font-bold text-brand-primary tracking-tight">{formatCurrency(selectedLoan.targetAmount - selectedLoan.currentAmount)}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="data-label">Interest Rate</p>
                  <p className="text-xl md:text-2xl font-mono font-bold text-brand-primary">{selectedLoan.interestRate || 8.5}%</p>
                </div>
              </div>

              <div className="flex justify-between items-end border-b border-brand-border pb-6">
                <div className="space-y-2">
                  <p className="data-label">Monthly EMI</p>
                  <p className="text-3xl md:text-4xl font-mono font-bold text-brand-primary tracking-tight">{formatCurrency(impact.emi)}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="data-label">Normal Tenure</p>
                  <p className="text-xl md:text-2xl font-mono font-bold text-brand-primary">{impact.normalMonths} Months</p>
                </div>
              </div>

              <div className="flex justify-between items-end border-b border-brand-border pb-6">
                <div className="space-y-2">
                  <p className="data-label">Extra Monthly Payment</p>
                  <p className="text-3xl md:text-4xl font-mono font-bold text-brand-primary tracking-tight">{formatCurrency(prepayment)}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="data-label !text-brand-accent">Money Saved</p>
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
                  <p className="data-label">Low</p>
                  <p className="data-label">High</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-5 bg-brand-primary text-brand-surface rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group/alert">
                <div className="w-10 h-10 bg-brand-accent/20 rounded-xl flex items-center justify-center border border-brand-accent/20 relative z-10">
                  <Zap className="w-5 h-5 text-brand-accent" />
                </div>
                <div className="relative z-10 flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="data-label !text-brand-accent">Debt-Free Date</p>
                      <p className="text-lg font-mono font-bold text-brand-surface tracking-tight">{impact.payoffDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="data-label !text-white/30 text-[7px]">Time Saved</p>
                      <p className="text-xs font-mono font-bold text-brand-accent">-{impact.monthsSaved}M</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-brand-bg/30 p-5 rounded-2xl border border-brand-border">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-brand-primary/20" />
                <p className="data-label">Why pay extra?</p>
              </div>
              <p className="text-xs text-brand-primary/60 font-medium leading-relaxed">
                Paying <span className="font-bold text-brand-primary">{formatCurrency(prepayment)}</span> extra each month goes straight to your principal, stopping interest from building up and saving you money.
              </p>
            </div>
          </div>

          <div className="bg-brand-primary text-brand-surface p-8 md:p-10 rounded-[2rem] flex flex-col justify-center space-y-10 md:space-y-12 relative overflow-hidden shadow-xl border border-white/10 group/metrics">
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-accent rounded-full blur-[100px] -mr-24 -mt-24 opacity-10" />
            
            <div className="space-y-6 text-center relative z-10">
              <p className="data-label !text-brand-surface/30">Interest & Timeline Comparison</p>
              <div className="flex items-center justify-center gap-6 md:gap-10">
                <div className="text-center space-y-2 opacity-30">
                  <p className="data-label !text-brand-surface/60">Normal ({impact.normalPayoffDate})</p>
                  <p className="text-lg md:text-xl font-mono font-bold line-through">{formatCurrency(impact.totalInterestWithoutPrepayment)}</p>
                </div>
                <div className="w-12 h-[1px] bg-white/20 relative">
                  <ArrowRight className="w-4 h-4 text-brand-accent absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center space-y-2">
                  <p className="data-label !text-brand-accent">Strategic ({impact.payoffDate})</p>
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
                    <p className="data-label !text-brand-surface/30">% SAVED</p>
                 </div>
               </div>
               <p className="data-label !text-brand-surface/10">Reducing your debt</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
