import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Sparkles, TrendingUp, AlertCircle, Loader2, ChevronRight, Plus, ShieldCheck, Compass, AlertTriangle } from 'lucide-react';
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
}

export function StrategyInsights({ 
  transactions, 
  goals, 
  balance, 
  totalIncome, 
  totalSavings,
  mandatoryExpenses,
  discretionaryExpenses
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
    <div className="space-y-12">
      {/* Efficiency & Velocity Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <div className="bg-brand-surface p-6 md:p-8 border border-brand-border rounded-3xl shadow-sm space-y-4 relative overflow-hidden group">
          <p className="data-label">Capital Efficiency</p>
          <div className="flex items-end justify-between relative z-10">
            <h4 className="text-3xl md:text-4xl font-mono font-bold text-brand-primary leading-none">{efficiencyScore.toFixed(0)}%</h4>
            <div className={cn(
              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
              efficiencyScore > 40 ? "bg-brand-accent/10 text-brand-accent border-brand-accent/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
              {efficiencyScore > 40 ? 'High' : 'Low'}
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
          <p className="data-label">Commitment Ratio</p>
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
      </div>

      {/* Recurring Commitment Audit */}
      <div className="bg-brand-surface p-8 md:p-16 border border-brand-border rounded-[2.5rem] shadow-sm space-y-12 md:space-y-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="space-y-3 relative z-10">
          <h3 className="section-header">Operational Vulnerability Audit</h3>
          <p className="data-label">Structural Capital Leakage & Fixed Exposure Analysis</p>
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
                  <p className="data-label">Immutable Obligations</p>
                </div>
                <p className="text-4xl font-mono font-bold text-brand-primary tracking-tight tabular-nums">{fixedRatio.toFixed(0)}%</p>
                <p className="data-label !text-brand-primary/40 uppercase tracking-widest">{formatCurrency(mandatoryExpenses)}</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-[2px] rounded-full bg-brand-accent/40" />
                  <p className="data-label">Liquid Discretionary</p>
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
                <p className="data-label">Inefficiency Audit</p>
              </div>
              <div className="space-y-6 relative z-10">
                {topWaste.length > 0 ? topWaste.map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center border-b border-brand-border/10 pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-bold uppercase tracking-tight text-brand-primary leading-none">{cat}</p>
                      <p className="data-label !text-[8.5px]">Optimization Target</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-rose-500">{formatCurrency(amt)}</p>
                  </div>
                )) : (
                  <p className="data-label !text-brand-primary/30">No significant efficiency leakage identified.</p>
                )}
              </div>
            </div>

            <div className="bg-brand-bg/50 p-8 rounded-[2rem] border border-brand-border space-y-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:scale-150" />
              <div className="flex items-center gap-4 relative z-10">
                <ShieldCheck className="w-6 h-6 text-brand-accent/40" />
                <p className="data-label">Subscription Protocol</p>
              </div>
              <div className="space-y-6 relative z-10">
                {subscriptionAudit.length > 0 ? subscriptionAudit.map((sub) => (
                  <div key={sub.name} className="flex justify-between items-center border-b border-brand-border/10 pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-bold uppercase tracking-tight text-brand-primary leading-none truncate max-w-[120px]">{sub.name}</p>
                      <p className="data-label !text-[8.5px]">Fixed Interval Burn</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-brand-primary">{formatCurrency(sub.amount)}</p>
                  </div>
                )) : (
                  <p className="data-label !text-brand-primary/30">Zero subscription commitment detected.</p>
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
              <h3 className="text-4xl md:text-6xl font-sans font-bold uppercase tracking-tighter text-brand-surface leading-none">Strategic Synthesis</h3>
              <p className="data-label !text-brand-surface/30">Neural Engine Audit v4.1.2 // Capital Allocation Meta-Analysis</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-brand-accent text-brand-primary px-10 md:px-14 py-6 md:py-8 rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4 font-bold text-xs md:text-sm uppercase tracking-[0.4em] w-full md:w-auto"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <TrendingUp className="w-6 h-6" />}
            {isLoading ? 'Synthesizing...' : 'Run Audit'}
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
                <p className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-surface animate-pulse">Analyzing Capital Vectors</p>
                <div className="flex items-center gap-3 justify-center opacity-30">
                  <div className="w-8 h-[1px] bg-white" />
                  <p className="data-label !text-brand-surface">Mapping market arbitrage & systemic risks</p>
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
                    <p className="data-label !text-brand-accent">Strategic Drift Identified: Real-telemetry diverging from initial audit baseline.</p>
                  </div>
                  <button 
                    onClick={handleGenerate}
                    className="data-label !text-brand-accent underline hover:text-white transition-colors"
                  >
                    Resynthesize
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
                  <p className="text-4xl font-sans font-bold uppercase tracking-tight text-brand-surface">Cold Engine State</p>
                  <p className="data-label !text-brand-surface/20">Operationalize data input to enable strategic neural synthesis</p>
                </div>
                <button
                  className="bg-brand-surface text-brand-primary px-12 py-5 rounded-2xl shadow-2xl font-bold text-xs uppercase tracking-[0.4em] mx-auto flex items-center gap-4 hover:scale-105 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Initialize Synthesis
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
