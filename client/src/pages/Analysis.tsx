import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { io } from 'socket.io-client';
import { useToast } from '../components/Toast';
import {
  runAnalysis,
  getAnalysis,
  getAnalysisHistory,
  fetchBinanceSymbols
} from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import {
  Brain,
  Play,
  History,
  Calendar,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
  Clock
} from 'lucide-react';

const DEFAULT_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'];

const STAGES = [
  { id: 1, name: 'Market Analyst', desc: 'Analyzing charts, order book liquidity, and technical trends...' },
  { id: 2, name: 'Sentiment Analyst', desc: 'Scanning social feeds, developer commits, and financial news...' },
  { id: 3, name: 'News Analyst', desc: 'Evaluating financial news and insider transactions...' },
  { id: 4, name: 'Fundamentals Analyst', desc: 'Reviewing financial statements and fundamentals data...' },
  { id: 5, name: 'Debate Panel', desc: 'Executing cooperative agent debate to challenge recommendations...' },
  { id: 6, name: 'Risk Manager', desc: 'Evaluating volatility, drawdown probability, and position size limits...' },
];

// Simple Custom Markdown Renderer
function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split('\n');
  const rendered = lines.map((line, idx) => {
    // Headings
    if (line.startsWith('### ')) {
      return <h4 key={idx} className="text-sm font-bold text-white mt-4 mb-2 border-b border-border/30 pb-1">{line.replace('### ', '')}</h4>;
    }
    if (line.startsWith('## ')) {
      return <h3 key={idx} className="text-base font-bold text-primary mt-5 mb-3 border-b border-border/50 pb-1.5">{line.replace('## ', '')}</h3>;
    }
    if (line.startsWith('# ')) {
      return <h2 key={idx} className="text-lg font-extrabold text-white mt-6 mb-4">{line.replace('# ', '')}</h2>;
    }

    // Bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const text = line.replace(/^[\s-*]+/, '');
      return (
        <li key={idx} className="text-xs text-muted list-disc ml-5 mb-1.5 leading-relaxed">
          {parseInlineFormatting(text)}
        </li>
      );
    }

    // Numbered lists
    if (/^\d+\.\s/.test(line.trim())) {
      const text = line.replace(/^\s*\d+\.\s/, '');
      return (
        <li key={idx} className="text-xs text-muted list-decimal ml-5 mb-1.5 leading-relaxed">
          {parseInlineFormatting(text)}
        </li>
      );
    }

    // Horizontal Rule
    if (line.trim() === '---') {
      return <hr key={idx} className="my-4 border-border/40" />;
    }

    // Standard paragraph
    if (line.trim() === '') return <div key={idx} className="h-2" />;

    return <p key={idx} className="text-xs text-muted leading-relaxed mb-2">{parseInlineFormatting(line)}</p>;
  });

  return <div className="space-y-1">{rendered}</div>;
}

// Support bold and inline code styling
function parseInlineFormatting(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px] text-primary font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export default function Analysis() {
  const { llmProvider, apiKey, quickModel, deepModel, fallbackProvider, fallbackApiKey, fallbackQuickModel, fallbackDeepModel } = useAppStore();
  const { addToast } = useToast();

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [searchQuery, setSearchQuery] = useState('BTCUSDT');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch full symbols list dynamically from Binance API
  const { data: allPairs = DEFAULT_PAIRS } = useQuery({
    queryKey: ['binanceSymbols'],
    queryFn: fetchBinanceSymbols,
    staleTime: 24 * 60 * 60 * 1000,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSearchQuery(symbol);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [symbol]);

  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Active Execution States
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [currentStage, setCurrentStage] = useState(0);
  const [decision, setDecision] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [stageOutputs, setStageOutputs] = useState<Record<number, string>>({});

  const socketRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const stageIntervalRef = useRef<any>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getAnalysisHistory(15);
      setHistory(data);
      // If there's a running/pending analysis from a previous session, resume watching it
      const latest = data[0];
      if (latest && (latest.status === 'running' || latest.status === 'pending') && latest.id !== currentAnalysisId) {
        setCurrentAnalysisId(latest.id);
        if (latest.symbol) { setSymbol(latest.symbol); setSearchQuery(latest.symbol); }
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const startTracking = () => {
    setTimeElapsed(0);
    setCurrentStage(1);
    setStatus('running');
    setStageOutputs({});

    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
  };

  const stopTracking = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Connect/reconnect Socket.IO whenever currentAnalysisId changes
  useEffect(() => {
    if (!currentAnalysisId) return;
    if (socketRef.current) socketRef.current.disconnect();
    const socket = io({ path: '/api/socket.io' });
    socketRef.current = socket;

    socket.on(`analysis:${currentAnalysisId}`, (data: any) => {
      if (data.status === 'stage') {
        setCurrentStage(data.stage);
        setStageOutputs(prev => ({ ...prev, [data.stage]: data.output }));
      } else if (data.status === 'error_log') {
        setErrorText(prev => (prev || '') + data.error + '\n');
      } else if (data.status === 'completed') {
        stopTracking();
        setStatus('completed');
        setDecision(data.decision);
        setReport(data.result);
        setCurrentStage(7);
        addToast('success', `AI Analysis for ${symbol} finalized!`);
        loadHistory();
      } else if (data.status === 'failed') {
        stopTracking();
        setStatus('failed');
        setErrorText(data.error || 'Execution encountered an unrecoverable failure.');
        addToast('error', `AI Analysis for ${symbol} failed.`);
        loadHistory();
      }
    });

    // No cleanup on unmount — socket persists in background
  }, [currentAnalysisId]);

  const handleRun = async () => {
    if (!symbol) return;
    setStatus('running');
    setDecision(null);
    setReport(null);
    setErrorText(null);

    try {
      startTracking();

      const res = await runAnalysis(symbol, undefined, {
        provider: llmProvider,
        quickModel,
        deepModel,
        apiKey,
        fallbackProvider,
        fallbackQuickModel,
        fallbackDeepModel,
        fallbackApiKey,
      });
      if (res.error) {
        throw new Error(res.error);
      }

      const id = res.id;
      setCurrentAnalysisId(id);
    } catch (err: any) {
      stopTracking();
      setStatus('failed');
      setErrorText(err.message || 'An unexpected error occurred during execution setup.');
      addToast('error', err.message || 'Failed to start analysis.');
    }
  };

  const handleInspectHistory = async (id: string) => {
    setStatus('idle');
    setDecision(null);
    setReport(null);
    setErrorText(null);

    try {
      const res = await getAnalysis(id);
      if (res.status === 'completed') {
        setCurrentAnalysisId(id);
        setStatus('completed');
        setDecision(res.decision);
        setReport(res.result);
      } else if (res.status === 'failed') {
        setCurrentAnalysisId(id);
        setStatus('failed');
        setErrorText(res.error || 'This task failed to complete execution.');
      } else {
        // running/pending — connect socket for live updates
        setCurrentAnalysisId(id);
        startTracking();
      }
      if (res.symbol) {
        setSymbol(res.symbol);
        setSearchQuery(res.symbol);
      }
    } catch (err: any) {
      addToast('error', 'Failed to retrieve historical record.');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> AI Cooperative Research Center
          </h1>
          <p className="text-xs text-muted">
            Launch specialized agent nodes (Sentiment, Charts, Risk) to draft strategic portfolio intelligence report.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Input parameters */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-card">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> Pipeline Inputs
            </h2>

            <div className="space-y-4">
              <div className="relative" ref={dropdownRef}>
                <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wide">Target Asset Symbol</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      setSearchQuery(symbol);
                      setShowSuggestions(true);
                    }}
                    placeholder="Search Binance pairs or type custom..."
                    className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-white text-xs font-semibold focus:outline-none focus:border-primary transition-colors"
                    disabled={status === 'running'}
                  />
                  {symbol && (
                    <span className="absolute right-3 top-2 text-[10px] bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 rounded font-mono font-bold">
                      {symbol}
                    </span>
                  )}
                </div>

                {showSuggestions && (
                  <div className="absolute z-10 w-full mt-1 bg-[#15191E] border border-border rounded-lg shadow-2xl max-h-60 overflow-y-auto divide-y divide-border/40">
                    {allPairs
                      .filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, 10)
                      .map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setSymbol(p);
                            setSearchQuery(p);
                            setShowSuggestions(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-white/5 transition-colors flex justify-between ${
                            symbol === p ? 'text-primary bg-primary/5' : 'text-white'
                          }`}
                        >
                          <span>{p}</span>
                          <span className="text-[10px] text-muted font-normal">Binance Pair</span>
                        </button>
                      ))}

                    {searchQuery.trim() && !allPairs.includes(searchQuery.toUpperCase().trim()) && (
                      <button
                        type="button"
                        onClick={() => {
                          const customSym = searchQuery.toUpperCase().trim();
                          setSymbol(customSym);
                          setSearchQuery(customSym);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-primary hover:bg-white/5 transition-colors flex justify-between"
                      >
                        <span>Use Custom: "{searchQuery.toUpperCase().trim()}"</span>
                        <span className="text-[10px] text-primary/80 font-normal">Custom Ticker</span>
                      </button>
                    )}
                    
                    {allPairs.filter(p => p.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && !searchQuery.trim() && (
                      <div className="px-3.5 py-2 text-xs text-muted italic">Type to search symbols...</div>
                    )}
                  </div>
                )}
              </div>

              {(llmProvider || quickModel) && (
                <p className="text-[10px] text-muted leading-relaxed">
                  Using{' '}
                  <span className="text-white font-semibold">{llmProvider || 'default'}</span>
                  {quickModel && (
                    <>
                      {' · '}
                      <span className="font-mono text-white">{quickModel}</span>
                    </>
                  )}
                  {' — '}
                  <span className="italic">configured in Settings</span>
                </p>
              )}

              <button
                type="button"
                onClick={handleRun}
                disabled={status === 'running'}
                className="w-full mt-2 py-3 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === 'running' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Executing Agents...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-black" />
                    Run Cooperating Agents
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Past Analyses */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-card">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-xs flex items-center gap-1.5 border-b border-border pb-3">
              <History className="w-4 h-4 text-muted" /> Historical Reports
            </h2>

            {isLoadingHistory ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">No historical records in archive database</p>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {history.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleInspectHistory(item.id)}
                    className={`p-3 bg-background border rounded-lg hover:border-gray-500 hover:bg-white/5 cursor-pointer transition-all ${
                      currentAnalysisId === item.id ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white">
                        {item.symbol}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.decision === 'BUY'
                            ? 'bg-primary/20 text-primary'
                            : item.decision === 'SELL'
                            ? 'bg-secondary/20 text-secondary'
                            : 'bg-white/5 text-muted'
                        }`}
                      >
                        {item.decision || 'PENDING'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <span
                        className={`font-semibold ${
                          item.status === 'completed'
                            ? 'text-primary'
                            : item.status === 'failed'
                            ? 'text-secondary'
                            : 'text-warning'
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Console Log / Report Output */}
        <div className="lg:col-span-3 space-y-4">
          {status === 'running' && (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-card space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-sm font-semibold text-white">Agent Cooperative Panel Active</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted font-mono bg-background px-2.5 py-1 rounded-lg border border-border">
                  <Clock className="w-3.5 h-3.5" />
                  {timeElapsed}s
                </div>
              </div>

              {/* Progress Stage Tracker */}
              <div className="space-y-4">
                {STAGES.map(stage => {
                  const isActive = currentStage === stage.id;
                  const isDone = currentStage > stage.id;
                  const stageOutput = stageOutputs[stage.id];
                  return (
                    <div
                      key={stage.id}
                      className={`rounded-xl border transition-all ${
                        isActive
                          ? 'bg-primary/5 border-primary shadow-glow-primary'
                          : isDone
                          ? 'bg-white/5 border-border'
                          : 'bg-background border-border/40 opacity-40'
                      }`}
                    >
                      <div className="flex gap-3.5 p-3.5">
                        <div className="flex-shrink-0">
                          {isDone ? (
                            <div className="w-5 h-5 rounded-full bg-primary text-black flex items-center justify-center text-[10px] font-bold">✓</div>
                          ) : isActive ? (
                            <div className="w-5 h-5 rounded-full border border-primary text-primary flex items-center justify-center text-[10px] font-bold">
                              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-border text-muted flex items-center justify-center text-[10px] font-bold">{stage.id}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-xs font-bold ${isActive ? 'text-primary' : 'text-white'}`}>
                            {stage.name}
                          </h4>
                          <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{stage.desc}</p>
                        </div>
                      </div>
                      {stageOutput && (
                        <div className="mx-3.5 pb-3.5">
                          <pre className="p-2 bg-black/40 border border-border rounded-lg text-[10px] text-muted font-mono whitespace-pre-wrap max-h-24 overflow-y-auto leading-relaxed">
                            {stageOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="bg-surface border border-border rounded-xl p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  <span className="text-sm font-bold text-white">Investment Intelligence Proposal</span>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-lg ${
                      decision === 'BUY'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : decision === 'SELL'
                        ? 'bg-secondary/10 text-secondary border border-secondary/20'
                        : 'bg-white/5 text-muted border border-border'
                    }`}
                  >
                    Recommendation: {decision}
                  </span>
                </div>
              </div>

              {/* Output Content */}
              <div className="max-h-[520px] overflow-y-auto pr-1">
                {report ? (
                  <MarkdownRenderer content={report} />
                ) : (
                  <p className="text-xs text-muted italic">Draft proposal is currently empty.</p>
                )}
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-5 shadow-card space-y-3">
              <div className="flex items-center gap-2 border-b border-secondary/20 pb-3">
                <AlertTriangle className="w-5 h-5 text-secondary" />
                <span className="text-sm font-semibold text-secondary">Pipeline Crash Logs</span>
              </div>
              <pre className="p-3 bg-black/40 border border-border rounded-lg text-secondary text-[10px] font-mono whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                {errorText || 'Execution encountered an unrecoverable failure.'}
              </pre>
            </div>
          )}

          {status === 'idle' && (
            <div className="bg-surface border border-border rounded-xl p-8 shadow-card flex flex-col items-center justify-center text-center py-20">
              <Brain className="w-14 h-14 text-muted mb-4" />
              <h3 className="text-sm font-bold text-white mb-1">Launch Intelligent Co-agents</h3>
              <p className="text-xs text-muted max-w-sm mb-4">
                Select an asset ticker and start the pipeline. The system will deploy cooperating agents to perform data ingestion, debate, and compile a strategic proposal.
              </p>
              <button
                onClick={handleRun}
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary-light shadow-lg shadow-primary/10"
              >
                Start Analysis <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
