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


# Provider to API key env var mapping (matching tradingagents/llm_clients/openai_client.py)
_PROVIDER_ENV_VARS = {
    "opencode": "OPENCODE_API_KEY",
    "nvidia_nim": "NVIDIA_NIM_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "xai": "XAI_API_KEY",
    "qwen": "DASHSCOPE_API_KEY",
    "glm": "ZHIPU_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
}


# Default model per provider (used when the configured model doesn't match the provider)
_PROVIDER_DEFAULT_MODELS = {
    "opencode": "minimax-m2.5-free",
    "nvidia_nim": "nvidia/llama-3.1-nemotron-70b-instruct",
    "openai": "gpt-4.1-mini",
    "anthropic": "claude-sonnet-4-6",
    "google": "gemini-2.5-flash",
    "deepseek": "deepseek-chat",
    "openrouter": "openai/gpt-4.1-mini",
}


class SignalEmitter:
    def __init__(self, config):
        provider = config.get('provider', 'opencode')
        default_model = _PROVIDER_DEFAULT_MODELS.get(provider, 'minimax-m2.5-free')
        q_model = config.get('quick_model') or default_model
        d_model = config.get('deep_model') or default_model
        self.config = {**config, 'quick_model': q_model, 'deep_model': d_model}
        agent_config = DEFAULT_CONFIG.copy()
        agent_config["llm_provider"] = provider
        agent_config["deep_think_llm"] = d_model
        agent_config["quick_think_llm"] = q_model
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
        except Exception:
            pass
        return None

    async def analyze(self, symbol):
        try:
            state, decision = self.agent.propagate(symbol.upper(), datetime.now().strftime('%Y-%m-%d'))
            d = decision.upper().strip() if decision else ''

            # Extract reasoning log from state messages
            reasoning_log = []
            if state and 'messages' in state:
                for msg in state['messages']:
                    try:
                        if hasattr(msg, 'content') and msg.content:
                            content = msg.content[:2000] if isinstance(msg.content, str) else str(msg.content)[:2000]
                            role = getattr(msg, 'type', 'unknown')
                            reasoning_log.append({"role": role, "content": content})
                    except Exception:
                        pass

            signal_action = 'hold'
            if 'BUY' in d or 'LONG' in d:
                signal_action = 'buy'
            elif 'SELL' in d or 'SHORT' in d:
                signal_action = 'sell'

            return signal_action, reasoning_log
        except Exception as e:
            err = str(e)
            return 'hold', [{"role": "error", "content": f"Analysis failed: {err} (provider={self.config.get('provider')}, model={self.config.get('quick_model')})"}]

    def get_sltp_suggestion(self, symbol, action, price, reasoning):
        """Ask the LLM for take-profit and stop-loss percentages via a quick API call."""
        try:
            provider = self.config.get('provider', 'opencode')
            api_key = os.environ.get(_PROVIDER_ENV_VARS.get(provider, 'OPENAI_API_KEY'))
            if not api_key:
                return None, None
            from tradingagents.llm_clients.openai_client import _PROVIDER_CONFIG
            cfg = _PROVIDER_CONFIG.get(provider)
            base_url = cfg[0] if cfg else 'https://api.openai.com/v1'
            prompt = (
                f"Given a {action.upper()} signal for {symbol} at ${price:.2f}, "
                f"suggest take-profit % and stop-loss % as two comma-separated numbers only. "
                f"Example: 5.0,2.0"
            )
            resp = requests.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": self.config.get('quick_model', 'deepseek/deepseek-chat'),
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 20,
                    "temperature": 0,
                },
                timeout=10,
            )
            if resp.ok:
                text = resp.json()['choices'][0]['message']['content'].strip()
                parts = text.replace('%', '').split(',')
                tp = float(parts[0].strip())
                sl = float(parts[1].strip()) if len(parts) > 1 else None
                return (tp, sl) if tp and sl else (None, None)
            else:
                print(json.dumps({"type": "log", "symbol": symbol, "action": "sl_tp_error", "price": price, "reasoning": [{"role": "error", "content": f"SL/TP API {resp.status_code}: model={self.config.get('quick_model')} provider={provider}"}], "timestamp": datetime.now().isoformat()}), flush=True)
        except Exception as e:
            print(json.dumps({"type": "log", "symbol": symbol, "action": "sl_tp_error", "price": price, "reasoning": [{"role": "error", "content": f"SL/TP call failed: {e}"}], "timestamp": datetime.now().isoformat()}), flush=True)
        return None, None

    async def run_cycle(self, symbols):
        for symbol in symbols:
            price = self.get_price(symbol)
            action, logs = await self.analyze(symbol)

            # Determine SL/TP from AI suggestion or fall back to configured defaults
            stop_loss = self.stop_loss_pct
            take_profit = self.take_profit_pct
            if action in ('buy', 'sell') and price:
                ai_tp, ai_sl = self.get_sltp_suggestion(symbol, action, price, logs)
                if ai_tp is not None:
                    take_profit = ai_tp
                if ai_sl is not None:
                    stop_loss = ai_sl

            # Emit analysis log
            log_entry = {
                "type": "log",
                "symbol": symbol,
                "action": action,
                "price": price,
                "stopLoss": stop_loss,
                "takeProfit": take_profit,
                "reasoning": logs,
                "timestamp": datetime.now().isoformat(),
            }
            print(json.dumps(log_entry), flush=True)

            # Emit trade signal
            signal = {
                "type": "signal",
                "symbol": symbol,
                "action": action,
                "price": price,
                "stopLoss": stop_loss,
                "takeProfit": take_profit,
                "timestamp": datetime.now().isoformat(),
            }
            print(json.dumps(signal), flush=True)
            # Emit update_sltp for existing positions (AI suggests SL/TP levels)
            print(json.dumps({
                "type": "update_sltp",
                "symbol": symbol,
                "stopLoss": stop_loss,
                "takeProfit": take_profit,
            }), flush=True)

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
    parser.add_argument('--deep-model', default='deepseek/deepseek-chat')
    parser.add_argument('--quick-model', default='deepseek/deepseek-chat')
    parser.add_argument('--stop-loss', type=float, default=2)
    parser.add_argument('--take-profit', type=float, default=5)
    parser.add_argument('--api-key', default=None)

    args = parser.parse_args()
    if args.api_key:
        env_var = _PROVIDER_ENV_VARS.get(args.provider)
        if env_var:
            os.environ[env_var] = args.api_key
        # Fallback: also set OPENAI_API_KEY for any OpenAI-compatible provider
        if args.provider in ("opencode", "nvidia_nim", "deepseek", "openai", "xai", "qwen", "glm", "openrouter"):
            os.environ["OPENAI_API_KEY"] = args.api_key

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
