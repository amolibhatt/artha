import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

interface StressTestConsoleProps {
  monthlyIncome: number;
  monthlyFixedExpenses: number;
  monthlyGoalCommitments: number;
  sipMandates: number;
  liquidAssets: number;
  incomeShock: number;
  expenseShock: number;
  onShockChange: (income: number, expense: number) => void;
}

export function StressTestConsole({ 
  monthlyIncome, 
  monthlyFixedExpenses, 
  monthlyGoalCommitments, 
  sipMandates,
  liquidAssets,
  incomeShock,
  expenseShock,
  onShockChange
}: StressTestConsoleProps) {
  
  const shockedIncome = monthlyIncome * incomeShock;
  const shockedExpenses = monthlyFixedExpenses * expenseShock;
  const totalCommitments = monthlyGoalCommitments + sipMandates;
  const shockedCommitments = totalCommitments;
  
  const netCFOFlow = shockedIncome - (shockedExpenses + shockedCommitments);
  const survivingMonths = netCFOFlow > 0 
    ? Infinity 
    : Math.abs(liquidAssets / netCFOFlow);

  const isDrowning = netCFOFlow < 0;
  const survivalStatus = isDrowning ? (survivingMonths < 3 ? 'CRITICAL' : 'WARNING') : 'STABLE';

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-4 md:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-4 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl -mr-24 -mt-24 opacity-30" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-brand-border/40 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-brand-primary/45" />
            <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Financial Stress Test</h3>
          </div>
          <p className="text-[8px] font-bold text-brand-primary/30 uppercase tracking-widest">Crisis simulation & cash flow vulnerability shocks</p>
        </div>
        
        <div className={cn(
          "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border flex items-center gap-1 leading-none scale-95 sm:scale-100",
          survivalStatus === 'STABLE' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
          survivalStatus === 'WARNING' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
          "bg-rose-500/10 text-rose-500 border-rose-500/20"
        )}>
          {survivalStatus === 'STABLE' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          <span>{survivalStatus} PROTOCOL ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 relative z-10">
        <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
          {/* Controls */}
          <div className="space-y-3 bg-brand-bg/40 p-3 rounded-lg border border-brand-border/30">
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <p className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">Income Continuity</p>
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
                onChange={(e) => onShockChange(parseFloat(e.target.value), expenseShock)}
                className="w-full h-1 bg-brand-border rounded-full appearance-none cursor-pointer accent-brand-primary"
              />
              <div className="flex justify-between items-center text-[7px] font-mono font-bold text-brand-primary/25 uppercase tracking-wider">
                <span>Total Loss (0%)</span>
                <span>Normal (100%)</span>
                <span>Incr. (150%)</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-brand-border/30">
              <div className="flex justify-between items-baseline">
                <p className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">Expense Inflation</p>
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
                onChange={(e) => onShockChange(incomeShock, parseFloat(e.target.value))}
                className="w-full h-1 bg-brand-border rounded-full appearance-none cursor-pointer accent-brand-accent"
              />
              <div className="flex justify-between items-center text-[7px] font-mono font-bold text-brand-primary/25 uppercase tracking-wider">
                <span>Optimized (50%)</span>
                <span>Baseline (100%)</span>
                <span>Survival (200%)</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-brand-bg/60 rounded-lg border border-brand-border/40 flex gap-2 items-start text-[10px]">
            <Info className="w-3.5 h-3.5 text-brand-primary/30 shrink-0 mt-0.5" />
            <p className="text-brand-primary/60 font-sans font-medium leading-normal">
              Tests your cash pool resistance to sudden liquidity stress.
              {isDrowning ? " You are in net cash bleeding mode." : " Your current cash reserves absorb this shock level safely."}
            </p>
          </div>
        </div>

        {/* Results Matrix */}
        <div className="lg:col-span-5 bg-brand-primary text-brand-surface p-4 rounded-lg shadow-md border border-white/5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">Adjusted Cash Flow</p>
                <p className={cn(
                  "text-base font-mono font-bold tabular-nums leading-none",
                  isDrowning ? "text-rose-400" : "text-brand-accent"
                )}>
                  {formatCurrency(netCFOFlow)}
                </p>
              </div>
              <div className="space-y-0.5 text-right font-sans">
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">Continuity Mode</p>
                <p className="text-sm font-black text-white uppercase leading-none">
                  {isDrowning ? "DEFICIT" : "SURPLUS"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 py-2 border-y border-white/10 text-[9px] font-mono leading-none">
              <div className="space-y-0.5">
                 <p className="text-[7px] font-bold text-white/30 uppercase tracking-widest">Goal Commit.</p>
                 <p className="text-white/60">{formatCurrency(monthlyGoalCommitments)}</p>
              </div>
              <div className="space-y-0.5 text-right">
                 <p className="text-[7px] font-bold text-white/30 uppercase tracking-widest">SIP Mandate</p>
                 <p className="text-emerald-400">{formatCurrency(sipMandates)}</p>
              </div>
            </div>

            <div className="pt-1 flex justify-between items-center">
              <div className="space-y-0.5">
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/30">Cushion Lifetime</p>
                <p className="text-[9px] text-white/45 leading-none font-medium">Safe operational weeks remaining</p>
              </div>
              <div className="flex items-baseline gap-1 bg-white/5 px-2.5 py-1 rounded border border-white/5 font-mono">
                <span className="text-2xl font-black leading-none">
                  {survivingMonths === Infinity ? "∞" : Math.floor(survivingMonths)}
                </span>
                <span className="text-[9px] font-bold opacity-30 uppercase tracking-wider">Mo</span>
              </div>
            </div>
          </div>

          <div className={cn(
            "py-1.5 rounded text-[8px] font-bold uppercase tracking-wider text-center border font-sans",
            isDrowning ? "bg-rose-500 text-white border-rose-600 shadow-sm" : "bg-emerald-500/10 text-emerald-500 border-white/10"
          )}>
            {isDrowning ? "Emergency Cash Liquidation Required" : "System Shield Holding"}
          </div>
        </div>
      </div>
    </div>
  );
}
