import { useState } from 'react'
import { Link } from 'react-router-dom'
import { calculateChiSquare, calculateDependency, type ChiSquareResult, type DependencyResult } from '../utils/statistics'

export function TestRandomNumbersPage() {
  const [method, setMethod] = useState<'chi' | 'dep'>('chi')
  const [inputNumbers, setInputNumbers] = useState<string>('')
  const [k, setK] = useState<number>(5)
  const [lag, setLag] = useState<number>(1)
  const [alpha, setAlpha] = useState<number>(0.05)
  const [eduMode, setEduMode] = useState<boolean>(false)

  const [chiResult, setChiResult] = useState<ChiSquareResult | null>(null)
  const [depResult, setDepResult] = useState<DependencyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRun = () => {
    setError(null)
    setChiResult(null)
    setDepResult(null)

    const numbers = inputNumbers
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)

    if (numbers.length === 0) {
      setError('Please enter at least one number.')
      return
    }
    if (numbers.some(n => isNaN(n) || n < 0 || n >= 1)) {
      setError('All numbers must be between 0 and 1. Check for NaNs.')
      return
    }

    if (method === 'chi') {
      if (k < 1) {
        setError('Number of intervals (k) must be at least 1.')
        return
      }
      try {
        const res = calculateChiSquare(numbers, k, alpha)
        setChiResult(res)
      } catch (e) {
        setError('Calculation Error')
      }
    } else {
      if (lag < 1 || lag >= numbers.length) {
        setError('Lag must be >= 1 and less than total numbers.')
        return
      }
      try {
        const res = calculateDependency(numbers, lag, alpha)
        setDepResult(res)
      } catch (e) {
        setError('Calculation Error')
      }
    }
  }

  const handleReset = () => {
    setInputNumbers('')
    setChiResult(null)
    setDepResult(null)
    setError(null)
  }

  // Pre-calculate count for hint
  const count = inputNumbers.split(/[\s,]+/).filter(Boolean).length

  return (
    <main className="page detail">
      <Link to="/" className="back-link">← Back to home</Link>

      <div className="header-section">
        <h1>Test Random Numbers</h1>
        <p className="subtitle">Verify the quality of your random number generator using statistical methods.</p>

        <div className="tabs">
          <button
            className={`tab ${method === 'chi' ? 'active' : ''}`}
            onClick={() => { setMethod('chi'); setChiResult(null); setDepResult(null); }}
          >
            Uniformity (Chi-Square)
          </button>
          <button
            className={`tab ${method === 'dep' ? 'active' : ''}`}
            onClick={() => { setMethod('dep'); setChiResult(null); setDepResult(null); }}
          >
            Independence (Auto-Correlation)
          </button>
        </div>
      </div>

      <div className="layout-split">
        {/* INPUTS PANEL */}
        <aside className="panel input-panel">
          <div className="panel-header-simple">
            <h2>Configuration</h2>
            <label className="toggle-switch small">
              <input
                type="checkbox"
                checked={eduMode}
                onChange={e => setEduMode(e.target.checked)}
              />
              <span className="slider">Exam Mode</span>
            </label>
          </div>

          <div className="control-group">
            <label>Random Numbers (0-1)</label>
            <textarea
              className="code-input"
              value={inputNumbers}
              onChange={e => setInputNumbers(e.target.value)}
              placeholder="0.12, 0.45, 0.88..."
              rows={12}
            />
            <div className="field-hint">{count} numbers entered</div>
          </div>

          <div className="params-row">
            {method === 'chi' ? (
              <div className="control-group">
                <label>Intervals (k)</label>
                <input type="number" value={k} onChange={e => setK(Number(e.target.value))} min={1} />
              </div>
            ) : (
              <div className="control-group">
                <label>Lag</label>
                <input type="number" value={lag} onChange={e => setLag(Number(e.target.value))} min={1} />
              </div>
            )}
            <div className="control-group">
              <label>Alpha (α)</label>
              <input type="number" value={alpha} onChange={e => setAlpha(Number(e.target.value))} step={0.01} />
            </div>
          </div>

          <div className="actions">
            <button className="primary-btn" onClick={handleRun}>Run Analysis</button>
            <button className="secondary-btn" onClick={handleReset}>Reset</button>
          </div>

          {error && <div className="alert error">{error}</div>}
        </aside>

        {/* RESULTS PANEL */}
        <div className="results-panel">

          {!chiResult && !depResult && (
            <div className="placeholder-state">
              <div className="placeholder-icon">📊</div>
              <h3>Ready to Analyze</h3>
              <p>Enter your random numbers on the left and click "Run Analysis" to see the results here.</p>
            </div>
          )}

          {/* CHI SQUARE RESULTS */}
          {chiResult && (
            <>
              <div className={`result-banner ${chiResult.isUniform ? 'success' : 'failure'}`}>
                <div className="banner-icon">{chiResult.isUniform ? '✅' : '❌'}</div>
                <div className="banner-content">
                  <h3>{chiResult.isUniform ? 'Hypothesis Accepted' : 'Hypothesis Rejected'}</h3>
                  <p>{chiResult.isUniform ? 'The numbers are Uniformly Distributed.' : 'The numbers are NOT Uniformly Distributed.'}</p>
                </div>
              </div>

              {eduMode && (
                <div className="edu-card">
                  <h4>🎓 Exam Explanation</h4>
                  <p>
                    <strong>Hypothesis:</strong> H₀: Uniform Distribution. H₁: Not Uniform.<br />
                    <strong>Calculations:</strong> With <em>N={chiResult.N}</em> and <em>k={k}</em>, we calculated χ²₀ = {chiResult.chiStat.toFixed(4)}.<br />
                    <strong>Decision:</strong> The critical values for α={alpha} and df={chiResult.dof} is {chiResult.criticalValue.toFixed(3)}.<br />
                    Since {chiResult.chiStat.toFixed(4)} {chiResult.isUniform ? '<' : '>'} {chiResult.criticalValue.toFixed(3)}, we {chiResult.isUniform ? 'Fail to Reject' : 'Reject'} H₀.
                  </p>
                </div>
              )}

              <div className="stats-grid">
                <div className="stat-box">
                  <label>Calculated χ²</label>
                  <div className="value">{chiResult.chiStat.toFixed(4)}</div>
                </div>
                <div className="stat-box">
                  <label>Critical Value</label>
                  <div className="value">{chiResult.criticalValue.toFixed(4)}</div>
                </div>
                <div className="stat-box">
                  <label>P-Value (Approx)</label>
                  <div className="value muted">N/A</div>
                </div>
              </div>

              <div className="table-card">
                <h3>Interval Breakdown</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Range</th>
                        <th>Observed (O)</th>
                        <th>Expected (E)</th>
                        <th>(O-E)²/E</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chiResult.intervals.map((row, i) => (
                        <tr key={i}>
                          <td>{row.start.toFixed(2)} - {row.end.toFixed(2)}</td>
                          <td>{row.oi}</td>
                          <td>{row.ei.toFixed(2)}</td>
                          <td>{row.chiPart.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* DEPENDENCY RESULTS */}
          {depResult && (
            <>
              <div className={`result-banner ${depResult.isIndependent ? 'success' : 'failure'}`}>
                <div className="banner-icon">{depResult.isIndependent ? '✅' : '❌'}</div>
                <div className="banner-content">
                  <h3>{depResult.isIndependent ? 'Hypothesis Accepted' : 'Hypothesis Rejected'}</h3>
                  <p>{depResult.isIndependent ? 'The numbers are Independent.' : 'The numbers are Dependent (Correleated).'}</p>
                </div>
              </div>

              {eduMode && (
                <div className="edu-card">
                  <h4>🎓 Exam Explanation</h4>
                  <p>
                    <strong>Hypothesis:</strong> H₀: Numbers are Independent.<br />
                    <strong>Calculations:</strong> Checked autocorrelation at lag {lag}. Calculated Z₀ = {depResult.zStat.toFixed(4)}.<br />
                    <strong>Decision:</strong> Critical Z for α={alpha} is {depResult.criticalValue}.<br />
                    Since |{depResult.zStat.toFixed(4)}| {depResult.isIndependent ? '≤' : '>'} {depResult.criticalValue}, we {depResult.isIndependent ? 'Accept' : 'Reject'} H₀.
                  </p>
                </div>
              )}

              <div className="stats-grid">
                <div className="stat-box">
                  <label>Calculated Z₀</label>
                  <div className="value">{depResult.zStat.toFixed(4)}</div>
                </div>
                <div className="stat-box">
                  <label>Critical Z</label>
                  <div className="value">±{depResult.criticalValue.toFixed(3)}</div>
                </div>
                <div className="stat-box">
                  <label>Autocorrelation (ρ̂)</label>
                  <div className="value">{depResult.correlation.toFixed(4)}</div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      <style>{`
        .header-section {
           margin-bottom: 32px;
        }
        .header-section h1 {
           margin-bottom: 8px;
        }
        .subtitle {
           color: #64748b;
           margin-bottom: 24px;
        }
        
        /* TABS */
        .tabs {
           display: flex;
           gap: 4px;
           border-bottom: 2px solid #e2e8f0;
        }
        .tab {
           background: transparent;
           border: none;
           padding: 12px 24px;
           font-size: 16px;
           font-weight: 600;
           color: #64748b;
           cursor: pointer;
           border-bottom: 2px solid transparent;
           margin-bottom: -2px;
           transition: all 0.2s;
        }
        .tab:hover {
           color: #4338ca;
        }
        .tab.active {
           color: #4338ca;
           border-bottom-color: #4338ca;
        }
        
        /* LAYOUT */
        .layout-split {
           display: grid;
           grid-template-columns: 320px 1fr;
           gap: 32px;
           align-items: start;
        }
        
        /* INPUT PANEL */
        .input-panel {
           background: #fff;
           padding: 24px;
           border-radius: 12px;
           box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
           border: 1px solid #e2e8f0;
        }
        .panel-header-simple {
           display: flex;
           justify-content: space-between;
           align-items: center;
           margin-bottom: 20px;
        }
        .panel-header-simple h2 {
           font-size: 18px;
           margin: 0;
           color: #0f172a;
        }
        .code-input {
           font-family: 'Fira Code', monospace;
           font-size: 14px;
           padding: 12px;
           background: #f8fafc;
           border: 1px solid #cbd5e1;
           border-radius: 8px;
           width: 100%;
           resize: vertical;
        }
        .code-input:focus {
           outline: none;
           border-color: #4338ca;
           box-shadow: 0 0 0 3px rgba(67, 56, 202, 0.1);
        }
        .field-hint {
           font-size: 12px;
           color: #64748b;
           text-align: right;
           margin-top: 4px;
        }
        .params-row {
           display: grid;
           grid-template-columns: 1fr 1fr;
           gap: 12px;
        }
        .primary-btn {
           width: 100%;
           background: #4338ca;
           color: white;
           padding: 12px;
           border-radius: 8px;
           font-weight: 600;
           border: none;
           cursor: pointer;
           transition: background 0.2s;
        }
        .primary-btn:hover { background: #3730a3; }
        .secondary-btn {
           width: 100%;
           background: transparent;
           color: #64748b;
           padding: 12px;
           border: 1px solid #cbd5e1;
           border-radius: 8px;
           font-weight: 600;
           cursor: pointer;
        }
        .secondary-btn:hover { background: #f1f5f9; color: #0f172a; }
        
        /* RESULTS PANEL */
        .results-panel {
           display: flex;
           flex-direction: column;
           gap: 24px;
        }
        .placeholder-state {
           text-align: center;
           padding: 64px;
           background: #f8fafc;
           border-radius: 12px;
           border: 2px dashed #e2e8f0;
           color: #64748b;
        }
        .placeholder-icon {
           font-size: 48px;
           margin-bottom: 16px;
        }
        
        /* RESULT BANNER */
        .result-banner {
           display: flex;
           gap: 16px;
           padding: 24px;
           border-radius: 12px;
           color: #fff;
           align-items: flex-start;
           box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .result-banner.success {
           background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        .result-banner.failure {
           background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        .banner-icon { font-size: 32px; }
        .banner-content h3 { margin: 0 0 4px 0; font-size: 20px; }
        .banner-content p { margin: 0; opacity: 0.9; }
        
        /* EDU CARD */
        .edu-card {
           background: #eff6ff;
           border: 1px solid #bfdbfe;
           padding: 20px;
           border-radius: 8px;
           color: #1e3a8a;
        }
        .edu-card h4 { margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #3b82f6; }
        
        /* STATS GRID */
        .stats-grid {
           display: grid;
           grid-template-columns: repeat(3, 1fr);
           gap: 16px;
        }
        .stat-box {
           background: white;
           padding: 16px;
           border-radius: 12px;
           border: 1px solid #e2e8f0;
           box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .stat-box label { display: block; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
        .stat-box .value { font-size: 24px; font-weight: 700; color: #0f172a; }
        .stat-box .value.muted { color: #cbd5e1; }
        
        /* TABLE */
        .table-card {
           background: white;
           padding: 20px;
           border-radius: 12px;
           border: 1px solid #e2e8f0;
           box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .table-card h3 { margin: 0 0 16px 0; font-size: 16px; }
        .table-wrapper { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; padding: 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
        tr:last-child td { border-bottom: none; }
        
        @media (max-width: 900px) {
           .layout-split { grid-template-columns: 1fr; }
           .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  )
}
