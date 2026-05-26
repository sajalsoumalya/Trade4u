"""
TradingAgents Web Interface
Streamlit-based web dashboard for TradingAgents framework.
"""

import json
import os
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path

import streamlit as st
import pandas as pd
from datetime import datetime

# Import TradingAgents core
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

# =============================================================================
# Configuration & Paths
# =============================================================================

_WEB_DIR = Path(__file__).parent
_CONFIG_FILE = _WEB_DIR / "config.json"
_DB_FILE = _WEB_DIR / "tasks.db"

# Ensure web directory exists
_WEB_DIR.mkdir(exist_ok=True)

# =============================================================================
# Settings Persistence
# =============================================================================

def load_settings() -> dict:
    """Load settings from JSON file, fallback to defaults."""
    if _CONFIG_FILE.exists():
        with open(_CONFIG_FILE) as f:
            return json.load(f)
    return DEFAULT_CONFIG.copy()

def save_settings(settings: dict) -> None:
    """Save settings to JSON file."""
    with open(_CONFIG_FILE, "w") as f:
        json.dump(settings, f, indent=2)

def get_settings() -> dict:
    """Get settings from session state or load."""
    if "settings" not in st.session_state:
        st.session_state.settings = load_settings()
    return st.session_state.settings

# =============================================================================
# Task Database
# =============================================================================

def init_db() -> None:
    """Initialize SQLite database for task tracking."""
    conn = sqlite3.connect(_DB_FILE)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            analysis_date TEXT NOT NULL,
            status TEXT DEFAULT 'queued',
            started_at TEXT,
            completed_at TEXT,
            result_json TEXT,
            error TEXT
        )
    """)
    conn.commit()
    conn.close()

def add_task(ticker: str, analysis_date: str) -> int:
    """Add a new task to the database."""
    conn = sqlite3.connect(_DB_FILE)
    cursor = conn.execute(
        "INSERT INTO tasks (ticker, analysis_date, status) VALUES (?, ?, 'queued')",
        (ticker, analysis_date)
    )
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return task_id

def update_task_status(task_id: int, status: str, result_json: str = None, error: str = None) -> None:
    """Update task status."""
    conn = sqlite3.connect(_DB_FILE)
    now = datetime.now().isoformat()
    if status == "running":
        conn.execute(
            "UPDATE tasks SET status = ?, started_at = ? WHERE id = ?",
            (status, now, task_id)
        )
    elif status in ("completed", "failed"):
        conn.execute(
            "UPDATE tasks SET status = ?, completed_at = ?, result_json = ?, error = ? WHERE id = ?",
            (status, now, result_json, error, task_id)
        )
    else:
        conn.execute("UPDATE tasks SET status = ? WHERE id = ?", (status, task_id))
    conn.commit()
    conn.close()

def get_tasks(status: str = None) -> list:
    """Get tasks, optionally filtered by status."""
    conn = sqlite3.connect(_DB_FILE)
    if status:
        df = pd.read_sql(
            "SELECT * FROM tasks WHERE status = ? ORDER BY started_at DESC",
            conn, params=(status,)
        )
    else:
        df = pd.read_sql("SELECT * FROM tasks ORDER BY started_at DESC", conn)
    conn.close()
    return df.to_dict("records") if not df.empty else []

def get_task_result(task_id: int) -> dict:
    """Get task result JSON."""
    conn = sqlite3.connect(_DB_FILE)
    cursor = conn.execute("SELECT result_json FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    conn.close()
    return json.loads(row[0]) if row and row[0] else {}

# =============================================================================
# Live Monitor Page (Real-time)
# =============================================================================

def page_monitor():
    """Live Monitor - Real-time price monitoring."""
    import time as time_module
    import yfinance as yf
    from datetime import datetime

    st.title("Live Monitor")

    # Sidebar controls
    st.sidebar.subheader("Monitor Settings")

    # Get symbols from config or use default
    settings = get_settings()
    default_symbols = settings.get("ticker", "SPY")

    # Symbol input (comma-separated)
    symbols_input = st.sidebar.text_input(
        "Symbols (comma-separated)",
        value=default_symbols,
        help="e.g., SPY, BTC-USD, AAPL, NVDA"
    )

    # Refresh interval
    interval = st.sidebar.slider("Refresh Interval (seconds)", 1, 30, 5)

    # Normalize symbol helper
    def _normalize(symbol: str) -> str:
        symbol = symbol.upper().strip()
        if "/" in symbol:
            base, quote = symbol.split("/", 1)
            if quote in ("USDT", "USD", "USDC"):
                quote = "USD"
            return f"{base}-{quote}"
        return symbol

    # Parse symbols
    symbol_list = [_normalize(s.strip()) for s in symbols_input.split(",") if s.strip()]

    if not symbol_list:
        st.warning("Please enter at least one symbol.")
        return

    # Manual refresh
    if st.sidebar.button("Refresh Now", type="primary"):
        st.rerun()

    st.divider()

    # Display live prices
    st.subheader(f"Live Prices: {', '.join(symbol_list)}")
    st.caption(f"Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Get prices
    price_data = []
    for symbol in symbol_list:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            price_data.append({
                "symbol": symbol,
                "price": info.get("lastPrice") or info.get("previousClose"),
                "change": info.get("regularMarketChange"),
                "change_pct": info.get("regularMarketChangePercent"),
                "high": info.get("dayHigh"),
                "low": info.get("dayLow"),
                "volume": info.get("volume"),
            })
        except Exception as e:
            price_data.append({
                "symbol": symbol,
                "error": str(e)
            })

    # Display as table
    if price_data:
        cols = st.columns(len(price_data))
        for i, data in enumerate(price_data):
            with cols[i]:
                if "error" in data:
                    st.error(f"{data['symbol']}: {data['error']}")
                else:
                    st.metric(
                        label=data["symbol"],
                        value=f"${data['price']:.2f}" if data["price"] else "N/A",
                        delta=f"{data['change_pct']:.2f}%" if data.get("change_pct") else None
                    )
                    st.caption(f"High: ${data['high']:.2f} | Low: ${data['low']:.2f}")


# =============================================================================
# Operations Page - with quick settings
# =============================================================================

def run_analysis(task_id, ticker, analysis_date, settings):
    """Run TradingAgents analysis in background thread."""
    update_task_status(task_id, "running")

    try:
        config = {**DEFAULT_CONFIG, **settings}
        ta = TradingAgentsGraph(config=config, debug=False)
        result, decision = ta.propagate(ticker, analysis_date)

        result_json = json.dumps({
            "ticker": ticker,
            "date": analysis_date,
            "decision": decision,
            "result": str(result) if result else None
        })
        update_task_status(task_id, "completed", result_json)

    except Exception as e:
        update_task_status(task_id, "failed", error=str(e))

# =============================================================================
# UI Pages
# =============================================================================

def page_dashboard():
    """Dashboard - Overview of recent activity."""
    st.title("TradingAgents Dashboard")

    # Quick stats
    col1, col2, col3, col4 = st.columns(4)

    all_tasks = get_tasks()
    completed = [t for t in all_tasks if t["status"] == "completed"]
    running = [t for t in all_tasks if t["status"] == "running"]
    queued = [t for t in all_tasks if t["status"] == "queued"]

    with col1:
        st.metric("Total Tasks", len(all_tasks))
    with col2:
        st.metric("Completed", len(completed))
    with col3:
        st.metric("Running", len(running))
    with col4:
        st.metric("Queued", len(queued))

    st.divider()

    # Recent activity
    st.subheader("Recent Activity")
    if all_tasks:
        df = pd.DataFrame(all_tasks[:10])
        st.dataframe(
            df[["id", "ticker", "analysis_date", "status", "started_at"]],
            use_container_width=True,
            hide_index=True
        )
    else:
        st.info("No tasks yet. Go to Operations to run an analysis.")

    # Quick actions
    st.divider()
    st.subheader("Quick Actions")
    st.info("Use the sidebar to navigate to Operations")


def page_operations():
    """Operations - Run analyses, view tasks."""
    st.title("Operations")

    # New analysis form
    st.subheader("Run New Analysis")

    with st.form("analysis_form"):
        col1, col2 = st.columns(2)
        with col1:
            ticker = st.text_input("Ticker Symbol", placeholder="e.g., NVDA, AAPL").upper()
        with col2:
            analysis_date = st.text_input("Analysis Date", placeholder="2026-01-15")

        submitted = st.form_submit_button("Start Analysis", type="primary")

    if submitted and ticker and analysis_date:
        # Validate ticker format (basic)
        if len(ticker) > 0 and len(ticker) <= 5:
            settings = get_settings()
            task_id = add_task(ticker, analysis_date)

            st.success(f"Analysis started for {ticker} on {analysis_date}")

            # Run in background
            thread = threading.Thread(
                target=run_analysis,
                args=(task_id, ticker, analysis_date, settings)
            )
            thread.start()
        else:
            st.error("Invalid ticker symbol")

    st.divider()

    # Task list
    st.subheader("Task Queue")

    # Filter tabs
    tab1, tab2, tab3, tab4 = st.tabs(["All", "Running", "Completed", "Failed"])

    with tab1:
        tasks = get_tasks()
    with tab2:
        tasks = get_tasks("running")
    with tab3:
        tasks = get_tasks("completed")
    with tab4:
        tasks = get_tasks("failed")

    if tasks:
        for task in tasks[:20]:
            with st.container():
                c1, c2, c3 = st.columns([1, 2, 1])
                with c1:
                    st.write(f"**{task['ticker']}**")
                with c2:
                    status = task["status"]
                    if status == "running":
                        st.info(f"Running... [{task['analysis_date']}]")
                    elif status == "completed":
                        st.success(f"Completed [{task['analysis_date']}]")
                    elif status == "failed":
                        error_msg = task.get("error", "Unknown error")
                        st.error(f"Failed [{task['analysis_date']}]: {error_msg}")
                    else:
                        st.write(f"{status} [{task['analysis_date']}]")
                with c3:
                    if st.button("View", key=f"view_{task['id']}"):
                        st.session_state.view_task_id = task["id"]
                        st.rerun()
                st.divider()
    else:
        st.info("No tasks in this category.")


def page_settings():
    """Settings - Configure LLM providers and preferences."""
    st.title("Settings")

    settings = get_settings()

    # Provider to API key env var mapping
    PROVIDER_API_KEYS = {
        "openai": "OPENAI_API_KEY",
        "google": "GOOGLE_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "xai": "XAI_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY",
        "qwen": "DASHSCOPE_API_KEY",
        "glm": "ZHIPU_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "ollama": None,  # No API key needed
        "azure": "AZURE_OPENAI_API_KEY",
        "opencode": "OPENCODE_API_KEY",
        "nvidia_nim": "NVIDIA_NIM_API_KEY",
    }

    # Common provider base URLs
    PROVIDER_BASE_URLS = {
        "opencode": "https://opencode.ai/zen/v1",
        "nvidia_nim": "https://integrate.api.nvidia.com/v1",
    }

    # Model options per provider
    PROVIDER_MODELS = {
        "openai": {
            "deep": ["gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.2"],
            "quick": ["gpt-5.4-mini", "gpt-5.4-nano", "gpt-4.1"],
        },
        "anthropic": {
            "deep": ["claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6"],
            "quick": ["claude-haiku-4-5", "claude-sonnet-4-6"],
        },
        "google": {
            "deep": ["gemini-3.1-pro-preview", "gemini-2.5-pro"],
            "quick": ["gemini-3-flash-preview", "gemini-2.5-flash"],
        },
        "deepseek": {
            "deep": ["deepseek-v4-pro", "deepseek-reasoner"],
            "quick": ["deepseek-v4-flash", "deepseek-chat"],
        },
        "opencode": {
            # OpenCode models - free first, then paid
            "deep": [
                # Free first
                "opencode/minimax-m2.7",
                "opencode/minimax-m2.5",
                "opencode/qwen3.5-plus",
                # Paid
                "opencode/gpt-5.4",
                "opencode/gpt-5.4-pro",
                "opencode/claude-opus-4-7",
                "opencode/claude-sonnet-4-6",
                "opencode/qwen3.6-plus",
                "opencode/glm-5",
            ],
            "quick": [
                # Free models first
                "opencode/minimax-m2.5-free",
                "opencode/big-pickle",
                "opencode/ring-2.6-1t-free",
                "opencode/nemotron-3-super-free",
                # Paid models
                "opencode/gpt-5.4-mini",
                "opencode/gpt-5.4-nano",
                "opencode/claude-haiku-4-5",
                "opencode/qwen3.5-plus",
            ],
        },
        "nvidia_nim": {
            "deep": ["nvidia/llama-3.3-70b-instruct", "nvidia/mixtral-8x22b-instruct-v1"],
            "quick": ["nvidia/llama-3.1-8b-instruct", "nvidia/mixtral-8x7b-instruct-v0.1"],
        },
    }

    with st.form("settings_form"):
        st.subheader("LLM Provider")

        provider = st.selectbox(
            "Provider",
            ["openai", "google", "anthropic", "xai", "deepseek", "qwen", "glm", "openrouter", "ollama", "azure", "opencode", "nvidia_nim"],
            index=["openai", "google", "anthropic", "xai", "deepseek", "qwen", "glm", "openrouter", "ollama", "azure", "opencode", "nvidia_nim"].index(settings.get("llm_provider", "openai"))
        )

        # Show API key input based on provider
        api_key_env = PROVIDER_API_KEYS.get(provider)
        if api_key_env:
            st.text_input(f"API Key ({api_key_env})", type="password", key="api_key_input", help=f"Set this as environment variable {api_key_env} in your .env or deployment")

        # Backend URL for custom endpoints (OpenCode, NVIDIA NIM, etc.)
        default_url = PROVIDER_BASE_URLS.get(provider, "")
        backend_url = st.text_input("Backend URL (optional)", value=default_url, placeholder="Leave empty for default", help="Custom API endpoint for OpenAI-compatible providers like OpenCode or NVIDIA NIM")

        col1, col2 = st.columns(2)
        with col1:
            # Get model options based on provider
            provider_models = PROVIDER_MODELS.get(provider, {}).get("deep", ["custom"])
            if not provider_models or provider_models[0] == "custom":
                deep_think = st.text_input("Deep Think Model", value=settings.get("deep_think_llm", "gpt-5.4"))
            else:
                current_deep = settings.get("deep_think_llm", provider_models[0])
                # Prepend custom if not in list
                all_deep = provider_models + ["custom"]
                if current_deep not in all_deep:
                    all_deep = [current_deep] + all_deep
                deep_think = st.selectbox("Deep Think Model", all_deep, index=all_deep.index(current_deep))
        with col2:
            provider_models_q = PROVIDER_MODELS.get(provider, {}).get("quick", ["custom"])
            if not provider_models_q or provider_models_q[0] == "custom":
                quick_think = st.text_input("Quick Think Model", value=settings.get("quick_think_llm", "gpt-5.4-mini"))
            else:
                current_quick = settings.get("quick_think_llm", provider_models_q[0])
                all_quick = provider_models_q + ["custom"]
                if current_quick not in all_quick:
                    all_quick = [current_quick] + all_quick
                quick_think = st.selectbox("Quick Think Model", all_quick, index=all_quick.index(current_quick))

        st.subheader("Debate Settings")

        col1, col2 = st.columns(2)
        with col1:
            max_debate = st.number_input("Max Debate Rounds", min_value=1, max_value=10, value=settings.get("max_debate_rounds", 1))
        with col2:
            max_risk = st.number_input("Max Risk Discussion Rounds", min_value=1, max_value=10, value=settings.get("max_risk_discuss_rounds", 1))

        st.subheader("Data Vendors")

        col1, col2 = st.columns(2)
        with col1:
            core_api = st.selectbox("Stock Data", ["yfinance", "alpha_vantage"], index=0)
        with col2:
            news_api = st.selectbox("News Data", ["yfinance", "alpha_vantage"], index=0)

        submitted = st.form_submit_button("Save Settings", type="primary")

    if submitted:
        # Update settings
        settings["llm_provider"] = provider

        # Prepend provider prefix for OpenCode models if needed
        def format_model(model: str, provider: str) -> str:
            if provider == "opencode" and not model.startswith("opencode/"):
                return f"opencode/{model}"
            return model

        deep_think_formatted = format_model(deep_think, provider)
        quick_think_formatted = format_model(quick_think, provider)

        # Save backend URL only if explicitly provided
        if backend_url:
            settings["backend_url"] = backend_url
        elif "backend_url" in settings:
            settings.pop("backend_url", None)
        settings["deep_think_llm"] = deep_think_formatted
        settings["quick_think_llm"] = quick_think_formatted
        settings["max_debate_rounds"] = max_debate
        settings["max_risk_discuss_rounds"] = max_risk
        settings["data_vendors"] = {
            "core_stock_apis": core_api,
            "news_data": news_api,
        }

        save_settings(settings)
        st.success("Settings saved!")
        st.rerun()


def page_results():
    """Results - View detailed analysis results."""
    st.title("Results")

    task_id = st.session_state.get("view_task_id")

    if task_id:
        result = get_task_result(task_id)
        if result:
            st.subheader(f"Analysis Result: {result.get('ticker', 'N/A')}")
            st.write(f"**Date:** {result.get('date', 'N/A')}")

            decision = result.get("decision", {})
            if decision:
                st.json(decision)
            else:
                st.write(result.get("result", "No result available"))
        else:
            st.error("Task not found")
    else:
        st.info("Select a task from Operations to view results.")

        # Show recent completed tasks
        completed = get_tasks("completed")[:5]
        if completed:
            st.subheader("Recent Completed Tasks")
            for task in completed:
                if st.button(f"{task['ticker']} - {task['analysis_date']}", key=f"res_{task['id']}"):
                    st.session_state.view_task_id = task["id"]
                    st.rerun()


# =============================================================================
# Main App
# =============================================================================

def main():
    """Main Streamlit app."""
    st.set_page_config(
        page_title="TradingAgents",
        page_icon="📈",
        layout="wide"
    )

    # Initialize database
    init_db()

    # Sidebar navigation
    st.sidebar.title("TradingAgents")

    # Quick settings shortcut
    with st.sidebar.expander("⚡ Quick Settings", expanded=True):
        settings = get_settings()
        new_ticker = st.text_input("Ticker", value=settings.get("ticker", "SPY"))
        new_date = st.text_input("Date", value=datetime.now().strftime("%Y-%m-%d"))
        if new_ticker != settings.get("ticker"):
            settings["ticker"] = new_ticker
            save_settings(settings)
            st.rerun()
        if new_date != settings.get("analysis_date"):
            settings["analysis_date"] = new_date
            save_settings(settings)
            st.rerun()

    page = st.sidebar.radio("Navigate", ["Dashboard", "Monitor", "Operations", "Settings", "Results"])

    # Route to page
    if page == "Dashboard":
        page_dashboard()
    elif page == "Monitor":
        page_monitor()
    elif page == "Operations":
        page_operations()
    elif page == "Settings":
        page_settings()
    elif page == "Results":
        page_results()


if __name__ == "__main__":
    main()