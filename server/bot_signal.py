#!/usr/bin/env python3
"""
AI Signal Emitter — thin bridge between Node.js server and TradingAgents engine.
Runs analysis cycles and outputs JSON trading signals to stdout.
Node.js reads stdout and forwards to frontend via WebSocket.
"""
import os
import sys
import json
import asyncio
import argparse
import requests
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG


class SignalEmitter:
    def __init__(self, config):
        self.config = config
        agent_config = DEFAULT_CONFIG.copy()
        agent_config["llm_provider"] = config.get('provider', 'opencode')
        agent_config["deep_think_llm"] = config.get('deep_model', 'minimax-m2.5-free')
        agent_config["quick_think_llm"] = config.get('quick_model', 'minimax-m2.5-free')
        agent_config["backend_url"] = "https://opencode.ai/zen/v1"
        agent_config["max_debate_rounds"] = 1
        agent_config["data_vendors"] = {
            "core_stock_apis": "yfinance",
            "technical_indicators": "yfinance",
            "fundamental_data": "yfinance",
            "news_data": "yfinance",
        }
        self.agent = TradingAgentsGraph(debug=False, config=agent_config)
        self.stop_loss_pct = config.get('stop_loss', 2)
        self.take_profit_pct = config.get('take_profit', 5)

    def get_price(self, symbol):
        try:
            r = requests.get(f'https://api.binance.com/api/v3/ticker/price', params={'symbol': symbol}, timeout=10)
            if r.ok:
                return float(r.json()['price'])
        except:
            pass
        return None

    async def analyze(self, symbol):
        try:
            _, decision = self.agent.propagate(symbol.upper(), datetime.now().strftime('%Y-%m-%d'))
            d = decision.upper().strip() if decision else ''
            if 'BUY' in d or 'LONG' in d:
                return 'buy'
            elif 'SELL' in d or 'SHORT' in d:
                return 'sell'
            return 'hold'
        except Exception as e:
            return 'hold'

    async def run_cycle(self, symbols):
        for symbol in symbols:
            price = self.get_price(symbol)
            action = await self.analyze(symbol)
            signal = {
                "type": "signal",
                "symbol": symbol,
                "action": action,
                "price": price,
                "timestamp": datetime.now().isoformat(),
            }
            print(json.dumps(signal), flush=True)

        print(json.dumps({"type": "cycle_complete", "timestamp": datetime.now().isoformat()}), flush=True)

    async def run(self, symbols, interval_minutes):
        while True:
            try:
                await self.run_cycle(symbols)
            except Exception as e:
                print(json.dumps({"type": "error", "error": str(e)}), flush=True)
            await asyncio.sleep(interval_minutes * 60)


def main():
    parser = argparse.ArgumentParser(description='Trade4u AI Signal Emitter')
    parser.add_argument('--symbols', nargs='+', required=True)
    parser.add_argument('--interval', type=int, default=15)
    parser.add_argument('--provider', default='opencode')
    parser.add_argument('--deep-model', default='minimax-m2.5-free')
    parser.add_argument('--quick-model', default='minimax-m2.5-free')
    parser.add_argument('--stop-loss', type=float, default=2)
    parser.add_argument('--take-profit', type=float, default=5)
    parser.add_argument('--api-key', default=None)

    args = parser.parse_args()
    if args.api_key:
        os.environ[f"{args.provider.upper()}_API_KEY"] = args.api_key

    config = {
        'provider': args.provider,
        'deep_model': args.deep_model,
        'quick_model': args.quick_model,
        'stop_loss': args.stop_loss,
        'take_profit': args.take_profit,
    }

    emitter = SignalEmitter(config)
    try:
        asyncio.run(emitter.run(args.symbols, args.interval))
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
