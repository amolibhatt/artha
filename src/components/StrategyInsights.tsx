import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Sparkles, TrendingUp, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
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
    <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-900">AI Financial Strategy</h3>
            <p className="text-sm text-stone-500">Personalized insights to optimize your capital</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 shadow-md flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          {isLoading ? 'Analyzing...' : 'Refresh Strategy'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isLoading && !strategy ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm text-stone-400 font-medium">Analyzing your financial flow...</p>
          </div>
        ) : strategy ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-stone prose-sm max-w-none bg-stone-50 p-8 rounded-2xl border border-stone-100"
          >
            <div className="markdown-body">
              <Markdown>{strategy}</Markdown>
            </div>
          </motion.div>
        ) : (
          <div className="border-2 border-dashed border-stone-100 rounded-3xl p-12 text-center">
            <button
              onClick={handleGenerate}
              className="text-indigo-600 font-bold text-sm hover:underline"
            >
              Generate your first strategy report
            </button>
          </div>
        )}
      </AnimatePresence>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-xs font-bold">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
