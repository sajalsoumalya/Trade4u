#!/usr/bin/env python3
"""
AI Signal Emitter — thin bridge between Node.js server and TradingAgents engine.
Runs analysis cycles and outputs JSON trading signals to stdout.
Node.js reads stdout and forwards to frontend via WebSocket.
"""
import os
import sys
import json
import re
import asyncio
import argparse
import requests
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG


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

# Known model prefixes per provider — used to detect provider/model mismatches
_PROVIDER_MODEL_PREFIXES = {
    "nvidia_nim": ["nvidia/", "meta/", "mistralai/", "google/"],
    "openrouter": ["openai/", "anthropic/", "google/", "deepseek/", "mistral/", "qwen/", "meta/"],
    "openai": ["gpt-", "o", "chatgpt-"],
    "anthropic": ["claude-"],
    "google": ["gemini-"],
    "deepseek": ["deepseek-"],
}


def _resolve_model(provider: str, model: str | None, default: str) -> str:
    """Return the model if it looks compatible with the provider, else the default."""
    if not model:
        return default
    prefixes = _PROVIDER_MODEL_PREFIXES.get(provider)
    if prefixes and not any(model.startswith(p) for p in prefixes):
        return default
    return model


class SignalEmitter:
    def __init__(self, config):
        provider = config.get('provider', 'opencode')
        default_model = _PROVIDER_DEFAULT_MODELS.get(provider, 'minimax-m2.5-free')
        q_model = _resolve_model(provider, config.get('quick_model'), default_model)
        d_model = _resolve_model(provider, config.get('deep_model'), default_model)
        self.config = {**config, 'quick_model': q_model, 'deep_model': d_model}
        agent_config = DEFAULT_CONFIG.copy()
        agent_config["llm_provider"] = provider
        agent_config["deep_think_llm"] = d_model
        agent_config["quick_think_llm"] = q_model
        agent_config["api_key"] = config.get('api_key', '')
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

            # Parse structured fields from the AI's final_trade_decision text
            parsed = {}
            if state and isinstance(state, dict) and 'final_trade_decision' in state:
                text = state['final_trade_decision']
                m = re.search(r'(?:\*\*)?Entry\s*Price(?:\*\*)?[:\s]*\$?([\d,.]+)', text, re.IGNORECASE)
                if m: parsed['entry_price'] = float(m.group(1).replace(',', ''))
                m = re.search(r'(?:\*\*)?Stop\s*Loss(?:\*\*)?[:\s]*\$?([\d,.]+)', text, re.IGNORECASE)
                if m: parsed['stop_loss'] = float(m.group(1).replace(',', ''))
                m = re.search(r'(?:\*\*)?Position\s*Sizing(?:\*\*)?[:\s]*(.+?)(?:\n|$)', text, re.IGNORECASE)
                if m: parsed['position_sizing'] = m.group(1).strip()
                m = re.search(r'(?:\*\*)?Reasoning(?:\*\*)?[:\s]*(.+?)(?:\n(?:\*\*)?\w|$)', text, re.IGNORECASE | re.DOTALL)
                if m: parsed['reasoning_text'] = m.group(1).strip()

            return signal_action, reasoning_log, parsed
        except Exception as e:
            err = str(e)
            return 'hold', [{"role": "error", "content": f"Analysis failed: {err} (provider={self.config.get('provider')}, model={self.config.get('quick_model')})"}], {}

    def get_sltp_suggestion(self, symbol, action, price, reasoning):
        """Ask the LLM for take-profit and stop-loss percentages via a quick API call."""
        try:
            provider = self.config.get('provider', 'opencode')
            api_key = self.config.get('api_key')
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
                print(json.dumps({"type": "sl_tp_error", "symbol": symbol, "action": "sl_tp_error", "price": price, "reasoning": [{"role": "error", "content": f"SL/TP API {resp.status_code}: model={self.config.get('quick_model')} provider={provider}"}], "timestamp": datetime.now().isoformat()}), flush=True)
        except Exception as e:
            print(json.dumps({"type": "sl_tp_error", "symbol": symbol, "action": "sl_tp_error", "price": price, "reasoning": [{"role": "error", "content": f"SL/TP call failed: {e}"}], "timestamp": datetime.now().isoformat()}), flush=True)
        return None, None

    async def run_cycle(self, symbols):
        for symbol in symbols:
            price = self.get_price(symbol)
            action, logs, parsed = await self.analyze(symbol)

            # Use AI-parsed values when available, otherwise fall back
            ai_entry = parsed.get('entry_price')
            ai_sl = parsed.get('stop_loss')
            ai_pos_sizing = parsed.get('position_sizing')
            ai_reasoning = parsed.get('reasoning_text')

            entry_price = ai_entry or price
            stop_loss = ai_sl if ai_sl is not None else self.stop_loss_pct
            take_profit = self.take_profit_pct
            if action in ('buy', 'sell') and price:
                ai_tp, _ = self.get_sltp_suggestion(symbol, action, price, logs)
                if ai_tp is not None:
                    take_profit = ai_tp

            # Emit analysis log with full AI-parsed fields
            log_entry = {
                "type": "log",
                "symbol": symbol,
                "action": action,
                "price": entry_price,
                "aiEntryPrice": ai_entry,
                "stopLoss": stop_loss,
                "takeProfit": take_profit,
                "positionSizing": ai_pos_sizing,
                "reasoning": logs,
                "aiReasoningText": ai_reasoning,
                "timestamp": datetime.now().isoformat(),
            }
            print(json.dumps(log_entry), flush=True)

            # Emit trade signal
            signal = {
                "type": "signal",
                "symbol": symbol,
                "action": action,
                "price": entry_price,
                "aiEntryPrice": ai_entry,
                "stopLoss": stop_loss,
                "takeProfit": take_profit,
                "positionSizing": ai_pos_sizing,
                "aiReasoningText": ai_reasoning,
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

    config = {
        'provider': args.provider,
        'deep_model': args.deep_model,
        'quick_model': args.quick_model,
        'stop_loss': args.stop_loss,
        'take_profit': args.take_profit,
        'api_key': args.api_key or '',
    }

    emitter = SignalEmitter(config)
    try:
        asyncio.run(emitter.run(args.symbols, args.interval))
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
