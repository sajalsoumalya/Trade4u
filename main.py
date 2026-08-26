from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

import argparse
import os

# Parse command line arguments
parser = argparse.ArgumentParser(description='Trade4u AI Trading Analysis')
parser.add_argument('--ticker', type=str, default='AAPL', help='Stock ticker symbol')
parser.add_argument('--date', type=str, default=None, help='Analysis date (YYYY-MM-DD)')
parser.add_argument('--provider', type=str, default='opencode', help='LLM provider')
parser.add_argument('--deep-model', type=str, default='minimax-m2.5-free', help='Deep thinking model')
parser.add_argument('--quick-model', type=str, default='minimax-m2.5-free', help='Quick thinking model')
parser.add_argument('--api-key', type=str, default=None, help='API key for the LLM provider')
args = parser.parse_args()

# Load environment variables from .env file. Optional: when this runs as a
# subprocess of the Node server every setting already arrives via argv/env, so a
# missing python-dotenv must not take the whole analysis down.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Use API key from args (passed from DB config via analysis.js)
api_key = args.api_key or ''

# Create a custom config
config = DEFAULT_CONFIG.copy()
config["llm_provider"] = args.provider
config["deep_think_llm"] = args.deep_model
config["quick_think_llm"] = args.quick_model
config["max_debate_rounds"] = 1
if args.api_key:
    config["api_key"] = args.api_key
# Leave backend_url unset (None): each provider's client resolves its own
# default endpoint. Hardcoding OpenCode's URL here routed every provider
# (OpenAI/Anthropic/Google/DeepSeek) to opencode.ai, so a saved key for any
# non-OpenCode provider would fail to authenticate. See default_config.py.

# Configure data vendors (default uses yfinance, no extra API keys needed)
config["data_vendors"] = {
    "core_stock_apis": "yfinance",
    "technical_indicators": "yfinance",
    "fundamental_data": "yfinance",
    "news_data": "yfinance",
}

import sys
import json
import traceback

# Initialize with custom config
ta = TradingAgentsGraph(debug=False, config=config)

# Get analysis date
analysis_date = args.date if args.date else None

def emit_error(msg):
    print(json.dumps({"type": "error", "message": msg}))
    sys.stdout.flush()

try:
    # Run analysis
    final_state, decision = ta.propagate(args.ticker.upper(), analysis_date)

    # Print each stage's report as JSON progress lines
    stages = [
        (1, "Market Analyst", final_state.get("market_report", "")),
        (2, "Sentiment Analyst", final_state.get("sentiment_report", "")),
        (3, "News Analyst", final_state.get("news_report", "")),
        (4, "Fundamentals Analyst", final_state.get("fundamentals_report", "")),
    ]
    for stage_num, stage_name, report in stages:
        if report:
            print(json.dumps({"type": "stage", "stage": stage_num, "name": stage_name, "output": report}))
            sys.stdout.flush()

    # Debate panel summary
    debate = final_state.get("investment_debate_state", {})
    if debate:
        judge = debate.get("judge_decision", "")
        print(json.dumps({"type": "stage", "stage": 5, "name": "Debate Panel", "output": f"Judge Decision: {judge}"}))
        sys.stdout.flush()

    # Risk manager summary
    risk = final_state.get("risk_debate_state", {})
    if risk:
        risk_judge = risk.get("judge_decision", "")
        print(json.dumps({"type": "stage", "stage": 6, "name": "Risk Manager", "output": f"Risk Assessment: {risk_judge}"}))
        sys.stdout.flush()

    print(json.dumps({"type": "complete", "decision": decision}))
    sys.stdout.flush()
except Exception as e:
    tb = traceback.format_exc()
    emit_error(f"Pipeline crashed: {e}\n{tb}")
    sys.exit(1)