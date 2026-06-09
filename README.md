# 💰 Famjam — Premium Salary & Budget Dashboard

A modern, real-time salary and expense management web application built for families and individuals. Track income, manage expenses, collaborate on shared savings goals, and visualize your financial health — all from a beautifully designed dashboard.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-10b981?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Backend-Firebase-f59e0b?style=for-the-badge&logo=firebase)
![HTML5](https://img.shields.io/badge/Frontend-HTML%2FJS%2FCSS-6366f1?style=for-the-badge&logo=html5)

---

## ✨ Features

### 🔐 Secure Phone Authentication
- OTP-based login via Firebase Phone Auth
- reCAPTCHA verification for security
- 3-step login flow: Phone → OTP → Profile setup
- Session persistence across page reloads

### 📊 Financial Dashboard
- **Received Salary** — Track confirmed income with toggle status
- **Paid Expenses** — Monitor paid vs unpaid expenses
- **Available Balance** — Real-time balance (Received Income − Paid Expenses)
- **Salary Utilization** — Visual progress bar showing budget burn rate with health indicators

### 💵 Income Management
- Add multiple income sources (salary, freelance, dividends, etc.)
- Mark income as **Received** or **Pending**
- Toggle status with a switch
- Filter by month/year
- Delete individual entries

### 🧾 Expense Tracking
- Categorized expense entries (Housing, Utilities, Food, Transport, Healthcare, Education, etc.)
- Mark expenses as **Paid** (deducted from salary) or **Pending** (upcoming)
- Custom categories with color-coded labels
- Delete individual entries

### 👨‍👩‍👧‍👦 Shared Savings Groups
- Create private savings goals (e.g., "Family Summer Trip")
- Auto-generated **invite codes** for sharing with family/friends
- Join groups using invite codes
- Add contributions with member name tracking
- Real-time progress bar toward target amount
- **Firebase Firestore powered** — all members see live updates

### 📈 Financial Insights & Charts
- **Expense Distribution** — Doughnut chart showing category-wise breakdown
- **Income vs Expense Comparison** — Bar chart comparing received/pending values
- Powered by **Chart.js** with theme-aware colors

### 🎨 Premium Design
- **Dark & Light Mode** — Toggle with persistent theme preference
- **Glassmorphism UI** — Frosted glass card effects with backdrop blur
- **Responsive Layout** — Works on desktop, tablet, and mobile
- **Smooth Animations** — Hover effects, slide-down transitions, micro-interactions
- **Google Fonts** — Outfit (display) + Plus Jakarta Sans (body)

### 💾 Data Management
- **Cloud Sync** — Data synced to Firebase Firestore per phone number
- **Local Storage** — Offline backup in browser localStorage
- **Export** — Download full data as JSON backup
- **Import** — Restore from JSON backup file
- **Clear Month** — Reset data for a specific month

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Structure** | HTML5 (Semantic) |
| **Styling** | Vanilla CSS (Custom Properties, Glassmorphism, CSS Grid) |
| **Logic** | Vanilla JavaScript (ES Modules) |
| **Backend** | Firebase (Firestore, Phone Auth) |
| **Charts** | Chart.js v4 (CDN) |
| **Fonts** | Google Fonts (Outfit, Plus Jakarta Sans) |
| **Auth** | Firebase Phone Authentication + reCAPTCHA |

> **No build tools required** — Pure HTML/CSS/JS served via any HTTP server.

---

## 📁 Project Structure

```
salary-management-system/
├── index.html      # Main HTML structure (login, dashboard, modals)
├── app.js          # Application logic (state, auth, rendering, charts)
├── style.css       # Complete design system and responsive styles
└── README.md       # Project documentation (this file)
```

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Edge, Firefox, Safari)
- Python 3.x **OR** Node.js (for local HTTP server)
- A Firebase project (already configured — see below)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/famjam-salary-management.git
cd famjam-salary-management/salary-management-system
```

### 2. Start a Local Server

The app uses ES Modules, which require serving over HTTP (not `file://`).

**Using Python:**
```bash
python -m http.server 3000
```

**Using Node.js (npx):**
```bash
npx -y serve .
```

### 3. Open in Browser

Navigate to:
```
http://localhost:3000
```

### 4. Login

1. Enter your phone number with country code
2. Solve the reCAPTCHA ("I'm not a robot")
3. Click **Send OTP**
4. Enter the 6-digit OTP received on your phone
5. Fill in your profile (First Name, Surname, Email)
6. You're in! 🎉

---

## 🔥 Firebase Configuration

The app uses Firebase for authentication and cloud data storage.

### Current Firebase Project

| Setting | Value |
|---------|-------|
| Project ID | `famjam-30548` |
| Auth Domain | `famjam-30548.firebaseapp.com` |
| Firestore | Enabled |
| Phone Auth | Enabled |

### Setting Up Your Own Firebase Project

If you want to use your own Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication** → **Phone** sign-in method
4. Enable **Cloud Firestore** (start in test mode)
5. Copy your Firebase config and replace it in `app.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Firebase Phone Auth Setup

- **Blaze Plan** is required for sending real SMS OTPs
- Free tier: **10 SMS verifications/day**
- For development, add **test phone numbers** in Firebase Console:
  - Go to Authentication → Sign-in method → Phone → Phone numbers for testing
  - Add your phone number with a fixed OTP code (e.g., `123456`)

### SMS Region Policy

- Go to Authentication → Settings → SMS region policy
- Select **Allow** and add your country (e.g., India)
- This restricts OTP SMS to specific regions for security

### Firestore Rules (Recommended for Production)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{phone} {
      allow read, write: if request.auth != null;
    }
    // Groups are accessible by any authenticated user
    match /groups/{groupId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📱 Usage Guide

### Adding Income
1. Click **+ Add Income** in the Income Segments section
2. Enter source name, amount, date, and status (Received/Pending)
3. Click **Save Income**

### Adding Expenses
1. Click **+ Add Expense** in the Expense Checklist section
2. Enter expense name, amount, category, date, and status (Paid/Pending)
3. Click **Save Expense**
4. To add a custom category, click **+ Add New** next to the category dropdown

### Toggling Status
- Use the **toggle switch** next to any income/expense to mark it as received/paid or pending/unpaid
- The dashboard stats update in real-time

### Shared Savings Groups
1. Click **+ Create New Group** — enter a name and target amount
2. Share the auto-generated **invite code** with family/friends
3. Others can click **Join by Code** and enter the code
4. Click **+ Add Funds** on any group to add a contribution
5. Progress updates live across all members

### Export & Import Data
1. Click the **database icon** (⊕) in the top-right header
2. **Export Data** — Downloads a JSON backup file
3. **Import Data** — Upload a previously exported JSON file
4. **Clear Current Month** — Removes all data for the selected month

### Theme Toggle
- Click the **moon/sun icon** in the header to switch between dark and light mode
- Your preference is saved and persists across sessions

---

## 🎨 Design System

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Primary (Indigo) | `#6366f1` | Buttons, accents, links |
| Success (Emerald) | `#10b981` | Income, positive values |
| Warning (Amber) | `#f59e0b` | Moderate alerts |
| Danger (Rose) | `#ef4444` | Expenses, errors |
| Info (Cyan) | `#06b6d4` | Charts, utilization |

### Typography

| Font | Usage |
|------|-------|
| **Outfit** | Display headings, stat values, logo |
| **Plus Jakarta Sans** | Body text, labels, buttons |

---

## 📦 Data Storage

Data is stored in **two layers** for reliability:

| Layer | Storage | Scope |
|-------|---------|-------|
| **Local** | `localStorage` (`salaryflow_data`) | Current browser only |
| **Cloud** | Firebase Firestore (`/users/{phone}`) | Synced across all devices |

- **Cloud is the source of truth** — when you log in, Firestore data overwrites local
- **Changes sync both ways** — every save goes to both localStorage and Firestore
- **Offline support** — localStorage keeps the app working without internet

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -m "Add new feature"`
4. Push to the branch: `git push origin feature/new-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👤 Author

**Takshil Patel**

Built with ❤️ for family financial management.

---

> *Famjam Dashboard © 2026. Premium salary tracking systems. Secured locally in browser and synced via Firebase.*
