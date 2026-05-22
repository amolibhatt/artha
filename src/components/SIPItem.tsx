import React from 'react';
import { motion } from 'motion/react';
import { Trash2, Edit2, Calendar, CheckCircle2, Plus } from 'lucide-react';
import { SIP, Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface SIPItemProps {
  sip: SIP;
  onEdit?: () => void;
  onDelete?: () => void;
  transactions: Transaction[];
  onLogPayment?: (sip: SIP) => void;
}

export function SIPItem({ sip, onEdit, onDelete, transactions, onLogPayment }: SIPItemProps) {
  const statusColor = {
    active: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-500 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    paused: 'text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-500 dark:bg-amber-500/10 dark:border-emerald-500/20',
    stopped: 'text-rose-600 bg-rose-50 border-rose-100 dark:text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/20'
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const isFulfilled = transactions.some(t => 
    t.sipId === sip.id && 
    new Date(t.date).getMonth() === currentMonth &&
    new Date(t.date).getFullYear() === currentYear
  );

  return (
    <motion.div 
      whileHover={{ y: -1 }}
      className="bg-brand-surface p-4 border border-brand-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:shadow-md transition-all group flex flex-col justify-between"
    >
      <div className="space-y-3">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-sans font-bold text-brand-primary uppercase tracking-tight leading-none pt-0.5">{sip.name}</h4>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border leading-none scale-90",
                statusColor[sip.status]
              )}>
                {sip.status}
              </span>
            </div>
            {isFulfilled ? (
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-widest leading-none">
                <CheckCircle2 className="w-3 h-3" />
                <span>Fulfilled</span>
              </div>
            ) : (
              <p className="text-[9px] font-mono text-brand-primary/40 uppercase">Awaiting current installment</p>
            )}
          </div>
          <span className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-widest bg-brand-bg px-2 py-0.5 rounded border border-brand-border">{sip.category}</span>
        </div>

        <div className="flex gap-2 text-xs">
          <div className="flex-1 flex items-baseline justify-between bg-brand-bg/50 px-2 py-1.5 rounded-lg border border-brand-border">
            <span className="text-[8px] font-bold text-brand-primary/30 uppercase tracking-widest">Monthly</span>
            <span className="font-mono font-bold text-brand-primary">{formatCurrency(sip.amount)}</span>
          </div>
          <div className="flex-1 flex items-baseline justify-between bg-brand-bg/50 px-2 py-1.5 rounded-lg border border-brand-border">
            <span className="text-[8px] font-bold text-brand-primary/30 uppercase tracking-widest">Day</span>
            <span className="font-mono font-bold text-brand-primary">{sip.dayOfMonth}th</span>
          </div>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-brand-border/50 flex justify-between items-center text-xs">
        <div>
          {!isFulfilled && sip.status === 'active' ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onLogPayment?.(sip); }}
              className="px-2.5 py-1 bg-brand-primary text-brand-surface rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Log Installment</span>
            </button>
          ) : isFulfilled ? (
            <span className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Next Run: {sip.dayOfMonth}/{new Date().getMonth() + 2}</span>
          ) : (
            <span className="text-[8px] font-bold text-brand-primary/35 uppercase tracking-widest">Auto-save inactive</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            className="p-1.5 text-brand-primary/30 hover:text-brand-primary rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-1.5 text-brand-primary/20 hover:text-rose-500 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
