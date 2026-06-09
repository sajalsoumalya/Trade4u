import React from 'react';
import { Bot } from '../../store/appStore';
import { Terminal } from 'lucide-react';

interface LogTerminalTabProps {
  bot: Bot;
  logs: any[];
}

export function LogTerminalTab({
  bot,
  logs,
}: LogTerminalTabProps) {
  const reversedLogs = [...logs].reverse();

  return (
    <div className="p-4 max-h-[500px] overflow-y-auto">
      {reversedLogs.length === 0 ? (
        <div className="p-12 text-center">
          <Terminal className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-white font-medium">No engine logs yet</p>
          <p className="text-xs text-muted mt-1">Logs appear here when the AI engine runs analysis interval polling.</p>
        </div>
      ) : (
        <div className="space-y-3 font-mono">
          {reversedLogs.map((log, i) => (
            <div key={i} className="bg-background border border-border rounded-lg p-3.5 shadow-inner">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{log.symbol}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      log.action === 'buy'
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : log.action === 'sell'
                        ? 'bg-secondary/20 text-secondary border border-secondary/30'
                        : 'bg-white/5 text-muted border border-border'
                    }`}
                  >
                    {log.action?.toUpperCase() || 'HOLD'}
                  </span>
                </div>
                <span className="text-[10px] text-muted font-semibold">
                  {log.price ? `$${log.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : ''} ·{' '}
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {log.reasoning && log.reasoning.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {log.reasoning.map((r: any, j: number) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
