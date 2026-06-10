import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, orderBy, limit, getDocFromServer, doc, updateDoc, increment, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db, signIn, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { Transaction, Goal, GoalType, StressTestState, IncomeStream, TransactionType } from './types';
import { formatCurrency, cn } from './lib/utils';
import { 
  Plus, 
  ShieldCheck,
  ShieldAlert,
  Award,
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
import { GoalItem } from './components/GoalItem';
import { GoalTimeline } from './components/GoalTimeline';
import { SavingsMastery } from './components/SavingsMastery';

// Lazy load heavy analytical components
const StrategyInsights = React.lazy(() => import('./components/StrategyInsights').then(m => ({ default: m.StrategyInsights })));
const DebtOptimization = React.lazy(() => import('./components/DebtOptimization').then(m => ({ default: m.DebtOptimization })));
const StressTestConsole = React.lazy(() => import('./components/StressTestConsole').then(m => ({ default: m.StressTestConsole })));

const getContributionDelta = (amount: number, type: TransactionType, category: string, isForcedLink: boolean = false) => {
  if (type === 'refund') return -amount;
  if (isForcedLink) return amount;
  if (type === 'income') return amount;
  if (type === 'expense') {
    const contributionCategories = ['Debt Repayment', 'Investments', 'Savings', 'Investments & EMI', 'Loan Repayment', 'Strategic Savings'];
    if (contributionCategories.includes(category)) {
      return amount;
    }
  }
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
  const [goalsSubTab, setGoalsSubTab] = useState<'strategy' | 'timeline' | 'mandates' | 'surplus' | 'mastery'>('strategy');
  const [allocatorStrategy, setAllocatorStrategy] = useState<'cascade' | 'prorata'>('cascade');
  const [customSurplusInput, setCustomSurplusInput] = useState<string>('');
  const [isApplyingAllocations, setIsApplyingAllocations] = useState(false);
  const [allocationMessage, setAllocationMessage] = useState<string | null>(null);
  const [showBudgetAlert, setShowBudgetAlert] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [incomeStreams, setIncomeStreams] = useState<IncomeStream[]>([]);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [commandTab, setCommandTab] = useState<'transaction' | 'goal' | 'income'>('transaction');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingIncomeStream, setEditingIncomeStream] = useState<IncomeStream | null>(null);
  const [showMobileTip, setShowMobileTip] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Debit' | 'Credit'>('All');
  const [searchQuery, setSearchQuery] = useState('');
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
  const [goalsStressFactor, setGoalsStressFactor] = useState<number>(1.0);
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
  } = useFinancialEngine(transactions, goals, 0, stressTest, [], incomeStreams);

  // Dynamic Gamification System (XP & Level compilation)
  const xpFromGoalsCount = goals.length * 50; 
  const xpFromGoalCompletion = goals.filter(g => g.currentAmount >= g.targetAmount && g.targetAmount > 0).length * 200;
  const savingTransactionsCount = transactions.filter(
    t => t.linkedGoalId || t.category === 'Savings' || t.category === 'Investments & EMI' || t.category === 'Debt Repayment'
  ).length;
  const xpFromTransactions = savingTransactionsCount * 30;
  const xpFromIncomeStreams = incomeStreams.filter(i => i.status === 'active').length * 40;
  const hasActivePrepayment = goals.filter(g => g.type === 'debt').some(d => d.currentAmount > 0);
  const xpFromPrepayment = hasActivePrepayment ? 120 : 0;
  const isStressed = (stressTest.incomeShock !== 1 || stressTest.expenseShock !== 1);
  const xpFromStressAuditing = isStressed ? 80 : 0;
  const totalXP = xpFromGoalsCount + xpFromGoalCompletion + xpFromTransactions + xpFromIncomeStreams + xpFromPrepayment + xpFromStressAuditing;
  const xpPerLevel = 400;
  const currentLevel = Math.floor(totalXP / xpPerLevel) + 1;

  // Allocation Hierarchy - Phase-wise sequence (Stabilization -> Acceleration -> Optimization)
  const stabilizationAllocValue = estimatedFixedCosts + goals.filter(g => g.type === 'debt' || g.name.toLowerCase().includes('emergency')).reduce((acc, g) => {
    if (g.currentAmount >= g.targetAmount) return acc;
    return acc + (g.emi || g.monthlyContribution || (g.targetAmount * 0.05));
  }, 0);

  const accelerationAllocValue = Math.max(0, (monthlyGoalCommitments + sipMandates) - (stabilizationAllocValue - estimatedFixedCosts));
  const optimizationAllocValue = strategicSpendingCeiling;

  // Dynamic Surplus Goal Allocator Logic (Requested by user)
  const computedAllocations = React.useMemo(() => {
    const activeSurplus = customSurplusInput !== '' ? Number(customSurplusInput) : Math.max(0, balance);
    if (activeSurplus <= 0 || goals.length === 0) return [];

    // Filter out goals that are already completed
    const activeGoals = goals.filter(g => (g.targetAmount - g.currentAmount) > 0);
    if (activeGoals.length === 0) return [];

    if (allocatorStrategy === 'cascade') {
      // McKinsey Cascade (Sequential priority-first allocation)
      const sortedGoals = [...activeGoals].sort((a, b) => {
        const aIsDebt = a.type === 'debt' ? 1 : 0;
        const bIsDebt = b.type === 'debt' ? 1 : 0;
        if (aIsDebt !== bIsDebt) return bIsDebt - aIsDebt;

        const aIsEmergency = a.name.toLowerCase().includes('emergency') || a.name.toLowerCase().includes('reserve') ? 1 : 0;
        const bIsEmergency = b.name.toLowerCase().includes('emergency') || b.name.toLowerCase().includes('reserve') ? 1 : 0;
        if (aIsEmergency !== bIsEmergency) return bIsEmergency - aIsEmergency;

        const priorityWeights: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const aWeight = priorityWeights[a.priority || 'medium'] || 2;
        const bWeight = priorityWeights[b.priority || 'medium'] || 2;
        if (aWeight !== bWeight) return bWeight - aWeight;

        const aGap = a.targetAmount - a.currentAmount;
        const bGap = b.targetAmount - b.currentAmount;
        return bGap - aGap; // Larger gap gets priority
      });

      let remainingSurplus = activeSurplus;
      return sortedGoals.map(g => {
        const gap = g.targetAmount - g.currentAmount;
        const allocation = Math.min(remainingSurplus, gap);
        remainingSurplus -= allocation;
        return {
          goal: g,
          suggestedAmount: allocation,
          newAmount: g.currentAmount + allocation,
          newProgress: ((g.currentAmount + allocation) / g.targetAmount) * 100,
        };
      });
    } else {
      // Pro-rata Weighted Allocation
      const goalWeightedGaps = activeGoals.map(g => {
        const gap = g.targetAmount - g.currentAmount;
        let multiplier = 2;
        if (g.type === 'debt') {
          multiplier = 4;
        } else if (g.name.toLowerCase().includes('emergency') || g.name.toLowerCase().includes('reserve') || g.priority === 'high') {
          multiplier = 3;
        } else if (g.priority === 'low') {
          multiplier = 1;
        }
        return {
          goal: g,
          gap,
          weight: gap * multiplier
        };
      });

      const totalWeight = goalWeightedGaps.reduce((acc, current) => acc + current.weight, 0);
      if (totalWeight <= 0) return [];

      let remainingSurplus = activeSurplus;
      const allocations = goalWeightedGaps.map(item => {
        const share = (item.weight / totalWeight) * activeSurplus;
        const proposedAmt = Math.min(item.gap, Math.floor(share));
        return {
          goal: item.goal,
          proposedAmount: proposedAmt,
          gap: item.gap
        };
      });

      let totalProposed = allocations.reduce((acc, curr) => acc + curr.proposedAmount, 0);
      let leftToAllocate = activeSurplus - totalProposed;

      if (leftToAllocate > 0) {
        const sortedByPriority = [...allocations].sort((a, b) => {
          const aPriority = a.goal.priority === 'high' ? 3 : a.goal.priority === 'low' ? 1 : 2;
          const bPriority = b.goal.priority === 'high' ? 3 : b.goal.priority === 'low' ? 1 : 2;
          return bPriority - aPriority;
        });

        for (const item of sortedByPriority) {
          if (leftToAllocate <= 0) break;
          const currentAllocResult = item.proposedAmount;
          const remainingGoalGap = item.gap - currentAllocResult;
          if (remainingGoalGap > 0) {
            const addition = Math.min(leftToAllocate, remainingGoalGap);
            item.proposedAmount += addition;
            leftToAllocate -= addition;
          }
        }
      }

      return allocations.map(item => ({
        goal: item.goal,
        suggestedAmount: item.proposedAmount,
        newAmount: item.goal.currentAmount + item.proposedAmount,
        newProgress: ((item.goal.currentAmount + item.proposedAmount) / item.goal.targetAmount) * 100
      }));
    }
  }, [customSurplusInput, balance, goals, allocatorStrategy]);

  const vulnerableGoalsCount = React.useMemo(() => {
    if (goalsStressFactor === 1.0) return 0;
    const getMonthsBetween = (d1: Date, d2: Date) => {
      const diffMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      return Math.max(1, diffMonths);
    };
    const today = new Date();
    return goals.filter(g => g.type !== 'debt' && (g.targetAmount - g.currentAmount) > 0).filter(goal => {
      const remainingValue = Math.max(0, goal.targetAmount - goal.currentAmount);
      const monthsRemaining = goal.deadline ? getMonthsBetween(today, new Date(goal.deadline)) : 0;
      const requiredMonthly = monthsRemaining > 0 ? Math.ceil(remainingValue / monthsRemaining) : 0;
      const currentContribution = goal.monthlyContribution || 0;
      const stressedContribution = currentContribution * goalsStressFactor;
      return currentContribution > 0 && stressedContribution < requiredMonthly;
    }).length;
  }, [goals, goalsStressFactor]);

  const goalsHealthSummary = React.useMemo(() => {
    const today = new Date();
    let completed = 0;
    let onTrack = 0;
    let deficit = 0;
    let unscheduled = 0;

    const getMonthsBetween = (d1: Date, d2: Date) => {
      const diffMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
      return Math.max(1, diffMonths);
    };

    goals.forEach(goal => {
      if (goal.currentAmount >= goal.targetAmount) {
        completed++;
      } else if (goal.type === 'debt') {
        onTrack++;
      } else if (!goal.deadline) {
        unscheduled++;
      } else {
        const remaining = goal.targetAmount - goal.currentAmount;
        const months = getMonthsBetween(today, new Date(goal.deadline));
        const required = months > 0 ? Math.ceil(remaining / months) : 0;
        const planned = goal.monthlyContribution || 0;
        
        if (planned >= required - 1) {
          onTrack++;
        } else {
          deficit++;
        }
      }
    });

    return { completed, onTrack, deficit, unscheduled, total: goals.length };
  }, [goals]);

  const handleExecuteAllocations = async () => {
    if (computedAllocations.length === 0 || !user) return;
    setIsApplyingAllocations(true);
    setAllocationMessage(null);
    
    try {
      const activeAllocations = computedAllocations.filter(item => item.suggestedAmount > 0);
      if (activeAllocations.length === 0) {
        setAllocationMessage("No active allocations to perform (values must be greater than zero).");
        setIsApplyingAllocations(false);
        return;
      }

      // Update goal amounts in Firestore
      const goalUpdates = activeAllocations.map(item => {
        const goalRef = doc(db, 'goals', item.goal.id!);
        return updateDoc(goalRef, {
          currentAmount: item.newAmount
        });
      });
      await Promise.all(goalUpdates);
      
      // Log matching physical transaction entries so that cash flow history is transparent & complete
      const todayStr = new Date().toISOString();
      const txnLoggers = activeAllocations.map(item => {
        return addDoc(collection(db, 'transactions'), {
          amount: item.suggestedAmount,
          category: item.goal.type === 'debt' ? 'Debt Payoff' : 'Investment Contribution',
          subcategory: item.goal.name,
          date: todayStr,
          description: `Strategic CFO Surplus Allocation to ${item.goal.name}`,
          type: item.goal.type === 'debt' ? 'expense' : 'expense',
          isMandatory: item.goal.type === 'debt',
          isAvoidable: false,
          linkedGoalId: item.goal.id!,
          userId: user.uid
        });
      });
      await Promise.all(txnLoggers);

      setAllocationMessage(`Surplus Savings Allocation Successfully Applied! Distributed cash contributions across ${activeAllocations.length} goals.`);
      setCustomSurplusInput('');
    } catch (error: any) {
      console.error("Savings Allocation Failure:", error);
      setAllocationMessage(`Failed to allocate surplus savings: ${error.message || error}`);
    } finally {
      setIsApplyingAllocations(false);
    }
  };

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
    if (filter === 'Debit' && t.type !== 'expense') return false;
    if (filter === 'Credit' && t.type !== 'income' && t.type !== 'refund') return false;

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
            <div className="h-6 w-[1px] bg-brand-border" />
            <div className="flex flex-col items-end cursor-pointer group" onClick={() => { setActiveTab('goals'); setGoalsSubTab('mastery'); }}>
              <p className="terminal-text !text-brand-primary/20">Capital Mastery</p>
              <div className="flex items-center gap-1.5 px-3 py-0.5 bg-brand-primary/5 hover:bg-brand-accent/10 border border-brand-primary/10 hover:border-brand-accent/20 rounded-full text-[9px] font-bold uppercase tracking-widest mt-0.5 transition-all">
                <Sparkles className="w-2.5 h-2.5 text-brand-accent group-hover:rotate-12 transition-transform" />
                <span>Level {currentLevel}</span>
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

          <div className="lg:hidden flex items-center gap-3">
             <div 
               className="flex items-center gap-1 bg-brand-primary/5 px-2.5 py-1 rounded-full border border-brand-primary/10 text-[8.5px] font-bold uppercase tracking-widest cursor-pointer"
               onClick={() => { setActiveTab('goals'); setGoalsSubTab('mastery'); }}
             >
               <Sparkles className="w-2.5 h-2.5 text-brand-accent animate-pulse" />
               <span>Lvl {currentLevel}</span>
             </div>
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
                {/* 1. Net Cash Surplus Dashboard Card */}
                <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-brand-primary/20 transition-all duration-300">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">
                        {balance >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                        )}
                        <span>Net Cash Flow</span>
                      </div>
                      
                      {/* Strategic Badges for CFO Mode */}
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                          balance >= 0 
                            ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" 
                            : "bg-rose-500/5 text-rose-500 border-rose-500/10"
                        )}>
                          Savings Rate: {savingsEfficiency.toFixed(0)}%
                        </span>
                        {runwayMonths > 0 && (
                          <span className="text-[8px] font-bold text-brand-accent uppercase tracking-wider bg-brand-accent/5 px-2 py-0.5 rounded border border-brand-accent/10 flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Runway: {runwayMonths.toFixed(1)} Months
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
                      <p className="text-[9px] font-mono text-brand-primary/30 uppercase tracking-widest font-bold">Unallocated Cash Cushion</p>
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
                    <span className="text-brand-primary/40 font-medium">Net Monthly Surplus</span>
                    <span className="font-mono text-brand-primary/35">Total Income - Total Expenses</span>
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

              {/* AI CFO Pulse Briefing Only */}
              <div className="bg-brand-surface border border-brand-border p-5 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-widest">
                    <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
                    <span>AI Financial Summary</span>
                  </div>
                  <p className="text-sm font-sans font-medium text-brand-primary/80 leading-relaxed">
                    {insights[0] || "Compiling your cash flows. Your custom savings roadmap will automatically form here as transactions are added."}
                  </p>
                </div>
                <div className="pt-2">
                  <button 
                    onClick={() => setActiveTab('insights')}
                    className="inline-flex items-center gap-1.5 text-[9px] font-black hover:text-brand-accent text-brand-primary uppercase tracking-widest hover:gap-3 transition-all font-mono"
                  >
                    <span>See Detailed Insights</span>
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
              {/* Elegant Ledger Tab & Control Deck */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-brand-border pb-6">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-sans font-black uppercase tracking-wider text-brand-primary leading-none">Transactions & Ledger</h2>
                  <p className="text-[8px] text-brand-primary/40 font-bold uppercase tracking-widest">Review cash flow logs and adjust savings strategies</p>
                </div>

                {/* Subview Toggle deck */}
                <div className="flex items-center bg-brand-bg p-1 rounded-xl border border-brand-border gap-1 shadow-sm overflow-x-auto no-scrollbar max-w-full whitespace-nowrap scroll-smooth">
                  {(['all', 'analytics', 'optimizer', 'allocator'] as const).map((tabId) => {
                    const labels: Record<string, string> = {
                      all: "All Logs",
                      analytics: "Analytics",
                      optimizer: "Optimizer",
                      allocator: "Allocator",
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
                          "px-3 py-1.5 rounded-lg text-[9.5px] font-mono font-bold uppercase tracking-wider transition-all duration-250 shrink-0",
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 w-full">
                {/* 1. Net reserve */}
                <div className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-brand-primary/20 transition-all duration-200 shadow-sm" title="Your direct net surplus (All Income minus All Expenses in current view)">
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Strategic Cushion</span>
                    <span className="text-[6.5px] text-brand-primary/30 font-bold block leading-none">Net savings (Income - Spend)</span>
                    <h3 className={cn(
                      "text-sm sm:text-base font-mono font-black tracking-tight mt-1",
                      filteredHistorySummary.net >= 0 ? "text-brand-primary" : "text-rose-500"
                    )}>
                      {filteredHistorySummary.net >= 0 ? '+' : ''}{formatCurrency(filteredHistorySummary.net)}
                    </h3>
                  </div>
                  <Wallet className="w-4 h-4 text-brand-primary/20 shrink-0" />
                </div>

                {/* 2. Direct burn */}
                <div className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-brand-primary/20 transition-all duration-200 shadow-sm" title="Total expenses occurred in the current active filters">
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Direct Burn</span>
                    <span className="text-[6.5px] text-brand-primary/30 font-bold block leading-none">Total spend / outflow money</span>
                    <h3 className="text-sm sm:text-base font-mono font-black tracking-tight text-brand-primary mt-1">
                      {formatCurrency(filteredHistorySummary.spent)}
                    </h3>
                  </div>
                  <TrendingDown className="w-4 h-4 text-rose-500/40 shrink-0" />
                </div>

                {/* 3. Dynamic inflows */}
                <div className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-brand-primary/20 transition-all duration-200 shadow-sm" title="Total income / deposits in current active filters">
                  <div className="space-y-0.5">
                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Total Inflows</span>
                    <span className="text-[6.5px] text-brand-primary/30 font-bold block leading-none">Total income / deposit money</span>
                    <h3 className="text-sm sm:text-base font-mono font-black tracking-tight text-emerald-550 mt-1">
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
                  title="Total amount spent on avoidable lifestyle categories that could be optimized"
                >
                  <div className="space-y-0.5">
                    <span className={cn(
                      "text-[7.5px] font-mono font-bold uppercase tracking-wider block",
                      filteredAvoidableLoss > 0 ? "text-rose-500/80 font-black" : "text-brand-primary/45"
                    )}>Avoidable Leak</span>
                    <span className="text-[6.5px] text-brand-primary/30 font-bold block leading-none">Waste / avoidable subscriptions</span>
                    <h3 className={cn(
                      "text-sm sm:text-base font-mono font-black tracking-tight mt-1",
                      filteredAvoidableLoss > 0 ? "text-rose-500 animate-pulse" : "text-brand-primary/30"
                    )}>
                      {formatCurrency(filteredAvoidableLoss)}
                    </h3>
                  </div>
                  <AlertTriangle className={cn("w-4 h-4 group-hover:scale-110 transition-transform shrink-0", filteredAvoidableLoss > 0 ? "text-rose-500" : "text-brand-primary/20")} />
                </div>

                {/* 5. Metrics Index / F-Index Retention Rate */}
                <div className="bg-brand-surface border border-brand-border p-2.5 px-3.5 rounded-xl flex items-center justify-between hover:border-brand-primary/20 transition-all duration-200 col-span-1 sm:col-span-2 lg:col-span-1 shadow-sm" title="The percentage of your total income that remains after your expenses (higher is better)">
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
                          <span className="text-[6.5px] text-brand-primary/30 font-bold block leading-none">Percentage of income saved</span>
                          <div className="flex items-center gap-1 mt-1">
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
                      {/* Top Bar: Balanced Grid structure to avoid wrapping on mobile */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        {/* Search Input Box */}
                        <div className="relative md:col-span-5 group/search">
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

                        {/* Debit/Credit Quick Filters and Toggles Row */}
                        <div className="md:col-span-7 flex flex-row items-center gap-2">
                          {/* Flow type tabs - renamed to Debit/Credit matching transactions */}
                          <div className="flex-1 min-w-[150px] flex bg-brand-bg p-1 rounded-xl border border-brand-border h-[38px]">
                            {(['All', 'Debit', 'Credit'] as const).map(f => (
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
                                  "h-[38px] px-3.5 border rounded-xl flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold uppercase transition-all whitespace-nowrap active:scale-95 cursor-pointer shadow-sm relative shrink-0",
                                  showHistoryFilters 
                                    ? "bg-brand-primary text-brand-surface border-brand-primary" 
                                    : "bg-brand-surface border-brand-border text-brand-primary/60 hover:text-brand-primary hover:border-brand-primary/20"
                                )}
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
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
                              className="h-[38px] px-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-[8.5px] font-mono font-bold text-rose-500 rounded-xl uppercase transition-all hover:border-rose-500/30 active:scale-95 whitespace-nowrap shrink-0"
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
                              <span className="text-[7.5px] font-mono font-bold text-brand-primary/45 uppercase tracking-wider block">Expense Strategy Filter</span>
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

                      {/* Active Insights & Summary Panel */}
                      {(searchQuery || filter !== 'All' || historyTimeframe !== 'all' || historySelectedCategory !== 'All' || historySelectedTag !== 'all') && (
                        <div className="mt-3.5 pt-3.5 border-t border-brand-border/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-brand-primary/[0.01]">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse shrink-0"></span>
                              <span className="text-[10px] font-sans font-black text-brand-primary uppercase tracking-tight">Active Filter Insights</span>
                              {searchQuery && (
                                <span className="px-1.5 py-0.2 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-[8px] font-mono font-bold rounded">
                                  Query: "{searchQuery}"
                                </span>
                              )}
                              {filter !== 'All' && (
                                <span className="px-1.5 py-0.2 bg-brand-primary/5 border border-brand-border text-brand-primary/60 text-[8px] font-mono font-bold rounded">
                                  Type: {filter === 'Debit' ? 'Debit (Outflow)' : 'Credit (Inflow)'}
                                </span>
                              )}
                              {historySelectedCategory !== 'All' && (
                                <span className="px-1.5 py-0.2 bg-brand-primary/5 border border-brand-border text-brand-primary/60 text-[8px] font-mono font-bold rounded">
                                  Category: {historySelectedCategory}
                                </span>
                              )}
                              {historyTimeframe !== 'all' && (
                                <span className="px-1.5 py-0.2 bg-brand-primary/5 border border-brand-border text-brand-primary/60 text-[8px] font-mono font-bold rounded">
                                  Timeframe: {historyTimeframe}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-brand-primary/50">
                              Displaying {filteredTransactions.length} of {transactions.length} matching entries.
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-4 flex-wrap md:flex-nowrap pt-2.5 md:pt-0 border-t md:border-t-0 md:border-l border-brand-border/30 w-full md:w-auto md:pl-4">
                            <div>
                              <span className="text-[8px] font-mono font-bold text-brand-primary/45 uppercase tracking-widest block leading-none">Total Outflow (Spent)</span>
                              <p className="text-[13px] font-mono font-black text-rose-500 leading-none mt-1">
                                {formatCurrency(filteredHistorySummary.spent)}
                              </p>
                            </div>
                            <div>
                              <span className="text-[8px] font-mono font-bold text-brand-primary/45 uppercase tracking-widest block leading-none">Total Inflow (Income)</span>
                              <p className="text-[13px] font-mono font-black text-emerald-555 leading-none mt-1">
                                {formatCurrency(filteredHistorySummary.earned)}
                              </p>
                            </div>
                            <div className="border-l border-brand-border/30 pl-4">
                              <span className="text-[8px] font-mono font-bold text-brand-primary/45 uppercase tracking-widest block leading-none">Net savings (Surplus)</span>
                              <p className={cn(
                                "text-[13px] font-mono font-black leading-none mt-1",
                                filteredHistorySummary.net >= 0 ? "text-emerald-555" : "text-rose-500"
                              )}>
                                {filteredHistorySummary.net >= 0 ? '+' : ''}{formatCurrency(filteredHistorySummary.net)}
                              </p>
                            </div>
                          </div>
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
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
                        <h4 className="text-[10px] font-mono font-bold text-brand-primary/30 uppercase tracking-widest flex flex-wrap items-center gap-1.5">
                          <span className="hidden xs:inline">Audited Log Database</span>
                          <span className="xs:hidden">Database</span>
                          <span>({filteredTransactions.length} records)</span>
                          {selectedTransactionIds.length > 0 && (
                            <span className="text-[9px] text-brand-accent font-black">
                              ({selectedTransactionIds.length} selected)
                            </span>
                          )}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button 
                          onClick={handleExportCSV}
                          disabled={filteredTransactions.length === 0}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-surface hover:bg-brand-bg disabled:opacity-40 border border-brand-border text-brand-primary rounded-lg text-[9px] font-mono font-bold uppercase transition-all active:scale-95 w-full sm:w-auto"
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
                                      "hover:bg-brand-bg/45 py-2 px-2.5 md:px-4 flex flex-row items-center justify-between gap-2 group relative transition-colors cursor-pointer select-none overflow-hidden flex-nowrap",
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

                                    {/* Content card columns - purely single line */}
                                    <div className="flex items-center gap-2 min-w-0 flex-1 pl-1 flex-nowrap">
                                      {/* Row Checkbox & Icon */}
                                      <div className="flex items-center gap-1.5 shrink-0 z-10 flex-nowrap">
                                        {t.id && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedTransactionIds(prev => 
                                                prev.includes(t.id!) ? prev.filter(id => id !== t.id) : [...prev, t.id!]
                                              );
                                            }}
                                            className={cn(
                                              "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all cursor-pointer",
                                              isSelected 
                                                ? "bg-brand-primary border-brand-primary text-brand-surface" 
                                                : "border-brand-border bg-brand-bg/40 text-transparent hover:border-brand-primary/45"
                                            )}
                                          >
                                            <Check className="w-2 h-2 text-brand-surface stroke-[3]" />
                                          </button>
                                        )}
                                        <div className={cn(
                                          "w-5.5 h-5.5 rounded flex items-center justify-center border font-mono transition-all shrink-0 select-none bg-brand-bg/40 text-[9px]",
                                          isIncomeFlow 
                                            ? "text-emerald-400 border-emerald-500/10" 
                                            : t.isAvoidable 
                                              ? "text-rose-450 border-rose-500/10" 
                                              : "text-brand-accent/70 border-brand-border"
                                        )}>
                                          {getCategoryIcon(t.category)}
                                        </div>
                                      </div>

                                      {/* Primary information block (strictly no wrap) */}
                                      <div className="flex items-center gap-2 min-w-0 flex-grow flex-nowrap">
                                        <p className="text-[11.5px] font-sans font-black text-brand-primary leading-none truncate uppercase tracking-tight flex items-center gap-1 min-w-0 flex-1 max-w-[100px] xs:max-w-[140px] sm:max-w-[180px] md:max-w-xs">
                                          <span className="truncate">{t.description}</span>
                                          <ChevronDown className={cn("w-2.5 h-2.5 text-brand-primary/30 transition-transform duration-200 shrink-0", isExpanded && "rotate-180 text-brand-accent")} />
                                        </p>
                                        {t.subcategory && (
                                          <span className="hidden xs:inline-block px-1 py-[0.5px] bg-brand-bg border border-brand-border/60 text-[6.5px] font-mono font-bold text-brand-primary/40 rounded uppercase tracking-wider shrink-0 max-w-[55px] xs:max-w-none truncate" title={t.subcategory}>
                                            {t.subcategory}
                                          </span>
                                        )}

                                        {/* Strategy indicator badges (visible on desktop/tab) */}
                                        <div className="hidden sm:flex items-center gap-1 shrink-0">
                                          {t.isMandatory && (
                                            <span className="px-1 py-[0.5px] bg-amber-500/5 text-amber-550 border border-amber-500/15 text-[6.5px] font-bold uppercase rounded font-mono select-none" title="Necessary Base">
                                              NECESSARY
                                            </span>
                                          )}
                                          {t.isAvoidable && (
                                            <span className="px-1 py-[0.5px] bg-rose-500/5 text-rose-500 border border-rose-555/15 text-[6.5px] font-bold uppercase rounded font-mono select-none animate-pulse" title="Bleed Target">
                                              BLEED
                                            </span>
                                          )}
                                          {t.isRecurring && (
                                            <span className="px-1 py-[0.5px] bg-brand-primary/5 text-brand-primary border border-brand-border/50 text-[6.5px] font-bold uppercase rounded font-mono select-none" title="Fixed Cycle">
                                              CYCLE
                                            </span>
                                          )}
                                          {t.linkedGoalId && (
                                            <span className="px-1 py-[0.5px] bg-emerald-500/5 text-emerald-555 border border-emerald-500/15 text-[6.5px] font-bold uppercase rounded font-mono select-none" title="Linked Strategy Goal">
                                              🎯 GOAL
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right section: Cash volume & Micro hover inline action controls */}
                                    <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0 select-none flex-nowrap">
                                      <div className="text-right flex items-center justify-end gap-1.5 shrink-0">
                                        <p className="text-[7.5px] font-mono text-brand-primary/30 uppercase tracking-widest hidden md:inline-block">
                                          ⏱️ {new Date(t.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className={cn(
                                          "text-[11px] font-mono font-black tabular-nums leading-none flex items-center justify-end gap-0.5 w-14 sm:w-18 md:w-20 text-right shrink-0",
                                          isIncomeFlow ? "text-emerald-500" : t.isAvoidable ? "text-rose-455" : "text-brand-primary"
                                        )}>
                                          {isIncomeFlow ? '+' : '-'}{formatCurrency(t.amount)}
                                        </p>
                                      </div>

                                      {/* Minimal, high-precision circular action icon buttons */}
                                      <div className="hidden sm:flex items-center gap-1 pl-1.5 border-l border-brand-border/30 shrink-0 flex-nowrap">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTransaction(t);
                                            setCommandTab('transaction');
                                            setShowCommandCenter(true);
                                          }}
                                          className="w-5.5 h-5.5 rounded-full bg-brand-bg hover:bg-brand-primary/10 border border-brand-border hover:border-brand-primary/20 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
                                          title="Modify transaction"
                                        >
                                          <Edit2 className="w-2.5 h-2.5 text-brand-accent shrink-0" />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDeleteTransaction(t);
                                          }}
                                          className={cn(
                                            "w-5.5 h-5.5 rounded-full border transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm",
                                            transactionIdToConfirmDelete === t.id 
                                              ? "bg-rose-500 text-brand-surface border-rose-650 animate-pulse" 
                                              : "bg-rose-500/5 hover:bg-rose-500 hover:text-brand-surface border-rose-500/10 hover:border-rose-500 text-rose-500"
                                          )}
                                          title={transactionIdToConfirmDelete === t.id ? "Confirm asset deletion" : "Purge transaction asset"}
                                        >
                                          {transactionIdToConfirmDelete === t.id ? (
                                            <Check className="w-2.5 h-2.5 text-brand-surface stroke-[3.5]" />
                                          ) : (
                                            <Trash2 className="w-2.5 h-2.5 shrink-0" />
                                          )}
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
                                                <span className="text-[7px] font-mono font-bold text-brand-primary/35 uppercase tracking-wider block mb-1">Quick Strategy Adjustment</span>
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

                                        {/* Refund Tracking Protocols */}
                                        {t.type === 'expense' && (() => {
                                          const categoryRefunds = transactions.filter(r => r.type === 'refund' && r.relatedTransactionId === t.id);
                                          const totalRefunded = categoryRefunds.reduce((sum, r) => sum + r.amount, 0);
                                          return (
                                            <div className="pt-2.5 border-t border-brand-border/20 mt-1 space-y-2">
                                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-brand-primary/[0.01] p-2.5 rounded-lg border border-brand-border/10">
                                                <div className="space-y-0.5 text-left">
                                                  <span className="text-[7.5px] font-mono font-bold text-sky-500 uppercase tracking-widest block">Refund Tracking Protocol</span>
                                                  {categoryRefunds.length > 0 ? (
                                                    <p className="text-[9.5px] font-sans text-brand-primary/80">
                                                      Recovered <b className="text-emerald-500 font-mono">{formatCurrency(totalRefunded)}</b> of {formatCurrency(t.amount)} original outflow.
                                                    </p>
                                                  ) : (
                                                    <p className="text-[8.5px] font-bold text-brand-primary/40 uppercase tracking-wider">No corresponding credit adjustments logged.</p>
                                                  )}
                                                </div>
                                                
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingTransaction({
                                                      amount: Math.max(0, t.amount - totalRefunded),
                                                      category: t.category,
                                                      subcategory: t.subcategory || '',
                                                      description: `Refund: ${t.description || t.subcategory || t.category}`,
                                                      type: 'refund',
                                                      userId: user?.uid || '',
                                                      date: new Date().toISOString(),
                                                      relatedTransactionId: t.id
                                                    });
                                                    setCommandTab('transaction');
                                                    setShowCommandCenter(true);
                                                  }}
                                                  className="px-2.5 py-1 rounded bg-sky-500/5 hover:bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[8.5px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 shrink-0 self-start sm:self-auto shadow-sm"
                                                >
                                                  <RefreshCcw className="w-3 h-3 text-sky-500" />
                                                  Record Refund
                                                </button>
                                              </div>
                                              
                                              {/* List previous parts of this refund if any */}
                                              {categoryRefunds.length > 0 && (
                                                <div className="space-y-1 pl-2 border-l-2 border-emerald-500/30">
                                                  {categoryRefunds.map(ref => (
                                                    <div key={ref.id} className="flex items-center justify-between gap-4 text-[8px] font-mono text-brand-primary/60">
                                                      <span>• {ref.description || 'Refund Stream'} ({new Date(ref.date).toLocaleDateString('en-GB')})</span>
                                                      <span className="text-emerald-500 font-bold">+{formatCurrency(ref.amount)}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {/* Mobile operations bar inside expanded card (only visible on mobile) */}
                                        <div className="flex sm:hidden items-center justify-end gap-2 pt-2.5 border-t border-brand-border/20 mt-1">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingTransaction(t);
                                              setCommandTab('transaction');
                                              setShowCommandCenter(true);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border text-[9px] font-mono font-bold uppercase tracking-wider text-brand-primary flex items-center gap-1.5 active:scale-95 transition-all"
                                          >
                                            <Edit2 className="w-3 h-3 text-brand-accent shrink-0" />
                                            <span>Modify</span>
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleDeleteTransaction(t);
                                            }}
                                            className={cn(
                                              "px-3 py-1.5 rounded-lg border text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95",
                                              transactionIdToConfirmDelete === t.id 
                                                ? "bg-rose-500 text-brand-surface border-rose-650 animate-pulse" 
                                                : "bg-rose-500/5 text-rose-500 border-rose-500/10 hover:bg-rose-500 hover:text-brand-surface"
                                            )}
                                          >
                                            {transactionIdToConfirmDelete === t.id ? (
                                              <>
                                                <Check className="w-3 h-3 text-brand-surface stroke-[3]" />
                                                <span>Confirm Purge</span>
                                              </>
                                            ) : (
                                              <>
                                                <Trash2 className="w-3 h-3 shrink-0" />
                                                <span>Purge</span>
                                              </>
                                            )}
                                          </button>
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-brand-border/40">
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
                            <h3 className="text-xs font-sans font-black uppercase tracking-wider text-rose-500">Unnecessary Expense Detector</h3>
                          </div>
                          <p className="text-[11px] font-sans text-brand-primary/75 max-w-2xl leading-relaxed">
                            We identified <b className="text-rose-450">{filteredTransactions.filter(t => t.isAvoidable).length} avoidable expense items</b> that draft a cumulative total of <b className="text-rose-450 font-mono">{formatCurrency(filteredAvoidableLoss)}</b> from your potential savings. Cutting or reducing these items will instantly increase your monthly cash cushion.
                          </p>
                        </div>

                        {/* Reclassify tool button info */}
                        <div className="px-3.5 py-2 bg-rose-500/5 border border-rose-500/10 rounded-lg text-center shrink-0">
                          <span className="text-[8px] font-mono font-bold block text-rose-500/60 uppercase">Total Avoidable Spend</span>
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
                            <p className="text-sm font-bold text-brand-primary uppercase tracking-tight">Everything is Fully Optimized!</p>
                            <p className="text-[9px] text-brand-primary/40 font-mono max-w-xs mx-auto">
                              No avoidable or optional expenses found in your selected filters. Your current budget is highly efficient.
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
                            <span className="text-[8px] font-mono font-bold text-brand-primary/45 uppercase tracking-wide block">Scenario Strategy Preset</span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-brand-bg p-1 rounded-xl border border-brand-border">
                              {[
                                { id: 'conservative', label: '🛡️ Conservative' },
                                { id: 'balanced', label: '📈 Balanced' },
                                { id: 'aggressive', label: '⚡ Aggressive' }
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
                            let investPct = 0;
                            let debtPct = 20;
                            if (ledgerAllocationPreset === 'balanced') {
                              emPct = 30; investPct = 40; debtPct = 30;
                            } else if (ledgerAllocationPreset === 'aggressive') {
                              emPct = 25; investPct = 75; debtPct = 0;
                            }

                            const emVal = cushion * (emPct / 100);
                            const investVal = cushion * (investPct / 100);
                            const debtVal = cushion * (debtPct / 100);

                            return (
                              <div className="space-y-5 bg-brand-bg/50 p-4 rounded-xl border border-brand-border/40">
                                <div className="space-y-1">
                                  <span className="text-[8.5px] font-mono text-brand-primary/45 uppercase block">Simulated Allocation map:</span>
                                  <div className="h-3 w-full bg-brand-bg rounded-md overflow-hidden border border-brand-border/40 p-[1.5px] flex">
                                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${emPct}%` }} title={`Emergency Fund: ${emPct}%`} />
                                    <div className="h-full bg-brand-accent transition-all duration-300" style={{ width: `${investPct}%` }} title={`Capital Growth: ${investPct}%`} />
                                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${debtPct}%` }} title={`Debt acceleration: ${debtPct}%`} />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                                  <div className="space-y-0.5 border-l-2 border-emerald-500 pl-2">
                                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/40 uppercase">Emergency Fund ({emPct}%)</span>
                                    <p className="text-xs font-mono font-black text-brand-primary">{formatCurrency(emVal)}</p>
                                  </div>
                                  <div className="space-y-0.5 border-l-2 border-brand-accent/70 pl-2">
                                    <span className="text-[7.5px] font-mono font-bold text-brand-primary/40 uppercase">Capital Growth ({investPct}%)</span>
                                    <p className="text-xs font-mono font-black text-brand-primary">{formatCurrency(investVal)}</p>
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
              {/* BRAND NEW CFO GOALS LANDING DASHBOARD SNAPSHOT */}
              <div className="bg-gradient-to-br from-brand-primary/[0.015] to-brand-primary/[0.04] border border-brand-border/60 rounded-2xl p-6 shadow-sm space-y-6 font-sans">
                {/* Header Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase tracking-widest bg-brand-accent/10 border border-brand-accent/20 px-2.5 py-0.5 rounded leading-none text-brand-accent">
                        SAVINGS SUMMARY
                      </span>
                      <span className="text-[10px] font-mono font-bold text-brand-primary/30 uppercase tracking-wider">• Plan & Progress</span>
                    </div>
                    <h2 className="text-xl font-black text-brand-primary tracking-tight uppercase leading-none">Your Savings & Goals Dashboard</h2>
                    <p className="text-xs text-brand-primary/55 max-w-2xl leading-relaxed mt-1">
                      See your savings goals and how much progress you are making each month. Track target dates and watch your money grow.
                    </p>
                  </div>
                  <div className="bg-brand-surface/70 border border-brand-border/60 px-4 py-2.5 rounded-xl flex items-center gap-2.5 shrink-0 shadow-sm">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse animate-duration-1000" />
                    <div className="space-y-0.5 text-left">
                      <span className="text-[8px] font-mono font-bold text-brand-primary/40 uppercase block leading-none">Extra Monthly Savings</span>
                      <span className="text-base font-mono font-black text-brand-primary tracking-tight leading-none">
                        {formatCurrency(Math.max(0, balance))}/mo
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dashboard Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Combined Progress Indicator */}
                  <div className="bg-brand-surface border border-brand-border/50 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-brand-primary/15 transition-all">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-wider">
                        <span>Milestone Progress</span>
                        <span className="text-emerald-600 font-black">{totalGoalProgress.toFixed(0)}% Done</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-lg font-black text-brand-primary truncate">{formatCurrency(totalGoalCurrent)}</span>
                        <span className="text-[10px] text-brand-primary/40">of {formatCurrency(totalGoalTarget)}</span>
                      </div>
                    </div>
                    
                    {/* Modern fluid progress bar */}
                    <div className="space-y-1.5">
                      <div className="w-full bg-brand-bg rounded-full h-1.5 overflow-hidden border border-brand-border/40">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, totalGoalProgress)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-brand-primary/40 uppercase font-medium">
                        {goals.filter(g => g.currentAmount >= g.targetAmount).length} of {goals.length} milestones fully achieved
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Timeline Schedule Health Status */}
                  <div className="bg-brand-surface border border-brand-border/50 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-brand-primary/15 transition-all">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-wider block">Timeline Health Index</span>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="inline-flex items-center gap-1 bg-emerald-500/5 text-emerald-600 border border-emerald-500/10 px-2 py-1 rounded text-[9px] font-bold uppercase leading-none">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> {goalsHealthSummary.completed + goalsHealthSummary.onTrack} Safe or Done
                        </span>
                        {goalsHealthSummary.deficit > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-rose-500/5 text-rose-500 border border-rose-500/10 px-2 py-1 rounded text-[9px] font-bold uppercase leading-none animate-pulse">
                            <ShieldAlert className="w-3 h-3 shrink-0 text-rose-500" /> {goalsHealthSummary.deficit} Behind Date
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-brand-primary/5 text-brand-primary/40 border border-brand-border px-2 py-1 rounded text-[9px] font-semibold uppercase leading-none">
                            <ShieldCheck className="w-3 h-3 shrink-0" /> All Roadmaps On Time
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[9px] text-brand-primary/45 uppercase leading-normal">
                      {goalsHealthSummary.deficit > 0 
                        ? `${goalsHealthSummary.deficit} target(s) require higher monthly allocation to respect target deadlines.`
                        : "All savings roadmap deadlines are realistic under current systematic savings values."}
                    </div>
                  </div>

                  {/* Card 3: Incomes vs Expenses Cash Subtraction Flow */}
                  <div className="bg-brand-surface border border-brand-border/50 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-brand-primary/15 transition-all">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase tracking-wider block">Monthly Surplus Calculus</span>
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-base font-bold text-brand-primary">{formatCurrency(totalIncome)}</span>
                        <span className="text-[9px] text-brand-primary/30 uppercase font-bold">Gross Inflow</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-medium text-rose-500">- {formatCurrency(totalExpenses)}</span>
                        <span className="text-[9px] text-brand-primary/30 uppercase font-bold">debits</span>
                      </div>
                    </div>
                    <div className="border-t border-brand-border/30 pt-2 flex justify-between items-center">
                      <span className="text-[9px] text-brand-primary/45 uppercase font-medium">Free Surplus cash</span>
                      <button 
                        onClick={() => {
                          setGoalsSubTab('surplus');
                          setAllocationMessage(null);
                        }}
                        className="text-[9px] font-bold uppercase tracking-wider text-brand-accent hover:text-brand-accent/80 transition-all flex items-center gap-0.5 leading-none"
                      >
                        Allocate Cash <ChevronRight className="w-3 h-3 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Improved High-UX Sub-tab Switcher with explicit step labeling */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 bg-brand-bg/60 p-1.5 rounded-2xl border border-brand-border max-w-5xl mx-auto">
                <button 
                  onClick={() => setGoalsSubTab('strategy')}
                  className={cn(
                    "flex items-center gap-3 py-2 px-4 rounded-xl transition-all font-sans border text-left",
                    goalsSubTab === 'strategy' 
                      ? "bg-brand-primary text-brand-surface shadow-md border-brand-primary" 
                      : "text-brand-primary/45 hover:text-brand-primary border-transparent hover:bg-brand-primary/5"
                  )}
                >
                  <Target className={cn("w-4 h-4 shrink-0", goalsSubTab === 'strategy' ? "text-brand-surface" : "text-brand-primary/45")} />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider block leading-none">1. Goals & Progress</span>
                    <span className={cn("text-[7.5px] font-bold uppercase tracking-widest block leading-none mt-1", goalsSubTab === 'strategy' ? "text-brand-surface/75" : "text-brand-primary/35")}>What are my targets?</span>
                  </div>
                </button>

                <button 
                  onClick={() => setGoalsSubTab('timeline')}
                  className={cn(
                    "flex items-center gap-3 py-2 px-4 rounded-xl transition-all font-sans border text-left",
                    goalsSubTab === 'timeline' 
                      ? "bg-brand-primary text-brand-surface shadow-md border-brand-primary" 
                      : "text-brand-primary/45 hover:text-brand-primary border-transparent hover:bg-brand-primary/5"
                  )}
                >
                  <Calendar className={cn("w-4 h-4 shrink-0", goalsSubTab === 'timeline' ? "text-brand-surface" : "text-brand-primary/45")} />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider block leading-none">2. Achievement Timelines</span>
                    <span className={cn("text-[7.5px] font-bold uppercase tracking-widest block leading-none mt-1", goalsSubTab === 'timeline' ? "text-brand-surface/75" : "text-brand-primary/35")}>When will I get there?</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setGoalsSubTab('surplus');
                    setAllocationMessage(null);
                  }}
                  className={cn(
                    "flex items-center gap-3 py-2 px-4 rounded-xl transition-all font-sans border text-left",
                    goalsSubTab === 'surplus' 
                      ? "bg-brand-primary text-brand-surface shadow-md border-brand-primary" 
                      : "text-brand-primary/45 hover:text-brand-primary border-transparent hover:bg-brand-primary/5"
                  )}
                >
                  <Zap className={cn("w-4 h-4 shrink-0", goalsSubTab === 'surplus' ? "text-brand-surface" : "text-brand-primary/45")} />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider block leading-none">3. Surplus Cash Allocator</span>
                    <span className={cn("text-[7.5px] font-bold uppercase tracking-widest block leading-none mt-1", goalsSubTab === 'surplus' ? "text-brand-surface/75" : "text-brand-primary/35")}>Where does spare money go?</span>
                  </div>
                </button>

                <button 
                  onClick={() => setGoalsSubTab('mandates')}
                  className={cn(
                    "flex items-center gap-3 py-2 px-4 rounded-xl transition-all font-sans border text-left",
                    goalsSubTab === 'mandates' 
                      ? "bg-brand-primary text-brand-surface shadow-md border-brand-primary" 
                      : "text-brand-primary/45 hover:text-brand-primary border-transparent hover:bg-brand-primary/5"
                  )}
                >
                  <Coins className={cn("w-4 h-4 shrink-0", goalsSubTab === 'mandates' ? "text-brand-surface" : "text-brand-primary/45")} />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider block leading-none">4. Recurring Incomes</span>
                    <span className={cn("text-[7.5px] font-bold uppercase tracking-widest block leading-none mt-1", goalsSubTab === 'mandates' ? "text-brand-surface/75" : "text-brand-primary/35")}>How is it actively funded?</span>
                  </div>
                </button>

                <button 
                  onClick={() => setGoalsSubTab('mastery')}
                  className={cn(
                    "flex items-center gap-3 py-2 px-4 rounded-xl transition-all font-sans border text-left",
                    goalsSubTab === 'mastery' 
                      ? "bg-brand-primary text-brand-surface shadow-md border-brand-primary" 
                      : "text-brand-primary/45 hover:text-brand-primary border-transparent hover:bg-brand-primary/5"
                  )}
                >
                  <Award className={cn("w-4 h-4 shrink-0", goalsSubTab === 'mastery' ? "text-brand-surface" : "text-brand-primary/45")} />
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider block leading-none">5. Savings Mastery</span>
                    <span className={cn("text-[7.5px] font-bold uppercase tracking-widest block leading-none mt-1", goalsSubTab === 'mastery' ? "text-brand-surface/75" : "text-brand-primary/35")}>Quests & Achievements</span>
                  </div>
                </button>
              </div>

            {goalsSubTab === 'strategy' ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                {/* Dynamic CFO Budget Stress Shock Sensitivity Tester */}
                {goals.length > 0 && (
                  <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm space-y-4 font-sans">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-brand-border/40">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded leading-none border",
                            goalsStressFactor < 1 
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                              : "bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                          )}>
                            {goalsStressFactor < 1 ? "STRESS ACTIVE" : "STANDARD ENVIRONMENT"}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-brand-primary/30 uppercase tracking-wider">• Sensitivity Diagnosis</span>
                        </div>
                        <h3 className="text-xs font-sans font-black uppercase text-brand-primary tracking-tight leading-none pt-0.5">Budget Compression Sensitivity Tester</h3>
                        <p className="text-[10px] text-brand-primary/50 uppercase leading-relaxed">
                          Test the stability of your roadmap against a sudden {Math.round((1 - goalsStressFactor) * 100)}% decrease in systematic saving capability.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 bg-brand-bg px-3 py-1.5 border border-brand-border/60 rounded-xl shrink-0">
                        <span className="text-[9px] font-mono font-bold text-brand-primary/40 uppercase">Stress shock factor:</span>
                        <span className={cn(
                          "text-[10px] font-mono font-bold px-2 py-0.5 rounded border",
                          goalsStressFactor < 1.0 
                            ? "text-rose-500 bg-rose-500/5 border-rose-500/10 animate-pulse" 
                            : "text-emerald-500 bg-emerald-500/5 border-emerald-500/10"
                        )}>
                          {Math.round(goalsStressFactor * 100)}% of planned outflow
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="w-full flex-grow space-y-1">
                          <div className="flex justify-between text-[8px] font-mono font-bold text-brand-primary/40 uppercase">
                            <span>Severe Crunch (-50%)</span>
                            <span>Standard Savings Inflow (100%)</span>
                          </div>
                          <input 
                            type="range"
                            min="0.5"
                            max="1.0"
                            step="0.05"
                            value={goalsStressFactor}
                            onChange={(e) => setGoalsStressFactor(parseFloat(e.target.value))}
                            className="w-full accent-brand-accent h-1.5 bg-brand-bg rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>

                      {goalsStressFactor < 1.0 && (
                        <div className={cn(
                           "p-3 rounded-xl border flex items-start gap-2.5 transition-all text-[10px]",
                           vulnerableGoalsCount > 0 
                             ? "bg-rose-500/[0.02] border-rose-500/20 text-rose-600" 
                             : "bg-emerald-500/[0.02] border-emerald-500/20 text-emerald-600"
                        )}>
                          <ShieldAlert className={cn("w-4 h-4 mt-0.5 shrink-0", vulnerableGoalsCount > 0 ? "text-rose-500" : "text-emerald-500")} />
                          <div>
                            {vulnerableGoalsCount > 0 ? (
                              <>
                                <p className="font-bold uppercase tracking-wider text-rose-500 text-[9px]">ROADMAP UNDER CRUNCH: {vulnerableGoalsCount} AT-RISK GOAL(S)</p>
                                <p className="text-[9px] leading-tight text-brand-primary/50 mt-0.5 uppercase">
                                  Your current planned monthly saves to {vulnerableGoalsCount} targets will be insufficient to hit their assigned timelines. Consider spreading target dates or identifying alternative funding engines.
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-bold uppercase tracking-wider text-emerald-500 text-[9px]">ROADMAP HIGH RESILIENCE: 0 TARGETS COMPROMISED</p>
                                <p className="text-[9px] leading-tight text-emerald-600/70 mt-0.5 uppercase">
                                  Even under a {Math.round((1 - goalsStressFactor) * 100)}% budget compression shock, your planned allocations are strong enough to achieve all milestones before the declared deadlines!
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}
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
                    {goals.length > 0 && (
                      <button 
                        onClick={() => {
                          setCommandTab('goal');
                          setEditingGoal(null);
                          setShowCommandCenter(true);
                        }}
                        className="flex items-center gap-1 bg-emerald-650 hover:bg-emerald-600 text-brand-surface px-3 py-1.5 rounded text-[8px] font-bold uppercase tracking-widest shadow-sm transition-all active:scale-95 leading-none"
                      >
                        <Plus className="w-3 h-3" />
                        Add Saving Goal
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goals.filter(g => g.type !== 'debt').map(goal => (
                      <GoalItem 
                        key={goal.id} 
                        goal={goal} 
                        stressFactor={goalsStressFactor}
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
                    <div className="flex items-center gap-2">
                      {goals.length > 0 && (
                        <button 
                          onClick={() => {
                            setCommandTab('goal');
                            setEditingGoal(null);
                            setShowCommandCenter(true);
                          }}
                          className="flex items-center gap-1 bg-brand-primary/80 hover:bg-brand-primary text-brand-surface px-3 py-1.5 rounded text-[8px] font-bold uppercase tracking-widest shadow-sm transition-all active:scale-95 leading-none"
                        >
                          <Plus className="w-3 h-3" />
                          Add Debt
                        </button>
                      )}
                      {goals.some(g => g.type === 'debt') && (
                        <button 
                          onClick={() => setActiveTab('insights')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent text-brand-surface rounded text-[8px] font-bold uppercase tracking-widest hover:bg-brand-accent/90 transition-all shadow-sm group leading-none"
                        >
                          <Zap className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                          Optimize Debts
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goals.filter(g => g.type === 'debt').map(goal => (
                      <GoalItem 
                        key={goal.id} 
                        goal={goal} 
                        stressFactor={goalsStressFactor}
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
            ) : goalsSubTab === 'mandates' ? (
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
              </div>
            ) : goalsSubTab === 'mastery' ? (
              <div className="animate-in fade-in duration-500">
                <SavingsMastery
                  goals={goals}
                  transactions={transactions}
                  incomeStreams={incomeStreams}
                  balance={balance}
                  incomeShock={stressTest.incomeShock}
                  expenseShock={stressTest.expenseShock}
                  survivalMonths={runwayMonths}
                />
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* Friendly CFO Strategic Advisor Panel */}
                <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded leading-none">
                          ACTIVE CAPITAL DEPLOYMENT
                        </span>
                        <span className="text-[10px] font-mono font-bold text-brand-primary/30 uppercase tracking-wider">• Priority-First Blueprint</span>
                      </div>
                      <h3 className="text-lg font-black tracking-tight text-brand-primary uppercase">Savings & Excess Income Allocator</h3>
                      <p className="text-xs text-brand-primary/50 max-w-3xl leading-relaxed">
                        Determine the best use of your monthly net savings (Total Inflow - Total Expenses) across your goals. Allocate your extra cash according to high-priority order or split it proportionally.
                      </p>
                    </div>
                    
                    {/* Strategy Switcher */}
                    <div className="flex gap-1.5 p-1 bg-brand-bg rounded-xl border border-brand-border self-start shrink-0">
                      <button
                        onClick={() => {
                          setAllocatorStrategy('cascade');
                          setAllocationMessage(null);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all leading-none",
                          allocatorStrategy === 'cascade'
                            ? "bg-brand-primary text-brand-surface shadow-sm"
                            : "text-brand-primary/45 hover:text-brand-primary"
                        )}
                      >
                        Priority-First Flow
                      </button>
                      <button
                        onClick={() => {
                          setAllocatorStrategy('prorata');
                          setAllocationMessage(null);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all leading-none",
                          allocatorStrategy === 'prorata'
                            ? "bg-brand-primary text-brand-surface shadow-sm"
                            : "text-brand-primary/45 hover:text-brand-primary"
                        )}
                      >
                        Balanced Split
                      </button>
                    </div>
                  </div>

                  {/* Input Controls & Information Snapshots */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="bg-brand-bg/40 border border-brand-border p-4 rounded-xl space-y-3">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-brand-primary/45 font-bold block">1. Available Net Surplus</span>
                      <div className="space-y-1">
                        <h4 className="text-3xl font-mono font-black text-brand-primary">{formatCurrency(Math.max(0, balance))}</h4>
                        <span className="text-[8.5px] font-mono text-brand-primary/30 uppercase tracking-wide leading-none">Actual Monthly Savings Built</span>
                      </div>
                      <div className="h-px bg-brand-border/30 my-1" />
                      <div className="flex justify-between text-[10px] font-sans">
                        <span className="text-brand-primary/40">Total Income:</span>
                        <span className="font-mono text-brand-primary/60 font-bold">{formatCurrency(totalIncome)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-sans border-t border-brand-border/20 pt-1">
                        <span className="text-brand-primary/40">Total Expenses:</span>
                        <span className="font-mono text-brand-primary/60 font-bold">{formatCurrency(totalExpenses)}</span>
                      </div>
                    </div>

                    <div className="bg-brand-bg/40 border border-brand-border p-4 rounded-xl space-y-3">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-brand-primary/45 font-bold block">2. Custom Amount to Allocate</span>
                      <div className="space-y-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-brand-primary/40 font-bold">₹</span>
                          <input
                            type="number"
                            placeholder={Math.max(0, balance).toString()}
                            value={customSurplusInput}
                            onChange={(e) => {
                              setCustomSurplusInput(e.target.value);
                              setAllocationMessage(null);
                            }}
                            className="w-full bg-brand-surface border border-brand-border rounded-xl px-7 py-2 text-sm text-brand-primary font-mono focus:outline-none focus:border-brand-primary/35 text-left placeholder:text-brand-primary/30 font-bold"
                          />
                        </div>
                        <p className="text-[8.5px] text-brand-primary/35 uppercase tracking-wide leading-relaxed">
                          Enter custom value to simulate savings of a different amount. Defaults to actual net surplus if empty.
                        </p>
                      </div>
                    </div>

                    <div className="bg-brand-bg/40 border border-brand-border p-4 rounded-xl flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-brand-primary/45 font-bold block">3. Selected Distribution Method</span>
                        <p className="text-[9.5px] text-brand-primary/55 font-sans leading-relaxed mt-2 uppercase">
                          {allocatorStrategy === 'cascade' 
                            ? "Priority-First flow: Fully funds your highest-impact goals sequentially. Priority order: Debt Payoff, Emergency Reserve, High Priority Accumulations, followed by Medium and Low priority." 
                            : "Balanced Split flow: Distributes surplus proportionally to all active milestones based on their remaining target gaps and priorities (Debt gets 4x leverage, Safety/High gets 3x, Medium gets 2x, Low gets 1x)."}
                        </p>
                      </div>
                      <div className="text-[8px] font-mono uppercase text-brand-accent bg-brand-accent/5 px-2.5 py-1 rounded border border-brand-accent/15 tracking-wider self-start font-bold">
                        {allocatorStrategy === 'cascade' ? 'Priority Sequence Active' : 'Balanced Split Active'}
                      </div>
                    </div>
                  </div>

                  {/* Allocation Table / List */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-brand-border/40 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary">SURPLUS DEPLOYMENT BLUEPRINT</h4>
                      <span className="text-[9px] font-mono text-brand-primary/35">Computed across {computedAllocations.filter(item => item.suggestedAmount > 0).length} receiving targets</span>
                    </div>

                    {computedAllocations.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-brand-border rounded-xl bg-brand-surface/20">
                        <p className="text-xs font-mono text-brand-primary/30 uppercase tracking-widest font-bold">No active allocations available to display</p>
                        <p className="text-[9.5px] text-brand-primary/25 mt-1 uppercase max-w-md mx-auto">Please ensure you have a positive surplus of funds and active goal targets with outstanding funding gaps.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="hidden md:grid grid-cols-12 gap-4 px-3 text-[9px] font-mono text-brand-primary/30 uppercase tracking-wider font-bold">
                          <span className="col-span-4">Goal Name / Class</span>
                          <span className="col-span-2 text-center">Remaining Gap</span>
                          <span className="col-span-3 text-center">Calculated Allocation</span>
                          <span className="col-span-3 text-right">Resulting Progress Goal</span>
                        </div>

                        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                          {computedAllocations.map((item, idx) => {
                            const isAllocated = item.suggestedAmount > 0;
                            const isDebt = item.goal.type === 'debt';
                            const targetGap = item.goal.targetAmount - item.goal.currentAmount;
                            const currentPct = (item.goal.currentAmount / item.goal.targetAmount) * 100;
                            
                            return (
                              <div 
                                key={item.goal.id || idx}
                                className={cn(
                                  "grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center p-3.5 border rounded-xl transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.015)]",
                                  isAllocated 
                                    ? "bg-brand-surface border-emerald-500/20 shadow-sm" 
                                    : "bg-brand-surface/40 border-brand-border/45 opacity-60"
                                )}
                              >
                                {/* Name and Priority / Type Class */}
                                <div className="col-span-1 md:col-span-4 flex items-center gap-3">
                                  <div className={cn(
                                    "p-2 rounded-lg border",
                                    isDebt 
                                      ? "bg-rose-500/5 border-rose-500/15 text-rose-500" 
                                      : "bg-emerald-500/5 border-emerald-500/15 text-emerald-500"
                                  )}>
                                    <Target className="w-4 h-4" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <h4 className="text-xs font-bold text-brand-primary truncate">{item.goal.name}</h4>
                                    <div className="flex gap-1.5 items-center">
                                      <span className="text-[7.5px] font-mono uppercase bg-brand-bg border border-brand-border px-1.5 rounded text-brand-primary/40 font-bold">
                                        {item.goal.type}
                                      </span>
                                      <span className={cn(
                                        "text-[7px] font-mono font-bold uppercase tracking-wider px-1.5 rounded border leading-none",
                                        item.goal.priority === 'high' 
                                          ? "bg-rose-500/5 text-rose-500 border-rose-500/10" 
                                          : item.goal.priority === 'low'
                                            ? "bg-brand-primary/5 text-brand-primary/45 border-brand-border"
                                            : "bg-amber-500/5 text-amber-500 border-amber-500/10"
                                      )}>
                                        {item.goal.priority || 'medium'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Outstanding gap remaining */}
                                <div className="col-span-1 md:col-span-2 text-left md:text-center">
                                  <span className="md:hidden text-[8px] font-mono text-brand-primary/30 uppercase block font-bold mb-0.5">Remaining Gap</span>
                                  <span className="text-xs font-mono font-bold text-brand-primary/70">{formatCurrency(targetGap)}</span>
                                </div>

                                {/* Allocation amount with badge */}
                                <div className="col-span-1 md:col-span-3 text-left md:text-center">
                                  <span className="md:hidden text-[8px] font-mono text-brand-primary/30 uppercase block font-bold mb-0.5">CFO Allocation</span>
                                  {isAllocated ? (
                                    <div className="inline-flex flex-col items-center md:items-center">
                                      <span className="text-sm font-mono font-black text-emerald-600 tracking-tight flex items-center gap-1">
                                        + {formatCurrency(item.suggestedAmount)}
                                      </span>
                                      <span className="text-[7.5px] font-mono uppercase text-emerald-600 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded mt-0.5 font-bold">
                                        Surplus Addition
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-mono text-brand-primary/30 italic">Capped / Sequenced</span>
                                  )}
                                </div>

                                {/* Progress bar results */}
                                <div className="col-span-1 md:col-span-3 flex flex-col items-start md:items-end gap-1 font-sans">
                                  <span className="md:hidden text-[8px] font-mono text-brand-primary/30 uppercase block font-bold mb-0.5">Future Milestone Progress</span>
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                    <span className="font-mono text-brand-primary/40">{currentPct.toFixed(0)}%</span>
                                    <ArrowRight className="w-3 h-3 text-brand-primary/30" />
                                    <span className="font-bold text-emerald-600 font-mono">{item.newProgress.toFixed(0)}%</span>
                                  </div>

                                  <div className="h-1.5 w-full bg-brand-bg rounded-lg overflow-hidden border border-brand-border/40 p-[1px] max-w-[125px]">
                                    <div className="flex h-full rounded-lg overflow-hidden">
                                      <div 
                                        className="h-full bg-brand-primary/20" 
                                        style={{ width: `${Math.min(100, currentPct)}%` }} 
                                      />
                                      {isAllocated && (
                                        <div 
                                          className="h-full bg-emerald-500/80 animate-pulse" 
                                          style={{ width: `${Math.min(100, item.newProgress) - Math.min(100, currentPct)}%` }} 
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Action buttons with real simulation results */}
                        <div className="pt-4 mt-6 border-t border-brand-border/40 space-y-4">
                          {allocationMessage && (
                            <div className={cn(
                              "p-4 rounded-xl border text-[11px] font-mono leading-relaxed uppercase font-bold",
                              allocationMessage.includes('Successfully')
                                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-655"
                                : "bg-brand-primary/5 border-brand-border text-brand-primary/80"
                            )}>
                              {allocationMessage}
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-[9px] text-brand-primary/45 font-mono max-w-lg leading-relaxed uppercase">
                              * EXECUTION OF STRATEGIC ALLOCATIONS WRITES SECURELY TO THE FIREBASE LEDGER AND AUTO-GENERATES physical CASH FLOW OUTFLOW TRANSACTIONS IN THE RECORD HISTORY FOR TRANSACTIONS STABILITY.
                            </div>
                            
                            <button
                              onClick={handleExecuteAllocations}
                              disabled={isApplyingAllocations || computedAllocations.filter(item => item.suggestedAmount > 0).length === 0}
                              className={cn(
                                "w-full sm:w-auto px-6 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-all text-center leading-none flex items-center justify-center gap-2",
                                isApplyingAllocations || computedAllocations.filter(item => item.suggestedAmount > 0).length === 0
                                  ? "bg-brand-primary/10 text-brand-primary/30 border border-transparent cursor-not-allowed"
                                  : "bg-emerald-600 text-brand-surface hover:bg-emerald-755 border border-emerald-700 hover:scale-[1.02] active:scale-95"
                              )}
                            >
                              {isApplyingAllocations ? (
                                <>
                                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-brand-surface border-t-transparent inline-block" />
                                  APPLYING ALLOCATIONS...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  EXECUTE ADV-ALLOCATION
                                </>
                              )}
                            </button>
                          </div>
                        </div>
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
                  <DebtOptimization goals={goals} monthlySurplus={monthlySurplus} liquidAssets={totalLiquidReserves} />
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
  'Shopping & Lifestyle': ['Myntra', 'Ajio', 'Nykaa', 'Tira', 'Zara', 'H&M', 'Amazon', 'Flipkart', 'Fabindia', 'Salon', 'Lifestyle', 'Other'],
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
  editingIncomeStream
}: { 
  onClose: () => void, 
  userId: string, 
  transactions: Transaction[], 
  goals: Goal[],
  initialTab: 'transaction' | 'goal' | 'income',
  editingGoal: Goal | null,
  editingTransaction: Transaction | null,
  avgDailySpend: number,
  onDeleteGoal: (id: string) => Promise<void>,
  editingIncomeStream: IncomeStream | null
}) {
  const [activeTab, setActiveTab] = useState<'transaction' | 'goal' | 'income'>(
    editingGoal ? 'goal' : editingTransaction ? 'transaction' : editingIncomeStream ? 'income' : initialTab
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
                  {activeTab === 'transaction' ? <Plus className="w-4 h-4 text-brand-accent" /> : activeTab === 'goal' ? <Target className="w-4 h-4 text-brand-accent" /> : <ArrowUpRight className="w-4 h-4 text-brand-accent" />}
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-[11px] font-bold text-brand-primary uppercase tracking-widest leading-none">
                    {activeTab === 'transaction' ? 'Quick Add' : activeTab === 'goal' ? 'Savings Goals' : 'Income Mandate'}
                  </h3>
                  <p className="text-[8px] font-mono font-bold text-brand-primary/30 uppercase tracking-[0.25em] leading-none">
                    Update your history
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
            </div>

            {/* Unified Navigation at bottom of flex container */}
            <div className="pt-2 border-t border-brand-primary/5">
              <div className="flex gap-1.5 flex-wrap justify-center pb-1">
                {[
                  { id: 'transaction', label: 'ADD', icon: Plus },
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

function TransactionForm({ onClose, userId, transactions, goals, editingTransaction }: { onClose: () => void, userId: string, transactions: Transaction[], goals: Goal[], editingTransaction: Transaction | null }) {
  const [amount, setAmount] = useState(editingTransaction?.amount.toString() || '');
  const [category, setCategory] = useState(editingTransaction?.category || 'Dining & Delivery');
  const [subcategory, setSubcategory] = useState(editingTransaction?.subcategory || 'Swiggy');
  const [description, setDescription] = useState(editingTransaction?.description || '');
  const [date, setDate] = useState(editingTransaction?.date ? new Date(editingTransaction.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<TransactionType>(editingTransaction?.type || 'expense');
  const [manualGoalId, setManualGoalId] = useState<string | null>(editingTransaction?.linkedGoalId || null);
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

    if (subs.length > 0 && !subs.includes(subcategory)) {
      setSubcategory(subs[0]);
    }
  }, [category, type, goals]);

  // Handle goals within subcategory selection
  useEffect(() => {
    if (subcategory.startsWith('GOAL:')) {
      const parts = subcategory.split(':');
      setManualGoalId(parts[2]);
    } else if (!editingTransaction) {
      setManualGoalId(null);
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
      if (!description) {
        finalDescription = type === 'refund' 
          ? `Refund: ${parts[1]}` 
          : `Contribution to ${parts[1]}`;
      }
    } else {
      if (!description) {
        finalDescription = type === 'refund' 
          ? `Refund: ${subcategory.toUpperCase()}` 
          : subcategory.toUpperCase();
      }
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

      // Preserve dynamic local hours, minutes, and seconds so transactions are not set to UTC midnight (which translates to 5:30 IST for all users)
      const [yr, mo, dy] = date.split('-').map(Number);
      const now = new Date();
      let finalDateObj: Date;

      if (editingTransaction?.date) {
        const origDate = new Date(editingTransaction.date);
        finalDateObj = new Date(yr, mo - 1, dy, origDate.getHours(), origDate.getMinutes(), origDate.getSeconds());
      } else {
        finalDateObj = new Date(yr, mo - 1, dy, now.getHours(), now.getMinutes(), now.getSeconds());
      }

      const transactionData: any = {
        amount: amountNum,
        category,
        subcategory: finalSubcategory,
        description: finalDescription,
        type,
        date: finalDateObj.toISOString(),
        userId,
        isMandatory: classification.isMandatory,
        isRecurring: classification.isRecurring,
        isAvoidable: classification.isAvoidable,
        linkedGoalId: newGoalId
      };

      if (editingTransaction?.relatedTransactionId) {
        transactionData.relatedTransactionId = editingTransaction.relatedTransactionId;
      }

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

      <div className="bg-brand-bg/80 p-1.5 rounded-xl border border-brand-border shadow-inner flex relative">
        <button
          type="button"
          onClick={() => {
            setType('expense');
            const currentCats = EXPENSE_CATEGORIES;
            const firstCat = Object.keys(currentCats)[0];
            const firstSub = (currentCats as any)[firstCat][0];
            setCategory(firstCat);
            setSubcategory(firstSub);
          }}
          className={cn(
            "flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 relative z-10",
            (type === 'expense')
              ? "bg-brand-primary text-brand-surface shadow-md font-black" 
              : "text-brand-primary/30 hover:text-brand-primary/60 hover:bg-brand-primary/5"
          )}
        >
          <TrendingDown className="w-3 h-3 text-rose-400" />
          Debit (Outflow)
        </button>
        <button
          type="button"
          onClick={() => {
            setType('income');
            const currentCats = INCOME_CATEGORIES;
            const firstCat = Object.keys(currentCats)[0];
            const firstSub = (currentCats as any)[firstCat][0];
            setCategory(firstCat);
            setSubcategory(firstSub);
          }}
          className={cn(
            "flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 relative z-10",
            (type === 'income' || type === 'refund')
              ? "bg-brand-primary text-brand-surface shadow-md font-black" 
              : "text-brand-primary/30 hover:text-brand-primary/60 hover:bg-brand-primary/5"
          )}
        >
          <TrendingUp className="w-3 h-3 text-brand-accent" />
          Credit (Inflow)
        </button>
      </div>

      {/* Inline Selector for Credit Types (Standard Income vs Refund Offset) */}
      {(type === 'income' || type === 'refund') && (
        <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/45 pl-1">Credit Flow Type</label>
          <div className="bg-brand-surface/60 p-1 rounded-xl border border-brand-border/40 grid grid-cols-2 gap-1.5 shadow-sm max-w-[340px]">
            <button
              type="button"
              onClick={() => {
                setType('income');
                const currentCats = INCOME_CATEGORIES;
                const firstCat = Object.keys(currentCats)[0];
                const firstSub = (currentCats as any)[firstCat][0];
                setCategory(firstCat);
                setSubcategory(firstSub);
              }}
              className={cn(
                "py-1.5 rounded-lg text-[8.5px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 focus:outline-none",
                type === 'income'
                  ? "bg-brand-accent text-brand-surface font-black"
                  : "text-brand-primary/40 hover:text-brand-primary"
              )}
            >
              <TrendingUp className="w-3 h-3" />
              Regular Income
            </button>
            <button
              type="button"
              onClick={() => {
                setType('refund');
                const currentCats = EXPENSE_CATEGORIES;
                const firstCat = Object.keys(currentCats)[0];
                const firstSub = (currentCats as any)[firstCat][0];
                setCategory(firstCat);
                setSubcategory(firstSub);
              }}
              className={cn(
                "py-1.5 rounded-lg text-[8.5px] font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 focus:outline-none",
                type === 'refund'
                  ? "bg-brand-accent text-brand-surface font-black"
                  : "text-brand-primary/40 hover:text-brand-primary"
              )}
            >
              <RefreshCcw className="w-3 h-3" />
              Refund Offset
            </button>
          </div>
          <p className="text-[7.5px] font-mono text-brand-primary/40 pl-1 leading-normal">
            {type === 'income' 
              ? '*Regular Income credit increases cash pool (Earned metrics).' 
              : '*Refund offsets an expense category directly (lowers your category spend).'}
          </p>
        </div>
      )}

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
                  const currentCats = type === 'expense' || type === 'refund' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
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
                  const currentCats = type === 'expense' || type === 'refund' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
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

        <div className="group/input space-y-2">
          <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/40 pl-1">Notes / Description</label>
          <input 
            type="text" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={subcategory.startsWith('GOAL:') ? `Contribution to ${subcategory.split(':')[1]}`.toUpperCase() : subcategory.toUpperCase() || 'OPTIONAL TRANSACTION NOTE'}
            className="w-full bg-brand-surface border border-brand-border rounded-lg py-2.5 px-4 font-sans font-bold text-sm text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none uppercase tracking-tight"
          />
        </div>

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
    { name: 'Gold Jewelry Saving', target: 150000, type: 'gold' as GoalType, isScheme: false },
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
        interestRate: interestRate ? parseFloat(interestRate) : (type === 'debt' ? 8.5 : null),
        tenureMonths: tenureMonths ? parseInt(tenureMonths) : (type === 'debt' ? 240 : null),
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
                  setIsScheme((tmp as any).isScheme || false);
                  if ((tmp as any).maturityValue) setMaturityValue((tmp as any).maturityValue.toString());
                  if ((tmp as any).interestRate) setInterestRate((tmp as any).interestRate.toString());
                  if ((tmp as any).tenureMonths) setTenureMonths((tmp as any).tenureMonths.toString());
                  if ((tmp as any).emi) setEmi((tmp as any).emi.toString());
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
          <div className="space-y-4">
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

            {/* Interest Compounding Selector for RDs, Fixed Income, iWish */}
            <div className="space-y-3 pt-3 border-t border-brand-border/40 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary">Interest Yield Scheme</span>
                  <p className="text-[7.5px] text-brand-primary/40 font-bold uppercase tracking-widest">Enable Interest Yield for iWish / RDs</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScheme(!isScheme)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    isScheme ? "bg-brand-accent" : "bg-brand-border/60"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      isScheme ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {isScheme && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/45 pl-1">Interest Rate (%)</label>
                    <div className="relative group">
                      <input 
                        type="number"
                        step="0.05"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="w-full bg-brand-surface border border-brand-border rounded-lg py-2 px-3 font-mono font-bold text-xs text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                        placeholder="7.2"
                      />
                    </div>
                    <p className="text-[6.5px] font-mono text-brand-primary/35">Annual rate (e.g. 7.1%)</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-brand-primary/45 pl-1">Tenure (In Months)</label>
                    <div className="relative group">
                      <input 
                        type="number"
                        value={tenureMonths}
                        onChange={(e) => setTenureMonths(e.target.value)}
                        className="w-full bg-brand-surface border border-brand-border rounded-lg py-2 px-3 font-mono font-bold text-xs text-brand-primary focus:ring-2 focus:ring-brand-accent/5 focus:border-brand-accent/30 transition-all outline-none"
                        placeholder="12"
                      />
                    </div>
                    <p className="text-[6.5px] font-mono text-brand-primary/35">Lock-in months (if no deadline)</p>
                  </div>
                </div>
              )}
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



