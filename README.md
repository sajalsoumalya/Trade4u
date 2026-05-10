<p align="center">
  <img src="assets/logo.png" style="width: 60%; height: auto;">
</p>

<div align="center" style="line-height: 1;">
  <a href="https://arxiv.org/abs/2412.20138" target="_blank"><img alt="arXiv" src="https://img.shields.io/badge/arXiv-2412.20138-B31B1B?logo=arxiv"/></a>
  <a href="https://discord.com/invite/hk9PGKShPK" target="_blank"><img alt="Discord" src="https://img.shields.io/badge/Discord-Trade4u-7289da?logo=discord&logoColor=white&color=7289da"/></a>
  <a href="https://x.com/YourHandle" target="_blank"><img alt="X" src="https://img.shields.io/badge/X-Trade4u-white?logo=x&logoColor=white"/></a>
  <br>
  <a href="https://github.com/soumalya/" target="_blank"><img alt="Community" src="https://img.shields.io/badge/Join_GitHub_Community-Trade4u-14C290?logo=discourse"/></a>
</div>

---

# Trade4u: Multi-Agents LLM Financial Trading Framework

## News
- [2026-05] **Trade4u** - Forked from TradingAgents with web interface, OpenCode/NVIDIA NIM support

---

## About

Trade4u is a multi-agent trading framework that mirrors the dynamics of real-world trading firms. By deploying specialized LLM-powered agents: from fundamental analysts, sentiment experts, and technical analysts, to trader, risk management team, the platform collaboratively evaluates market conditions and informs trading decisions.

> Trade4u is for research purposes. Trading performance may vary. Not intended as financial advice.

## Installation

```bash
git clone https://github.com/soumalya/Trade4u.git
cd Trade4u
pip install .
```

## Web Interface

Run the Streamlit web interface:

```bash
streamlit run tradingagents_web/app.py
```

Or with Docker:
```bash
docker compose -f docker-compose.web.yml up --build
```

## Configuration

Set your API keys in `.env`:
```bash
OPENAI_API_KEY=sk-...
# Or use OpenCode:
# OPENCODE_API_KEY=your-key
LLM_PROVIDER=openai
```

## Usage

CLI:
```bash
trade4u
```

Python:
```python
from tradingagents.graph.trading_graph import TradingAgentsGraph

ta = TradingAgentsGraph(config={...})
_, decision = ta.propagate("NVDA", "2026-01-15")
print(decision)
```

## License

See LICENSE file.