"""Live price monitoring - streams real-time prices."""
import time
import sys
from datetime import datetime
from threading import Event
import yfinance as yf
from rich.console import Console
from rich.table import Table
from rich.live import Live
from rich.layout import Layout

console = Console()


class LiveMonitor:
    """Monitor live prices for multiple symbols."""

    def __init__(self, symbols: list, interval: int = 5):
        self.symbols = [self._normalize(s) for s in symbols]
        self.interval = interval
        self.running = Event()
        self.prices = {}

    def _normalize(self, symbol: str) -> str:
        """Normalize symbol to yfinance format."""
        symbol = symbol.upper().strip()
        if "/" in symbol:
            base, quote = symbol.split("/", 1)
            if quote in ("USDT", "USD", "USDC"):
                quote = "USD"
            return f"{base}-{quote}"
        return symbol

    def _get_price(self, symbol: str) -> dict:
        """Get current price data."""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            return {
                "price": info.get("lastPrice") or info.get("previousClose"),
                "high": info.get("dayHigh"),
                "low": info.get("dayLow"),
                "change": info.get("regularMarketChange"),
                "change_pct": info.get("regularMarketChangePercent"),
                "volume": info.get("volume"),
            }
        except Exception as e:
            return {"error": str(e)}

    def _build_table(self) -> Table:
        """Build display table."""
        table = Table(title=f"Live Prices - Updated {datetime.now().strftime('%H:%M:%S')}")
        table.add_column("Symbol", style="cyan")
        table.add_column("Price", style="green", justify="right")
        table.add_column("Change", justify="right")
        table.add_column("Day High", justify="right")
        table.add_column("Day Low", justify="right")

        for symbol in self.symbols:
            data = self.prices.get(symbol, {})
            if "error" in data:
                table.add_row(symbol, f"ERROR: {data['error']}", "-", "-", "-")
            else:
                price = data.get("price", 0)
                change = data.get("change", 0)
                change_pct = data.get("change_pct", 0)
                high = data.get("high", 0)
                low = data.get("low", 0)

                change_str = f"{change:+.2f} ({change_pct:+.2f}%)" if change else "N/A"

                table.add_row(
                    symbol,
                    f"${price:.2f}" if price else "N/A",
                    change_str,
                    f"${high:.2f}" if high else "N/A",
                    f"${low:.2f}" if low else "N/A",
                )

        return table

    def start(self):
        """Start monitoring."""
        self.running.set()

        with Live(self._build_table(), refresh_per_second=1) as live:
            while self.running.is_set():
                # Refresh prices
                for symbol in self.symbols:
                    self.prices[symbol] = self._get_price(symbol)

                live.update(self._build_table())

                # Wait for interval or until stopped
                if not self.running.wait(timeout=self.interval):
                    break

    def stop(self):
        """Stop monitoring."""
        self.running.clear()


def monitor_cmd(symbols: list, interval: int = 5):
    """Run live monitor."""
    monitor = LiveMonitor(symbols, interval)
    try:
        console.print(f"[green]Monitoring: {', '.join(symbols)}[/green]")
        console.print("[dim]Press Ctrl+C to stop[/dim]\n")
        monitor.start()
    except KeyboardInterrupt:
        monitor.stop()
        console.print("\n[yellow]Stopped[/yellow]")


if __name__ == "__main__":
    # Example: python -m cli.monitor SPY BTC-USD AAPL
    symbols = sys.argv[1:] if len(sys.argv) > 1 else ["SPY"]
    monitor_cmd(symbols)