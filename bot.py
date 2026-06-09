#!/usr/bin/env python3
"""
Auto-Trading Bot for Trade4u
Runs AI analysis and automatically executes trades based on signals
"""

import os
import sys
import json
import time
import asyncio
import argparse
from datetime import datetime, timedelta

# Add parent directory to path for tradingagents import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

class AutoTradeBot:
    def __init__(self, config=None):
        self.config = config or {}
        self.running = False
        self.positions = []
        self.trades = []

        # Initialize TradingAgents
        agent_config = DEFAULT_CONFIG.copy()
        agent_config["llm_provider"] = self.config.get('provider', 'opencode')
        agent_config["deep_think_llm"] = self.config.get('deep_model', 'minimax-m2.5-free')
        agent_config["quick_think_llm"] = self.config.get('quick_model', 'minimax-m2.5-free')
        # Leave backend_url unset (None) so each provider resolves its own
        # endpoint. Hardcoding OpenCode's URL forced every provider to opencode.ai.
        agent_config["max_debate_rounds"] = 1
        agent_config["data_vendors"] = {
            "core_stock_apis": "yfinance",
            "technical_indicators": "yfinance",
            "fundamental_data": "yfinance",
            "news_data": "yfinance",
        }

        self.agent = TradingAgentsGraph(debug=False, config=agent_config)

        # Trading settings
        self.trade_amount = self.config.get('trade_amount', 100)  # USDT per trade
        self.stop_loss_pct = self.config.get('stop_loss', 2)  # 2%
        self.take_profit_pct = self.config.get('take_profit', 5)  # 5%
        self.max_positions = self.config.get('max_positions', 3)

        print(f"[AutoTradeBot] Initialized with {len(self.config.get('symbols', []))} symbols")

    async def analyze_symbol(self, symbol):
        """Run AI analysis on a symbol and return decision"""
        try:
            print(f"[AutoTradeBot] Analyzing {symbol}...")

            _, decision = self.agent.propagate(symbol.upper(), datetime.now().strftime('%Y-%m-%d'))

            print(f"[AutoTradeBot] {symbol} analysis result: {decision}")

            # Parse decision
            decision = decision.upper().strip() if decision else ''

            if 'BUY' in decision or 'LONG' in decision:
                return 'BUY'
            elif 'SELL' in decision or 'SHORT' in decision:
                return 'SELL'
            else:
                return 'HOLD'

        except Exception as e:
            print(f"[AutoTradeBot] Analysis error for {symbol}: {e}")
            return 'HOLD'

    def should_enter_position(self, symbol):
        """Check if we should enter a new position"""
        # Check if we already have a position for this symbol
        if any(p['symbol'] == symbol for p in self.positions):
            return False

        # Check max positions
        if len(self.positions) >= self.max_positions:
            return False

        return True

    def should_exit_position(self, position, current_price):
        """Check if we should exit a position based on stop loss or take profit"""
        entry_price = position['entry_price']
        pnl_pct = ((current_price - entry_price) / entry_price) * 100

        # Check stop loss
        if pnl_pct <= -self.stop_loss_pct:
            return True, 'STOP_LOSS'

        # Check take profit
        if pnl_pct >= self.take_profit_pct:
            return True, 'TAKE_PROFIT'

        return False, None

    async def execute_trade(self, symbol, action, current_price):
        """Execute a trade"""
        try:
            if action == 'BUY' and self.should_enter_position(symbol):
                position = {
                    'symbol': symbol,
                    'type': 'buy',
                    'entry_price': current_price,
                    'quantity': self.trade_amount / current_price,
                    'entry_time': datetime.now().isoformat(),
                    'stop_loss': current_price * (1 - self.stop_loss_pct / 100),
                    'take_profit': current_price * (1 + self.take_profit_pct / 100),
                }
                self.positions.append(position)
                print(f"[AutoTradeBot] BUY {position['quantity']:.6f} {symbol} @ ${current_price:.2f}")
                return {'action': 'BUY', 'symbol': symbol, 'price': current_price, 'quantity': position['quantity']}

            elif action == 'SELL':
                # Close existing position if any
                for i, pos in enumerate(self.positions):
                    if pos['symbol'] == symbol:
                        pnl = (current_price - pos['entry_price']) * pos['quantity']
                        closed = self.positions.pop(i)
                        print(f"[AutoTradeBot] SELL {pos['quantity']:.6f} {symbol} @ ${current_price:.2f} | P&L: ${pnl:.2f}")
                        return {'action': 'SELL', 'symbol': symbol, 'price': current_price, 'pnl': pnl}

            return None

        except Exception as e:
            print(f"[AutoTradeBot] Trade execution error: {e}")
            return None

    async def check_positions(self, symbol_prices):
        """Check all positions for exit conditions"""
        exits = []

        for position in self.positions[:]:  # Copy list to iterate safely
            symbol = position['symbol']
            if symbol in symbol_prices:
                current_price = symbol_prices[symbol]
                should_exit, reason = self.should_exit_position(position, current_price)

                if should_exit:
                    exits.append((position, current_price, reason))

        return exits

    async def run_cycle(self, symbols):
        """Run one analysis and trading cycle"""
        print(f"[AutoTradeBot] Starting cycle for {len(symbols)} symbols...")

        # Get current prices (using requests in production)
        symbol_prices = {}
        for symbol in symbols:
            try:
                import requests
                response = requests.get(
                    f'https://api.binance.com/api/v3/ticker/price',
                    params={'symbol': symbol},
                    timeout=10,
                )
                if response.ok:
                    symbol_prices[symbol] = float(response.json()['price'])
            except Exception as e:
                print(f"[AutoTradeBot] Failed to get price for {symbol}: {e}")

        # Check existing positions for exit
        exits = await self.check_positions(symbol_prices)
        for position, price, reason in exits:
            await self.execute_trade(position['symbol'], 'SELL', price)

        # Analyze symbols for entry
        for symbol in symbols:
            if self.should_enter_position(symbol):
                decision = await self.analyze_symbol(symbol)
                if decision == 'BUY' and symbol in symbol_prices:
                    await self.execute_trade(symbol, 'BUY', symbol_prices[symbol])
                elif decision == 'SELL' and symbol in symbol_prices:
                    await self.execute_trade(symbol, 'SELL', symbol_prices[symbol])

        print(f"[AutoTradeBot] Cycle complete. Open positions: {len(self.positions)}")
        return {
            'positions': len(self.positions),
            'prices': symbol_prices,
            'timestamp': datetime.now().isoformat()
        }

    async def run(self, symbols, interval_minutes=15):
        """Run the bot continuously"""
        self.running = True
        print(f"[AutoTradeBot] Starting auto-trading bot (interval: {interval_minutes} min)")

        while self.running:
            try:
                result = await self.run_cycle(symbols)
                print(f"[AutoTradeBot] Cycle result: {json.dumps(result)}")
            except Exception as e:
                print(f"[AutoTradeBot] Cycle error: {e}")

            # Wait for next cycle
            await asyncio.sleep(interval_minutes * 60)

    def stop(self):
        """Stop the bot"""
        self.running = False
        print("[AutoTradeBot] Stopping bot...")


def main():
    parser = argparse.ArgumentParser(description='Trade4u Auto-Trading Bot')
    parser.add_argument('--symbols', nargs='+', default=['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
                        help='Trading symbols')
    parser.add_argument('--interval', type=int, default=15,
                        help='Analysis interval in minutes')
    parser.add_argument('--provider', type=str, default='opencode',
                        help='LLM provider')
    parser.add_argument('--deep-model', type=str, default='minimax-m2.5-free',
                        help='Deep thinking model')
    parser.add_argument('--quick-model', type=str, default='minimax-m2.5-free',
                        help='Quick thinking model')
    parser.add_argument('--trade-amount', type=float, default=100,
                        help='Amount per trade (USDT)')
    parser.add_argument('--stop-loss', type=float, default=2,
                        help='Stop loss percentage')
    parser.add_argument('--take-profit', type=float, default=5,
                        help='Take profit percentage')
    parser.add_argument('--max-positions', type=int, default=3,
                        help='Maximum open positions')
    parser.add_argument('--api-key', type=str, default=None,
                        help='API key for LLM provider')

    args = parser.parse_args()

    # Set API key from environment if provided
    if args.api_key:
        os.environ[f"{args.provider.upper()}_API_KEY"] = args.api_key

    config = {
        'provider': args.provider,
        'deep_model': args.deep_model,
        'quick_model': args.quick_model,
        'trade_amount': args.trade_amount,
        'stop_loss': args.stop_loss,
        'take_profit': args.take_profit,
        'max_positions': args.max_positions,
        'symbols': args.symbols,
    }

    bot = AutoTradeBot(config)

    try:
        asyncio.run(bot.run(args.symbols, args.interval))
    except KeyboardInterrupt:
        print("\n[AutoTradeBot] Interrupted by user")
        bot.stop()


if __name__ == '__main__':
    main()