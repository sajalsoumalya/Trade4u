#!/usr/bin/env python3
"""
WebSocket server for real-time Binance crypto prices
Provides WebSocket endpoint for frontend to receive live price updates
"""

import asyncio
import json
import websockets
import aiohttp
from datetime import datetime
import argparse

class BinanceWebSocketServer:
    def __init__(self, port=8765):
        self.port = port
        self.clients = set()
        self.subscriptions = {}  # symbol -> list of websocket clients
        self.current_prices = {}  # symbol -> latest price data cache
        self.binance_base = "https://api.binance.com"
        self.ws_url = "wss://stream.binance.com:9443/ws"

    async def fetch_initial_prices(self, symbols):
        """Fetch initial prices for all symbols"""
        prices = {}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.binance_base}/api/v3/ticker/24hr") as resp:
                    data = await resp.json()
                    for item in data:
                        if item['symbol'] in symbols:
                            prices[item['symbol']] = {
                                'symbol': item['symbol'],
                                'price': float(item['lastPrice']),
                                'priceChange': float(item['priceChange']),
                                'priceChangePercent': float(item['priceChangePercent']),
                                'high24h': float(item['highPrice']),
                                'low24h': float(item['lowPrice']),
                                'volume': float(item['volume']),
                                'quoteVolume': float(item['quoteVolume']),
                                'timestamp': datetime.now().isoformat()
                            }
        except Exception as e:
            print(f"Error fetching prices: {e}")
        return prices

    async def binance_websocket_listener(self, symbols):
        """Connect to Binance WebSocket and broadcast updates"""
        streams = [f"{s.lower()}@ticker" for s in symbols]
        ws_url = f"{self.ws_url}/{'/'.join(streams)}"

        while True:
            try:
                async with websockets.connect(ws_url) as ws:
                    print(f"Connected to Binance WebSocket for {len(symbols)} symbols")
                    async for message in ws:
                        try:
                            data = json.loads(message)
                            if data.get('e') == '24hrTicker':
                                ticker = {
                                    'symbol': data['s'],
                                    'price': float(data['c']),
                                    'priceChange': float(data['p']),
                                    'priceChangePercent': float(data['P']),
                                    'high24h': float(data['h']),
                                    'low24h': float(data['l']),
                                    'volume': float(data['v']),
                                    'quoteVolume': float(data['q']),
                                    'bidPrice': float(data['b']),
                                    'askPrice': float(data['a']),
                                    'timestamp': datetime.now().isoformat()
                                }
                                # Broadcast to all subscribed clients
                                await self.broadcast_to_symbol(ticker['symbol'], ticker)
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                print(f"Binance WebSocket error: {e}")
                await asyncio.sleep(5)  # Reconnect after 5 seconds

    async def broadcast_to_symbol(self, symbol, data):
        """Send price update to all clients subscribed to this symbol"""
        self.current_prices[symbol] = data

        if symbol not in self.subscriptions:
            return

        message = json.dumps({
            'type': 'price_update',
            'data': data
        })

        disconnected = set()
        for client in self.subscriptions[symbol]:
            try:
                await client.send(message)
            except:
                disconnected.add(client)

        # Clean up disconnected clients
        for client in disconnected:
            self.subscriptions[symbol].discard(client)

    async def broadcast_to_all(self, data):
        """Send update to all connected clients"""
        message = json.dumps({
            'type': 'price_update',
            'data': data
        })

        disconnected = set()
        for client in self.clients:
            try:
                await client.send(message)
            except:
                disconnected.add(client)

        for client in disconnected:
            self.clients.discard(client)

    async def handle_client(self, websocket):
        """Handle individual client connection"""
        self.clients.add(websocket)
        client_subscriptions = set()

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)

                    if data.get('type') == 'subscribe':
                        symbols = data.get('symbols', [])
                        for symbol in symbols:
                            if symbol not in self.subscriptions:
                                self.subscriptions[symbol] = set()
                            self.subscriptions[symbol].add(websocket)
                            client_subscriptions.add(symbol)

                        await websocket.send(json.dumps({
                            'type': 'subscribed',
                            'symbols': symbols
                        }))

                    elif data.get('type') == 'unsubscribe':
                        symbols = data.get('symbols', [])
                        for symbol in symbols:
                            if symbol in self.subscriptions:
                                self.subscriptions[symbol].discard(websocket)
                            client_subscriptions.discard(symbol)

                        await websocket.send(json.dumps({
                            'type': 'unsubscribed',
                            'symbols': symbols
                        }))

                    elif data.get('type') == 'get_prices':
                        symbols = data.get('symbols', [])
                        prices = {}
                        for symbol in symbols:
                            if symbol in self.current_prices:
                                prices[symbol] = self.current_prices[symbol]
                        await websocket.send(json.dumps({
                            'type': 'prices',
                            'data': prices
                        }))

                except json.JSONDecodeError:
                    continue

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            # Clean up subscriptions
            for symbol in client_subscriptions:
                if symbol in self.subscriptions:
                    self.subscriptions[symbol].discard(websocket)

            self.clients.discard(websocket)
            print(f"Client disconnected. Active clients: {len(self.clients)}")

    async def start(self, symbols):
        """Start the WebSocket server"""
        # Start Binance listener in background
        asyncio.create_task(self.binance_websocket_listener(symbols))

        async with websockets.serve(self.handle_client, "0.0.0.0", self.port):
            print(f"WebSocket server started on port {self.port}")
            await asyncio.Future()  # Run forever

def main():
    parser = argparse.ArgumentParser(description='Binance WebSocket Server')
    parser.add_argument('--port', type=int, default=8765, help='WebSocket server port')
    parser.add_argument('--symbols', nargs='+', default=[
        'btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt',
        'adausdt', 'dogeusdt', 'dotusdt', 'maticusdt', 'ltcusdt'
    ], help='Trading pair symbols')

    args = parser.parse_args()

    server = BinanceWebSocketServer(port=args.port)

    print(f"Starting WebSocket server with {len(args.symbols)} symbols...")
    print("Symbols:", args.symbols)

    try:
        asyncio.run(server.start([s.upper() for s in args.symbols]))
    except KeyboardInterrupt:
        print("\nShutting down...")

if __name__ == '__main__':
    main()