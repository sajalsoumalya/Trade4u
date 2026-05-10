"""CLI Configuration - Saved user preferences."""
import json
from pathlib import Path
from datetime import datetime

_CONFIG_FILE = Path(__file__).parent / "config.json"

CLI_CONFIG = {
    # Announcements
    "announcements_url": "https://api.trade4u.example/v1/announcements",
    "announcements_timeout": 1.0,
    "announcements_fallback": "[cyan]For more information, please visit[/cyan] [link=https://github.com/soumalya/trade4u]https://github.com/soumalya/trade4u[/link]",
}

# Default saved settings
DEFAULT_SETTINGS = {
    "ticker": "SPY",
    "analysis_date": datetime.now().strftime("%Y-%m-%d"),
    "analysts": ["market", "social", "news", "fundamentals"],
    "research_depth": 3,
    "output_language": "English",
    "llm_provider": "openai",
    "deep_think_llm": "gpt-5.4",
    "quick_think_llm": "gpt-5.4-mini",
    "backend_url": "",
}


def load_settings() -> dict:
    """Load saved settings from config file."""
    if _CONFIG_FILE.exists():
        with open(_CONFIG_FILE) as f:
            saved = json.load(f)
            # Merge with defaults to ensure all keys exist
            return {**DEFAULT_SETTINGS, **saved}
    return DEFAULT_SETTINGS.copy()


def get_live_date() -> str:
    """Get today's date for live analysis."""
    return datetime.now().strftime("%Y-%m-%d")


def save_settings(settings: dict) -> None:
    """Save settings to config file."""
    with open(_CONFIG_FILE, "w") as f:
        json.dump(settings, f, indent=2)


def get_setting(key: str, default=None):
    """Get a single setting value."""
    settings = load_settings()
    return settings.get(key, default)


def update_setting(key: str, value) -> None:
    """Update a single setting value."""
    settings = load_settings()
    settings[key] = value
    save_settings(settings)
