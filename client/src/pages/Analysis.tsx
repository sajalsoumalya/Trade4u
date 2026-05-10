import { useEffect, useState } from 'react';
import { runAnalysis, getAnalysisHistory } from '../lib/api';

export default function Analysis() {
  const [symbol, setSymbol] = useState('');
  const [running, setRunning] = useState(false);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);

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
      await runAnalysis(symbol);
      await loadHistory();
    } catch (e) {
      console.error(e);
    }
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Analysis</h1>

      {/* Run Analysis */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Run New Analysis</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="input flex-1"
            placeholder="Enter symbol (e.g., AAPL, BTC-USD)"
          />
          <button
            onClick={handleRun}
            disabled={running || !symbol}
            className="btn-primary"
          >
            {running ? 'Running...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* Analysis History */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Analysis History</h2>
        {analyses.length === 0 ? (
          <p className="text-gray-400">No analyses yet</p>
        ) : (
          <div className="space-y-2">
            {analyses.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelectedAnalysis(a)}
                className="p-3 bg-background rounded-lg cursor-pointer hover:bg-border
                  flex justify-between items-center"
              >
                <div>
                  <span className="font-medium">{a.symbol}</span>
                  <span className="text-gray-400 ml-2 text-sm">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span
                  className={`px-2 py-1 rounded text-sm ${
                    a.decision === 'BUY' ? 'bg-primary/20 text-primary' :
                    a.decision === 'SELL' ? 'bg-secondary/20 text-secondary' :
                    'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {a.decision || a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analysis Result */}
      {selectedAnalysis && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">
            Result: {selectedAnalysis.symbol}
          </h2>
          <div className="p-4 bg-background rounded-lg whitespace-pre-wrap text-sm">
            {selectedAnalysis.result || 'No result available'}
          </div>
        </div>
      )}
    </div>
  );
}