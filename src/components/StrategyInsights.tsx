import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Sparkles, TrendingUp, AlertCircle, Loader2, ChevronRight, Plus, ShieldCheck, Compass } from 'lucide-react';
import { Transaction, Goal } from '../types';
import { generateCFOStrategy } from '../services/strategyService';
import { cn } from '../lib/utils';

interface StrategyInsightsProps {
  transactions: Transaction[];
  goals: Goal[];
  balance: number;
  totalIncome: number;
  totalSavings: number;
}

export function StrategyInsights({ transactions, goals, balance, totalIncome, totalSavings }: StrategyInsightsProps) {
  const [strategy, setStrategy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transactions.length > 0 && !strategy && !isLoading && !error) {
      handleGenerate();
    }
  }, [transactions.length, goals.length]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateCFOStrategy(transactions, goals);
      setStrategy(result || "Unable to generate strategy at this time.");
    } catch (err) {
      setError("Failed to generate strategy. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gallery-white p-12 brutal-border brutal-shadow space-y-12 relative overflow-hidden group">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-brutal-black brutal-border flex items-center justify-center shadow-xl transition-all duration-700 group-hover:scale-105">
            <Sparkles className="w-10 h-10 text-neon-green" />
          </div>
          <div className="space-y-2">
            <h3 className="text-6xl font-display uppercase text-brutal-black leading-none">Audit</h3>
            <p className="text-[11px] text-stone-400 font-bold uppercase tracking-[0.3em] font-mono">Capital Optimization Engine</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="bg-brutal-black text-neon-green px-12 py-6 brutal-border brutal-shadow-hover transition-all disabled:opacity-50 flex items-center gap-6 font-display text-2xl uppercase"
        >
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <TrendingUp className="w-6 h-6" />}
          {isLoading ? 'Processing' : 'Run Audit'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isLoading && !strategy ? (
          <div className="py-24 flex flex-col items-center justify-center gap-10 relative z-10">
            <Loader2 className="w-16 h-16 animate-spin text-brutal-black" />
            <div className="text-center space-y-4">
              <p className="text-xl text-brutal-black font-display uppercase tracking-[0.3em] animate-pulse">Analyzing Capital Vectors</p>
              <p className="text-xs text-stone-400 font-mono font-bold uppercase tracking-[0.2em]">Synthesizing market arbitrage opportunities</p>
            </div>
          </div>
        ) : strategy ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10"
          >
            <div className="bg-stone-50 p-12 brutal-border relative overflow-hidden">
              <div className="markdown-body relative z-10">
                <Markdown>{strategy}</Markdown>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="brutal-border border-dashed border-stone-300 p-24 text-center relative z-10 bg-stone-50">
            <div className="space-y-10">
              <div className="w-20 h-20 bg-stone-100 brutal-border flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10 text-stone-300" />
              </div>
              <div className="space-y-4">
                <p className="text-4xl font-display uppercase text-brutal-black leading-none">System Ready</p>
                <p className="text-xs text-stone-400 font-mono font-bold uppercase tracking-[0.2em]">Log transactions to enable capital efficiency analysis</p>
              </div>
              <button
                onClick={handleGenerate}
                className="bg-brutal-black text-neon-green px-10 py-4 brutal-border brutal-shadow-hover transition-all font-display text-xl uppercase mx-auto flex items-center gap-4"
              >
                <Plus className="w-5 h-5" />
                Initiate Audit
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {error && (
        <div className="p-8 bg-rose-500 text-gallery-white brutal-border brutal-shadow flex items-center gap-6 text-lg font-display uppercase">
          <AlertCircle className="w-8 h-8" />
          {error}
        </div>
      )}
    </div>
  );
}
