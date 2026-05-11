# Trade4u Full Trading Application - Specification

## 1. Project Overview

- **Project Name**: Trade4u (Full Trading Platform)
- **Type**: Full-stack Web Application (React + Node.js + Python)
- **Core Functionality**: AI-powered stock/crypto analysis with paper trading and optional live trading
- **Target Users**: Retail traders seeking AI-assisted trading decisions

## 2. Tech Stack

### Frontend
- **Framework**: React 18 + Vite
- **UI Library**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Charts**: TradingView Lightweight Charts
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js + Express
- **Database**: JSON File Storage (local)
- **WebSocket**: Binance Direct + Socket.IO for real-time updates

### Analysis Engine
- **Language**: Python (existing TradingAgents)
- **Integration**: REST API + subprocess

## 3. Feature List

### Authentication
- [ ] Firebase Google Sign-in
- [ ] Firebase Email/Password Sign-in
- [ ] Protected Routes
- [ ] User Session Management

### Dashboard
- [ ] Portfolio Overview (holdings, P&L)
- [ ] Account Balance
- [ ] Quick Trade Widget
- [ ] Market Overview Cards
- [ ] Recent Signals

### Live Market
- [x] Real-time Price Feed (Binance WebSocket)
- [x] Interactive Price Charts (TradingView)
- [x] Symbol Search
- [x] Watchlist

### Analysis
- [ ] Run AI Analysis (Python TradingAgents)
- [ ] Live/Historical Toggle
- [ ] Analysis Progress
- [ ] Result Display (Buy/Sell/Hold)
- [ ] Analysis History

### Trading
- [ ] Paper Trading Mode (default)
- [ ] Open Buy Order
- [ ] Open Sell Order
- [ ] Close Existing Position
- [ ] Trade History
- [ ] P&L per Trade

### Settings
- [ ] LLM Provider Selection (OpenCode, OpenAI, etc.)
- [ ] API Key Management
- [ ] Trading Mode Toggle (Paper/Live)
- [ ] Broker Connection (future)

## 4. UI/UX Specification

### Color Palette
- **Primary**: `#10B981` (Emerald Green - gains)
- **Secondary**: `#EF4444` (Red - losses)
- **Background**: `#0A0A0A` (Near black)
- **Surface**: `#1A1A1A` (Dark gray)
- **Border**: `#2A2A2A` (Subtle border)
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#9CA3AF`

### Layout
- **Sidebar**: 240px fixed left
- **Header**: 64px fixed top
- **Main Content**: Fluid

### Responsive Breakpoints
- Mobile: < 768px (sidebar collapses)
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 5. API Endpoints

### Auth
- `POST /api/auth/verify` - Verify Firebase token

### Analysis
- `POST /api/analysis/run` - Run new analysis
- `GET /api/analysis/history` - Get analysis history
- `GET /api/analysis/:id` - Get specific analysis

### Trading
- `POST /api/trading/order` - Place order
- `DELETE /api/trading/order/:id` - Close order
- `GET /api/trading/positions` - Get open positions
- `GET /api/trading/history` - Get trade history

### Market
- `GET /api/market/price/:symbol` - Get live price
- `GET /api/market/history/:symbol` - Get price history

## 6. Firebase Schema

### Users Collection
```
users/{uid}:
  - email: string
  - displayName: string
  - createdAt: timestamp
  - settings: object
  - tradingMode: "paper" | "live"
```

### Analyses Collection
```
analyses/{id}:
  - uid: string
  - symbol: string
  - date: string
  - status: "pending" | "completed" | "failed"
  - decision: string
  - result: object
  - createdAt: timestamp
```

### Trades Collection
```
trades/{id}:
  - uid: string
  - symbol: string
  - type: "buy" | "sell"
  - quantity: number
  - price: number
  - status: "open" | "closed"
  - pnl: number
  - openedAt: timestamp
  - closedAt: timestamp
```

## 7. Acceptance Criteria

1. User can sign in with Google or email
2. Dashboard shows portfolio and P&L
3. Live charts update in real-time
4. User can run AI analysis and see signals
5. User can place paper trades
6. User can close positions
7. Trade history shows all transactions
8. Settings persist across sessions