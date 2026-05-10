# TradingAgents Web Interface

A Streamlit-based web dashboard for the TradingAgents framework.

## Installation

1. Install TradingAgents with web dependencies:
```bash
pip install -e ".[dev]"  # or just pip install streamlit
```

2. Run the web interface:
```bash
streamlit run tradingagents_web/app.py
```

## Features

- **Dashboard**: Overview of recent activity and quick stats
- **Operations**: Run analyses, view task queue
- **Settings**: Configure LLM providers, models, debate rounds
- **Results**: View detailed analysis results

## Configuration

Settings are persisted to `tradingagents_web/config.json`. Task history is stored in `tradingagents_web/tasks.db`.