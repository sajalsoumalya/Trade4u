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

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Use provided API key or fall back to environment variable
api_key = args.api_key or os.environ.get(f"{args.provider.upper()}_API_KEY", '')

# Set the API key in environment for the LLM client
if api_key:
    os.environ[f"{args.provider.upper()}_API_KEY"] = api_key

# Create a custom config
config = DEFAULT_CONFIG.copy()
config["llm_provider"] = args.provider
config["deep_think_llm"] = args.deep_model
config["quick_think_llm"] = args.quick_model
config["max_debate_rounds"] = 1
config["backend_url"] = "https://opencode.ai/zen/v1"

# Configure data vendors (default uses yfinance, no extra API keys needed)
config["data_vendors"] = {
    "core_stock_apis": "yfinance",
    "technical_indicators": "yfinance",
    "fundamental_data": "yfinance",
    "news_data": "yfinance",
}

# Initialize with custom config
ta = TradingAgentsGraph(debug=False, config=config)

# Get analysis date
analysis_date = args.date if args.date else None

# Run analysis
_, decision = ta.propagate(args.ticker.upper(), analysis_date)
print(decision)