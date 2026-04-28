import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Sparkles, TrendingUp, AlertCircle, Loader2, ChevronRight, Plus, ShieldCheck, Compass, AlertTriangle, Landmark, Zap, ArrowUpRight } from 'lucide-react';
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
  monthlyGoalCommitments
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

  const totalIncomeCalc = totalIncome; 

  // Capital Efficiency Score: (Income - Mandatory) / Income
  const efficiencyScore = totalIncome > 0 ? ((totalIncome - mandatoryExpenses) / totalIncome) * 100 : 0;

  // Identify "Structural Waste" - Discretionary categories that are high
  const wasteAnalysis = transactions
    .filter(t => t.type === 'expense' && !t.isMandatory)
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const topWaste = Object.entries(wasteAnalysis)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  // Subscription Audit: Detect recurring descriptions with similar amounts
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
        frequency: 'Monthly' // Simplified assumption
      }));
  }, [transactions]);

  // Spending Velocity: Discretionary this month vs last month
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
      const result = await generateCFOStrategy(transactions, goals);
      setStrategy(result || "Unable to generate strategy at this time.");
      setLastAuditSnapshot({ balance, count: transactions.length });
    } catch (err) {
      setError("Failed to generate strategy. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-24">
      {/* Efficiency & Velocity Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <div className="bg-brand-surface p-6 md:p-8 border border-brand-border rounded-3xl shadow-sm space-y-4 relative overflow-hidden group">
          <p className="data-label">Financial Efficiency</p>
          <div className="flex items-end justify-between relative z-10">
            <h4 className="text-3xl md:text-4xl font-mono font-bold text-brand-primary leading-none">{efficiencyScore.toFixed(0)}%</h4>
            <div className={cn(
              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
              efficiencyScore > 40 ? "bg-brand-accent/10 text-brand-accent border-brand-accent/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
              {efficiencyScore > 40 ? 'Good' : 'Review'}
            </div>
          </div>
          <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${efficiencyScore}%` }}
              className={cn("h-full", efficiencyScore > 40 ? "bg-brand-accent" : "bg-rose-500")}
            />
          </div>
        </div>

        <div className="bg-brand-surface p-6 md:p-8 border border-brand-border rounded-3xl shadow-sm space-y-4 relative overflow-hidden group">
          <p className="data-label">Spending Velocity</p>
          <div className="flex items-end justify-between relative z-10">
            <h4 className="text-3xl md:text-4xl font-mono font-bold text-brand-primary leading-none">
              {velocityAudit.change > 0 ? '+' : ''}{velocityAudit.change.toFixed(0)}%
            </h4>
            <div className={cn(
              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
              velocityAudit.change <= 5 ? "bg-brand-accent/10 text-brand-accent border-brand-accent/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
              {velocityAudit.change <= 5 ? 'Stable' : 'Rapid'}
            </div>
          </div>
          <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden relative">
             <div className="absolute left-1/2 top-0 h-full w-[1px] bg-brand-border z-10" />
             <div className={cn(
               "h-full transition-all",
               velocityAudit.change > 0 ? "bg-rose-500" : "bg-brand-accent"
             )} style={{ width: `${Math.min(Math.abs(velocityAudit.change), 100)}%`, marginLeft: velocityAudit.change > 0 ? '50%' : `${50 - Math.min(Math.abs(velocityAudit.change), 50)}%` }} />
          </div>
        </div>

        <div className="bg-brand-surface p-6 md:p-8 border border-brand-border rounded-3xl shadow-sm space-y-4 relative overflow-hidden group">
          <p className="data-label">Fixed Cost Ratio</p>
          <div className="flex items-end justify-between relative z-10">
            <h4 className="text-3xl md:text-4xl font-mono font-bold text-brand-primary leading-none">{fixedRatio.toFixed(0)}%</h4>
            <p className="data-label !text-brand-primary/20">Fixed</p>
          </div>
          <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${fixedRatio}%` }}
               className="h-full bg-brand-primary"
            />
          </div>
        </div>

        {/* Global Strategy Allocation */}
        <div className="col-span-full bg-brand-primary text-brand-surface p-10 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-brand-accent/60" />
              <h3 className="text-xl font-display font-bold uppercase tracking-widest">Global Allocation Model</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-brand-surface/40 uppercase tracking-widest">Total Income</p>
                <p className="text-2xl font-mono font-bold">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-brand-surface/40 uppercase tracking-widest">Fixed Obligations</p>
                <p className="text-2xl font-mono font-bold text-rose-400">-{formatCurrency(mandatoryExpenses)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-brand-surface/40 uppercase tracking-widest">Goal Commitments</p>
                <p className="text-2xl font-mono font-bold text-brand-accent">-{formatCurrency(monthlyGoalCommitments)}</p>
              </div>
              <div className="space-y-1 pt-4 md:pt-0 md:pl-8 md:border-l border-white/10">
                <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">Safe Spending Limit</p>
                <p className="text-4xl font-mono font-bold text-brand-surface">{formatCurrency(strategicSpendingCeiling)}</p>
              </div>
            </div>
            
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex p-0.5 border border-white/10 mt-6">
              <div className="h-full bg-rose-500/60" style={{ width: `${(mandatoryExpenses/(totalIncome || 1))*100}%` }} />
              <div className="h-full bg-brand-accent" style={{ width: `${(monthlyGoalCommitments/(totalIncome || 1))*100}%` }} />
              <div className="h-full bg-brand-surface" style={{ width: `${(strategicSpendingCeiling/(totalIncome || 1))*100}%` }} />
            </div>
            <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-[0.2em] opacity-40">
              <span>Fixed Costs</span>
              <span>Prioritized Wealth</span>
              <span>Pure Disposable Income</span>
            </div>
          </div>
        </div>
      </div>

      {/* Debt Strategy Engine */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="space-y-0.5">
            <h3 className="text-xl font-display font-bold text-brand-primary tracking-tight">Debt Architecture</h3>
            <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest pl-0.5">Liability Audit & Optimization</p>
          </div>
          {goals.some(g => g.type === 'debt') && (
            <Landmark className="w-5 h-5 text-brand-primary/20" />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {goals.filter(g => g.type === 'debt').length > 0 ? (
            goals.filter(g => g.type === 'debt').map(loan => (
              <div key={loan.id} className="bg-brand-surface p-8 md:p-12 border border-brand-border rounded-[2.5rem] shadow-sm space-y-8 relative overflow-hidden group">
                <div className="flex items-center justify-between border-b border-brand-border pb-6">
                  <div className="space-y-1">
                    <p className="data-label">Liability Audit</p>
                    <h3 className="text-xl font-display font-bold text-brand-primary tracking-tight">{loan.name}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary/5 flex items-center justify-center text-brand-primary border border-brand-border">
                    <Landmark className="w-6 h-6" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Rate of Capital Loss</p>
                    <p className="text-2xl font-mono font-bold text-brand-primary">{loan.interestRate || 8.5}% <span className="text-[10px] opacity-30 text-brand-primary">p.a.</span></p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Target Resolution</p>
                    <p className="text-2xl font-mono font-bold text-brand-primary">{loan.tenureMonths || 240} <span className="text-[10px] opacity-30 text-brand-primary">Months</span></p>
                  </div>
                </div>

                <div className="p-4 bg-brand-accent/5 rounded-2xl border border-brand-accent/10 flex items-center gap-4">
                  <Zap className="w-5 h-5 text-brand-accent" />
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">Prepayment Potential</p>
                    <p className="text-[11px] font-medium text-brand-primary/70">Check the <span className="font-bold underline cursor-pointer" onClick={() => (document.getElementById('debt-optimization-engine') as any)?.scrollIntoView({ behavior: 'smooth' })}>Debt Architect</span> below to simulate interest savings.</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-brand-surface p-8 md:p-12 border border-brand-border rounded-[2.5rem] shadow-sm flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden group">
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="w-16 h-16 rounded-3xl bg-brand-primary/5 flex items-center justify-center text-brand-primary/20 border border-brand-border">
                <Landmark className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-xl font-display font-medium text-brand-primary">No Active Debt Protocol</h3>
                <p className="text-xs text-brand-primary/40 leading-relaxed font-medium">Tracking and prepaying your Home Loan is the most effective way to protect your long-term capital from interest loss.</p>
              </div>
              <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em]">Start Tracking Strategy //</p>
            </div>
          )}

          <div className="bg-brand-accent/5 border border-brand-accent/10 rounded-[2.5rem] p-8 md:p-12 flex flex-col justify-center space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-display font-bold text-brand-accent tracking-tight">The 1-Step Advantage</h3>
              <p className="text-xs text-brand-primary/60 leading-relaxed font-medium">
                Every extra payment towards your principal in the first 5 years of a Home Loan can save you up to 3x that amount in future interest. Use the architect below to plan your attack.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">Interest minimization active</span>
            </div>
          </div>
        </div>
      </div>
      {/* Expense Audit */}
      <div className="bg-brand-surface p-8 md:p-16 border border-brand-border rounded-[2.5rem] shadow-sm space-y-12 md:space-y-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="space-y-3 relative z-10">
          <h3 className="section-header">Expense Audit</h3>
          <p className="data-label">Analysing fixed costs and discretionary spending patterns</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 relative z-10">
          {/* Visual Breakdown */}
          <div className="space-y-12">
            <div className="h-4 w-full bg-brand-bg rounded-full overflow-hidden flex border border-brand-border p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${fixedRatio}%` }}
                className="h-full bg-brand-primary"
              />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${discretionaryRatio}%` }}
                className="h-full bg-brand-accent/20"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-[2px] rounded-full bg-brand-primary" />
                  <p className="data-label">Fixed Costs</p>
                </div>
                <p className="text-4xl font-mono font-bold text-brand-primary tracking-tight tabular-nums">{fixedRatio.toFixed(0)}%</p>
                <p className="data-label !text-brand-primary/40 uppercase tracking-widest">{formatCurrency(mandatoryExpenses)}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-[2px] rounded-full bg-brand-accent/40" />
                  <p className="data-label">Flex Spending</p>
                </div>
                <p className="text-4xl font-mono font-bold text-brand-primary tracking-tight tabular-nums">{discretionaryRatio.toFixed(0)}%</p>
                <p className="data-label !text-brand-primary/40 uppercase tracking-widest">{formatCurrency(discretionaryExpenses)}</p>
              </div>
            </div>
          </div>

          {/* Structural Waste Identification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="bg-brand-bg/50 p-8 rounded-[2rem] border border-brand-border space-y-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:scale-150" />
              <div className="flex items-center gap-4 relative z-10">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
                <p className="data-label">Savings Opportunities</p>
              </div>
              <div className="space-y-6 relative z-10">
                {topWaste.length > 0 ? topWaste.map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center border-b border-brand-border/10 pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-bold uppercase tracking-tight text-brand-primary leading-none">{cat}</p>
                      <p className="data-label !text-[8.5px]">Potential for deduction</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-rose-500">{formatCurrency(amt)}</p>
                  </div>
                )) : (
                  <p className="data-label !text-brand-primary/30">No significant flexible spending found.</p>
                )}
              </div>
            </div>

            <div className="bg-brand-bg/50 p-8 rounded-[2rem] border border-brand-border space-y-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:scale-150" />
              <div className="flex items-center gap-4 relative z-10">
                <ShieldCheck className="w-6 h-6 text-brand-accent/40" />
                <p className="data-label">Subscription Audit</p>
              </div>
              <div className="space-y-6 relative z-10">
                {subscriptionAudit.length > 0 ? subscriptionAudit.map((sub) => (
                  <div key={sub.name} className="flex justify-between items-center border-b border-brand-border/10 pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-bold uppercase tracking-tight text-brand-primary leading-none truncate max-w-[120px]">{sub.name}</p>
                      <p className="data-label !text-[8.5px]">Regular recurring cost</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-brand-primary">{formatCurrency(sub.amount)}</p>
                  </div>
                )) : (
                  <p className="data-label !text-brand-primary/30">No active subscriptions detected.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Strategy Audit */}
      <div className="bg-brand-primary text-brand-surface p-10 md:p-20 rounded-[3rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] space-y-12 md:space-y-16 relative overflow-hidden group">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '100px 100px' }} />
        <div className="absolute top-0 right-0 w-full h-full bg-brand-accent rounded-full blur-[180px] -mr-[30%] -mt-[30%] opacity-20 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 md:gap-14 relative z-10">
          <div className="flex items-center gap-8 md:gap-10">
            <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 shadow-inner group-hover:rotate-12 transition-all duration-700 backdrop-blur-3xl">
              <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-brand-accent animate-pulse" />
            </div>
            <div className="space-y-3">
              <h3 className="text-4xl md:text-6xl font-sans font-bold uppercase tracking-tighter text-brand-surface leading-none">AI Advisor</h3>
              <p className="data-label !text-brand-surface/30">Intelligent Portfolio Analysis & Growth Strategy</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-brand-accent text-brand-primary px-10 md:px-14 py-6 md:py-8 rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4 font-bold text-xs md:text-sm uppercase tracking-[0.4em] w-full md:w-auto"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <TrendingUp className="w-6 h-6" />}
            {isLoading ? 'Analysing...' : 'Generate Strategy'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isLoading && !strategy ? (
            <div className="py-32 flex flex-col items-center justify-center gap-10 relative z-10">
              <div className="relative">
                <Loader2 className="w-24 h-24 animate-spin text-brand-accent/20" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-4 h-4 bg-brand-accent rounded-full animate-ping" />
                </div>
              </div>
              <div className="text-center space-y-4">
                <p className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-surface animate-pulse">Running Calculations</p>
                <div className="flex items-center gap-3 justify-center opacity-30">
                  <div className="w-8 h-[1px] bg-white" />
                  <p className="data-label !text-brand-surface">Reviewing spending & goal timelines</p>
                  <div className="w-8 h-[1px] bg-white" />
                </div>
              </div>
            </div>
          ) : strategy ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10 space-y-12"
            >
              {isDriftDetected && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel p-6 rounded-[1.5rem] flex items-center justify-between border-brand-accent/20"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-brand-accent/20 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-brand-accent" />
                    </div>
                    <p className="data-label !text-brand-accent">Data Change Detected: Your financial situation has updated.</p>
                  </div>
                  <button 
                    onClick={handleGenerate}
                    className="data-label !text-brand-accent underline hover:text-white transition-colors"
                  >
                    Refresh Advice
                  </button>
                </motion.div>
              )}
              <div className="bg-white/[0.03] p-10 md:p-16 rounded-[2.5rem] border border-white/10 relative overflow-hidden backdrop-blur-3xl shadow-inner">
                <div className="markdown-body relative z-10 prose prose-invert prose-brand max-w-none">
                  <Markdown>{strategy}</Markdown>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="border-4 border-dashed border-white/10 p-24 text-center relative z-10 bg-white/[0.02] rounded-[3rem] group/init cursor-pointer hover:border-brand-accent/40 transition-all"
                 onClick={handleGenerate}>
              <div className="space-y-10">
                <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto shadow-sm group-hover/init:rotate-45 transition-all duration-700">
                  <ShieldCheck className="w-12 h-12 text-brand-surface/10 group-hover/init:text-brand-accent transition-all" />
                </div>
                <div className="space-y-4">
                  <p className="text-4xl font-sans font-bold uppercase tracking-tight text-brand-surface">Strategy Offline</p>
                  <p className="data-label !text-brand-surface/20">Add transactions to generate your personalized strategy</p>
                </div>
                <button
                  className="bg-brand-surface text-brand-primary px-12 py-5 rounded-2xl shadow-2xl font-bold text-xs uppercase tracking-[0.4em] mx-auto flex items-center gap-4 hover:scale-105 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Request Advice
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-[2rem] flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.3em] relative z-10"
          >
            <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center">
               <AlertCircle className="w-5 h-5" />
            </div>
            {error}
          </motion.div>
        )}
      </div>
    </div>
  );
}
