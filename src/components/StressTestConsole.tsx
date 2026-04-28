import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, TrendingDown, TrendingUp, AlertCircle, CheckCircle2, Info, Landmark } from 'lucide-react';
import { Goal, Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface StressTestConsoleProps {
  monthlyIncome: number;
  monthlyFixedExpenses: number;
  monthlyGoalCommitments: number;
  liquidAssets: number;
}

export function StressTestConsole({ 
  monthlyIncome, 
  monthlyFixedExpenses, 
  monthlyGoalCommitments, 
  liquidAssets 
}: StressTestConsoleProps) {
  const [incomeShock, setIncomeShock] = useState(1); // 1 = 100% (no shock)
  const [expenseShock, setExpenseShock] = useState(1); // 1 = 100% (no shock)
  
  const shockedIncome = monthlyIncome * incomeShock;
  const shockedExpenses = monthlyFixedExpenses * expenseShock;
  const shockedCommitments = monthlyGoalCommitments; // Goals usually fixed priority
  
  const survivingMonths = shockedIncome - (shockedExpenses + shockedCommitments) > 0 
    ? Infinity 
    : Math.abs(liquidAssets / (shockedIncome - (shockedExpenses + shockedCommitments)));

  const isDrowning = shockedIncome < (shockedExpenses + shockedCommitments);
  const survivalStatus = isDrowning ? (survivingMonths < 3 ? 'CRITICAL' : 'WARNING') : 'STABLE';

  return (
    <div className="bg-brand-surface border border-brand-border rounded-[2.5rem] p-8 md:p-12 shadow-sm space-y-12 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 opacity-30" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-brand-primary/30" />
            <h3 className="section-header">Financial Stress Test</h3>
          </div>
          <p className="data-label">Simulation of market & personal shocks</p>
        </div>
        
        <div className={cn(
          "px-4 py-2 rounded-xl border flex items-center gap-2 transition-all",
          survivalStatus === 'STABLE' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
          survivalStatus === 'WARNING' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
          "bg-rose-500/10 text-rose-500 border-rose-500/20"
        )}>
          {survivalStatus === 'STABLE' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest">{survivalStatus} PROTOCOL ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
        <div className="space-y-10">
          {/* Controls */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-bold text-brand-primary uppercase tracking-widest">Income Continuity</p>
                <span className={cn(
                  "text-xs font-mono font-bold",
                  incomeShock < 1 ? "text-rose-500" : "text-emerald-500"
                )}>{(incomeShock * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={incomeShock}
                onChange={(e) => setIncomeShock(parseFloat(e.target.value))}
                className="w-full h-1 bg-brand-bg rounded-full appearance-none cursor-pointer accent-brand-primary"
              />
              <div className="flex justify-between items-center text-[8px] font-bold text-brand-primary/20 uppercase tracking-widest">
                <span>Total Loss</span>
                <span>Normal</span>
                <span>Bonus/Inc</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-bold text-brand-primary uppercase tracking-widest">Expense Inflation</p>
                <span className={cn(
                  "text-xs font-mono font-bold",
                  expenseShock > 1 ? "text-rose-500" : "text-emerald-500"
                )}>{(expenseShock * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={expenseShock}
                onChange={(e) => setExpenseShock(parseFloat(e.target.value))}
                className="w-full h-1 bg-brand-bg rounded-full appearance-none cursor-pointer accent-brand-accent"
              />
              <div className="flex justify-between items-center text-[8px] font-bold text-brand-primary/20 uppercase tracking-widest">
                <span>Optimized</span>
                <span>Base Line</span>
                <span>Hyper-Spent</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-brand-bg rounded-2xl border border-brand-border space-y-4">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-brand-primary/40" />
              <p className="data-label">Observer Note</p>
            </div>
            <p className="text-xs text-brand-primary/60 font-medium leading-relaxed">
              This simulation tests your ability to maintain commitment to all current goals and EMIs during a crisis. 
              {isDrowning ? " In this scenario, you're bleeding capital." : " You are currently resilient to this shock level."}
            </p>
          </div>
        </div>

        {/* Results Matrix */}
        <div className="bg-brand-primary text-brand-surface p-8 md:p-10 rounded-[2rem] shadow-xl border border-white/5 space-y-10 flex flex-col justify-between">
           <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Shocked Surplus</p>
                  <p className={cn(
                    "text-2xl font-mono font-bold tabular-nums",
                    isDrowning ? "text-rose-500" : "text-brand-accent"
                  )}>
                    {formatCurrency(shockedIncome - (shockedExpenses + shockedCommitments))}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Burn Velocity</p>
                  <p className="text-2xl font-mono font-bold text-white uppercase">
                    {isDrowning ? "NEGATIVE" : "POSITIVE"}
                  </p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 space-y-4">
                <p className="data-label !text-brand-surface/40">Continuity Window</p>
                <div className="flex items-baseline gap-4">
                  <span className="text-6xl font-mono font-bold tracking-tighter">
                    {survivingMonths === Infinity ? "∞" : Math.floor(survivingMonths)}
                  </span>
                  <span className="text-xl font-sans font-bold text-white/20 uppercase tracking-widest">Months</span>
                </div>
                <p className="text-[11px] text-white/40 font-medium leading-tight">Time your liquid reserves can cover the deficit before portfolio collapse.</p>
              </div>
           </div>

           <div className={cn(
             "p-4 rounded-xl border text-[10px] font-bold uppercase tracking-[0.2em] text-center",
             isDrowning ? "bg-rose-500 text-white border-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.3)]" : "bg-emerald-500/10 text-emerald-500 border-white/10"
           )}>
             {isDrowning ? "Tactical Liquidation Required" : "Operational Strength Maintained"}
           </div>
        </div>
      </div>
    </div>
  );
}
