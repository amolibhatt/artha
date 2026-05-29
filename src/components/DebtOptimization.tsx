import React, { useState } from 'react';
import { Landmark, ArrowRight, Zap, Info } from 'lucide-react';
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
      <div className="bg-brand-surface border border-brand-border rounded-xl p-4 text-center space-y-3">
        <div className="w-10 h-10 bg-brand-bg rounded-lg flex items-center justify-center mx-auto">
          <Landmark className="w-5 h-5 text-brand-primary/20" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-tight text-brand-primary">No Loans Tracked</p>
          <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Add a loan goal under Strategy to start planning prepayments</p>
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
    <div id="debt-optimization-engine" className="bg-brand-surface border border-brand-border rounded-xl p-4 md:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-4 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-bg rounded-full blur-3xl -mr-24 -mt-24 opacity-40" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-brand-border/40 pb-2.5">
        <div className="space-y-0.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Debt Payoff Plan</h3>
          <p className="text-[8px] font-bold text-brand-primary/30 uppercase tracking-widest">See how much interest you save by paying extra early</p>
        </div>
        
        <div className="flex gap-1.5 flex-wrap">
          {loans.map(loan => (
            <button
              key={loan.id}
              onClick={() => setSelectedLoanId(loan.id || null)}
              className={cn(
                "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest transition-all border leading-none",
                selectedLoanId === loan.id 
                  ? "bg-brand-primary text-brand-surface border-brand-primary shadow-sm" 
                  : "bg-brand-bg/50 text-brand-primary/30 border-brand-border hover:bg-brand-primary/5"
              )}
            >
              {loan.name}
            </button>
          ))}
        </div>
      </div>

      {selectedLoan && impact && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 relative z-10">
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-brand-bg/30 p-3 rounded-lg border border-brand-border/30">
              <div className="space-y-0.5">
                <p className="text-[8px] font-bold uppercase tracking-wider text-brand-primary/45">Remaining Loan Balance</p>
                <p className="text-sm font-mono font-bold text-brand-primary">{formatCurrency(selectedLoan.targetAmount - selectedLoan.currentAmount)}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-[8px] font-bold uppercase tracking-wider text-brand-primary/45">Interest Rate</p>
                <p className="text-sm font-mono font-bold text-brand-primary">{selectedLoan.interestRate || 8.5}%</p>
              </div>
              <div className="space-y-0.5 pt-2 border-t border-brand-border/25">
                <p className="text-[8px] font-bold uppercase tracking-wider text-brand-primary/45">Monthly EMI</p>
                <p className="text-sm font-mono font-bold text-brand-primary">{formatCurrency(impact.emi)}</p>
              </div>
              <div className="space-y-0.5 text-right pt-2 border-t border-brand-border/25">
                <p className="text-[8px] font-bold uppercase tracking-wider text-brand-primary/45">Original Months Left</p>
                <p className="text-sm font-mono font-bold text-brand-primary">{impact.normalMonths} Mo</p>
              </div>
            </div>

            <div className="space-y-1.5 p-3 bg-brand-bg/60 rounded-lg border border-brand-border/40">
              <div className="flex justify-between items-baseline">
                <p className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">Extra Monthly Payment</p>
                <span className="text-xs font-mono font-bold text-brand-accent">{formatCurrency(prepayment)}</span>
              </div>
              <input 
                type="range"
                min="0"
                max={Math.max(100000, (selectedLoan.targetAmount - selectedLoan.currentAmount) / 2)}
                step="5000"
                value={prepayment}
                onChange={(e) => setPrepayment(parseInt(e.target.value))}
                className="w-full h-1 bg-brand-border rounded-full appearance-none cursor-pointer accent-brand-accent"
              />
              <div className="flex justify-between items-center text-[7px] font-mono font-bold text-brand-primary/25 uppercase tracking-wider">
                <span>Low</span>
                <span>Move slider to adjust how much you pay extra</span>
                <span>High</span>
              </div>
            </div>

            <div className="p-3 bg-brand-primary text-brand-surface rounded-lg border border-white/5 shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex justify-between items-center text-[10px] leading-none">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">Fully Paid Off By</p>
                  <p className="text-sm font-mono font-bold text-brand-surface tracking-tight mt-1">{impact.payoffDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">Time Saved</p>
                  <p className="text-sm font-mono font-bold text-brand-accent mt-1">-{impact.monthsSaved} Months</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-brand-primary text-brand-surface p-4 rounded-lg flex flex-col justify-between space-y-4 shadow-md border border-white/5">
            <div className="space-y-3">
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/40 text-center">How Much You Save on Interest</p>
              
              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5 text-center">
                <div className="space-y-0.5 text-left">
                  <p className="text-[7px] font-bold text-white/30 uppercase tracking-wider">Normal Plan ({impact.normalPayoffDate})</p>
                  <p className="text-sm font-mono text-white/50 line-through leading-none">{formatCurrency(impact.totalInterestWithoutPrepayment)}</p>
                </div>
                <div className="shrink-0 text-white/20">
                  <ArrowRight className="w-3 h-3 text-brand-accent" />
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[7px] font-bold text-brand-accent uppercase tracking-wider">Paying Extra Early ({impact.payoffDate})</p>
                  <p className="text-sm font-mono font-bold text-brand-surface leading-none">{formatCurrency(impact.totalInterestWithPrepayment)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-brand-accent">Total Interest Saved</p>
                  <p className="text-lg font-mono font-black text-brand-accent leading-none">{formatCurrency(impact.interestSaved)}</p>
                </div>
                
                <div className="bg-white/5 px-2 py-1 rounded border border-white/5 flex flex-col items-center">
                  <span className="text-base font-mono font-black leading-none">
                    {impact.totalInterestWithoutPrepayment > 0 
                      ? (( (impact.totalInterestWithoutPrepayment - impact.totalInterestWithPrepayment) / impact.totalInterestWithoutPrepayment * 100 ).toFixed(0))
                      : '0'}%
                  </span>
                  <span className="text-[6px] font-bold opacity-35 uppercase tracking-wider mt-0.5">Off interest</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-white/5 rounded border border-white/10 flex gap-1.5 items-start text-[9px] font-sans">
              <Zap className="w-3.5 h-3.5 text-brand-accent shrink-0 mt-0.5 animate-pulse" />
              <p className="text-white/70 leading-normal">
                Every <span className="font-bold text-white">{formatCurrency(prepayment)}</span> added goes straight to the principal, skipping high early-stage interest charges.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
