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
  Clock
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showMobileTip, setShowMobileTip] = useState(false);

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
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-stone-900 rounded-full shadow-xl">
              <Compass className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-stone-900">Artha AI</h1>
            <p className="text-stone-500">Your premium financial companion. Track goals, log expenses, and grow your wealth with AI.</p>
          </div>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-stone-900 text-white py-4 px-6 rounded-xl font-medium hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            <LogIn className="w-5 h-5" />
            Continue with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-stone-900 rounded-lg">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Artha</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user.displayName}</span>
              <span className="text-xs text-stone-500">{user.email}</span>
            </div>
            <button 
              onClick={logout}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500 hover:text-stone-900"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-stone-900">Dashboard</h2>
            <p className="text-sm text-stone-500">Welcome back, {user.displayName?.split(' ')[0]}</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg active:scale-95 group"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              Add Transaction
            </button>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <SummaryCard 
            title="Financial Runway" 
            amount={totalExpenses > 0 ? (balance / (totalExpenses / 30)) : 0} 
            icon={<Clock className="w-6 h-6 text-stone-900" />}
            className="bg-white border border-stone-200"
            isCritical={totalExpenses > 0 && (balance / (totalExpenses / 30)) < 30}
            isWarning={totalExpenses > 0 && (balance / (totalExpenses / 30)) < 90}
            tooltip="Survival Metric: How many days you can survive if income stops today. Target: 180+ days."
          />
          <SummaryCard 
            title="Monthly Savings" 
            amount={totalIncome - totalExpenses} 
            icon={<PiggyBank className="w-6 h-6 text-emerald-600" />}
            className="bg-emerald-50/50 border border-emerald-100"
            isWarning={(totalIncome - totalExpenses) < totalIncome * 0.2}
            isCritical={(totalIncome - totalExpenses) <= 0}
            subLabel={`${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(0) : 0}% Rate`}
            tooltip={`Monthly Surplus: Income minus Expenses. Current Savings Rate: ${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0}%. Target: 30%+`}
          />
          <SummaryCard 
            title="Capital Reserved" 
            amount={totalSavings} 
            icon={<Target className="w-6 h-6 text-blue-600" />}
            className="bg-blue-50/50 border border-blue-100"
            tooltip="Goal-Oriented Wealth: Sum of progress across all Savings and Investment goals."
          />
          <SummaryCard 
            title="Monthly Burn" 
            amount={totalExpenses} 
            icon={<TrendingDown className="w-6 h-6 text-rose-600" />}
            className="bg-rose-50/50 border border-rose-100"
            isCritical={totalExpenses > totalIncome * 0.7}
            tooltip="Monthly Expenses: Total outflow. If this exceeds 70% of income, leakage is critical."
          />
          <SummaryCard 
            title="Daily Allowance" 
            amount={Math.max(0, (balance - goals.reduce((acc, g) => acc + (g.monthlyContribution || 0), 0)) / 30)} 
            icon={<Sparkles className="w-6 h-6 text-amber-500" />}
            className="bg-stone-900 text-white border-none col-span-2 lg:col-span-1"
            isWarning={balance < goals.reduce((acc, g) => acc + (g.monthlyContribution || 0), 0)}
            tooltip="Daily Discretionary Allowance: Your safe daily spending limit after accounting for goals."
          />
        </div>

        {/* Strategic Allocation Summary */}
        <div className="bg-stone-900 p-8 rounded-[3rem] text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-12 items-center">
            <div className="md:col-span-1 space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Strategic Allocation</h3>
              <p className="text-xs text-stone-400 font-medium leading-relaxed">Your capital is being deployed across three primary vectors. Optimization requires minimizing leakage.</p>
            </div>
            
            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Operating Burn</span>
                  <span className="text-[10px] font-bold text-rose-400">{totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(0) : 0}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0}%` }}
                    className="h-full bg-rose-500"
                  />
                </div>
                <p className="text-lg font-bold tracking-tight">{formatCurrency(totalExpenses)}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Capital Reserve</span>
                  <span className="text-[10px] font-bold text-emerald-400">{totalIncome > 0 ? (((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(0) : 0}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0}%` }}
                    className="h-full bg-emerald-500"
                  />
                </div>
                <p className="text-lg font-bold tracking-tight">{formatCurrency(totalIncome - totalExpenses)}</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Goal Momentum</span>
                  <span className="text-[10px] font-bold text-blue-400">Targeting</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    className="h-full bg-blue-500 opacity-50"
                  />
                </div>
                <p className="text-lg font-bold tracking-tight">{formatCurrency(totalSavings)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CFO Strategic Analysis Section */}
        <StrategyInsights 
          transactions={transactions} 
          goals={goals} 
          balance={balance}
          totalIncome={totalIncome}
          totalSavings={totalSavings}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Charts & Advice */}
          <div className="lg:col-span-8 space-y-8">
            {/* Visual Analytics */}
            <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm space-y-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-stone-900 tracking-tight">
                    <PieChartIcon className="w-5 h-5 text-stone-400" />
                    Expense Breakdown
                  </h3>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">Capital Leakage Audit</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <div className="h-[320px] w-full relative">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Burn</span>
                    <span className="text-2xl font-bold text-stone-900 tracking-tighter">{formatCurrency(totalExpenses)}</span>
                  </div>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={85}
                          outerRadius={115}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {categoryData.map((_entry: any, index: number) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]} 
                              className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '24px', 
                            border: 'none', 
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                            fontSize: '12px',
                            padding: '12px 16px',
                            backgroundColor: '#1c1917',
                            color: '#fff'
                          }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-stone-400 italic text-sm">
                      No expense data to display
                    </div>
                  )}
                </div>
                
                <div className="space-y-6">
                  {categoryData.map((item: any, index: number) => (
                    <div key={item.name} className="flex items-center justify-between group cursor-default">
                      <div className="flex items-center gap-4">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm font-bold text-stone-600 group-hover:text-stone-900 transition-colors tracking-tight">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <span className="text-[11px] font-bold text-stone-300 group-hover:text-stone-400 transition-colors">
                          {((item.value / totalExpenses) * 100).toFixed(0)}%
                        </span>
                        <span className="text-sm font-bold text-stone-900 tabular-nums">{formatCurrency(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Goals & Recent Transactions */}
          <div className="lg:col-span-4 space-y-8">
            {/* Goals Section */}
            <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-3 text-stone-900">
                  <Target className="w-5 h-5 text-stone-400" />
                  Goals
                </h3>
                <button 
                  onClick={() => {
                    setEditingGoal(null);
                    setShowGoalModal(true);
                  }}
                  className="text-xs bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-4">
                {goals.length > 0 ? (
                  goals.map(goal => (
                    <GoalItem 
                      key={goal.id}
                      goal={goal} 
                      onEdit={() => {
                        setEditingGoal(goal);
                        setShowGoalModal(true);
                      }}
                    />
                  ))
                ) : (
                  <div className="space-y-4">
                    <GoalItem goal={{ name: 'Emergency Fund', currentAmount: 120000, targetAmount: 300000, type: 'savings', userId: '', deadline: '2026-12-31' }} isDemo />
                    <GoalItem goal={{ name: 'Home Loan', currentAmount: 1200000, targetAmount: 4500000, type: 'debt', userId: '', deadline: '2035-06-30' }} isDemo />
                    <p className="text-[10px] text-center text-stone-400 uppercase tracking-widest">Demo Data • Add your own goals</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-stone-900 tracking-tight">
                    <ArrowRight className="w-5 h-5 text-stone-400" />
                    Recent Activity
                  </h3>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">Capital Flow History</p>
                </div>
                <button className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors">View All</button>
              </div>
              <div className="space-y-2">
                {transactions.length > 0 ? (
                  transactions.slice(0, 8).map(t => (
                    <motion.div 
                      key={t.id} 
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between p-4 hover:bg-stone-50 rounded-3xl transition-all group/item border border-transparent hover:border-stone-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover/item:scale-110",
                          t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {t.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-stone-900 tracking-tight">{t.description || t.category}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{t.category}</p>
                            <span className="text-[10px] text-stone-200">•</span>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          t.type === 'income' ? "text-emerald-600" : "text-stone-900"
                        )}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                        <button 
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'transactions', t.id!));
                            } catch (error) {
                              handleFirestoreError(error, OperationType.DELETE, 'transactions');
                            }
                          }}
                          className="p-2 opacity-0 group-hover/item:opacity-100 transition-opacity text-stone-300 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-6 h-6 text-stone-200" />
                    </div>
                    <p className="text-sm font-bold text-stone-400 uppercase tracking-widest">No Recent Activity</p>
                    <p className="text-xs text-stone-300">Log your first transaction to see history.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-stone-200 px-12 py-3 flex justify-around items-center sm:hidden z-40 pb-safe">
        <button className="flex flex-col items-center gap-1 text-stone-900">
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Dashboard</span>
        </button>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-stone-900 text-white p-4 rounded-2xl -mt-10 shadow-lg shadow-stone-900/20 active:scale-90 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
        <button 
          onClick={() => {
            setEditingGoal(null);
            setShowGoalModal(true);
          }}
          className="flex flex-col items-center gap-1 text-stone-400">
          <Target className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Goals</span>
        </button>
      </div>

      {/* Mobile Install Tip */}
      <AnimatePresence>
        {showMobileTip && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-20 left-4 right-4 bg-stone-900 text-white p-4 rounded-2xl z-50 shadow-2xl flex items-center justify-between sm:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold">Add to Home Screen</p>
                <p className="text-[10px] text-stone-400">Use FinTrack like a real app!</p>
              </div>
            </div>
            <button 
              onClick={() => setShowMobileTip(false)}
              className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-lg"
            >
              Got it
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ title, amount, icon, className, tooltip, isWarning, isCritical, subLabel }: { 
  title: string, 
  amount: number, 
  icon: React.ReactNode, 
  className?: string, 
  tooltip?: string,
  isWarning?: boolean,
  isCritical?: boolean,
  subLabel?: string
}) {
  const isDark = className?.includes('bg-stone-900');
  
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={cn(
        "p-6 rounded-[2rem] space-y-4 transition-all duration-300 border relative overflow-hidden", 
        isDark ? "bg-stone-900 border-stone-800 shadow-xl shadow-stone-900/20" : "bg-white border-stone-100 shadow-sm hover:shadow-xl hover:shadow-stone-200/50",
        isWarning && "bg-amber-50/50 border-amber-100",
        isCritical && "bg-rose-50/50 border-rose-100",
        className
      )}
    >
      {isCritical && (
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-rose-500 pointer-events-none"
        />
      )}
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2.5 rounded-2xl transition-colors",
            isDark ? "bg-white/10 text-stone-400" : "bg-stone-50 text-stone-600"
          )}>
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' }) : icon}
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-[0.2em]", 
            isDark ? "text-stone-400" : isCritical ? "text-rose-600" : isWarning ? "text-amber-600" : "text-stone-500"
          )}>
            {title}
          </span>
        </div>
        {tooltip && (
          <div className="group/tooltip relative">
            <Info className={cn("w-3.5 h-3.5 cursor-help", isDark ? "text-stone-500" : "text-stone-300")} />
            <div className="absolute bottom-full right-0 mb-3 w-64 p-4 bg-stone-900 text-white text-[11px] leading-relaxed rounded-2xl opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none z-50 shadow-2xl border border-white/10 backdrop-blur-xl">
              {tooltip}
              <div className="absolute top-full right-4 -mt-1 border-8 border-transparent border-t-stone-900" />
            </div>
          </div>
        )}
      </div>
      
      <div className="space-y-1 relative z-10">
        <div className="flex items-baseline justify-between gap-2">
          <div className={cn(
            "text-3xl font-bold tracking-tight", 
            isDark ? "text-white" : isCritical ? "text-rose-700" : isWarning ? "text-amber-700" : "text-stone-900"
          )}>
            {title.toLowerCase().includes('runway') ? amount.toFixed(0) : formatCurrency(Math.abs(amount))}
            {title.toLowerCase().includes('runway') && <span className="text-sm font-medium ml-1.5 opacity-40">days</span>}
          </div>
          {subLabel && (
            <span className={cn(
              "text-[11px] font-bold px-2 py-0.5 rounded-full",
              isCritical ? "bg-rose-100 text-rose-600" : isWarning ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
            )}>
              {subLabel}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          {isCritical ? (
            <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Critical Action Required
            </p>
          ) : isWarning ? (
            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Efficiency Risk
            </p>
          ) : (
            <p className={cn("text-[9px] font-bold uppercase tracking-widest opacity-40", isDark ? "text-stone-400" : "text-stone-500")}>
              Optimal Performance
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function GoalItem({ goal, isDemo, onEdit }: { goal: Goal, isDemo?: boolean, onEdit?: () => void }) {
  const normalizedType = (goal.type as any) === 'sip' ? 'investment' : (goal.type as any) === 'loan' ? 'debt' : goal.type;
  const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const remaining = goal.targetAmount - goal.currentAmount;
  
  const getIcon = () => {
    switch (normalizedType) {
      case 'savings': return <PiggyBank className="w-5 h-5" />;
      case 'debt': return <Landmark className="w-5 h-5" />;
      case 'investment': return <TrendingUp className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getStatus = () => {
    if (progress >= 100) return { label: 'Achieved', color: 'text-emerald-600 bg-emerald-50' };
    if (progress >= 75) return { label: 'Near Target', color: 'text-blue-600 bg-blue-50' };
    if (progress >= 25) return { label: 'Progressing', color: 'text-amber-600 bg-amber-50' };
    return { label: 'Initial Phase', color: 'text-stone-500 bg-stone-100' };
  };

  const status = getStatus();

  const getProjection = () => {
    if (!goal.monthlyContribution || goal.monthlyContribution <= 0 || progress >= 100) return null;
    const months = Math.ceil(remaining / goal.monthlyContribution);
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  const projection = getProjection();

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={cn(
        "p-8 rounded-[2.5rem] border border-stone-100 bg-white shadow-sm hover:shadow-2xl hover:shadow-stone-200/50 transition-all group relative overflow-hidden",
        isDemo && "opacity-60 grayscale"
      )}
    >
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex gap-5">
          <div className={cn(
            "w-14 h-14 rounded-3xl flex items-center justify-center shadow-inner",
            normalizedType === 'savings' ? "bg-indigo-50 text-indigo-600" : 
            normalizedType === 'debt' ? "bg-stone-900 text-white" : "bg-blue-50 text-blue-600"
          )}>
            {getIcon()}
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xl font-bold text-stone-900 tracking-tight">{goal.name}</h4>
            <div className="flex items-center gap-3">
              <span className={cn("text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest", status.color)}>
                {status.label}
              </span>
              {projection && (
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                  Est. {projection}
                </span>
              )}
            </div>
          </div>
        </div>
        {!isDemo && onEdit && (
          <button 
            onClick={onEdit}
            className="p-3 hover:bg-stone-50 rounded-2xl transition-all text-stone-300 hover:text-stone-900 border border-transparent hover:border-stone-100"
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        )}
      </div>
      
      <div className="space-y-6 relative z-10">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">
              {normalizedType === 'debt' ? 'Principal Paid' : 'Capital Reserved'}
            </p>
            <span className="text-2xl font-bold text-stone-900 tracking-tighter">{formatCurrency(goal.currentAmount)}</span>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">
              {normalizedType === 'debt' ? 'Total Loan' : 'Target'}
            </p>
            <span className="text-sm font-bold text-stone-400">{formatCurrency(goal.targetAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-2 w-full bg-stone-50 rounded-full overflow-hidden border border-stone-100">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                normalizedType === 'savings' ? "bg-indigo-500" : 
                normalizedType === 'debt' ? "bg-stone-900" : "bg-blue-500"
              )}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.3em]">
              {progress.toFixed(0)}% Complete
            </span>
            <span className="text-[10px] font-bold text-stone-900 uppercase tracking-[0.3em]">
              {formatCurrency(remaining)} To Freedom
            </span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <h3 className="text-xl font-bold">{goal ? 'Edit Goal' : 'New Goal'}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Goal Name</label>
            <input 
              autoFocus
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency Fund, Home Loan"
              className="w-full bg-stone-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-stone-900 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Target Amount</label>
              <input 
                type="number" 
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-stone-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-stone-900 transition-all"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Monthly Contribution</label>
              <input 
                type="number" 
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                placeholder="0"
                className="w-full bg-stone-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-stone-900 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Current Progress</label>
            <input 
              type="number" 
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-stone-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-stone-900 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Goal Type</label>
            <div className="flex gap-2">
              {(['savings', 'debt', 'investment'] as GoalType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                    type === t 
                      ? "bg-stone-900 text-white border-stone-900 shadow-md" 
                      : "bg-white text-stone-400 border-stone-200 hover:border-stone-400"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Target Date (Optional)</label>
            <input 
              type="date" 
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-stone-900 transition-all"
            />
          </div>

          <div className="pt-2 space-y-3">
            {!showConfirmDelete ? (
              <>
                <button 
                  disabled={isSubmitting}
                  className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-all shadow-lg disabled:opacity-50 active:scale-95"
                >
                  {isSubmitting ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
                </button>
                {goal && (
                  <button 
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    disabled={isSubmitting}
                    className="w-full bg-rose-50 text-rose-600 py-3.5 rounded-xl font-medium hover:bg-rose-100 transition-all disabled:opacity-50"
                  >
                    Delete Goal
                  </button>
                )}
              </>
            ) : (
              <div className="bg-rose-50 p-4 rounded-2xl space-y-3 border border-rose-100">
                <p className="text-xs text-rose-800 font-medium text-center">Are you sure you want to delete this goal? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    className="flex-1 bg-white text-stone-600 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-stone-200 hover:bg-stone-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-rose-700 transition-all shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? '...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <h3 className="text-xl font-bold">Quick Log</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Smart Templates Row */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Frequent Merchants</label>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {smartTemplates.slice(0, 5).map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="flex-shrink-0 px-3 py-1.5 bg-stone-50 border border-stone-100 rounded-lg text-[10px] font-bold text-stone-600 hover:bg-stone-100 transition-all active:scale-95"
                >
                  {t.name}
                </button>
              ))}
              {smartTemplates.length === 0 && <span className="text-[10px] text-stone-300 italic">No history yet</span>}
            </div>
          </div>

          <div className="flex bg-stone-100 p-1 rounded-xl">
            <button 
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                type === 'expense' ? "bg-white shadow-sm text-rose-600" : "text-stone-500"
              )}
            >
              Expense
            </button>
            <button 
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                type === 'income' ? "bg-white shadow-sm text-emerald-600" : "text-stone-500"
              )}
            >
              Income
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Merchant / Description</label>
              <input 
                autoFocus
                type="text" 
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Where did you spend?"
                className="w-full bg-stone-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-stone-900 transition-all"
                required
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-100 rounded-xl shadow-xl z-10 overflow-hidden">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const t = smartTemplates.find(x => x.name === s);
                        if (t) applyTemplate(t);
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-none"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-medium">₹</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-stone-50 border-none rounded-xl py-3 pl-8 pr-4 text-sm focus:ring-2 focus:ring-stone-900 transition-all"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-stone-900 transition-all appearance-none"
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
            className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-all shadow-lg disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Logging...' : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                Log Transaction
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
