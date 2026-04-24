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
    <div className="space-y-8">
      {/* Efficiency & Velocity Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-brand-surface p-6 md:p-8 border border-brand-border rounded-3xl shadow-sm space-y-3 md:space-y-4">
          <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Capital Efficiency</p>
          <div className="flex items-end gap-3">
            <h4 className="text-3xl md:text-4xl font-mono font-bold text-brand-primary leading-tight py-1">{efficiencyScore.toFixed(0)}%</h4>
            <div className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
              efficiencyScore > 40 ? "bg-brand-accent/10 text-brand-accent" : "bg-rose-500/10 text-rose-500"
            )}>
              {efficiencyScore > 40 ? 'High' : 'Low'}
            </div>
          </div>
          <p className="text-[10px] text-brand-primary/40 leading-relaxed uppercase tracking-widest font-bold opacity-40">Efficiency Index</p>
        </div>

        <div className="bg-brand-surface p-6 md:p-8 border border-brand-border rounded-3xl shadow-sm space-y-3 md:space-y-4">
          <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Spending Velocity</p>
          <div className="flex items-end gap-3">
            <h4 className="text-3xl md:text-4xl font-mono font-bold text-brand-primary leading-tight py-1">
              {velocityAudit.change > 0 ? '+' : ''}{velocityAudit.change.toFixed(0)}%
            </h4>
            <div className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
              velocityAudit.change <= 0 ? "bg-brand-accent/10 text-brand-accent" : "bg-rose-500/10 text-rose-500"
            )}>
              {velocityAudit.change <= 0 ? 'Stable' : 'Accelerating'}
            </div>
          </div>
          <p className="text-[10px] text-brand-primary/40 leading-relaxed uppercase tracking-widest font-bold opacity-40">Velocity Index</p>
        </div>

        <div className="bg-brand-surface p-6 md:p-8 border border-brand-border rounded-3xl shadow-sm space-y-3 md:space-y-4 sm:col-span-2 md:col-span-1">
          <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Commitment Ratio</p>
          <h4 className="text-3xl md:text-4xl font-mono font-bold text-brand-primary leading-tight py-1">{fixedRatio.toFixed(0)}%</h4>
          <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden">
            <div className="h-full bg-brand-primary" style={{ width: `${fixedRatio}%` }} />
          </div>
          <p className="text-[10px] text-brand-primary/40 leading-relaxed uppercase tracking-widest font-bold opacity-40">Fixed Obligation Index</p>
        </div>
      </div>

      {/* Recurring Commitment Audit */}
      <div className="bg-brand-surface p-6 md:p-12 border border-brand-border rounded-3xl shadow-sm space-y-8 md:space-y-10">
        <div className="space-y-2">
          <h3 className="text-2xl md:text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary">Commitment Audit</h3>
          <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em]">Fixed vs. Discretionary Analysis</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          {/* Visual Breakdown */}
          <div className="space-y-8">
            <div className="h-4 w-full bg-brand-bg rounded-full overflow-hidden flex">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${fixedRatio}%` }}
                className="h-full bg-brand-primary"
              />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${discretionaryRatio}%` }}
                className="h-full bg-brand-accent/30"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-primary" />
                  <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Fixed (Mandatory)</p>
                </div>
                <p className="text-2xl font-mono font-bold text-brand-primary">{fixedRatio.toFixed(0)}%</p>
                <p className="text-xs text-brand-primary/60 font-mono">{formatCurrency(mandatoryExpenses)}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-accent/30" />
                  <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Discretionary</p>
                </div>
                <p className="text-2xl font-mono font-bold text-brand-primary">{discretionaryRatio.toFixed(0)}%</p>
                <p className="text-xs text-brand-primary/60 font-mono">{formatCurrency(discretionaryExpenses)}</p>
              </div>
            </div>
          </div>

          {/* Structural Waste Identification */}
          <div className="space-y-8">
            <div className="bg-brand-bg/50 p-6 rounded-2xl border border-brand-border space-y-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-brand-accent" />
                <p className="text-[10px] font-bold text-brand-primary/60 uppercase tracking-widest">Structural Waste Audit</p>
              </div>
              <div className="space-y-4">
                {topWaste.length > 0 ? topWaste.map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <p className="text-sm font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-0.5">{cat}</p>
                      <p className="text-[10px] text-brand-primary/40 uppercase tracking-widest leading-relaxed py-0.25">Potential Optimization</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-brand-primary">{formatCurrency(amt)}</p>
                  </div>
                )) : (
                  <p className="text-xs text-brand-primary/40 font-bold uppercase tracking-widest">No significant discretionary waste identified.</p>
                )}
              </div>
            </div>

            {/* Subscription Audit */}
            <div className="bg-brand-bg/50 p-6 rounded-2xl border border-brand-border space-y-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-brand-primary/40" />
                <p className="text-[10px] font-bold text-brand-primary/60 uppercase tracking-widest">Subscription Audit</p>
              </div>
              <div className="space-y-4">
                {subscriptionAudit.length > 0 ? subscriptionAudit.map((sub) => (
                  <div key={sub.name} className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-brand-primary uppercase tracking-wide leading-tight py-0.5">{sub.name}</p>
                      <p className="text-[10px] text-brand-primary/40 uppercase tracking-widest leading-relaxed py-0.25">{sub.frequency} Commitment</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-brand-primary">{formatCurrency(sub.amount)}</p>
                  </div>
                )) : (
                  <p className="text-xs text-brand-primary/40 font-bold uppercase tracking-widest">No recurring subscriptions detected.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Strategy Audit */}
      <div className="bg-brand-surface p-6 md:p-12 border border-brand-border rounded-3xl shadow-sm space-y-8 md:space-y-10 relative overflow-hidden group">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 relative z-10">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-primary/5 rounded-2xl flex items-center justify-center transition-all duration-700 group-hover:scale-105">
              <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-brand-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl md:text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1">Strategic Audit</h3>
              <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em] leading-relaxed py-0.5">Capital Optimization Engine</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-brand-primary text-brand-surface px-6 md:px-8 py-3.5 md:py-4 rounded-xl shadow-lg hover:bg-brand-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 font-bold text-[10px] md:text-xs uppercase tracking-widest w-full md:w-auto"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {isLoading ? 'Processing' : 'Run Audit'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isLoading && !strategy ? (
            <div className="py-20 flex flex-col items-center justify-center gap-6 relative z-10">
              <Loader2 className="w-12 h-12 animate-spin text-brand-primary/20" />
              <div className="text-center space-y-2">
                <p className="text-lg font-sans font-bold uppercase tracking-tight text-brand-primary animate-pulse">Analyzing Capital Vectors</p>
                <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.2em]">Synthesizing market arbitrage opportunities</p>
              </div>
            </div>
          ) : strategy ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 space-y-6"
            >
              {isDriftDetected && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-brand-accent/10 border border-brand-accent/20 p-4 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-brand-accent" />
                    <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest leading-none">Strategic Drift Detected: Capital vectors have shifted.</p>
                  </div>
                  <button 
                    onClick={handleGenerate}
                    className="text-[9px] font-bold text-brand-accent underline uppercase tracking-widest"
                  >
                    Refresh Audit
                  </button>
                </motion.div>
              )}
              <div className="bg-brand-bg/50 p-8 md:p-10 rounded-2xl border border-brand-border relative overflow-hidden">
                <div className="markdown-body relative z-10 text-brand-primary/80 leading-relaxed">
                  <Markdown>{strategy}</Markdown>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="border-2 border-dashed border-brand-border p-16 text-center relative z-10 bg-brand-bg/30 rounded-3xl">
              <div className="space-y-8">
                <div className="w-16 h-16 bg-brand-surface rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <ShieldCheck className="w-8 h-8 text-brand-primary/20" />
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-sans font-bold uppercase tracking-tight text-brand-primary">System Ready</p>
                  <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.2em]">Log transactions to enable capital efficiency analysis</p>
                </div>
                <button
                  onClick={handleGenerate}
                  className="bg-brand-primary text-brand-surface px-8 py-4 rounded-xl shadow-lg hover:bg-brand-primary/90 transition-all font-bold text-xs uppercase tracking-widest mx-auto flex items-center gap-3"
                >
                  <Plus className="w-4 h-4" />
                  Initiate Audit
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {error && (
          <div className="p-6 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
