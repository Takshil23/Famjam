/**
 * Famjam - App Controller
 * Handles application state, UI rendering, calculations, and data visualization.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCqkUq9CEAYY4qCLZmI8tHenagKjFGkMaE",
  authDomain: "famjam-30548.firebaseapp.com",
  projectId: "famjam-30548",
  storageBucket: "famjam-30548.firebasestorage.app",
  messagingSenderId: "466051064482",
  appId: "1:466051064482:web:819bba0009db2e6c04edfb",
  measurementId: "G-VNHMD6X04B"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================================================
// STATE MANAGEMENT & LOCAL STORAGE
// ==========================================================================
class FinanceStore {
  constructor() {
    this.storageKey = 'salaryflow_data';
    this.state = this.loadState();
  }

  // Load state from localStorage or initialize with seed data
  loadState() {
    const raw = localStorage.getItem(this.storageKey);
    let state;
    if (raw) {
      try {
        state = JSON.parse(raw);
      } catch (e) {
        console.error("Failed to parse local storage data, resetting.", e);
      }
    }
    if (!state) {
      state = this.generateSeedData();
    }
    // Migration: ensure categories list exists
    if (!state.categories) {
      state.categories = this.getDefaultCategories();
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    }
    // Migration: ensure groups list exists
    if (!state.groups) {
      state.groups = [];
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    }
    // Migration: ensure joinedGroups list exists
    if (!state.joinedGroups) {
      state.joinedGroups = [];
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    }
    return state;
  }

  // Init Firebase listeners after AppController loads
  initFirebaseListeners() {
    if (this.state.joinedGroups) {
      this.state.joinedGroups.forEach(code => this.listenToGroup(code));
    }
  }

  // Save current state to localStorage and cloud
  saveState() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    if (this.currentUserEmail && this._cloudReady) {
      setDoc(doc(db, "users", this.currentUserEmail), this.state).catch(e => console.error("Cloud sync error:", e));
    }
  }

  // Check if local state has any real user data (not just empty defaults)
  _hasRealData() {
    return (this.state.income && this.state.income.length > 0) ||
           (this.state.expenses && this.state.expenses.length > 0);
  }

  async syncUserToCloud(email) {
    this.currentUserEmail = email;
    this._cloudReady = false;
    this._isFirstSnapshot = true;

    try {
      onSnapshot(doc(db, "users", email), (docSnap) => {
        if (docSnap.exists()) {
          // Cloud data found — always use cloud data as the source of truth
          const cloudData = docSnap.data();
          
          // Ensure cloud data has required structure
          if (!cloudData.categories) cloudData.categories = this.getDefaultCategories();
          if (!cloudData.income) cloudData.income = [];
          if (!cloudData.expenses) cloudData.expenses = [];
          if (!cloudData.groups) cloudData.groups = [];
          if (!cloudData.joinedGroups) cloudData.joinedGroups = [];

          this.state = cloudData;
          localStorage.setItem(this.storageKey, JSON.stringify(this.state));
          this._cloudReady = true;
          
          if (window.appControllerInstance) {
            window.appControllerInstance.updateView();
          }
          console.log("Data loaded from cloud for", email);
        } else {
          // No cloud data exists for this user
          this._cloudReady = true;
          
          if (this._hasRealData()) {
            // User has local data — push it to cloud
            console.log("No cloud data found, saving local data to cloud for", email);
            this.saveState();
          } else {
            // No data anywhere — start fresh (empty)
            console.log("New user, starting with empty data for", email);
            this.saveState();
          }
          
          if (window.appControllerInstance) {
            window.appControllerInstance.updateView();
          }
        }
        this._isFirstSnapshot = false;
      });
    } catch(e) {
      console.error("Failed to listen to user cloud data:", e);
      this._cloudReady = true; // Allow offline saves to localStorage
    }
  }

  // Initialize with empty data for new users
  generateSeedData() {
    return {
      categories: this.getDefaultCategories(),
      groups: [],
      income: [],
      expenses: []
    };
  }

  // Add a new income item
  addIncome(source, amount, date, status) {
    const item = {
      id: 'inc-' + Date.now() + Math.random().toString(36).substr(2, 5),
      source,
      amount: parseFloat(amount),
      date,
      status // 'received' or 'pending'
    };
    this.state.income.push(item);
    this.saveState();
    return item;
  }

  // Add a new expense item
  addExpense(name, amount, category, date, status) {
    const item = {
      id: 'exp-' + Date.now() + Math.random().toString(36).substr(2, 5),
      name,
      amount: parseFloat(amount),
      category,
      date,
      status // 'paid' or 'pending'
    };
    this.state.expenses.push(item);
    this.saveState();
    return item;
  }

  // Delete an item
  deleteItem(type, id) {
    if (type === 'income') {
      this.state.income = this.state.income.filter(item => item.id !== id);
    } else {
      this.state.expenses = this.state.expenses.filter(item => item.id !== id);
    }
    this.saveState();
  }

  // Toggle statuses
  toggleIncomeStatus(id, isChecked) {
    const item = this.state.income.find(item => item.id === id);
    if (item) {
      item.status = isChecked ? 'received' : 'pending';
      this.saveState();
    }
  }

  toggleExpenseStatus(id, isChecked) {
    const item = this.state.expenses.find(item => item.id === id);
    if (item) {
      item.status = isChecked ? 'paid' : 'pending';
      this.saveState();
    }
  }

  // Filter items by month (YYYY-MM)
  getItemsByMonth(monthStr) {
    const filterFn = (item) => item.date.startsWith(monthStr);
    return {
      income: this.state.income.filter(filterFn),
      expenses: this.state.expenses.filter(filterFn)
    };
  }

  // Clear current month data
  clearMonth(monthStr) {
    this.state.income = this.state.income.filter(item => !item.date.startsWith(monthStr));
    this.state.expenses = this.state.expenses.filter(item => !item.date.startsWith(monthStr));
    this.saveState();
  }

  // Groups methods (Firebase Synced)
  async addGroup(name, targetAmount) {
    const inviteCode = name.substring(0,3).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
    const group = {
      name,
      targetAmount: parseFloat(targetAmount),
      inviteCode,
      contributions: []
    };
    
    try {
      await setDoc(doc(db, "groups", inviteCode), group);
      this.joinGroup(inviteCode);
    } catch(e) {
      console.error("Error creating group:", e);
      alert("Failed to create group. Check Firebase permissions!");
    }
  }

  async addGroupContribution(inviteCode, member, amount) {
    let userId = 'unknown';
    try {
      const userStr = localStorage.getItem('salaryflow_user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed.email) userId = parsed.email;
      }
    } catch(e) {}

    try {
      await updateDoc(doc(db, "groups", inviteCode), {
        contributions: arrayUnion({
          id: 'c-' + Date.now(),
          userId,
          member,
          amount: parseFloat(amount),
          date: new Date().toISOString()
        })
      });
    } catch(e) {
      console.error("Error adding contribution:", e);
      alert("Failed to add funds.");
    }
  }

  joinGroup(inviteCode) {
    if (!this.state.joinedGroups) this.state.joinedGroups = [];
    if (!this.state.joinedGroups.includes(inviteCode)) {
      this.state.joinedGroups.push(inviteCode);
      this.saveState();
      this.listenToGroup(inviteCode);
    }
  }

  listenToGroup(inviteCode) {
    onSnapshot(doc(db, "groups", inviteCode), (docSnap) => {
      if (docSnap.exists()) {
        const groupData = docSnap.data();
        const index = this.state.groups.findIndex(g => g.inviteCode === inviteCode);
        if (index > -1) {
          this.state.groups[index] = groupData;
        } else {
          this.state.groups.push(groupData);
        }
        if (window.appControllerInstance) {
          window.appControllerInstance.updateView();
        }
      }
    });
  }

  // Import full dataset
  importData(data) {
    if (Array.isArray(data.income) && Array.isArray(data.expenses)) {
      this.state.income = data.income;
      this.state.expenses = data.expenses;
      this.state.categories = Array.isArray(data.categories) ? data.categories : this.getDefaultCategories();
      this.saveState();
      return true;
    }
    return false;
  }

  getDefaultCategories() {
    return [
      { id: 'housing', name: 'Housing & Rent', color: '#6366f1' },
      { id: 'utilities', name: 'Utilities & Bills', color: '#06b6d4' },
      { id: 'food', name: 'Groceries & Dining', color: '#10b981' },
      { id: 'transport', name: 'Transport & Gas', color: '#f59e0b' },
      { id: 'entertainment', name: 'Entertainment & Leisure', color: '#ec4899' },
      { id: 'healthcare', name: 'Healthcare & Insurance', color: '#ef4444' },
      { id: 'education', name: 'Education & Kids', color: '#8b5cf6' },
      { id: 'other', name: 'Other Expenses', color: '#6b7280' }
    ];
  }

  addCategory(name, color) {
    let id = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    if (!id) id = 'cat-' + Date.now();
    if (this.state.categories.some(c => c.id === id)) {
      id = id + '-' + Math.random().toString(36).substr(2, 3);
    }
    const category = { id, name, color };
    this.state.categories.push(category);
    this.saveState();
    return category;
  }

  getCategoryColor(categoryId) {
    const cat = this.state.categories.find(c => c.id === categoryId);
    return cat ? cat.color : '#6b7280';
  }

  getCategoryName(categoryId) {
    const cat = this.state.categories.find(c => c.id === categoryId);
    return cat ? cat.name : 'Other';
  }
}

// Initialize global store
const store = new FinanceStore();

// ==========================================================================
// CHARTS CONTROLLER
// ==========================================================================
let categoryChartInstance = null;
let cashflowChartInstance = null;

function renderCharts(monthData, isDarkTheme) {
  const textMain = isDarkTheme ? '#f3f4f6' : '#1e293b';
  const textMuted = isDarkTheme ? '#9ca3af' : '#64748b';
  const borderVal = isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

  // 1. EXPENSE BY CATEGORY CHART (DOUGHNUT)
  const categoryCanvas = document.getElementById('categoryChart');
  if (categoryCanvas) {
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }

    // Accumulate amounts by category dynamically
    const categories = {};
    store.state.categories.forEach(cat => {
      categories[cat.id] = 0;
    });

    monthData.expenses.forEach(exp => {
      if (categories[exp.category] !== undefined) {
        categories[exp.category] += exp.amount;
      } else {
        if (categories['other'] === undefined) {
          categories['other'] = 0;
        }
        categories['other'] += exp.amount;
      }
    });

    const activeKeys = Object.keys(categories).filter(k => categories[k] > 0);
    const chartData = activeKeys.map(k => categories[k]);
    const chartLabels = activeKeys.map(k => store.getCategoryName(k));
    const chartColors = activeKeys.map(k => store.getCategoryColor(k));

    if (activeKeys.length === 0) {
      // Draw empty placeholder chart
      categoryChartInstance = new Chart(categoryCanvas, {
        type: 'doughnut',
        data: {
          labels: ['No Data'],
          datasets: [{
            data: [1],
            backgroundColor: [isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'bottom', labels: { color: textMuted } },
            tooltip: { enabled: false }
          }
        }
      });
    } else {
      categoryChartInstance = new Chart(categoryCanvas, {
        type: 'doughnut',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartData,
            backgroundColor: chartColors,
            borderColor: isDarkTheme ? '#141d2f' : '#ffffff',
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textMuted,
                font: { family: 'Plus Jakarta Sans', size: 11 }
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => ` ₹${context.raw.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              }
            }
          }
        }
      });
    }
  }

  // 2. CASH FLOW COMPARISON CHART (BAR)
  const cashflowCanvas = document.getElementById('cashflowChart');
  if (cashflowCanvas) {
    if (cashflowChartInstance) {
      cashflowChartInstance.destroy();
    }

    // Calculations
    const recInc = monthData.income.filter(i => i.status === 'received').reduce((sum, i) => sum + i.amount, 0);
    const pendInc = monthData.income.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0);
    const paidExp = monthData.expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
    const pendExp = monthData.expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);

    cashflowChartInstance = new Chart(cashflowCanvas, {
      type: 'bar',
      data: {
        labels: ['Received (Paid)', 'Pending (Expected)'],
        datasets: [
          {
            label: 'Income',
            data: [recInc, pendInc],
            backgroundColor: ['#10b981', '#34d399'],
            borderRadius: 6,
            barPercentage: 0.6
          },
          {
            label: 'Expenses',
            data: [paidExp, pendExp],
            backgroundColor: ['#ef4444', '#f87171'],
            borderRadius: 6,
            barPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textMuted,
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ₹${context.raw.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textMuted, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: borderVal },
            ticks: {
              color: textMuted,
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: (val) => '₹' + val.toLocaleString('en-IN')
            }
          }
        }
      }
    });
  }
}

// ==========================================================================
// USER INTERACTION & DOM RENDERING
// ==========================================================================
class AppController {
  constructor() {
    this.activeMonthStr = this.getInitialMonthString();
    this.isDarkTheme = true;
    
    // Bind DOM elements
    this.dom = {
      // Login Elements
      loginOverlay: document.getElementById('login-overlay'),
      formLogin: document.getElementById('form-login'),
      loginEmail: document.getElementById('login-email'),
      btnSendOtp: document.getElementById('btn-send-otp'),
      stepPhone: document.getElementById('step-phone'),
      stepOtp: document.getElementById('step-otp'),
      stepUserInfo: document.getElementById('step-userinfo'),
      displayPhoneNumber: document.getElementById('display-phone-number'),
      btnEditPhone: document.getElementById('btn-edit-phone'),
      otpBoxes: document.querySelectorAll('.otp-box'),
      btnVerifyOtp: document.getElementById('btn-verify-otp'),
      otpError: document.getElementById('otp-error'),
      loginFirstName: document.getElementById('login-firstname'),
      loginSurname: document.getElementById('login-surname'),
      btnSaveProfile: document.getElementById('btn-save-profile'),

      monthFilter: document.getElementById('month-filter'),
      yearFilter: document.getElementById('year-filter'),
      themeToggle: document.getElementById('theme-toggle'),
      dataMenuToggle: document.getElementById('data-menu-toggle'),
      dataDropdown: document.getElementById('data-dropdown'),
      btnExport: document.getElementById('btn-export'),
      btnImportTrigger: document.getElementById('btn-import-trigger'),
      importFile: document.getElementById('import-file'),
      btnClearAll: document.getElementById('btn-clear-all'),

      // Stat Cards
      valIncomeReceived: document.getElementById('val-income-received'),
      valIncomePending: document.getElementById('val-income-pending'),
      valExpensePaid: document.getElementById('val-expense-paid'),
      valExpensePending: document.getElementById('val-expense-pending'),
      valBalance: document.getElementById('val-balance'),
      valUtilization: document.getElementById('val-utilization'),
      utilizationBar: document.getElementById('utilization-bar'),
      utilizationStatus: document.getElementById('utilization-status'),

      // Lists
      incomeList: document.getElementById('income-list'),
      expenseList: document.getElementById('expense-list'),
      footerTotalIncome: document.getElementById('footer-total-income'),
      footerTotalExpense: document.getElementById('footer-total-expense'),

      // Add Toggles
      btnToggleAddIncome: document.getElementById('btn-toggle-add-income'),
      btnToggleAddExpense: document.getElementById('btn-toggle-add-expense'),
      formIncome: document.getElementById('form-income'),
      formExpense: document.getElementById('form-expense'),
      btnCancelIncome: document.getElementById('btn-cancel-income'),
      btnCancelExpense: document.getElementById('btn-cancel-expense'),
      
      // Category elements
      btnManageCategories: document.getElementById('btn-manage-categories'),
      formCategory: document.getElementById('form-category'),
      btnCancelCategory: document.getElementById('btn-cancel-category'),

      // Groups elements
      btnJoinGroup: document.getElementById('btn-join-group'),
      btnToggleAddGroup: document.getElementById('btn-toggle-add-group'),
      formCreateGroup: document.getElementById('form-create-group'),
      btnCancelGroup: document.getElementById('btn-cancel-group'),
      groupsGrid: document.getElementById('groups-grid'),
      
      // Add funds modal
      modalAddFunds: document.getElementById('modal-add-funds'),
      formAddFunds: document.getElementById('form-add-funds'),
      btnCancelFunds: document.getElementById('btn-cancel-funds'),
      fundGroupId: document.getElementById('fund-group-id'),
      fundMemberName: document.getElementById('fund-member-name'),
      fundAmount: document.getElementById('fund-amount'),
      modalGroupTitle: document.getElementById('modal-group-title')
    };

    this.init();
  }

  // Get current YYYY-MM
  getInitialMonthString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  init() {
    // 0. Initialize Authentication
    this.initAuth();

    // 1. Set current month in filter input
    const parts = this.activeMonthStr.split('-');
    this.dom.yearFilter.value = parts[0];
    this.dom.monthFilter.value = parts[1];
    
    // 1.5. Populate Categories dropdown
    this.populateCategoryDropdown();

    // 2. Set dark mode theme based on stored preferences or system settings
    this.initTheme();

    // 3. Register Event Listeners
    this.registerEventListeners();

    // 4. Update UI View
    this.updateView();
  }

  initAuth() {
    const token = localStorage.getItem('salaryflow_token');
    const userStr = localStorage.getItem('salaryflow_user');

    if (token && userStr) {
      // Valid new-auth session found
      this.dom.loginOverlay.classList.add('hidden');
      try {
        const parsed = JSON.parse(userStr);
        if (this.dom.fundMemberName && parsed.name) {
          this.dom.fundMemberName.value = parsed.name;
        }
        store.syncUserToCloud(parsed.email);
      } catch(e) {
        console.error("Error restoring user session:", e);
      }
    } else {
      // No valid session — clear any stale data from old Firebase auth and show login
      localStorage.removeItem('salaryflow_user');
      this.dom.loginOverlay.classList.remove('hidden');
      this.setupEmailOtpAuth();
    }
  }

  setupEmailOtpAuth() {
    this._verifiedEmail = null;
    this._authToken = null;

    // Step 1 → Step 2: Request OTP
    this.dom.btnSendOtp.addEventListener('click', async () => {
      const email = this.dom.loginEmail.value.trim();
      if (!email) {
        alert("Please enter your email address");
        return;
      }

      this.dom.btnSendOtp.disabled = true;
      this.dom.btnSendOtp.innerText = 'Sending...';

      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (data.success) {
          this._verifiedEmail = email;
          this.dom.displayPhoneNumber.innerText = email;
          this.dom.stepPhone.style.display = 'none';
          this.dom.stepOtp.style.display = 'block';

          if (data.demoMode) {
            this.dom.otpError.style.display = 'block';
            this.dom.otpError.style.color = 'var(--info)';
            this.dom.otpError.innerText = `Your OTP: ${data.otp}`;
          }
        } else {
          alert(data.error || 'Failed to send OTP. Please try again.');
          this.dom.btnSendOtp.disabled = false;
          this.dom.btnSendOtp.innerText = 'Send OTP';
        }
      } catch(e) {
        alert('Network error. Please check your connection and try again.');
        this.dom.btnSendOtp.disabled = false;
        this.dom.btnSendOtp.innerText = 'Send OTP';
      }
    });

    // OTP input: auto-advance on digit entry, backspace to go back
    this.dom.otpBoxes.forEach((box, index) => {
      box.addEventListener('input', (e) => {
        if (e.target.value.length === 1) {
          if (index < this.dom.otpBoxes.length - 1) {
            this.dom.otpBoxes[index + 1].focus();
          }
        }
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '') {
          if (index > 0) {
            this.dom.otpBoxes[index - 1].focus();
          }
        }
      });
    });

    // Edit email: go back to step 1
    this.dom.btnEditPhone.addEventListener('click', () => {
      this.dom.otpBoxes.forEach(box => box.value = '');
      this.dom.otpError.style.display = 'none';
      this.dom.stepOtp.style.display = 'none';
      this.dom.stepPhone.style.display = 'block';
      this.dom.btnSendOtp.disabled = false;
      this.dom.btnSendOtp.innerText = 'Send OTP';
    });

    // Step 2 → Step 3: Verify OTP
    this.dom.btnVerifyOtp.addEventListener('click', async () => {
      let code = "";
      this.dom.otpBoxes.forEach(box => code += box.value);

      if (code.length !== 6) {
        this.dom.otpError.style.display = 'block';
        this.dom.otpError.style.color = 'var(--danger)';
        this.dom.otpError.innerText = 'Please enter the complete 6-digit OTP.';
        return;
      }

      this.dom.btnVerifyOtp.disabled = true;
      this.dom.btnVerifyOtp.innerText = 'Verifying...';

      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this._verifiedEmail, otp: code })
        });
        const data = await res.json();

        if (data.success) {
          this._authToken = data.token;
          localStorage.setItem('salaryflow_token', data.token);

          if (!data.isNewUser && data.user.firstName) {
            // Returning user with a complete profile — go straight to dashboard
            const userData = {
              id: data.user.id,
              email: data.user.email,
              firstName: data.user.firstName,
              surname: data.user.surname,
              name: `${data.user.firstName} ${data.user.surname}`
            };
            localStorage.setItem('salaryflow_user', JSON.stringify(userData));
            this.dom.loginOverlay.classList.add('hidden');
            if (this.dom.fundMemberName) {
              this.dom.fundMemberName.value = userData.name;
            }
            store.syncUserToCloud(userData.email);
          } else {
            // New user or incomplete profile — collect name
            this.dom.stepOtp.style.display = 'none';
            this.dom.stepUserInfo.style.display = 'block';
          }
        } else {
          this.dom.otpError.style.display = 'block';
          this.dom.otpError.style.color = 'var(--danger)';
          this.dom.otpError.innerText = data.error || 'Invalid OTP. Please try again.';
          this.dom.btnVerifyOtp.disabled = false;
          this.dom.btnVerifyOtp.innerText = 'Verify OTP';
        }
      } catch(e) {
        alert('Network error. Please check your connection and try again.');
        this.dom.btnVerifyOtp.disabled = false;
        this.dom.btnVerifyOtp.innerText = 'Verify OTP';
      }
    });

    // Step 3 → Dashboard: Save name and enter app
    this.dom.btnSaveProfile.addEventListener('click', async () => {
      const firstName = this.dom.loginFirstName.value.trim();
      const surname = this.dom.loginSurname.value.trim();

      if (!firstName || !surname) {
        alert('Please fill in your first name and surname.');
        return;
      }

      this.dom.btnSaveProfile.disabled = true;
      this.dom.btnSaveProfile.innerText = 'Saving...';

      try {
        const res = await fetch('/api/auth/save-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: this._authToken, firstName, surname })
        });
        const data = await res.json();

        if (data.success) {
          const userData = {
            id: data.user.id,
            email: this._verifiedEmail,
            firstName,
            surname,
            name: `${firstName} ${surname}`
          };
          localStorage.setItem('salaryflow_user', JSON.stringify(userData));
          this.dom.loginOverlay.classList.add('hidden');
          if (this.dom.fundMemberName) {
            this.dom.fundMemberName.value = userData.name;
          }
          store.syncUserToCloud(this._verifiedEmail);
        } else {
          alert(data.error || 'Failed to save profile. Please try again.');
          this.dom.btnSaveProfile.disabled = false;
          this.dom.btnSaveProfile.innerText = 'Continue to Dashboard';
        }
      } catch(e) {
        alert('Network error. Please check your connection and try again.');
        this.dom.btnSaveProfile.disabled = false;
        this.dom.btnSaveProfile.innerText = 'Continue to Dashboard';
      }
    });
  }

  initTheme() {
    const savedTheme = localStorage.getItem('salaryflow_theme');
    if (savedTheme === 'light') {
      this.isDarkTheme = false;
      document.documentElement.setAttribute('data-theme', 'light');
      document.querySelector('.icon-moon').style.display = 'none';
      document.querySelector('.icon-sun').style.display = 'block';
    } else {
      this.isDarkTheme = true;
      document.documentElement.setAttribute('data-theme', 'dark');
      document.querySelector('.icon-moon').style.display = 'block';
      document.querySelector('.icon-sun').style.display = 'none';
    }
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    if (this.isDarkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.querySelector('.icon-moon').style.display = 'block';
      document.querySelector('.icon-sun').style.display = 'none';
      localStorage.setItem('salaryflow_theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.querySelector('.icon-moon').style.display = 'none';
      document.querySelector('.icon-sun').style.display = 'block';
      localStorage.setItem('salaryflow_theme', 'light');
    }
    // Re-render charts with updated theme colors
    const monthData = store.getItemsByMonth(this.activeMonthStr);
    renderCharts(monthData, this.isDarkTheme);
  }

  registerEventListeners() {
    // Month filter changed
    const updateActiveMonth = () => {
      this.activeMonthStr = `${this.dom.yearFilter.value}-${this.dom.monthFilter.value}`;
      this.updateView();
    };
    this.dom.monthFilter.addEventListener('change', updateActiveMonth);
    this.dom.yearFilter.addEventListener('change', updateActiveMonth);

    // Theme Toggle
    this.dom.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Data dropdown toggle
    this.dom.dataMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dom.dataDropdown.classList.toggle('hidden');
    });

    // Close data dropdown when clicking elsewhere
    document.addEventListener('click', () => {
      this.dom.dataDropdown.classList.add('hidden');
    });
    this.dom.dataDropdown.addEventListener('click', (e) => e.stopPropagation());

    // Export Action
    this.dom.btnExport.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `famjam-backup-${this.activeMonthStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Logout Action
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('salaryflow_user');
        localStorage.removeItem('salaryflow_token');
        window.location.reload();
      });
    }

    // Import Action
    this.dom.btnImportTrigger.addEventListener('click', () => {
      this.dom.importFile.click();
    });

    this.dom.importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (store.importData(parsed)) {
            alert("Data imported successfully!");
            this.updateView();
          } else {
            alert("Invalid backup file format.");
          }
        } catch (err) {
          alert("Error parsing JSON file.");
        }
      };
      reader.readAsText(file);
    });

    // Clear All Month Data Action
    this.dom.btnClearAll.addEventListener('click', () => {
      if (confirm(`Are you sure you want to clear all data for the period: ${this.activeMonthStr}?`)) {
        store.clearMonth(this.activeMonthStr);
        this.updateView();
        this.dom.dataDropdown.classList.add('hidden');
      }
    });

    // Form Toggle Buttons
    this.dom.btnToggleAddIncome.addEventListener('click', () => {
      this.dom.formIncome.classList.toggle('hidden');
      this.dom.incomeList.classList.toggle('form-expanded');
      // Set date to current filtered month
      this.dom.formIncome.querySelector('#income-date').value = `${this.activeMonthStr}-01`;
    });

    this.dom.btnToggleAddExpense.addEventListener('click', () => {
      this.dom.formExpense.classList.toggle('hidden');
      this.dom.expenseList.classList.toggle('form-expanded');
      this.dom.formExpense.querySelector('#expense-date').value = `${this.activeMonthStr}-01`;
    });

    this.dom.btnCancelIncome.addEventListener('click', () => {
      this.dom.formIncome.classList.add('hidden');
      this.dom.formIncome.reset();
    });

    this.dom.btnCancelExpense.addEventListener('click', () => {
      this.dom.formExpense.classList.add('hidden');
      this.dom.formExpense.reset();
    });

    // Category Management Form Toggle
    this.dom.btnManageCategories.addEventListener('click', () => {
      this.dom.formCategory.classList.toggle('hidden');
    });

    this.dom.btnCancelCategory.addEventListener('click', () => {
      this.dom.formCategory.classList.add('hidden');
      this.dom.formCategory.reset();
    });

    // Category Form Submission
    this.dom.formCategory.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('category-name').value;
      const color = document.getElementById('category-color').value;

      store.addCategory(name, color);
      this.dom.formCategory.reset();
      this.dom.formCategory.classList.add('hidden');
      
      this.populateCategoryDropdown();
      // Auto select the new category
      const select = document.getElementById('expense-category');
      if (select && select.lastChild) {
        select.value = select.lastChild.value;
      }
      this.updateView();
    });

    // Form Submissions
    this.dom.formIncome.addEventListener('submit', (e) => {
      e.preventDefault();
      const src = document.getElementById('income-source').value;
      const amt = document.getElementById('income-amount').value;
      const dt = document.getElementById('income-date').value;
      const stat = document.getElementById('income-status').value;

      store.addIncome(src, amt, dt, stat);
      this.dom.formIncome.reset();
      this.dom.formIncome.classList.add('hidden');
      this.updateView();
    });

    this.dom.formExpense.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('expense-name').value;
      const amt = document.getElementById('expense-amount').value;
      const cat = document.getElementById('expense-category').value;
      const dt = document.getElementById('expense-date').value;
      const stat = document.getElementById('expense-status').value;

      store.addExpense(name, amt, cat, dt, stat);
      this.dom.formExpense.reset();
      this.dom.formExpense.classList.add('hidden');
      this.updateView();
    });

    // Groups Event Listeners
    this.dom.btnJoinGroup.addEventListener('click', () => {
      const code = prompt("Enter the Group Invite Code (e.g. FAM-294X):");
      if (code && code.trim() !== '') {
        store.joinGroup(code.trim().toUpperCase());
      }
    });

    this.dom.btnToggleAddGroup.addEventListener('click', () => {
      this.dom.formCreateGroup.classList.toggle('hidden');
    });

    this.dom.btnCancelGroup.addEventListener('click', () => {
      this.dom.formCreateGroup.classList.add('hidden');
      this.dom.formCreateGroup.reset();
    });

    this.dom.formCreateGroup.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('group-name').value;
      const target = document.getElementById('group-target').value;
      
      store.addGroup(name, target);
      this.dom.formCreateGroup.reset();
      this.dom.formCreateGroup.classList.add('hidden');
      this.updateView();
    });

    this.dom.btnCancelFunds.addEventListener('click', () => {
      this.dom.modalAddFunds.classList.add('hidden');
      this.dom.formAddFunds.reset();
    });

    this.dom.formAddFunds.addEventListener('submit', (e) => {
      e.preventDefault();
      const groupId = this.dom.fundGroupId.value;
      const member = this.dom.fundMemberName.value;
      const amount = this.dom.fundAmount.value;
      
      store.addGroupContribution(groupId, member, amount);
      this.dom.modalAddFunds.classList.add('hidden');
      this.dom.formAddFunds.reset();
      this.updateView();
    });
  }

  // Refresh UI data bindings
  updateView() {
    const monthData = store.getItemsByMonth(this.activeMonthStr);

    // 1. Calculate stats values
    const incReceived = monthData.income
      .filter(i => i.status === 'received')
      .reduce((sum, i) => sum + i.amount, 0);

    const incPending = monthData.income
      .filter(i => i.status === 'pending')
      .reduce((sum, i) => sum + i.amount, 0);

    const expPaid = monthData.expenses
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + e.amount, 0);

    const expPending = monthData.expenses
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalExpectedIncome = incReceived + incPending;
    const totalExpectedExpense = expPaid + expPending;

    // Available Balance (Checkpoint deduction logic: Paid expenses deducted from Received income)
    const availableBalance = incReceived - expPaid;

    // Salary utilization rate
    let utilization = 0;
    if (incReceived > 0) {
      utilization = Math.round((expPaid / incReceived) * 100);
    }

    // Update Stat Cards Values
    this.dom.valIncomeReceived.innerText = this.formatCurrency(incReceived);
    this.dom.valIncomePending.innerText = this.formatCurrency(incPending);
    
    this.dom.valExpensePaid.innerText = this.formatCurrency(expPaid);
    this.dom.valExpensePending.innerText = this.formatCurrency(expPending);
    
    this.dom.valBalance.innerText = this.formatCurrency(availableBalance);
    
    // Balance visual warning if negative
    if (availableBalance < 0) {
      this.dom.valBalance.style.color = 'var(--danger)';
    } else {
      this.dom.valBalance.style.color = 'inherit';
    }

    // Utilization updates
    this.dom.valUtilization.innerText = `${utilization}%`;
    this.dom.utilizationBar.style.width = `${Math.min(utilization, 100)}%`;
    
    if (utilization > 85) {
      this.dom.utilizationBar.style.background = 'var(--danger)';
      this.dom.utilizationStatus.innerText = 'Over-budget Warning';
      this.dom.utilizationStatus.style.color = 'var(--danger)';
    } else if (utilization > 60) {
      this.dom.utilizationBar.style.background = 'var(--warning)';
      this.dom.utilizationStatus.innerText = 'Moderate Budget Spent';
      this.dom.utilizationStatus.style.color = 'var(--warning)';
    } else {
      this.dom.utilizationBar.style.background = 'linear-gradient(90deg, var(--info), var(--primary))';
      this.dom.utilizationStatus.innerText = 'Healthy Budget Balance';
      this.dom.utilizationStatus.style.color = 'var(--text-muted)';
    }

    // Render Lists
    this.renderIncomeList(monthData.income);
    this.renderExpenseList(monthData.expenses);
    this.renderGroups();

    // List Footers
    this.dom.footerTotalIncome.innerText = this.formatCurrency(totalExpectedIncome);
    this.dom.footerTotalExpense.innerText = this.formatCurrency(totalExpectedExpense);

    // Render Charts
    renderCharts(monthData, this.isDarkTheme);
  }

  // Render Income List DOM
  renderIncomeList(incomes) {
    this.dom.incomeList.innerHTML = '';
    
    if (incomes.length === 0) {
      this.dom.incomeList.innerHTML = `<div class="empty-list-message">No income items logged for this month.</div>`;
      return;
    }

    // Sort incomes by date descending
    incomes.sort((a, b) => new Date(b.date) - new Date(a.date));

    incomes.forEach(inc => {
      const item = document.createElement('div');
      item.className = 'list-item';
      
      const isReceived = inc.status === 'received';

      item.innerHTML = `
        <div class="item-left">
          <div class="category-badge-dot category-food" style="background-color: var(--success);"></div>
          <div class="item-meta">
            <span class="item-title">${inc.source}</span>
            <span class="item-subtext">${this.formatDate(inc.date)}</span>
          </div>
        </div>
        <div class="item-right">
          <span class="item-value income-value">+${this.formatCurrency(inc.amount)}</span>
          <!-- Status Toggle Switch -->
          <label class="switch" title="${isReceived ? 'Received' : 'Pending'}">
            <input type="checkbox" class="toggle-income-status" data-id="${inc.id}" ${isReceived ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
          <!-- Delete button -->
          <button class="btn-delete" data-id="${inc.id}" data-type="income" title="Delete Income">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      // Register Events inside list item
      item.querySelector('.toggle-income-status').addEventListener('change', (e) => {
        store.toggleIncomeStatus(inc.id, e.target.checked);
        this.updateView();
      });

      item.querySelector('.btn-delete').addEventListener('click', () => {
        store.deleteItem('income', inc.id);
        this.updateView();
      });

      this.dom.incomeList.appendChild(item);
    });
  }

  // Render Expense List DOM
  renderExpenseList(expenses) {
    this.dom.expenseList.innerHTML = '';

    if (expenses.length === 0) {
      this.dom.expenseList.innerHTML = `<div class="empty-list-message">No expenses logged for this month.</div>`;
      return;
    }

    // Sort by date descending
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    expenses.forEach(exp => {
      const item = document.createElement('div');
      item.className = 'list-item';
      
      const isPaid = exp.status === 'paid';
      const catColor = store.getCategoryColor(exp.category);
      const catName = store.getCategoryName(exp.category);

      item.innerHTML = `
        <div class="item-left">
          <div class="category-badge-dot" style="background-color: ${catColor};"></div>
          <div class="item-meta">
            <span class="item-title">${exp.name}</span>
            <span class="item-subtext">${this.formatDate(exp.date)} &bull; <span>${catName}</span></span>
          </div>
        </div>
        <div class="item-right">
          <span class="item-value expense-value">-${this.formatCurrency(exp.amount)}</span>
          <!-- Status Toggle Switch -->
          <label class="switch" title="${isPaid ? 'Paid' : 'Unpaid'}">
            <input type="checkbox" class="toggle-expense-status" data-id="${exp.id}" ${isPaid ? 'checked' : ''}>
            <span class="slider slider-danger"></span>
          </label>
          <!-- Delete button -->
          <button class="btn-delete" data-id="${exp.id}" data-type="expense" title="Delete Expense">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      // Register Events inside list item
      item.querySelector('.toggle-expense-status').addEventListener('change', (e) => {
        store.toggleExpenseStatus(exp.id, e.target.checked);
        this.updateView();
      });

      item.querySelector('.btn-delete').addEventListener('click', () => {
        store.deleteItem('expense', exp.id);
        this.updateView();
      });

      this.dom.expenseList.appendChild(item);
    });
  }

  // Render Groups DOM
  renderGroups() {
    this.dom.groupsGrid.innerHTML = '';
    const groups = store.state.groups || [];

    if (groups.length === 0) {
      this.dom.groupsGrid.innerHTML = `<div class="empty-list-message" style="grid-column: 1 / -1;">No shared groups created yet. Start a new goal above!</div>`;
      return;
    }

    groups.forEach(group => {
      const card = document.createElement('div');
      card.className = 'chart-card';
      
      const totalContributed = group.contributions.reduce((sum, c) => sum + c.amount, 0);
      const progress = Math.min((totalContributed / group.targetAmount) * 100, 100);

      // Map contributions to HTML
      const contributionsHtml = group.contributions.map(c => `
        <div class="list-item" style="padding: 8px 12px;">
          <span style="font-size: 13px; font-weight: 500;">${c.member}</span>
          <span style="font-size: 13px; font-weight: 700; color: var(--success);">+${this.formatCurrency(c.amount)}</span>
        </div>
      `).join('');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h3 style="color: var(--text-main); font-size: 16px;">${group.name}</h3>
            <span class="sub-header-text">Invite Code: <strong>${group.inviteCode}</strong></span>
          </div>
          <button class="btn-link-sm btn-add-funds" data-id="${group.inviteCode}" data-name="${group.name}">+ Add Funds</button>
        </div>
        
        <div style="margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>${this.formatCurrency(totalContributed)} / ${this.formatCurrency(group.targetAmount)}</span>
            <span>${Math.round(progress)}%</span>
          </div>
          <div class="stat-progress-bar-container">
            <div class="stat-progress-bar" style="width: ${progress}%; background: var(--success);"></div>
          </div>
        </div>

        <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
          <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Contributions Log</h4>
          ${contributionsHtml || '<span style="font-size: 12px; color: var(--text-muted);">No funds added yet.</span>'}
        </div>
      `;

      card.querySelector('.btn-add-funds').addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const name = e.target.getAttribute('data-name');
        this.dom.fundGroupId.value = id;
        this.dom.modalGroupTitle.innerText = `Add Funds to ${name}`;
        this.dom.modalAddFunds.classList.remove('hidden');
      });

      this.dom.groupsGrid.appendChild(card);
    });
  }

  populateCategoryDropdown() {
    const select = document.getElementById('expense-category');
    if (select) {
      const prevVal = select.value;
      select.innerHTML = '';
      store.state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        select.appendChild(opt);
      });
      if (prevVal) {
        select.value = prevVal;
      }
    }
  }

  // Helpers
  formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);
  }

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Initialization
let appController;

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  appController = new AppController();
  window.appControllerInstance = appController;
  store.initFirebaseListeners();
});
