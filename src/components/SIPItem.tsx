import React from 'react';
import { motion } from 'motion/react';
import { Trash2, Edit2, CheckCircle2, Plus, Calendar, AlertCircle } from 'lucide-react';
import { SIP, Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface SIPItemProps {
  sip: SIP;
  onEdit?: () => void;
  onDelete?: () => void;
  transactions: Transaction[];
  onLogPayment?: (sip: SIP) => void;
}

// Visual category-based stylized vector arts matching the user's uploaded screenshots
function getFundArtwork(name: string, category: string) {
  const lowercaseName = name.toLowerCase();
  let gradientClasses = "from-amber-400 to-orange-500 text-amber-1200"; // Default debt/liquid
  
  if (lowercaseName.includes('small cap') || lowercaseName.includes('flexi cap')) {
    gradientClasses = "from-rose-500 to-red-600";
  } else if (lowercaseName.includes('elss') || lowercaseName.includes('tax saver')) {
    gradientClasses = "from-emerald-400 to-teal-600";
  } else if (lowercaseName.includes('index') || lowercaseName.includes('nifty') || lowercaseName.includes('large cap')) {
    gradientClasses = "from-blue-500 to-sky-600";
  } else if (lowercaseName.includes('mid cap') || lowercaseName.includes('contra') || lowercaseName.includes('multicap') || lowercaseName.includes('focused')) {
    gradientClasses = "from-indigo-500 to-violet-600";
  } else if (lowercaseName.includes('liquid') || category.toLowerCase().includes('debt')) {
    gradientClasses = "from-amber-400 to-orange-500";
  } else if (lowercaseName.includes('gold') || category.toLowerCase().includes('gold') || lowercaseName.includes('bees')) {
    gradientClasses = "from-yellow-400 to-amber-500";
  }
  
  return (
    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradientClasses} relative overflow-hidden flex items-end shrink-0 shadow-sm border border-black/5`}>
      {/* Abstract celestial backdrop */}
      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/20 backdrop-blur-[1px]" />
      {/* Mountain outline shapes representing steady compounding rise */}
      <svg viewBox="0 0 100 100" className="w-full h-8 text-white/15 absolute bottom-0 left-0 leading-none">
        <path d="M0 100 L30 40 L65 100 Z" fill="currentColor" />
        <path d="M35 100 L70 30 L100 100 Z" fill="currentColor" className="opacity-60" />
      </svg>
    </div>
  );
}

// Format amount to beautiful compact style visible on screenshots (e.g. ₹500, ₹1k, ₹1.5k, ₹1.25k)
export const formatSipAmountCompact = (val: number) => {
  if (val >= 1000) {
    const kValue = val / 1000;
    return `₹${kValue.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}k`;
  }
  return `₹${val}`;
};

// Calculate next installment cycle cleanly conforming to screenshot values ("In a week", "Today", "9th Jun 2026", "NA")
export function getNextInstallmentDate(dayOfMonth: number, frequency: string, status: string): string {
  if (status !== 'active') return 'NA';
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed
  const currentDate = today.getDate();
  
  if (frequency === 'daily') {
    return 'Today';
  } else if (frequency === 'weekly') {
    return 'In a week';
  } else if (frequency === 'fortnightly' || frequency === '15-days') {
    return 'In a week'; // Or "In a week" as showcased in standard 15-day schedules or explicit dates
  } else if (frequency === 'quarterly') {
    return 'NA'; // If quarterly has no explicit run or is waiting
  }
  
  // Standard monthly cycle day computation
  let targetMonth = currentMonth;
  let targetYear = currentYear;
  
  if (currentDate > dayOfMonth) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }
  
  const targetDateObj = new Date(targetYear, targetMonth, dayOfMonth);
  const monthName = targetDateObj.toLocaleDateString('en-US', { month: 'short' });
  
  // Ordinal calculation
  const getOrdinal = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1:  return "st";
      case 2:  return "nd";
      case 3:  return "rd";
      default: return "th";
    }
  };
  
  return `${dayOfMonth}${getOrdinal(dayOfMonth)} ${monthName} ${targetYear}`;
}

export function SIPItem({ sip, onEdit, onDelete, transactions, onLogPayment }: SIPItemProps) {
  const statusColor = {
    active: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20',
    paused: 'text-zinc-600 bg-zinc-500/10 border-zinc-500/10',
    stopped: 'text-rose-600 bg-rose-500/10 border-rose-500/15'
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isFulfilled = transactions.some(t => 
    t.sipId === sip.id && 
    new Date(t.date).getMonth() === currentMonth &&
    new Date(t.date).getFullYear() === currentYear
  );

  // Fallback defaults for historical items
  const sipFreq = sip.frequency || 'monthly';
  const displayFreq = sipFreq === 'fortnightly' ? '15-days' : sipFreq.charAt(0).toUpperCase() + sipFreq.slice(1);
  const subcategory = sip.schemeSubcategory || 'Equity - Mutual Fund';
  const mandateType = sip.mandateType || 'standard';

  const nextInstallmentStr = getNextInstallmentDate(sip.dayOfMonth, sipFreq, sip.status);

  return (
    <motion.div 
      whileHover={{ y: -1 }}
      className="bg-brand-surface border border-brand-border/60 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:shadow-md hover:border-brand-primary/10 p-5 transition-all flex flex-col justify-between"
    >
      <div className="space-y-4">
        {/* Dynamic Header Section matching screen exactly */}
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1.5 flex-1 select-none">
            {/* Top Tag Badges Line */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {mandateType === 'step-up' && (
                <span className="px-2 py-0.5 rounded-full text-[8px] font-mono font-black uppercase text-white bg-zinc-950 leading-none tracking-wider scale-95 origin-left">
                  Step-up
                </span>
              )}
              {mandateType === 'amc-sip' && (
                <span className="px-2 py-0.5 rounded-full text-[8px] font-mono font-black uppercase text-white bg-zinc-950 leading-none tracking-wider scale-95 origin-left">
                  AMC SIP
                </span>
              )}
              
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-widest border leading-none",
                statusColor[sip.status]
              )}>
                {sip.status}
              </span>
            </div>
            
            {/* Fund Name */}
            <h4 className="text-sm font-sans font-extrabold text-brand-primary uppercase tracking-tight leading-tight mt-1 select-text">
              {sip.name}
            </h4>
            
            {/* Asset Classification Details styled identically to screen */}
            <p className="text-[10px] font-sans font-semibold text-brand-primary/40 uppercase tracking-tight leading-none">
              Growth <span className="text-brand-primary/20 mx-1">|</span> {sip.category} - {subcategory}
            </p>
          </div>
          
          {/* SVG Vector Landscape Art corresponding to fund features */}
          {getFundArtwork(sip.name, sip.category)}
        </div>

        {/* 3-Column Value Grid styled with absolute precision */}
        <div className="grid grid-cols-3 gap-1 bg-brand-bg/40 p-3 rounded-xl border border-brand-border/45 select-none text-center">
          <div className="space-y-1">
            <span className="block text-[8px] font-mono font-semibold text-brand-primary/30 uppercase tracking-widest leading-none">Amount</span>
            <span className="block font-sans font-black text-xs text-brand-primary leading-tight">
              {formatSipAmountCompact(sip.amount)}
            </span>
          </div>
          
          <div className="space-y-1 border-x border-brand-border/50">
            <span className="block text-[8px] font-mono font-semibold text-brand-primary/30 uppercase tracking-widest leading-none">Next instalment</span>
            <span className="block font-sans font-extrabold text-xs text-brand-primary/95 leading-tight truncate px-1">
              {nextInstallmentStr}
            </span>
          </div>
          
          <div className="space-y-1">
            <span className="block text-[8px] font-mono font-semibold text-brand-primary/30 uppercase tracking-widest leading-none">Frequency</span>
            <span className="block font-sans font-bold text-xs text-brand-primary/80 leading-tight">
              {displayFreq}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Bottom Panel */}
      <div className="pt-4 mt-4 border-t border-brand-border/40 flex justify-between items-center text-xs">
        <div>
          {!isFulfilled && sip.status === 'active' ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onLogPayment?.(sip); }}
              className="px-3 py-1.5 bg-brand-primary text-brand-surface rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Log Installment</span>
            </button>
          ) : isFulfilled ? (
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase tracking-widest leading-none">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Fulfilled This Month</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[9px] font-bold text-brand-primary/30 uppercase tracking-widest leading-none">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>SIP Paused</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 select-none">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            className="p-1.5 text-brand-primary/30 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors border border-transparent hover:border-brand-border/40"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-1.5 text-brand-primary/25 hover:text-rose-500 hover:bg-rose-50/50 rounded-lg transition-colors border border-transparent hover:border-rose-500/10"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
