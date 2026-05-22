import React from 'react';
import { motion } from 'motion/react';
import { Trash2, Edit2, Calendar } from 'lucide-react';
import { IncomeStream } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface IncomeStreamItemProps {
  stream: IncomeStream;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function IncomeStreamItem({ stream, onEdit, onDelete }: IncomeStreamItemProps) {
  const statusColor = {
    active: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-500 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    inactive: 'text-brand-primary/40 bg-brand-primary/5 border-brand-primary/10',
  };

  return (
    <motion.div 
      whileHover={{ y: -1 }}
      className="bg-brand-surface border border-brand-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-brand-primary/20 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:shadow-md"
    >
      <div className="flex flex-1 items-center gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-sans font-bold text-brand-primary uppercase tracking-tight">{stream.name}</h3>
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border leading-none scale-90",
              statusColor[stream.status as keyof typeof statusColor]
            )}>
              {stream.status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-brand-primary/40 font-medium">
            <Calendar className="w-3 h-3 flex-shrink-0 text-brand-primary/25" />
            <span>Credit Day: {stream.dayOfMonth}th of month</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-brand-border/40">
        <div className="text-left sm:text-right">
          <p className="text-xs font-mono font-bold text-brand-primary/30 uppercase tracking-widest pl-0.5">Baseline mandate</p>
          <p className="text-base font-mono font-bold text-brand-primary">{formatCurrency(stream.amount)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            className="p-2 text-brand-primary/30 hover:text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-all"
            title="Edit Stream"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-2 text-brand-primary/30 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
            title="Delete Stream"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
