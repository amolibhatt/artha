import React, { useState, useMemo } from 'react';
import { Landmark, ArrowRight, Zap, Info, Shield, HelpCircle, RefreshCcw, Landmark as BankIcon, Flame, DollarSign, BadgeAlert } from 'lucide-react';
import { Goal } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface DebtOptimizationProps {
  goals: Goal[];
  monthlySurplus?: number;
  liquidAssets?: number;
}

export function DebtOptimization({ goals, monthlySurplus = 0, liquidAssets = 0 }: DebtOptimizationProps) {
  const loans = goals.filter(g => g.type === 'debt');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  
  // Controls
  const [activeTab, setActiveTab] = useState<'prepayment' | 'offset'>('prepayment');
  const [prepayment, setPrepayment] = useState(10000);
  const [offsetInitial, setOffsetInitial] = useState(Math.min(50000, liquidAssets));
  const [offsetMonthly, setOffsetMonthly] = useState(Math.round(monthlySurplus * 0.5));
  const [sweepEnabled, setSweepEnabled] = useState(false);

  // Sync selected loan if list changes or nothing selected
  React.useEffect(() => {
    if (loans.length > 0 && (!selectedLoanId || !loans.find(l => l.id === selectedLoanId))) {
      setSelectedLoanId(loans[0].id || null);
    }
  }, [loans, selectedLoanId]);

  // Adjust initial slider ranges dynamically if assets / surplus change
  React.useEffect(() => {
    setOffsetInitial(Math.min(liquidAssets, 500000));
    setOffsetMonthly(Math.round(monthlySurplus * 0.5));
  }, [liquidAssets, monthlySurplus]);

  const selectedLoan = loans.find(l => l.id === selectedLoanId);

  // Calculate dynamic payoff sweep value
  const activeSweepValue = sweepEnabled ? Math.max(0, monthlySurplus) : 0;
  const effectiveMonthlyPrepayment = prepayment + activeSweepValue;

  // Basic Amortization / Impact Calculation
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

  // Offset Simulation Calculation
  const calculateOffsetImpact = (loan: Goal, initialOffset: number, monthlyOffset: number, extraPayment: number) => {
    const p = loan.targetAmount - loan.currentAmount;
    const r = (loan.interestRate || 8.5) / 12 / 100;
    const n = loan.tenureMonths || 240;

    if (p <= 0) return null;

    const emi = loan.emi && loan.emi > 0 
      ? loan.emi 
      : (r > 0 
        ? (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : p / n);

    // Baseline Normal Amortization
    let normalBalance = p;
    let normalMonths = 0;
    let normalInterest = 0;
    while (normalBalance > 0 && normalMonths < 600) {
      const interest = r > 0 ? normalBalance * r : 0;
      const principal = emi - interest;
      if (principal <= 0) {
        normalInterest = 999999999;
        break;
      }
      normalInterest += interest;
      normalBalance -= principal;
      normalMonths++;
    }

    // Offset simulation
    let balance = p;
    let months = 0;
    let offsetInterest = 0;
    let currentOffsetBal = initialOffset;

    while (balance > 0 && months < 600) {
      // Offset accumulates monthly savings + any sweep amount
      currentOffsetBal = Math.min(balance, currentOffsetBal + monthlyOffset);
      
      // Interest is ONLY calculated on the difference
      const effectiveBalance = Math.max(0, balance - currentOffsetBal);
      const interest = r > 0 ? effectiveBalance * r : 0;
      
      // Since interest is lower, a larger block of the fixed EMI eats the principal
      const principal = emi + extraPayment - interest;
      
      if (principal <= 0 && balance > 0) {
        break;
      }

      offsetInterest += interest;
      balance -= principal;
      months++;
    }

    const interestSaved = Math.max(0, normalInterest - offsetInterest);
    const monthsSaved = Math.max(0, normalMonths - months);

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);
    const normalPayoffDate = new Date();
    normalPayoffDate.setMonth(normalPayoffDate.getMonth() + normalMonths);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
    };

    return {
      interestSaved,
      monthsSaved,
      totalInterestWithoutPrepayment: normalInterest,
      totalInterestWithOffset: offsetInterest,
      emi,
      normalMonths,
      payoffDate: formatDate(payoffDate),
      normalPayoffDate: formatDate(normalPayoffDate)
    };
  };

  const impact = selectedLoan ? calculateImpact(selectedLoan, effectiveMonthlyPrepayment) : null;
  const offsetImpact = selectedLoan ? calculateOffsetImpact(selectedLoan, offsetInitial, offsetMonthly, activeSweepValue) : null;

  if (loans.length === 0) {
    return (
      <div id="debt-optimization-engine-empty" className="bg-brand-surface border border-brand-border rounded-xl p-4 text-center space-y-3">
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

  // Strategic analysis values for selected loan
  const loanRate = selectedLoan?.interestRate || 8.5;
  const marginalTaxRate = 0.30; // standard 30% tax bracket approximation
  const investmentHurdle = Number((loanRate / (1 - marginalTaxRate)).toFixed(2));

  return (
    <div id="debt-optimization-engine" className="bg-brand-surface border border-brand-border rounded-xl p-4 md:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-bg rounded-full blur-3xl -mr-24 -mt-24 opacity-40" />
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-brand-border/40 pb-3">
        <div className="space-y-0.5">
          <span className="text-[7.5px] font-mono font-bold text-brand-accent uppercase tracking-widest block">Institutional Leverage cockpit</span>
          <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Dynamic Debt Optimization Console</h3>
          <p className="text-[8px] font-bold text-brand-primary/30 uppercase tracking-widest">Simulate high-velocity deleveraging and liquidity offsets</p>
        </div>
        
        {/* Selector Pills */}
        <div className="flex gap-1.5 flex-wrap">
          {loans.map(loan => (
            <button
              key={loan.id}
              onClick={() => setSelectedLoanId(loan.id || null)}
              className={cn(
                "px-2.5 py-1 rounded text-[8px] font-mono font-bold uppercase tracking-wider transition-all border leading-none",
                selectedLoanId === loan.id 
                  ? "bg-brand-primary text-brand-surface border-brand-primary shadow-sm" 
                  : "bg-brand-bg/50 text-brand-primary/40 border-brand-border/60 hover:bg-brand-primary/5"
              )}
            >
              {loan.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Structural Tab Selector */}
      <div className="flex bg-brand-bg/70 p-1 rounded-xl border border-brand-border/40 max-w-sm relative z-10">
        <button
          type="button"
          onClick={() => setActiveTab('prepayment')}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
            activeTab === 'prepayment'
              ? "bg-brand-primary text-brand-surface shadow-sm font-black"
              : "text-brand-primary/45 hover:text-brand-primary"
          )}
        >
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          Prepayment Plan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('offset')}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
            activeTab === 'offset'
              ? "bg-brand-primary text-brand-surface shadow-sm font-black"
              : "text-brand-primary/45 hover:text-brand-primary"
          )}
        >
          <RefreshCcw className="w-3.5 h-3.5 text-sky-400" />
          Offset Simulator
        </button>
      </div>

      {selectedLoan && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
          
          {/* Controls and Input forms */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Unified Loan Diagnostics Grid */}
            <div className="grid grid-cols-2 gap-3 bg-brand-bg/30 p-3 rounded-xl border border-brand-border/30">
              <div className="space-y-0.5">
                <p className="text-[8px] font-mono font-bold uppercase tracking-wider text-brand-primary/45">Strategic Balance Owed</p>
                <p className="text-sm font-mono font-bold text-brand-primary">{formatCurrency(selectedLoan.targetAmount - selectedLoan.currentAmount)}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-[8px] font-mono font-bold uppercase tracking-wider text-brand-primary/45">Liability Interest Rate</p>
                <p className="text-sm font-mono font-bold text-brand-primary">{loanRate}%</p>
              </div>
              <div className="space-y-0.5 pt-2 border-t border-brand-border/25">
                <p className="text-[8px] font-mono font-bold uppercase tracking-wider text-brand-primary/45">Baseline Monthly EMI</p>
                <p className="text-sm font-mono font-bold text-brand-primary">{formatCurrency((activeTab === 'offset' ? offsetImpact : impact)?.emi || 0)}</p>
              </div>
              <div className="space-y-0.5 text-right pt-2 border-t border-brand-border/25">
                <p className="text-[8px] font-mono font-bold uppercase tracking-wider text-brand-primary/45">Contracted Months Left</p>
                <p className="text-sm font-mono font-bold text-brand-primary">{(activeTab === 'offset' ? offsetImpact : impact)?.normalMonths || 0} Mo</p>
              </div>
            </div>

            {/* Zero-Based Dynamic Sweep module (Consultant Special feature) */}
            <div className={cn(
              "p-3 rounded-xl border transition-all duration-300 relative overflow-hidden",
              sweepEnabled 
                ? "bg-emerald-500/[0.04] border-emerald-500/20 shadow-[0_2px_12px_rgba(16,185,129,0.04)]" 
                : "bg-brand-bg/60 border-brand-border/40"
            )}>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      {sweepEnabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                      <span className={cn("relative inline-flex rounded-full h-2 w-2", sweepEnabled ? "bg-emerald-500" : "bg-brand-primary/20")}></span>
                    </span>
                    <h4 className="text-[10px] font-mono font-black uppercase tracking-wider text-brand-primary">Zero-Based Dynamic Sweep</h4>
                  </div>
                  <p className="text-[8px] text-brand-primary/40 pl-4 font-mono font-bold uppercase tracking-wider leading-relaxed">
                    Auto-simulate routing fully unallocated monthly surplus ({formatCurrency(monthlySurplus)}) to highest-interest liability
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSweepEnabled(!sweepEnabled)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider transition-all select-none border whitespace-nowrap",
                    sweepEnabled
                      ? "bg-emerald-500 text-brand-surface border-emerald-500 shadow-md font-black"
                      : "bg-brand-bg text-brand-primary/40 border-brand-border/80 hover:text-brand-primary hover:bg-brand-primary/5"
                  )}
                >
                  {sweepEnabled ? 'PROTOCOL ON' : 'ENABLE'}
                </button>
              </div>
              {sweepEnabled && monthlySurplus > 0 && (
                <div className="mt-2.5 pt-2 border-t border-emerald-500/10 text-[8px] font-mono text-emerald-500 uppercase tracking-widest pl-4 animate-in fade-in">
                  🔥 Active Payoff Accelerator: +{formatCurrency(monthlySurplus)}/mo injected dynamically!
                </div>
              )}
            </div>

            {/* Tab specific sliders */}
            {activeTab === 'prepayment' ? (
              <div className="space-y-1.5 p-3.5 bg-brand-bg/60 rounded-xl border border-brand-border/40">
                <div className="flex justify-between items-baseline">
                  <p className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">Extra Monthly Payoff Commit</p>
                  <span className="text-xs font-mono font-bold text-brand-accent">
                    {formatCurrency(prepayment)} {sweepEnabled && <span className="text-[8px] text-emerald-500 font-normal">(+{formatCurrency(monthlySurplus)} Sweep)</span>}
                  </span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max={Math.max(100000, (selectedLoan.targetAmount - selectedLoan.currentAmount) / 2)}
                  step="5000"
                  value={prepayment}
                  onChange={(e) => setPrepayment(parseInt(e.target.value))}
                  className="w-full h-1 bg-brand-border rounded-full appearance-none cursor-pointer accent-brand-accent focus:outline-none"
                />
                <div className="flex justify-between items-center text-[7px] font-mono font-bold text-brand-primary/25 uppercase tracking-wider">
                  <span>Minimum</span>
                  <span>Adjust tactical monthly principal injection rate</span>
                  <span>Maximum</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Dynamic Offset initial capital slider */}
                <div className="space-y-1.5 p-3.5 bg-brand-bg/60 rounded-xl border border-brand-border/40">
                  <div className="flex justify-between items-baseline">
                    <p className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">Liquid Offset Cushion Capital</p>
                    <span className="text-xs font-mono font-bold text-sky-500">
                      {formatCurrency(offsetInitial)}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max={Math.max(selectedLoan.targetAmount - selectedLoan.currentAmount, liquidAssets || 100000)}
                    step="5000"
                    value={offsetInitial}
                    onChange={(e) => setOffsetInitial(parseInt(e.target.value))}
                    className="w-full h-1 bg-brand-border rounded-full appearance-none cursor-pointer accent-sky-500 focus:outline-none"
                  />
                  <div className="flex justify-between items-center text-[7.5px] font-mono font-bold text-brand-primary/30 uppercase tracking-wider">
                    <span>$0 (No Offset)</span>
                    <span>Liquid cash buffer kept inside linked interest-offset account</span>
                    <span>{formatCurrency(Math.max(selectedLoan.targetAmount - selectedLoan.currentAmount, liquidAssets))}</span>
                  </div>
                </div>

                {/* Offset monthly deposit top-up */}
                <div className="space-y-1.5 p-3.5 bg-brand-bg/60 rounded-xl border border-brand-border/40">
                  <div className="flex justify-between items-baseline">
                    <p className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">Monthly Offset Accumulation</p>
                    <span className="text-xs font-mono font-bold text-sky-500">
                      {formatCurrency(offsetMonthly)} {sweepEnabled && <span className="text-[8.5px] text-emerald-500 font-normal">(+{formatCurrency(monthlySurplus)} Sweep)</span>}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max={Math.max(50000, monthlySurplus * 2)}
                    step="2000"
                    value={offsetMonthly}
                    onChange={(e) => setOffsetMonthly(parseInt(e.target.value))}
                    className="w-full h-1 bg-brand-border rounded-full appearance-none cursor-pointer accent-sky-500 focus:outline-none"
                  />
                  <div className="flex justify-between items-center text-[7.5px] font-mono font-bold text-brand-primary/30 uppercase tracking-wider">
                    <span>$0</span>
                    <span>Recurring monthly deposits parked in offset account</span>
                    <span>{formatCurrency(Math.max(50000, monthlySurplus * 2))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Strategic Summary Cards */}
            <div className="p-3.5 bg-brand-primary text-brand-surface rounded-xl border border-white/5 shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex justify-between items-center text-[10px] leading-none">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">Expected Fully Paid Target</p>
                  <p className="text-xs sm:text-sm font-mono font-bold text-brand-surface tracking-tight mt-1">
                    {activeTab === 'prepayment' ? impact?.payoffDate : offsetImpact?.payoffDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">Retested Months Saved</p>
                  <p className="text-xs sm:text-sm font-mono font-black text-brand-accent mt-1">
                    -{activeTab === 'prepayment' ? impact?.monthsSaved : offsetImpact?.monthsSaved} Months
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Comparative Metrics and McKinsey style strategy break-even */}
          <div className="lg:col-span-5 bg-brand-primary text-brand-surface p-4 rounded-xl flex flex-col justify-between space-y-4 shadow-md border border-white/5 relative">
            <div className="space-y-3">
              <p className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-white/45 text-center">Liability Arbitrage Overview</p>
              
              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3 text-center">
                <div className="space-y-0.5 text-left">
                  <p className="text-[7.5px] font-mono font-bold text-white/30 uppercase tracking-wider">Normal Amortization</p>
                  <p className="text-xs sm:text-sm font-mono text-white/50 line-through leading-none">
                    {formatCurrency((activeTab === 'offset' ? offsetImpact : impact)?.totalInterestWithoutPrepayment || 0)}
                  </p>
                </div>
                <div className="shrink-0 text-white/20">
                  <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                </div>
                <div className="space-y-0.5 text-right">
                  <p className={cn(
                    "text-[7.5px] font-mono font-bold uppercase tracking-wider",
                    activeTab === 'offset' ? "text-sky-400" : "text-brand-accent"
                  )}>
                    {activeTab === 'offset' ? 'Offset Optimizer Strategy' : 'Strategic Prepayment'}
                  </p>
                  <p className="text-xs sm:text-sm font-mono font-bold text-brand-surface leading-none">
                    {formatCurrency(
                      activeTab === 'offset' 
                        ? (offsetImpact?.totalInterestWithOffset || 0) 
                        : (impact?.totalInterestWithPrepayment || 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Total Interest Saved widget */}
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-1">
                  <p className={cn(
                    "text-[8px] font-mono font-bold uppercase tracking-widest",
                    activeTab === 'offset' ? "text-sky-400" : "text-brand-accent"
                  )}>
                    Lifetime Interest Saved
                  </p>
                  <p className="text-lg font-mono font-black text-brand-surface leading-none">
                    {formatCurrency(
                      activeTab === 'offset' ? (offsetImpact?.interestSaved || 0) : (impact?.interestSaved || 0)
                    )}
                  </p>
                </div>
                
                <div className="bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10 flex flex-col items-center">
                  <span className={cn(
                    "text-lg font-mono font-black leading-none",
                    activeTab === 'offset' ? "text-sky-400" : "text-brand-accent"
                  )}>
                    {(() => {
                      const baselineInt = (activeTab === 'offset' ? offsetImpact : impact)?.totalInterestWithoutPrepayment || 0;
                      const savedInt = activeTab === 'offset' ? (offsetImpact?.interestSaved || 0) : (impact?.interestSaved || 0);
                      return baselineInt > 0 ? ((savedInt / baselineInt) * 100).toFixed(0) : '0';
                    })()}%
                  </span>
                  <span className="text-[6px] font-bold opacity-40 uppercase tracking-widest mt-1">Off Interest</span>
                </div>
              </div>
            </div>

            {/* Strategic McKinsey Advice Panel - Dynamic Break-Even Point / Arbitrage analysis */}
            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10 space-y-2.5">
              <div className="flex items-center gap-1.5 text-brand-surface border-b border-white/5 pb-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[8px] font-mono font-bold uppercase tracking-wider block">CFO Strategy Matrix</span>
              </div>
              
              <div className="space-y-2 text-[9.5px] leading-relaxed text-white/80 font-mono">
                <p>
                  • <b className="text-white uppercase">Guaranteed ROI:</b> Parks cash to offset <span className="text-emerald-400 font-bold">{loanRate}%</span> debt interest. This is a 100% risk-free, tax-exempt yield equivalence.
                </p>
                <p>
                  • <b className="text-white uppercase">Pre-Tax Hurdle Loop:</b> To logically beat this via external investments, your pre-tax asset yields must cross <span className="text-brand-accent font-bold">{investmentHurdle}%</span> (accounting for {marginalTaxRate * 100}% marginal taxes).
                </p>
                <div className="pt-1 text-[8.5px] text-white/50 leading-normal border-t border-white/5">
                  {activeTab === 'offset' ? (
                    <p className="text-sky-300">
                      💡 <b>Offset Advantage:</b> Your cash of <b className="text-white">{formatCurrency(offsetInitial)}</b> is kept completely liquid and accessible as emergency reserves while saving interest. Outright prepayment locks those funds away forever.
                    </p>
                  ) : (
                    <p className="text-brand-accent">
                      💡 <b>Prepayment Verdict:</b> Prepayments lock down cash permanently. Ensure you have at least 3-6 months of emergency surplus before locking capital in direct prepayment. Consider the Offset tab for dual liquidity advantages.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
