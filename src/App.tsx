import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, orderBy, limit, getDocFromServer, doc, updateDoc, increment, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db, signIn, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { Transaction, Goal, GoalType, StressTestState } from './types';
import { formatCurrency, cn } from './lib/utils';
import { 
  Plus, 
  ShieldCheck,
  Plane,
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
  Calendar,
  Info,
  Trash2,
  CheckCircle2,
  List,
  Zap,
  ArrowDownRight,
  ArrowUpRight,
  CornerDownLeft,
  ChevronRight,
  AlertCircle,
  Terminal,
  Activity,
  AlertTriangle,
  Settings2,
  X,
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  Car,
  Film
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
  XAxis,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { generateQuickInsights } from './services/aiService';
import { useFinancialEngine } from './hooks/useFinancialEngine';

// Lazy load heavy analytical components
const StrategyInsights = React.lazy(() => import('./components/StrategyInsights').then(m => ({ default: m.StrategyInsights })));
const DebtOptimization = React.lazy(() => import('./components/DebtOptimization').then(m => ({ default: m.DebtOptimization })));

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
              <h2 className="text-4xl font-sans font-semibold uppercase tracking-tight text-brand-primary leading-tight py-1">System Alert</h2>
            <p className="data-label">
                A critical runtime exception occurred. The audit trail has been preserved for diagnosis.
              </p>
            </div>
            <div className="bg-brand-bg p-6 rounded-2xl border border-brand-border text-left overflow-auto max-h-40">
              <code className="text-xs font-mono text-brand-primary/60 break-all">
                {this.state.error?.message || "Unknown Error"}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-5 bg-brand-primary text-brand-surface rounded-xl font-semibold text-xs uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all shadow-xl"
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
  const [commandTab, setCommandTab] = useState<'transaction' | 'goal'>('transaction');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showMobileTip, setShowMobileTip] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Expenses' | 'Income'>('All');
  const [stressTest, setStressTest] = useState<StressTestState>(() => {
    const saved = localStorage.getItem('stressTest');
    return saved ? JSON.parse(saved) : { incomeShock: 1, expenseShock: 1 };
  });
  const [transactionIdToConfirmDelete, setTransactionIdToConfirmDelete] = useState<string | null>(null);
  const [showGoalPurgeConfirm, setShowGoalPurgeConfirm] = useState(false);
  const [showTotalPurgeConfirm, setShowTotalPurgeConfirm] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const timeouts = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    return () => {
      // Cleanup all tactical timeouts on unmount
      Object.values(timeouts.current).forEach(clearTimeout);
    };
  }, []);

  const handleDeleteTransaction = async (t: Transaction) => {
    if (!t.id) return;
    if (transactionIdToConfirmDelete === t.id) {
      try {
        if (t.linkedGoalId && t.type === 'expense') {
          await updateDoc(doc(db, 'goals', t.linkedGoalId), {
            currentAmount: increment(-t.amount)
          });
        }
        await deleteDoc(doc(db, 'transactions', t.id));
        setTransactionIdToConfirmDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'transactions');
        alert("Operation Failed: Deletion protocol rejected by database.");
      }
    } else {
      setTransactionIdToConfirmDelete(t.id);
      if (timeouts.current.delete) clearTimeout(timeouts.current.delete);
      timeouts.current.delete = setTimeout(() => setTransactionIdToConfirmDelete(null), 4000);
    }
  };

  useEffect(() => {
    localStorage.setItem('stressTest', JSON.stringify(stressTest));
  }, [stressTest]);
  const [showStressTest, setShowStressTest] = useState(false);
  const [streakCount, setStreakCount] = useState(() => Number(localStorage.getItem('streakCount') || 0));
  const [lastCheckIn, setLastCheckIn] = useState(() => localStorage.getItem('lastCheckIn') || '');
  const [isReadyForCheckIn, setIsReadyForCheckIn] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (lastCheckIn !== today) {
      setIsReadyForCheckIn(true);
    }
  }, [lastCheckIn]);

  const authorizeDailyReady = () => {
    const today = new Date().toISOString().split('T')[0];
    const newStreak = lastCheckIn === '' || (new Date(today).getTime() - new Date(lastCheckIn).getTime()) <= 86400000 * 2 
      ? streakCount + 1 
      : 1;
    setStreakCount(newStreak);
    setLastCheckIn(today);
    setIsReadyForCheckIn(false);
    localStorage.setItem('streakCount', String(newStreak));
    localStorage.setItem('lastCheckIn', today);
  };

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
      orderBy('date', 'desc')
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

  const [insights, setInsights] = useState<string[]>([]);
  useEffect(() => {
    if (user && transactions.length > 5 && goals.length > 0) {
      const fetchInsights = async () => {
        try {
          const data = await generateQuickInsights(transactions, goals);
          setInsights(data);
        } catch (e) {
          console.error("Context-Aware Insight Failure:", e);
        }
      };
      fetchInsights();
    }
  }, [user, transactions.length, goals.length]);

  // Strategic Cash Flow Monitoring
  const {
    totalIncome,
    totalExpenses,
    mandatoryExpenses,
    discretionaryExpenses,
    spentThisMonth,
    spentToday,
    liquidAssets,
    balance,
    runwayMonths,
    leftToSpend,
    adjustedLeftToSpend,
    budgetPercentage,
    savingsEfficiency,
    fixedRatio,
    monthlyBurn,
    activeDailyPace,
    today,
    daysInMonth,
    last7Days,
    avgDailySpend,
    remainingDays,
    strategicSpendingCeiling,
    dailySpendingPower,
    monthlyGoalCommitments,
    estimatedMonthlyIncome
  } = useFinancialEngine(transactions, goals, 0, stressTest);

  // QA Logic: McKinsey-level strategic thresholds
  const healthStatus = runwayMonths >= 6 ? 'STABILIZED' : runwayMonths >= 3 ? 'WARNING' : 'CRITICAL';
  const currentPhase = healthStatus === 'STABILIZED' 
    ? (goals.some(g => g.currentAmount >= g.targetAmount) ? 'OPTIMIZATION' : 'ACCELERATION') 
    : 'STABILIZATION';

  // Predictive Analytics - Stress Test Synchronized
  const projectedMonthlySpend = (spentThisMonth + (avgDailySpend * remainingDays)) * stressTest.expenseShock;
  const projectedSavings = Math.max(0, (totalIncome * stressTest.incomeShock) - projectedMonthlySpend);
  const now = today;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysUntilReset = lastDayOfMonth.getDate() - now.getDate();
  const recentTrend = last7Days[6].amount > avgDailySpend ? 'Increasing' : 'Stable';

  const budgetDailyLimit = dailySpendingPower;
  const isAheadOfBudget = activeDailyPace < dailySpendingPower;
  const budgetVariance = (dailySpendingPower * today.getDate()) - spentThisMonth;
  const dailyRemaining = Math.max(0, dailySpendingPower - spentToday);

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

  const historyTrendData = [...transactions]
    .filter(t => t.type === 'expense')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc: any[], t) => {
      const date = new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const existing = acc.find(i => i.date === date);
      if (existing) {
        existing.amount += t.amount;
      } else {
        acc.push({ date, dateValue: t.date, amount: t.amount });
      }
      return acc;
    }, [])
    .slice(-10); // Show last 10 days of activity

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
    if (cat.includes('dining') || cat.includes('swiggy') || cat.includes('zomato')) return <UtensilsCrossed className="w-5 h-5 text-brand-accent/70" />;
    if (cat.includes('grocery') || cat.includes('q-commerce') || cat.includes('blinkit') || cat.includes('instamart') || cat.includes('zepto')) return <ShoppingCart className="w-5 h-5 text-emerald-400/70" />;
    if (cat.includes('shopping') || cat.includes('fashion') || cat.includes('lifestyle') || cat.includes('amazon') || cat.includes('flipkart')) return <ShoppingBag className="w-5 h-5 text-brand-secondary/70" />;
    if (cat.includes('transport') || cat.includes('commute') || cat.includes('uber') || cat.includes('ola') || cat.includes('rapido')) return <Car className="w-5 h-5 text-sky-400/70" />;
    if (cat.includes('bill') || cat.includes('utility') || cat.includes('recharge')) return <Zap className="w-5 h-5 text-amber-400/70" />;
    if (cat.includes('housing') || cat.includes('rent')) return <Home className="w-5 h-5 text-brand-primary/70" />;
    if (cat.includes('health') || cat.includes('medical') || cat.includes('gym')) return <Activity className="w-5 h-5 text-rose-400/70" />;
    if (cat.includes('travel') || cat.includes('flight') || cat.includes('hotel')) return <Plane className="w-5 h-5 text-indigo-400/70" />;
    if (cat.includes('entertainment') || cat.includes('netflix') || cat.includes('gaming')) return <Film className="w-5 h-5 text-purple-400/70" />;
    if (cat.includes('invest') || cat.includes('emi') || cat.includes('stock')) return <TrendingUp className="w-5 h-5 text-brand-accent" />;
    return <List className="w-5 h-5 text-brand-primary/40" />;
  };

  const totalLiquidReserves = goals
    .filter(g => g.type === 'savings' || g.type === 'investment')
    .reduce((acc, g) => acc + g.currentAmount, 0);
  const totalDebtPaid = goals
    .filter(g => g.type === 'debt')
    .reduce((acc, g) => acc + g.currentAmount, 0);
  const totalGoalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalGoalCurrent = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalGoalProgress = totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0;

  const categoryData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      const groupName = t.category;
      
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
            <div className="relative group">
              <div className="w-24 h-24 bg-brand-primary flex items-center justify-center rounded-3xl shadow-2xl transform group-hover:scale-105 transition-all duration-500 overflow-hidden">
                <Terminal className="w-12 h-12 text-brand-accent transition-all group-hover:rotate-12" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
              </div>
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-brand-accent rounded-full border-4 border-brand-bg animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/5 border border-brand-primary/10 rounded-full mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-ping" />
              <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">Artha AI</p>
            </div>
            <h1 className="text-6xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-none">Artha</h1>
            <p className="text-brand-accent data-label mt-2">Capital Strategic Framework</p>
          </div>
          <div className="space-y-6">
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className={cn(
                "w-full flex items-center justify-center gap-4 bg-brand-primary text-brand-surface py-5 px-8 rounded-xl font-semibold text-xs uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all shadow-xl active:scale-[0.98]",
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
                <p className="data-label text-rose-500 leading-relaxed">
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
      {/* Top Header - Compact Technical Execution */}
      <header className="sticky top-0 z-40 bg-brand-surface/90 backdrop-blur-2xl border-b border-brand-border px-4 py-4 md:px-8 md:py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="relative">
              <div className="w-11 h-11 md:w-13 md:h-13 bg-brand-primary text-brand-surface rounded-xl flex items-center justify-center shadow-xl transform group-hover:rotate-6 transition-all duration-500">
                <PiggyBank className="w-6 h-6 md:w-7 md:h-7 text-brand-accent transition-transform group-hover:scale-110" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-brand-accent rounded-full border-2 border-brand-surface" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xl md:text-2xl font-sans font-bold tracking-tight text-brand-primary leading-none block uppercase">Artha</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-brand-accent animate-pulse" />
                <p className="data-label !text-[9px]">Your Personal CFO</p>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-8">
            <div className="flex flex-col items-end">
              <p className="data-label !text-brand-primary/40">Market Sentiment</p>
              <div className="flex items-center gap-1 text-emerald-500 font-mono font-bold text-[10px]">
                <TrendingUp className="w-3 h-3" />
                <span>Steady</span>
              </div>
            </div>
            <div className="h-8 w-[1px] bg-brand-border" />
            <div className="flex flex-col items-end">
              <p className="data-label !text-brand-primary/40">Account Status</p>
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border mt-1",
                currentPhase === 'OPTIMIZATION' ? "bg-brand-accent/5 text-brand-accent border-brand-accent/20" : "bg-brand-primary/5 text-brand-primary/40 border-brand-primary/10"
              )}>
                {currentPhase}
              </div>
            </div>
          </div>

          <div className="lg:hidden flex flex-col items-end gap-1">
             <div className="w-10 h-10 rounded-xl bg-brand-bg border border-brand-border flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-brand-accent animate-ping" />
             </div>
          </div>
        </div>
      </header>

      {/* Bottom Navigation - Tactical Switcher */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-brand-surface/95 backdrop-blur-3xl border-t border-brand-border px-6 pb-safe">
        <div className="max-w-xl mx-auto flex items-center justify-between h-24">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 flex-1 h-full transition-all relative group",
              activeTab === 'home' ? "text-brand-primary" : "text-brand-primary/25"
            )}
          >
            <Home className={cn("w-5 h-5 transition-all duration-300", activeTab === 'home' ? "scale-110" : "group-hover:text-brand-primary/50")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
            {activeTab === 'home' && (
              <motion.div layoutId="nav-glow" className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-accent shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 flex-1 h-full transition-all relative group",
              activeTab === 'history' ? "text-brand-primary" : "text-brand-primary/25"
            )}
          >
            <List className={cn("w-5 h-5 transition-all duration-300", activeTab === 'history' ? "scale-110" : "group-hover:text-brand-primary/50")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ledger</span>
            {activeTab === 'history' && (
              <motion.div layoutId="nav-glow" className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-accent shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            )}
          </button>
          
          {/* Central Execution Hub */}
          <div className="flex-1 flex justify-center -mt-10 relative">
            <button 
              onClick={() => {
                setCommandTab('transaction');
                setShowCommandCenter(true);
              }}
              className="w-16 h-16 bg-brand-primary text-brand-accent rounded-2xl flex items-center justify-center shadow-xl border-[6px] border-brand-bg active:scale-95 transition-all relative z-10"
              title="Tactical Entry"
            >
              <Plus className="w-8 h-8" />
            </button>
          </div>
 
          <button 
            onClick={() => setActiveTab('insights')}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 flex-1 h-full transition-all relative group",
              activeTab === 'insights' ? "text-brand-primary" : "text-brand-primary/25"
            )}
          >
            <Sparkles className={cn("w-5 h-5 transition-all duration-300", activeTab === 'insights' ? "scale-110" : "group-hover:text-brand-primary/50")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Analysis</span>
            {activeTab === 'insights' && (
              <motion.div layoutId="nav-glow" className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-accent shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('goals')}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 flex-1 h-full transition-all relative group",
              activeTab === 'goals' ? "text-brand-primary" : "text-brand-primary/25"
            )}
          >
            <Target className={cn("w-5 h-5 transition-all duration-300", activeTab === 'goals' ? "scale-110" : "group-hover:text-brand-primary/50")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Portfolio</span>
            {activeTab === 'goals' && (
              <motion.div layoutId="nav-glow" className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-accent shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-8 space-y-4 md:space-y-8">
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Executive Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-3xl font-display font-bold text-brand-primary tracking-tighter">Personal CFO</h1>
                <p className="data-label">Strategic Cash Flow Control Module</p>
              </div>
              <div className="flex gap-2">
                 <div className="bg-brand-surface/50 border border-brand-border px-3 py-1.5 rounded-xl flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse" />
                    <span className="text-[10px] font-mono font-bold text-brand-primary uppercase tracking-widest">{healthStatus}</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Strategic Capacity & Metrics (Left Column Dominant) */}
              <div className="md:col-span-8 md:row-span-2 space-y-6">
                <section className="bg-brand-primary text-brand-surface rounded-[2.5rem] overflow-hidden shadow-2xl relative h-full border border-white/5 flex flex-col">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
                  />
                  
                  <div className="p-8 md:p-10 space-y-10 relative z-10 flex-1">
                    <div className="space-y-2">
                      <p className="data-label !text-brand-surface/40 uppercase tracking-[0.2em]">Safe Spending Capacity</p>
                      <h2 className="text-6xl md:text-8xl font-display font-bold tracking-tighter leading-none text-brand-surface">
                        {formatCurrency(Math.max(0, strategicSpendingCeiling - spentThisMonth))}
                      </h2>
                      <p className="text-xs text-brand-surface/30 font-medium mt-2 tracking-tight">Net monthly liquidity after goal preservation protocols</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-10 border-t border-white/10">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-surface/30">Monthly Ceiling</p>
                        <p className="text-2xl font-mono font-bold text-brand-surface">{formatCurrency(strategicSpendingCeiling)}</p>
                        <p className="text-[8px] text-brand-surface/20 uppercase font-medium">Cap based on net flow</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-surface/30">Deployment</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-mono font-bold text-brand-surface">{((spentThisMonth / (strategicSpendingCeiling || 1)) * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1 w-full bg-white/10 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-brand-accent w-full" style={{ width: `${Math.min(100, (spentThisMonth / (strategicSpendingCeiling || 1)) * 100)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-surface/30">Protected Funds</p>
                        <p className="text-2xl font-mono font-bold text-brand-accent">{formatCurrency(monthlyGoalCommitments)}</p>
                        <p className="text-[8px] text-brand-accent/40 uppercase font-medium">Earmarked for targets</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Tactical Pulse (Right Column) */}
              <div className="md:col-span-4 space-y-6">
                <div className="bg-brand-surface border border-brand-border rounded-[2.5rem] p-8 h-full shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-brand-accent/5 rounded-full blur-[60px] -mr-20 -mt-20" />
                  
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="data-label">Daily Tracker</p>
                        <h3 className="text-xl font-display font-bold text-brand-primary tracking-tight">Today's Wallet</h3>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner",
                        dailyRemaining > 0 ? "bg-brand-accent/10 text-brand-accent border-brand-accent/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      )}>
                        <Activity className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className={cn(
                        "text-5xl font-mono font-bold tracking-tighter",
                        dailyRemaining > 0 ? "text-brand-primary" : "text-rose-500"
                      )}>
                        {formatCurrency(dailyRemaining)}
                      </p>
                      <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest px-1">Available spending power</p>
                    </div>
                    
                    <div className="pt-4 border-t border-brand-border">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-brand-primary/40 text-[8px]">Daily Limit</span>
                        <span className="text-brand-primary">{formatCurrency(dailySpendingPower)}</span>
                      </div>
                      <div className="h-2 w-full bg-brand-bg rounded-full mt-3 overflow-hidden p-0.5 border border-brand-border">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((spentToday / (dailySpendingPower || 1)) * 100, 100)}%` }}
                          className={cn(
                            "h-full rounded-full",
                            spentToday > dailySpendingPower ? "bg-rose-500" : "bg-brand-primary"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "mt-8 p-3 rounded-2xl border text-[9px] font-bold uppercase tracking-widest text-center",
                    isAheadOfBudget ? "bg-brand-accent/5 border-brand-accent/10 text-brand-accent" : "bg-rose-500/5 border-rose-500/10 text-rose-500"
                  )}>
                    {isAheadOfBudget ? '✓ Operational Surplus' : '⚠ Capital Leak Detected'}
                  </div>
                </div>
              </div>

              {/* Insights Briefing (Right Column) */}
              <div className="md:col-span-4 h-full">
                <div className="bg-brand-accent/5 border border-brand-accent/10 rounded-[2.5rem] p-8 space-y-4 relative overflow-hidden flex flex-col justify-center h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-brand-accent/10 rounded-2xl flex items-center justify-center text-brand-accent">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">CFO Assessment</p>
                  </div>
                  <p className="text-lg text-brand-primary font-display font-medium leading-tight tracking-tight">
                    { (spentThisMonth / (strategicSpendingCeiling || 1)) < 0.5 
                      ? "Capital efficiency is high. Strategic reinvestment of surplus into portfolio targets recommended."
                      : (spentThisMonth / (strategicSpendingCeiling || 1)) > 0.9 
                      ? "Liquidity threshold reached. Immediate spending freeze on non-essentials required to stabilize month-end cash."
                      : "Operational flow is stable. Maintain current daily velocity to meet all financial targets."
                    }
                  </p>
                </div>
              </div>

              {/* Lower Dashboard Grid */}
              <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Goals Pulse */}
                <div className="bg-brand-surface border border-brand-border rounded-[2.5rem] p-8 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-brand-border pb-6">
                    <div className="space-y-1">
                      <p className="data-label">Portfolio Pulse</p>
                      <h3 className="text-xl font-display font-bold text-brand-primary tracking-tight">Active Targets</h3>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-brand-primary/5 flex items-center justify-center text-brand-primary border border-brand-border">
                      <Target className="w-5 h-5" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {goals.length > 0 ? goals.slice(0, 4).map((goal) => {
                      const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
                      return (
                        <div key={goal.id} className="bg-brand-bg/40 p-4 rounded-[1.5rem] border border-brand-border/50 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                             <div className="space-y-1 min-w-0">
                              <p className="text-[10px] font-bold text-brand-primary uppercase tracking-wide truncate">{goal.name}</p>
                              <div className="space-y-0.5">
                                <p className="text-[11px] font-mono font-bold text-brand-primary">{formatCurrency(goal.targetAmount)}</p>
                                <p className="text-[7px] font-bold text-brand-primary/20 uppercase tracking-[0.1em]">Target Protocol</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-brand-accent flex-shrink-0">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-1 w-full bg-brand-primary/5 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-primary" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="col-span-2 py-4 text-center space-y-2">
                        <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-widest">No Active Targets</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations Ledger Snippet */}
                <div className="bg-brand-surface border border-brand-border rounded-[2.5rem] p-8 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-brand-border pb-6">
                    <div className="space-y-1">
                      <p className="data-label">Operations Ledger</p>
                      <h3 className="text-xl font-display font-bold text-brand-primary tracking-tight">Recent Activity</h3>
                    </div>
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.2em] hover:opacity-80 transition-opacity"
                    >
                      Audit History
                    </button>
                  </div>
                  <div className="space-y-2">
                    {transactions.slice(0, 3).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-2 hover:bg-brand-bg/50 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 bg-brand-bg rounded-lg flex items-center justify-center text-brand-primary/40 text-[10px]">
                              {getCategoryIcon(t.category)}
                           </div>
                           <div>
                              <p className="text-xs font-bold text-brand-primary uppercase tracking-wide truncate max-w-[120px]">{t.description}</p>
                              <p className="text-[8px] text-brand-primary/30 font-bold uppercase">{t.category}</p>
                           </div>
                        </div>
                        <p className={cn(
                          "text-sm font-mono font-bold",
                          t.type === 'income' ? "text-brand-accent" : "text-brand-primary"
                        )}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                      </div>
                    ))}
                    {transactions.length === 0 && (
                      <p className="text-center py-4 text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest">Ledger Clear</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 md:space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h2 className="section-header">Ledger</h2>
                <p className="data-label">Comprehensive history of your money movement</p>
              </div>
            </div>

              <div className="bg-brand-surface rounded-[2rem] border border-brand-border shadow-sm overflow-hidden grid grid-cols-3 divide-x divide-brand-border font-mono relative">
                <div className="p-5 md:p-8 text-center space-y-2">
                  <p className="data-label">Total Spent</p>
                  <p className="text-xl md:text-2xl font-bold text-brand-primary tabular-nums">{formatCurrency(historySummary.spent)}</p>
                </div>
                <div className="p-5 md:p-8 text-center space-y-2">
                  <p className="data-label">Total Earned</p>
                  <p className="text-xl md:text-2xl font-bold text-brand-accent tabular-nums">{formatCurrency(historySummary.earned)}</p>
                </div>
                <div className="p-5 md:p-8 text-center space-y-2">
                  <p className="data-label">Net Flow</p>
                  <p className={cn(
                    "text-xl md:text-2xl font-bold tabular-nums",
                    historySummary.net >= 0 ? "text-brand-accent" : "text-rose-500"
                  )}>
                    {historySummary.net >= 0 ? '+' : ''}{formatCurrency(historySummary.net)}
                  </p>
                </div>
              </div>
              
              {transactions.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Category Distribution */}
                  <div className="bg-brand-surface border border-brand-border rounded-[2rem] p-6 space-y-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="data-label">Category Volume</p>
                      <div className="w-8 h-8 rounded-lg bg-brand-bg flex items-center justify-center text-brand-primary/20">
                        <PieChartIcon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={historyCategoryData.slice(0, 5)}>
                          <XAxis 
                            dataKey="name" 
                            hide 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1E1E1E', 
                              border: '1px solid #333', 
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontFamily: 'JetBrains Mono' 
                            }}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="var(--color-brand-primary)" 
                            radius={[6, 6, 0, 0]}
                            barSize={32}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       {historyCategoryData.slice(0, 4).map((item, idx) => (
                         <div key={item.name} className="flex flex-col gap-1">
                           <p className="text-[10px] font-bold text-brand-primary/40 uppercase truncate">{item.name}</p>
                           <p className="text-xs font-mono font-bold text-brand-primary leading-none">
                             {((item.value / (totalExpense || 1)) * 100).toFixed(0)}%
                           </p>
                         </div>
                       ))}
                    </div>
                  </div>

                  {/* Spending Velocity */}
                  <div className="bg-brand-surface border border-brand-border rounded-[2rem] p-6 space-y-6 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="flex items-center justify-between">
                      <p className="data-label">Spending Trends</p>
                      <div className="w-8 h-8 rounded-lg bg-brand-accent/5 flex items-center justify-center text-brand-accent/40">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyTrendData}>
                          <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-brand-accent)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--color-brand-accent)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="date" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 9, fill: 'var(--color-brand-primary)', opacity: 0.3 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1E1E1E', 
                              border: '1px solid #333', 
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontFamily: 'JetBrains Mono' 
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="amount" 
                            stroke="var(--color-brand-accent)" 
                            fillOpacity={1} 
                            fill="url(#colorAmount)" 
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                       <div className="space-y-1">
                         <p className="data-label !text-[8px]">Daily Spending</p>
                         <p className="text-sm font-bold text-brand-primary lowercase bg-brand-bg px-2 py-1 rounded-lg border border-brand-border">
                           {formatCurrency(historyTrendData[historyTrendData.length - 1]?.amount || 0)}/day
                         </p>
                       </div>
                       <div className="text-right space-y-1">
                         <p className="data-label !text-[8px]">Status</p>
                         <p className="text-xs font-mono font-bold text-brand-accent">
                           STEADY
                         </p>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="section-header">All Entries</h2>
                  <p className="data-label">Every transaction saved to Artha</p>
                </div>
                <div className="flex bg-brand-bg p-1.5 rounded-full border border-brand-border shadow-inner">
                  {['All', 'Expenses', 'Income'].map(f => (
                    <button 
                      key={f} 
                      onClick={() => setFilter(f as any)}
                      className={cn(
                        "px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                        filter === f ? "bg-brand-primary text-brand-surface shadow-lg" : "text-brand-primary/30 hover:text-brand-primary/60"
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
                  <motion.div variants={listItem} className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-brand-border/60" />
                    <h4 className="data-label !text-brand-primary/20">{date}</h4>
                    <div className="h-px flex-1 bg-brand-border/60" />
                  </motion.div>
                  <div className="space-y-3">
                    {items.map(t => (
                      <motion.div 
                        key={t.id} 
                        variants={listItem}
                        className="bg-brand-surface p-5 border border-brand-border rounded-[1.5rem] shadow-sm hover:shadow-xl transition-all flex items-center justify-between group overflow-hidden relative"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full transition-all group-hover:w-1.5"
                          style={{ backgroundColor: t.type === 'income' ? 'var(--color-brand-accent)' : 'transparent' }}
                        />
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-bg rounded-xl flex items-center justify-center text-brand-primary/30 group-hover:bg-brand-primary group-hover:text-brand-surface transition-all border border-brand-border/50">
                            {getCategoryIcon(t.category)}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-brand-primary uppercase tracking-tight leading-none">{t.description}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="data-label !text-[8.5px] !text-brand-primary/40">{t.category}</span>
                              {t.subcategory && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-brand-primary/10" />
                                  <span className="data-label !text-[8.5px] !text-brand-primary/20">{t.subcategory}</span>
                                </>
                              )}
                              <div className="flex items-center gap-1.5 ml-1">
                                {t.isMandatory && (
                                  <span className="px-1.5 py-0.5 bg-brand-primary/5 text-brand-primary/60 text-[8px] font-bold uppercase tracking-wider rounded border border-brand-primary/5 font-mono">FIXED</span>
                                )}
                                {t.isRecurring && (
                                  <span className="px-1.5 py-0.5 bg-brand-accent/5 text-brand-accent/60 text-[8px] font-bold uppercase tracking-wider rounded border border-brand-accent/5 font-mono">REC</span>
                                )}
                                {t.isAvoidable && (
                                  <span className="px-1.5 py-0.5 bg-rose-500/5 text-rose-500/60 text-[8px] font-bold uppercase tracking-wider rounded border border-rose-500/5 font-mono">AVOID</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div className="text-right flex flex-col items-end gap-0.5">
                            <p className={cn(
                              "text-lg md:text-xl font-mono font-bold tabular-nums leading-none",
                              t.type === 'income' ? "text-brand-accent" : "text-brand-primary"
                            )}>
                              {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                            </p>
                            <p className="text-[8px] font-bold text-brand-primary/10 uppercase tracking-widest leading-none">
                              {new Date(t.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteTransaction(t);
                            }}
                            className={cn(
                              "p-2.5 transition-all rounded-lg active:scale-90 border",
                              transactionIdToConfirmDelete === t.id 
                                ? "bg-rose-500 text-white border-rose-600 shadow-lg" 
                                : "text-rose-500/10 hover:text-rose-600 hover:bg-rose-500/10 border-transparent hover:border-rose-500/10"
                            )}
                            title="Purge Entry"
                          >
                            {transactionIdToConfirmDelete === t.id ? (
                              <span className="text-[8px] font-bold uppercase tracking-widest px-1 whitespace-nowrap">Purge</span>
                            ) : (
                              <Trash2 className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                            )}
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
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between px-1 gap-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1">Strategic Portfolio</h2>
                  <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-wider py-0.5">Asset Allocation Targets</p>
                </div>
                {goals.some(g => g.type === 'debt') && (
                  <button 
                    onClick={() => setActiveTab('insights')}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-accent/10 text-brand-accent rounded-xl border border-brand-accent/20 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-accent/20 transition-all shadow-sm group"
                  >
                    <Landmark className="w-4 h-4 transition-transform group-hover:scale-110" />
                    Debt Architect Active // View Strategy
                  </button>
                )}
              </div>

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
          </div>
        )}

        {activeTab === 'insights' && (
          <React.Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-primary"></div>
            </div>
          }>
            <div className="space-y-12">
              <div className="space-y-1">
                <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1">Intelligence Suite</h2>
                <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-wider py-0.5">Advanced Capital Optimization</p>
              </div>
              
              <div className="space-y-12">
                <StrategyInsights 
                  transactions={transactions} 
                  goals={goals} 
                  balance={balance}
                  totalIncome={totalIncome}
                  totalSavings={liquidAssets}
                  mandatoryExpenses={mandatoryExpenses}
                  discretionaryExpenses={discretionaryExpenses}
                  strategicSpendingCeiling={strategicSpendingCeiling}
                  dailySpendingPower={dailySpendingPower}
                  monthlyGoalCommitments={monthlyGoalCommitments}
                />
                
                <div className="pt-12 border-t border-brand-border">
                  <DebtOptimization goals={goals} />
                </div>

                {/* Tactical Deletion & Reset Protocol */}
                <div className="bg-brand-surface border border-rose-500/10 rounded-3xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-primary uppercase tracking-tight">System Purge</h4>
                      <p className="text-[10px] text-brand-primary/20 font-bold uppercase tracking-widest mt-1">Operational Reset // Warning</p>
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-brand-primary/50 leading-relaxed max-w-md">
                    This command initializes a total wipe of all financial dossiers, strategic targets, and capital history. This action is terminal and cannot be reversed.
                  </p>

                  <button 
                    onClick={async () => {
                      if (showTotalPurgeConfirm) {
                        try {
                          setIsPurging(true);
                          const tDocs = await getDocs(query(collection(db, 'transactions'), where('userId', '==', user.uid)));
                          const gDocs = await getDocs(query(collection(db, 'goals'), where('userId', '==', user.uid)));
                          const batch = [...tDocs.docs.map(d => deleteDoc(doc(db, 'transactions', d.id))), ...gDocs.docs.map(d => deleteDoc(doc(db, 'goals', d.id)))];
                          await Promise.all(batch);
                          localStorage.clear();
                          window.location.reload();
                        } catch (e) {
                          setIsPurging(false);
                          setShowTotalPurgeConfirm(false);
                        }
                      } else {
                        setShowTotalPurgeConfirm(true);
                        if (timeouts.current.purge) clearTimeout(timeouts.current.purge);
                        timeouts.current.purge = setTimeout(() => setShowTotalPurgeConfirm(false), 5000); 
                      }
                    }}
                    className={cn(
                      "w-full py-5 rounded-2xl font-bold text-[10px] uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-3",
                      showTotalPurgeConfirm 
                        ? "bg-rose-500 text-white shadow-[0_10px_30px_rgba(244,63,94,0.3)] animate-pulse" 
                        : "bg-brand-bg border border-rose-500/20 text-rose-500 hover:bg-rose-500/5"
                    )}
                  >
                    {isPurging ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : showTotalPurgeConfirm ? (
                      "Authorize Total Destruction"
                    ) : (
                      "Initialize Factory Reset"
                    )}
                  </button>
                </div>

                {/* Secure Node Access / Logout */}
                <div className="bg-brand-surface border border-brand-border rounded-3xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand-primary/5 flex items-center justify-center text-brand-primary/40 text-xs font-bold border border-brand-border">
                        {user.displayName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-brand-primary uppercase tracking-tight">{user.displayName}</h4>
                        <p className="text-[10px] text-brand-primary/20 font-bold uppercase tracking-widest font-mono mt-1">Authenticated Secure Node</p>
                      </div>
                    </div>
                    <button 
                      onClick={logout}
                      className="px-6 py-3 rounded-xl bg-brand-bg border border-brand-border text-brand-primary/40 hover:text-rose-500 hover:border-rose-500/20 text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                    >
                      Logout Protocol
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </React.Suspense>
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
            editingGoal={editingGoal}
            avgDailySpend={avgDailySpend}
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

function GoalItem({ goal, onEdit }: { goal: Goal, transactions: Transaction[], isDemo?: boolean, onEdit?: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-brand-surface p-5 border border-brand-border rounded-[1.5rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between h-full"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-bg rounded-full blur-[80px] -mr-16 -mt-16 opacity-30 group-hover:opacity-50 transition-all pointer-events-none" />
      
      <div className="space-y-4 relative z-10">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 cursor-pointer flex-1" onClick={onEdit}>
            <h4 className="text-sm font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight">{goal.name}</h4>
            <div className="flex flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5 bg-brand-bg/50 px-2 py-0.5 rounded-lg border border-brand-border">
                <span className="text-[7px] font-bold text-brand-primary/30 uppercase tracking-widest">Protocol</span>
                <span className="text-[10px] font-mono font-bold text-brand-primary">{formatCurrency(goal.targetAmount)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-brand-accent/5 px-2 py-0.5 rounded-lg border border-brand-accent/20">
                <span className="text-[7px] font-bold text-brand-accent uppercase tracking-widest">Secured</span>
                <span className="text-[10px] font-mono font-bold text-brand-accent">{formatCurrency(goal.currentAmount)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-mono font-bold text-brand-primary tabular-nums leading-none">{progress.toFixed(0)}%</p>
            <p className="text-[7px] font-bold text-brand-primary/30 uppercase tracking-widest mt-1">Status</p>
          </div>
        </div>

        <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden border border-brand-border p-[0.5px]">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-brand-primary rounded-full shadow-[0_0_8px_rgba(17,24,39,0.2)]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-brand-border/50 relative z-10">
        <div className="flex gap-4">
          <div className="space-y-0.5">
            <p className="text-[7px] font-bold text-brand-primary/20 uppercase tracking-widest">Type</p>
            <p className="text-[9px] font-bold text-brand-primary uppercase truncate max-w-[80px]">{goal.type}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[7px] font-bold text-brand-primary/20 uppercase tracking-widest">Target</p>
            <p className="text-[9px] font-mono font-bold text-brand-primary">
              {goal.deadline ? new Date(goal.deadline).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).toUpperCase() : 'N/A'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="p-1.5 bg-brand-primary/5 hover:bg-brand-primary hover:text-brand-surface rounded-lg transition-all border border-brand-border group/edit"
          >
            <Target className="w-3.5 h-3.5" />
          </button>
          
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isDeleting) {
                try {
                  await deleteDoc(doc(db, 'goals', goal.id!));
                } catch (err) {
                  handleFirestoreError(err, OperationType.DELETE, 'goals');
                }
              } else {
                setIsDeleting(true);
                setTimeout(() => setIsDeleting(false), 3000);
              }
            }}
            className={cn(
              "p-1.5 rounded-lg border transition-all h-8 flex items-center justify-center",
              isDeleting 
                ? "bg-rose-500 text-white border-rose-600 px-3 w-auto" 
                : "text-rose-500/20 hover:text-rose-600 hover:bg-rose-500/10 border-transparent"
            )}
          >
            {isDeleting ? (
              <span className="text-[7px] font-bold uppercase tracking-widest">Confirm</span>
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const EXPENSE_CATEGORIES = {
  'Dining & Delivery': ['Swiggy', 'Zomato', 'Restaurants', 'Cafes', 'Fine Dining'],
  'Groceries & Q-Commerce': ['Blinkit', 'Instamart', 'Zepto', 'BigBasket', 'Local Grocery'],
  'Shopping & Lifestyle': ['Myntra', 'Ajio', 'Nykaa', 'Tira', 'Zara', 'H&M', 'Amazon', 'Flipkart', 'Lifestyle'],
  'Transport & Commute': ['Uber', 'Ola', 'Rapido', 'Fuel', 'Public Transport', 'Vehicle Service'],
  'Bills & Utilities': ['Electricity', 'Gas', 'Water', 'Internet', 'Mobile Recharge', 'DTH'],
  'Housing': ['Rent', 'Maintenance', 'Home Decor', 'Domestic Help', 'Property Tax'],
  'Health & Wellness': ['Medical/Doctors', 'Pharmacy', 'Gym/Fitness', 'Insurance'],
  'Travel & Stays': ['Flights', 'Trains', 'Hotels/Airbnb', 'Vacation'],
  'Entertainment': ['Netflix/Hotstar', 'Movies', 'Gaming', 'Events'],
  'Investments & EMI': ['SIP/Mutual Funds', 'Stocks', 'Gold', 'EMI/Loan'],
  'Other': ['Gifts', 'Donations', 'Misc']
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
  editingGoal,
  avgDailySpend
}: { 
  onClose: () => void, 
  userId: string, 
  transactions: Transaction[], 
  goals: Goal[],
  initialTab: 'transaction' | 'goal',
  editingGoal: Goal | null,
  avgDailySpend: number
}) {
  const [activeTab, setActiveTab] = useState<'transaction' | 'goal'>(editingGoal ? 'goal' : initialTab);

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-brand-primary/80 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-brand-surface w-full max-w-2xl rounded-t-[4rem] md:rounded-[4rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,0.8)] overflow-hidden border-x border-t md:border border-white/10 flex flex-col max-h-[95vh] relative"
      >
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-brand-primary/5 rounded-full md:hidden" />
        
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 md:p-4 flex flex-col min-h-0 space-y-3 md:space-y-4">
            {/* Unified Header */}
            <div className="flex justify-between items-center bg-brand-bg/20 p-2 md:p-3 rounded-xl border border-brand-border/30 relative overflow-hidden group/header">
              <div className="absolute top-0 right-0 w-20 h-20 bg-brand-accent/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover/header:bg-brand-accent/10 transition-all" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-brand-surface shadow-lg transform hover:rotate-6 transition-all duration-500">
                  {activeTab === 'transaction' ? <Plus className="w-4 h-4 text-brand-accent" /> : <Target className="w-4 h-4 text-brand-accent" />}
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-[11px] font-bold text-brand-primary uppercase tracking-widest leading-none">
                    {activeTab === 'transaction' ? 'Quick Add' : 'Financial Goals'}
                  </h3>
                  <p className="text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-[0.25em] leading-none">
                    Update your ledger
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-surface border border-brand-border text-brand-primary/20 hover:text-rose-500 hover:border-rose-500/20 hover:bg-rose-500/5 transition-all active:scale-90"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {activeTab === 'transaction' && (
                <TransactionForm onClose={onClose} userId={userId} transactions={transactions} goals={goals} />
              )}
              {activeTab === 'goal' && (
                <GoalModalContent onClose={onClose} userId={userId} goal={editingGoal} />
              )}
            </div>

            {/* Unified Navigation at bottom of flex container */}
            <div className="pt-2 border-t border-brand-primary/5">
              <div className="flex gap-1.5 pb-1">
                {[
                  { id: 'transaction', label: 'ENTRY', icon: Plus },
                  { id: 'goal', label: 'PORTFOLIO', icon: Target },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={cn(
                      "flex-1 py-2 px-1 rounded-lg border transition-all flex flex-col items-center gap-1.5 relative overflow-hidden group/tab",
                      activeTab === t.id 
                        ? "bg-brand-primary border-brand-primary text-brand-surface shadow-lg z-10 font-bold" 
                        : "bg-brand-bg/50 border-brand-border text-brand-primary/40"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl -mr-8 -mt-8 transition-all group-hover/tab:scale-150",
                      activeTab === t.id ? "bg-brand-accent/20" : "bg-transparent"
                    )} />
                    <t.icon className={cn("w-4 h-4 relative z-10", activeTab === t.id ? "text-brand-accent" : "text-brand-primary/20")} />
                    <p className="text-[8.5px] font-mono uppercase tracking-widest relative z-10 leading-none">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TransactionForm({ onClose, userId, transactions, goals }: { onClose: () => void, userId: string, transactions: Transaction[], goals: Goal[] }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Dining & Delivery');
  const [subcategory, setSubcategory] = useState('Swiggy');
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
    'Investments & EMI': 'investment',
    'Investments': 'investment',
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
    setCategory(template.category);
    setAmount(template.lastAmount.toString());
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    const finalDescription = subcategory.toUpperCase();
    if (isNaN(amountNum) || amountNum <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      let linkedGoalId = null;
      if (type === 'expense') {
        const goalType = goalTypeMap[category];
        const gQuery = query(collection(db, 'goals'), where('userId', '==', userId));
        const gSnapshot = await getDocs(gQuery);
        
        const goalDoc = gSnapshot.docs.find(d => {
          const gData = d.data();
          const nameMatch = finalDescription.toLowerCase().includes(gData.name.toLowerCase()) ||
                           gData.name.toLowerCase().includes(finalDescription.toLowerCase());
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
        description: finalDescription,
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
    <form onSubmit={handleSubmit} className="space-y-6 pb-8 px-1">
      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-rose-500/10 border-l-2 border-rose-500 p-3 rounded-r-lg"
        >
          <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-rose-500">Constraint Breach</p>
          <p className="text-[10px] font-bold text-rose-600 mt-1">{errorMsg}</p>
        </motion.div>
      )}
      
      {smartTemplates.length > 0 && (
        <div className="space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/30 pl-1">Historical Alignment</label>
          <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
            {smartTemplates.slice(0, 5).map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTemplate(t)}
                className="flex-shrink-0 px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg text-[9px] font-mono font-bold text-brand-primary/50 hover:bg-brand-primary hover:text-brand-surface transition-all active:scale-95"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-brand-bg/80 p-1.5 rounded-xl border border-brand-border shadow-inner flex relative">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              const currentCats = t === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
              const firstCat = Object.keys(currentCats)[0];
              const firstSub = (currentCats as any)[firstCat][0];
              setCategory(firstCat);
              setSubcategory(firstSub);
            }}
            className={cn(
              "flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 relative z-10",
              type === t 
                ? "bg-brand-primary text-brand-surface shadow-md" 
                : "text-brand-primary/30 hover:text-brand-primary/60 hover:bg-brand-primary/5"
            )}
          >
            {t === 'income' ? <TrendingUp className="w-3 h-3 text-brand-accent" /> : <TrendingDown className="w-3 h-3 text-rose-400" />}
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="group/input space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-brand-primary/10 group-focus-within/input:text-brand-accent transition-colors text-base">₹</span>
            <input 
              autoFocus
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 pl-8 pr-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Category</label>
          <div className="grid grid-cols-2 gap-3 pb-1">
            <div className="relative group/select">
               <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 bg-brand-bg/30 border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:bg-brand-surface transition-all"
              >
                {Object.keys(currentCategories).map(cat => (
                  <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary/20">
                <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>
            <div className="relative group/select">
              <select 
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full h-10 bg-brand-bg/30 border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary/40 outline-none appearance-none cursor-pointer focus:bg-brand-surface transition-all"
              >
                {(currentCategories as any)[category]?.map((sub: string) => (
                  <option key={sub} value={sub}>{sub.toUpperCase()}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary/10">
                <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {type === 'expense' && (
        <div className="space-y-2.5">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/20 pl-1">Scalars</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'mandatory', label: 'ESSENTIAL', state: isMandatory, set: setIsMandatory, icon: ShieldCheck, color: 'text-brand-accent' },
              { id: 'recurring', label: 'FIXED', state: isRecurring, set: setIsRecurring, icon: Activity, color: 'text-brand-accent' },
              { id: 'avoidable', label: 'LEAK', state: isAvoidable, set: setIsAvoidable, icon: AlertCircle, color: 'text-rose-400' },
            ].map((attr) => (
              <button
                key={attr.id}
                type="button"
                onClick={() => attr.set(!attr.state)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border transition-all active:scale-95 group/scalar",
                  attr.state 
                    ? "bg-brand-primary text-brand-surface border-brand-primary shadow-md" 
                    : "bg-brand-surface border-brand-border text-brand-primary/30"
                )}
              >
                <attr.icon className={cn("w-3 h-3 transition-colors", attr.state ? attr.color : "text-brand-primary/10")} />
                <span className="text-[7px] font-bold uppercase tracking-widest">{attr.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 bg-brand-primary text-brand-surface rounded-lg font-bold text-[9px] uppercase tracking-[0.4em] shadow-lg active:scale-[0.98] transition-all border border-white/10 hover:bg-brand-primary/95"
      >
        {isSubmitting ? 'PROCESSING...' : `AUTHORIZE ${type === 'expense' ? 'OUTFLOW' : 'INFLOW'} PROTOCOL`}
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

  const templates = [
    { name: 'Home Loan Protocol', target: 5000000, type: 'debt' as GoalType },
    { name: 'Emergency Fund', target: 500000, type: 'savings' as GoalType },
    { name: 'Growth Seed', target: 1000000, type: 'investment' as GoalType },
    { name: 'Global Travel', target: 400000, type: 'lifestyle' as GoalType }
  ];

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
      setTimeout(() => setShowConfirmDelete(false), 4000);
      return;
    }
    setIsSubmitting(true);
    try {
      // QA FIX: Before deleting goal, find any transactions linked to it and decouple them
      const q = query(collection(db, 'transactions'), where('linkedGoalId', '==', goal.id));
      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map(d => updateDoc(doc(db, 'transactions', d.id), {
        linkedGoalId: null
      }));
      await Promise.all(updates);
      
      await deleteDoc(doc(db, 'goals', goal.id));
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'goals');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8 px-1">
      {!goal && (
        <div className="space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Templates</label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {templates.map(tmp => (
              <button 
                key={tmp.name}
                type="button"
                onClick={() => {
                  setName(tmp.name);
                  setTargetAmount(tmp.target.toString());
                  setType(tmp.type);
                }}
                className="flex-shrink-0 px-4 py-3 rounded-xl border border-brand-border bg-brand-bg/50 hover:border-brand-accent/40 hover:bg-brand-surface transition-all text-left min-w-[140px] group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-[7px] font-mono font-bold uppercase tracking-widest rounded">{tmp.type}</div>
                  <Target className="w-2.5 h-2.5 text-brand-primary/10 group-hover:text-brand-accent transition-colors" />
                </div>
                <p className="text-[10px] font-bold text-brand-primary uppercase tracking-tight mb-1">{tmp.name}</p>
                <p className="text-[8px] font-mono text-brand-primary/30 font-bold">₹{(tmp.target/1000).toFixed(0)}K TARGET</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Entity Identity</label>
          <input 
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. MISSION ALPHA"
            className="w-full bg-brand-surface border border-brand-border rounded-lg py-2 px-4 text-base font-bold uppercase tracking-tight text-brand-primary outline-none focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all text-center placeholder:text-brand-primary/5"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Capital Target</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-brand-primary/10 group-focus-within/input:text-brand-accent transition-colors text-xs">₹</span>
              <input 
                required
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 pl-8 pr-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Current Balance</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-brand-primary/10 group-focus-within/input:text-brand-accent transition-colors text-xs">₹</span>
              <input 
                type="number"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 pl-8 pr-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Protocol Type</label>
            <div className="relative group">
              <select 
                value={type}
                onChange={(e) => setType(e.target.value as GoalType)}
                className="w-full h-10 bg-brand-surface border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-brand-accent/5 transition-all text-center"
              >
                <option value="savings">SAVINGS_CORE</option>
                <option value="investment">GROWTH_ASSET</option>
                <option value="debt">DEBT_LIQUIDATION</option>
                <option value="lifestyle">LIFESTYLE_BURN</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary/20">
                <ChevronRight className="w-3 h-3 rotate-90" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Operational Priority</label>
            <div className="relative group">
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full h-10 bg-brand-surface border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-brand-accent/5 transition-all text-center"
              >
                <option value="high">SYSTEM_CRITICAL</option>
                <option value="medium">STANDARD_OPS</option>
                <option value="low">TRIVIAL_FLOAT</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary/20">
                <ChevronRight className="w-3 h-3 rotate-90" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {errorMsg && (
          <p className="text-[8px] font-mono font-bold text-rose-500 text-center animate-pulse">{errorMsg}</p>
        )}
        <button 
          type="submit"
          disabled={isSubmitting}
          className="w-full py-5 bg-brand-primary text-brand-surface rounded-xl font-bold text-[10px] uppercase tracking-[0.4em] shadow-lg active:scale-[0.98] transition-all border border-white/10"
        >
          {isSubmitting ? 'SECURE_COMMIT_PENDING' : goal ? 'Authorize Strategic Modification' : 'Initialize Portfolio Target'}
        </button>

        {goal && (
          <button 
            type="button"
            onClick={handleDelete}
            className={cn(
              "w-full py-3 rounded-lg text-[9px] font-mono font-bold uppercase tracking-widest transition-all",
              showConfirmDelete ? "bg-rose-500 text-white animate-pulse" : "bg-rose-500/5 text-rose-500 hover:bg-rose-500/10"
            )}
          >
            {showConfirmDelete ? 'Confirm Resignation' : 'Decommission Goal'}
          </button>
        )}
      </div>
    </form>
  );
}

