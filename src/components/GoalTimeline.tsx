import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  Coins, 
  Landmark, 
  PiggyBank, 
  ShieldCheck, 
  Compass, 
  Sparkles, 
  ChevronRight, 
  Sliders,
  DollarSign
} from 'lucide-react';
import { Goal } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface GoalTimelineProps {
  goals: Goal[];
  onEditGoal: (goal: Goal) => void;
  isLoading?: boolean;
}

export function GoalTimeline({ goals, onEditGoal, isLoading }: GoalTimelineProps) {
  const [simulationSurplus, setSimulationSurplus] = useState<number>(0);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Parse today's date for distance calculations
  const today = new Date();

  const getMonthsBetween = (d1: Date, d2: Date) => {
    const diffMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    return Math.max(1, diffMonths);
  };

  // Helper to calculate payoff date for loans
  const getLoanPayoffMonths = (g: Goal) => {
    if (g.type !== 'debt' || !g.emi || g.emi <= 0) return 999;
    
    // Balance to clear
    const balance = g.targetAmount - g.currentAmount;
    if (balance <= 0) return 0;
    
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
    return Math.ceil(months);
  };

  // Pre-process and enrich goal timeline data
  const richTimelineGoals = goals.map(g => {
    const balance = Math.max(0, g.targetAmount - g.currentAmount);
    const isCompleted = balance <= 0;
    
    let targetDate: Date | null = null;
    let monthsRemaining = 0;
    let expectedAchievementDate: Date | null = null;
    let isLoanPayoff = g.type === 'debt';
    let label = 'SAVINGS GOAL';

    if (g.type === 'gold') label = 'GOLD COLLECTION';
    else if (g.type === 'debt') label = 'LIABILITY RECOVERY';
    else if (g.type === 'investment') label = 'GROWTH MILESTONE';
    
    // 1. Calculate Target Date (Deadline)
    if (isLoanPayoff) {
      const payoffMonths = getLoanPayoffMonths(g);
      monthsRemaining = payoffMonths;
      targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + payoffMonths);
    } else if (g.deadline) {
      targetDate = new Date(g.deadline);
      monthsRemaining = getMonthsBetween(today, targetDate);
    }

    // 2. Calculate Expected Completion based on CURRENT planned contributions
    const plannedSave = g.monthlyContribution || (g.type === 'debt' ? g.emi || 0 : 0);
    
    if (isCompleted) {
      expectedAchievementDate = today;
    } else if (plannedSave > 0) {
      // Simulate interest growth for investments if applicable, but keep it linear/realistic for cash flow
      const monthsToAchieve = balance / plannedSave;
      expectedAchievementDate = new Date();
      expectedAchievementDate.setMonth(expectedAchievementDate.getMonth() + Math.ceil(monthsToAchieve));
    }

    // 3. Dynamic Timeline Simulation - include the "Extra CFO Surplus" if selected
    let simulatedAchievementDate = expectedAchievementDate;
    if (selectedGoalId === g.id && simulationSurplus > 0 && !isCompleted) {
      const simulatedSave = plannedSave + simulationSurplus;
      if (simulatedSave > 0) {
        const simulatedMonths = balance / simulatedSave;
        simulatedAchievementDate = new Date();
        simulatedAchievementDate.setMonth(simulatedAchievementDate.getMonth() + Math.ceil(simulatedMonths));
      }
    }

    // 4. Calculate Required Monthly Contribution to fit the planned Deadline
    let requiredMonthly = 0;
    if (monthsRemaining > 0 && !isLoanPayoff && !isCompleted) {
      requiredMonthly = Math.ceil(balance / monthsRemaining);
    }

    // 5. Determine on-track status
    let status: 'completed' | 'on_track' | 'deficit' | 'unscheduled' = 'unscheduled';
    
    if (isCompleted) {
      status = 'completed';
    } else if (isLoanPayoff) {
      status = 'on_track'; // Defined by EMI structure
    } else if (!targetDate) {
      status = 'unscheduled';
    } else {
      const planned = g.monthlyContribution || 0;
      if (planned >= requiredMonthly - 1) { // 1 rupee margin for rounding
        status = 'on_track';
      } else {
        status = 'deficit';
      }
    }

    return {
      ...g,
      balance,
      isCompleted,
      targetDate,
      monthsRemaining,
      expectedAchievementDate,
      simulatedAchievementDate,
      requiredMonthly,
      plannedSave,
      status,
      label
    };
  });

  // Sort: Chronological by targetDate, with unscheduled goals placed last
  const sortedTimelineGoals = [...richTimelineGoals].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? -1 : 1; // Completed goals first or sorted logically
    }
    if (!a.targetDate && !b.targetDate) return 0;
    if (!a.targetDate) return 1;
    if (!b.targetDate) return -1;
    return a.targetDate.getTime() - b.targetDate.getTime();
  });

  // Metric summaries for CFO snapshot
  const totalPlannedInflow = richTimelineGoals.reduce((acc, g) => acc + (g.plannedSave || 0), 0);
  const totalRequiredInflow = richTimelineGoals.reduce((acc, g) => acc + (g.status === 'deficit' ? g.requiredMonthly : g.plannedSave || 0), 0);
  const timelineDeficit = Math.max(0, totalRequiredInflow - totalPlannedInflow);
  
  const scheduleDeficitGoals = richTimelineGoals.filter(g => g.status === 'deficit');
  const onTrackCount = richTimelineGoals.filter(g => g.status === 'on_track' || g.status === 'completed').length;
  const unscheduledGoals = richTimelineGoals.filter(g => g.status === 'unscheduled');

  const getCFOAestheticBadge = () => {
    if (timelineDeficit === 0 && scheduleDeficitGoals.length === 0) {
      return {
        label: "OPTIMAL ACCELERATION",
        style: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        desc: "All timelines are fully funded and on track. Excess surplus can be allocated to debt prepayments or system alpha."
      };
    }
    return {
      label: "TIMELINE DEFICIT",
      style: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      desc: `Capital shortfalls detected on ${scheduleDeficitGoals.length} goal(s). Adjust monthly allocations or stretch deadlines.`
    };
  };

  const statusBadge = getCFOAestheticBadge();

  return (
    <div className="space-y-6 md:space-y-8">
      {/* McKinsey CFO Snapshot Header */}
      <div className="bg-brand-surface p-6 border border-brand-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] relative overflow-hidden">
        <div className="absolute right-0 top-0 h-24 w-24 bg-brand-primary/[0.01] rounded-bl-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-brand-border/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border leading-none", statusBadge.style)}>
                {statusBadge.label}
              </span>
              <span className="text-[10px] font-mono font-bold text-brand-primary/30 uppercase tracking-wider">• Timeline Diagnosis</span>
            </div>
            <h3 className="text-lg font-bold text-brand-primary tracking-tight">Timeline Allocation Realism Mode</h3>
            <p className="text-xs text-brand-primary/50 max-w-2xl">{statusBadge.desc}</p>
          </div>

          <div className="flex items-center gap-1.5 md:self-start">
            <span className="text-[10px] font-mono font-bold text-brand-primary/40 uppercase">Sync Status:</span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE CALC
            </span>
          </div>
        </div>

        {/* Allocation Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-5">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-brand-primary/40 uppercase tracking-wider block">Currently Planned Monthly Auto-Save</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-brand-primary font-sans">{formatCurrency(totalPlannedInflow)}</span>
              <span className="text-xs font-mono text-brand-primary/30">/mo</span>
            </div>
            <p className="text-[9px] text-brand-primary/40 leading-none">Sum of all planned goal allocations</p>
          </div>

          <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-brand-border/40 pt-4 sm:pt-0 sm:pl-6">
            <span className="text-[10px] font-mono font-bold text-brand-primary/40 uppercase tracking-wider block">Target Required Monthly Flow</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-brand-primary font-sans">{formatCurrency(totalRequiredInflow)}</span>
              <span className="text-xs font-mono text-brand-primary/30 font-bold">/mo</span>
            </div>
            <p className="text-[9px] text-brand-primary/40 leading-none">Flow required to fulfill active deadlines</p>
          </div>

          <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-brand-border/40 pt-4 sm:pt-0 sm:pl-6">
            <span className="text-[10px] font-mono font-bold text-brand-accent uppercase tracking-wider block font-sans">Monthly Allocation Shortfall</span>
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                "text-xl font-bold font-sans",
                timelineDeficit > 0 ? "text-brand-accent" : "text-emerald-500"
              )}>
                {timelineDeficit > 0 ? formatCurrency(timelineDeficit) : "No Deficit"}
              </span>
              <span className="text-xs font-mono text-brand-primary/30">/mo</span>
            </div>
            <p className="text-[9px] text-brand-primary/40 leading-none">Extra budget needed to maintain all deadlines</p>
          </div>
        </div>
      </div>

      {/* Main Roadmap & Visualizer Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Chronological Goals Milestone Sequence */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider font-sans">Chronological Roadmap</h4>
              <p className="text-[9px] text-brand-primary/40 uppercase font-black tracking-widest leading-none">Milestones sequenced by target completion date</p>
            </div>
            <span className="text-[10px] font-mono font-medium text-brand-primary/40">
              {goals.length} target milestones
            </span>
          </div>

          {goals.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-brand-border bg-brand-surface rounded-2xl">
              <p className="text-brand-primary/30 text-sm">No goals listed in system</p>
              <p className="text-[9px] font-mono text-brand-primary/20 uppercase tracking-widest mt-1">Timeline mapping requires active targets</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-border/60">
              {sortedTimelineGoals.map((goal, idx) => {
                const goalColor = 
                  goal.type === 'debt' 
                    ? 'rose' 
                    : goal.type === 'gold' 
                      ? 'amber' 
                      : goal.type === 'investment' 
                        ? 'violet' 
                        : 'emerald';

                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={goal.id || idx}
                    className={cn(
                      "group bg-brand-surface border rounded-2xl p-5 shadow-sm transition-all relative",
                      selectedGoalId === goal.id ? "border-brand-accent/40 ring-1 ring-brand-accent/5" : "border-brand-border hover:border-brand-primary/20"
                    )}
                  >
                    {/* Node Dot marker */}
                    <div className={cn(
                      "absolute -left-6 top-7 h-2.5 w-2.5 rounded-full border-2 bg-brand-surface z-10 transition-transform group-hover:scale-125",
                      goalColor === 'rose' ? "border-rose-500 scale-110" :
                      goalColor === 'amber' ? "border-amber-400 scale-110" :
                      goalColor === 'violet' ? "border-indigo-500 scale-110" : "border-emerald-500 scale-110"
                    )} />

                    {/* Left Connector Branch details */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-brand-border/40">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border leading-none",
                            goalColor === 'rose' ? "bg-rose-50 text-rose-600 border-rose-100" :
                            goalColor === 'amber' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            goalColor === 'violet' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                          )}>
                            {goal.label}
                          </span>
                          
                          {/* Track badge */}
                          {goal.isCompleted ? (
                            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-500/5 px-2 py-0.5 rounded uppercase border border-emerald-100">Achieved</span>
                          ) : goal.status === 'on_track' ? (
                            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-500/5 px-2 py-0.5 rounded uppercase border border-emerald-100">On Track</span>
                          ) : goal.status === 'deficit' ? (
                            <span className="text-[8px] font-bold text-brand-accent bg-brand-accent/5 px-2 py-0.5 rounded uppercase border border-brand-accent/10">Deficit Gap</span>
                          ) : (
                            <span className="text-[8px] font-bold text-brand-primary/40 bg-brand-bg px-2 py-0.5 rounded uppercase border border-brand-border/40">Unscheduled</span>
                          )}

                          {goal.priority && (
                            <span className="text-[7px] font-mono font-bold uppercase tracking-wider text-brand-primary/30">[PR: {goal.priority}]</span>
                          )}
                        </div>

                        <h5 className="text-base font-bold text-brand-primary tracking-tight mt-1.5 flex items-center gap-1.5 uppercase">
                          {goal.name}
                          {goal.isScheme && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                        </h5>
                      </div>

                      {/* Right Dates summary */}
                      <div className="text-left sm:text-right font-sans font-medium text-xs text-brand-primary/50">
                        {goal.isCompleted ? (
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">Maturity Status</p>
                            <p className="text-base font-bold text-emerald-500">PAID & ACHIEVED</p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-brand-primary/40 font-bold uppercase tracking-widest leading-none">Target Timeline</p>
                            <p className="text-sm font-bold text-brand-primary mt-1">
                              {goal.targetDate 
                                ? goal.targetDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                                : 'No Deadline Assigned'
                              }
                            </p>
                            {goal.targetDate && (
                              <p className="text-[10px] text-brand-accent/70 font-bold">
                                {goal.monthsRemaining} {goal.monthsRemaining === 1 ? 'month' : 'months'} remaining
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress tracking details */}
                    <div className="py-3.5 border-b border-brand-border/30 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-brand-primary/40 font-bold uppercase tracking-wider text-[9px]">Fund Progress</span>
                        <span className="text-brand-primary font-bold text-xs">
                          {formatCurrency(goal.currentAmount)} <span className="text-brand-primary/30">/</span> {formatCurrency(goal.targetAmount)}
                        </span>
                      </div>

                      {/* Mini visual indicator */}
                      <div className="h-1.5 w-full bg-brand-bg rounded-lg overflow-hidden border border-brand-border/40">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            goal.isCompleted ? "bg-emerald-500" :
                            goalColor === 'rose' ? "bg-rose-500" :
                            goalColor === 'amber' ? "bg-amber-400" :
                            goalColor === 'violet' ? "bg-indigo-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0)}%` }}
                        />
                      </div>
                    </div>

                    {/* Allocation Realism Diagnostics */}
                    <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[11px] flex-grow">
                        <div>
                          <span className="text-brand-primary/40 text-[9px] uppercase font-bold tracking-wider">Current Outflow</span>
                          <p className="font-bold text-brand-primary">
                            {formatCurrency(goal.plannedSave)}<span className="text-brand-primary/40 font-normal">/mo</span>
                          </p>
                        </div>

                        {!goal.isCompleted && goal.targetDate && (
                          <div>
                            <span className="text-brand-primary/40 text-[9px] uppercase font-bold tracking-wider">Required Save Outflow</span>
                            <p className="font-bold text-brand-primary">
                              {formatCurrency(goal.requiredMonthly)}<span className="text-brand-primary/40 font-normal">/mo</span>
                            </p>
                          </div>
                        )}

                        {!goal.isCompleted && (
                          <div className="col-span-2 md:col-span-1">
                            <span className="text-brand-primary/40 text-[9px] uppercase font-bold tracking-wider">Expected Completion</span>
                            <p className={cn(
                              "font-bold",
                              goal.simulatedAchievementDate && goal.targetDate && goal.simulatedAchievementDate > goal.targetDate
                                ? "text-brand-accent"
                                : "text-emerald-500"
                            )}>
                              {goal.expectedAchievementDate 
                                ? goal.simulatedAchievementDate?.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                                : 'Undefined'
                              }
                              {selectedGoalId === goal.id && simulationSurplus > 0 && (
                                <span className="text-[10px] font-mono font-bold text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100 ml-1">Simulated</span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Allocation actions / edit trigger */}
                      <div className="flex items-center gap-2 md:self-end">
                        {!goal.isCompleted && !goal.isScheme && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGoalId(selectedGoalId === goal.id ? null : goal.id || null);
                              if (selectedGoalId !== goal.id) {
                                setSimulationSurplus(0); // Reset simulation
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-[8.5px] font-bold uppercase tracking-wider transition-all leading-none",
                              selectedGoalId === goal.id 
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                                : "bg-brand-bg border-brand-border text-brand-primary/60 hover:bg-brand-primary/5 hover:text-brand-primary"
                            )}
                          >
                            Simulate Surplus
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditGoal(goal)}
                          className="px-3 py-1.5 bg-brand-bg border border-brand-border hover:bg-brand-primary/5 text-brand-primary/60 hover:text-brand-primary rounded-lg text-[8.5px] font-bold uppercase tracking-wider transition-all leading-none"
                        >
                          Configure Timeline
                        </button>
                      </div>
                    </div>

                    {/* Inline Simulated Area */}
                    <AnimatePresence>
                      {selectedGoalId === goal.id && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-3 pt-3 border-t border-dashed border-brand-border"
                        >
                          <div className="bg-indigo-500/[0.02] p-4 border border-indigo-500/10 rounded-xl space-y-3 font-sans">
                            <div className="flex justify-between items-center text-[11px]">
                              <div>
                                <h6 className="font-bold text-indigo-600 uppercase text-[9px] tracking-wide">CFO Surplus Simulator</h6>
                                <p className="text-[8px] text-brand-primary/40 uppercase font-bold tracking-wider mt-0.5">Allocating extra buffer flow to speed timeline</p>
                              </div>
                              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded text-xs select-none">
                                +{formatCurrency(simulationSurplus)}/mo
                              </span>
                            </div>

                            <input 
                              type="range"
                              min="0"
                              max="100000"
                              step="2000"
                              value={simulationSurplus}
                              onChange={(e) => setSimulationSurplus(parseFloat(e.target.value))}
                              className="w-full accent-indigo-600 h-1.5 bg-brand-bg rounded-lg cursor-pointer"
                            />

                            {simulationSurplus > 0 && goal.expectedAchievementDate && goal.simulatedAchievementDate && (
                              <div className="flex items-center gap-1.5 p-2 bg-indigo-50 border border-indigo-100/50 rounded-lg text-[10px] text-indigo-700 leading-none font-bold">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse flex-shrink-0" />
                                <span>
                                  Accelerates target fulfillment date from {goal.expectedAchievementDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} to {goal.simulatedAchievementDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}!
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: McKinsey Strategic CFO Timeline Advisor */}
        <div className="space-y-6">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 space-y-4 font-sans shadow-sm">
            <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider">CFO Scheduling Analysis</h4>
            <div className="h-px bg-brand-border/40" />

            <div className="space-y-4">
              {/* Alert Segment */}
              {scheduleDeficitGoals.length > 0 ? (
                <div className="p-3 bg-brand-accent/5 border border-brand-accent/10 rounded-xl space-y-1.5">
                  <div className="flex items-start gap-2 text-brand-accent">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider">Timeline Shortfalls Detected</p>
                      <p className="text-[9px] leading-tight text-brand-primary/50 mt-0.5">
                        Your budgeted monthly cash allocations to the following goals are insufficient to successfully hit their target deadlines:
                      </p>
                    </div>
                  </div>
                  <ul className="text-[10px] font-bold list-disc pl-5 text-brand-primary space-y-1 uppercase">
                    {scheduleDeficitGoals.map(g => (
                      <li key={g.id}>
                        {g.name} &nbsp; 
                        <span className="text-brand-accent font-black">
                          (₹{(g.requiredMonthly - g.plannedSave).toLocaleString('en-IN')}/mo gap)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 rounded-xl flex items-start gap-2.5 text-emerald-600">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider">System Goals Stable</p>
                    <p className="text-[9px] leading-tight text-emerald-600/70 mt-0.5 uppercase">
                      All your sequenced goals are fully funded according to your defined target dates! Optimal allocation model is active.
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic sequence recommendations */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono font-bold text-brand-primary/40 uppercase tracking-wider block">Strategic Priority Ordering</span>
                
                <div className="space-y-2 text-[11px] leading-relaxed text-brand-primary/70">
                  <div className="flex gap-2.5 items-start">
                    <div className="h-5 w-5 rounded-full bg-brand-bg text-brand-primary font-mono font-bold text-[10px] flex items-center justify-center border border-brand-border flex-shrink-0 select-none">
                      1
                    </div>
                    <p className="mt-0.5">
                      <span className="font-bold text-brand-primary uppercase">Debt paydowns</span> should always take absolute priority over wealth targets if Interest rate is &gt; 10.5%. Keep Sinking Funds active.
                    </p>
                  </div>

                  <div className="flex gap-2.5 items-start">
                    <div className="h-5 w-5 rounded-full bg-brand-bg text-brand-primary font-mono font-bold text-[10px] flex items-center justify-center border border-brand-border flex-shrink-0 select-none">
                      2
                    </div>
                    <p className="mt-0.5">
                      <span className="font-bold text-brand-primary uppercase">High priority timelines</span> are sorted chronologically. Stretch medium and low priority targets to cover any system deficit of <span className="font-mono font-bold text-brand-accent">{formatCurrency(timelineDeficit)}/mo</span>.
                    </p>
                  </div>
                  
                  {unscheduledGoals.length > 0 && (
                    <div className="p-3 bg-brand-bg border border-brand-border rounded-xl space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5 text-brand-primary/60 text-[10px] font-bold uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5 text-brand-primary/40" />
                        <span>Unscheduled Milestones ({unscheduledGoals.length})</span>
                      </div>
                      <p className="text-[9px] text-brand-primary/40 leading-snug">
                        Assigning an expected timeline ensures we can auto-calculate dynamic contributions. Select configure on these elements:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unscheduledGoals.map(g => (
                          <button
                            key={g.id}
                            onClick={() => onEditGoal(g)}
                            className="bg-brand-surface hover:bg-brand-primary/5 text-brand-primary font-bold text-[8.5px] uppercase tracking-wider py-1 px-2 border border-brand-border rounded transition-all leading-none"
                          >
                            {g.name} &rarr;
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CFO Methodology Trade-offs panel */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 space-y-3 font-sans shadow-sm uppercase text-[9px] text-brand-primary/50">
            <div className="flex items-center gap-1 pb-1 text-brand-primary/60 font-black tracking-wider border-b border-brand-border/40">
              <Compass className="w-3.5 h-3.5 text-brand-accent" />
              <span>CFO Trade-off Principle</span>
            </div>
            <p className="leading-relaxed italic">
              "SEQUENCE OVER PARALLEL EXECUTION. IT IS BETTER TO COMPLETE TWO HIGH-PRIORITY MILESTONES ON-TIME THAN TO DELAY FIVE SIMULTANEOUSLY. UNDER BUDGET CONSTRAINT, EXTEND THE LIFESTYLE TARGET DEADLINES FIRST TO PROTECT STABLE ASSET ACCUMULATION TYPE GOALS."
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
