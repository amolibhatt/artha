import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Sparkles, TrendingUp, AlertCircle, Loader2, ShieldCheck, Compass, AlertTriangle, Landmark, Zap, ArrowUpRight } from 'lucide-react';
import { Transaction, Goal } from '../types';
import { generateCFOStrategy } from '../services/aiService';
import { cn, formatCurrency } from '../lib/utils';

interface StrategyInsightsProps {
  transactions: Transaction[];
  goals: Goal[];
  balance: number;
  totalIncome: number;
  totalSavings: number;
  mandatoryExpenses: number;
  discretionaryExpenses: number;
  strategicSpendingCeiling: number;
  dailySpendingPower: number;
  monthlyGoalCommitments: number;
  savingsRate: number;
  incomeCoverage: number;
  estimatedMonthlyIncome: number;
  estimatedFixedCosts: number;
}

export function StrategyInsights({ 
  transactions, 
  goals, 
  balance, 
  totalIncome, 
  totalSavings,
  mandatoryExpenses,
  discretionaryExpenses,
  strategicSpendingCeiling,
  dailySpendingPower,
  monthlyGoalCommitments,
  savingsRate,
  incomeCoverage,
  estimatedMonthlyIncome,
  estimatedFixedCosts
}: StrategyInsightsProps) {
  const [strategy, setStrategy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAuditSnapshot, setLastAuditSnapshot] = useState<{ balance: number, count: number } | null>(null);

  const totalExpenses = mandatoryExpenses + discretionaryExpenses;
  const fixedRatio = totalExpenses > 0 ? (mandatoryExpenses / totalExpenses) * 100 : 0;
  const discretionaryRatio = 100 - fixedRatio;

  // Strategic Drift Detection
  const isDriftDetected = React.useMemo(() => {
    if (!lastAuditSnapshot || !strategy) return false;
    const balanceDrift = Math.abs((balance - lastAuditSnapshot.balance) / (lastAuditSnapshot.balance || 1)) > 0.15;
    const volumeDrift = Math.abs(transactions.length - lastAuditSnapshot.count) >= 3;
    return balanceDrift || volumeDrift;
  }, [balance, transactions.length, lastAuditSnapshot, strategy]);

  // Capital Efficiency Score: (Income - Mandatory) / Income
  const efficiencyScore = estimatedMonthlyIncome > 0 ? ((estimatedMonthlyIncome - estimatedFixedCosts) / estimatedMonthlyIncome) * 100 : 0;

  // Identify "Structural Waste" - Discretionary categories that are high
  const wasteAnalysis = transactions
    .filter(t => {
      const d = new Date(t.date);
      const isThisMonth = d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
      return isThisMonth && t.type === 'expense' && !t.isMandatory;
    })
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const topWaste = Object.entries(wasteAnalysis)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // Subscription Audit
  const subscriptionAudit = React.useMemo(() => {
    const counts: Record<string, { amounts: Set<number>, dates: Date[] }> = {};
    transactions.forEach(t => {
      if (t.type === 'expense') {
        if (!counts[t.description]) counts[t.description] = { amounts: new Set(), dates: [] };
        counts[t.description].amounts.add(t.amount);
        counts[t.description].dates.push(new Date(t.date));
      }
    });

    return Object.entries(counts)
      .filter(([_, data]) => data.dates.length >= 2 && data.amounts.size === 1)
      .map(([name, data]) => ({
        name,
        amount: Array.from(data.amounts)[0],
        frequency: 'Monthly'
      }));
  }, [transactions]);

  // Spending Velocity
  const velocityAudit = React.useMemo(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const currentMonthDiscretionary = transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === 'expense' && !t.isMandatory;
      })
      .reduce((acc, t) => acc + t.amount, 0);

    const lastMonthDiscretionary = transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear() && t.type === 'expense' && !t.isMandatory;
      })
      .reduce((acc, t) => acc + t.amount, 0);

    const change = lastMonthDiscretionary > 0 ? ((currentMonthDiscretionary - lastMonthDiscretionary) / lastMonthDiscretionary) * 100 : 0;
    
    return { currentMonthDiscretionary, lastMonthDiscretionary, change };
  }, [transactions]);

  useEffect(() => {
    if (transactions.length === 0 || goals.length === 0) {
      setStrategy("");
    }
  }, [transactions.length, goals.length]);

  useEffect(() => {
    if (transactions.length > 0 && !strategy && !isLoading && !error) {
      handleGenerate();
    }
  }, [transactions.length, goals.length, strategy]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateCFOStrategy(
        transactions, 
        goals,
        mandatoryExpenses,
        discretionaryExpenses,
        totalIncome,
        savingsRate,
        incomeCoverage
      );
      setStrategy(result || "Unable to generate strategy at this time.");
      setLastAuditSnapshot({ balance, count: transactions.length });
    } catch (err: any) {
      console.error("Strategy generation failed:", err);
      try {
        const errorObj = JSON.parse(err.message);
        setError(errorObj.details || errorObj.error || "Failed to generate strategy. Please check your setup.");
      } catch {
        setError(err.message || "Failed to generate strategy. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const leakAudit = React.useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense' && t.isAvoidable)
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  return (
    <div className="space-y-6 pb-12">
      {/* Strategic Vision Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-3.5 px-0.5">
        <div className="space-y-0.5 max-w-md">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
            <span className="text-[8px] font-bold text-brand-primary/45 uppercase tracking-wider">Financial Overview</span>
          </div>
          <h2 className="text-base font-sans font-black uppercase tracking-tight text-brand-primary">Where Your Money Goes</h2>
          <p className="text-[10px] text-brand-primary/50 font-normal leading-normal">
            A simple, clear breakdown of your monthly money flow. Our goal is to help you pay off loans faster, cut unnecessary spends, and plan your savings safely.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="px-3 py-1.5 bg-brand-surface border border-brand-border/60 rounded-lg flex flex-col justify-center min-w-[100px] shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
            <p className="text-[7px] font-bold text-brand-primary/40 uppercase tracking-widest">Extra Spends</p>
            <div className="flex items-center gap-1 mt-0.5">
               <div className={cn("w-1 h-1 rounded-full", leakAudit > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
               <p className="text-xs font-mono font-bold text-brand-primary">{leakAudit > 0 ? 'ALERT' : 'CLEAN'}</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-brand-primary rounded-lg flex flex-col justify-center min-w-[110px] shadow-sm text-brand-surface">
            <p className="text-[7px] font-bold text-white/35 uppercase tracking-widest">Spare Cash Left Over</p>
            <p className="text-xs font-mono font-bold text-brand-accent mt-0.5 leading-none">{formatCurrency(strategicSpendingCeiling)}</p>
          </div>
        </div>
      </div>

      {/* Efficiency & Velocity Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-brand-surface p-3 border border-brand-border/60 rounded-xl space-y-2 relative overflow-hidden">
          <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Budget Health</p>
          <div className="flex items-baseline justify-between">
            <h4 className="text-lg font-mono font-bold text-brand-primary leading-none">{efficiencyScore.toFixed(0)}%</h4>
            <span className={cn(
              "text-[7px] font-bold px-1 py-0.5 rounded leading-none border",
              efficiencyScore > 40 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
              {efficiencyScore > 40 ? 'OK' : 'IMPROVE'}
            </span>
          </div>
          <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden p-0.5 border border-brand-border/40">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${efficiencyScore}%` }}
              className={cn("h-full rounded-full transition-all duration-1000", efficiencyScore > 40 ? "bg-emerald-500" : "bg-rose-500")}
            />
          </div>
        </div>

        <div className="bg-brand-surface p-3 border border-brand-border/60 rounded-xl space-y-2 relative overflow-hidden">
          <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Spending Trend</p>
          <div className="flex items-baseline justify-between">
            <h4 className="text-lg font-mono font-bold text-brand-primary leading-none">
              {velocityAudit.change > 0 ? '+' : ''}{velocityAudit.change.toFixed(0)}%
            </h4>
            <span className={cn(
              "text-[7px] font-bold px-1 py-0.5 rounded leading-none border",
              velocityAudit.change <= 5 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
              {velocityAudit.change <= 5 ? 'STABLE' : 'RISING'}
            </span>
          </div>
          <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden relative p-0.5 border border-brand-border/40">
             <div className={cn(
               "h-full rounded-full transition-all duration-1000",
               velocityAudit.change > 0 ? "bg-rose-500" : "bg-emerald-500"
             )} style={{ width: `${Math.min(Math.abs(velocityAudit.change), 100)}%` }} />
          </div>
        </div>

        <div className="bg-brand-surface p-3 border border-brand-border/60 rounded-xl space-y-2 relative overflow-hidden">
          <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Necessary Bills</p>
          <div className="flex items-baseline justify-between">
            <h4 className="text-lg font-mono font-bold text-brand-primary leading-none">{fixedRatio.toFixed(0)}%</h4>
            <p className="text-[8px] font-mono opacity-30">MUST PAY</p>
          </div>
          <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden p-0.5 border border-brand-border/40">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${fixedRatio}%` }}
               className="h-full bg-brand-primary rounded-full"
            />
          </div>
        </div>

        <div className="bg-brand-surface p-3 border border-brand-border/60 rounded-xl space-y-2 relative overflow-hidden">
          <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Avoidable Spends</p>
          <div className="flex items-baseline justify-between">
            <h4 className={cn(
              "text-lg font-mono font-bold leading-none",
              leakAudit > 0 ? "text-rose-500" : "text-brand-primary"
            )}>
              {formatCurrency(leakAudit)}
            </h4>
            <span className={cn(
              "text-[7px] font-bold px-1 py-0.5 rounded leading-none border",
              leakAudit === 0 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
               {leakAudit === 0 ? 'CLEAN' : 'LEAK'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[8px] leading-none text-brand-primary/30 font-bold uppercase tracking-wider">
            <div className={cn("w-1 h-1 rounded-full", leakAudit > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
            <span>Total of avoidable spends</span>
          </div>
        </div>
      </div>

      {/* Forensics Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
         <div className="bg-brand-surface border border-brand-border/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
           <div className="space-y-0.5">
             <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Savings Rate</p>
             <h4 className="text-base font-mono font-bold text-brand-primary">{savingsRate.toFixed(1)}%</h4>
             <p className="text-[7px] font-medium text-brand-primary/30 uppercase tracking-widest">How much of your income is saved</p>
           </div>
           <span className={cn(
             "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border leading-none",
             savingsRate > 20 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
           )}>
             {savingsRate > 40 ? 'Excellent' : savingsRate > 20 ? 'Good' : 'Low Savings'}
           </span>
         </div>
         <div className="bg-brand-surface border border-brand-border/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
           <div className="space-y-0.5">
             <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Emergency Backup</p>
             <h4 className="text-base font-mono font-bold text-brand-primary">{incomeCoverage.toFixed(1)}x</h4>
             <p className="text-[7px] font-medium text-brand-primary/30 uppercase tracking-widest">Months your backup covers monthly costs</p>
           </div>
           <span className={cn(
             "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border leading-none",
             incomeCoverage >= 1 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
           )}>
             {incomeCoverage > 2 ? 'Strong' : incomeCoverage >= 1 ? 'Stable' : 'Risk'}
           </span>
         </div>
      </div>

      {/* Global Strategy Allocation */}
      <div className="bg-brand-primary text-brand-surface p-4 rounded-xl relative overflow-hidden shadow-sm">
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <Compass className="w-4 h-4 text-brand-accent" />
            <div className="space-y-0.5">
              <h3 className="text-xs font-sans font-black uppercase tracking-wider text-brand-surface leading-none">Monthly Money Breakdown</h3>
              <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">How your income is split this month</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Monthly Income</p>
              <p className="text-sm font-mono font-bold tracking-tight">{formatCurrency(estimatedMonthlyIncome)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Fixed Bills</p>
              <p className="text-sm font-mono font-bold text-rose-400 tracking-tight">-{formatCurrency(estimatedFixedCosts)}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Savings Goals</p>
              <p className="text-sm font-mono font-bold text-brand-accent tracking-tight">-{formatCurrency(monthlyGoalCommitments)}</p>
            </div>
            <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l border-white/10 pt-1 sm:pt-0 sm:pl-3">
              <p className="text-[8px] font-bold text-brand-accent uppercase tracking-widest">Spending Money</p>
              <p className="text-base font-mono font-black text-brand-surface tracking-tight">{formatCurrency(strategicSpendingCeiling)}</p>
            </div>
          </div>
          
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex p-0.5 shadow-inner mt-1">
            <div className="h-full bg-rose-500/80 rounded-l-full" style={{ width: `${(estimatedFixedCosts/(estimatedMonthlyIncome || 1))*100}%` }} />
            <div className="h-full bg-brand-accent" style={{ width: `${(monthlyGoalCommitments/(estimatedMonthlyIncome || 1))*100}%` }} />
            <div className="h-full bg-white/40 rounded-r-full" style={{ width: `${(strategicSpendingCeiling/(estimatedMonthlyIncome || 1))*100}%` }} />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 text-[8px] font-bold uppercase tracking-wider text-white/50 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
              <span>01_BILLS: Rent, loans & insurance.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-brand-accent rounded-full shrink-0" />
              <span>02_GOALS: Your active savings targets.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-white/40 rounded-full shrink-0" />
              <span>03_SPENDING: Guilt-free daily money.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Debt Strategy Engine */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between border-b border-brand-border pb-1 px-0.5">
          <div className="space-y-0.5">
            <h3 className="text-xs font-sans font-black uppercase tracking-wider text-brand-primary leading-none">Prepayment Check</h3>
            <p className="text-[8px] font-bold text-brand-primary/30 uppercase tracking-widest">Active tips to pay off your loans early</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8">
            {goals.filter(g => g.type === 'debt').length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {goals.filter(g => g.type === 'debt').map(loan => (
                  <div key={loan.id} className="bg-brand-surface p-3 border border-brand-border/60 rounded-xl relative overflow-hidden group space-y-2">
                    <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                      <div className="space-y-0.5">
                        <p className="text-[7.5px] font-bold text-brand-primary/40 uppercase tracking-wider">Loan Goal</p>
                        <h3 className="text-xs font-extrabold text-brand-primary tracking-tight leading-none">{loan.name}</h3>
                      </div>
                      <Landmark className="w-3.5 h-3.5 text-brand-primary/30" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] leading-none">
                      <div className="space-y-0.5">
                        <p className="text-[7.5px] font-bold text-brand-primary/35 uppercase tracking-wider">Interest Rate</p>
                        <p className="font-mono font-bold text-brand-primary">{loan.interestRate || 8.5}%</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[7.5px] font-bold text-brand-primary/35 uppercase tracking-wider">Remaining</p>
                        <p className="font-mono font-bold text-brand-primary">{loan.tenureMonths || 240} Mo</p>
                      </div>
                    </div>

                    <div className="p-1.5 bg-brand-accent/5 rounded border border-brand-accent/10 flex items-center gap-1.5 text-[9px] leading-snug">
                      <Zap className="w-3 h-3 text-brand-accent shrink-0 animate-pulse" />
                      <p className="text-brand-primary/60">
                        Check payoff options below to save on huge interest fees.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2 min-h-[100px]">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/5 flex items-center justify-center text-brand-primary/20">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 max-w-xs">
                  <h3 className="text-xs font-bold text-brand-primary">No Active Debt Defined</h3>
                  <p className="text-[8px] text-brand-primary/45 leading-normal">Add any loans or mortgages to see how paying early can save you massive interest.</p>
                </div>
              </div>
            )}
          </div>

          <div className="sm:col-span-4 bg-brand-accent/5 border border-brand-accent/10 rounded-xl p-3 flex flex-col justify-between space-y-2.5">
            <div className="space-y-1">
              <h3 className="text-[9px] font-black uppercase tracking-wider text-brand-accent">Early Pay Rule</h3>
              <p className="text-[10px] text-brand-primary/60 leading-normal font-sans">
                A small extra payment on your loan each month cuts down the total years of interest. Do this whenever you have a little spare cash.
              </p>
            </div>
            <div className="flex items-center gap-1.5 leading-none text-brand-accent">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[8px] font-bold uppercase tracking-widest">Interest Optimizer active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Audit */}
      <div className="bg-brand-surface p-3 border border-brand-border/60 rounded-xl space-y-4">
        <div className="space-y-0.5 border-b border-brand-border/40 pb-2">
          <h3 className="text-xs font-sans font-black uppercase tracking-wider text-brand-primary leading-none">Avoidable Spends Checks</h3>
          <p className="text-[8px] text-brand-primary/30 uppercase tracking-widest">Reviewing what you must pay versus extra spends</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Visual Breakdown */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-center bg-brand-bg/20 p-3 rounded-lg border border-brand-border/30">
            <div className="h-2 w-full bg-brand-border rounded-full overflow-hidden flex p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${fixedRatio}%` }}
                className="h-full bg-brand-primary rounded-l-full"
              />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${discretionaryRatio}%` }}
                className="h-full bg-brand-accent/30 rounded-r-full"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-1 text-[10px] leading-tight">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-[2px] rounded-full bg-brand-primary" />
                  <p className="text-[8px] font-bold uppercase text-brand-primary/50">Needs (Bills)</p>
                </div>
                <p className="font-mono font-bold text-brand-primary text-sm leading-none mt-1">{fixedRatio.toFixed(0)}%</p>
                <p className="text-[8px] font-mono text-brand-primary/45 mt-0.5">{formatCurrency(mandatoryExpenses)}</p>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-[2px] rounded-full bg-brand-accent/40" />
                  <p className="text-[8px] font-bold uppercase text-brand-primary/50">Wants (Extra)</p>
                </div>
                <p className="font-mono font-bold text-brand-primary text-sm leading-none mt-1">{discretionaryRatio.toFixed(0)}%</p>
                <p className="text-[8px] font-mono text-brand-primary/45 mt-0.5">{formatCurrency(discretionaryExpenses)}</p>
              </div>
            </div>
          </div>

          {/* Structural Waste Identification */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-brand-bg/40 p-3 rounded-lg border border-brand-border/40 relative overflow-hidden group space-y-2">
              <div className="flex items-center gap-1.5 relative z-10 border-b border-brand-border/40 pb-1.5 leading-none">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Avoidable Spending</p>
              </div>
              <div className="space-y-2.5 relative z-10 text-[10px]">
                {topWaste.length > 0 ? topWaste.map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center border-b border-brand-border/10 pb-1.5 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <p className="font-bold uppercase tracking-tight text-brand-primary leading-none truncate max-w-[100px]">{cat}</p>
                      <p className="text-[7.5px] font-medium text-brand-primary/30 uppercase tracking-widest pl-0.5">Extra money spent</p>
                    </div>
                    <p className="font-mono font-bold text-rose-500 leading-none">{formatCurrency(amt)}</p>
                  </div>
                )) : (
                  <p className="text-[8px] font-bold text-brand-primary/30 uppercase tracking-wider py-2">Good job, no significant budget leaks</p>
                )}
              </div>
            </div>

            <div className="bg-brand-bg/40 p-3 rounded-lg border border-brand-border/40 relative overflow-hidden group space-y-2">
              <div className="flex items-center gap-1.5 relative z-10 border-b border-brand-border/40 pb-1.5 leading-none">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-accent/50" />
                <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Recurring Subs</p>
              </div>
              <div className="space-y-2.5 relative z-10 text-[10px]">
                {subscriptionAudit.length > 0 ? subscriptionAudit.map((sub) => (
                  <div key={sub.name} className="flex justify-between items-center border-b border-brand-border/10 pb-1.5 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <p className="font-bold uppercase tracking-tight text-brand-primary leading-none truncate max-w-[100px]">{sub.name}</p>
                      <p className="text-[7.5px] font-medium text-brand-primary/30 uppercase tracking-widest pl-0.5">Monthly bill</p>
                    </div>
                    <p className="font-mono font-bold text-brand-primary leading-none">{formatCurrency(sub.amount)}</p>
                  </div>
                )) : (
                  <p className="text-[8px] font-bold text-brand-primary/30 uppercase tracking-wider py-2">No active subscriptions cataloged</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Strategy Audit */}
      <div className="bg-brand-primary text-brand-surface p-4 rounded-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent rounded-full blur-3xl -mr-[10%] -mt-[10%] opacity-20 pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 shrink-0">
              <Sparkles className="w-5 h-5 text-brand-accent" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-sans font-black uppercase tracking-wider text-brand-surface leading-none">Artha Money AI Advisor</h3>
              <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Simple suggestions to save and reach goals faster</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-brand-accent text-brand-primary px-3 py-1.5 rounded text-[8px] font-bold uppercase tracking-widest hover:bg-brand-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-1 leading-none shadow-sm shrink-0"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
            {isLoading ? 'Thinking...' : 'Get Advisor Tips'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isLoading && !strategy ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 relative z-10">
              <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
              <div className="text-center space-y-0.5">
                <p className="text-xs font-sans font-black uppercase tracking-tight text-white animate-pulse">Checking numbers</p>
                <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Reviewing your transactions and goals</p>
              </div>
            </div>
          ) : strategy ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10 space-y-3 pt-3"
            >
              {isDriftDetected && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 p-2 rounded flex items-center justify-between border border-white/10"
                >
                  <p className="text-[8px] font-bold uppercase text-brand-accent flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    Drift detected. Income/expense base modified.
                  </p>
                  <button 
                    onClick={handleGenerate}
                    className="text-[8px] font-bold uppercase text-white underline hover:text-brand-accent leading-none"
                  >
                    Refresh
                  </button>
                </motion.div>
              )}
              <div className="bg-white/[0.02] p-3 md:p-4 rounded-lg border border-white/10 relative overflow-hidden">
                <div className="markdown-body relative z-10 text-[11px] leading-relaxed select-text font-normal font-sans text-white/90">
                  <Markdown>{strategy}</Markdown>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="border border-dashed border-white/15 p-6 text-center relative z-10 bg-white/[0.01] rounded-lg cursor-pointer hover:border-brand-accent/40 transition-all mt-3"
                 onClick={handleGenerate}>
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-sans font-black uppercase tracking-wider text-white">Strategy Engine Synchronized</p>
                  <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Click to run smart asset amortization review</p>
                </div>
                <button
                  className="bg-brand-surface text-brand-primary px-4 py-1.5 rounded text-[8px] font-bold uppercase tracking-widest mx-auto flex items-center gap-1 border border-brand-border"
                >
                  <TrendingUp className="w-3 h-3" />
                  Initiate AI Audit
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full relative z-10 mt-3"
          >
            {error.toLowerCase().includes("api key") || error.toLowerCase().includes("secrets") ? (
              <div className="bg-brand-surface border border-brand-accent/20 rounded-lg p-3 space-y-3 shadow-md text-brand-primary">
                <div className="flex items-center justify-between pb-2 border-b border-brand-border/40">
                  <div className="space-y-0.5">
                    <span className="text-[7px] font-bold text-amber-600 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded leading-none inline-block">
                      Authorization Required
                    </span>
                    <h4 className="text-[10px] font-sans font-black uppercase tracking-wider text-brand-primary mt-1">
                      Gemini API Key Missing
                    </h4>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                </div>

                <div className="space-y-1.5 text-[9px]">
                  <p className="text-brand-primary/80 leading-normal">
                    Artha relies on Google Gemini in the background to calculate custom savings strategies and portfolio optimization schedules.
                  </p>
                  <p className="text-brand-primary/50 leading-normal">
                    Declare a secret key named <code className="font-mono bg-brand-primary/5 text-brand-primary font-bold px-1 py-0.5 rounded border border-brand-primary/10">GEMINI_API_KEY</code> under <strong className="text-brand-primary">Settings &gt; Secrets</strong> to unlock this.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <div>
                  <h4 className="font-black text-[9.5px] uppercase tracking-wider mb-0.5">Calculations Halted</h4>
                  <p className="font-semibold text-rose-500/85 normal-case font-mono">{error}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
