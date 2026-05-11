from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

import argparse
import os

# Parse command line arguments
parser = argparse.ArgumentParser(description='Trade4u AI Trading Analysis')
parser.add_argument('--ticker', type=str, default='AAPL', help='Stock ticker symbol')
parser.add_argument('--date', type=str, default=None, help='Analysis date (YYYY-MM-DD)')
parser.add_argument('--provider', type=str, default='opencode', help='LLM provider')
parser.add_argument('--deep-model', type=str, default='minimax-m2.5', help='Deep thinking model')
parser.add_argument('--quick-model', type=str, default='minimax-m2.5-free', help='Quick thinking model')
args = parser.parse_args()

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Get API key from environment based on provider
def get_api_key(provider: str) -> str:
    key_map = {
        'opencode': 'OPENCODE_API_KEY',
        'openai': 'OPENAI_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'google': 'GOOGLE_API_KEY',
        'deepseek': 'DEEPSEEK_API_KEY',
    }
    env_var = key_map.get(provider.lower())
    if env_var:
        return os.environ.get(env_var, '')
    return ''

# Create a custom config
config = DEFAULT_CONFIG.copy()
config["llm_provider"] = args.provider
config["deep_think_llm"] = args.deep_model
config["quick_think_llm"] = args.quick_model
config["max_debate_rounds"] = 1
config["backend_url"] = "https://opencode.ai/zen/"

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