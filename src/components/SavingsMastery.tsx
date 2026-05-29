import React, { useState } from 'react';
import { 
  Award, 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  Coins, 
  Activity, 
  Flame, 
  Target, 
  HelpCircle, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles,
  Info,
  Clock
} from 'lucide-react';
import { Goal, Transaction, IncomeStream } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';

interface SavingsMasteryProps {
  goals: Goal[];
  transactions: Transaction[];
  incomeStreams: IncomeStream[];
  balance: number;
  incomeShock: number;
  expenseShock: number;
  survivalMonths: number;
}

export function SavingsMastery({
  goals,
  transactions,
  incomeStreams,
  balance,
  incomeShock,
  expenseShock,
  survivalMonths
}: SavingsMasteryProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'quests' | 'achievements'>('all');
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);

  // 1. DYNAMIC COMPILATION OF XP (Financial Experience Points)
  const xpFromGoalsCount = goals.length * 50; 
  const xpFromGoalCompletion = goals.filter(g => g.currentAmount >= g.targetAmount && g.targetAmount > 0).length * 200;
  
  const savingTransactionsCount = transactions.filter(
    t => t.linkedGoalId || t.category === 'Savings' || t.category === 'Investments & EMI' || t.category === 'Debt Repayment'
  ).length;
  const xpFromTransactions = savingTransactionsCount * 30;
  
  const xpFromIncomeStreams = incomeStreams.filter(i => i.status === 'active').length * 40;
  
  const hasActivePrepayment = goals.filter(g => g.type === 'debt').some(d => d.currentAmount > 0);
  const xpFromPrepayment = hasActivePrepayment ? 120 : 0;
  
  const isStressed = incomeShock !== 1 || expenseShock !== 1;
  const xpFromStressAuditing = isStressed ? 80 : 0;

  const totalXP = xpFromGoalsCount + xpFromGoalCompletion + xpFromTransactions + xpFromIncomeStreams + xpFromPrepayment + xpFromStressAuditing;
  
  // Level Definition: 400 XP per level
  const xpPerLevel = 400;
  const currentLevel = Math.floor(totalXP / xpPerLevel) + 1;
  const xpInCurrentLevel = totalXP % xpPerLevel;
  const progressPercent = Math.min(100, (xpInCurrentLevel / xpPerLevel) * 100);

  // Level Title Calculation
  const getLevelTitle = (lvl: number) => {
    if (lvl <= 1) return "Financial Apprentice";
    if (lvl <= 2) return "Reserve Guardian";
    if (lvl <= 4) return "Liquidity Commander";
    if (lvl <= 6) return "Portfolio Strategist";
    return "Sovereign Capitalist";
  };

  const levelTitle = getLevelTitle(currentLevel);

  // 2. TACTICAL QUESTS (Real-time active challenge statuses)
  const quests = [
    {
      id: 'stress_test',
      title: 'Crisis Shield Auditing',
      desc: 'Run a Stress Test by shifting income or spending shocks away from 100% to audit your cash resistance.',
      xp: 80,
      isCompleted: isStressed,
      actionLabel: 'Use Test Console'
    },
    {
      id: 'active_reserve',
      title: 'Emergency Safeguard Target',
      desc: 'Formulate at least one crucial Savings or Emergency Reserve goal to protect short-term liabilities.',
      xp: 50,
      isCompleted: goals.length > 0,
      actionLabel: 'Define Target Goal'
    },
    {
      id: 'prepayment_attack',
      title: 'Debt Prepay Initiation',
      desc: 'Identify loan liabilities and deploy systematic early contributions to reduce multi-year compounding cycles.',
      xp: 120,
      isCompleted: hasActivePrepayment,
      actionLabel: 'Explore Debt Payoffs'
    },
    {
      id: 'waste_auditing',
      title: 'Discretionary Pruning',
      desc: 'Identify at least 1 avoidable spend category or subscription from your list of transactions to plug cash leaks.',
      xp: 60,
      isCompleted: transactions.some(t => t.isAvoidable),
      actionLabel: 'Audit Waste Checks'
    },
    {
      id: 'systematic_consistency',
      title: 'Consistent Allocator Stride',
      desc: 'Commit to logging at least 3 separate systematic goal contributions or savings records.',
      xp: 100,
      isCompleted: savingTransactionsCount >= 3,
      counter: `${Math.min(3, savingTransactionsCount)}/3 registered`,
      actionLabel: 'Log Savings Entry'
    }
  ];

  // 3. MASTER PIECE ACHIEVEMENT BADGES
  const badges = [
    {
      id: 'debt_destroyer',
      title: 'Debt Destroyer',
      sub: 'Prepayment Sovereign',
      desc: 'Unlocked by establishing prepayments toward loan balances to cut long-term compounding interest charges.',
      icon: Zap,
      color: 'text-rose-500 border-rose-500/20 bg-rose-500/[0.02]',
      unlocked: hasActivePrepayment
    },
    {
      id: 'crisis_commander',
      title: 'Crisis Commander',
      sub: 'Operational Resilience',
      desc: 'Unlocked by sustaining a stress test survival runway of 6 months or more under severe liquidity crises.',
      icon: ShieldCheck,
      color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/[0.02]',
      unlocked: survivalMonths >= 6
    },
    {
      id: 'alpha_allocator',
      title: 'Alpha Allocator',
      sub: 'Surplus Optimisation',
      desc: 'Unlocked by having a systematic monthly free surplus cash of ₹15,000 or greater to route into timelines.',
      icon: TrendingUp,
      color: 'text-brand-accent border-brand-accent/20 bg-brand-accent/[0.02]',
      unlocked: balance >= 15000
    },
    {
      id: 'gold_standard',
      title: 'Gold Guardian',
      sub: 'Asset Diversification',
      desc: 'Unlocked by defining a goal specifically dedicated to Gold Collections or core physical allocations.',
      icon: Coins,
      color: 'text-amber-500 border-amber-500/20 bg-amber-500/[0.02]',
      unlocked: goals.some(g => g.type === 'gold')
    },
    {
      id: 'fortress_builder',
      title: 'Fortress Builder',
      sub: 'Milestone Sovereign',
      desc: 'Unlocked by successfully securing and completing one or more defined goal roadmaps fully.',
      icon: Target,
      color: 'text-indigo-500 border-indigo-500/20 bg-indigo-500/[0.02]',
      unlocked: goals.some(g => g.currentAmount >= g.targetAmount && g.targetAmount > 0)
    },
    {
      id: 'continuous_saver',
      title: 'Consistent Compounder',
      sub: 'Habitual Saving',
      desc: 'Unlocked by logging five or more separate systematic contributions to savings goals.',
      icon: Flame,
      color: 'text-orange-500 border-orange-500/20 bg-orange-500/[0.02]',
      unlocked: savingTransactionsCount >= 5
    }
  ];

  const unlockedCount = badges.filter(b => b.unlocked).length;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* 1. MASTER COMMAND CORE ROW: GIGANTIC LEVEL PROGRESSION CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Core Progression Card */}
        <div className="lg:col-span-8 bg-brand-primary text-brand-surface rounded-2xl p-6 border border-white/5 relative overflow-hidden group flex flex-col justify-between shadow-lg min-h-[180px]">
          {/* Cosmic Ambient Lines */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-brand-accent/[0.03] to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-accent animate-pulse" />
                <span className="text-[8px] font-mono font-black text-white/40 uppercase tracking-widest leading-none">Capital Mastery Hub</span>
              </div>
              <h3 className="text-xl font-display font-black uppercase tracking-tight text-white leading-none">
                {levelTitle}
              </h3>
              <p className="text-[9px] text-white/40 font-mono tracking-wider">
                XP levels grow dynamically as you save, clear debt & bulletproof cash flows.
              </p>
            </div>
            
            <div className="flex items-baseline gap-2 bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl font-mono self-start md:self-auto shadow-sm">
              <span className="text-3xl font-black text-brand-accent leading-none">{currentLevel}</span>
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest leading-none">Level</span>
            </div>
          </div>

          <div className="relative z-10 space-y-2 mt-6">
            <div className="flex justify-between items-baseline text-[9px] font-mono text-white/40 uppercase font-bold tracking-wider">
              <span>Next Level in {xpPerLevel - xpInCurrentLevel} XP</span>
              <span>{Math.floor(totalXP)} / {Math.floor(totalXP + xpPerLevel - xpInCurrentLevel)} Total XP</span>
            </div>
            
            {/* Elegant glowing level bar */}
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden p-0.5 border border-white/5">
              <div 
                className="h-full bg-brand-accent rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Level Stats Block */}
        <div className="lg:col-span-4 bg-brand-surface border border-brand-border rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-0.5 border-b border-brand-border pb-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-brand-primary">Capital Scorecard</h4>
            <p className="text-[8px] text-brand-primary/30 uppercase tracking-widest font-bold">Dynamic achievements record</p>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-grow py-1">
            <div className="bg-brand-bg/50 p-3 rounded-xl border border-brand-border/60 flex flex-col justify-center space-y-0.5">
              <span className="text-[8px] font-bold text-brand-primary/35 uppercase tracking-wider block">Badges Earned</span>
              <span className="text-base font-mono font-black text-brand-primary">{unlockedCount} / {badges.length}</span>
            </div>
            <div className="bg-brand-bg/50 p-3 rounded-xl border border-brand-border/60 flex flex-col justify-center space-y-0.5">
              <span className="text-[8px] font-bold text-brand-primary/35 uppercase tracking-wider block">Active Quests Done</span>
              <span className="text-base font-mono font-black text-emerald-600">
                {quests.filter(q => q.isCompleted).length} / {quests.length}
              </span>
            </div>
          </div>

          <div className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl p-2.5 flex items-center gap-2 text-[10px] text-brand-primary/60 leading-normal">
            <Award className="w-3.5 h-3.5 text-brand-accent shrink-0" />
            <p>
              Your Level reflects your cash flow status. <span className="font-bold text-brand-primary">Accumulate systematic savings</span> to compound your score.
            </p>
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROLS */}
      <div className="flex border-b border-brand-border/60 pb-px">
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 leading-none transition-all",
              activeTab === 'all' 
                ? "border-brand-primary text-brand-primary" 
                : "border-transparent text-brand-primary/40 hover:text-brand-primary"
            )}
          >
            Universal Mastery
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={cn(
              "px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 leading-none transition-all",
              activeTab === 'quests' 
                ? "border-brand-primary text-brand-primary" 
                : "border-transparent text-brand-primary/40 hover:text-brand-primary"
            )}
          >
            Quests & Challenges ({quests.filter(q => q.isCompleted).length})
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={cn(
              "px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 leading-none transition-all",
              activeTab === 'achievements' 
                ? "border-brand-primary text-brand-primary" 
                : "border-transparent text-brand-primary/40 hover:text-brand-primary"
            )}
          >
            Milestone Badges ({unlockedCount})
          </button>
        </div>
      </div>

      {/* 3. LIST RENDERING */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Playable Quests Module */}
        {(activeTab === 'all' || activeTab === 'quests') && (
          <div className={cn(
            "space-y-4",
            activeTab === 'quests' ? "md:col-span-12" : "md:col-span-7 lg:col-span-8"
          )}>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-brand-primary font-sans">Active Financial Challenges</h4>
              <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Execute tasks to lock in incremental XP</p>
            </div>

            <div className="space-y-3.5">
              {quests.map(quest => (
                <div 
                  key={quest.id}
                  className={cn(
                    "flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border transition-all h-full gap-4",
                    quest.isCompleted 
                      ? "bg-emerald-500/[0.015] border-emerald-500/10" 
                      : "bg-brand-surface border-brand-border/60 hover:border-brand-primary/10"
                  )}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 mt-0.5",
                      quest.isCompleted 
                        ? "bg-emerald-500/10 border-emerald-500/15 text-emerald-600" 
                        : "bg-brand-bg border-brand-border/40 text-brand-primary/20"
                    )}>
                      {quest.isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Activity className="w-4 h-4 animate-pulse" />}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-primary leading-tight uppercase font-sans">
                          {quest.title}
                        </span>
                        <span className={cn(
                          "text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border leading-none uppercase shrink-0",
                          quest.isCompleted 
                            ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-500" 
                            : "bg-brand-bg border-brand-border/40 text-brand-primary/30"
                        )}>
                          +{quest.xp} XP
                        </span>
                      </div>
                      <p className="text-[10px] text-brand-primary/55 leading-relaxed font-sans max-w-xl">
                        {quest.desc}
                      </p>
                      
                      {quest.counter && (
                        <p className="text-[8.5px] font-mono text-indigo-500 font-bold uppercase tracking-wider">
                          Progress: {quest.counter}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="w-full sm:w-auto flex justify-end shrink-0">
                    {quest.isCompleted ? (
                      <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Achieved
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase text-brand-primary/35 tracking-wider font-mono">
                        Active Challenge
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements / Badge Vault Block */}
        {(activeTab === 'all' || activeTab === 'achievements') && (
          <div className={cn(
            "space-y-4",
            activeTab === 'achievements' ? "md:col-span-12" : "md:col-span-5 lg:col-span-4"
          )}>
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-brand-primary font-sans">Milestone Badges Wall</h4>
              <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Sovereign accolades of capital stability</p>
            </div>

            <div className={cn(
              "grid gap-3.5",
              activeTab === 'achievements' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            )}>
              {badges.map(badge => {
                const BadgeIcon = badge.icon;
                return (
                  <div 
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge.id)}
                    className={cn(
                      "p-4 rounded-xl border transition-all duration-300 relative group cursor-pointer",
                      badge.unlocked 
                        ? cn("border-brand-primary/10 shadow-sm", badge.color)
                        : "bg-brand-surface/40 border-brand-border/40 opacity-55 grayscale"
                    )}
                  >
                    {/* Corner badge mark */}
                    <div className="absolute top-3 right-3">
                      {badge.unlocked ? (
                        <div className="w-2 h-2 rounded-full bg-brand-accent animate-ping" />
                      ) : (
                        <HelpCircle className="w-3.5 h-3.5 text-brand-primary/20" />
                      )}
                    </div>

                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0",
                        badge.unlocked 
                          ? "bg-white border-white/50 text-brand-primary shadow-sm" 
                          : "bg-brand-bg border-brand-border text-brand-primary/25"
                      )}>
                        <BadgeIcon className="w-5 h-5" />
                      </div>

                      <div className="space-y-0.5 min-w-0 pr-2">
                        <p className="text-xs font-black text-brand-primary uppercase tracking-tight truncate leading-tight">
                          {badge.title}
                        </p>
                        <p className="text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest truncate leading-none">
                          {badge.sub}
                        </p>
                      </div>
                    </div>

                    {/* Expandable/Interactive badge inspection drawer */}
                    <p className="text-[10px] text-brand-primary/60 leading-normal font-sans mt-3 border-t border-brand-border/10 pt-2 text-justify">
                      {badge.desc}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[8px] font-mono leading-none">
                      <span className={cn(
                        "font-bold uppercase tracking-widest",
                        badge.unlocked ? "text-emerald-600" : "text-brand-primary/35"
                      )}>
                        {badge.unlocked ? 'Unlocked & Active' : 'Locked'}
                      </span>
                      {badge.unlocked && (
                        <span className="text-brand-primary/30 group-hover:text-brand-primary/50 transition-colors">
                          CFO certified
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Micro Gamification Advice Widget */}
            <div className="bg-brand-surface border border-brand-border/60 p-4 rounded-xl space-y-2">
              <span className="text-[8px] font-mono font-bold text-indigo-600 uppercase tracking-widest block">Consultant Tip</span>
              <p className="text-[9.5px] font-sans leading-relaxed text-brand-primary/50">
                "Gamifying capital accrual isn't about arbitrary points—it builds positive behavioral conditioning. Reaching Level 5+ requires strict execution of systematic contributions and structural buffer protections."
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
