import React, { useEffect, useState } from 'react';
import { Bot } from '../../store/appStore';
import { Terminal, Loader2 } from 'lucide-react';
import { fetchBotLogs } from '../../lib/api';

interface LogTerminalTabProps {
  bot: Bot;
  logs: any[];
}

export function LogTerminalTab({
  bot,
  logs,
}: LogTerminalTabProps) {
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchBotLogs(bot.id, 100)
      .then(setDbLogs)
      .catch(() => setDbLogs([]))
      .finally(() => setLoading(false));
  }, [bot.id]);

  // Merge persisted logs with real-time logs (dedup by id)
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const log of [...dbLogs, ...logs]) {
    const key = log.id || (log.symbol + log.timestamp + log.action);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(log);
    }
  }
  const reversedLogs = merged.sort(
    (a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime()
  );

  return (
    <div className="p-4 max-h-[500px] overflow-y-auto">
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted mx-auto mb-2" />
        </div>
      ) : reversedLogs.length === 0 ? (
        <div className="p-12 text-center">
          <Terminal className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-white font-medium">No engine logs yet</p>
          <p className="text-xs text-muted mt-1">Logs appear here when the AI engine runs analysis interval polling.</p>
        </div>
      ) : (
        <div className="space-y-3 font-mono">
          {reversedLogs.map((log, i) => {
            const symbol = log.symbol;
            const action = log.action;
            const price = log.price;
            const timestamp = log.created_at || log.timestamp;
            const reasoning = log.reasoning;
            const status = log.status;
            const error = log.error;

            return (
              <div key={log.id || i} className={`bg-background border rounded-lg p-3.5 shadow-inner ${
                status === 'error' ? 'border-secondary/30' :
                status === 'running' ? 'border-warning/30' :
                'border-border'
              }`}>
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{symbol}</span>
                    {status === 'error' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/30">ERROR</span>
                    ) : status === 'running' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" /> RUNNING
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        action === 'buy'
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : action === 'sell'
                          ? 'bg-secondary/20 text-secondary border border-secondary/30'
                          : 'bg-white/5 text-muted border border-border'
                      }`}>
                        {action?.toUpperCase() || 'HOLD'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted font-semibold">
                    {price ? `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''} ·{' '}
                    {new Date(timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {error && (
                  <pre className="p-2 bg-secondary/5 border border-secondary/20 rounded text-secondary text-[10px] whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto">
                    {error}
                  </pre>
                )}

                {reasoning && typeof reasoning === 'string' && reasoning !== 'null' && (
                  <div className="mt-2">
                    {(() => {
                      try {
                        const parsed = JSON.parse(reasoning);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                          return (
                            <div className="space-y-1.5">
                              {parsed.map((r: any, j: number) => (
                                <details key={j} className="text-[11px] group">
                                  <summary className="text-muted hover:text-white cursor-pointer transition-colors font-semibold py-0.5 select-none list-none flex items-center gap-1.5">
                                    <span className="text-[8px] text-muted group-open:rotate-90 transition-transform">▶</span>
                                    {r.role}
                                  </summary>
                                  <pre className="mt-1.5 p-2 bg-black/40 border border-border/30 rounded text-muted whitespace-pre-wrap text-[10px] leading-relaxed max-h-[200px] overflow-y-auto">
                                    {r.content}
                                  </pre>
                                </details>
                              ))}
                            </div>
                          );
                        }
                      } catch {}
                      return null;
                    })()}
                  </div>
                )}

                {Array.isArray(reasoning) && reasoning.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {reasoning.map((r: any, j: number) => (
                      <details key={j} className="text-[11px] group">
                        <summary className="text-muted hover:text-white cursor-pointer transition-colors font-semibold py-0.5 select-none list-none flex items-center gap-1.5">
                          <span className="text-[8px] text-muted group-open:rotate-90 transition-transform">▶</span>
                          {r.role}
                        </summary>
                        <pre className="mt-1.5 p-2 bg-black/40 border border-border/30 rounded text-muted whitespace-pre-wrap text-[10px] leading-relaxed max-h-[200px] overflow-y-auto">
                          {r.content}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
