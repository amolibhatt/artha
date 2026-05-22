import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trash2, Edit2, ShieldAlert, CheckCircle, TrendingUp, Landmark } from 'lucide-react';
import { Goal } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface GoalItemProps {
  goal: Goal;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function GoalItem({ goal, onEdit, onDelete }: GoalItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const isCompleted = progress >= 100;
  
  const calculatePayoffDate = (g: Goal) => {
    if (g.type !== 'debt' || !g.emi || g.emi <= 0) return null;
    
    const balance = g.targetAmount - g.currentAmount;
    if (balance <= 0) return 'PAID';
    
    const rate = (g.interestRate || 8.5) / 100 / 12;
    const emi = g.emi;
    
    let months = 0;
    if (rate > 0) {
      const numerator = Math.log(1 - (balance * rate) / emi);
      if (isNaN(numerator)) {
        months = balance / emi;
      } else {
        months = -numerator / Math.log(1 + rate);
      }
    } else {
      months = balance / emi;
    }

    const date = new Date();
    date.setMonth(date.getMonth() + Math.ceil(months));
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  const payoffDate = calculatePayoffDate(goal);
  
  const remainingValue = Math.max(0, goal.targetAmount - goal.currentAmount);

  // Format deadline for normal humans
  const formattedDeadline = goal.deadline 
    ? new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className={cn(
        "bg-brand-surface p-5 border rounded-2xl transition-all flex flex-col justify-between relative overflow-hidden",
        isCompleted 
          ? "border-emerald-500/30 shadow-[0_4px_12px_rgba(16,185,129,0.03)]" 
          : "border-brand-border shadow-sm hover:shadow-md"
      )}
    >
      {isCompleted && (
        <div className="absolute top-0 right-0 h-16 w-16 overflow-hidden">
          <div className="absolute top-2 right-[-24px] rotate-45 bg-emerald-500 text-white text-[8px] font-bold py-1 px-8 text-center uppercase tracking-wider">
            Done
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Header containing name, type badge, priority badge */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
              goal.type === 'debt' 
                ? "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400" 
                : "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
            )}>
              {goal.type === 'debt' ? 'Debt Payoff' : goal.type === 'investment' ? 'Investment Goal' : 'Savings Goal'}
            </span>
            <h4 className="text-base font-bold text-brand-primary tracking-tight pt-1">
              {goal.name}
            </h4>
          </div>

          <div className="text-right">
            <span className={cn(
              "text-2xl font-mono font-bold leading-none select-none",
              isCompleted ? "text-emerald-500" : "text-brand-primary"
            )}>
              {progress.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Clear readable progress metrics */}
        <div className="space-y-1 animate-in fade-in duration-300">
          <div className="flex justify-between items-baseline text-xs text-brand-primary/60">
            <span>Progress Details</span>
            <span>
              {isCompleted ? (
                <span className="text-emerald-500 font-bold flex items-center gap-1 text-[10px]">
                  <CheckCircle className="w-3.5 h-3.5" /> Achieved!
                </span>
              ) : (
                <span className="font-medium text-brand-primary/80">
                  {formatCurrency(goal.currentAmount)} saved
                </span>
              )}
            </span>
          </div>

          {/* Detailed simple stats */}
          <div className="grid grid-cols-2 gap-4 bg-brand-bg/50 p-3 rounded-xl border border-brand-border/40 font-sans">
            <div>
              <p className="text-[9px] text-brand-primary/40 uppercase font-black tracking-wider">Target Goal</p>
              <p className="text-sm font-bold text-brand-primary">{formatCurrency(goal.targetAmount)}</p>
            </div>
            <div className="text-right">
              {isCompleted ? (
                <>
                  <p className="text-[9px] text-emerald-500/60 uppercase font-black tracking-wider">Status</p>
                  <p className="text-sm font-bold text-emerald-500">Completed</p>
                </>
              ) : (
                <>
                  <p className="text-[9px] text-brand-accent/60 uppercase font-black tracking-wider">Remaining Balance</p>
                  <p className="text-sm font-bold text-brand-accent">{formatCurrency(remainingValue)} left</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Beautiful animated progress bar */}
        <div className="space-y-1">
          <div className="h-2 w-full bg-brand-bg rounded-lg overflow-hidden border border-brand-border/40 p-[1px]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isCompleted 
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]" 
                  : goal.type === 'debt' 
                    ? "bg-brand-accent shadow-[0_0_8px_rgba(235,94,40,0.15)]" 
                    : "bg-brand-primary"
              )}
            />
          </div>
        </div>
      </div>

      {/* Footer Details: timeline & actions */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-brand-border/40 relative z-10">
        <div className="flex items-center gap-3">
          {/* Target Dates or Monthly EMIs/Contributions */}
          {goal.type === 'debt' && goal.emi ? (
            <div className="space-y-0.5">
              <p className="text-[9px] text-brand-accent/60 font-black uppercase tracking-wider">Payoff Plan</p>
              <p className="text-xs text-brand-primary font-bold">
                {formatCurrency(goal.emi)}/mo • {payoffDate ? `Ready by ${payoffDate}` : 'N/A'}
              </p>
            </div>
          ) : goal.monthlyContribution ? (
            <div className="space-y-0.5">
              <p className="text-[9px] text-emerald-600/70 font-black uppercase tracking-wider">Monthly Saving Plan</p>
              <p className="text-xs text-brand-primary font-bold">
                {formatCurrency(goal.monthlyContribution)}/mo {formattedDeadline ? `• target ${formattedDeadline}` : ''}
              </p>
            </div>
          ) : formattedDeadline ? (
            <div className="space-y-0.5">
              <p className="text-[9px] text-brand-primary/40 font-black uppercase tracking-wider">Target Date</p>
              <p className="text-xs text-brand-primary font-bold">{formattedDeadline}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-[9px] text-brand-primary/40 font-black uppercase tracking-wider">Timeline</p>
              <p className="text-xs text-brand-primary font-bold text-brand-primary/60">No set deadline</p>
            </div>
          )}
        </div>
        
        {/* Actions panel */}
        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="p-2 bg-brand-bg hover:bg-brand-primary/5 text-brand-primary border border-brand-border/65 rounded-xl transition-all"
            title="Edit Goal"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isDeleting) {
                onDelete?.();
              } else {
                setIsDeleting(true);
                setTimeout(() => setIsDeleting(false), 3000);
              }
            }}
            className={cn(
              "p-2 rounded-xl border transition-all flex items-center justify-center font-sans font-bold uppercase tracking-wider",
              isDeleting 
                ? "bg-rose-500 text-white border-rose-600 px-3 text-[9px]" 
                : "text-rose-500/30 hover:text-rose-600 hover:bg-rose-500/10 border-transparent"
            )}
          >
            {isDeleting ? (
              <span>Confirm</span>
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
