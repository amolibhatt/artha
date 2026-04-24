import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, orderBy, limit, getDocFromServer, doc, updateDoc, increment, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db, signIn, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { Transaction, Goal, GoalType, StressTestState } from './types';
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
  Terminal,
  Activity,
  AlertTriangle,
  Settings2,
  X
} from 'lucide-react';
import { 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  YAxis,
  XAxis
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { getFinancialAdvice } from './services/geminiService';
import { StrategyInsights } from './components/StrategyInsights';
import { DebtOptimization } from './components/DebtOptimization';

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
        <div className="min-h-screen bg-brand-primary flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-brand-surface p-12 rounded-[2rem] border border-brand-border space-y-10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10 text-rose-500" />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1">System Alert</h2>
              <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em] leading-relaxed">
                A critical runtime exception occurred. The audit trail has been preserved for diagnosis.
              </p>
            </div>
            <div className="bg-brand-bg p-6 rounded-2xl border border-brand-border text-left overflow-auto max-h-40">
              <code className="text-[10px] font-mono text-brand-primary/60 break-all">
                {this.state.error?.message || "Unknown Error"}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-5 bg-brand-primary text-brand-surface rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all shadow-xl"
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
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [commandTab, setCommandTab] = useState<'terminal' | 'transaction' | 'budget' | 'goal'>('terminal');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showMobileTip, setShowMobileTip] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(() => Number(localStorage.getItem('monthlyBudget')) || 0);
  const [filter, setFilter] = useState<'All' | 'Expenses' | 'Income'>('All');
  const [stressTest, setStressTest] = useState<StressTestState>(() => {
    const saved = localStorage.getItem('stressTest');
    return saved ? JSON.parse(saved) : { incomeShock: 1, expenseShock: 1 };
  });

  useEffect(() => {
    localStorage.setItem('monthlyBudget', monthlyBudget.toString());
  }, [monthlyBudget]);

  useEffect(() => {
    localStorage.setItem('stressTest', JSON.stringify(stressTest));
  }, [stressTest]);
  const [showStressTest, setShowStressTest] = useState(false);

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
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'goals'));

    return () => {
      unsubscribeT();
      unsubscribeG();
    };
  }, [user]);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const adjustedIncome = totalIncome * stressTest.incomeShock;

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const adjustedExpenses = totalExpenses * stressTest.expenseShock;

  const totalSavings = goals
    .filter(g => g.type === 'savings' || g.type === 'investment')
    .reduce((acc, g) => acc + g.currentAmount, 0);

  const balance = adjustedIncome - adjustedExpenses;

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
  const adjustedLeftToSpend = Math.max(0, monthlyBudget * stressTest.incomeShock - spentThisMonth * stressTest.expenseShock);
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

  // Runway Calculation
  const liquidAssets = goals
    .filter(g => g.type === 'savings' || g.type === 'investment')
    .reduce((acc, g) => acc + g.currentAmount, 0);
  
  // Estimate monthly burn (Normalize to 30-day projection to avoid intra-month volatility)
  const activeDailyPace = spentThisMonth / Math.max(1, today.getDate());
  const projectedMonthlyBurn = activeDailyPace * 30;
  const monthlyBurn = projectedMonthlyBurn > 0 ? projectedMonthlyBurn : (totalExpenses / Math.max(1, transactions.length / 30));
  const runwayMonths = monthlyBurn > 0 ? (liquidAssets / (monthlyBurn * stressTest.expenseShock)) : 0;
  
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysUntilReset = lastDayOfMonth.getDate() - now.getDate();
  const fixedRatio = totalExpenses > 0 ? (mandatoryExpenses / totalExpenses) * 100 : 0;

  // 7-Day Sparkline Data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const amount = transactions
      .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === d.toDateString())
      .reduce((acc, t) => acc + t.amount, 0);
    return { day: d.toLocaleDateString('en-GB', { weekday: 'short' }), amount };
  });

  const avgDailySpend = last7Days.reduce((acc, d) => acc + d.amount, 0) / 7;
  const recentTrend = last7Days[6].amount > avgDailySpend ? 'Increasing' : 'Stable';

  // Predictive Analytics - Stress Test Synchronized
  const projectedMonthlySpend = (spentThisMonth + (avgDailySpend * remainingDays)) * stressTest.expenseShock;
  const projectedSavings = Math.max(0, (totalIncome * stressTest.incomeShock) - projectedMonthlySpend);
  const savingsEfficiency = (totalIncome * stressTest.incomeShock) > 0 ? (projectedSavings / (totalIncome * stressTest.incomeShock)) * 100 : 0;

  // Global Command Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c' && !showCommandCenter && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        setShowCommandCenter(true);
      }
      if (e.key === 'Escape' && showCommandCenter) {
        setShowCommandCenter(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandCenter]);

  const budgetDailyLimit = monthlyBudget / daysInMonth;
  const isAheadOfBudget = activeDailyPace < budgetDailyLimit;
  const budgetVariance = (budgetDailyLimit * today.getDate()) - spentThisMonth;

  const listContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const listItem = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

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
    const cat = category.toLowerCase();
    if (cat.includes('food') || cat.includes('dining') || cat.includes('restaurant')) return <Zap className="w-5 h-5" />;
    if (cat.includes('shopping') || cat.includes('amazon') || cat.includes('lifestyle')) return <Plus className="w-5 h-5 rotate-45" />;
    if (cat.includes('transport') || cat.includes('travel') || cat.includes('uber')) return <Compass className="w-5 h-5" />;
    if (cat.includes('bill') || cat.includes('rent') || cat.includes('utility')) return <Landmark className="w-5 h-5" />;
    if (cat.includes('invest') || cat.includes('stock') || cat.includes('crypto')) return <Sparkles className="w-5 h-5" />;
    if (cat.includes('salary') || cat.includes('income')) return <TrendingUp className="w-5 h-5" />;
    if (cat.includes('health') || cat.includes('medical')) return <ShieldCheck className="w-5 h-5" />;
    if (cat.includes('entertainment') || cat.includes('netflix')) return <Zap className="w-5 h-5 text-amber-400" />;
    return <List className="w-5 h-5" />;
  };

  const totalSavedTowardGoals = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalGoalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalGoalCurrent = totalSavedTowardGoals;
  const totalGoalProgress = totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0;

  const categoryData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      let groupName = t.category;
      const lowerCat = t.category.toLowerCase();
      
      if (lowerCat.includes('food') || lowerCat.includes('dining') || lowerCat.includes('quick commerce') || lowerCat.includes('grocery')) {
        groupName = 'Food & Groceries';
      } else if (lowerCat.includes('shopping') || lowerCat.includes('ecommerce') || lowerCat.includes('clothing')) {
        groupName = 'Shopping';
      } else if (lowerCat.includes('transport') || lowerCat.includes('fuel') || lowerCat.includes('travel') || lowerCat.includes('cab')) {
        groupName = 'Transport';
      } else if (lowerCat.includes('utilities') || lowerCat.includes('rent') || lowerCat.includes('bills') || lowerCat.includes('recharge')) {
        groupName = 'Bills & Rent';
      } else if (lowerCat.includes('investment') || lowerCat.includes('savings') || lowerCat.includes('sip') || lowerCat.includes('stock')) {
        groupName = 'Savings & Investments';
      }
      
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
    const handleSignIn = async () => {
      setIsSigningIn(true);
      setAuthError(null);
      try {
        await signIn();
      } catch (error: any) {
        if (error.code === 'auth/unauthorized-domain') {
          setAuthError('Error: This domain is not authorized in Firebase. Check console for instructions.');
        } else if (error.code === 'auth/popup-blocked') {
          setAuthError('Error: Sign-in popup blocked. Please allow popups.');
        } else {
          setAuthError(`Sign-in failed: ${error.message}`);
        }
      } finally {
        setIsSigningIn(false);
      }
    };

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
            <h1 className="text-5xl font-sans font-bold uppercase tracking-tight text-brand-primary">Artha AI</h1>
            <p className="text-brand-primary/40 font-mono text-[10px] font-bold uppercase tracking-[0.4em]">Capital Wealth Protocol</p>
          </div>
          <div className="space-y-6">
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className={cn(
                "w-full flex items-center justify-center gap-4 bg-brand-primary text-brand-surface py-5 px-8 rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all shadow-xl active:scale-[0.98]",
                isSigningIn && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSigningIn ? (
                <div className="w-4 h-4 border-2 border-brand-surface/30 border-t-brand-surface rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isSigningIn ? 'Processing...' : 'Initialize Session'}
            </button>
            
            {authError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg"
              >
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest leading-relaxed">
                  {authError}
                </p>
              </motion.div>
            )}

            <p className="text-[10px] text-brand-primary/30 font-medium leading-relaxed px-8">
              Secure, data-driven capital management for the modern strategist.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-primary font-sans pb-24 md:pb-32">
      {/* Top Header - Compact for Mobile */}
      <header className="sticky top-0 z-40 bg-brand-surface/80 backdrop-blur-md border-b border-brand-border px-4 py-3 md:px-6 md:py-5">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-brand-primary flex items-center justify-center rounded-lg shadow-sm">
              <Compass className="w-5 h-5 md:w-6 md:h-6 text-brand-surface" />
            </div>
            <div>
              <span className="text-lg md:text-xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight">Artha AI</span>
              <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-widest leading-tight mt-1">
                {monthlyBudget === 0 ? 'Protocol Inactive' : 'Capital Audit Active'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <button 
              type="button"
              onClick={async () => {
                if (window.confirm('CRITICAL: FACTORY DATA PURGE. This will permanently ERASE all transactions and defined goals. This action is IRREVERSIBLE. Proceed with total purge?')) {
                  try {
                    const tSnap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', user.uid)));
                    const gSnap = await getDocs(query(collection(db, 'goals'), where('userId', '==', user.uid)));
                    
                    const batch: Promise<void>[] = [];
                    
                    for (const docRef of tSnap.docs) {
                      batch.push(deleteDoc(doc(db, 'transactions', docRef.id)));
                    }
                    for (const docRef of gSnap.docs) {
                      batch.push(deleteDoc(doc(db, 'goals', docRef.id)));
                    }
                    
                    await Promise.all(batch);
                    
                    // Reset local storage
                    localStorage.removeItem('monthlyBudget');
                    localStorage.removeItem('stressTest');
                    
                    // Force complete reload
                    window.location.reload();
                  } catch (e) {
                    console.error("Purge failed:", e);
                    alert("Purge sequence failed. Check network connection.");
                  }
                }
              }}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl border-2 border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-90"
              title="FACTORY DATA PURGE"
            >
              <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wide">{user.displayName}</span>
              <span className="text-[10px] text-brand-primary/40 font-medium">{user.email}</span>
            </div>
            <button 
              onClick={logout}
              className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg border border-brand-border hover:bg-brand-bg transition-all text-brand-primary/40 hover:text-brand-primary"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Navigation - Mobile Standard */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-brand-surface/90 backdrop-blur-lg border-t border-brand-border px-2 pb-safe">
        <div className="max-w-lg mx-auto flex justify-around items-center h-16">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all",
              activeTab === 'home' ? "text-brand-primary" : "text-brand-primary/30"
            )}
          >
            <Home className={cn("w-5 h-5 transition-all", activeTab === 'home' ? "text-brand-accent scale-110" : "text-brand-primary/30")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all",
              activeTab === 'history' ? "text-brand-primary" : "text-brand-primary/30"
            )}
          >
            <List className={cn("w-5 h-5 transition-all", activeTab === 'history' ? "text-brand-accent scale-110" : "text-brand-primary/30")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Audit</span>
          </button>
          
          {/* Central Action Button */}
          <div className="relative -top-4">
            <button 
              onClick={() => {
                setCommandTab('transaction');
                setShowCommandCenter(true);
              }}
              className="w-14 h-14 bg-brand-primary text-brand-surface rounded-full flex items-center justify-center shadow-2xl border-4 border-brand-bg active:scale-90 transition-all font-bold"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('insights')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all",
              activeTab === 'insights' ? "text-brand-primary" : "text-brand-primary/30"
            )}
          >
            <Zap className={cn("w-5 h-5 transition-all", activeTab === 'insights' ? "text-brand-accent scale-110" : "text-brand-primary/30")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Intel</span>
          </button>
          <button 
            onClick={() => setActiveTab('goals')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all",
              activeTab === 'goals' ? "text-brand-primary" : "text-brand-primary/30"
            )}
          >
            <Target className={cn("w-5 h-5 transition-all", activeTab === 'goals' ? "text-brand-accent scale-110" : "text-brand-primary/30")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Goals</span>
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-8 space-y-4 md:space-y-8">
        {activeTab === 'home' && (
          <div className="space-y-4 md:space-y-8">
            {/* CFO Briefing Section - Compact */}
            <motion.section 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1 py-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <p className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-widest font-mono">Dossier // {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
              </div>
              <h1 className="text-xl md:text-2xl font-sans font-bold text-brand-primary uppercase tracking-tight">Active Strategy Snapshot</h1>
            </motion.section>

            {/* Unified Strategic Dashboard */}
            <div className="space-y-3 md:space-y-4">
              <section className="bg-brand-primary text-brand-surface rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-2xl relative group border border-white/5">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                  style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
                />
                <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-accent rounded-full blur-[100px]" />
                </div>
                
                <div className="p-4 md:p-6 space-y-4 relative z-10">
                  {/* Primary Metric */}
                  <div className="flex justify-between items-center bg-brand-surface/5 p-4 md:p-6 rounded-2xl border border-white/5">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-brand-surface/30 uppercase tracking-widest font-mono leading-none">
                        {monthlyBudget === 0 ? 'NOT SET' : 'SAFE TO SPEND'}
                      </p>
                      <h2 className={cn(
                        "text-4xl md:text-6xl font-mono font-bold tracking-tighter leading-none py-1",
                        (monthlyBudget === 0) ? "text-brand-surface/10" : (stressTest.incomeShock !== 1 || stressTest.expenseShock !== 1 ? "text-brand-accent" : "text-brand-surface")
                      )}>
                        {monthlyBudget === 0 ? '₹0' : formatCurrency(adjustedLeftToSpend)}
                      </h2>
                    </div>
                    {monthlyBudget === 0 ? (
                      <button 
                        onClick={() => {
                          setCommandTab('budget');
                          setShowCommandCenter(true);
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-accent text-brand-primary shadow-lg"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => setShowStressTest(!showStressTest)}
                        className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95",
                          showStressTest ? "bg-brand-accent text-brand-primary" : "bg-brand-surface/10 text-brand-surface border border-brand-surface/10"
                        )}
                      >
                        <Zap className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Strategic Vitals Strip */}
                  <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                    <div className="space-y-1 border-r border-white/5 pr-4">
                      <p className="text-[8px] font-bold text-brand-surface/30 uppercase tracking-widest font-mono">Runway</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg md:text-xl font-mono font-bold text-brand-surface">{runwayMonths.toFixed(1)}</span>
                        <span className="text-[8px] font-bold text-brand-surface/20 uppercase font-mono">M</span>
                      </div>
                    </div>
                    <div className="space-y-1 border-r border-white/5 pr-4">
                      <p className="text-[8px] font-bold text-brand-surface/30 uppercase tracking-widest font-mono">Efficiency</p>
                      <p className="text-lg md:text-xl font-mono font-bold text-brand-surface">{savingsEfficiency.toFixed(0)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-brand-surface/30 uppercase tracking-widest font-mono">Net Delta</p>
                      <p className={cn("text-lg md:text-xl font-mono font-bold", balance >= 0 ? "text-brand-accent" : "text-rose-400")}>
                        {balance >= 0 ? '+' : ''}{Math.abs(balance) > 1000 ? (balance/1000).toFixed(1) + 'k' : balance}
                      </p>
                    </div>
                  </div>
                </div>

                  {/* Micro Burn Trajectory */}
                  {monthlyBudget > 0 && (
                    <div className="space-y-2 border-t border-white/5 pt-4">
                      <div className="flex justify-between items-center text-[8px] font-bold text-white/30 uppercase tracking-widest font-mono">
                        <span>Burn Trajectory</span>
                        <span>{budgetPercentage.toFixed(0)}% Utilized</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                          className={cn(
                            "h-full transition-all duration-1000",
                            budgetPercentage > (now.getDate() / daysInMonth * 100) ? "bg-rose-500" : "bg-brand-accent"
                          )}
                        />
                      </div>
                    </div>
                  )}

              </section>

              <AnimatePresence>
                {showStressTest && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-6 bg-brand-surface border border-brand-border rounded-3xl"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-mono">
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold text-brand-primary/40 uppercase tracking-widest flex justify-between leading-none">
                          Inflow Variability <span className="text-brand-accent">{((stressTest.incomeShock - 1) * 100).toFixed(0)}%</span>
                        </label>
                        <input 
                          type="range" min="0.5" max="1.5" step="0.05" 
                          value={stressTest.incomeShock} 
                          onChange={(e) => setStressTest(s => ({ ...s, incomeShock: parseFloat(e.target.value) }))}
                          className="w-full accent-brand-accent bg-brand-bg rounded-full h-1 appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold text-brand-primary/40 uppercase tracking-widest flex justify-between leading-none">
                          Outflow Shock <span className="text-rose-500">{((stressTest.expenseShock - 1) * 100).toFixed(0)}%</span>
                        </label>
                        <input 
                          type="range" min="0.5" max="2" step="0.1" 
                          value={stressTest.expenseShock} 
                          onChange={(e) => setStressTest(s => ({ ...s, expenseShock: parseFloat(e.target.value) }))}
                          className="w-full accent-rose-500 bg-brand-bg rounded-full h-1 appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CFO Insights - Only show if data exists */}
            {transactions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CFO Insight Card */}
                <div className="bg-brand-accent/5 border border-brand-accent/10 rounded-[2rem] p-8 md:p-10 space-y-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:scale-150" />
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-8 h-8 bg-brand-accent/10 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-brand-accent" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-accent font-mono leading-relaxed py-0.5">CFO Insight</p>
                  </div>
                  <p className="text-sm md:text-lg text-brand-primary/80 leading-relaxed font-sans font-medium uppercase tracking-wide relative z-10">
                    "{goals.length > 0
                      ? (budgetPercentage < 50 
                          ? "You're spending less than planned. Consider moving some surplus into your long-term goals."
                          : budgetPercentage > 90 
                          ? "Spending is high this month. Try to limit non-essential purchases for the next few days."
                          : "Your spending is perfectly on track. Keep this momentum to hit your monthly savings goal.")
                      : (budgetPercentage < 50
                          ? "Surplus capital detected. Establish a savings goal to optimize this liquidity."
                          : budgetPercentage > 90
                          ? "Liquidity is tightening. Audit non-essential outflows to stabilize capital reserves."
                          : "Cash flow is balanced. Protocol recommends defining a financial target.")
                    }"
                  </p>
                </div>

                {/* Goals section removed per direct instruction to avoid auto-defined/surfaced goals on main dashboard */}
              </div>
            )}

            {/* Recent Activity Snippet - Only show if data exists */}
            {transactions.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-end justify-between px-1">
                  <div className="space-y-0.5">
                    <h3 className="text-2xl md:text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary">Recent Activity</h3>
                    <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em] font-mono">Latest Audit Entries</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em] hover:tracking-[0.3em] transition-all font-mono"
                  >
                    View Full Log
                  </button>
                </div>
                <div className="space-y-3">
                  {transactions.slice(0, 3).map(t => (
                    <div key={t.id} className="bg-brand-surface p-4 border border-brand-border rounded-2xl flex items-center justify-between group hover:border-brand-primary/20 transition-all shadow-sm hover:shadow-md">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-bg rounded-xl flex items-center justify-center text-brand-primary/30 group-hover:bg-brand-primary group-hover:text-brand-surface transition-all border border-brand-border group-hover:border-brand-primary shadow-sm group-hover:shadow-lg">
                          {getCategoryIcon(t.category)}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-brand-primary uppercase tracking-wide leading-tight">{t.description}</p>
                          <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-[0.2em] leading-relaxed py-0.5">{t.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={cn(
                          "text-xl font-mono font-bold tabular-nums leading-tight py-1",
                          t.type === 'income' ? "text-brand-accent" : "text-brand-primary"
                        )}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                        <button 
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.confirm('PURGE ENTRY: Delete this transaction?')) {
                              try {
                                if (t.id) {
                                  // Relational Reversal: Decrement linked goal if applicable
                                  if (t.linkedGoalId && t.type === 'expense') {
                                    await updateDoc(doc(db, 'goals', t.linkedGoalId), {
                                      currentAmount: increment(-t.amount)
                                    });
                                  }
                                  await deleteDoc(doc(db, 'transactions', t.id));
                                } else {
                                  console.error('Missing ID');
                                }
                              } catch (error) {
                                console.error('Recent activity delete failed:', error);
                                handleFirestoreError(error, OperationType.DELETE, 'transactions');
                              }
                            }
                          }}
                          className="p-3 text-rose-500/30 hover:text-rose-600 transition-all rounded-xl hover:bg-rose-500/10 active:scale-90 border border-transparent hover:border-rose-500/20"
                          title="Delete Transaction"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 md:space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-0.5">
                <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary">Audit Trail</h2>
                <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em] font-mono">Historical Capital Flow</p>
              </div>
              <button 
                onClick={() => {
                  setCommandTab('transaction');
                  setShowCommandCenter(true);
                }}
                className="px-6 py-3 bg-brand-primary text-brand-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all flex items-center gap-3 shadow-xl"
              >
                <Plus className="w-4 h-4" />
                Quick Log
              </button>
            </div>

            <div className="bg-brand-surface rounded-3xl border border-brand-border shadow-sm overflow-hidden grid grid-cols-3 divide-x divide-brand-border font-mono relative">
              <div className="p-4 md:p-6 text-center space-y-1">
                <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest leading-none">Spent</p>
                <p className="text-lg md:text-xl font-bold text-brand-primary tabular-nums">{formatCurrency(historySummary.spent)}</p>
              </div>
              <div className="p-4 md:p-6 text-center space-y-1">
                <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest leading-none">Earned</p>
                <p className="text-lg md:text-xl font-bold text-brand-accent tabular-nums">{formatCurrency(historySummary.earned)}</p>
              </div>
              <div className="p-4 md:p-6 text-center space-y-1">
                <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest leading-none">Net Flow</p>
                <p className={cn(
                  "text-lg md:text-xl font-bold tabular-nums",
                  historySummary.net >= 0 ? "text-brand-accent" : "text-rose-500"
                )}>
                  {historySummary.net >= 0 ? '+' : ''}{formatCurrency(historySummary.net)}
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-0.5">
                <h2 className="text-2xl md:text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary">Audit Log</h2>
                <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em] font-mono">Capital Flow History</p>
              </div>
              <div className="flex bg-brand-surface p-1 rounded-xl border border-brand-border shadow-sm">
                {['All', 'Expenses', 'Income'].map(f => (
                  <button 
                    key={f} 
                    onClick={() => setFilter(f as any)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      filter === f ? "bg-brand-primary text-brand-surface shadow-md" : "text-brand-primary/40 hover:bg-brand-bg"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction List */}
            <div className="space-y-8">
              {Object.entries(groupedTransactions).map(([date, items]) => (
                <motion.div 
                  key={date} 
                  variants={listContainer}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  className="space-y-4"
                >
                  <motion.div variants={listItem} className="flex items-center gap-3">
                    <h4 className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-[0.3em] font-mono">{date}</h4>
                    <div className="h-px flex-1 bg-brand-border" />
                  </motion.div>
                  <div className="space-y-2">
                    {items.map(t => (
                      <motion.div 
                        key={t.id} 
                        variants={listItem}
                        className="bg-brand-surface p-4 border border-brand-border rounded-2xl shadow-sm hover:shadow-lg transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-bg rounded-xl flex items-center justify-center text-brand-primary/40 group-hover:bg-brand-primary group-hover:text-brand-surface transition-all">
                            {getCategoryIcon(t.category)}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-brand-primary uppercase tracking-wide leading-tight">{t.description}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-[0.2em] font-mono">{t.category}</span>
                              {t.subcategory && (
                                <>
                                  <span className="text-[9px] text-brand-primary/10 tracking-widest">•</span>
                                  <span className="text-[9px] font-bold text-brand-primary/20 uppercase tracking-[0.2em] font-mono">{t.subcategory}</span>
                                </>
                              )}
                              <div className="flex items-center gap-1.5 ml-2">
                                {t.isMandatory && (
                                  <span className="px-1.5 py-0.5 bg-brand-primary/5 text-brand-primary/40 text-[8px] font-bold uppercase tracking-widest rounded border border-brand-primary/5 font-mono">FIXED</span>
                                )}
                                {t.isRecurring && (
                                  <span className="px-1.5 py-0.5 bg-brand-accent/5 text-brand-accent/40 text-[8px] font-bold uppercase tracking-widest rounded border border-brand-accent/5 font-mono">REC</span>
                                )}
                                {t.isAvoidable && (
                                  <span className="px-1.5 py-0.5 bg-rose-500/5 text-rose-500/40 text-[8px] font-bold uppercase tracking-widest rounded border border-rose-500/5 font-mono">AVOID</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div className="text-right flex flex-col items-end gap-0.5">
                            <p className={cn(
                              "text-lg md:text-xl font-mono font-bold tabular-nums leading-tight",
                              t.type === 'income' ? "text-brand-accent" : "text-brand-primary"
                            )}>
                              {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                            </p>
                            <p className="text-[9px] font-bold text-brand-primary/20 uppercase tracking-[0.2em] font-mono leading-none">
                              {new Date(t.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button 
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm('PROTOCOL AUDIT: Are you certain you want to purge this capital flow entry?')) {
                                try {
                                  if (t.id) {
                                    // Relational Reversal
                                    if (t.linkedGoalId && t.type === 'expense') {
                                      await updateDoc(doc(db, 'goals', t.linkedGoalId), {
                                        currentAmount: increment(-t.amount)
                                      });
                                    }
                                    await deleteDoc(doc(db, 'transactions', t.id));
                                  } else {
                                    console.error('Missing transaction ID');
                                  }
                                } catch (error) {
                                  console.error('Purge failed:', error);
                                  handleFirestoreError(error, OperationType.DELETE, 'transactions');
                                }
                              }
                            }}
                            className="p-3 text-rose-500/30 hover:text-rose-600 transition-all rounded-xl hover:bg-rose-500/10 active:scale-90 border border-transparent hover:border-rose-500/20"
                            title="Purge Entry"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-12">
            {goals.length > 0 && (
              <>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-normal py-1">Financial Goals</h2>
                    <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em] font-mono leading-relaxed py-1">Capital Allocation Portfolio</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={async () => {
                        if (window.confirm('GOAL PURGE: Are you certain you want to wipe all goals? This action is irreversible.')) {
                          try {
                            const batch = goals.map(g => deleteDoc(doc(db, 'goals', g.id)));
                            setGoals([]); // Force local state clear for immediate feedback
                            await Promise.all(batch);
                          } catch (err) {
                            console.error('Purge failed:', err);
                          }
                        }
                      }}
                      className="px-4 py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                    >
                      Clear Portfolio
                    </button>
                    <button 
                      onClick={() => {
                        setCommandTab('goal');
                        setShowCommandCenter(true);
                      }}
                      className="px-6 py-3 bg-brand-primary text-brand-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all flex items-center gap-3 shadow-xl"
                    >
                      <Plus className="w-4 h-4" />
                      Initialize New Goal
                    </button>
                  </div>
                </div>

                {/* Aggregate Progress Hero - Compact */}
                <div className="bg-brand-primary text-brand-surface rounded-3xl p-4 md:p-6 relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/10 rounded-full blur-[60px] -mr-16 -mt-16" />
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-bold text-brand-surface/40 uppercase tracking-[0.2em] font-mono">Portfolio Maturity</p>
                      <h3 className="text-3xl md:text-4xl font-mono font-bold text-brand-accent leading-none py-1">
                        {totalGoalTarget > 0 ? totalGoalProgress.toFixed(1) : "0"}%
                      </h3>
                    </div>
                    <div className="flex-1 sm:max-w-xs space-y-3">
                      <div className="h-1.5 w-full bg-brand-surface/10 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${totalGoalTarget > 0 ? Math.min(totalGoalProgress, 100) : 0}%` }}
                          className="h-full bg-brand-accent shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-bold text-brand-surface/40 uppercase tracking-[0.2em] font-mono">
                        <span>{formatCurrency(totalGoalCurrent)}</span>
                        <span>{formatCurrency(totalGoalTarget)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {goals.map(goal => (
                <GoalItem 
                  key={goal.id} 
                  goal={goal} 
                  transactions={transactions}
                  onEdit={() => { 
                    setEditingGoal(goal); 
                    setCommandTab('goal');
                    setShowCommandCenter(true); 
                  }} 
                />
              ))}
              {goals.length === 0 && (
                <div className="col-span-full py-32 text-center border-2 border-dashed border-brand-border rounded-[3rem] bg-brand-surface/50">
                  <div className="max-w-xs mx-auto space-y-8">
                    <div className="w-20 h-20 bg-brand-bg rounded-3xl flex items-center justify-center mx-auto border border-brand-border shadow-inner">
                      <Target className="w-10 h-10 text-brand-primary/10" />
                    </div>
                    <div className="space-y-3">
                      <p className="text-2xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-normal py-1">Portfolio Empty</p>
                      <p className="text-xs text-brand-primary/40 font-medium leading-relaxed">No strategic allocation targets have been defined. Please initialize your first custom goal to begin optimization.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setCommandTab('goal');
                        setShowCommandCenter(true);
                      }}
                      className="w-full py-4 bg-brand-primary text-brand-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-xl active:scale-[0.98]"
                    >
                      Initialize Custom Goal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-12">
          <div className="space-y-1">
            <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1">Intelligence Suite</h2>
            <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em] leading-relaxed py-0.5">Advanced Capital Optimization</p>
          </div>
            
            <div className="space-y-12">
              <StrategyInsights 
                transactions={transactions} 
                goals={goals} 
                balance={balance}
                totalIncome={totalIncome}
                totalSavings={totalSavings}
                mandatoryExpenses={mandatoryExpenses}
                discretionaryExpenses={discretionaryExpenses}
              />
              
              <div className="pt-12 border-t border-brand-border">
                <DebtOptimization goals={goals} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Strategic Command Center */}
      <AnimatePresence>
        {showCommandCenter && user && (
          <CommandCenter 
            onClose={() => {
              setShowCommandCenter(false);
              setEditingGoal(null);
            }} 
            userId={user.uid}
            transactions={transactions}
            goals={goals}
            initialTab={commandTab}
            monthlyBudget={monthlyBudget}
            setMonthlyBudget={setMonthlyBudget}
            editingGoal={editingGoal}
          />
        )}
      </AnimatePresence>

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
                <p className="text-[10px] text-brand-surface/60">Use Artha AI like a real app!</p>
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
  const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
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
  const freedomDate = React.useMemo(() => {
    if (monthsToGoal === Infinity || isNaN(monthsToGoal)) return null;
    const date = new Date();
    // Use first day of current month to avoid overflow issues when adding months
    date.setDate(1);
    date.setMonth(date.getMonth() + Math.ceil(monthsToGoal));
    return date;
  }, [monthsToGoal]);

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className={cn(
        "flex flex-col p-5 md:p-6 bg-brand-surface border border-brand-border rounded-3xl shadow-sm hover:shadow-lg transition-all group relative overflow-hidden",
        isDemo && "opacity-50 grayscale"
      )}
    >
      <div className="flex justify-between items-start mb-6" onClick={onEdit}>
        <div className="space-y-2 cursor-pointer">
          <div className="flex items-center gap-3">
            <h4 className="text-lg md:text-xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-0.5">{goal.name}</h4>
          <div className="flex items-center gap-1.5 text-brand-primary/40">
            <p className="text-[8px] font-bold uppercase tracking-widest font-mono">{goal.type}</p>
            {goal.priority && (
              <p className={cn(
                "text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border leading-none font-mono",
                goal.priority === 'high' ? "text-brand-accent border-brand-accent/20 bg-brand-accent/5" : "border-brand-primary/10"
              )}>{goal.priority}</p>
            )}
          </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[9px] font-bold text-brand-primary/40 uppercase tracking-[0.2em] leading-relaxed font-mono">
              {formatCurrency(remaining)} TO TARGET
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-brand-primary tabular-nums leading-none">{progress.toFixed(0)}%</p>
        </div>
      </div>

      {/* Strategic Simulation Lever */}
      <div className="mt-auto pt-6 border-t border-brand-border space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest leading-relaxed py-0.5 font-mono">Monthly Allocation</p>
            <p className="text-xl md:text-2xl font-mono font-bold text-brand-primary leading-tight tabular-nums py-1">{formatCurrency(simulationValue)}</p>
          </div>
          <div className="text-right space-y-2">
            <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest leading-relaxed py-0.5 font-mono">Projected Maturity</p>
            <p className="text-lg md:text-xl font-mono font-bold uppercase tracking-tight text-brand-accent leading-tight py-1">
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
          <div className="flex justify-between mt-3 text-[10px] font-bold text-brand-primary/20 uppercase tracking-[0.2em]">
            <span>Conservative</span>
            <span>Aggressive</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const EXPENSE_CATEGORIES = {
  'Housing': ['Rent', 'Maintenance', 'Utilities', 'Taxes'],
  'Food & Dining': ['Groceries', 'Swiggy/Zomato', 'Restaurants', 'Cafe'],
  'Transport': ['Fuel', 'Cab/Auto', 'Public Transport', 'Service'],
  'Shopping': ['Lifestyle', 'electronics', 'Home Decor', 'Amazon/Flipkart'],
  'Health': ['Medical', 'Gym', 'Insurance', 'Pharmacy'],
  'Entertainment': ['Streaming', 'Movies', 'Hobbies', 'Gaming'],
  'Investments': ['SIP/Mutual Funds', 'Stocks', 'Debt Repayment', 'Insurance'],
  'Other': ['Misc', 'Gifts', 'Unknown']
};

const INCOME_CATEGORIES = {
  'Employment': ['Salary', 'Bonus', 'Overtime'],
  'Business': ['Client Payment', 'Profit', 'Dividend'],
  'Investment': ['Interest', 'Capital Gains', 'Rental Income'],
  'Other': ['Gift', 'Tax Refund', 'Cashback']
};

function CommandCenter({ 
  onClose, 
  userId, 
  transactions, 
  goals, 
  initialTab,
  monthlyBudget,
  setMonthlyBudget,
  editingGoal
}: { 
  onClose: () => void, 
  userId: string, 
  transactions: Transaction[], 
  goals: Goal[],
  initialTab: 'terminal' | 'transaction' | 'budget' | 'goal',
  monthlyBudget: number,
  setMonthlyBudget: (v: number) => void,
  editingGoal: Goal | null
}) {
  const [activeTab, setActiveTab] = useState<'terminal' | 'transaction' | 'budget' | 'goal'>(editingGoal ? 'goal' : 'terminal');
  const [smartCommand, setSmartCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const smartInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'terminal' && smartInputRef.current) {
      smartInputRef.current.focus();
    }
  }, [activeTab]);

  const handleSmartEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartCommand.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const tokens = smartCommand.trim().split(/\s+/);
      let amount = 0;
      let descriptionParts: string[] = [];
      let type: 'expense' | 'income' = 'expense';

      tokens.forEach(token => {
        const cleanToken = token.replace(/[₹$,]/g, '');
        if (!isNaN(parseFloat(cleanToken)) && cleanToken !== '') {
          amount = Math.abs(parseFloat(cleanToken));
          if (token.toLowerCase().includes('salary') || token.toLowerCase().includes('bonus')) type = 'income'; 
        } else {
          descriptionParts.push(token);
        }
      });

      const description = descriptionParts.join(' ').toUpperCase() || 'UNTITLED ENTRY';
      
      let category = 'Other';
      let subcategory = 'Misc';
      const descLower = description.toLowerCase();
      
      if (descLower.includes('food') || descLower.includes('swiggy') || descLower.includes('zomato') || descLower.includes('dining') || descLower.includes('cafe')) {
        category = 'Food & Dining';
        subcategory = 'Dining/Swiggy';
      } else if (descLower.includes('rent') || descLower.includes('utilities') || descLower.includes('electricity') || descLower.includes('water')) {
        category = 'Housing';
        subcategory = 'Rent/Bills';
      } else if (descLower.includes('amazon') || descLower.includes('myntra') || descLower.includes('flipkart') || descLower.includes('shopping')) {
        category = 'Shopping';
        subcategory = 'Amazon/Flipkart';
      } else if (descLower.includes('uber') || descLower.includes('ola') || descLower.includes('petrol') || descLower.includes('fuel')) {
        category = 'Transport';
        subcategory = 'Cab/Fuel';
      } else if (descLower.includes('salary') || descLower.includes('bonus')) {
        category = 'Employment';
        subcategory = 'Salary';
      } else if (descLower.includes('sip') || descLower.includes('invest') || descLower.includes('stock') || descLower.includes('mutual')) {
        category = 'Investments';
        subcategory = 'SIP/Mutual Funds';
      } else if (descLower.includes('debt') || descLower.includes('emi') || descLower.includes('loan') || descLower.includes('credit card')) {
        category = 'Investments';
        subcategory = 'Debt Repayment';
      }

      // Terminal Attribution Support
      let linkedGoalId = null;
      if (type === 'expense') {
        const goalTypeMapTerminal: Record<string, string> = {
          'Investments': 'investment',
          'Housing': 'savings', // Assuming saving for home if not regular expense
        };
        const goalType = goalTypeMapTerminal[category] || (category === 'Investments' && descLower.includes('debt') ? 'debt' : null);
        
        if (goalType || true) { // Try matching for any expense in terminal
          const matchedGoal = goals.find(g => 
            descLower.includes(g.name.toLowerCase()) || 
            g.name.toLowerCase().includes(descLower)
          );
          if (matchedGoal) {
            linkedGoalId = matchedGoal.id;
            await updateDoc(doc(db, 'goals', matchedGoal.id), { currentAmount: increment(amount) });
          }
        }
      }

      await addDoc(collection(db, 'transactions'), {
        amount,
        category,
        subcategory,
        description,
        type,
        date: new Date().toISOString(),
        userId,
        isMandatory: category === 'Housing' || category === 'Bills & Utilities',
        isRecurring: category === 'Housing',
        isAvoidable: false,
        linkedGoalId
      });

      setSmartCommand('');
      onClose(); 
    } catch (err) {
      console.error("Smart Entry Failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-primary/80 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-brand-surface w-full max-w-2xl rounded-[3rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10 flex flex-col"
      >
        <div className={cn("p-10 md:p-14 space-y-12", activeTab !== 'terminal' && "pb-4")}>
          {/* Header Area */}
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <h3 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary">
                {activeTab === 'terminal' ? 'Terminal' : activeTab === 'transaction' ? 'Manual Link' : activeTab === 'budget' ? 'Thresholds' : 'Strategic Goals'}
              </h3>
              <p className="text-[10px] text-brand-primary/30 font-bold uppercase tracking-[0.4em] font-mono">
                {activeTab === 'terminal' ? 'Real-time Capital Logging' : 'Protocol Parameters'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-[10px] font-bold text-brand-primary/20 hover:text-brand-primary uppercase tracking-[0.2em] transition-colors"
            >
              Close (ESC)
            </button>
          </div>

          {/* Conditional Input Area */}
          {activeTab === 'terminal' && (
            <div className="space-y-6">
              <form onSubmit={handleSmartEntry} className="relative group">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-4">
                  <Terminal className={cn("w-8 h-8 transition-colors", isProcessing ? "text-brand-accent animate-pulse" : "text-brand-primary/10 group-focus-within:text-brand-accent")} />
                </div>
                <input 
                  ref={smartInputRef}
                  type="text"
                  value={smartCommand}
                  onChange={(e) => setSmartCommand(e.target.value)}
                  placeholder="PROMPT: '500 COFFEE'..."
                  className="w-full bg-transparent border-b-2 border-brand-primary/5 py-6 md:py-10 pl-14 text-2xl md:text-6xl font-mono font-bold uppercase tracking-tighter placeholder:text-brand-primary/5 focus:border-brand-accent transition-all outline-none text-brand-primary"
                />
                {smartCommand && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <button 
                      disabled={isProcessing}
                      className="bg-brand-accent text-brand-surface px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-brand-accent/20 active:scale-95 transition-all"
                    >
                      Commit
                    </button>
                  </div>
                )}
              </form>
              
              <p className="text-[10px] text-brand-primary/20 font-bold uppercase tracking-widest leading-relaxed">
                Log capital flows by typing <span className="text-brand-accent/40">Amount</span> + <span className="text-brand-accent/40">Source</span>. 
                Tip: Press <span className="text-brand-primary px-1.5 py-0.5 bg-brand-bg rounded border border-brand-border">C</span> to summon from anywhere.
              </p>
            </div>
          )}

          {/* Contextual Navigation */}
          <div className="flex gap-4 border-t border-brand-primary/5 pt-10">
            {[
              { id: 'terminal', label: 'Terminal', icon: Terminal },
              { id: 'transaction', label: 'Manual Form', icon: Plus },
              { id: 'budget', label: 'Thresholds', icon: ShieldCheck },
              { id: 'goal', label: 'Goals', icon: Target },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "flex-1 p-4 md:p-6 rounded-2xl border transition-all flex flex-col gap-3 group text-left",
                  activeTab === t.id 
                    ? "bg-brand-primary border-brand-primary text-brand-surface shadow-xl scale-[1.02]" 
                    : "bg-brand-bg/50 border-brand-border text-brand-primary/40 hover:border-brand-primary/20"
                )}
              >
                <t.icon className={cn("w-5 h-5", activeTab === t.id ? "text-brand-accent" : "text-brand-primary/20")} />
                <div>
                  <p className={cn("text-[8px] md:text-[9px] font-bold uppercase tracking-widest", activeTab === t.id ? "text-brand-surface" : "text-brand-primary")}>{t.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Content Area */}
        {activeTab !== 'terminal' && (
          <div className="bg-brand-bg/30 border-t border-brand-primary/5 max-h-[60vh] overflow-y-auto no-scrollbar">
            {activeTab === 'transaction' && (
              <div className="p-0">
                <TransactionForm onClose={onClose} userId={userId} transactions={transactions} goals={goals} />
              </div>
            )}
            {activeTab === 'budget' && <BudgetModalContent onClose={onClose} monthlyBudget={monthlyBudget} setMonthlyBudget={setMonthlyBudget} />}
            {activeTab === 'goal' && (
              <div className="p-10">
                <GoalModalContent onClose={onClose} userId={userId} goal={editingGoal} />
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function BudgetModalContent({ onClose, monthlyBudget, setMonthlyBudget }: { onClose: () => void, monthlyBudget: number, setMonthlyBudget: (v: number) => void }) {
  const [tempBudget, setTempBudget] = useState(monthlyBudget);

  return (
    <div className="p-8 md:p-10 space-y-10">
      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.3em] font-mono pl-1">Threshold Designation</label>
          <div className="relative group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-accent/40 font-mono font-bold text-2xl group-focus-within:text-brand-accent transition-colors">₹</div>
            <input 
              type="number"
              value={tempBudget}
              onChange={(e) => setTempBudget(Number(e.target.value))}
              className="w-full bg-brand-surface border border-brand-border rounded-[2rem] py-8 pl-14 pr-8 font-mono font-bold text-5xl text-brand-primary focus:ring-4 focus:ring-brand-accent/5 transition-all outline-none shadow-inner"
              placeholder="0"
            />
          </div>
          <p className="text-[9px] text-brand-primary/30 font-bold uppercase tracking-widest pl-1 leading-relaxed">
            This value defines the defensive perimeter for non-essential capital outflow.
          </p>
        </div>
      </div>

      <button 
        onClick={() => {
          setMonthlyBudget(tempBudget);
          onClose();
        }}
        className="w-full py-6 bg-brand-primary text-brand-surface rounded-2xl font-bold text-xs uppercase tracking-[0.3em] hover:bg-brand-primary/95 transition-all shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)] hover:scale-[1.01] active:scale-95"
      >
        Commit Limit
      </button>
    </div>
  );
}

// Refactored TransactionModal to use a content component
function TransactionForm({ onClose, userId, transactions, goals }: { onClose: () => void, userId: string, transactions: Transaction[], goals: Goal[] }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Dining');
  const [subcategory, setSubcategory] = useState('Groceries');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isAvoidable, setIsAvoidable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // Sync subcategory when category changes
  useEffect(() => {
    const currentCats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const subs = (currentCats as any)[category];
    if (subs && !subs.includes(subcategory)) {
      setSubcategory(subs[0]);
    }
  }, [category, type]);

  const goalTypeMap: Record<string, string> = {
    'Investment': 'investment',
    'Debt Repayment': 'debt',
    'Savings': 'savings'
  };
  const matchingGoal = goals.find(g => g.type === goalTypeMap[category]);

  const smartTemplates = React.useMemo(() => {
    const counts: Record<string, { count: number, category: string, lastAmount: number }> = {};
    transactions.forEach(t => {
      if (!counts[t.description]) {
        counts[t.description] = { count: 0, category: t.category, lastAmount: t.amount };
      }
      counts[t.description].count++;
      counts[t.description].lastAmount = t.amount;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));
  }, [transactions]);

  const applyTemplate = (template: { name: string, category: string, lastAmount: number }) => {
    setDescription(template.name.toUpperCase());
    setCategory(template.category);
    setAmount(template.lastAmount.toString());
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0 || !description || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      let linkedGoalId = null;
      if (type === 'expense') {
        const goalType = goalTypeMap[category === 'Investments' ? 'Investment' : category === 'Debt Repayment' ? 'Debt Repayment' : category];
        const gQuery = query(collection(db, 'goals'), where('userId', '==', userId));
        const gSnapshot = await getDocs(gQuery);
        
        const goalDoc = gSnapshot.docs.find(d => {
          const gData = d.data();
          const nameMatch = description.toLowerCase().includes(gData.name.toLowerCase()) ||
                           gData.name.toLowerCase().includes(description.toLowerCase());
          const typeMatch = gData.type === goalTypeMap[category];
          return nameMatch || (goalType && typeMatch);
        });

        if (goalDoc) {
          linkedGoalId = goalDoc.id;
          await updateDoc(doc(db, 'goals', goalDoc.id), { currentAmount: increment(amountNum) });
        }
      }

      await addDoc(collection(db, 'transactions'), {
        amount: amountNum,
        category,
        subcategory,
        description: description.toUpperCase(),
        type,
        date: new Date().toISOString(),
        userId,
        isMandatory: type === 'expense' ? isMandatory : false,
        isRecurring: type === 'expense' ? isRecurring : false,
        isAvoidable: type === 'expense' ? isAvoidable : false,
        linkedGoalId
      });

      onClose();
    } catch (error: any) {
      console.error('Save failed:', error);
      setErrorMsg(`Persistence Failure: ${error.message || 'Check database access rules.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8 md:space-y-10">
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest leading-relaxed">
            {errorMsg}
          </p>
        </div>
      )}
      
      {smartTemplates.length > 0 && (
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.3em] font-mono">Frequent Counterparties</label>
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
            {smartTemplates.slice(0, 5).map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTemplate(t)}
                className="flex-shrink-0 px-5 py-3 bg-brand-surface border border-brand-border rounded-xl text-[10px] font-bold text-brand-primary/60 hover:bg-brand-primary hover:text-brand-surface transition-all active:scale-95 uppercase tracking-widest shadow-sm hover:shadow-md"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex bg-brand-bg/50 p-2 rounded-[1.5rem] border border-brand-border shadow-inner">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              const firstCat = Object.keys(t === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0];
              setCategory(firstCat);
              const firstSub = (t === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[firstCat as keyof typeof EXPENSE_CATEGORIES][0];
              setSubcategory(firstSub);
            }}
            className={cn(
              "flex-1 py-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2",
              type === t 
                ? "bg-brand-primary text-brand-surface shadow-xl scale-[1.02]" 
                : "text-brand-primary/40 hover:bg-brand-primary/5"
            )}
          >
            {t === 'income' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        <div className="space-y-3 relative">
          <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.3em] font-mono">Entity Designation</label>
          <input 
            type="text" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="WHERE OR WHOM?"
            className="w-full bg-brand-surface border border-brand-border rounded-xl py-5 px-6 text-sm font-bold uppercase tracking-wider focus:ring-2 focus:ring-brand-accent/20 transition-all outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-2 space-y-3">
            <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.3em] font-mono">Quantum</label>
            <div className="relative group">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-primary/30 font-sans font-bold group-focus-within:text-brand-accent transition-colors">₹</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-brand-surface border border-brand-border rounded-xl py-5 pl-10 pr-6 text-sm font-mono font-bold focus:ring-2 focus:ring-brand-accent/20 transition-all outline-none"
                required
              />
            </div>
          </div>
          <div className="md:col-span-3 space-y-3">
            <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.3em] font-mono">Classification</label>
            <div className="grid grid-cols-2 gap-2">
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-[56px] bg-brand-surface border border-brand-border rounded-xl px-4 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-brand-accent/20 transition-all outline-none appearance-none"
              >
                {Object.keys(currentCategories).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select 
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full h-[56px] bg-brand-surface border border-brand-border rounded-xl px-4 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-brand-accent/20 transition-all outline-none appearance-none"
              >
                {(currentCategories as any)[category]?.map((sub: string) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {type === 'expense' && (
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.3em] font-mono leading-none">Strategic Attributes</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'mandatory', label: 'Essential', state: isMandatory, set: setIsMandatory, icon: ShieldCheck },
                { id: 'recurring', label: 'Recurring', state: isRecurring, set: setIsRecurring, icon: Activity },
                { id: 'avoidable', label: 'Avoidable', state: isAvoidable, set: setIsAvoidable, icon: AlertTriangle },
              ].map((attr) => (
                <button
                  key={attr.id}
                  type="button"
                  onClick={() => attr.set(!attr.state)}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                    attr.state 
                      ? "bg-brand-primary text-brand-surface border-brand-primary shadow-lg" 
                      : "bg-brand-surface text-brand-primary/40 border-brand-border hover:border-brand-primary/20"
                  )}
                >
                  <attr.icon className={cn("w-4 h-4", attr.state ? "text-brand-accent" : "text-brand-primary/20")} />
                  <span className="text-[9px] font-bold uppercase tracking-widest leading-none">{attr.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {matchingGoal && type === 'expense' && (
        <div className="bg-brand-accent/5 border border-brand-accent/10 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-8 h-8 bg-brand-accent/20 rounded-lg flex items-center justify-center border border-brand-accent/20">
            <Target className="w-4 h-4 text-brand-accent" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em]">Strategic Routing Enabled</p>
            <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">
              Allocating to: <span className="text-brand-primary">{matchingGoal.name}</span>
            </p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-6 bg-brand-primary text-brand-surface rounded-2xl font-bold text-xs uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.01] transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {isSubmitting ? 'SECURE_SAVE_PENDING...' : `COMMIT ${type === 'expense' ? 'OUTFLOW' : 'INFLOW'} PROTOCOL`}
      </button>
    </form>
  );
}

function GoalModalContent({ onClose, userId, goal }: { onClose: () => void, userId: string, goal: Goal | null }) {
  const [name, setName] = useState(goal?.name || '');
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount.toString() || '');
  const [currentAmount, setCurrentAmount] = useState(goal?.currentAmount.toString() || '');
  const [monthlyContribution, setMonthlyContribution] = useState(goal?.monthlyContribution?.toString() || '');
  const [type, setType] = useState<GoalType>(goal?.type || 'savings');
  const [deadline, setDeadline] = useState(goal?.deadline || '');
  const [interestRate, setInterestRate] = useState(goal?.interestRate?.toString() || '');
  const [tenureMonths, setTenureMonths] = useState(goal?.tenureMonths?.toString() || '');
  const [startDate, setStartDate] = useState(goal?.startDate || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(goal?.priority || 'medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetAmount);
    if (!name || isNaN(target) || target <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const data = {
        name,
        targetAmount: target,
        currentAmount: parseFloat(currentAmount || '0'),
        monthlyContribution: monthlyContribution ? parseFloat(monthlyContribution) : null,
        type,
        userId,
        deadline: deadline || null,
        interestRate: interestRate ? parseFloat(interestRate) : null,
        tenureMonths: tenureMonths ? parseInt(tenureMonths) : null,
        startDate: startDate || null,
        priority,
      };

      if (goal?.id) {
        await updateDoc(doc(db, 'goals', goal.id), data);
      } else {
        await addDoc(collection(db, 'goals'), data);
      }
      onClose();
    } catch (error: any) {
      console.error('Goal save failed:', error);
      setErrorMsg(`Update Failure: ${error.message || 'Check database access rules.'}`);
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
    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 md:space-y-8">
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
                placeholder="e.g. Major Asset"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Goal Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary/40 font-sans font-bold">₹</span>
                  <input 
                    required
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl py-4 pl-8 pr-5 text-sm font-mono focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Monthly Contribution</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary/40 font-sans font-bold">₹</span>
                  <input 
                    required
                    type="number"
                    value={monthlyContribution}
                    onChange={(e) => setMonthlyContribution(e.target.value)}
                    className="w-full bg-brand-bg border border-brand-border rounded-xl py-4 pl-8 pr-5 text-sm font-mono focus:ring-2 focus:ring-brand-primary/5 transition-all outline-none"
                    placeholder="0"
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
                      type === t ? "bg-brand-primary text-brand-surface shadow-md" : "text-brand-primary/40 hover:bg-brand-primary/5"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-[0.2em]">Priority</label>
              <div className="flex bg-brand-bg p-1 rounded-xl border border-brand-border">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      priority === p ? "bg-brand-primary text-brand-surface shadow-md" : "text-brand-primary/40 hover:bg-brand-primary/5"
                    )}
                  >
                    {p}
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
              {isSubmitting ? 'Processing' : goal ? 'Commit Changes' : 'Initialize Goal'}
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
          <p className="text-sm text-rose-600 font-bold uppercase tracking-wide text-center leading-relaxed">Confirm Goal Termination? This action will purge all associated goal data.</p>
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
  );
}

