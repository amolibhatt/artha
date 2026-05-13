import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, orderBy, limit, getDocFromServer, doc, updateDoc, increment, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db, signIn, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { Transaction, Goal, GoalType, StressTestState, SIP, IncomeStream, TransactionType } from './types';
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
  RefreshCcw,
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
  Film,
  Search,
  LayoutGrid,
  Database,
  History as HistoryIcon
} from 'lucide-react';
import { 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  YAxis,
  XAxis,
  BarChart,
  Bar,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { generateQuickInsights } from './services/aiService';
import { useFinancialEngine } from './hooks/useFinancialEngine';

// Lazy load heavy analytical components
const StrategyInsights = React.lazy(() => import('./components/StrategyInsights').then(m => ({ default: m.StrategyInsights })));
const DebtOptimization = React.lazy(() => import('./components/DebtOptimization').then(m => ({ default: m.DebtOptimization })));
const StressTestConsole = React.lazy(() => import('./components/StressTestConsole').then(m => ({ default: m.StressTestConsole })));

const getContributionDelta = (amount: number, type: TransactionType, category: string, isForcedLink: boolean = false) => {
  if (isForcedLink) return amount;
  if (type === 'income') return amount;
  if (type === 'expense') {
    const contributionCategories = ['Debt Repayment', 'Investments', 'Savings', 'Investments & EMI', 'Loan Repayment', 'Strategic Savings'];
    if (contributionCategories.includes(category)) {
      return amount;
    }
  }
  if (type === 'refund') return -amount;
  return 0;
};

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
                Something went wrong. Your data is safe, but the app needs a restart.
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
              Restart App
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
  const [goalsSubTab, setGoalsSubTab] = useState<'strategy' | 'mandates'>('strategy');
  const [showBudgetAlert, setShowBudgetAlert] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sips, setSips] = useState<SIP[]>([]);
  const [incomeStreams, setIncomeStreams] = useState<IncomeStream[]>([]);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [commandTab, setCommandTab] = useState<'transaction' | 'goal' | 'sip' | 'income'>('transaction');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingSip, setEditingSip] = useState<SIP | null>(null);
  const [editingIncomeStream, setEditingIncomeStream] = useState<IncomeStream | null>(null);
  const [showMobileTip, setShowMobileTip] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Expenses' | 'Income'>('All');
  const [searchQuery, setSearchQuery] = useState('');
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
        if (t.linkedGoalId) {
          // Revert any contribution this transaction made to a goal
          const delta = getContributionDelta(t.amount, t.type, t.category, true);
          await updateDoc(doc(db, 'goals', t.linkedGoalId), {
            currentAmount: increment(-delta)
          });
        }
        await deleteDoc(doc(db, 'transactions', t.id));
        setTransactionIdToConfirmDelete(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'transactions');
      }
    } else {
      setTransactionIdToConfirmDelete(t.id);
      if (timeouts.current.delete) clearTimeout(timeouts.current.delete);
      timeouts.current.delete = setTimeout(() => setTransactionIdToConfirmDelete(null), 4000);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      // Before deleting goal, find any transactions linked to it and decouple them
      const q = query(collection(db, 'transactions'), where('linkedGoalId', '==', goalId));
      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map(d => updateDoc(doc(db, 'transactions', d.id), {
        linkedGoalId: null
      }));
      await Promise.all(updates);
      await deleteDoc(doc(db, 'goals', goalId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `goals/${goalId}`);
      throw error;
    }
  };

  const handleDeleteSIP = async (sipId: string) => {
    try {
      await deleteDoc(doc(db, 'sips', sipId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sips/${sipId}`);
      throw error;
    }
  };

  const handleDeleteIncomeStream = async (streamId: string) => {
    try {
      await deleteDoc(doc(db, 'incomeStreams', streamId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `incomeStreams/${streamId}`);
      throw error;
    }
  };

  useEffect(() => {
    localStorage.setItem('stressTest', JSON.stringify(stressTest));
  }, [stressTest]);
  const [showStressTest, setShowStressTest] = useState(false);
  const [streakCount, setStreakCount] = useState(() => {
    const val = localStorage.getItem('streakCount');
    return (val && !isNaN(Number(val))) ? Number(val) : 0;
  });
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
      if (user) {
        // Reset local streak if different user? 
        // For simplicity, we just clear it from memory but per-user storage is ideal
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        // Attempt to connect to a collection that exists in the rules
        await getDocFromServer(doc(db, 'users', 'ping'));
      } catch (error: any) {
        // We expect PERMISSION_DENIED if we are not signed in, which is fine
        // We only care if it's a connectivity error
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
          console.warn("Firestore connectivity warning: Client appears to be offline or blocked.");
        } else {
          // Connection is alive if we get a permission error or similar
          console.log("Firestore connection verified.");
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

    const sQuery = query(
      collection(db, 'sips'),
      where('userId', '==', user.uid)
    );

    const unsubscribeS = onSnapshot(sQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SIP));
      setSips(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sips'));

    const iQuery = query(
      collection(db, 'incomeStreams'),
      where('userId', '==', user.uid)
    );

    const unsubscribeI = onSnapshot(iQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomeStream));
      setIncomeStreams(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'incomeStreams'));

    return () => {
      unsubscribeT();
      unsubscribeG();
      unsubscribeS();
      unsubscribeI();
    };
  }, [user]);

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
    estimatedFixedCosts,
    strategicSpendingCeiling,
    dailySpendingPower,
    monthlyGoalCommitments,
    sipMandates,
    estimatedMonthlyIncome,
    savingsRate,
    incomeCoverage
  } = useFinancialEngine(transactions, goals, 0, stressTest, sips, incomeStreams);

  // Allocation Hierarchy - Phase-wise sequence (Stabilization -> Acceleration -> Optimization)
  const stabilizationAllocValue = estimatedFixedCosts + goals.filter(g => g.type === 'debt' || g.name.toLowerCase().includes('emergency')).reduce((acc, g) => {
    if (g.currentAmount >= g.targetAmount) return acc;
    return acc + (g.emi || g.monthlyContribution || (g.targetAmount * 0.05));
  }, 0);

  const accelerationAllocValue = Math.max(0, (monthlyGoalCommitments + sipMandates) - (stabilizationAllocValue - estimatedFixedCosts));
  const optimizationAllocValue = strategicSpendingCeiling;

  const [insights, setInsights] = useState<string[]>([]);
  useEffect(() => {
    if (user && transactions.length > 5 && goals.length > 0) {
      const fetchInsights = async () => {
        try {
          const data = await generateQuickInsights(transactions, goals, savingsRate, incomeCoverage);
          setInsights(data);
        } catch (e) {
          console.error("Context-Aware Insight Failure:", e);
        }
      };
      fetchInsights();
    }
  }, [user, transactions.length, goals.length, savingsRate, incomeCoverage]);

  // QA Logic: McKinsey-level strategic thresholds
  const healthStatus = runwayMonths >= 6 ? 'STABILIZED' : runwayMonths >= 3 ? 'WARNING' : 'CRITICAL';
  const currentPhase = healthStatus === 'STABILIZED' 
    ? (goals.some(g => g.currentAmount >= g.targetAmount) ? 'OPTIMIZATION' : 'ACCELERATION') 
    : 'STABILIZATION';

  // Predictive Analytics - Stress Test Synchronized
  const projectedMonthlySpend = (spentThisMonth + (avgDailySpend * remainingDays)) * stressTest.expenseShock;
  const projectedSavings = Math.max(0, (estimatedMonthlyIncome * stressTest.incomeShock) - projectedMonthlySpend);
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
    else if (t.type === 'expense') acc.spent += t.amount;
    else if (t.type === 'refund') acc.spent -= t.amount;
    acc.net = acc.earned - acc.spent;
    return acc;
  }, { spent: 0, earned: 0, net: 0 });

  const historyCategoryData = transactions
    .filter(t => t.type === 'expense' || t.type === 'refund')
    .reduce((acc: any[], t) => {
      const existing = acc.find(i => i.name === t.category);
      const val = t.type === 'expense' ? t.amount : -t.amount;
      if (existing) {
        existing.value += val;
      } else {
        acc.push({ name: t.category, value: val });
      }
      return acc;
    }, [])
    .map(i => ({ ...i, value: Math.max(0, i.value) })) // Don't show negative categories
    .filter(i => i.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalExpense = historyCategoryData.reduce((acc, i) => acc + i.value, 0);

  const historyTrendData = [...transactions]
    .filter(t => t.type === 'expense' || t.type === 'refund')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc: any[], t) => {
      const date = new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const existing = acc.find(i => i.date === date);
      const val = t.type === 'expense' ? t.amount : -t.amount;
      if (existing) {
        existing.amount += val;
      } else {
        acc.push({ date, dateValue: t.date, amount: val });
      }
      return acc;
    }, [])
    .slice(-10); // Show last 10 days of activity

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'Expenses' && t.type === 'income') return false;
    if (filter === 'Income' && t.type !== 'income') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return t.description.toLowerCase().includes(q) || 
             t.category.toLowerCase().includes(q) || 
             (t.subcategory || '').toLowerCase().includes(q);
    }
    return true;
  });

  const groupedTransactions = filteredTransactions
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
    if (cat.includes('subscriptions') || cat.includes('netflix') || cat.includes('hotstar')) return <Film className="w-5 h-5 text-purple-400/70" />;
    if (cat.includes('invest') || cat.includes('emi') || cat.includes('stock')) return <TrendingUp className="w-5 h-5 text-brand-accent" />;
    return <List className="w-5 h-5 text-brand-primary/40" />;
  };

  const totalLiquidReserves = goals
    .filter(g => g.type === 'savings' || g.type === 'investment')
    .reduce((acc, g) => acc + g.currentAmount, 0);
  const totalDebtPaid = goals
    .filter(g => g.type === 'debt')
    .reduce((acc, g) => acc + g.currentAmount, 0);
  
  const monthlyFixedExpenses = Math.max(0, transactions
    .filter(t => (t.type === 'expense' || t.type === 'refund') && t.isMandatory)
    .reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0));
  
  const monthlySurplus = Math.max(0, estimatedMonthlyIncome - monthlyFixedExpenses - monthlyGoalCommitments);
  
  const surplusAdvice = (() => {
    const highInterestDebt = goals.find(g => g.type === 'debt' && (g.interestRate || 0) > 10.5);
    const lowInterestLumpSum = goals.find(g => g.type === 'debt' && (g.interestRate || 0) < 9);
    
    if (highInterestDebt && (estimatedMonthlyIncome - monthlyBurn) > 10000) {
      return {
        target: highInterestDebt.name,
        action: `Aggressive deleveraging required. Direct ${formatCurrency(monthlySurplus)} here.`,
        impact: `Capital efficiency will increase by ${((highInterestDebt.interestRate || 0) - 4).toFixed(1)}% vs market yield.`
      };
    }
    
    const stagnantWealthGoal = goals.find(g => g.type === 'investment' && (g.currentAmount / (g.targetAmount || 1)) < 0.1);
    if (stagnantWealthGoal && monthlySurplus > 5000) {
      return {
        target: stagnantWealthGoal.name,
        action: "Capital injection recommended for project acceleration.",
        impact: `Target completion moves forward by ${Math.floor(stagnantWealthGoal.targetAmount / monthlySurplus / 12)} quarters.`
      };
    }

    if (savingsRate > 40) {
      return {
        target: "Venture / High-Yield",
        action: "Risk threshold exceeded. Consider diversifying into aggressive assets.",
        impact: "Alpha generation potential identified in surplus reserves."
      };
    }

    return {
      target: "Cash Reserve",
      action: "Maintain liquidity. Monitor for upcoming acquisition opportunities.",
      impact: "Current operational runway is stable."
    };
  })();

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
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
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
            <p className="text-brand-accent data-label mt-2">Personal Finance Assistant</p>
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
              {isSigningIn ? 'Loading...' : 'Log In'}
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
              Smart, simple money management to help you save more.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-primary font-sans flex flex-col overflow-x-hidden pb-24 md:pb-32">
      
      {/* Strategic Command Bar (Top) */}
      <header className="sticky top-0 z-40 bg-brand-bg/80 backdrop-blur-3xl border-b border-brand-border/50 transition-all duration-500">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-4 md:px-10">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="relative">
              <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center p-1.5 transition-all duration-500 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.1)]">
                <Terminal className="w-full h-full text-brand-accent transition-transform group-hover:rotate-6" />
              </div>
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-accent rounded-full border-2 border-brand-bg animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-display font-black uppercase tracking-tight text-brand-primary leading-none">ARTHA</span>
              <span className="terminal-text !text-[7px]">SYSTEM_V3.0_LIVE</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-10">
            <div className="flex flex-col items-end">
              <p className="terminal-text !text-brand-primary/20">Operational Pulse</p>
              <div className="flex items-center gap-2 text-brand-accent font-mono font-bold text-[10px]">
                <Activity className="w-3 h-3 animate-pulse" />
                <span className="uppercase tracking-widest">Normal Velocity</span>
              </div>
            </div>
            <div className="h-6 w-[1px] bg-brand-border" />
            <div className="flex flex-col items-end">
              <p className="terminal-text !text-brand-primary/20">Capital Phase</p>
              <div className="px-3 py-0.5 bg-brand-primary/5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-brand-primary/10 mt-0.5">
                {currentPhase}
              </div>
            </div>
            <button 
              onClick={() => logout()}
              className="p-2 text-brand-primary/20 hover:text-rose-500 transition-colors"
              title="Terminate Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="lg:hidden flex items-center gap-4">
             <div className="flex flex-col items-end">
                <p className="terminal-text !text-[7px]">Pulse</p>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
             </div>
          </div>
        </div>
      </header>

      {/* Bottom Navigation - Tactical Switcher */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-brand-surface/80 backdrop-blur-3xl border-t border-brand-border px-6 pb-safe">
        <div className="max-w-xl mx-auto flex items-center justify-between h-20">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full transition-all relative group",
              activeTab === 'home' ? "text-brand-primary" : "text-brand-primary/20"
            )}
            title="Dashboard"
          >
            <Home className={cn("w-6 h-6 transition-all duration-500", activeTab === 'home' ? "scale-110 drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]" : "group-hover:text-brand-primary/40")} />
            {activeTab === 'home' && (
              <motion.div layoutId="nav-indicator" className="absolute bottom-3 w-1 h-1 bg-brand-primary rounded-full transition-all" />
            )}
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full transition-all relative group",
              activeTab === 'history' ? "text-brand-primary" : "text-brand-primary/20"
            )}
            title="Cash Flow"
          >
            <List className={cn("w-6 h-6 transition-all duration-500", activeTab === 'history' ? "scale-110 drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]" : "group-hover:text-brand-primary/40")} />
            {activeTab === 'history' && (
              <motion.div layoutId="nav-indicator" className="absolute bottom-3 w-1 h-1 bg-brand-primary rounded-full transition-all" />
            )}
          </button>
          
          {/* Central Execution Hub */}
          <div className="flex-1 flex justify-center -mt-8 relative">
            <button 
              onClick={() => {
                setCommandTab('transaction');
                setShowCommandCenter(true);
              }}
              className="w-14 h-14 bg-brand-primary text-brand-surface rounded-[1.25rem] flex items-center justify-center shadow-2xl active:scale-95 transition-all relative z-10 border border-white/5 group/hub"
              title="Add Entry"
            >
              <Plus className="w-8 h-8 text-brand-accent transition-transform duration-500 group-hover/hub:rotate-90" />
            </button>
          </div>
 
          <button 
            onClick={() => setActiveTab('insights')}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full transition-all relative group",
              activeTab === 'insights' ? "text-brand-primary" : "text-brand-primary/20"
            )}
            title="Insights"
          >
            <Sparkles className={cn("w-6 h-6 transition-all duration-500", activeTab === 'insights' ? "scale-110 drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]" : "group-hover:text-brand-primary/40")} />
            {activeTab === 'insights' && (
              <motion.div layoutId="nav-indicator" className="absolute bottom-3 w-1 h-1 bg-brand-primary rounded-full transition-all" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('goals')}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full transition-all relative group",
              activeTab === 'goals' ? "text-brand-primary" : "text-brand-primary/20"
            )}
            title="Strategy"
          >
            <Target className={cn("w-6 h-6 transition-all duration-500", activeTab === 'goals' ? "scale-110 drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]" : "group-hover:text-brand-primary/40")} />
            {activeTab === 'goals' && (
              <motion.div layoutId="nav-indicator" className="absolute bottom-3 w-1 h-1 bg-brand-primary rounded-full transition-all" />
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-12 space-y-8 md:space-y-12">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-12"
            >
              {/* Contextual Executive Greeting */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 px-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-0.5 rounded-md bg-brand-primary text-brand-accent text-[8px] font-mono font-bold">MODE: COMMAND</div>
                    <div className="h-px w-8 bg-brand-border" />
                    <span className="terminal-text">PORTFOLIO_SYNC_COMPLETED</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-display font-black text-brand-primary tracking-tight leading-none">
                    EXECUTIVE SUMMARY
                  </h1>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 md:gap-10 pb-1">
                  <div className="flex flex-col items-start md:items-end group cursor-help">
                    <p className="terminal-text !text-brand-primary/20 group-hover:text-brand-primary/40 transition-colors">Operational Runway</p>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                      <p className="text-2xl font-mono font-bold text-brand-primary tracking-tighter">
                        {runwayMonths.toFixed(1)}<span className="text-[10px] font-medium text-brand-primary/40 ml-1 uppercase">Months</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="hidden md:block h-8 w-px bg-brand-border/60" />
                  
                  <div className="flex flex-col items-start md:items-end group cursor-help">
                    <p className="terminal-text !text-brand-primary/20 group-hover:text-brand-primary/40 transition-colors">Net Reserve Surplus</p>
                    <p className="text-2xl font-mono font-bold text-brand-accent tracking-tighter">
                      {formatCurrency(monthlySurplus)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Central Intelligence Layer (Hero) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4">
                <section className="lg:col-span-8 bg-brand-primary text-brand-surface rounded-[3rem] p-8 md:p-14 relative overflow-hidden shadow-2xl border border-white/5 group">
                  <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-brand-accent/10 transition-all duration-1000" />
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }} />
                  
                  <div className="relative z-10 space-y-12">
                    <div className="flex flex-col xl:flex-row justify-between items-start gap-12">
                      <div className="space-y-8 flex-1 w-full overflow-hidden">
                        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full shadow-inner">
                          <ShieldCheck className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
                          <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest">Capital Protection Active</span>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="terminal-text !text-white/30 !text-[11px] px-1">Freedom Deployment Limit</p>
                          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                            <h2 className="text-5xl md:text-7xl xl:text-8xl font-display font-black tracking-tighter text-white leading-none break-all">
                              {formatCurrency(Math.max(0, strategicSpendingCeiling - spentThisMonth))}
                            </h2>
                            <span className="text-brand-accent font-mono font-black text-xl md:text-2xl uppercase italic animate-pulse">Alpha</span>
                          </div>
                          <p className="text-base md:text-lg text-white/60 font-medium max-w-md leading-relaxed pt-2">
                            Validated <span className="text-white font-bold">Tactical Liquidity</span> available for growth deployment and high-signal acquisitions.
                          </p>
                        </div>
                      </div>

                      {/* Strategic Waterfall Map */}
                      <div className="w-full xl:w-80 space-y-8 bg-white/5 p-6 md:p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-md shrink-0">
                        <div className="space-y-1">
                          <p className="terminal-text !text-white/40">Capital Stack</p>
                          <p className="text-[9px] text-white/20 italic">Forced Priority Sequence</p>
                        </div>
                        
                        <div className="space-y-4">
                          {[
                            { label: 'Stabilize', amount: stabilizationAllocValue, color: 'bg-rose-500/30' },
                            { label: 'Accelerate', amount: accelerationAllocValue, color: 'bg-brand-accent/40' },
                            { label: 'Optimize', amount: optimizationAllocValue, color: 'bg-brand-accent' },
                          ].map((item, idx) => (
                            <div key={idx} className="space-y-2">
                              <div className="flex justify-between items-center text-[10px] font-bold text-white/50 uppercase tracking-tighter">
                                <span>0{idx+1}__{item.label}</span>
                                <span className="font-mono text-white/90">{formatCurrency(item.amount)}</span>
                              </div>
                              <div className="h-1 text-xs flex rounded-full bg-white/5 overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (item.amount / (estimatedMonthlyIncome || 1)) * 100)}%` }}
                                  className={cn("h-full transition-all duration-700", item.color)} 
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 pt-10 border-t border-white/10">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-rose-500" />
                          <p className="terminal-text !text-white/40 !text-[8px]">Operational_Burn</p>
                        </div>
                        <p className="text-2xl font-mono font-bold text-white tracking-tighter tabular-nums">
                          {formatCurrency(monthlyBurn)}<span className="text-[10px] font-normal text-white/20 ml-1">/mo</span>
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-brand-accent/50" />
                          <p className="terminal-text !text-white/40 !text-[8px]">Income_Yield</p>
                        </div>
                        <p className="text-2xl font-mono font-bold text-white tracking-tighter tabular-nums">
                          {formatCurrency(estimatedMonthlyIncome)}
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                          <p className="terminal-text !text-white/40 !text-[8px]">Safety_Margin</p>
                        </div>
                        <p className="text-2xl font-mono font-bold text-white tracking-tighter tabular-nums">
                          {(incomeCoverage * 10).toFixed(0)}% <span className="text-[10px] font-normal text-white/20 ml-1">VLT</span>
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-brand-accent" />
                          <p className="terminal-text !text-brand-accent !text-[8px]">Retention_Rate</p>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <p className="text-2xl font-mono font-bold text-brand-accent tracking-tighter tabular-nums">
                            {savingsRate.toFixed(1)}%
                          </p>
                          <TrendingUp className="w-3 h-3 text-brand-accent/40" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <aside className="lg:col-span-4 space-y-8">
                  {/* Tactical Pulse - Real-time Velocity */}
                  <div className="bento-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-[40px] -mr-16 -mt-16" />
                    <div className="space-y-8 relative z-10">
                      <div className="flex items-center justify-between">
                        <p className="terminal-text">Tactical Pulse</p>
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500",
                          dailyRemaining > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        )}>
                          <Zap className="w-5 h-5" />
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className={cn(
                          "text-5xl font-mono font-bold tracking-tighter leading-none tabular-nums",
                          dailyRemaining > 0 ? "text-brand-primary" : "text-rose-500"
                        )}>
                          {formatCurrency(dailyRemaining)}
                        </h3>
                        <p className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-[0.25em] px-1">Deployment Capacity (Today)</p>
                      </div>

                      <div className="pt-8 border-t border-brand-border">
                        <div className="flex justify-between items-center text-[10px] font-bold text-brand-primary/40 uppercase mb-4 px-1">
                          <span>Threshold Alpha</span>
                          <span>{formatCurrency(dailySpendingPower)}</span>
                        </div>
                        <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (spentToday / (dailySpendingPower || 1)) * 100)}%` }}
                            className={cn(
                              "h-full transition-all duration-700",
                              spentToday > dailySpendingPower ? "bg-rose-500" : "bg-brand-primary"
                            )} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Strategic Briefing (AI Insights) */}
                  <div className="bg-brand-primary text-brand-surface rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden shadow-xl min-h-[300px] flex flex-col justify-center">
                    <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 0.4px, transparent 0.4px)', backgroundSize: '8px 8px' }} />
                    <div className="space-y-6 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-brand-accent flex items-center justify-center text-brand-primary shadow-lg shadow-brand-accent/20">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <p className="terminal-text !text-brand-accent">CFO_ANALYSIS_V1.1</p>
                      </div>
                      
                      <div className="space-y-4">
                        <p className="text-xl font-display font-black leading-tight tracking-tight uppercase">
                          {insights[0] || "Strategic assessment completed. Optimal deployment windows identified."}
                        </p>
                        <div className="space-y-2">
                           <div className="h-px w-12 bg-brand-accent" />
                           <p className="text-sm text-white/50 leading-relaxed max-w-[280px]">
                             System has analyzed {transactions.length} records to identify alpha retention channels.
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>

              {/* Lower Intelligence Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-4">
                {/* Wealth Target Node */}
                <div className="bento-card col-span-1 md:col-span-2 group">
                   <div className="flex items-center justify-between mb-8 md:mb-12">
                      <div className="space-y-1">
                        <p className="terminal-text">Wealth Trajectory</p>
                        <h3 className="text-xl md:text-2xl font-display font-black text-brand-primary uppercase tracking-tight">Active Nodes</h3>
                      </div>
                      <Target className="w-6 h-6 text-brand-primary/20 group-hover:text-brand-accent transition-colors duration-500" />
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
                      <div className="space-y-6 md:space-y-8">
                        {goals.slice(0, 2).map((goal) => {
                          const progress = (goal.currentAmount / (goal.targetAmount || 1)) * 100;
                          return (
                            <div key={goal.id} className="space-y-2.5">
                              <div className="flex justify-between items-center text-[9px] font-bold text-brand-primary/40 uppercase tracking-widest px-1">
                                <span className="truncate max-w-[120px]">{goal.name}</span>
                                <span>{progress.toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-brand-bg rounded-full overflow-hidden p-[1px] border border-brand-border">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  className="h-full bg-brand-primary rounded-full transition-all duration-700" 
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-5 md:p-6 bg-brand-bg rounded-[2rem] border border-brand-border space-y-4">
                         <p className="terminal-text !text-[8px]">Collective Progress</p>
                         <h4 className="text-xl md:text-2xl font-mono font-bold tracking-tighter text-brand-primary">{totalGoalProgress.toFixed(1)}%</h4>
                         <div className="flex items-center gap-2 pt-2 border-t border-brand-border/50">
                            <TrendingUp className="w-3 h-3 text-brand-accent" />
                            <p className="text-[9px] font-bold text-brand-primary/40 uppercase tracking-widest leading-none">Net Goal Velocity +{streakCount}D</p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Liability Reduction Engine */}
                <div className="bento-card group relative overflow-hidden flex flex-col justify-between">
                   <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-[0.02] transition-opacity duration-700 pointer-events-none" />
                   <div className="space-y-6 md:space-y-8 w-full overflow-hidden">
                      <div className="flex items-center justify-between">
                        <p className="terminal-text">Liability Matrix</p>
                        <Landmark className="w-5 h-5 text-brand-primary/20" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-3xl md:text-4xl font-mono font-bold tracking-tighter text-brand-primary tabular-nums break-all">
                          {formatCurrency(goals.filter(g => g.type === 'debt').reduce((acc, curr) => acc + (curr.targetAmount - curr.currentAmount), 0))}
                        </p>
                        <p className="text-[9px] font-bold text-brand-primary/30 uppercase tracking-[0.25em] px-1">Outstanding Exposure</p>
                      </div>
                   </div>
                   <button 
                    onClick={() => setActiveTab('insights')}
                    className="w-full py-4 bg-brand-bg border border-brand-border rounded-xl text-[9px] font-bold text-brand-primary uppercase tracking-[0.3em] hover:bg-brand-primary hover:text-brand-surface hover:border-brand-primary transition-all duration-500 mt-8 md:mt-12"
                   >
                     Optimization Matrix
                   </button>
                </div>

                {/* Audit Signal Node */}
                <div className="bento-card group flex flex-col justify-between">
                   <div className="space-y-6 md:space-y-8 w-full overflow-hidden">
                      <div className="flex items-center justify-between">
                        <p className="terminal-text">Flow Snapshot</p>
                        <HistoryIcon className="w-5 h-5 text-brand-primary/20" />
                      </div>
                      <div className="space-y-4">
                        {transactions.slice(0, 3).map(t => (
                          <div key={t.id} className="flex justify-between items-center gap-4">
                            <span className="text-[10px] font-bold text-brand-primary/60 uppercase truncate max-w-[100px]">{t.description}</span>
                            <span className={cn(
                              "text-xs font-mono font-bold shrink-0",
                              (t.type === 'income' || t.type === 'refund') ? "text-brand-accent" : "text-brand-primary"
                            )}>
                              {formatCurrency(t.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                   </div>
                   <button 
                    onClick={() => setActiveTab('history')}
                    className="w-full py-4 bg-brand-bg border border-brand-border rounded-xl text-[9px] font-bold text-brand-primary uppercase tracking-[0.3em] hover:bg-brand-primary hover:text-brand-surface hover:border-brand-primary transition-all duration-500 mt-8 md:mt-12"
                   >
                     Inspect Ledger
                   </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-10 md:space-y-16"
            >
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
                  <h2 className="section-header">All Transactions</h2>
                  <p className="data-label">Every record saved to Artha</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                   <div className="relative group/search">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-primary/40 group-focus-within/search:text-brand-accent transition-colors" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="SEARCH_LEDGER..."
                        className="w-full md:w-64 bg-brand-surface border border-brand-border rounded-full py-2 pl-10 pr-4 text-[9px] font-mono font-bold text-brand-primary outline-none focus:border-brand-accent/30 transition-all placeholder:text-brand-primary/30"
                      />
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
              </div>

            {/* Transaction List */}
            <div className="space-y-8">
              {transactions.length === 0 ? (
                <div className="bg-brand-surface border border-brand-border border-dashed rounded-[2rem] p-12 text-center space-y-6">
                  <div className="w-16 h-16 bg-brand-bg rounded-2xl flex items-center justify-center mx-auto text-brand-primary/10">
                    <HistoryIcon className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-display font-medium text-brand-primary">Nothing here yet</p>
                    <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-widest leading-relaxed">No records found. Click below to add your first transaction.</p>
                  </div>
                  <button 
                    onClick={() => {
                        setCommandTab('transaction');
                        setShowCommandCenter(true);
                    }}
                    className="px-6 py-3 bg-brand-primary text-brand-surface rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  >
                    Add First Record
                  </button>
                </div>
              ) : Object.entries(groupedTransactions).map(([date, items]) => (
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
                    <h4 className="data-label !text-brand-primary/60">{date}</h4>
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
                          <div className="w-10 h-10 bg-brand-bg rounded-xl flex items-center justify-center text-brand-primary/60 group-hover:bg-brand-primary group-hover:text-brand-surface transition-all border border-brand-border/50">
                            {getCategoryIcon(t.category)}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-brand-primary uppercase tracking-tight leading-none">{t.description}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="data-label !text-[8.5px] !text-brand-primary/60">{t.category}</span>
                              {t.subcategory && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-brand-primary/10" />
                                  <span className="data-label !text-[8.5px] !text-brand-primary/50">{t.subcategory}</span>
                                </>
                              )}
                              <div className="flex items-center gap-1.5 ml-1">
                                {t.isMandatory && (
                                  <span className="px-1.5 py-0.5 bg-brand-primary/5 text-brand-primary/60 text-[8px] font-bold uppercase tracking-wider rounded border border-brand-primary/5 font-mono">FIXED</span>
                                )}
                                {t.type === 'refund' && (
                                  <span className="px-1.5 py-0.5 bg-brand-accent/10 text-brand-accent text-[8px] font-bold uppercase tracking-wider rounded border border-brand-accent/20 font-mono">REFUND</span>
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
                          <div className="text-right flex flex-col items-end gap-1">
                            <p className={cn(
                              "text-lg md:text-xl font-mono font-bold tabular-nums leading-none",
                              (t.type === 'income' || t.type === 'refund') ? "text-brand-accent" : "text-brand-primary"
                            )}>
                              {(t.type === 'income' || t.type === 'refund') ? '+' : '-'}{formatCurrency(t.amount)}
                            </p>
                            <div className="flex flex-col items-end gap-0.5">
                              {t.description && t.description !== t.subcategory.toUpperCase() && (
                                <p className="text-[7px] font-bold text-brand-primary/30 uppercase tracking-widest truncate max-w-[150px] leading-none">
                                  {t.description}
                                </p>
                              )}
                              <p className="text-[8px] font-bold text-brand-primary/10 uppercase tracking-widest leading-none">
                                {new Date(t.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setEditingTransaction(t);
                                setCommandTab('transaction');
                                setShowCommandCenter(true);
                              }}
                              className="p-2.5 bg-brand-primary/5 hover:bg-brand-primary hover:text-brand-surface rounded-lg transition-all border border-brand-border group/edit"
                            >
                              <Settings2 className="w-4 h-4 opacity-40 group-hover/edit:opacity-100" />
                            </button>
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
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
        </motion.div>
      )}

          {activeTab === 'goals' && (
            <motion.div 
              key="goals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-12 md:space-y-16"
            >
            <div className="flex gap-2 p-1 bg-brand-bg/50 border border-brand-border rounded-xl w-fit mb-8">
              <button 
                onClick={() => setGoalsSubTab('strategy')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  goalsSubTab === 'strategy' ? "bg-brand-primary text-brand-surface shadow-lg" : "text-brand-primary/40 hover:text-brand-primary"
                )}
              >
                Capital Strategy
              </button>
              <button 
                onClick={() => setGoalsSubTab('mandates')}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  goalsSubTab === 'mandates' ? "bg-brand-primary text-brand-surface shadow-lg" : "text-brand-primary/40 hover:text-brand-primary"
                )}
              >
                SIP Mandates
              </button>
            </div>

            {goalsSubTab === 'strategy' ? (
              <div className="space-y-16 animate-in fade-in slide-in-from-left-4 duration-500">
                {/* Asset Accumulation Section */}
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between px-1 gap-4">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1">Capital Portfolio</h2>
                      <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-wider py-0.5">Wealth & Savings Goals</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {goals.filter(g => g.type !== 'debt').map(goal => (
                      <GoalItem 
                        key={goal.id} 
                        goal={goal} 
                        onEdit={() => { 
                          setEditingGoal(goal); 
                          setCommandTab('goal');
                          setShowCommandCenter(true); 
                        }} 
                        onDelete={() => handleDeleteGoal(goal.id!)}
                      />
                    ))}
                    {goals.filter(g => g.type !== 'debt').length === 0 && (
                      <div className="col-span-full py-20 text-center border-2 border-dashed border-brand-border rounded-[2.5rem] bg-brand-surface/30">
                        <p className="data-label text-brand-primary/20">No accumulation goals defined</p>
                        <p className="text-[8px] font-mono text-brand-primary/20 uppercase tracking-widest mt-2">Capital growth requires intentional allocation</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Liability Management Section */}
                <div className="space-y-8 pt-8 border-t border-brand-border/30">
                  <div className="flex flex-col md:flex-row md:items-end justify-between px-1 gap-4">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1 text-brand-accent">Debt Portfolio</h2>
                      <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-wider py-0.5">Liability Amortization Schedule</p>
                    </div>
                    {goals.some(g => g.type === 'debt') && (
                      <button 
                        onClick={() => setActiveTab('insights')}
                        className="flex items-center gap-2 px-6 py-3 bg-brand-accent text-brand-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-accent/90 transition-all shadow-lg group"
                      >
                        <Zap className="w-4 h-4 transition-transform group-hover:scale-110" />
                        Optimize Liability Map
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {goals.filter(g => g.type === 'debt').map(goal => (
                      <GoalItem 
                        key={goal.id} 
                        goal={goal} 
                        onEdit={() => { 
                          setEditingGoal(goal); 
                          setCommandTab('goal');
                          setShowCommandCenter(true); 
                        }} 
                        onDelete={() => handleDeleteGoal(goal.id!)}
                      />
                    ))}
                    {goals.filter(g => g.type === 'debt').length === 0 && (
                      <div className="col-span-full py-20 text-center border-2 border-dashed border-brand-border rounded-[2.5rem] bg-brand-surface/30">
                        <p className="data-label text-brand-primary/20">No active liabilities tracked</p>
                      </div>
                    )}
                  </div>
                </div>

                {goals.length === 0 && (
                  <div className="py-20 text-center">
                    <button 
                      onClick={() => {
                        setCommandTab('goal');
                        setShowCommandCenter(true);
                      }}
                      className="px-10 py-5 bg-brand-primary text-brand-surface rounded-2xl text-xs font-bold uppercase tracking-[0.2em] shadow-2xl hover:scale-105 transition-all"
                    >
                      Architect Strategic Portfolio
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-16 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* Income Streams Section */}
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between px-1 gap-4">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1">Income Streams</h2>
                      <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-wider py-0.5">Recurring Baseline Inflow Mandates</p>
                    </div>
                    <button 
                      onClick={() => {
                        setCommandTab('income');
                        setEditingIncomeStream(null);
                        setShowCommandCenter(true);
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-brand-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-lg group shadow-emerald-500/10"
                    >
                      <Plus className="w-4 h-4" />
                      Add Income Stream
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {incomeStreams.map(stream => (
                      <IncomeStreamItem 
                        key={stream.id} 
                        stream={stream} 
                        onEdit={() => { 
                          setEditingIncomeStream(stream); 
                          setCommandTab('income');
                          setShowCommandCenter(true); 
                        }} 
                        onDelete={() => handleDeleteIncomeStream(stream.id!)}
                      />
                    ))}
                    {incomeStreams.length === 0 && (
                      <div className="col-span-full py-16 text-center border-2 border-dashed border-brand-border rounded-[2.5rem] bg-brand-surface/30">
                        <p className="data-label text-brand-primary/20">No recurring income streams defined</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* SIP Portfolio Section */}
                <div className="space-y-8 pt-8 border-t border-brand-border/30">
                  <div className="flex flex-col md:flex-row md:items-end justify-between px-1 gap-4">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight py-1 text-emerald-500">SIP Portfolio</h2>
                      <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-wider py-0.5">Automated Investment Protocols</p>
                    </div>
                    <button 
                      onClick={() => {
                        setCommandTab('sip');
                        setEditingSip(null);
                        setShowCommandCenter(true);
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-brand-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-lg group shadow-emerald-500/10"
                    >
                      <Plus className="w-4 h-4" />
                      New SIP Strategy
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {sips.map(sip => (
                      <SIPItem 
                        key={sip.id} 
                        sip={sip} 
                        transactions={transactions}
                        onLogPayment={(s) => {
                          setEditingSip(s);
                          setEditingTransaction(null);
                          setCommandTab('transaction');
                          setShowCommandCenter(true);
                        }}
                        onEdit={() => { 
                          setEditingSip(sip); 
                          setCommandTab('sip');
                          setShowCommandCenter(true); 
                        }} 
                        onDelete={() => handleDeleteSIP(sip.id!)}
                      />
                    ))}
                    {sips.length === 0 && (
                      <div className="col-span-full py-16 text-center border-2 border-dashed border-brand-border rounded-[2.5rem] bg-brand-surface/30">
                        <p className="data-label text-brand-primary/20">No automated investment plans configured</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div 
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            <React.Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-primary"></div>
              </div>
            }>
            <div className="space-y-16">
              <div className="flex flex-col md:flex-row md:items-end justify-between px-1 gap-4">
                <div className="space-y-1">
                  <h2 className="text-4xl font-sans font-bold uppercase tracking-tight text-brand-primary leading-none py-1">Tactical Analysis</h2>
                  <p className="text-[10px] text-brand-primary/40 font-bold uppercase tracking-[0.3em] py-0.5">Asset Optimization & Risk Modeling</p>
                </div>
              </div>
              
              <div className="space-y-16">
                {/* Scenario Planning Hub */}
                <StressTestConsole 
                  monthlyIncome={estimatedMonthlyIncome}
                  monthlyFixedExpenses={estimatedFixedCosts}
                  monthlyGoalCommitments={monthlyGoalCommitments}
                  sipMandates={sipMandates}
                  liquidAssets={liquidAssets}
                  incomeShock={stressTest.incomeShock}
                  expenseShock={stressTest.expenseShock}
                  onShockChange={(income, expense) => setStressTest({ incomeShock: income, expenseShock: expense })}
                />

                <div className="pt-16 border-t border-brand-border">
                  <StrategyInsights 
                    transactions={transactions} 
                    goals={goals} 
                    balance={balance}
                    totalIncome={totalIncome}
                    totalSavings={liquidAssets}
                    mandatoryExpenses={estimatedFixedCosts}
                    discretionaryExpenses={Math.max(0, monthlyBurn - estimatedFixedCosts)}
                    strategicSpendingCeiling={strategicSpendingCeiling}
                    dailySpendingPower={dailySpendingPower}
                    monthlyGoalCommitments={monthlyGoalCommitments}
                    savingsRate={savingsRate}
                    incomeCoverage={incomeCoverage}
                    estimatedMonthlyIncome={estimatedMonthlyIncome}
                    estimatedFixedCosts={estimatedFixedCosts}
                  />
                </div>
                
                <div className="pt-16 border-t border-brand-border">
                  <DebtOptimization goals={goals} />
                </div>

                {/* Tactical Deletion & Reset Protocol */}
                <div className="bg-brand-surface border border-rose-500/10 rounded-3xl p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-primary uppercase tracking-tight">Danger Zone</h4>
                      <p className="text-[10px] text-brand-primary/20 font-bold uppercase tracking-widest mt-1">Delete all your data</p>
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-brand-primary/50 leading-relaxed max-w-md">
                    This will permanently delete all your transactions, goals, and history. This cannot be undone.
                  </p>

                  <button 
                    onClick={async () => {
                      if (showTotalPurgeConfirm) {
                        try {
                          setIsPurging(true);
                          const tDocs = await getDocs(query(collection(db, 'transactions'), where('userId', '==', user.uid)));
                          const gDocs = await getDocs(query(collection(db, 'goals'), where('userId', '==', user.uid)));
                          const batch = writeBatch(db);
                          tDocs.docs.forEach(d => batch.delete(doc(db, 'transactions', d.id)));
                          gDocs.docs.forEach(d => batch.delete(doc(db, 'goals', d.id)));
                          await batch.commit();
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
                      "Yes, Delete Everything"
                    ) : (
                      "Delete All Data"
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
                        <p className="text-[10px] text-brand-primary/20 font-bold uppercase tracking-widest font-mono mt-1">Logged In Securely</p>
                      </div>
                    </div>
                    <button 
                      onClick={logout}
                      className="px-6 py-3 rounded-xl bg-brand-bg border border-brand-border text-brand-primary/40 hover:text-rose-500 hover:border-rose-500/20 text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </React.Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </main>

      {/* Strategic Command Center */}
      <AnimatePresence>
        {showCommandCenter && user && (
          <CommandCenter 
            onClose={() => {
              setShowCommandCenter(false);
              setEditingGoal(null);
              setEditingTransaction(null);
              setEditingSip(null);
              setEditingIncomeStream(null);
            }} 
            userId={user.uid}
            transactions={transactions}
            goals={goals}
            initialTab={commandTab}
            editingGoal={editingGoal}
            editingTransaction={editingTransaction}
            avgDailySpend={avgDailySpend}
            onDeleteGoal={handleDeleteGoal}
            sips={sips}
            onDeleteSIP={handleDeleteSIP}
            editingSip={editingSip}
            editingIncomeStream={editingIncomeStream}
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

function IncomeStreamItem({ stream, onEdit, onDelete }: { stream: IncomeStream, onEdit?: () => void, onDelete?: () => void }) {
  const statusColor = {
    active: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    inactive: 'text-brand-primary/40 bg-brand-primary/5 border-brand-primary/10',
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-brand-surface border border-brand-border rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between group hover:border-brand-primary/20 transition-all shadow-sm"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-sans font-bold text-brand-primary uppercase tracking-tight">{stream.name}</h3>
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                statusColor[stream.status as keyof typeof statusColor]
              )}>
                {stream.status}
              </div>
            </div>
            <p className="text-[10px] font-bold text-brand-primary/40 uppercase tracking-wider">Baseline Income Mandate</p>
          </div>
          <p className="text-2xl font-mono font-bold text-brand-primary">{formatCurrency(stream.amount)}</p>
        </div>
      </div>

      <div className="pt-4 border-t border-brand-border/30 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <Calendar className="w-3 h-3 text-brand-primary/20" />
           <span className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Expected Credit: {stream.dayOfMonth}th of month</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-2 text-brand-primary/20 hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            className="p-2 text-brand-primary/20 hover:text-brand-primary transition-colors"
          >
             <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SIPItem({ sip, onEdit, onDelete, transactions, onLogPayment }: { sip: SIP, onEdit?: () => void, onDelete?: () => void, transactions: Transaction[], onLogPayment?: (sip: SIP) => void }) {
  const statusColor = {
    active: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    paused: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    stopped: 'text-rose-500 bg-rose-500/10 border-rose-500/20'
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
      whileHover={{ y: -2 }}
      className="bg-brand-surface p-5 border border-brand-border rounded-[1.5rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between h-full"
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] -mr-16 -mt-16 bg-brand-accent/10 opacity-30 group-hover:opacity-50 transition-all pointer-events-none" />
      
      <div className="space-y-4 relative z-10">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 cursor-pointer flex-1" onClick={onEdit}>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight">{sip.name}</h4>
              <div className={cn(
                "px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest border",
                statusColor[sip.status]
              )}>
                {sip.status}
              </div>
            </div>
            {isFulfilled && (
              <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-500 uppercase tracking-widest">
                <CheckCircle2 className="w-3 h-3" />
                Fulfilled this month
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5 bg-brand-bg/50 px-2 py-0.5 rounded-lg border border-brand-border">
                <span className="text-[7px] font-bold text-brand-primary/30 uppercase tracking-widest">Monthly</span>
                <span className="text-[10px] font-mono font-bold text-brand-primary">{formatCurrency(sip.amount)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-brand-bg/50 px-2 py-0.5 rounded-lg border border-brand-border">
                <span className="text-[7px] font-bold text-brand-primary/30 uppercase tracking-widest">Cycle Date</span>
                <span className="text-[10px] font-mono font-bold text-brand-primary">{sip.dayOfMonth}<sup>th</sup></span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-brand-primary/30 uppercase tracking-widest">{sip.category}</p>
            <Calendar className="w-4 h-4 text-brand-accent ml-auto mt-2 opacity-20" />
          </div>
        </div>

        <div className="pt-4 border-t border-brand-border/30 flex justify-between items-center">
          <div className="flex items-center gap-2">
             {!isFulfilled && sip.status === 'active' && (
               <button 
                 onClick={(e) => { e.stopPropagation(); onLogPayment?.(sip); }}
                 className="px-3 py-1.5 bg-brand-primary text-brand-surface rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all flex items-center gap-1.5 shadow-md shadow-brand-primary/10"
               >
                 <Plus className="w-3 h-3" />
                 Log Installment
               </button>
             )}
             {isFulfilled && (
               <span className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">Next Run: {sip.dayOfMonth}/{new Date().getMonth() + 2}</span>
             )}
             {!isFulfilled && sip.status !== 'active' && (
               <span className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-widest">SIP {sip.status.toUpperCase()}</span>
             )}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-2 text-brand-primary/10 hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function GoalItem({ goal, onEdit, onDelete }: { goal: Goal, onEdit?: () => void, onDelete?: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  
  const calculatePayoffDate = (g: Goal) => {
    if (g.type !== 'debt' || !g.emi || g.emi <= 0) return null;
    
    const balance = g.targetAmount - g.currentAmount;
    if (balance <= 0) return 'PAID';
    
    const rate = (g.interestRate || 8.5) / 100 / 12;
    const emi = g.emi;
    
    // N = -log(1 - (B*r)/EMI) / log(1 + r)
    let months = 0;
    if (rate > 0) {
      const numerator = Math.log(1 - (balance * rate) / emi);
      if (isNaN(numerator)) {
        // EMI is too low to cover interest
        months = balance / emi;
      } else {
        months = -numerator / Math.log(1 + rate);
      }
    } else {
      months = balance / emi;
    }

    const date = new Date();
    date.setMonth(date.getMonth() + Math.ceil(months));
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
  };

  const payoffDate = calculatePayoffDate(goal);
  
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-brand-surface p-5 border border-brand-border rounded-[1.5rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between h-full"
    >
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] -mr-16 -mt-16 opacity-30 group-hover:opacity-50 transition-all pointer-events-none",
        goal.type === 'debt' ? "bg-brand-accent/20" : "bg-brand-primary/10"
      )} />
      
      <div className="space-y-4 relative z-10">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 cursor-pointer flex-1" onClick={onEdit}>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-sans font-bold uppercase tracking-tight text-brand-primary leading-tight">{goal.name}</h4>
              {goal.priority === 'high' && (
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5 bg-brand-bg/50 px-2 py-0.5 rounded-lg border border-brand-border">
                <span className="text-[7px] font-bold text-brand-primary/30 uppercase tracking-widest">{goal.type === 'debt' ? 'Total' : 'Goal'}</span>
                <span className="text-[10px] font-mono font-bold text-brand-primary">{formatCurrency(goal.targetAmount)}</span>
              </div>
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-lg border",
                goal.type === 'debt' ? "bg-brand-accent/5 border-brand-accent/20" : "bg-emerald-500/5 border-emerald-500/10"
              )}>
                <span className={cn(
                  "text-[7px] font-bold uppercase tracking-widest",
                  goal.type === 'debt' ? "text-brand-accent" : "text-emerald-500"
                )}>{goal.type === 'debt' ? 'Paid' : 'Saved'}</span>
                <span className={cn(
                  "text-[10px] font-mono font-bold",
                  goal.type === 'debt' ? "text-brand-accent" : "text-emerald-500"
                )}>{formatCurrency(goal.currentAmount)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className={cn(
              "text-sm font-mono font-bold tabular-nums leading-none",
              progress >= 100 ? "text-emerald-500" : "text-brand-primary"
            )}>{progress.toFixed(0)}%</p>
            <p className="text-[7px] font-bold text-brand-primary/30 uppercase tracking-widest mt-1">Status</p>
          </div>
        </div>

        <div className="h-1.5 w-full bg-brand-bg rounded-full overflow-hidden border border-brand-border p-[1px]">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={cn(
              "h-full rounded-full shadow-sm",
              goal.type === 'debt' ? "bg-brand-accent" : "bg-brand-primary"
            )}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-brand-border/50 relative z-10">
        <div className="flex gap-4">
          <div className="space-y-0.5">
            <p className="text-[7px] font-bold text-brand-primary/20 uppercase tracking-widest">Horizon</p>
            <p className="text-[9px] font-mono font-bold text-brand-primary">
              {goal.type === 'debt' && payoffDate ? (
                <span className="text-brand-accent">{payoffDate}</span>
              ) : (
                goal.deadline ? new Date(goal.deadline).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).toUpperCase() : 'OPEN'
              )}
            </p>
          </div>
          {goal.type === 'debt' && goal.emi && (
            <div className="space-y-0.5">
              <p className="text-[7px] font-bold text-brand-accent uppercase tracking-widest">Monthly EMI</p>
              <p className="text-[9px] font-mono font-bold text-brand-accent">{formatCurrency(goal.emi)}</p>
            </div>
          )}
          {goal.monthlyContribution && goal.type !== 'debt' && (
            <div className="space-y-0.5">
              <p className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest">Commitment</p>
              <p className="text-[9px] font-mono font-bold text-emerald-500">{formatCurrency(goal.monthlyContribution)}</p>
            </div>
          )}
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
                onDelete?.();
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

function IncomeStreamForm({ onClose, userId, editingIncomeStream }: { onClose: () => void, userId: string, editingIncomeStream: IncomeStream | null }) {
  const [name, setName] = useState(editingIncomeStream?.name || '');
  const [amount, setAmount] = useState(editingIncomeStream?.amount.toString() || '');
  const [dayOfMonth, setDayOfMonth] = useState(editingIncomeStream?.dayOfMonth.toString() || '1');
  const [status, setStatus] = useState<'active' | 'inactive'>(editingIncomeStream?.status || 'active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const streamData = {
        name,
        amount: parseFloat(amount),
        dayOfMonth: parseInt(dayOfMonth),
        status,
        userId
      };

      if (editingIncomeStream?.id) {
        await updateDoc(doc(db, 'incomeStreams', editingIncomeStream.id), streamData);
      } else {
        await addDoc(collection(db, 'incomeStreams'), streamData);
      }
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
        <div className="bg-rose-500/10 border-l-2 border-rose-500 p-3 rounded-r-lg">
          <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-rose-500">Error</p>
          <p className="text-[10px] font-bold text-rose-600 mt-1">{errorMsg}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="group/input space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Stream Identity</label>
          <input 
            autoFocus
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., PRIMARY SALARY"
            className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-sans font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none uppercase tracking-tight"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Monthly Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-brand-primary/10 group-focus-within/input:text-brand-accent transition-colors text-base">₹</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 pl-8 pr-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                required
              />
            </div>
          </div>
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Credit Day</label>
            <input 
              type="number" 
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Status</label>
          <div className="flex gap-2">
            {['active', 'inactive'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s as any)}
                className={cn(
                  "flex-1 py-3 rounded-lg text-[9px] font-bold uppercase tracking-[0.2em] transition-all relative z-10 border",
                  status === s 
                    ? "bg-brand-primary text-brand-surface border-brand-primary shadow-md" 
                    : "bg-brand-surface text-brand-primary/30 border-brand-border hover:text-brand-primary/60"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full py-4 bg-brand-primary text-brand-surface rounded-lg font-bold text-[9px] uppercase tracking-[0.4em] shadow-lg active:scale-[0.98] transition-all border border-white/10 hover:bg-brand-primary/95"
      >
        {isSubmitting ? 'PROCESSING...' : (editingIncomeStream ? 'UPDATE MANDATE' : 'ESTABLISH MANDATE')}
      </button>
    </form>
  );
}

const EXPENSE_CATEGORIES = {
  'Dining & Delivery': ['Swiggy', 'Zomato', 'Restaurants', 'Cafes', 'Fine Dining', 'Other'],
  'Groceries & Q-Commerce': ['Blinkit', 'Instamart', 'Zepto', 'BigBasket', 'Local Grocery', 'Other'],
  'Shopping & Lifestyle': ['Myntra', 'Ajio', 'Nykaa', 'Tira', 'Zara', 'H&M', 'Amazon', 'Flipkart', 'Salon', 'Lifestyle', 'Other'],
  'Transport & Commute': ['Uber', 'Ola', 'Rapido', 'Fuel', 'Public Transport', 'Vehicle Service', 'Other'],
  'Bills & Utilities': ['Electricity', 'Gas', 'Water', 'Internet', 'Mobile Recharge', 'DTH', 'Other'],
  'Housing': ['Rent', 'Maintenance', 'Home Decor', 'Domestic Help', 'Property Tax', 'Other'],
  'Health & Wellness': ['Medical/Doctors', 'Pharmacy', 'Gym/Fitness', 'Insurance', 'Other'],
  'Travel & Stays': ['Flights', 'Trains', 'Hotels/Airbnb', 'Vacation', 'Other'],
  'Subscriptions': ['Netflix', 'Hotstar', 'Prime Video', 'Apple TV/Music', 'Spotify', 'YouTube Premium'],
  'Investments & EMI': ['SIP/Mutual Funds', 'Stocks', 'Gold', 'EMI/Loan', 'Other'],
  'Strategic Savings': ['Emergency Fund', 'Long-term Savings', 'Other'],
  'Other': ['Gifts', 'Donations', 'Misc', 'Other']
};

const INCOME_CATEGORIES = {
  'Employment': ['Salary', 'Bonus', 'Overtime', 'Other'],
  'Business': ['Client Payment', 'Profit', 'Dividend', 'Other'],
  'Investment': ['Interest', 'Capital Gains', 'Rental Income', 'Other'],
  'Misc Income': ['Gift', 'Tax Refund', 'Cashback', 'Other']
};

function CommandCenter({ 
  onClose, 
  userId, 
  transactions, 
  goals, 
  initialTab,
  editingGoal,
  editingTransaction,
  avgDailySpend,
  onDeleteGoal,
  sips,
  onDeleteSIP,
  editingSip,
  editingIncomeStream
}: { 
  onClose: () => void, 
  userId: string, 
  transactions: Transaction[], 
  goals: Goal[],
  initialTab: 'transaction' | 'goal' | 'sip' | 'income',
  editingGoal: Goal | null,
  editingTransaction: Transaction | null,
  avgDailySpend: number,
  onDeleteGoal: (id: string) => Promise<void>,
  sips: SIP[],
  onDeleteSIP: (id: string) => Promise<void>,
  editingSip: SIP | null,
  editingIncomeStream: IncomeStream | null
}) {
  const [activeTab, setActiveTab] = useState<'transaction' | 'goal' | 'sip' | 'income'>(
    editingGoal ? 'goal' : editingTransaction ? 'transaction' : editingSip ? 'sip' : editingIncomeStream ? 'income' : initialTab
  );

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
                  {activeTab === 'transaction' ? <Plus className="w-4 h-4 text-brand-accent" /> : activeTab === 'goal' ? <Target className="w-4 h-4 text-brand-accent" /> : <Calendar className="w-4 h-4 text-brand-accent" />}
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-[11px] font-bold text-brand-primary uppercase tracking-widest leading-none">
                    {activeTab === 'transaction' ? 'Quick Add' : activeTab === 'goal' ? 'Savings Goals' : activeTab === 'income' ? 'Income Mandate' : 'SIP Manager'}
                  </h3>
                  <p className="text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-[0.25em] leading-none">
                    {activeTab === 'sip' ? 'SYSTEMATIC INVESTMENTS' : 'Update your history'}
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
                <TransactionForm 
                  onClose={onClose} 
                  userId={userId} 
                  transactions={transactions} 
                  goals={goals} 
                  editingTransaction={editingTransaction} 
                  sips={sips}
                  editingSip={editingSip}
                />
              )}
              {activeTab === 'income' && (
                <IncomeStreamForm 
                  onClose={onClose} 
                  userId={userId} 
                  editingIncomeStream={editingIncomeStream} 
                />
              )}
              {activeTab === 'goal' && (
              <GoalModalContent 
                onClose={onClose} 
                userId={userId} 
                goal={editingGoal} 
                onDeleteGoal={onDeleteGoal}
              />
              )}
              {activeTab === 'sip' && (
                <SIPModalContent 
                  onClose={onClose} 
                  userId={userId} 
                  sip={editingSip} 
                  onDeleteSIP={onDeleteSIP}
                  goals={goals}
                />
              )}
            </div>

            {/* Unified Navigation at bottom of flex container */}
            <div className="pt-2 border-t border-brand-primary/5">
              <div className="flex gap-1.5 pb-1">
                {[
                  { id: 'transaction', label: 'ADD', icon: Plus },
                  { id: 'income', label: 'INFLOW', icon: ArrowUpRight },
                  { id: 'sip', label: 'SIP', icon: Calendar },
                  { id: 'goal', label: 'GOALS', icon: Target },
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

function TransactionForm({ onClose, userId, transactions, goals, editingTransaction, sips, editingSip }: { onClose: () => void, userId: string, transactions: Transaction[], goals: Goal[], editingTransaction: Transaction | null, sips: SIP[], editingSip: SIP | null }) {
  const [amount, setAmount] = useState(editingTransaction?.amount.toString() || editingSip?.amount.toString() || '');
  const [category, setCategory] = useState(editingTransaction?.category || (editingSip ? 'Investments & EMI' : 'Dining & Delivery'));
  const [subcategory, setSubcategory] = useState(editingTransaction?.subcategory || (editingSip ? `SIP:${editingSip.name}:${editingSip.id}:${editingSip.amount}:${editingSip.linkedGoalId || ''}` : 'Swiggy'));
  const [description, setDescription] = useState(editingTransaction?.description || editingSip?.name || '');
  const [date, setDate] = useState(editingTransaction?.date ? new Date(editingTransaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<TransactionType>(editingTransaction?.type || 'expense');
  const [manualGoalId, setManualGoalId] = useState<string | null>(editingTransaction?.linkedGoalId || editingSip?.linkedGoalId || null);
  const [sipId, setSipId] = useState<string | null>(editingTransaction?.sipId || editingSip?.id || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCategories = type === 'expense' || type === 'refund' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // Sync subcategory when category changes
  useEffect(() => {
    const currentCats = type === 'expense' || type === 'refund' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const subs = [...(currentCats as any)[category] || []];
    
    // Inject goals into subcategories for relevant categories
    const relevantGoals = goals.filter(g => g.type === goalTypeMap[category]);
    relevantGoals.forEach(g => {
      subs.push(`GOAL:${g.name}:${g.id}`);
    });

    // Inject active SIPs into subcategories
    if (category === 'Investments & EMI' || category === 'Investments') {
      const activeSips = sips.filter(s => s.status === 'active');
      activeSips.forEach(s => {
        subs.push(`SIP:${s.name}:${s.id}:${s.amount}:${s.linkedGoalId || ''}`);
      });
    }

    if (subs.length > 0 && !subs.includes(subcategory)) {
      setSubcategory(subs[0]);
    }
  }, [category, type, goals, sips]);

  // Handle goals/SIPs within subcategory selection
  useEffect(() => {
    if (subcategory.startsWith('GOAL:')) {
      const parts = subcategory.split(':');
      setManualGoalId(parts[2]);
      setSipId(null);
    } else if (subcategory.startsWith('SIP:')) {
      const parts = subcategory.split(':');
      const sId = parts[2];
      setSipId(sId);
      
      // Intelligent amount prediction for schemes
      const sip = sips.find(s => s.id === sId);
      if (sip && sip.schemeType === 'gold_scheme') {
        const sipTransactions = transactions.filter(t => t.sipId === sId);
        const installmentIndex = sipTransactions.length;
        
        if (installmentIndex === 0 && sip.firstInstallmentAmount) {
          setAmount(sip.firstInstallmentAmount.toString());
        } else if (installmentIndex >= (sip.totalInstallments || 12) - 1) {
          setAmount('0'); // Last month free
        } else {
          setAmount(sip.amount.toString());
        }
      } else {
        setAmount(parts[3]);
      }
      setManualGoalId(parts[4] || null);
    } else if (!editingTransaction) {
      setManualGoalId(null);
      setSipId(null);
    }
  }, [subcategory]);

  const goalTypeMap: Record<string, string> = {
    'Investments & EMI': 'investment',
    'Investments': 'investment',
    'Debt Repayment': 'debt',
    'Loan Repayment': 'debt',
    'Strategic Savings': 'savings',
    'Savings': 'savings'
  };
  const matchingGoal = goals.find(g => g.type === goalTypeMap[category]);

  const smartTemplates = React.useMemo(() => {
    const counts: Record<string, { count: number, category: string, lastAmount: number, type: TransactionType }> = {};
    transactions.forEach(t => {
      const key = `${t.description}-${t.type}`;
      if (!counts[key]) {
        counts[key] = { count: 0, category: t.category, lastAmount: t.amount, type: t.type };
      }
      counts[key].count++;
      counts[key].lastAmount = t.amount;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, data]) => ({ name: key.split('-')[0], ...data }));
  }, [transactions]);

  const applyTemplate = (template: { name: string, category: string, lastAmount: number, type: TransactionType }) => {
    setType(template.type);
    setCategory(template.category);
    setAmount(template.lastAmount.toString());
    setDescription(template.name);
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    let finalSubcategory = subcategory;
    let finalDescription = description;

    if (subcategory.startsWith('GOAL:')) {
      const parts = subcategory.split(':');
      finalSubcategory = parts[1]; // Use goal name as subcategory
      if (!description) finalDescription = `Contribution to ${parts[1]}`;
    } else if (subcategory.startsWith('SIP:')) {
      const parts = subcategory.split(':');
      finalSubcategory = 'SIP Installment';
      if (!description) finalDescription = parts[1];
    } else {
      if (!description) finalDescription = subcategory.toUpperCase();
    }

    if (isNaN(amountNum) || amountNum <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const goalTypeMap: Record<string, string> = {
        'Investments & EMI': 'investment',
        'Investments': 'investment',
        'Debt Repayment': 'debt',
        'Loan Repayment': 'debt',
        'Strategic Savings': 'savings',
        'Savings': 'savings',
        'Salary': 'savings', 
        'Freelance': 'savings'
      };

      const resolvedGoalType = goalTypeMap[category];
      const smartGoal = goals.find(g => {
        const nameMatch = g.name.length > 2 && (
          finalDescription.toLowerCase().includes(g.name.toLowerCase()) ||
          g.name.toLowerCase().includes(finalDescription.toLowerCase())
        );
        const typeMatch = g.type === resolvedGoalType;
        return nameMatch || (resolvedGoalType && typeMatch);
      });

      const newGoalId = manualGoalId || smartGoal?.id || null;
      const newDelta = getContributionDelta(amountNum, type, category, !!newGoalId);

      // Auto-classify based on pattern
      const classification = type === 'expense' || type === 'refund' ? autoClassifyExpense(category, finalSubcategory) : { isMandatory: false, isRecurring: false, isAvoidable: false };

      // Handle goal balance updates atomically if possible
      if (editingTransaction?.linkedGoalId === newGoalId && newGoalId) {
        // Same goal
        const oldDelta = getContributionDelta(editingTransaction.amount, editingTransaction.type, editingTransaction.category, true);
        const diff = newDelta - oldDelta;
        if (diff !== 0) {
          await updateDoc(doc(db, 'goals', newGoalId), { currentAmount: increment(diff) });
        }
      } else {
        // Different goals or new transaction
        if (editingTransaction?.linkedGoalId) {
          const oldDelta = getContributionDelta(editingTransaction.amount, editingTransaction.type, editingTransaction.category, true);
          await updateDoc(doc(db, 'goals', editingTransaction.linkedGoalId), { 
            currentAmount: increment(-oldDelta) 
          });
        }
        if (newGoalId) {
          await updateDoc(doc(db, 'goals', newGoalId), { currentAmount: increment(newDelta) });
        }
      }

      const transactionData = {
        amount: amountNum,
        category,
        subcategory: finalSubcategory,
        description: finalDescription,
        type,
        date: new Date(date).toISOString(),
        userId,
        isMandatory: classification.isMandatory,
        isRecurring: classification.isRecurring,
        isAvoidable: classification.isAvoidable,
        linkedGoalId: newGoalId,
        sipId
      };

      if (editingTransaction?.id) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), transactionData);
      } else {
        await addDoc(collection(db, 'transactions'), transactionData);
      }

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
          <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-rose-500">Error</p>
          <p className="text-[10px] font-bold text-rose-600 mt-1">{errorMsg}</p>
        </motion.div>
      )}
      
      {smartTemplates.length > 0 && (
        <div className="space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/30 pl-1">Recent Records</label>
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
        {(['expense', 'income', 'refund'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              const currentCats = (t === 'expense' || t === 'refund') ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
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
            {t === 'income' && <TrendingUp className="w-3 h-3 text-brand-accent" />}
            {t === 'expense' && <TrendingDown className="w-3 h-3 text-rose-400" />}
            {t === 'refund' && <RefreshCcw className="w-3 h-3 text-sky-400" />}
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Category & Subcategory</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative group/select">
              <select 
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setCategory(newCat);
                  const currentCats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
                  const firstSub = (currentCats as any)[newCat]?.[0] || 'Other';
                  setSubcategory(firstSub);
                }}
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
                className={cn(
                  "w-full h-10 bg-brand-bg/30 border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold outline-none appearance-none cursor-pointer focus:bg-brand-surface transition-all",
                  subcategory.startsWith('GOAL:') ? "text-emerald-500 border-emerald-500/20" : "text-brand-primary/40"
                )}
              >
                {(() => {
                  const currentCats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
                  const baseSubs = (currentCats as any)[category] || [];
                  const goalSubs = goals
                    .filter(g => g.type === goalTypeMap[category])
                    .map(g => `GOAL:${g.name}:${g.id}`);
                  
                  return [...baseSubs, ...goalSubs].map((sub: string) => (
                    <option key={sub} value={sub}>
                      {sub.startsWith('GOAL:') 
                        ? `🎯 ALLOCATE: ${sub.split(':')[1].toUpperCase()}` 
                        : sub.startsWith('SIP:') 
                          ? `🔄 SIP: ${sub.split(':')[1].toUpperCase()}`
                          : sub.toUpperCase()}
                    </option>
                  ));
                })()}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary/10">
                <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Date</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-mono font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
              required
            />
          </div>
        </div>

        {(category === 'Other' || subcategory === 'Other') && (
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Notes</label>
            <input 
              type="text" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={subcategory.toUpperCase()}
              className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-sans font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none uppercase tracking-tight"
            />
          </div>
        )}

      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 bg-brand-primary text-brand-surface rounded-lg font-bold text-[9px] uppercase tracking-[0.4em] shadow-lg active:scale-[0.98] transition-all border border-white/10 hover:bg-brand-primary/95"
      >
        {isSubmitting ? 'SAVING...' : editingTransaction ? 'SAVE CHANGES' : `ADD ${type === 'expense' ? 'OUTGOING' : 'INCOMING'}`}
      </button>
    </form>
  );
}

const autoClassifyExpense = (category: string, subcategory: string) => {
  const needs = ['Housing', 'Bills & Utilities', 'Groceries & Q-Commerce', 'Health & Wellness', 'Investments & EMI', 'Strategic Savings', 'Transport & Commute'];
  const recurring = ['Housing', 'Bills & Utilities', 'Subscriptions', 'Investments & EMI'];
  const extra = ['Dining & Delivery', 'Travel & Stays', 'Shopping & Lifestyle'];

  let isMandatory = needs.includes(category);
  let isRecurring = recurring.includes(category);
  let isAvoidable = extra.includes(category);

  // Specific overrides based on Indian patterns
  if (category === 'Groceries & Q-Commerce' && ['Blinkit', 'Instamart', 'Zepto'].includes(subcategory)) {
    isMandatory = false; // Premium convenience
    isAvoidable = true;
  }
  
  if (category === 'Transport & Commute' && ['Uber', 'Ola', 'Rapido'].includes(subcategory)) {
    isMandatory = false; // Optional convenience (compared to public/own)
    isAvoidable = true;
  }

  if (category === 'Health & Wellness' && subcategory === 'Gym/Fitness') {
    isMandatory = false;
    isAvoidable = true; // Lifestyle choice
  }

  if (category === 'Shopping & Lifestyle' && subcategory === 'Salon') {
    isMandatory = true; // Hygiene maintenance
    isAvoidable = false;
  }

  if (category === 'Investments & EMI') {
    isMandatory = true;
    isRecurring = true;
    isAvoidable = false;
  }

  return { isMandatory, isRecurring, isAvoidable };
};

function GoalModalContent({ onClose, userId, goal, onDeleteGoal }: { onClose: () => void, userId: string, goal: Goal | null, onDeleteGoal: (id: string) => Promise<void> }) {
  const [name, setName] = useState(goal?.name || '');
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount.toString() || '');
  const [currentAmount, setCurrentAmount] = useState(goal?.currentAmount.toString() || '');
  const [monthlyContribution, setMonthlyContribution] = useState(goal?.monthlyContribution?.toString() || '');
  const [type, setType] = useState<GoalType>(goal?.type || 'savings');
  const [deadline, setDeadline] = useState(goal?.deadline || '');
  const [interestRate, setInterestRate] = useState(goal?.interestRate?.toString() || '');
  const [tenureMonths, setTenureMonths] = useState(goal?.tenureMonths?.toString() || '');
  const [startDate, setStartDate] = useState(goal?.startDate || '');
  const [emi, setEmi] = useState(goal?.emi?.toString() || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(goal?.priority || 'medium');
  const [maturityValue, setMaturityValue] = useState(goal?.maturityValue?.toString() || '');
  const [isScheme, setIsScheme] = useState(goal?.isScheme || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const templates = [
    { name: 'Home Loan', target: 5000000, type: 'debt' as GoalType, interestRate: 8.5, tenureMonths: 240, emi: 45000 },
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
        interestRate: interestRate ? parseFloat(interestRate) : 8.5,
        tenureMonths: tenureMonths ? parseInt(tenureMonths) : 240,
        emi: emi ? parseFloat(emi) : (type === 'debt' ? 0 : null),
        startDate: startDate || null,
        priority,
        maturityValue: maturityValue ? parseFloat(maturityValue) : null,
        isScheme,
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
      await onDeleteGoal(goal.id);
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
                  if (tmp.interestRate) setInterestRate(tmp.interestRate.toString());
                  if (tmp.tenureMonths) setTenureMonths(tmp.tenureMonths.toString());
                  if (tmp.emi) setEmi(tmp.emi.toString());
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
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Goal Name</label>
          <input 
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. NEW HOME"
            className="w-full bg-brand-surface border border-brand-border rounded-lg py-2 px-4 text-base font-bold uppercase tracking-tight text-brand-primary outline-none focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all text-center placeholder:text-brand-primary/5"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">{type === 'debt' ? 'Total Loan Amount' : 'Goal Amount'}</label>
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
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">{type === 'debt' ? 'Already Paid' : 'Currently Saved'}</label>
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

        {type === 'debt' && (
          <>
          <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Interest Rate (%)</label>
              <div className="relative group">
                <input 
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                  placeholder="8.5"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Remaining Months</label>
              <div className="relative group">
                <input 
                  type="number"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                  placeholder="240"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Monthly EMI</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-brand-primary/10 group-focus-within/input:text-brand-accent transition-colors text-xs">₹</span>
                <input 
                  type="number"
                  value={emi}
                  onChange={(e) => setEmi(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 pl-8 pr-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Goal Type</label>
            <div className="relative group">
              <select 
                value={type}
                onChange={(e) => setType(e.target.value as GoalType)}
                className="w-full h-10 bg-brand-surface border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-brand-accent/5 transition-all text-center"
              >
                <option value="savings">SAVINGS</option>
                <option value="investment">INVESTMENT</option>
                <option value="debt">LOAN PAYOFF</option>
                <option value="lifestyle">LIFESTYLE</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary/20">
                <ChevronRight className="w-3 h-3 rotate-90" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Priority</label>
            <div className="relative group">
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full h-10 bg-brand-surface border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-brand-accent/5 transition-all text-center"
              >
                <option value="high">HIGH</option>
                <option value="medium">MEDIUM</option>
                <option value="low">LOW</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary/20">
                <ChevronRight className="w-3 h-3 rotate-90" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between p-4 bg-brand-bg/30 border border-brand-border rounded-2xl group transition-all">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                isScheme ? "bg-brand-accent/10 text-brand-accent" : "bg-brand-primary/5 text-brand-primary/40"
              )}>
                <RefreshCcw className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-brand-primary uppercase tracking-tight">Scheme Mode</p>
                <p className="text-[8px] text-brand-primary/40 font-mono uppercase tracking-widest leading-none">Handle maturity bonus</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setIsScheme(!isScheme)}
              className={cn(
                "w-10 h-5 rounded-full relative transition-all duration-300 border",
                isScheme ? "bg-brand-accent border-brand-accent" : "bg-brand-bg border-brand-border"
              )}
            >
              <div className={cn(
                "absolute top-1 w-2.5 h-2.5 bg-white rounded-full transition-all duration-300",
                isScheme ? "left-6" : "left-1"
              )} />
            </button>
          </div>
        </div>

        {isScheme && (
          <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Estimated Maturity Value</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-brand-primary/10 group-focus-within/input:text-brand-accent transition-colors text-xs">₹</span>
                <input 
                  type="number"
                  value={maturityValue}
                  onChange={(e) => setMaturityValue(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 pl-8 pr-4 font-mono font-bold text-lg text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                  placeholder="e.g. 120000"
                />
              </div>
              <p className="px-1 text-[8px] font-medium text-brand-primary/40 leading-relaxed italic">
                Difference between Target and Maturity will be logged as system alpha.
              </p>
            </div>
          </div>
        )}
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
          {isSubmitting ? 'SAVING...' : goal ? 'Save Changes' : 'Create New Goal'}
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
            {showConfirmDelete ? 'Confirm Delete' : 'Delete Goal'}
          </button>
        )}
      </div>
    </form>
  );
}

function SIPModalContent({ onClose, userId, sip, onDeleteSIP, goals }: { onClose: () => void, userId: string, sip: SIP | null, onDeleteSIP: (id: string) => Promise<void>, goals: Goal[] }) {
  const [name, setName] = useState(sip?.name || '');
  const [amount, setAmount] = useState(sip?.amount.toString() || '');
  const [category, setCategory] = useState(sip?.category || 'Mutual Fund');
  const [dayOfMonth, setDayOfMonth] = useState(sip?.dayOfMonth.toString() || '1');
  const [startDate, setStartDate] = useState(sip?.startDate || new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'active' | 'paused' | 'stopped'>(sip?.status || 'active');
  const [linkedGoalId, setLinkedGoalId] = useState(sip?.linkedGoalId || '');
  const [totalInstallments, setTotalInstallments] = useState(sip?.totalInstallments?.toString() || '12');
  const [schemeType, setSchemeType] = useState<'standard' | 'gold_scheme'>(sip?.schemeType || 'standard');
  const [firstInstallmentAmount, setFirstInstallmentAmount] = useState(sip?.firstInstallmentAmount?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const sipData = {
        name,
        amount: parseFloat(amount),
        category,
        dayOfMonth: parseInt(dayOfMonth),
        startDate,
        status,
        userId,
        linkedGoalId: linkedGoalId || null,
        totalInstallments: parseInt(totalInstallments),
        firstInstallmentAmount: firstInstallmentAmount ? parseFloat(firstInstallmentAmount) : null,
        schemeType
      };

      if (sip?.id) {
        await updateDoc(doc(db, 'sips', sip.id), sipData);
      } else {
        await addDoc(collection(db, 'sips'), sipData);
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sips');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8 px-1">
      <div className="space-y-4">
        <div className="group/input space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">SIP Identity</label>
          <input 
            autoFocus
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., QUANT SMALL CAP FUND"
            className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-sans font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none uppercase tracking-tight"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Monthly Auto-Debet</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-brand-primary/10 group-focus-within/input:text-brand-accent transition-colors text-base">₹</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 pl-8 pr-4 font-mono font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                required
              />
            </div>
          </div>
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Cycle Date</label>
            <input 
              type="number" 
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-mono font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Category</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 bg-brand-bg/30 border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:bg-brand-surface transition-all uppercase"
            >
              <option value="Mutual Fund">MUTUAL FUND</option>
              <option value="Stocks">STOCKS / ETF</option>
              <option value="Gold">DIGITAL GOLD</option>
              <option value="PPF/EPF">PPF / EPF</option>
              <option value="Jewellery Scheme">JEWELLERY SCHEME</option>
            </select>
          </div>
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Scheme Type</label>
            <select 
              value={schemeType}
              onChange={(e) => setSchemeType(e.target.value as any)}
              className="w-full h-10 bg-brand-bg/30 border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:bg-brand-surface transition-all uppercase"
            >
              <option value="standard">STANDARD SIP</option>
              <option value="gold_scheme">GOLD SCHEME (V2)</option>
            </select>
          </div>
        </div>

        {schemeType === 'gold_scheme' && (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1">
            <div className="group/input space-y-2">
              <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Tenure (Months)</label>
              <input 
                type="number" 
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-mono font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                required
              />
            </div>
            <div className="group/input space-y-2">
              <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Initial Pay (Discounted)</label>
              <input 
                type="number" 
                value={firstInstallmentAmount}
                onChange={(e) => setFirstInstallmentAmount(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-mono font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                placeholder="7500"
              />
            </div>
          </div>
        )}

        <div className="group/input space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Status</label>
          <select 
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full h-10 bg-brand-bg/30 border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:bg-brand-surface transition-all uppercase"
          >
            <option value="active">ACTIVE</option>
            <option value="paused">PAUSED</option>
            <option value="stopped">STOPPED</option>
          </select>
        </div>

        <div className="group/input space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Link to Goal</label>
          <select 
            value={linkedGoalId}
            onChange={(e) => setLinkedGoalId(e.target.value)}
            className="w-full h-10 bg-brand-bg/30 border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:bg-brand-surface transition-all uppercase"
          >
            <option value="">NO LINKED GOAL</option>
            {goals.filter(g => g.type === 'investment' || g.type === 'savings').map(g => (
              <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        {sip?.id && (
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm('Delete this SIP configuration? Historial transactions remain but auto-reconciliation will stop.')) return;
              setIsSubmitting(true);
              try {
                await onDeleteSIP(sip.id);
                onClose();
              } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, 'sips');
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="py-4 px-6 bg-rose-500/10 text-rose-500 rounded-lg font-bold text-[9px] uppercase tracking-widest border border-rose-500/20 active:scale-95 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-4 bg-brand-primary text-brand-surface rounded-lg font-bold text-[9px] uppercase tracking-[0.4em] shadow-lg active:scale-[0.98] transition-all border border-white/10 hover:bg-brand-primary/95"
        >
          {isSubmitting ? 'SAVING...' : sip ? 'UPDATE SIP' : 'CREATE SIP'}
        </button>
      </div>
    </form>
  );
}

