import * as React from 'react';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, orderBy, limit, getDocFromServer, doc, updateDoc, increment, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db, signIn, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { Transaction, Goal, GoalType } from './types';
import { formatCurrency, cn } from './lib/utils';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Target, 
  PieChart as PieChartIcon, 
  LogOut, 
  LogIn,
  Sparkles,
  Home,
  ArrowRight,
  Compass,
  PiggyBank,
  Landmark,
  ShieldCheck,
  Calendar,
  Info,
  Trash2,
  List,
  Zap,
  ArrowDownRight,
  AlertCircle,
  AlertTriangle,
  Settings2,
  X
} from 'lucide-react';
import { 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { getFinancialAdvice } from './services/geminiService';
import { StrategyInsights } from './components/StrategyInsights';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brutal-black flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gallery-white p-12 brutal-border brutal-shadow space-y-10 text-center">
            <div className="w-20 h-20 bg-rose-500 text-gallery-white brutal-border flex items-center justify-center mx-auto brutal-shadow">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <div className="space-y-4">
              <h2 className="text-6xl font-display uppercase text-brutal-black leading-none">System Error</h2>
              <p className="text-xs font-mono font-bold text-stone-500 uppercase tracking-widest leading-relaxed">
                Critical failure in capital flow processing. Session terminated.
              </p>
            </div>
            <div className="bg-stone-100 p-8 brutal-border text-left overflow-auto max-h-40">
              <code className="text-[11px] font-mono text-brutal-black break-all">
                {this.state.error?.message || "Unknown Error"}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-brutal-black text-neon-green py-6 brutal-border brutal-shadow-hover transition-all font-display text-2xl uppercase"
            >
              Reboot Session
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'insights' | 'goals'>('home');
  const [showBudgetAlert, setShowBudgetAlert] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showMobileTip, setShowMobileTip] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(60000);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [tempBudget, setTempBudget] = useState(60000);
  const [filter, setFilter] = useState<'All' | 'Expenses' | 'Income'>('All');

  useEffect(() => {
    // Show mobile tip if on mobile and not standalone
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (isMobile && !isStandalone) {
      setShowMobileTip(true);
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const tQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(50)
    );

    const gQuery = query(
      collection(db, 'goals'),
      where('userId', '==', user.uid)
    );

    const unsubscribeT = onSnapshot(tQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const unsubscribeG = onSnapshot(gQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
      setGoals(data);
      
      // Initialize default goals if none exist
      if (snapshot.empty && user) {
        const defaultGoals: Omit<Goal, 'id'>[] = [
          { name: 'Emergency Fund', targetAmount: 300000, currentAmount: 0, type: 'savings', userId: user.uid },
          { name: 'Home Loan Repayment', targetAmount: 4500000, currentAmount: 0, type: 'debt', userId: user.uid },
          { name: 'Retirement Corpus', targetAmount: 10000000, currentAmount: 0, type: 'investment', userId: user.uid }
        ];
        defaultGoals.forEach(g => addDoc(collection(db, 'goals'), g));
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'goals'));

    return () => {
      unsubscribeT();
      unsubscribeG();
    };
  }, [user]);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalSavings = goals
    .filter(g => g.type === 'savings' || g.type === 'investment')
    .reduce((acc, g) => acc + g.currentAmount, 0);

  const balance = totalIncome - totalExpenses;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const spentToday = transactions
    .filter(t => t.type === 'expense' && new Date(t.date).getTime() >= today.getTime())
    .reduce((acc, t) => acc + t.amount, 0);

  const spentThisMonth = transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    })
    .reduce((acc, t) => acc + t.amount, 0);

  const leftToSpend = Math.max(0, monthlyBudget - spentThisMonth);
  const budgetPercentage = (spentThisMonth / monthlyBudget) * 100;
  const monthlySavingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;

  // CFO Calculations
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - today.getDate() + 1;
  const dailyBurnTarget = leftToSpend / remainingDays;
  
  const mandatoryExpenses = transactions
    .filter(t => t.type === 'expense' && t.isMandatory)
    .reduce((acc, t) => acc + t.amount, 0);
  
  const discretionaryExpenses = transactions
    .filter(t => t.type === 'expense' && !t.isMandatory)
    .reduce((acc, t) => acc + t.amount, 0);

  const todayTransactions = transactions
    .filter(t => new Date(t.date).getTime() >= today.getTime());

  const historySummary = transactions.reduce((acc, t) => {
    if (t.type === 'income') acc.earned += t.amount;
    else acc.spent += t.amount;
    acc.net = acc.earned - acc.spent;
    return acc;
  }, { spent: 0, earned: 0, net: 0 });

  const historyCategoryData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      const existing = acc.find(i => i.name === t.category);
      if (existing) {
        existing.value += t.amount;
      } else {
        acc.push({ name: t.category, value: t.amount });
      }
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value);

  const totalExpense = historyCategoryData.reduce((acc, i) => acc + i.value, 0);

  const groupedTransactions = transactions
    .filter(t => {
      if (filter === 'Expenses') return t.type === 'expense';
      if (filter === 'Income') return t.type === 'income';
      return true;
    })
    .reduce((acc: Record<string, Transaction[]>, t) => {
      const date = new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      if (!acc[date]) acc[date] = [];
      acc[date].push(t);
      return acc;
    }, {});

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Food & Dining': return <Zap className="w-5 h-5" />;
      case 'Shopping': return <TrendingUp className="w-5 h-5" />;
      case 'Transport': return <Compass className="w-5 h-5" />;
      case 'Bills & Utilities': return <ShieldCheck className="w-5 h-5" />;
      case 'Investment': return <Sparkles className="w-5 h-5" />;
      case 'Salary': return <TrendingUp className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const totalSavedTowardGoals = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalGoalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalGoalProgress = totalGoalTarget > 0 ? (totalSavedTowardGoals / totalGoalTarget) * 100 : 0;

  const categoryData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      let groupName = t.category;
      if (t.category.includes('Food') || t.category.includes('Quick Commerce')) groupName = 'Food & Groceries';
      if (t.category.includes('Shopping')) groupName = 'Shopping';
      if (t.category.includes('Transport')) groupName = 'Transport';
      if (t.category.includes('Utilities') || t.category.includes('Rent')) groupName = 'Bills & Rent';
      if (t.category.includes('Investment') || t.category.includes('Savings')) groupName = 'Savings & Investments';
      
      const existing = acc.find(i => i.name === groupName);
      if (existing) {
        existing.value += t.amount;
      } else {
        acc.push({ name: groupName, value: t.amount });
      }
      return acc;
    }, []);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Subtle background gradients */}
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-12 relative z-10"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-brand-primary flex items-center justify-center rounded-2xl shadow-2xl">
              <Compass className="w-10 h-10 text-brand-surface" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-serif italic text-brand-primary tracking-tight">FinTrack</h1>
            <p className="text-brand-primary/40 font-mono text-[10px] font-bold uppercase tracking-[0.4em]">Strategic Wealth Protocol</p>
          </div>
          <div className="space-y-6">
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-4 bg-brand-primary text-brand-surface py-5 px-8 rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all shadow-xl active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              Initialize Session
            </button>
            <p className="text-[10px] text-brand-primary/30 font-medium leading-relaxed px-8">
              Secure, data-driven capital management for the modern strategist.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-primary font-sans pb-32">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-brand-surface/80 backdrop-blur-md border-b border-brand-border px-6 py-5">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-primary flex items-center justify-center rounded-lg shadow-sm">
              <Compass className="w-6 h-6 text-brand-surface" />
            </div>
            <div>
              <span className="text-xl font-serif italic text-brand-primary tracking-tight">FinTrack</span>
              <p className="text-[8px] text-brand-accent font-bold uppercase tracking-widest leading-none mt-0.5">Strategic Audit Active</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wide">{user.displayName}</span>
              <span className="text-[9px] text-brand-primary/40 font-medium">{user.email}</span>
            </div>
            <button 
              onClick={logout}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-brand-border hover:bg-brand-bg transition-all text-brand-primary/40 hover:text-brand-primary"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 md:py-16 space-y-10 md:space-y-16">
        {activeTab === 'home' && (
          <div className="space-y-10 md:space-y-12">
            {/* Strategic Command Center */}
            <section className="bg-brand-primary text-brand-surface rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none overflow-hidden">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-accent rounded-full blur-[100px]" />
              </div>
              
              <div className="p-5 md:p-12 space-y-4 md:space-y-10 relative z-10">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-brand-surface/40 uppercase tracking-[0.3em] font-mono">Safe to Spend</p>
                  <h2 className="text-4xl sm:text-6xl md:text-8xl font-serif italic tracking-tight leading-none break-words">
                    {formatCurrency(leftToSpend)}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-y-5 md:gap-y-8 gap-x-8 pt-6 md:pt-8 border-t border-brand-surface/10">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-brand-surface/30 uppercase tracking-widest">Spent Today</p>
                    <p className="text-sm md:text-xl font-medium text-rose-400">{formatCurrency(spentToday)}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] font-bold text-brand-surface/30 uppercase tracking-widest">Spent This Month</p>
                    <p className="text-sm md:text-xl font-medium text-brand-surface/90">{formatCurrency(spentThisMonth)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-brand-surface/30 uppercase tracking-widest">Monthly Budget</p>
                    <p className="text-sm md:text-xl font-medium text-brand-surface/60">{formatCurrency(monthlyBudget)}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] font-bold text-brand-surface/30 uppercase tracking-widest">Days Remaining</p>
                    <p className="text-sm md:text-xl font-medium text-brand-accent">{remainingDays} Days Left</p>
                  </div>
                </div>

                <button 
                  onClick={() => { setTempBudget(monthlyBudget); setShowBudgetModal(true); }}
                  className="absolute top-4 right-4 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl bg-brand-surface/10 hover:bg-brand-surface/20 transition-all text-brand-surface z-20"
                >
                  <Settings2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
            </section>

            {/* Strategic Insights */}
            <div className="w-full">
              {/* CFO Insight Card */}
              <div className="bg-brand-accent/5 border border-brand-accent/10 rounded-2xl p-6 md:p-8 space-y-3 md:space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-brand-accent/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-brand-accent" />
                  </div>
                  <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-brand-accent">CFO Insight</p>
                </div>
                <p className="text-sm md:text-base text-brand-primary/80 leading-relaxed font-medium">
                  {budgetPercentage < 50 
                    ? "You're spending less than planned. Consider moving some surplus into your long-term goals."
                    : budgetPercentage > 90 
                    ? "Spending is high this month. Try to limit non-essential purchases for the next few days."
                    : "Your spending is perfectly on track. Keep this momentum to hit your monthly savings target."}
                </p>
              </div>
            </div>

            {/* Strategic Targets */}
            <section className="space-y-6 md:space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                  <h3 className="text-xl md:text-2xl font-serif italic text-brand-primary">Strategic Targets</h3>
                  <p className="text-[9px] md:text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.2em]">Long-term Capital Allocation</p>
                </div>
                
                <div className="flex items-center gap-8">
                  <div className="hidden sm:block text-right space-y-1">
                    <p className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-widest">Aggregate Progress</p>
                    <div className="flex items-center gap-3 justify-end">
                      <p className="text-lg font-serif italic text-brand-primary">{totalGoalProgress.toFixed(1)}%</p>
                      <div className="w-24 h-1 bg-brand-bg rounded-full overflow-hidden">
                        <div className="h-full bg-brand-accent" style={{ width: `${totalGoalProgress}%` }} />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setEditingGoal(null); setShowGoalModal(true); }}
                    className="px-4 md:px-5 py-2 md:py-2.5 bg-brand-primary text-brand-surface rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all flex items-center gap-2 shadow-xl"
                  >
                    <Plus className="w-3 md:w-3.5 h-3 md:h-3.5" />
                    Add Target
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {goals.map(goal => (
                  <GoalItem 
                    key={goal.id} 
                    goal={goal} 
                    transactions={transactions}
                    onEdit={() => { setEditingGoal(goal); setShowGoalModal(true); }} 
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-16">
            <div className="flex items-center justify-between">
              <h2 className="text-8xl font-display uppercase text-brutal-black tracking-tighter leading-none">History</h2>
              <div className="p-4 bg-neon-green brutal-border">
                <Compass className="w-8 h-8 text-brutal-black" />
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-sm overflow-hidden grid grid-cols-3 divide-x divide-brand-border">
              <div className="p-8 text-center space-y-1.5">
                <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Spent</p>
                <p className="text-2xl font-serif italic text-brand-primary tabular-nums">{formatCurrency(historySummary.spent)}</p>
              </div>
              <div className="p-8 text-center space-y-1.5">
                <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Earned</p>
                <p className="text-2xl font-serif italic text-brand-accent tabular-nums">{formatCurrency(historySummary.earned)}</p>
              </div>
              <div className="p-8 text-center space-y-1.5">
                <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Net Flow</p>
                <p className={cn(
                  "text-2xl font-serif italic tabular-nums",
                  historySummary.net >= 0 ? "text-brand-accent" : "text-rose-500"
                )}>
                  {historySummary.net >= 0 ? '+' : ''}{formatCurrency(historySummary.net)}
                </p>
              </div>
            </div>


            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-1">
                <h2 className="text-3xl font-serif italic text-brand-primary">Audit Log</h2>
                <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em]">Capital Flow History</p>
              </div>
              <div className="flex bg-brand-surface p-1 rounded-xl border border-brand-border shadow-sm">
                {['All', 'Expenses', 'Income'].map(f => (
                  <button 
                    key={f} 
                    onClick={() => setFilter(f as any)}
                    className={cn(
                      "px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      filter === f ? "bg-brand-primary text-brand-surface shadow-md" : "text-brand-primary/40 hover:bg-brand-bg"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction List */}
            <div className="space-y-10">
              {Object.entries(groupedTransactions).map(([date, items]) => (
                <div key={date} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h4 className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-[0.3em]">{date}</h4>
                    <div className="h-px flex-1 bg-brand-border" />
                  </div>
                  <div className="space-y-3">
                    {items.map(t => (
                      <div key={t.id} className="bg-brand-surface p-6 border border-brand-border rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-brand-bg rounded-xl flex items-center justify-center text-brand-primary/40 group-hover:bg-brand-primary group-hover:text-brand-surface transition-all">
                            {getCategoryIcon(t.category)}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-brand-primary uppercase tracking-wide">{t.description}</p>
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-widest">{t.category}</span>
                              {t.isMandatory && (
                                <span className="px-1.5 py-0.5 bg-brand-primary/5 text-brand-primary/40 text-[7px] font-bold uppercase tracking-widest rounded">Mandatory</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-xl font-serif italic tabular-nums",
                            t.type === 'income' ? "text-brand-accent" : "text-brand-primary"
                          )}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </p>
                          <p className="text-[9px] font-bold text-brand-primary/20 uppercase tracking-widest mt-0.5">
                            {new Date(t.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-10">
            <div className="space-y-1">
              <h2 className="text-3xl font-serif italic text-brand-primary">Strategic Audit</h2>
              <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em]">AI Capital Intelligence</p>
            </div>
            <StrategyInsights 
              transactions={transactions} 
              goals={goals} 
              balance={balance}
              totalIncome={totalIncome}
              totalSavings={totalSavings}
            />
          </div>
        )}
      </main>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <TransactionModal 
            onClose={() => setShowAddModal(false)} 
            userId={user.uid} 
            transactions={transactions}
          />
        )}
      </AnimatePresence>

      {/* Goal Modal */}
      <AnimatePresence>
        {showGoalModal && (
          <GoalModal 
            onClose={() => setShowGoalModal(false)} 
            userId={user.uid}
            goal={editingGoal}
          />
        )}
      </AnimatePresence>

      {/* Budget Modal */}
      <AnimatePresence>
        {showBudgetModal && (
          <div className="fixed inset-0 bg-brand-primary/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-brand-surface w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-8 border border-brand-border"
            >
              <div className="space-y-1">
                <h3 className="text-2xl font-serif italic text-brand-primary">Limit</h3>
                <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em]">Define Monthly Protocol</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Monthly Budget</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-primary/40 font-serif italic text-xl">₹</span>
                    <input 
                      type="number"
                      value={tempBudget}
                      onChange={(e) => setTempBudget(Number(e.target.value))}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl py-6 pl-12 pr-6 font-serif italic text-4xl focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none"
                      placeholder="60000"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={() => {
                    setMonthlyBudget(tempBudget);
                    setShowBudgetModal(false);
                  }}
                  className="w-full py-5 bg-brand-primary text-brand-surface rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all shadow-xl"
                >
                  Save Protocol
                </button>
                <button 
                  onClick={() => setShowBudgetModal(false)}
                  className="w-full py-3 text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest hover:text-brand-primary transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-brand-surface/90 backdrop-blur-md border-t border-brand-border pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-3 items-center py-4 px-6">
          <button
            onClick={() => setActiveTab('home')}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all",
              activeTab === 'home' ? "text-brand-primary" : "text-brand-primary/30"
            )}
          >
            <Compass className={cn("w-5 h-5", activeTab === 'home' && "fill-brand-primary/10")} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Strategy</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all",
              activeTab === 'history' ? "text-brand-primary" : "text-brand-primary/30"
            )}
          >
            <TrendingUp className={cn("w-5 h-5", activeTab === 'history' && "fill-brand-primary/10")} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('insights')}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all",
              activeTab === 'insights' ? "text-brand-primary" : "text-brand-primary/30"
            )}
          >
            <Sparkles className={cn("w-5 h-5", activeTab === 'insights' && "fill-brand-primary/10")} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Intelligence</span>
          </button>
        </div>
      </nav>

      {/* Sticky Action Button */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-6 w-12 h-12 bg-brand-primary text-brand-surface rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 border border-brand-surface/10"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Install Tip */}
      <AnimatePresence>
        {showMobileTip && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-20 left-4 right-4 bg-brand-primary text-brand-surface p-4 rounded-2xl z-50 shadow-2xl flex items-center justify-between sm:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-surface/10 rounded-xl">
                <Sparkles className="w-5 h-5 text-brand-accent" />
              </div>
              <div>
                <p className="text-xs font-bold">Add to Home Screen</p>
                <p className="text-[10px] text-brand-surface/60">Use FinTrack like a real app!</p>
              </div>
            </div>
            <button 
              onClick={() => setShowMobileTip(false)}
              className="text-[10px] font-bold bg-brand-surface/10 px-3 py-1.5 rounded-lg uppercase tracking-widest"
            >
              Got it
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GoalItem({ goal, transactions, isDemo, onEdit }: { goal: Goal, transactions: Transaction[], isDemo?: boolean, onEdit?: () => void }) {
  const [simulationValue, setSimulationValue] = useState(goal.monthlyContribution || 0);
  const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  
  // Calculate this month's contribution velocity
  const now = new Date();
  const thisMonthContribution = transactions
    .filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === now.getMonth() && 
             tDate.getFullYear() === now.getFullYear() &&
             t.type === 'expense' &&
             t.description.toLowerCase().includes(goal.name.toLowerCase());
    })
    .reduce((acc, t) => acc + t.amount, 0);

  const monthsToGoal = simulationValue > 0 ? remaining / simulationValue : Infinity;
  const freedomDate = monthsToGoal !== Infinity 
    ? new Date(new Date().setMonth(new Date().getMonth() + Math.ceil(monthsToGoal)))
    : null;

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={cn(
        "flex flex-col p-6 md:p-8 bg-brand-surface border border-brand-border rounded-3xl shadow-sm hover:shadow-xl transition-all group relative overflow-hidden",
        isDemo && "opacity-50 grayscale"
      )}
    >
      <div className="flex justify-between items-start mb-8" onClick={onEdit}>
        <div className="space-y-3 cursor-pointer">
          <div className="flex items-center gap-3">
            <h4 className="text-xl md:text-2xl font-serif italic text-brand-primary leading-none">{goal.name}</h4>
            <div className="px-2 py-0.5 bg-brand-primary/5 text-brand-primary/40 rounded-md border border-brand-primary/10">
              <p className="text-[8px] font-bold uppercase tracking-widest">{goal.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">
              {formatCurrency(remaining)} TO GO
            </p>
            {thisMonthContribution > 0 && (
              <div className="flex items-center gap-1 text-brand-accent">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase tracking-wider">+{formatCurrency(thisMonthContribution)} MTD</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right space-y-2">
          <p className="text-2xl md:text-3xl font-serif italic text-brand-primary leading-none">{progress.toFixed(0)}%</p>
          <div className="h-1.5 w-24 md:w-32 bg-brand-bg rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-brand-accent shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            />
          </div>
        </div>
      </div>

      {/* Strategic Simulation Lever */}
      <div className="mt-auto pt-6 border-t border-brand-border space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-widest">Monthly Allocation</p>
            <p className="text-xl md:text-2xl font-serif italic text-brand-primary leading-none tabular-nums">{formatCurrency(simulationValue)}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-widest">Projected Maturity</p>
            <p className="text-lg md:text-xl font-serif italic text-brand-accent leading-none">
              {freedomDate ? freedomDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}
            </p>
          </div>
        </div>
        
        <div className="relative group/slider">
          <input 
            type="range"
            min="0"
            max={Math.max(100000, simulationValue * 2)}
            step="1000"
            value={simulationValue}
            onChange={(e) => setSimulationValue(parseInt(e.target.value))}
            className="w-full h-1 bg-brand-bg rounded-full appearance-none cursor-pointer accent-brand-primary"
          />
          <div className="flex justify-between mt-3 text-[8px] font-bold text-brand-primary/20 uppercase tracking-[0.2em]">
            <span>Conservative</span>
            <span>Aggressive</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GoalModal({ onClose, userId, goal }: { onClose: () => void, userId: string, goal: Goal | null }) {
  const [name, setName] = useState(goal?.name || '');
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount.toString() || '');
  const [currentAmount, setCurrentAmount] = useState(goal?.currentAmount.toString() || '');
  const [monthlyContribution, setMonthlyContribution] = useState(goal?.monthlyContribution?.toString() || '');
  const [type, setType] = useState<GoalType>((goal?.type as any) === 'sip' ? 'investment' : (goal?.type as any) === 'loan' ? 'debt' : goal?.type || 'savings');
  const [deadline, setDeadline] = useState(goal?.deadline || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = {
        name,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount || '0'),
        monthlyContribution: monthlyContribution ? parseFloat(monthlyContribution) : null,
        type,
        userId,
        deadline: deadline || null,
      };

      if (goal?.id) {
        await updateDoc(doc(db, 'goals', goal.id), data);
      } else {
        await addDoc(collection(db, 'goals'), data);
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'goals');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!goal?.id) return;
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'goals', goal.id));
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'goals');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-primary/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-brand-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-brand-border"
      >
        <div className="p-8 border-b border-brand-border flex justify-between items-center bg-brand-bg">
          <div className="space-y-1">
            <h3 className="text-2xl font-serif italic text-brand-primary">{goal ? 'Modify' : 'Initialize'}</h3>
            <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em]">Capital Allocation Protocol</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-brand-primary/5 transition-all text-brand-primary/40">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 relative z-10">
          {!showConfirmDelete ? (
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Goal Designation</label>
                  <input 
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl py-4 px-5 text-sm font-bold uppercase focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none"
                    placeholder="e.g. RETIREMENT"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Target Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary/40 font-serif italic">₹</span>
                      <input 
                        required
                        type="number"
                        value={targetAmount}
                        onChange={(e) => setTargetAmount(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border rounded-xl py-4 pl-8 pr-5 text-sm font-mono focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none"
                        placeholder="500000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Monthly Contribution</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary/40 font-serif italic">₹</span>
                      <input 
                        required
                        type="number"
                        value={monthlyContribution}
                        onChange={(e) => setMonthlyContribution(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border rounded-xl py-4 pl-8 pr-5 text-sm font-mono focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none"
                        placeholder="10000"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Classification</label>
                  <div className="flex bg-brand-bg p-1 rounded-xl border border-brand-border">
                    {(['savings', 'debt', 'investment'] as GoalType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={cn(
                          "flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                          type === t 
                            ? "bg-brand-primary text-brand-surface shadow-md" 
                            : "text-brand-primary/40 hover:bg-brand-primary/5"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-brand-primary text-brand-surface py-5 rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all shadow-xl disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSubmitting ? 'Processing' : goal ? 'Commit Changes' : 'Initialize Target'}
                </button>
                {goal && (
                  <button 
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    disabled={isSubmitting}
                    className="w-full text-rose-500 py-2 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-rose-600 transition-all disabled:opacity-50"
                  >
                    Terminate Goal
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-rose-500/5 p-8 rounded-2xl border border-rose-500/20 space-y-8">
              <p className="text-sm text-rose-600 font-bold uppercase tracking-wide text-center leading-relaxed">Confirm Goal Termination? This action will purge all associated target data.</p>
              <div className="flex flex-col gap-3">
                <button 
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="w-full bg-rose-500 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-rose-600 transition-all shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? '...' : 'Confirm Purge'}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="w-full py-3 text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest hover:text-brand-primary transition-all"
                >
                  Abort
                </button>
              </div>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}

function TransactionModal({ onClose, userId, transactions }: { onClose: () => void, userId: string, transactions: Transaction[] }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Extract smart templates from history
  const smartTemplates = React.useMemo(() => {
    const counts: Record<string, { count: number, category: string, lastAmount: number }> = {};
    transactions.forEach(t => {
      if (!counts[t.description]) {
        counts[t.description] = { count: 0, category: t.category, lastAmount: t.amount };
      }
      counts[t.description].count++;
      counts[t.description].lastAmount = t.amount; // Keep most recent
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));
  }, [transactions]);

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    if (val.length > 1) {
      const filtered = smartTemplates
        .filter(t => t.name.toLowerCase().includes(val.toLowerCase()))
        .map(t => t.name);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const applyTemplate = (template: { name: string, category: string, lastAmount: number }) => {
    setDescription(template.name);
    setCategory(template.category);
    setAmount(template.lastAmount.toString());
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const amountNum = parseFloat(amount);
      
      await addDoc(collection(db, 'transactions'), {
        amount: amountNum,
        category,
        description,
        type,
        date: new Date().toISOString(),
        userId,
        isMandatory: type === 'expense' ? isMandatory : false,
      });

      // Update goals if category matches
      if (type === 'expense') {
        const goalTypeMap: Record<string, string> = {
          'Investment': 'investment',
          'Debt Repayment': 'debt',
          'Savings': 'savings'
        };

        const goalType = goalTypeMap[category];
        if (goalType) {
          const gQuery = query(
            collection(db, 'goals'),
            where('userId', '==', userId),
            where('type', '==', goalType)
          );
          const gSnapshot = await getDocs(gQuery);
          if (!gSnapshot.empty) {
            const goalDoc = gSnapshot.docs.find(d => description.toLowerCase().includes(d.data().name.toLowerCase())) || gSnapshot.docs[0];
            await updateDoc(doc(db, 'goals', goalDoc.id), {
              currentAmount: increment(amountNum)
            });
          }
        }
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-primary/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-brand-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-brand-border"
      >
        <div className="p-8 border-b border-brand-border flex justify-between items-center bg-brand-bg">
          <div className="space-y-1">
            <h3 className="text-2xl font-serif italic text-brand-primary">Quick Log</h3>
            <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em]">Capital Flow Entry</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-brand-primary/5 transition-all text-brand-primary/40">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-8 relative z-10">
          {/* Smart Templates Row */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Frequent Merchants</label>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {smartTemplates.slice(0, 5).map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="flex-shrink-0 px-4 py-2 bg-brand-bg border border-brand-border rounded-lg text-[9px] font-bold text-brand-primary/60 hover:bg-brand-primary hover:text-brand-surface transition-all active:scale-95 uppercase tracking-wider"
                >
                  {t.name}
                </button>
              ))}
              {smartTemplates.length === 0 && <span className="text-[10px] text-brand-primary/20 italic">Awaiting history...</span>}
            </div>
          </div>

          <div className="flex bg-brand-bg p-1 rounded-xl border border-brand-border">
            <button 
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                type === 'expense' ? "bg-brand-primary text-brand-surface shadow-md" : "text-brand-primary/40"
              )}
            >
              Expense
            </button>
            <button 
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                type === 'income' ? "bg-brand-primary text-brand-surface shadow-md" : "text-brand-primary/40"
              )}
            >
              Income
            </button>
          </div>

          {type === 'expense' && (
            <div className="flex items-center justify-between bg-brand-bg p-5 rounded-2xl border border-brand-border">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">Mandatory Expense</p>
                <p className="text-[9px] text-brand-primary/40 font-medium uppercase">Fixed costs / Essentials</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMandatory(!isMandatory)}
                className={cn(
                  "w-10 h-10 rounded-xl transition-all flex items-center justify-center border",
                  isMandatory ? "bg-brand-primary text-brand-surface border-brand-primary" : "bg-brand-surface border-brand-border"
                )}
              >
                {isMandatory && <ShieldCheck className="w-5 h-5" />}
              </button>
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2 relative">
              <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Merchant / Description</label>
              <input 
                autoFocus
                type="text" 
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="WHERE DID YOU SPEND?"
                className="w-full bg-brand-bg border border-brand-border rounded-xl py-4 px-5 text-sm font-bold uppercase focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none"
                required
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-brand-surface border border-brand-border rounded-xl shadow-xl z-20 overflow-hidden">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const t = smartTemplates.find(x => x.name === s);
                        if (t) applyTemplate(t);
                      }}
                      className="w-full text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide hover:bg-brand-bg transition-colors border-b border-brand-border last:border-none"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary/40 font-serif italic">₹</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-brand-bg border border-brand-border rounded-xl py-4 pl-8 pr-5 text-sm font-mono focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-brand-bg border border-brand-border rounded-xl py-4 px-5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none appearance-none"
                >
                  <option>Food & Dining</option>
                  <option>Shopping</option>
                  <option>Transport</option>
                  <option>Bills & Utilities</option>
                  <option>Entertainment</option>
                  <option>Health</option>
                  <option>Rent & Maintenance</option>
                  <option>Investment</option>
                  <option>Debt Repayment</option>
                  <option>Savings</option>
                  <option>Other</option>
                  {type === 'income' && <option>Salary</option>}
                  {type === 'income' && <option>Other Income</option>}
                </select>
              </div>
            </div>
          </div>

          <button 
            disabled={isSubmitting}
            className="w-full bg-brand-primary text-brand-surface py-5 rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all shadow-xl disabled:opacity-50 active:scale-[0.98]"
          >
            {isSubmitting ? 'Processing' : 'Commit Transaction'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
