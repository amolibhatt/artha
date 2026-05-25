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
  Coins,
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
  Edit2,
  X,
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  Car,
  Film,
  Search,
  LayoutGrid,
  Database,
  History as HistoryIcon,
  Download,
  ArrowUpDown,
  SlidersHorizontal,
  Tag,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Check,
  Circle
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
import { IncomeStreamItem } from './components/IncomeStreamItem';
import { SIPItem } from './components/SIPItem';
import { GoalItem } from './components/GoalItem';
import { GoalTimeline } from './components/GoalTimeline';

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

// Spending Ring Component for Hero
function SpendingRing({ percentage, size = 160, strokeWidth = 14 }: { percentage: number, size?: number, strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  const color = percentage > 85 ? '#f43f5e' : percentage > 60 ? '#f59e0b' : '#10b981';
  
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-[0_0_15px_rgba(255,255,255,0.03)]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      {/* Dynamic Glow */}
      <div 
        className="absolute inset-0 rounded-full blur-2xl opacity-10 pointer-events-none transition-colors duration-1000"
        style={{ backgroundColor: color }}
      />
    </div>
  );
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
  const [goalsSubTab, setGoalsSubTab] = useState<'strategy' | 'timeline' | 'mandates'>('strategy');
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
  const [sipFilterStatus, setSipFilterStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [sipFilterFrequency, setSipFilterFrequency] = useState<'all' | 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly'>('all');
  const [sipSearchQuery, setSipSearchQuery] = useState('');
  const [historySortBy, setHistorySortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [historyTimeframe, setHistoryTimeframe] = useState<'all' | '7days' | '30days' | 'this-month' | 'last-month'>('all');
  const [historySelectedCategory, setHistorySelectedCategory] = useState<string>('All');
  const [historySelectedTag, setHistorySelectedTag] = useState<'all' | 'fixed' | 'avoidable' | 'recurring'>('all');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [ledgerActiveTabMenu, setLedgerActiveTabMenu] = useState<'all' | 'analytics' | 'optimizer' | 'allocator'>('all');
  const [ledgerAllocationPreset, setLedgerAllocationPreset] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [ledgerRunwayBurnRate, setLedgerRunwayBurnRate] = useState<number>(0);
  const [stressTest, setStressTest] = useState<StressTestState>(() => {
    const saved = localStorage.getItem('stressTest');
    return saved ? JSON.parse(saved) : { incomeShock: 1, expenseShock: 1 };
  });
  const [transactionIdToConfirmDelete, setTransactionIdToConfirmDelete] = useState<string | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
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
  const dailyRemaining = dailySpendingPower - spentToday;

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
    // 1. Type filter
    if (filter === 'Expenses' && t.type === 'income') return false;
    if (filter === 'Income' && t.type !== 'income') return false;

    // 2. Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (t.description || '').toLowerCase().includes(q) || 
                    (t.category || '').toLowerCase().includes(q) || 
                    (t.subcategory || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    // 3. Timeframe filter
    if (historyTimeframe !== 'all') {
      const tDate = new Date(t.date);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (historyTimeframe === '7days' && daysDiff > 7) return false;
      if (historyTimeframe === '30days' && daysDiff > 30) return false;

      const tMonth = tDate.getMonth();
      const tYear = tDate.getFullYear();
      const nowMonth = now.getMonth();
      const nowYear = now.getFullYear();

      if (historyTimeframe === 'this-month') {
        if (tMonth !== nowMonth || tYear !== nowYear) return false;
      }
      
      if (historyTimeframe === 'last-month') {
        const targetMonth = nowMonth === 0 ? 11 : nowMonth - 1;
        const targetYear = nowMonth === 0 ? nowYear - 1 : nowYear;
        if (tMonth !== targetMonth || tYear !== targetYear) return false;
      }
    }

    // 4. Category filter
    if (historySelectedCategory !== 'All' && t.category !== historySelectedCategory) return false;

    // 5. Strategic Tag filter
    if (historySelectedTag === 'fixed' && !t.isMandatory) return false;
    if (historySelectedTag === 'avoidable' && !t.isAvoidable) return false;
    if (historySelectedTag === 'recurring' && !t.isRecurring) return false;

    return true;
  });

  // Calculate filtered stats dynamically for the CFO dashboard
  const filteredHistorySummary = filteredTransactions.reduce((acc, t) => {
    if (t.type === 'income') acc.earned += t.amount;
    else if (t.type === 'expense') acc.spent += t.amount;
    else if (t.type === 'refund') acc.spent -= t.amount;
    acc.net = acc.earned - acc.spent;
    return acc;
  }, { spent: 0, earned: 0, net: 0 });

  const filteredAvoidableLoss = filteredTransactions
    .filter(t => (t.type === 'expense' || t.type === 'refund') && t.isAvoidable)
    .reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0);

  const filteredFixedCommitment = filteredTransactions
    .filter(t => (t.type === 'expense' || t.type === 'refund') && t.isMandatory)
    .reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0);

  const filteredExpenseCount = filteredTransactions.filter(t => t.type === 'expense' || t.type === 'refund').length;
  const filteredAverageExpense = filteredExpenseCount > 0 
    ? (filteredTransactions.filter(t => t.type === 'expense' || t.type === 'refund').reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0) / filteredExpenseCount)
    : 0;

  // Sort the filtered transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (historySortBy === 'date-desc') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (historySortBy === 'date-asc') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (historySortBy === 'amount-desc') {
      return b.amount - a.amount;
    }
    if (historySortBy === 'amount-asc') {
      return a.amount - b.amount;
    }
    return 0;
  });

  const groupedTransactions = sortedTransactions
    .reduce((acc: Record<string, Transaction[]>, t) => {
      const date = new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      if (!acc[date]) acc[date] = [];
      acc[date].push(t);
      return acc;
    }, {});

  const filteredCategoryData = filteredTransactions
    .filter(t => t.type === 'expense' || t.type === 'refund')
    .reduce((acc: any[], t) => {
      const name = t.category || 'Uncategorized';
      const existing = acc.find(i => i.name === name);
      const val = t.type === 'expense' ? t.amount : -t.amount;
      if (existing) {
        existing.value += val;
      } else {
        acc.push({ name, value: val });
      }
      return acc;
    }, [])
    .map(i => ({ ...i, value: Math.max(0, i.value) }))
    .filter(i => i.value > 0)
    .sort((a, b) => b.value - a.value);

  const filteredTotalExpense = filteredCategoryData.reduce((acc, i) => acc + i.value, 0);

  const filteredTrendData = [...filteredTransactions]
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
    }, []);

  const uniqueHistoryCategories = ['All', ...Array.from(new Set(transactions.map(t => t.category)))].filter(Boolean);

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ['Date', 'Type', 'Category', 'Subcategory', 'Description', 'Amount', 'Committed/Fixed', 'Avoidable', 'Recurring'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(t => [
        t.date ? new Date(t.date).toISOString().split('T')[0] : '',
        t.type,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        `"${(t.subcategory || '').replace(/"/g, '""')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount,
        t.isMandatory ? 'Yes' : 'No',
        t.isAvoidable ? 'Yes' : 'No',
        t.isRecurring ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `artha_portfolio_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpdate = async (fields: Partial<Transaction>) => {
    if (selectedTransactionIds.length === 0 || !user) return;
    setIsBulkProcessing(true);
    try {
      const batch = writeBatch(db);
      selectedTransactionIds.forEach(id => {
        const ref = doc(db, 'transactions', id);
        batch.update(ref, fields);
      });
      await batch.commit();
      setSelectedTransactionIds([]);
    } catch (error) {
      console.error("Bulk update failed", error);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTransactionIds.length === 0 || !user) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedTransactionIds.length} select entries? This action is irreversible.`)) return;
    setIsBulkProcessing(true);
    try {
      const batch = writeBatch(db);
      selectedTransactionIds.forEach(id => {
        const ref = doc(db, 'transactions', id);
        batch.delete(ref);
      });
      await batch.commit();
      setSelectedTransactionIds([]);
    } catch (error) {
      console.error("Bulk delete failed", error);
    } finally {
      setIsBulkProcessing(false);
    }
  };

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
    .filter(g => g.type === 'savings' || g.type === 'investment' || g.type === 'gold')
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
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9, rotate: -5 }}
              onClick={() => {
                setCommandTab('transaction');
                setShowCommandCenter(true);
              }}
              className="w-16 h-16 bg-brand-primary text-brand-surface rounded-[1.5rem] flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] border border-white/10 group/hub relative overflow-hidden"
              title="Add Entry"
            >
              <div className="absolute inset-0 bg-brand-accent/20 opacity-0 group-hover/hub:opacity-100 transition-opacity" />
              <Plus className="w-9 h-9 text-brand-accent transition-transform duration-500 group-hover/hub:rotate-90 relative z-10" />
            </motion.button>
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
              className="space-y-4 md:space-y-6 px-1"
            >
              {/* Core Financial KPI View */}
              <div className="w-full">
                {/* 1. Amount Remaining (Net Surplus) */}
                <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-brand-primary/20 transition-all duration-300">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">
                        {balance >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        <span>Amount Remaining</span>
                      </div>
                      
                      {/* Strategic Badges for CFO Mode */}
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                          balance >= 0 
                            ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" 
                            : "bg-rose-500/5 text-rose-500 border-rose-500/10"
                        )}>
                          {savingsEfficiency.toFixed(0)}% Savings Rate
                        </span>
                        {runwayMonths > 0 && (
                          <span className="text-[8px] font-bold text-brand-accent uppercase tracking-wider bg-brand-accent/5 px-2 py-0.5 rounded border border-brand-accent/10 flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            {runwayMonths.toFixed(1)}m Runway
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className={cn(
                        "text-3xl font-mono font-bold tracking-tight leading-none",
                        balance >= 0 ? "text-brand-primary" : "text-rose-600"
                      )}>
                        {formatCurrency(balance)}
                      </h3>
                      <p className="text-[9px] font-mono text-brand-primary/30 uppercase tracking-widest font-bold">Unallocated Net War Chest</p>
                    </div>

                    {/* Miniature Cash Flow Gauge */}
                    <div className="space-y-1.5 pt-1">
                      <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden border border-brand-border/40 p-[1px]">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0)}%` }}
                          className={cn(
                            "h-full rounded-full",
                            (totalExpenses / (totalIncome || 1)) > 0.8 ? "bg-rose-500" : "bg-brand-primary"
                          )}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[8.5px] font-mono text-brand-primary/40">
                        <span>Spent: {formatCurrency(totalExpenses)}</span>
                        <span>Earned: {formatCurrency(totalIncome)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-4 border-t border-brand-border/40 flex items-center justify-between text-[9.5px]">
                    <span className="text-brand-primary/40 font-medium">Net position surplus cushion</span>
                    <span className="font-mono text-brand-primary/35">Total Income - All Expenses</span>
                  </div>
                </div>
              </div>

              {/* Savings Milestones / Goals Progress Summary */}
              <div className="bg-brand-surface border border-brand-border p-5 rounded-2xl space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)] relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-brand-border/40 pb-2">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Savings Milestones</p>
                    <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Goals Progress</h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-brand-primary/40 bg-brand-bg px-2 py-0.5 rounded border border-brand-border/30">
                    Overall Progress: {totalGoalProgress.toFixed(0)}%
                  </span>
                </div>

                {goals.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goals.map((goal) => {
                      const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                      const isCompleted = pct >= 100;
                      const icon = goal.type === 'debt' 
                        ? <Landmark className="w-3.5 h-3.5 text-brand-accent/70" /> 
                        : goal.type === 'gold' || goal.name.toLowerCase().includes('gold')
                          ? <Coins className="w-3.5 h-3.5 text-amber-500/95" />
                          : goal.name.toLowerCase().includes('emergency') || goal.name.toLowerCase().includes('vault')
                            ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70" />
                            : <PiggyBank className="w-3.5 h-3.5 text-brand-primary/70" />;
                      
                      const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

                      return (
                        <div key={goal.id} className="space-y-1.5 p-3 rounded-2xl bg-brand-bg/30 border border-brand-border/20 flex flex-col justify-between">
                          <div className="flex justify-between items-start text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-brand-primary/5 border border-brand-border/40 flex items-center justify-center shrink-0">
                                {icon}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-brand-primary truncate max-w-[150px]">{goal.name}</p>
                                <p className="text-[8px] font-bold text-brand-primary/40 uppercase tracking-wider mt-0.5">
                                  {goal.type === 'debt' ? 'Debt Payoff' : goal.type === 'gold' ? 'Gold Goal' : 'Savings Goal'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end leading-none">
                              <span className={cn(
                                "font-mono font-bold text-xs",
                                isCompleted ? "text-emerald-500" : "text-brand-primary"
                              )}>
                                {pct.toFixed(0)}% Done
                              </span>
                              {isCompleted ? (
                                <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider mt-1 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Fully Saved!
                                </span>
                              ) : (
                                <span className="text-[8.5px] font-medium text-brand-primary/50 mt-1">
                                  {formatCurrency(remaining)} left
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="h-2 w-full bg-brand-bg rounded-lg overflow-hidden p-[1px] border border-brand-border/30 mt-2">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, pct)}%` }}
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                isCompleted 
                                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]" 
                                  : goal.type === 'debt' 
                                    ? "bg-brand-accent animate-pulse" 
                                    : "bg-brand-primary"
                              )}
                            />
                          </div>

                          {/* Friendly detail text */}
                          <div className="flex justify-between text-[9px] text-brand-primary/40 font-medium mt-1">
                            <span>Saved {formatCurrency(goal.currentAmount)}</span>
                            <span>Target of {formatCurrency(goal.targetAmount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-brand-primary/30 space-y-2">
                    <p className="text-xs font-mono">No financial goals defined.</p>
                    <button
                      onClick={() => { setCommandTab('goal'); setShowCommandCenter(true); }}
                      className="px-3 py-1 bg-brand-primary text-brand-surface rounded text-[8px] font-bold uppercase tracking-wider"
                    >
                      Create Goal
                    </button>
                  </div>
                )}

                {goals.length > 0 && (
                  <div className="pt-2">
                    <button 
                      onClick={() => setActiveTab('goals')}
                      className="w-full py-2 bg-brand-bg hover:bg-brand-primary/5 text-brand-primary border border-brand-border rounded-xl text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                    >
                      <span>View & Manage All {goals.length} Goals</span>
                      <ArrowRight className="w-3 h-3 text-brand-accent" />
                    </button>
                  </div>
                )}
              </div>

              {/* Cost Center Category Outlays */}
              <div className="bg-brand-surface border border-brand-border p-5 rounded-xl space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                <div className="flex justify-between items-center border-b border-brand-border/40 pb-2">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Sectors & Outlays</p>
                    <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Category-wise Spending</h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-brand-primary/40 bg-brand-bg px-2 py-0.5 rounded border border-brand-border/30">
                    Total: {formatCurrency(categoryData.reduce((acc, c) => acc + c.value, 0))}
                  </span>
                </div>

                {categoryData.length > 0 ? (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto no-scrollbar pr-1">
                    {categoryData.map((cat, idx) => {
                      const totalSpent = categoryData.reduce((acc, c) => acc + c.value, 0) || 1;
                      const pct = (cat.value / totalSpent) * 100;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-brand-primary/5 border border-brand-border/60 flex items-center justify-center scale-90 shrink-0">
                                {getCategoryIcon(cat.name)}
                              </div>
                              <span className="font-bold text-brand-primary truncate max-w-[120px] uppercase tracking-tight">{cat.name}</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 font-mono">
                              <span className="font-bold text-brand-primary">{formatCurrency(cat.value)}</span>
                              <span className="text-[8.5px] text-brand-primary/45">({pct.toFixed(0)}%)</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-brand-bg rounded-lg overflow-hidden p-[1px] border border-brand-border/40">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              className="h-full bg-brand-accent rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-brand-primary/30 space-y-1">
                    <p className="text-xs font-mono">No category-wise outlays registered yet.</p>
                    <p className="text-[8px] font-bold uppercase tracking-wider">Log an expense to populate data metrics</p>
                  </div>
                )}
              </div>

              {/* AI CFO Strategic Pulse Briefing Only */}
              <div className="bg-brand-surface border border-brand-border p-5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">
                    <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
                    <span>AI CFO Strategic Pulse Briefing</span>
                  </div>
                  <p className="text-sm font-sans font-medium text-brand-primary/80 leading-relaxed">
                    {insights[0] || "Your active strategist is compiling raw cash flows. Your McKinsey-style roadmap will auto-synthesize here as transactions are fed."}
                  </p>
                </div>
                <div className="pt-2">
                  <button 
                    onClick={() => setActiveTab('insights')}
                    className="inline-flex items-center gap-1.5 text-[9px] font-black hover:text-brand-accent text-brand-primary uppercase tracking-widest hover:gap-3 transition-all font-mono"
                  >
                    <span>Analyze Strategic Scenarios</span>
                    <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 md:space-y-8 px-1"
            >
              {/* McKinsey-Grade Ledger Tab & Control Deck */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-brand-border pb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 bg-brand-accent/5 border border-brand-accent/15 text-brand-accent rounded font-bold">
                      Corporate CFO Engine
                    </span>
                    <h2 className="section-header !mb-0 !text-xl tracking-tight">Financial Ledger Workspace</h2>
                  </div>
                  <p className="data-label">Comprehensive audited cash flow registers, multi-dimensional query index, and dynamic allocation overlays</p>
                </div>

                {/* Subview Toggle deck */}
                <div className="flex flex-wrap items-center bg-brand-bg p-1 rounded-xl border border-brand-border gap-0.5 shadow-sm">
                  {(['all', 'analytics', 'optimizer', 'allocator'] as const).map((tabId) => {
                    const labels: Record<string, string> = {
                      all: "📜 Ledger Feed",
                      analytics: "📊 Velocity",
                      optimizer: "🛡️ Cost Optimizer",
                      allocator: "💰 Cushion Allocator",
                    };
                    return (
                      <button
                        key={tabId}
                        onClick={() => {
                          setLedgerActiveTabMenu(tabId);
                          // Sync standard filters for better visual experience
                          if (tabId === 'optimizer') {
                            setHistorySelectedTag('avoidable');
                          } else if (tabId === 'all') {
                            setHistorySelectedTag('all');
                          }
                        }}
                        className={cn(
                          "px-3 py-2 rounded-lg text-[9.5px] font-mono font-bold uppercase tracking-wider transition-all duration-250 whitespace-nowrap",
                          ledgerActiveTabMenu === tabId
                            ? "bg-brand-primary text-brand-surface font-black"
                            : "text-brand-primary/45 hover:text-brand-primary hover:bg-brand-surface/30"
                        )}
                      >
                        {labels[tabId]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* McKinsey Executive Metrics Corridor */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
                {/* 1. Net reserve */}
                <div className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-brand-primary/20 transition-all duration-200 shadow-sm">
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Strategic Cushion</span>
                    <h3 className={cn(
                      "text-sm sm:text-base font-mono font-black tracking-tight",
                      filteredHistorySummary.net >= 0 ? "text-brand-primary" : "text-rose-500"
                    )}>
                      {filteredHistorySummary.net >= 0 ? '+' : ''}{formatCurrency(filteredHistorySummary.net)}
                    </h3>
                  </div>
                  <Wallet className="w-4 h-4 text-brand-primary/20 shrink-0" />
                </div>

                {/* 2. Direct burn */}
                <div className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-brand-primary/20 transition-all duration-200 shadow-sm">
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Direct Burn</span>
                    <h3 className="text-sm sm:text-base font-mono font-black tracking-tight text-brand-primary">
                      {formatCurrency(filteredHistorySummary.spent)}
                    </h3>
                  </div>
                  <TrendingDown className="w-4 h-4 text-rose-500/40 shrink-0" />
                </div>

                {/* 3. Dynamic inflows */}
                <div className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-brand-primary/20 transition-all duration-200 shadow-sm">
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Total Inflows</span>
                    <h3 className="text-sm sm:text-base font-mono font-black tracking-tight text-emerald-550">
                      {formatCurrency(filteredHistorySummary.earned)}
                    </h3>
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-500/40 shrink-0" />
                </div>

                {/* 4. Avoidable Leakage */}
                <div 
                  onClick={() => {
                    setLedgerActiveTabMenu('optimizer');
                    setHistorySelectedTag('avoidable');
                  }}
                  className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-rose-500/35 transition-all duration-200 cursor-pointer group shadow-sm"
                >
                  <div className="space-y-0.5">
                    <span className={cn(
                      "text-[7.5px] font-mono font-bold uppercase tracking-wider block",
                      filteredAvoidableLoss > 0 ? "text-rose-500/80 font-black" : "text-brand-primary/45"
                    )}>Avoidable Leak</span>
                    <h3 className={cn(
                      "text-sm sm:text-base font-mono font-black tracking-tight",
                      filteredAvoidableLoss > 0 ? "text-rose-500 animate-pulse" : "text-brand-primary/30"
                    )}>
                      {formatCurrency(filteredAvoidableLoss)}
                    </h3>
                  </div>
                  <AlertTriangle className={cn("w-4 h-4 group-hover:scale-110 transition-transform shrink-0", filteredAvoidableLoss > 0 ? "text-rose-500" : "text-brand-primary/20")} />
                </div>

                {/* 5. Metrics Index / F-Index Retention Rate */}
                <div className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-brand-primary/20 transition-all duration-200 col-span-2 lg:col-span-1 shadow-sm">
                  {(() => {
                    const retentionRate = filteredHistorySummary.earned > 0 
                      ? ((1 - (filteredHistorySummary.spent / filteredHistorySummary.earned)) * 100)
                      : 0;
                    const captureGrade = retentionRate > 40 ? "Elite" : retentionRate > 15 ? "Healthy" : "Bleed";
                    const scoreColor = retentionRate > 40 ? "text-emerald-500" : retentionRate > 15 ? "text-brand-primary" : "text-rose-500";
                    return (
                      <>
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">F-Index Retention</span>
                          <div className="flex items-center gap-1">
                            <h3 className={cn("text-sm sm:text-base font-mono font-black tracking-tight", scoreColor)}>
                              {retentionRate.toFixed(0)}%
                            </h3>
                            <span className="text-[6px] font-mono font-extrabold uppercase px-1 text-brand-primary/45 border border-brand-border bg-brand-bg rounded truncate">
                              {captureGrade}
                            </span>
                          </div>
                        </div>
                        <ShieldCheck className="w-4 h-4 text-emerald-500/40 shrink-0 ml-1" />
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Dynamic Sub-tab Render Logic */}
              <AnimatePresence mode="wait">
                {ledgerActiveTabMenu === 'all' && (
                  <motion.div
                    key="all_feed"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* SEARCH, SORT, AND MULTI-FILTERING DECK */}
                    <div className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-4 shadow-sm">
                      {/* Top Bar: Search, Quick Tabs, and Toggle */}
                      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                        {/* Search Input Box */}
                        <div className="relative flex-1 group/search">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-primary/30 group-focus-within/search:text-brand-accent transition-colors" />
                          <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search registers, accounts, tags..."
                            className="w-full bg-brand-bg border border-brand-border rounded-xl py-2 pl-9 pr-8 text-xs font-mono font-bold text-brand-primary outline-none focus:border-brand-primary/30 transition-all placeholder:text-brand-primary/20"
                          />
                          {searchQuery && (
                            <button 
                              onClick={() => setSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary/30 hover:text-brand-primary text-xs"
                            >
                              ×
                            </button>
                          )}
                        </div>

                        {/* Quick filter tabs & Toggle Deck */}
                        <div className="flex items-center gap-2">
                          {/* Flow type tabs */}
                          <div className="flex bg-brand-bg p-1 rounded-xl border border-brand-border h-[38px] min-w-[180px]">
                            {(['All', 'Expenses', 'Income'] as const).map(f => (
                              <button 
                                key={f} 
                                onClick={() => setFilter(f)} 
                                className={cn(
                                  "flex-1 text-center py-1 px-1.5 rounded-lg text-[8.5px] font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                                  filter === f 
                                    ? "bg-brand-primary text-brand-surface font-black shadow-sm" 
                                    : "text-brand-primary/40 hover:text-brand-primary"
                                )}
                              >
                                {f}
                              </button>
                            ))}
                          </div>

                          {/* Toggle Advanced Button */}
                          {(() => {
                            const activeAdvCount = (historyTimeframe !== 'all' ? 1 : 0) + 
                                                   (historySelectedCategory !== 'All' ? 1 : 0) + 
                                                   (historySelectedTag !== 'all' ? 1 : 0);
                            return (
                              <button
                                onClick={() => setShowHistoryFilters(!showHistoryFilters)}
                                className={cn(
                                  "h-[38px] px-3 border rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold uppercase transition-all whitespace-nowrap active:scale-95 cursor-pointer shadow-sm relative",
                                  showHistoryFilters 
                                    ? "bg-brand-primary text-brand-surface border-brand-primary" 
                                    : "bg-brand-surface border-brand-border text-brand-primary/60 hover:text-brand-primary hover:border-brand-primary/20"
                                )}
                              >
                                <SlidersHorizontal className="w-3 h-3 shrink-0" />
                                <span className="hidden sm:inline">Advanced</span>
                                {activeAdvCount > 0 && (
                                  <span className="w-4 h-4 rounded-full bg-brand-accent text-brand-surface text-[8px] font-bold font-mono flex items-center justify-center animate-pulse line-none">
                                    {activeAdvCount}
                                  </span>
                                )}
                              </button>
                            );
                          })()}

                          {/* Reset Filters button if active */}
                          {(searchQuery || filter !== 'All' || historyTimeframe !== 'all' || historySelectedCategory !== 'All' || historySelectedTag !== 'all') && (
                            <button 
                              onClick={() => {
                                setSearchQuery('');
                                setFilter('All');
                                setHistoryTimeframe('all');
                                setHistorySelectedCategory('All');
                                setHistorySelectedTag('all');
                              }}
                              className="h-[38px] px-2.5 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-[8.5px] font-mono font-bold text-rose-500 rounded-xl uppercase transition-all hover:border-rose-500/30 active:scale-95 whitespace-nowrap"
                              title="Clear all active ledger queries"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Advanced Filters Drawer (Collapsible) */}
                      {showHistoryFilters && (
                        <div className="pt-3 border-t border-brand-border/40 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Timeframe intervals */}
                            <div className="space-y-1">
                              <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Timeframe Interval</span>
                              <div className="grid grid-cols-5 gap-0.5 bg-brand-bg p-0.5 rounded-lg border border-brand-border">
                                {[
                                  { id: 'all', label: 'All' },
                                  { id: '7days', label: '7D' },
                                  { id: '30days', label: '30D' },
                                  { id: 'this-month', label: '1M' },
                                  { id: 'last-month', label: 'Prev' }
                                ].map(tf => (
                                  <button
                                    key={tf.id}
                                    onClick={() => setHistoryTimeframe(tf.id as any)}
                                    className={cn(
                                      "py-1 text-[7.5px] font-mono font-bold uppercase rounded text-center transition-all",
                                      historyTimeframe === tf.id 
                                        ? "bg-brand-primary text-brand-surface font-black" 
                                        : "text-brand-primary/40 hover:text-brand-primary"
                                    )}
                                  >
                                    {tf.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* CFO Structural Strategy tag */}
                            <div className="space-y-1">
                              <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">CFO Structural Filter</span>
                              <div className="grid grid-cols-4 gap-0.5 bg-brand-bg p-0.5 rounded-lg border border-brand-border">
                                {[
                                  { id: 'all', label: 'All' },
                                  { id: 'fixed', label: 'Fixed' },
                                  { id: 'avoidable', label: 'Leak' },
                                  { id: 'recurring', label: 'Recur' }
                                ].map(tag => (
                                  <button
                                    key={tag.id}
                                    onClick={() => setHistorySelectedTag(tag.id as any)}
                                    className={cn(
                                      "py-1 text-[7.5px] font-mono font-bold uppercase rounded text-center transition-all truncate px-0.5",
                                      historySelectedTag === tag.id 
                                        ? "bg-brand-primary text-brand-surface font-black" 
                                        : "text-brand-primary/40 hover:text-brand-primary"
                                    )}
                                  >
                                    {tag.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Sort mechanisms */}
                            <div className="space-y-1">
                              <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Slick Ordering Method</span>
                              <div className="relative">
                                <select 
                                  value={historySortBy}
                                  onChange={(e) => setHistorySortBy(e.target.value as any)}
                                  className="w-full bg-brand-bg border border-brand-border rounded-lg py-1 px-3 text-[8.5px] font-mono font-bold text-brand-primary outline-none focus:border-brand-primary/30 cursor-pointer appearance-none"
                                >
                                  <option value="date-desc">📆 Date: Newer First</option>
                                  <option value="date-asc">📆 Date: Older First</option>
                                  <option value="amount-desc">🚀 Amount: Highest First</option>
                                  <option value="amount-asc">📉 Amount: Lowest First</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-primary/40 text-[7px] font-mono font-bold">
                                  ▼
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Fast Category filter rail */}
                          {uniqueHistoryCategories.length > 2 && (
                            <div className="space-y-1.5 pt-2 border-t border-brand-border/40">
                              <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5 text-brand-accent/70" />
                                <span>Categorical Fast Filters</span>
                              </span>
                              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-brand-border select-none no-scrollbar">
                                {uniqueHistoryCategories.map(cat => {
                                  const amt = transactions.filter(t => t.category === cat).length;
                                  return (
                                    <button
                                      key={cat}
                                      onClick={() => setHistorySelectedCategory(cat)}
                                      className={cn(
                                        "px-2.5 py-0.5 flex items-center gap-1 rounded-md text-[8px] font-mono font-bold whitespace-nowrap transition-all border shrink-0",
                                        historySelectedCategory === cat
                                          ? "bg-brand-primary text-brand-surface border-brand-primary font-black scale-95"
                                          : "bg-brand-bg text-brand-primary/50 border-brand-border hover:text-brand-primary hover:border-brand-primary/20"
                                      )}
                                    >
                                      <span>{cat}</span>
                                      {cat !== 'All' && (
                                        <span className="text-[7px] opacity-70 font-black">({amt})</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Category Budget Progress Ribbon */}
                    {filteredTotalExpense > 0 && filteredCategoryData.length > 0 && (
                      <div className="bg-brand-surface border border-brand-border rounded-xl p-3.5 space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between pb-1.5 border-b border-brand-border/40 select-none">
                          <span className="text-[8px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">
                            Top Strategic Cost Centroids
                          </span>
                          <span className="text-[7.5px] font-mono font-bold text-brand-primary/30">
                            (Tap centroid capsule to set categorized filter)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {filteredCategoryData.slice(0, 6).map(catData => {
                            const pct = filteredTotalExpense > 0 ? (catData.value / filteredTotalExpense) * 100 : 0;
                            const isSelected = historySelectedCategory === catData.name;
                            return (
                              <button
                                key={catData.name}
                                onClick={() => setHistorySelectedCategory(isSelected ? 'All' : catData.name)}
                                className={cn(
                                  "text-left p-2 rounded-lg border transition-all relative overflow-hidden group select-none cursor-pointer",
                                  isSelected 
                                    ? "bg-brand-primary/5 border-brand-primary" 
                                    : "bg-brand-bg/50 border-brand-border hover:border-brand-primary/20"
                                )}
                              >
                                <div className="absolute bottom-0 left-0 h-0.5 bg-brand-primary/20 transition-all group-hover:bg-brand-primary/40" style={{ width: `${pct}%` }} />
                                <div className="space-y-0.5 relative z-10">
                                  <div className="flex items-center justify-between text-[8px] font-mono font-bold gap-1">
                                    <span className="text-brand-primary/75 truncate uppercase tracking-tight">{catData.name}</span>
                                    <span className={cn(isSelected ? "text-brand-accent animate-pulse font-black" : "text-brand-primary/45")}>
                                      {pct.toFixed(0)}%
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono font-black text-brand-primary block leading-none">
                                    {formatCurrency(catData.value)}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bulk Action Sticky Deck */}
                    <AnimatePresence>
                      {selectedTransactionIds.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-brand-primary text-brand-surface p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg select-none relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/10 rounded-full blur-xl pointer-events-none -mr-8 -mt-8" />
                          <div className="flex items-center gap-2.5 z-10">
                            <button
                              onClick={() => setSelectedTransactionIds([])}
                              className="w-5 h-5 bg-brand-surface/10 hover:bg-brand-surface/20 border border-brand-surface/10 text-brand-surface rounded flex items-center justify-center transition-all cursor-pointer"
                              title="Deselect all"
                            >
                              <X className="w-3 h-3 text-brand-surface" />
                            </button>
                            <div className="space-y-0.5">
                              <h5 className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-brand-surface">
                                Bulk Operations Console
                              </h5>
                              <p className="text-[8px] font-mono font-bold opacity-75">
                                {selectedTransactionIds.length} transaction{selectedTransactionIds.length > 1 ? 's' : ''} selected inside active log
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 z-10 w-full sm:w-auto">
                            <button
                              disabled={isBulkProcessing}
                              onClick={() => handleBulkUpdate({ isAvoidable: true, isMandatory: false })}
                              className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-lg text-[8px] font-mono font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                            >
                              Flag Bleed
                            </button>

                            <button
                              disabled={isBulkProcessing}
                              onClick={() => handleBulkUpdate({ isMandatory: true, isAvoidable: false })}
                              className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg text-[8px] font-mono font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                            >
                              Flag Necessary
                            </button>

                            <button
                              disabled={isBulkProcessing}
                              onClick={() => handleBulkUpdate({ isRecurring: true })}
                              className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-sky-500 hover:bg-sky-455 disabled:opacity-50 text-white rounded-lg text-[8px] font-mono font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                            >
                              Flag Recurring
                            </button>

                            <div className="h-6 w-px bg-brand-surface/25 hidden sm:block mx-1" />

                            <button
                              disabled={isBulkProcessing}
                              onClick={handleBulkDelete}
                              className="flex-1 sm:flex-initial px-3 py-1.5 bg-brand-surface text-rose-500 hover:bg-brand-surface/90 disabled:opacity-50 border border-brand-surface/10 rounded-lg text-[8px] font-mono font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Trash2 className="w-2.5 h-2.5 shrink-0" />
                              <span>Purge</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ACTIONS ROW & RESULTS METRIC COUNTER */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 select-none">
                        {filteredTransactions.length > 0 && (
                          <button
                            onClick={() => {
                              const allFilteredIds = filteredTransactions.map(t => t.id).filter(Boolean) as string[];
                              const allSelected = allFilteredIds.every(id => selectedTransactionIds.includes(id));
                              if (allSelected) {
                                setSelectedTransactionIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                              } else {
                                setSelectedTransactionIds(prev => {
                                  const union = new Set([...prev, ...allFilteredIds]);
                                  return Array.from(union);
                                });
                              }
                            }}
                            className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer scale-95",
                              filteredTransactions.map(t => t.id).filter(Boolean).every(id => selectedTransactionIds.includes(id as string))
                                ? "bg-brand-primary border-brand-primary text-brand-surface"
                                : "border-brand-border hover:border-brand-primary/40 text-transparent"
                            )}
                            title="Toggle select all shown records"
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3] text-brand-surface" />
                          </button>
                        )}
                        <h4 className="text-[10px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest flex items-center gap-1.5">
                          <span>Audited Log Database ({filteredTransactions.length} records)</span>
                          {selectedTransactionIds.length > 0 && (
                            <span className="text-[9px] text-brand-accent font-black">
                              ({selectedTransactionIds.length} selected)
                            </span>
                          )}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleExportCSV}
                          disabled={filteredTransactions.length === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-surface hover:bg-brand-bg disabled:opacity-40 border border-brand-border text-brand-primary rounded-lg text-[9px] font-mono font-bold uppercase transition-all active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                          <span>Export CSV</span>
                        </button>
                      </div>
                    </div>

                    {/* DIRECT LEDGER ROW RENDER ENGINE */}
                    <div className="space-y-6">
                      {filteredTransactions.length === 0 ? (
                        <div className="bg-brand-surface border border-brand-border border-dashed rounded-[1rem] p-12 text-center space-y-4">
                          <div className="w-12 h-12 bg-brand-bg rounded-xl flex items-center justify-center mx-auto text-brand-primary/10 border border-brand-border/30">
                            <HistoryIcon className="w-6 h-6 animate-spin" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-brand-primary">No database matches resolved</p>
                            <p className="text-[9px] text-brand-primary/45 font-mono max-w-sm mx-auto leading-normal">
                              The active strategist found no logs within matching queries. Expand filters or record a new transaction.
                            </p>
                          </div>
                          <button 
                            onClick={() => {
                              setSearchQuery('');
                              setFilter('All');
                              setHistoryTimeframe('all');
                              setHistorySelectedCategory('All');
                              setHistorySelectedTag('all');
                            }}
                            className="px-4 py-2 bg-brand-surface hover:bg-brand-bg text-brand-primary border border-brand-border rounded-xl text-[9px] font-mono font-bold uppercase tracking-wider transition-all active:scale-95"
                          >
                            Reset System Filters
                          </button>
                        </div>
                      ) : Object.entries(groupedTransactions).map(([date, items]) => (
                        <motion.div 
                          key={date} 
                          variants={listContainer}
                          initial="hidden"
                          whileInView="show"
                          viewport={{ once: true }}
                          className="space-y-3"
                        >
                          {/* Segment separator sticky bar */}
                          <motion.div variants={listItem} className="flex items-center gap-3">
                            <span className="text-[9px] font-mono font-bold text-brand-primary/45 bg-brand-surface border border-brand-border px-2.5 py-0.5 rounded select-none shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                              {date}
                            </span>
                            <div className="h-px flex-1 bg-brand-border/30" />
                          </motion.div>

                          {/* Actionable item stack */}
                          <div className="bg-brand-surface border border-brand-border/60 rounded-xl overflow-hidden divide-y divide-brand-border/30 shadow-sm">
                            {items.map(t => {
                              const isIncomeFlow = t.type === 'income' || t.type === 'refund';
                              const isSelected = t.id ? selectedTransactionIds.includes(t.id) : false;
                              const isExpanded = t.id ? expandedTransactionId === t.id : false;
                              return (
                                <div key={t.id} className="flex flex-col">
                                  <motion.div 
                                    variants={listItem}
                                    layoutId={t.id}
                                    onClick={() => {
                                      if (t.id) {
                                        setExpandedTransactionId(isExpanded ? null : t.id);
                                      }
                                    }}
                                    className={cn(
                                      "hover:bg-brand-bg/45 py-2 px-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group relative transition-colors cursor-pointer select-none",
                                      isExpanded && "bg-brand-bg/20"
                                    )}
                                  >
                                    {/* Left context stripe indicator */}
                                    <div className={cn(
                                      "absolute top-0 left-0 w-0.5 h-full transition-all group-hover:w-1",
                                      isIncomeFlow 
                                        ? "bg-emerald-500" 
                                        : t.isAvoidable 
                                          ? "bg-rose-500" 
                                          : "bg-brand-accent/30"
                                    )} />

                                    {/* Content card columns */}
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-1">
                                      {/* Row Checkbox & Icon */}
                                      <div className="flex items-center gap-2 shrink-0 z-10">
                                        {t.id && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedTransactionIds(prev => 
                                                prev.includes(t.id!) ? prev.filter(id => id !== t.id) : [...prev, t.id!]
                                              );
                                            }}
                                            className={cn(
                                              "w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all cursor-pointer",
                                              isSelected 
                                                ? "bg-brand-primary border-brand-primary text-brand-surface" 
                                                : "border-brand-border bg-brand-bg/40 text-transparent hover:border-brand-primary/45"
                                            )}
                                          >
                                            <Check className="w-2.5 h-2.5 text-brand-surface stroke-[3]" />
                                          </button>
                                        )}
                                        <div className={cn(
                                          "w-7.5 h-7.5 rounded-lg flex items-center justify-center border font-mono transition-all shrink-0 select-none bg-brand-bg/40 text-[10px]",
                                          isIncomeFlow 
                                            ? "text-emerald-400 border-emerald-500/10" 
                                            : t.isAvoidable 
                                              ? "text-rose-450 border-rose-500/10" 
                                              : "text-brand-accent/70 border-brand-border"
                                        )}>
                                          {getCategoryIcon(t.category)}
                                        </div>
                                      </div>

                                      <div className="space-y-0.5 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="text-[11.5px] font-sans font-extrabold text-brand-primary leading-tight truncate max-w-sm uppercase tracking-tight flex items-center gap-1.5">
                                            <span>{t.description}</span>
                                            <ChevronDown className={cn("w-3 h-3 text-brand-primary/30 transition-transform duration-200 shrink-0", isExpanded && "rotate-180 text-brand-accent")} />
                                          </p>
                                          {t.subcategory && (
                                            <span className="px-1 py-0.2 bg-brand-bg border border-brand-border/60 text-[7px] font-mono font-bold text-brand-primary/35 rounded uppercase tracking-wider">
                                              {t.subcategory}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1">
                                          <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 bg-brand-bg/60 px-1 py-0.2 rounded border border-brand-border/40 uppercase">
                                            📂 {t.category}
                                          </span>
                                          {t.isMandatory && (
                                            <span className="px-1 py-0.2 bg-amber-500/5 text-amber-500/90 border border-amber-500/15 text-[7px] font-bold uppercase rounded font-mono select-none">
                                              Necessary Base
                                            </span>
                                          )}
                                          {t.isAvoidable && (
                                            <span className="px-1 py-0.2 bg-rose-500/5 text-rose-500 border border-rose-500/15 text-[7px] font-bold uppercase rounded font-mono select-none animate-pulse">
                                              Bleed Target
                                            </span>
                                          )}
                                          {t.isRecurring && (
                                            <span className="px-1 py-0.2 bg-brand-primary/5 text-brand-primary border border-brand-border/50 text-[7px] font-bold uppercase rounded font-mono select-none">
                                              Fixed Cycle
                                            </span>
                                          )}
                                          {t.linkedGoalId && (
                                            <span className="px-1 py-0.2 bg-emerald-500/5 text-emerald-500 border border-emerald-500/15 text-[7px] font-bold uppercase rounded font-mono select-none">
                                              🎯 Linked Goal
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Cash Volume & Dynamic Actions */}
                                    <div className="flex items-center justify-between sm:justify-end gap-3.5 border-t sm:border-t-0 border-brand-border/20 pt-1.5 sm:pt-0 shrink-0 select-none">
                                      <div className="text-left sm:text-right">
                                        <p className={cn(
                                          "text-xs font-mono font-black tabular-nums leading-none flex items-center sm:justify-end gap-0.5",
                                          isIncomeFlow ? "text-emerald-500" : t.isAvoidable ? "text-rose-450" : "text-brand-primary"
                                        )}>
                                          {isIncomeFlow ? '+' : '-'}{formatCurrency(t.amount)}
                                        </p>
                                        <p className="text-[7px] font-mono text-brand-primary/30 uppercase tracking-widest mt-0.5">
                                          ⏱️ {new Date(t.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      </div>

                                      {/* Simple, prominent, labeled Edit & Delete buttons */}
                                      <div className="flex items-center gap-1.5 pl-3 border-l border-brand-border/30 shrink-0">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTransaction(t);
                                            setCommandTab('transaction');
                                            setShowCommandCenter(true);
                                          }}
                                          className="px-2 py-1 bg-brand-bg text-brand-primary hover:bg-brand-primary/10 border border-brand-border hover:border-brand-primary/20 rounded-md transition-all cursor-pointer shadow-sm flex items-center gap-1 text-[8.5px] font-mono font-bold uppercase tracking-wider"
                                          title="Modify transaction"
                                        >
                                          <Edit2 className="w-3 h-3 text-brand-accent shrink-0" />
                                          <span>Edit</span>
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDeleteTransaction(t);
                                          }}
                                          className={cn(
                                            "px-2 py-1 border rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm text-[8.5px] font-mono uppercase tracking-wider font-bold",
                                            transactionIdToConfirmDelete === t.id 
                                              ? "bg-rose-500 text-white border-rose-600 animate-pulse px-3.5" 
                                              : "bg-rose-500/5 hover:bg-rose-505 hover:text-white border-rose-500/10 hover:border-rose-500 text-rose-500"
                                          )}
                                          title="Purge transaction asset"
                                        >
                                          <Trash2 className="w-3 h-3 shrink-0" />
                                          <span>{transactionIdToConfirmDelete === t.id ? "Confirm" : "Delete"}</span>
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>

                                  {/* Expandable Strategic Details panel */}
                                  <AnimatePresence initial={false}>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="border-t border-brand-border/40 bg-brand-bg/15 px-4 py-3 space-y-3"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {/* Diagnostic Metadata */}
                                          <div className="space-y-1.5 text-left">
                                            <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Strategic Classification Specs</span>
                                            <div className="text-[9.5px] text-brand-primary/80 leading-relaxed font-mono">
                                              <p>• <b className="text-brand-primary uppercase">Flow Direction:</b> {t.type === 'income' ? 'Cash Input Stream' : t.type === 'refund' ? 'Asymmetrical Offset (Refund)' : 'Reserve Outflow Burn'}</p>
                                              <p>• <b className="text-brand-primary uppercase">Audit Value:</b> {formatCurrency(t.amount)}</p>
                                              <p>• <b className="text-brand-primary uppercase">Timestamp Ref:</b> {new Date(t.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                              {t.linkedGoalId && <p>• <b className="text-emerald-500 uppercase">Linked Strategy Goal:</b> Target asset matched destination.</p>}
                                            </div>
                                          </div>

                                          {/* Advisory projection metrics */}
                                          <div className="space-y-1.5 text-left md:text-right flex flex-col justify-between">
                                            <div>
                                              <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Expected Buffer Lifespam Shift</span>
                                              <p className="text-[9.5px] text-brand-primary/70 leading-relaxed max-w-sm md:ml-auto">
                                                {isIncomeFlow ? (
                                                  <span>This dynamic income inflow strengthens the operating buffer velocity positively.</span>
                                                ) : t.isAvoidable ? (
                                                  <span>Pruning this variable bleed immediately frees up <b className="text-rose-455 font-mono">{formatCurrency(t.amount)}</b>/month, extending the runway buffer index.</span>
                                                ) : (
                                                  <span>This is recognized as a fixed operating baseline expense critical to essential maintenance.</span>
                                                )}
                                              </p>
                                            </div>

                                            {/* Micro-inline Classification Shifter */}
                                            {!isIncomeFlow && (
                                              <div className="pt-2 md:pt-0">
                                                <span className="text-[7px] font-mono font-bold text-brand-primary/35 uppercase tracking-wider block mb-1">CFO Quick Classification Re-alignment</span>
                                                <div className="flex flex-wrap items-center gap-1 md:justify-end">
                                                  <button
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      if (!t.id) return;
                                                      await updateDoc(doc(db, 'transactions', t.id), { isMandatory: true, isAvoidable: false, isRecurring: false });
                                                    }}
                                                    className={cn(
                                                      "px-2 py-1 rounded text-[7.5px] font-mono font-bold uppercase transition-all cursor-pointer border",
                                                      t.isMandatory && !t.isRecurring
                                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30 font-black"
                                                        : "bg-brand-bg text-brand-primary/45 border-brand-border hover:border-brand-primary/20"
                                                    )}
                                                  >
                                                    Required
                                                  </button>
                                                  <button
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      if (!t.id) return;
                                                      await updateDoc(doc(db, 'transactions', t.id), { isMandatory: false, isAvoidable: true, isRecurring: false });
                                                    }}
                                                    className={cn(
                                                      "px-2 py-1 rounded text-[7.5px] font-mono font-bold uppercase transition-all cursor-pointer border",
                                                      t.isAvoidable
                                                        ? "bg-rose-500/10 text-rose-500 border-rose-500/30 font-black"
                                                        : "bg-brand-bg text-brand-primary/45 border-brand-border hover:border-brand-primary/20"
                                                    )}
                                                  >
                                                    Avoidable
                                                  </button>
                                                  <button
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      if (!t.id) return;
                                                      await updateDoc(doc(db, 'transactions', t.id), { isMandatory: true, isAvoidable: false, isRecurring: true });
                                                    }}
                                                    className={cn(
                                                      "px-2 py-1 rounded text-[7.5px] font-mono font-bold uppercase transition-all cursor-pointer border",
                                                      t.isRecurring
                                                        ? "bg-brand-primary/10 text-brand-primary border-brand-primary/30 font-black"
                                                        : "bg-brand-bg text-brand-primary/45 border-brand-border hover:border-brand-primary/20"
                                                    )}
                                                  >
                                                    Fixed Cycle
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: ANALYTICS & DEEP VELOCITY SCAN */}
                {ledgerActiveTabMenu === 'analytics' && (
                  <motion.div
                    key="analytics_section"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    {/* Sector weight map */}
                    <div className="bg-brand-surface border border-brand-border p-5 rounded-xl space-y-5 shadow-sm">
                      <div className="border-b border-brand-border/40 pb-3 flex justify-between items-center">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Outflow Concentration</p>
                          <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Outflow Sector Weight Channels</h3>
                        </div>
                        <PieChartIcon className="w-4 h-4 text-brand-accent/50" />
                      </div>

                      {filteredCategoryData.length > 0 ? (
                        <div className="space-y-4 max-h-[280px] overflow-y-auto no-scrollbar pr-1">
                          {filteredCategoryData.map((cat) => {
                            const pct = filteredTotalExpense > 0 ? (cat.value / filteredTotalExpense) * 100 : 0;
                            return (
                              <div key={cat.name} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6.5 h-6.5 rounded-md bg-brand-primary/5 border border-brand-border/60 flex items-center justify-center shrink-0">
                                      {getCategoryIcon(cat.name)}
                                    </div>
                                    <span className="font-bold text-brand-primary text-[11px] truncate uppercase tracking-tight">{cat.name}</span>
                                  </div>
                                  <div className="flex items-baseline gap-1.5 font-mono text-[10.5px]">
                                    <span className="font-bold text-brand-primary">{formatCurrency(cat.value)}</span>
                                    <span className="text-[8.5px] text-brand-primary/45">({pct.toFixed(0)}%)</span>
                                  </div>
                                </div>
                                <div className="h-1 w-full bg-brand-bg rounded-full overflow-hidden p-[1px] border border-brand-border/40">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                    className="h-full bg-brand-accent rounded-full"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-44 flex items-center justify-center text-center text-brand-primary/25 text-[10px] font-mono">
                          No category metrics recorded in active filters.
                        </div>
                      )}
                    </div>

                    {/* Temporal density map */}
                    <div className="bg-brand-surface border border-brand-border p-5 rounded-xl space-y-5 shadow-sm flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="border-b border-brand-border/40 pb-3 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Direct Burn Intensity</p>
                            <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Incremental Spending Velocity</h3>
                          </div>
                          <Activity className="w-4 h-4 text-brand-primary/30" />
                        </div>

                        <div className="h-44 w-full pt-1">
                          {filteredTrendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={filteredTrendData}>
                                <defs>
                                  <linearGradient id="colorAmountAnalytics" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-brand-accent)" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="var(--color-brand-accent)" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <XAxis 
                                  dataKey="date" 
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 8, fill: 'var(--color-brand-primary)', opacity: 0.3, fontFamily: 'JetBrains Mono' }}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: '#161616', 
                                    border: '1px solid #2B2B2B', 
                                    borderRadius: '8px',
                                    fontSize: '10px',
                                    fontFamily: 'JetBrains Mono',
                                    color: '#FFFFFF'
                                  }}
                                  itemStyle={{
                                    color: '#FFFFFF',
                                    fontWeight: 'bold',
                                    fontSize: '10px'
                                  }}
                                  labelStyle={{
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    fontSize: '10px',
                                    marginBottom: '2px'
                                  }}
                                  formatter={(value: any) => [formatCurrency(Number(value)), "Velocity Outflow"]}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="amount" 
                                  stroke="var(--color-brand-accent)" 
                                  fillOpacity={1} 
                                  fill="url(#colorAmountAnalytics)" 
                                  strokeWidth={1.5}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-center text-brand-primary/20 text-[10px] font-mono">
                              No chronological activity trend compiled.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-brand-border/40">
                        <div className="space-y-0.5 text-left">
                          <span className="text-[8px] font-mono text-brand-primary/45 uppercase tracking-wide block">Daily Burn Power</span>
                          <p className="text-sm font-mono font-bold text-brand-primary">
                            {formatCurrency(filteredTrendData.length > 0 ? (filteredHistorySummary.spent / Math.max(1, filteredTrendData.length)) : 0)}
                          </p>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[8px] font-mono text-brand-primary/45 uppercase tracking-wide block">Leverage Ratio</span>
                          <p className="text-sm font-mono font-bold text-emerald-500">
                            {(filteredHistorySummary.spent > 0 ? (filteredHistorySummary.earned / filteredHistorySummary.spent) : 1).toFixed(1)}x
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: MCKINSEY COST OPTIMIZER */}
                {ledgerActiveTabMenu === 'optimizer' && (
                  <motion.div
                    key="optimizer_section"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {/* Alert Hub Card */}
                    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full blur-2xl pointer-events-none -mr-16 -mt-16" />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-rose-500 animate-pulse" />
                            <h3 className="text-xs font-sans font-black uppercase tracking-wider text-rose-500">McKinsey Variable Leakage Scanner</h3>
                          </div>
                          <p className="text-[11px] font-sans text-brand-primary/75 max-w-2xl leading-relaxed">
                            The analytical scanner found <b className="text-rose-450">{filteredTransactions.filter(t => t.isAvoidable).length} variable leakage entries</b> draining a cumulative velocity of <b className="text-rose-450 font-mono">{formatCurrency(filteredAvoidableLoss)}</b> of active capital buffers. Pruning these targets boosts dynamic F-Index efficiency immediately.
                          </p>
                        </div>

                        {/* Reclassify tool button info */}
                        <div className="px-3.5 py-2 bg-rose-500/5 border border-rose-500/10 rounded-lg text-center shrink-0">
                          <span className="text-[8px] font-mono font-bold block text-rose-500/60 uppercase">Aggreagate Leaked Base</span>
                          <span className="text-base font-mono font-black text-rose-500">{formatCurrency(filteredAvoidableLoss)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Scan result list */}
                    <div className="space-y-4">
                      {filteredTransactions.filter(t => t.isAvoidable).length === 0 ? (
                        <div className="bg-brand-surface border border-brand-border border-dashed rounded-xl p-12 text-center space-y-3">
                          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-brand-primary uppercase tracking-tight">Cushion Optimized & Fully Pruned</p>
                            <p className="text-[9px] text-brand-primary/40 font-mono max-w-xs mx-auto">
                              No variable leakages exist within matching filters. Frictional operating loss is at 0.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filteredTransactions.filter(t => t.isAvoidable).map((t) => {
                            // contextual advisory directives matching McKinsey guidelines
                            let diagnosticTactic = "Discretionary variable bleed. Strategist suggests cutting immediate cost payload to protect reserves.";
                            const desc = t.description.toLowerCase();
                            const cat = t.category.toLowerCase();
                            if (desc.includes('swiggy') || desc.includes('zomato') || cat.includes('dining')) {
                              diagnosticTactic = "Frictional Lifestyle Bleeding. Limit orders to prime milestones; pre-commit a micro-budget layout of 1.5% of income to restrain impulse.";
                            } else if (desc.includes('amazon') || desc.includes('flipkart') || cat.includes('shopping')) {
                              diagnosticTactic = "Impulse Checkout Leak. Inject an operational delay of 48 hours before finalized purchase. Establish strict waiting queues.";
                            } else if (desc.includes('uber') || desc.includes('ola') || cat.includes('transport') || desc.includes('cab')) {
                              diagnosticTactic = "Frictional Commuter Overhead. Compare dynamic surge premium cost vs structured transport modes. Optimize micro-trip density.";
                            } else if (cat.includes('subscriptions') || desc.includes('netflix')) {
                              diagnosticTactic = "Digital Shelf Leakage. Prune subscriptions under 3 active monthly hours. Rotate cycles seasonally instead of overlapping feeds.";
                            }

                            return (
                              <div 
                                key={t.id}
                                className="bg-brand-surface border border-brand-border p-4 rounded-xl space-y-3 relative hover:border-rose-500/30 transition-all duration-200"
                              >
                                <div className="absolute top-4 right-4 text-xs font-mono font-black text-rose-400">
                                  -{formatCurrency(t.amount)}
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[7.5px] font-mono font-bold bg-brand-bg px-2 py-0.5 border border-brand-border rounded uppercase text-brand-primary/50">
                                      {t.category}
                                    </span>
                                    {t.subcategory && (
                                      <span className="text-[7.5px] font-mono font-bold text-brand-primary/25">
                                        / {t.subcategory}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs font-black uppercase tracking-tight text-brand-primary leading-tight">
                                    {t.description}
                                  </h4>
                                </div>

                                {/* Advisory Directive Box styled like McKinsey presentation */}
                                <div className="bg-brand-bg/60 p-2.5 rounded border border-brand-border/60 text-[9px] font-sans text-brand-primary/80 leading-relaxed italic border-l-2 border-l-rose-500">
                                  <span className="font-mono text-[7px] font-bold text-rose-500 block uppercase tracking-wider not-italic mb-0.5">Tactical Pruning Directive:</span>
                                  "{diagnosticTactic}"
                                </div>

                                {/* PERSISTENCE ACTIONS */}
                                <div className="flex items-center justify-between pt-2 border-t border-brand-border/40 text-[9.5px] gap-2">
                                  {/* Action items stack */}
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={async () => {
                                        if (!t.id) return;
                                        try {
                                          // set mandatory = true and avoidable = false inside database directly!
                                          await updateDoc(doc(db, 'transactions', t.id), {
                                            isMandatory: true,
                                            isAvoidable: false
                                          });
                                        } catch (error) {
                                          console.error("Reclassification failed", error);
                                        }
                                      }}
                                      className="text-[8px] font-mono font-bold uppercase text-brand-primary/45 hover:text-brand-primary bg-brand-bg px-2.5 py-1.5 rounded border border-brand-border cursor-pointer active:scale-95"
                                    >
                                      Required Core
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingTransaction(t);
                                        setCommandTab('transaction');
                                        setShowCommandCenter(true);
                                      }}
                                      className="px-2 py-1 bg-brand-bg hover:bg-brand-primary/10 text-brand-primary border border-brand-border hover:border-brand-primary/20 rounded transition-all cursor-pointer shadow-sm flex items-center gap-1 text-[8.5px] font-mono font-bold uppercase tracking-wider"
                                      title="Modify transaction"
                                    >
                                      <Edit2 className="w-3 h-3 text-brand-accent shrink-0" />
                                      <span>Edit</span>
                                    </button>
                                  </div>

                                  {/* Direct delete action */}
                                  <button
                                    onClick={() => {
                                      setTransactionIdToConfirmDelete(t.id || null);
                                      handleDeleteTransaction(t);
                                    }}
                                    className={cn(
                                      "px-2.5 py-1 font-mono text-[8px] uppercase font-black rounded border cursor-pointer transition-all flex items-center gap-1 shadow-sm",
                                      transactionIdToConfirmDelete === t.id 
                                        ? "bg-rose-500 text-white border-rose-600 animate-pulse px-3.5" 
                                        : "bg-rose-500/5 hover:bg-rose-500 hover:text-white border-rose-500/10 hover:border-rose-500 text-rose-500"
                                    )}
                                  >
                                    <Trash2 className="w-3 h-3 shrink-0" />
                                    <span>{transactionIdToConfirmDelete === t.id ? "Confirm" : "Prune Cost"}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* TAB 4: CAPITAL CUSHION ALLOCATOR & RUNWAY MODEL */}
                {ledgerActiveTabMenu === 'allocator' && (
                  <motion.div
                    key="allocator_section"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-6"
                  >
                    {/* Simulator and preset selector */}
                    <div className="lg:col-span-7 bg-brand-surface border border-brand-border p-5 rounded-xl space-y-6 shadow-sm">
                      <div className="border-b border-brand-border/40 pb-3">
                        <span className="text-[9px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest block">Unallocated Allocation</span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Dynamic Capital Surplus Allocator</h3>
                      </div>

                      {/* Warning or cockpit */}
                      {filteredHistorySummary.net <= 0 ? (
                        <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl text-center space-y-2">
                          <AlertTriangle className="w-6 h-6 text-rose-500 mx-auto" />
                          <p className="text-xs font-bold text-brand-primary uppercase">Reserve Deficit</p>
                          <p className="text-[9px] font-mono text-brand-primary/40 max-w-sm mx-auto leading-normal">
                            Aggregate unallocated dynamic buffer is negative ({formatCurrency(filteredHistorySummary.net)}). Prune leakages under the Optimizer tab to build dynamic capital.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Choose Strategy */}
                          <div className="space-y-3">
                            <span className="text-[8px] font-mono font-bold text-brand-primary/45 uppercase tracking-wide block">Strategic Asset Preset</span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-brand-bg p-1 rounded-xl border border-brand-border">
                              {[
                                { id: 'conservative', label: '🛡️ Conservative (Shield)' },
                                { id: 'balanced', label: '📈 Balanced (McKinsey)' },
                                { id: 'aggressive', label: '⚡ Aggressive (Velocity)' }
                              ].map((preset) => (
                                <button
                                  key={preset.id}
                                  onClick={() => setLedgerAllocationPreset(preset.id as any)}
                                  className={cn(
                                    "py-2 px-1 rounded-lg text-[8px] font-mono font-bold uppercase transition-all select-none truncate text-center",
                                    ledgerAllocationPreset === preset.id
                                      ? "bg-brand-primary text-brand-surface font-black shadow-sm"
                                      : "text-brand-primary/40 hover:text-brand-primary hover:bg-brand-surface/20"
                                  )}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Live Math Bar Distribution based on selected Preset */}
                          {(() => {
                            const cushion = filteredHistorySummary.net;
                            // Distribution metrics
                            let emPct = 80;
                            let sipPct = 0;
                            let debtPct = 20;
                            if (ledgerAllocationPreset === 'balanced') {
                              emPct = 30; sipPct = 40; debtPct = 30;
                            } else if (ledgerAllocationPreset === 'aggressive') {
                              emPct = 25; sipPct = 75; debtPct = 0;
                            }

                            const emVal = cushion * (emPct / 100);
                            const sipVal = cushion * (sipPct / 100);
                            const debtVal = cushion * (debtPct / 100);

                            return (
                              <div className="space-y-5 bg-brand-bg/50 p-4 rounded-xl border border-brand-border/40">
                                <div className="space-y-1">
                                  <span className="text-[8.5px] font-mono text-brand-primary/45 uppercase block">Simulated Allocation map:</span>
                                  <div className="h-3 w-full bg-brand-bg rounded-md overflow-hidden border border-brand-border/40 p-[1.5px] flex">
                                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${emPct}%` }} title={`Emergency Fund: ${emPct}%`} />
                                    <div className="h-full bg-brand-accent transition-all duration-300" style={{ width: `${sipPct}%` }} title={`SIP Channels: ${sipPct}%`} />
                                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${debtPct}%` }} title={`Debt acceleration: ${debtPct}%`} />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                                  <div className="space-y-0.5 border-l-2 border-emerald-500 pl-2">
                                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/40 uppercase">Emergency Fund ({emPct}%)</span>
                                    <p className="text-xs font-mono font-black text-brand-primary">{formatCurrency(emVal)}</p>
                                  </div>
                                  <div className="space-y-0.5 border-l-2 border-brand-accent/70 pl-2">
                                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/40 uppercase">SIP Compounding ({sipPct}%)</span>
                                    <p className="text-xs font-mono font-black text-brand-primary">{formatCurrency(sipVal)}</p>
                                  </div>
                                  <div className="space-y-0.5 border-l-2 border-indigo-500 pl-2">
                                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/40 uppercase">Debt Liquidation ({debtPct}%)</span>
                                    <p className="text-xs font-mono font-black text-brand-primary">{formatCurrency(debtVal)}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Runway Model Dial Column */}
                    <div className="lg:col-span-5 bg-brand-surface border border-brand-border p-5 rounded-xl flex flex-col justify-between shadow-sm">
                      <div className="space-y-5">
                        <div className="border-b border-brand-border/40 pb-3 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Surplus Survival Runway</p>
                            <h3 className="text-xs font-black uppercase tracking-wider text-brand-primary">Survival Capital Runway Estimator</h3>
                          </div>
                          <ShieldCheck className="w-4 h-4 text-emerald-500/60" />
                        </div>

                        {/* Interactive runway configuration slider */}
                        {(() => {
                          const baseBurnMonthly = filteredFixedCommitment > 0 ? filteredFixedCommitment : 30000;
                          const chosenSliderVal = ledgerRunwayBurnRate || baseBurnMonthly;

                          // calculate dynamic runway
                          const totalLiquidEmergencySavings = goals
                            .filter(g => g.type === 'savings' || g.type === 'investment' || g.type === 'gold')
                            .reduce((acc, g) => acc + g.currentAmount, 0);

                          let simulatedSimAddition = 0;
                          if (filteredHistorySummary.net > 0) {
                            let emPct = 80;
                            if (ledgerAllocationPreset === 'balanced') emPct = 30;
                            else if (ledgerAllocationPreset === 'aggressive') emPct = 25;
                            simulatedSimAddition = filteredHistorySummary.net * (emPct / 100);
                          }

                          const finalSimReserves = totalLiquidEmergencySavings + simulatedSimAddition;
                          const survivalRunwayMonths = finalSimReserves / Math.max(100, chosenSliderVal);

                          // Style parameters
                          const metricRating = survivalRunwayMonths > 6 ? "Critical Shield (Elite)" : survivalRunwayMonths > 3 ? "Medium Buffer (Warning)" : "High Volatility Core (Critical)";
                          const diskColor = survivalRunwayMonths > 6 ? "text-emerald-500" : survivalRunwayMonths > 3 ? "text-amber-500" : "text-rose-500";
                          const diskBg = survivalRunwayMonths > 6 ? "bg-emerald-500/5 border-emerald-500/10" : survivalRunwayMonths > 3 ? "bg-amber-500/5 border-amber-500/10" : "bg-rose-500/5 border-rose-500/10";

                          return (
                            <div className="space-y-6">
                              {/* Display Dial */}
                              <div className={cn("p-5 rounded-xl border text-center space-y-2 select-none", diskBg)}>
                                <span className="text-[8px] font-mono text-brand-primary/45 uppercase tracking-wide block">Computed Survival Runway</span>
                                <h2 className={cn("text-4xl font-mono font-black tracking-tight leading-none", diskColor)}>
                                  {survivalRunwayMonths.toFixed(1)} <span className="text-xs uppercase tracking-normal">Months</span>
                                </h2>
                                <span className="text-[7px] font-mono font-extrabold uppercase bg-brand-bg border border-brand-border text-brand-primary/50 px-2 py-0.5 rounded">
                                  {metricRating}
                                </span>
                              </div>

                              {/* Interactive Monthly Burn rate Slider */}
                              <div className="space-y-2 bg-brand-bg/40 p-3.5 rounded-xl border border-brand-border/40">
                                <div className="flex justify-between text-[8px] font-mono text-brand-primary/40 uppercase">
                                  <span>Simulated Monthly Burn</span>
                                  <span className="font-bold text-brand-primary font-mono">{formatCurrency(chosenSliderVal)}</span>
                                </div>
                                <input 
                                  type="range"
                                  min="10000"
                                  max="150000"
                                  step="5000"
                                  value={chosenSliderVal}
                                  onChange={(e) => setLedgerRunwayBurnRate(Number(e.target.value))}
                                  className="w-full h-1.5 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-accent focus:outline-none"
                                />
                                <div className="flex justify-between text-[6.5px] font-mono text-brand-primary/25">
                                  <span>₹10K/mo (Austerity)</span>
                                  <span>₹150K/mo (Leveraged)</span>
                                </div>
                              </div>

                              {/* Math breakdwon indicator */}
                              <div className="space-y-1.5 text-[8.5px] font-mono text-brand-primary/40 mt-2">
                                <div className="flex justify-between">
                                  <span>Total Savings Assets:</span>
                                  <span className="font-bold text-brand-primary">{formatCurrency(totalLiquidEmergencySavings)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Allocated Cushion Portion:</span>
                                  <span className="font-bold text-brand-primary text-emerald-450">+{formatCurrency(simulatedSimAddition)}</span>
                                </div>
                                <div className="h-px bg-brand-border/30" />
                                <div className="flex justify-between font-bold text-brand-primary">
                                  <span>Simulated Reserve Deck:</span>
                                  <span>{formatCurrency(finalSimReserves)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Reset slide button */}
                      <div className="pt-4 border-t border-brand-border/40 text-center">
                        <button
                          onClick={() => {
                            setLedgerRunwayBurnRate(0);
                            setLedgerAllocationPreset('balanced');
                          }}
                          className="text-[8px] font-mono uppercase bg-brand-bg hover:bg-brand-surface/80 border border-brand-border px-3 py-1.5 rounded transition-all active:scale-95"
                        >
                          Reset Estimator Values
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'goals' && (
            <motion.div 
              key="goals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-6 md:space-y-8"
            >
              {/* McKinsey Executive CFO Guidance Panel */}
              <div className="bg-gradient-to-br from-brand-primary/[0.02] to-brand-primary/[0.04] border border-brand-border/60 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase tracking-widest bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded leading-none">
                        SYSTEM ARCHITECTURE
                      </span>
                      <span className="text-[10px] font-mono font-bold text-brand-primary/30 uppercase tracking-wider">• Dynamic Trilateral Allocation</span>
                    </div>
                    <h2 className="text-xl font-black text-brand-primary tracking-tight font-sans">THE THREE PILLARS OF CAPITAL ALLOCATION</h2>
                    <p className="text-xs text-brand-primary/60 max-w-2xl leading-relaxed">
                      To successfully reach wealth targets, you need a cohesive system that links your ultimate objective with your physical capital flows. Artha CFO implements a structured Trilateral Model:
                    </p>
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-1 text-[11px] text-right font-sans font-medium text-brand-primary/40">
                    <p className="uppercase font-bold text-brand-accent">Cash Flow Realism</p>
                    <p className="text-[10px] tracking-tight">Sequence Over Parallel Execution</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="bg-brand-surface border border-brand-border/40 p-4 rounded-xl space-y-1.5 relative overflow-hidden group hover:border-brand-primary/20 transition-all">
                    <div className="flex items-center gap-2 text-brand-primary">
                      <div className="h-6 w-6 rounded-full bg-brand-primary/5 border border-brand-primary/15 flex items-center justify-center text-[10px] font-mono font-bold">1</div>
                      <span className="text-xs font-bold uppercase tracking-wider font-sans">Pillar 1: What</span>
                    </div>
                    <h4 className="text-[11px] font-bold text-brand-primary uppercase tracking-tight">Target Goals & Balances</h4>
                    <p className="text-[10px] text-brand-primary/50 leading-relaxed uppercase">
                      Define the hard numbers of your destination: savings accumulation, liability payoffs, and gold holdings.
                    </p>
                  </div>

                  <div className="bg-brand-surface border border-brand-border/40 p-4 rounded-xl space-y-1.5 relative overflow-hidden group hover:border-indigo-500/20 transition-all">
                    <div className="flex items-center gap-2 text-indigo-600">
                      <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-150 flex items-center justify-center text-[10px] font-mono font-bold">2</div>
                      <span className="text-xs font-bold uppercase tracking-wider font-sans">Pillar 2: When</span>
                    </div>
                    <h4 className="text-[11px] font-bold text-brand-primary uppercase tracking-tight">Timeline Roadmap</h4>
                    <p className="text-[10px] text-brand-primary/50 leading-relaxed uppercase">
                      Track schedule realism. See precise completion dates and run real-time CFO cash flow surplus simulations.
                    </p>
                  </div>

                  <div className="bg-brand-surface border border-brand-border/40 p-4 rounded-xl space-y-1.5 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <div className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-150 flex items-center justify-center text-[10px] font-mono font-bold">3</div>
                      <span className="text-xs font-bold uppercase tracking-wider font-sans">Pillar 3: How</span>
                    </div>
                    <h4 className="text-[11px] font-bold text-brand-primary uppercase tracking-tight">Funding Engines</h4>
                    <p className="text-[10px] text-brand-primary/50 leading-relaxed uppercase">
                      Map the monthly cash inflow (recurring salary/incomes) and systematic wealth auto-save mandates (SIPs) that power Pillars 1 & 2.
                    </p>
                  </div>
                </div>
              </div>

              {/* Improved High-UX Sub-tab Switcher with explicit step labeling */}
              <div className="grid grid-cols-3 gap-2 bg-brand-bg/50 p-1 rounded-2xl border border-brand-border max-w-2xl mx-auto">
                <button 
                  onClick={() => setGoalsSubTab('strategy')}
                  className={cn(
                    "flex flex-col items-center justify-center py-2.5 px-3 rounded-xl transition-all font-sans",
                    goalsSubTab === 'strategy' 
                      ? "bg-brand-primary text-brand-surface shadow-md border border-brand-primary" 
                      : "text-brand-primary/40 hover:text-brand-primary border border-transparent hover:bg-brand-primary/5"
                  )}
                >
                  <span className="text-[8px] font-mono font-black uppercase tracking-widest opacity-60">Pillar 1: WHAT</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">TARGET BALANCES</span>
                </button>

                <button 
                  onClick={() => setGoalsSubTab('timeline')}
                  className={cn(
                    "flex flex-col items-center justify-center py-2.5 px-3 rounded-xl transition-all font-sans",
                    goalsSubTab === 'timeline' 
                      ? "bg-brand-primary text-brand-surface shadow-md border border-brand-primary" 
                      : "text-brand-primary/40 hover:text-brand-primary border border-transparent hover:bg-brand-primary/5"
                  )}
                >
                  <span className="text-[8px] font-mono font-black uppercase tracking-widest opacity-60">Pillar 2: WHEN</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">TIMELINE ROADMAP</span>
                </button>

                <button 
                  onClick={() => setGoalsSubTab('mandates')}
                  className={cn(
                    "flex flex-col items-center justify-center py-2.5 px-3 rounded-xl transition-all font-sans",
                    goalsSubTab === 'mandates' 
                      ? "bg-brand-primary text-brand-surface shadow-md border border-brand-primary" 
                      : "text-brand-primary/40 hover:text-brand-primary border border-transparent hover:bg-brand-primary/5"
                  )}
                >
                  <span className="text-[8px] font-mono font-black uppercase tracking-widest opacity-60">Pillar 3: HOW</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">FUNDING ENGINES</span>
                </button>
              </div>

            {goalsSubTab === 'strategy' ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                {/* Visual Goals Overview Metric Panel */}
                {goals.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-brand-surface p-5 border border-brand-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] font-sans">
                    <div className="space-y-1">
                      <p className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">Total Goal Targets</p>
                      <h3 className="text-xl font-bold text-brand-primary leading-none">
                        {formatCurrency(totalGoalTarget)}
                      </h3>
                      <p className="text-[10px] text-brand-primary/50">Your active saving & payoff targets combined</p>
                    </div>
                    <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-brand-border/40 pt-3 sm:pt-0 sm:pl-4">
                      <p className="text-[9px] font-mono font-bold text-emerald-600 uppercase tracking-widest">Amount Completed</p>
                      <h3 className="text-xl font-bold text-emerald-600 leading-none">
                        {formatCurrency(totalGoalCurrent)}
                      </h3>
                      <p className="text-[10px] text-emerald-600/70">{totalGoalProgress.toFixed(0)}% of your total milestones reached</p>
                    </div>
                    <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-brand-border/40 pt-3 sm:pt-0 sm:pl-4">
                      <p className="text-[9px] font-mono font-bold text-brand-accent uppercase tracking-widest font-sans">Yet to achieve</p>
                      <h3 className="text-xl font-bold text-brand-accent leading-none">
                        {formatCurrency(Math.max(0, totalGoalTarget - totalGoalCurrent))}
                      </h3>
                      <p className="text-[10px] text-brand-primary/50">Fund gap remaining to reach full stability</p>
                    </div>
                  </div>
                )}

                {/* Asset Accumulation Section */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 gap-2 border-b border-brand-border/40 pb-2">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-sans font-black uppercase tracking-wider text-brand-primary leading-none">Savings Goals</h2>
                      <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Active capital growth targets</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="col-span-full py-12 text-center border border-dashed border-brand-border rounded-xl bg-brand-surface/30">
                        <p className="data-label text-brand-primary/25">No accumulation goals defined</p>
                        <p className="text-[8px] font-mono text-brand-primary/20 uppercase tracking-widest mt-1">Capital growth requires intentional allocation</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Liability Management Section */}
                <div className="space-y-4 pt-6 border-t border-brand-border/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 gap-3 border-b border-brand-border/40 pb-2">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-sans font-black uppercase tracking-wider text-brand-accent leading-none">Debts</h2>
                      <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Active liability management</p>
                    </div>
                    {goals.some(g => g.type === 'debt') && (
                      <button 
                        onClick={() => setActiveTab('insights')}
                        className="flex items-center gap-1.5 px-3 py-1 bg-brand-accent text-brand-surface rounded text-[8px] font-bold uppercase tracking-widest hover:bg-brand-accent/90 transition-all shadow-sm group leading-none"
                      >
                        <Zap className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                        Optimize Debts
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="col-span-full py-12 text-center border border-dashed border-brand-border rounded-xl bg-brand-surface/30">
                        <p className="data-label text-brand-primary/25">No active liabilities tracked</p>
                      </div>
                    )}
                  </div>
                </div>

                {goals.length === 0 && (
                  <div className="py-12 text-center">
                    <button 
                       onClick={() => {
                        setCommandTab('goal');
                        setShowCommandCenter(true);
                      }}
                      className="px-6 py-2.5 bg-brand-primary text-brand-surface rounded-lg text-[9px] font-bold uppercase tracking-widest shadow-md hover:scale-105 transition-all"
                    >
                      Create Your First Goal
                    </button>
                  </div>
                )}
              </div>
            ) : goalsSubTab === 'timeline' ? (
              <div className="animate-in fade-in duration-500">
                <GoalTimeline 
                  goals={goals} 
                  onEditGoal={(goal) => {
                    setEditingGoal(goal);
                    setCommandTab('goal');
                    setShowCommandCenter(true);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* Income Streams Section */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 gap-3 border-b border-brand-border/40 pb-2">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-sans font-black uppercase tracking-wider text-brand-primary leading-none">Income Sources</h2>
                      <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Baseline revenue baseline streams</p>
                    </div>
                    <button 
                      onClick={() => {
                        setCommandTab('income');
                        setEditingIncomeStream(null);
                        setShowCommandCenter(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-brand-primary text-brand-surface rounded text-[8px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-sm leading-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Income
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="col-span-full py-12 text-center border border-dashed border-brand-border rounded-xl bg-brand-surface/30">
                        <p className="data-label text-brand-primary/25">No recurring income streams defined</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* SIP Portfolio Section - Conformed with absolute precision to uploaded screenshots */}
                <div className="space-y-6 pt-6 border-t border-brand-border/30">
                  {/* Executive Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 gap-3 border-b border-brand-border/40 pb-2">
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-sans font-black uppercase tracking-wider text-emerald-600 leading-none">Auto-Save Plan</h2>
                      <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Systematic wealth accumulation mandates</p>
                    </div>
                    <button 
                      onClick={() => {
                        setCommandTab('sip');
                        setEditingSip(null);
                        setShowCommandCenter(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-brand-primary text-brand-surface rounded text-[8px] font-bold uppercase tracking-widest hover:bg-brand-primary/90 transition-all shadow-sm leading-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Auto-Save
                    </button>
                  </div>

                  {/* Dynamic Screenshot-inspired SIP Portfolio Dashboard Overview Box */}
                  {(() => {
                    const activeSips = sips.filter(s => s.status === 'active');
                    
                    let dailySum = 0;
                    let weeklySum = 0;
                    let fortnightlySum = 0;
                    let monthlySum = 0;
                    let quarterlySum = 0;
                    let totalMonthlyEquivalent = 0;

                    activeSips.forEach(s => {
                      const amt = s.amount;
                      const freq = (s.frequency || 'monthly') as string;
                      
                      if (freq === 'daily') {
                        dailySum += amt;
                        totalMonthlyEquivalent += amt * 30;
                      } else if (freq === 'weekly') {
                        weeklySum += amt;
                        totalMonthlyEquivalent += amt * 4.33;
                      } else if (freq === 'fortnightly' || freq === '15-days') {
                        fortnightlySum += amt;
                        totalMonthlyEquivalent += amt * 2;
                      } else if (freq === 'quarterly') {
                        quarterlySum += amt;
                        totalMonthlyEquivalent += amt / 3;
                      } else {
                        monthlySum += amt;
                        totalMonthlyEquivalent += amt;
                      }
                    });

                    const formatSipAmountCompactList = (val: number) => {
                      if (val === 0) return '₹0';
                      if (val >= 1000) {
                        const kValue = val / 1000;
                        return `₹${kValue.toFixed(1).replace(/\.0$/, '')}k`;
                      }
                      return `₹${val}`;
                    };

                    const formatMainApproxAmount = (val: number) => {
                      return new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(val);
                    };

                    return (
                      <div className="bg-gradient-to-br from-brand-primary/[0.01] to-brand-primary/[0.03] border border-brand-border/60 rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="space-y-1">
                          <p className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">Contributions this month</p>
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-sans font-black text-brand-primary tracking-tight">
                              {formatMainApproxAmount(totalMonthlyEquivalent)}
                            </h3>
                            <span className="text-xs font-semibold text-brand-primary/40 uppercase">approx.</span>
                          </div>
                        </div>

                        {/* Responsive 3x2 Matrix matching Screenshot */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 pt-3 border-t border-brand-border/30">
                          <div className="space-y-0.5">
                            <span className="block text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Active Plans</span>
                            <span className="text-base font-sans font-black text-brand-primary leading-tight select-all">
                              {activeSips.length}
                            </span>
                          </div>
                          
                          <div className="space-y-0.5 md:border-l md:border-brand-border/30 md:pl-6">
                            <span className="block text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Daily Cycle</span>
                            <span className="text-base font-sans font-black text-brand-primary leading-tight">
                              {formatSipAmountCompactList(dailySum)}
                            </span>
                          </div>

                          <div className="space-y-0.5 border-l border-brand-border/30 pl-6 md:border-l md:border-brand-border/30 md:pl-6">
                            <span className="block text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Weekly Cycle</span>
                            <span className="text-base font-sans font-black text-brand-primary leading-tight">
                              {formatSipAmountCompactList(weeklySum)}
                            </span>
                          </div>

                          <div className="space-y-0.5 border-t border-brand-border/30 pt-4">
                            <span className="block text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest font-sans">Fortnightly (15-days)</span>
                            <span className="text-base font-sans font-black text-brand-primary leading-tight">
                              {formatSipAmountCompactList(fortnightlySum)}
                            </span>
                          </div>

                          <div className="space-y-0.5 border-t border-brand-border/30 pt-4 md:border-l md:border-brand-border/30 md:pl-6">
                            <span className="block text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest">Monthly Cycle</span>
                            <span className="text-base font-sans font-black text-brand-primary leading-tight">
                              {formatSipAmountCompactList(monthlySum)}
                            </span>
                          </div>

                          <div className="space-y-0.5 border-t border-brand-border/30 pt-4 border-l border-brand-border/30 pl-6 md:border-l md:border-brand-border/30 md:pl-6">
                            <span className="block text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest font-sans">Quarterly Cycle</span>
                            <span className="text-base font-sans font-black text-brand-primary leading-tight">
                              {formatSipAmountCompactList(quarterlySum)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Filter Toolbar Section with Full Grouping Capabilities */}
                  <div className="bg-brand-bg/40 p-3 rounded-2xl border border-brand-border/60 space-y-3">
                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Search Bar */}
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          value={sipSearchQuery}
                          onChange={(e) => setSipSearchQuery(e.target.value)}
                          placeholder="SEARCH MANDATES..." 
                          className="w-full bg-brand-surface border border-brand-border/60 rounded-xl py-1.5 pl-4 pr-10 text-[10px] uppercase font-mono font-extrabold text-brand-primary outline-none focus:border-brand-primary/40 transition-all placeholder:text-brand-primary/20"
                        />
                        {sipSearchQuery && (
                          <button 
                            onClick={() => setSipSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-rose-500 font-mono uppercase"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Status Pills Filter */}
                      <div className="flex gap-1 bg-brand-surface p-1 rounded-xl border border-brand-border/60">
                        {(['all', 'active', 'paused'] as const).map(p => (
                          <button 
                            key={p} 
                            onClick={() => setSipFilterStatus(p)}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[8px] font-mono font-extrabold uppercase tracking-widest transition-all leading-none",
                              sipFilterStatus === p 
                                ? "bg-brand-primary text-brand-surface shadow-sm font-black" 
                                : "text-brand-primary/40 hover:text-brand-primary hover:bg-brand-primary/5"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Frequency Pills Filtering Bar */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                      <span className="text-[7.5px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest whitespace-nowrap">Frequency:</span>
                      <div className="flex gap-1">
                        {(['all', 'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly'] as const).map(f => (
                          <button 
                            key={f} 
                            onClick={() => setSipFilterFrequency(f)}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-[8px] font-sans font-bold uppercase transition-all whitespace-nowrap leading-none border",
                              sipFilterFrequency === f 
                                ? "bg-brand-primary text-brand-surface border-brand-primary shadow-sm" 
                                : "bg-brand-surface text-brand-primary/40 border-brand-border/40 hover:text-brand-primary hover:border-brand-border"
                            )}
                          >
                            {f === 'fortnightly' ? '15-days' : f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Render Core Grid List */}
                  {(() => {
                    const filteredSips = sips.filter(sip => {
                      const matchesSearch = sip.name.toLowerCase().includes(sipSearchQuery.toLowerCase()) || 
                        (sip.schemeSubcategory && sip.schemeSubcategory.toLowerCase().includes(sipSearchQuery.toLowerCase()));
                      
                      const matchesStatus = sipFilterStatus === 'all' 
                        ? true 
                        : sipFilterStatus === 'active' 
                          ? sip.status === 'active' 
                          : sip.status === 'paused';
                      
                      const matchesFrequency = sipFilterFrequency === 'all'
                        ? true
                        : sipFilterFrequency === 'fortnightly'
                          ? ((sip.frequency as string) === 'fortnightly' || (sip.frequency as string) === '15-days')
                          : sip.frequency === sipFilterFrequency;
                          
                      return matchesSearch && matchesStatus && matchesFrequency;
                    });

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredSips.map(sip => (
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
                        {filteredSips.length === 0 && (
                          <div className="col-span-full py-12 text-center border border-dashed border-brand-border rounded-xl bg-brand-surface/30">
                            <p className="data-label text-brand-primary/25">No automated plans match your filters</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 gap-2 border-b border-brand-border/40 pb-2">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-sans font-black uppercase tracking-wider text-brand-primary leading-none">Strategy & Logic</h2>
                  <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Compounding simulations and smart models</p>
                </div>
              </div>
              
              <div className="space-y-6">
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

                <div className="pt-6 border-t border-brand-border/30">
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
                
                <div className="pt-6 border-t border-brand-border/30">
                  <DebtOptimization goals={goals} />
                </div>

                 {/* Tactical Deletion & Reset Protocol */}
                <div className="bg-brand-surface border border-rose-500/10 rounded-xl p-4 md:p-5 space-y-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-brand-primary uppercase tracking-wider leading-none">Danger Zone</h4>
                      <p className="text-[8px] text-brand-primary/20 font-bold uppercase tracking-widest mt-0.5">Delete all your data</p>
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-brand-primary/50 leading-relaxed max-w-md">
                    This will permanently delete all your transactions, goals, and history from our secure servers. This action is irreversible.
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
                      "w-full py-2 rounded-lg font-bold text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                      showTotalPurgeConfirm 
                        ? "bg-rose-500 text-white shadow-md animate-pulse" 
                        : "bg-brand-bg border border-rose-500/15 text-rose-500 hover:bg-rose-500/5 hover:border-rose-500/35"
                    )}
                  >
                    {isPurging ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : showTotalPurgeConfirm ? (
                      "Yes, Delete Everything"
                    ) : (
                      "Delete All Data"
                    )}
                  </button>
                </div>

                {/* Secure Node Access / Logout */}
                <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-primary/5 flex items-center justify-center text-brand-primary/45 text-[10px] font-black border border-brand-border/60">
                        {user.displayName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-brand-primary uppercase tracking-wider leading-none">{user.displayName}</h4>
                        <p className="text-[8px] text-brand-primary/20 font-bold uppercase tracking-widest font-mono mt-0.5">Logged In Securely</p>
                      </div>
                    </div>
                    <button 
                      onClick={logout}
                      className="px-3 py-1.5 rounded-lg bg-brand-bg border border-brand-border hover:text-rose-500 hover:border-rose-500/20 text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 leading-none"
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
              <div className="flex gap-1.5 flex-wrap justify-center pb-1">
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
    { name: 'Gold Reserve (SGB)', target: 200000, type: 'gold' as GoalType, isScheme: true, maturityValue: 240000 },
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
                  setIsScheme(tmp.isScheme || false);
                  if (tmp.maturityValue) setMaturityValue(tmp.maturityValue.toString());
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
                <option value="gold">GOLD ACCUMULATION</option>
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

        {type !== 'debt' && (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Target Deadline</label>
              <div className="relative">
                <input 
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-lg py-2 px-3 font-mono font-bold text-xs text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                />
              </div>
              <p className="px-1 text-[7px] font-medium text-brand-primary/40 leading-tight">Expected completion date</p>
            </div>
            <div className="space-y-2">
              <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Monthly Savings Target</label>
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-brand-primary/10 group-focus-within/input:text-brand-accent transition-colors text-xs">₹</span>
                <input 
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded-lg py-2 pl-7 pr-3 font-mono font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                  placeholder="0"
                />
              </div>
              <p className="px-1 text-[7px] font-medium text-brand-primary/40 leading-tight">Amount allocated monthly</p>
            </div>
          </div>
        )}

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
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly'>(sip?.frequency || 'monthly');
  const [schemeSubcategory, setSchemeSubcategory] = useState(sip?.schemeSubcategory || '');
  const [mandateType, setMandateType] = useState<'standard' | 'step-up' | 'amc-sip'>(sip?.mandateType || 'standard');
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
        schemeType,
        frequency,
        schemeSubcategory,
        mandateType
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
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Frequency</label>
            <select 
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full h-10 bg-brand-surface border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:border-brand-accent/30 transition-all uppercase"
            >
              <option value="daily">DAILY</option>
              <option value="weekly">WEEKLY</option>
              <option value="fortnightly">FORTNIGHTLY (15-DAYS)</option>
              <option value="monthly">MONTHLY</option>
              <option value="quarterly">QUARTERLY</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Cycle Date</label>
            <input 
              type="number" 
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="e.g. 5"
              className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-mono font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
              required
              disabled={frequency === 'daily' || frequency === 'weekly'}
            />
          </div>
          <div className="group/input space-y-2">
            <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Mandate Type</label>
            <select 
              value={mandateType}
              onChange={(e) => setMandateType(e.target.value as any)}
              className="w-full h-10 bg-brand-surface border border-brand-border rounded-lg px-4 text-[9px] font-mono font-bold text-brand-primary outline-none appearance-none cursor-pointer focus:border-brand-accent/30 transition-all uppercase"
            >
              <option value="standard">Standard SIP</option>
              <option value="step-up">Step-up (+10% p.a.)</option>
              <option value="amc-sip">Direct AMC SIP</option>
            </select>
          </div>
        </div>

        <div className="group/input space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Scheme Asset Subclass (Subcategory)</label>
          <input 
            type="text" 
            value={schemeSubcategory}
            onChange={(e) => setSchemeSubcategory(e.target.value)}
            placeholder="e.g. ELSS, Flexi Cap, Small Cap, Liquid, Focused"
            className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-sans font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none uppercase tracking-tight"
          />
          <div className="flex gap-1.5 flex-wrap pt-1.5 pl-1 select-none">
            {['ELSS Tax Saver', 'Small Cap', 'Liquid Debt', 'Flexi Cap', 'Large Cap', 'Contra Fund'].map(pill => (
              <button 
                type="button" 
                key={pill}
                onClick={() => setSchemeSubcategory(pill)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[8px] font-mono font-bold tracking-wider border uppercase transition-all duration-150 leading-none",
                  schemeSubcategory.toUpperCase() === pill.toUpperCase()
                    ? "bg-brand-primary text-brand-surface border-brand-primary"
                    : "bg-brand-bg/50 text-brand-primary/40 border-brand-border/60 hover:text-brand-primary hover:border-brand-border"
                )}
              >
                {pill}
              </button>
            ))}
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
            {goals.filter(g => g.type === 'investment' || g.type === 'savings' || g.type === 'gold').map(g => (
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

