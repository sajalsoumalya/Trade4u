import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8765';

interface UseWebSocketOptions {
  symbols?: string[];
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    symbols = [],
    onMessage,
    onConnect,
    onDisconnect,
    reconnect = true,
    reconnectInterval = 5000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [prices, setPrices] = useState<Record<string, any>>({});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        onConnect?.();

        // Subscribe to symbols
        if (symbols.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            symbols: symbols.map(s => s.toUpperCase()),
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'price_update') {
            const { data } = message;
            setPrices(prev => ({
              ...prev,
              [data.symbol]: data,
            }));
            onMessage?.(data);
          }
        } catch (e) {
          console.error('WebSocket message error:', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        onDisconnect?.();

        // Reconnect
        if (reconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Reconnecting WebSocket...');
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('WebSocket connection error:', e);
    }
  }, [symbols, onMessage, onConnect, onDisconnect, reconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const subscribe = useCallback((newSymbols: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        symbols: newSymbols.map(s => s.toUpperCase()),
      }));
    }
  }, []);

  const unsubscribe = useCallback((symbolsToRemove: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        symbols: symbolsToRemove.map(s => s.toUpperCase()),
      }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    prices,
    subscribe,
    unsubscribe,
    reconnect: connect,
  };
}

// Alternative: Direct Binance WebSocket integration (no server needed)
export function useBinanceWebSocket(symbols: string[]) {
  const wsRef = useRef<WebSocket | null>(null);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (symbols.length === 0) return;

    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;

    console.log('Connecting to Binance WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Binance WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.e === '24hrTicker') {
          setPrices(prev => ({
            ...prev,
            [data.s]: {
              symbol: data.s,
              price: parseFloat(data.c),
              priceChange: parseFloat(data.p),
              priceChangePercent: parseFloat(data.P),
              high24h: parseFloat(data.h),
              low24h: parseFloat(data.l),
              volume: parseFloat(data.v),
              quoteVolume: parseFloat(data.q),
              bidPrice: parseFloat(data.b),
              askPrice: parseFloat(data.a),
            },
          }));
        }
      } catch (e) {
        console.error('Binance WS message error:', e);
      }
    };

    ws.onclose = () => {
      console.log('Binance WebSocket disconnected');
      setIsConnected(false);

      // Auto reconnect after 5 seconds
      setTimeout(() => {
        console.log('Reconnecting to Binance...');
        // Force re-render to trigger reconnect
        wsRef.current = null;
        setPrices({});
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('Binance WebSocket error:', error);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [symbols.join(',')]); // Reconnect when symbol list changes

  return { isConnected, prices };
}