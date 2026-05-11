import { useEffect, useState } from 'react';
import { runAnalysis, getAnalysisHistory } from '../lib/api';
import { useAppStore } from '../store/appStore';
import { Brain, Play, Clock, TrendingUp, TrendingDown, Minus, ChevronRight, Sparkles, Loader2, FileText, CheckCircle2 } from 'lucide-react';

export default function Analysis() {
  const [symbol, setSymbol] = useState('');
  const [running, setRunning] = useState(false);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);

  const { llmProvider, deepModel, quickModel } = useAppStore();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getAnalysisHistory(10);
      setAnalyses(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRun = async () => {
    if (!symbol) return;
    setRunning(true);
    try {
      await runAnalysis(symbol, undefined, {
        provider: llmProvider,
        deepModel,
        quickModel
      });
      await loadHistory();
    } catch (e) {
      console.error(e);
    }
    setRunning(false);
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'BUY':
        return <TrendingUp className="w-4 h-4" />;
      case 'SELL':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">AI Analysis</h1>
          <p className="text-muted">Powered by multi-agent AI trading system</p>
        </div>
        <div className="badge-purple flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          TradingAgents Active
        </div>
      </div>

      {/* Run Analysis */}
      <div className="card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-accent/10 to-transparent rounded-bl-full" />
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg shadow-accent/30">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Run New Analysis</h2>
            <p className="text-sm text-muted">Get AI-powered insights for any stock symbol</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="input w-full pl-12 pr-4 py-4 text-lg"
              placeholder="Enter symbol (e.g., AAPL, TSLA, BTC-USD)"
              onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            />
            <Brain className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          </div>

          <button
            onClick={handleRun}
            disabled={running || !symbol}
            className="btn-accent flex items-center gap-2 px-8 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run Analysis
              </>
            )}
          </button>
        </div>

        {running && (
          <div className="mt-6 p-4 rounded-xl bg-accent/5 border border-accent/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-accent animate-pulse" />
              </div>
              <span className="font-medium text-white">AI Agents Working</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Fundamental Analysis
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Technical Analysis
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                News Sentiment
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 className="w-4 h-4 text-accent animate-pulse" />
                Risk Assessment
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analysis History */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Analysis History
              </h2>
              <span className="text-sm text-muted">{analyses.length} analyses</span>
            </div>

            {analyses.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Analyses Yet</h3>
                <p className="text-sm text-muted">Run your first AI analysis to see results here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((a, index) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAnalysis(a)}
                    className={`group p-4 rounded-xl cursor-pointer transition-all animate-slide-up ${
                      selectedAnalysis?.id === a.id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'bg-background/50 hover:bg-background border border-transparent hover:border-border'
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${
                          a.decision === 'BUY'
                            ? 'bg-primary/20 text-primary'
                            : a.decision === 'SELL'
                            ? 'bg-secondary/20 text-secondary'
                            : 'bg-muted/20 text-muted'
                        }`}>
                          {a.symbol?.slice(0, 2) || 'NA'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-lg">{a.symbol}</span>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                              a.decision === 'BUY'
                                ? 'bg-primary/20 text-primary'
                                : a.decision === 'SELL'
                                ? 'bg-secondary/20 text-secondary'
                                : 'bg-muted/20 text-muted'
                            }`}>
                              {getDecisionIcon(a.decision)}
                              {a.decision || a.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(a.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted group-hover:text-white transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Analysis Result */}
        <div>
          <div className="card sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-white">Analysis Result</h3>
            </div>

            {selectedAnalysis ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-background">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                      selectedAnalysis.decision === 'BUY'
                        ? 'bg-primary/20 text-primary'
                        : selectedAnalysis.decision === 'SELL'
                        ? 'bg-secondary/20 text-secondary'
                        : 'bg-muted/20 text-muted'
                    }`}>
                      {selectedAnalysis.symbol?.slice(0, 2) || 'NA'}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-lg">{selectedAnalysis.symbol}</p>
                      <p className="text-xs text-muted">{selectedAnalysis.decision || selectedAnalysis.status}</p>
                    </div>
                  </div>
                  <div className={`text-center py-3 rounded-lg ${
                    selectedAnalysis.decision === 'BUY'
                      ? 'bg-primary/10 text-primary'
                      : selectedAnalysis.decision === 'SELL'
                      ? 'bg-secondary/10 text-secondary'
                      : 'bg-muted/10 text-muted'
                  }`}>
                    <p className="text-xs text-muted mb-1">Recommendation</p>
                    <p className="text-2xl font-bold">{selectedAnalysis.decision || 'PROCESSING'}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-background/50 border border-border">
                  <p className="text-xs text-muted mb-2">Analysis Details</p>
                  <div className="space-y-2 text-sm text-gray-300 whitespace-pre-wrap">
                    {selectedAnalysis.result || 'Analysis in progress...'}
                  </div>
                </div>

                <button className="btn-outline w-full flex items-center justify-center gap-2">
                  View Full Report
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-6 h-6 text-accent" />
                </div>
                <p className="text-sm text-muted">
                  Select an analysis from the history to view results
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}