import { useState } from "react";
import { Link } from "react-router-dom";
import {
  calculateChiSquare,
  calculateDependency,
  type ChiSquareResult,
  type DependencyResult,
} from "../utils/statistics";
import { RngInput } from "../components/RngInput";

export function TestRandomNumbersPage() {
  const [method, setMethod] = useState<"chi" | "dep">("chi");
  const [inputNumbers, setInputNumbers] = useState<string>("");

  // Inputs as strings to allow empty defaults
  const [kStr, setKStr] = useState<string>("");
  // lagStr was removed as we now auto-calculate generic lags for the whole range
  const [alphaStr, setAlphaStr] = useState<string>("");

  const [eduMode, setEduMode] = useState<boolean>(false);

  const [chiResult, setChiResult] = useState<ChiSquareResult | null>(null);
  const [depResult, setDepResult] = useState<DependencyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<number | null>(null);

  const handleRun = () => {
    setError(null);
    setChiResult(null);
    setDepResult(null);
    setSelectedInterval(null);

    // Handle "0" strings correctly. filter(Boolean) removes "0".
    const numbers = inputNumbers
      .split(/[\s,]+/)
      .filter((s) => s.trim() !== "")
      .map(Number);

    if (numbers.length === 0) {
      setError("Please enter at least one number.");
      return;
    }
    if (numbers.some((n) => isNaN(n) || n < 0 || n > 1)) {
      // Note: strict 0-1, but usually 1 is excluded from generator. If user includes 1, it might break logic?
      // Logic handles <= end for last bucket.
      setError("All numbers must be between 0 and 1. Check for NaNs.");
      return;
    }

    // Parse and validate Alpha
    let alpha = 0.05; // Default if not provided

    if (!alphaStr) {
      // If alpha is not provided, use default 0.05
      alpha = 0.05;
    } else {
      alpha = parseFloat(alphaStr);
      if (isNaN(alpha) || alpha <= 0 || alpha >= 1) {
        setError("Alpha must be between 0 and 1 (exclusive).");
        return;
      }
    }

    if (method === "chi") {
      if (!kStr) {
        setError("Please enter the number of Intervals (k).");
        return;
      }
      const k = parseInt(kStr, 10);
      if (isNaN(k) || k < 1) {
        setError("Number of intervals (k) must be at least 1.");
        return;
      }
      try {
        const res = calculateChiSquare(numbers, k, alpha);
        setChiResult(res);
      } catch {
        setError("Calculation Error");
      }
    } else {
      // Dependency Test (Multi-Lag)
      try {
        const res = calculateDependency(numbers, alpha);
        setDepResult(res);
      } catch {
        setError("Calculation Error");
      }
    }
  };

  const handleReset = () => {
    setInputNumbers("");
    setChiResult(null);
    setDepResult(null);
    setError(null);
    setSelectedInterval(null);
    // Optional: Reset params too? Or keep them? Usually reset clears everything.
    setKStr("");
    // setLagStr removed
    setAlphaStr("");
  };

  // Helper to get numbers in a specific interval for display
  const getNumbersInInterval = (
    start: number,
    end: number,
    isLast: boolean
  ) => {
    const numbers = inputNumbers
      .split(/[\s,]+/)
      .filter((s) => s.trim() !== "")
      .map(Number);
    return numbers.filter((n) => n >= start && (isLast ? n <= end : n < end));
  };

  // Pre-calculate count for hint
  const count = inputNumbers
    .split(/[\s,]+/)
    .filter((s) => s.trim() !== "").length;

  return (
    <main className="page detail">
      <Link to="/" className="back-link">
        ← Back to home
      </Link>

      <div className="header-section">
        <h1>Test Random Numbers</h1>
        <p className="subtitle">
          Verify the quality of your random number generator using statistical
          methods.
        </p>

        <div className="tabs">
          <button
            className={`tab ${method === "chi" ? "active" : ""}`}
            onClick={() => {
              setMethod("chi");
              setChiResult(null);
              setDepResult(null);
              setSelectedInterval(null);
            }}
          >
            Uniformity (Chi-Square)
          </button>
          <button
            className={`tab ${method === "dep" ? "active" : ""}`}
            onClick={() => {
              setMethod("dep");
              setChiResult(null);
              setDepResult(null);
              setSelectedInterval(null);
            }}
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
                onChange={(e) => setEduMode(e.target.checked)}
              />
              <span className="slider">Exam Mode</span>
            </label>
          </div>

          <RngInput
            label="Random Numbers (0-1)"
            value={inputNumbers}
            onChange={setInputNumbers}
            scale={1}
            defaultCount={10}
          />
          <div className="field-hint">{count} numbers entered</div>

          <div className="params-row">
            {method === "chi" ? (
              <div className="control-group">
                <label>Intervals (k)</label>
                <input
                  type="number"
                  value={kStr}
                  onChange={(e) => setKStr(e.target.value)}
                  min={1}
                  placeholder="e.g. 5"
                />
              </div>
            ) : null
            /* method === 'dep' -> No specific inputs (Lag/Alpha ignored/hidden for this visual test) */
            }

            {/* Show Alpha input for BOTH now */}
            <div className="control-group">
              <label>Alpha (α)</label>
              <input
                type="number"
                value={alphaStr}
                onChange={(e) => setAlphaStr(e.target.value)}
                step={0.01}
                placeholder="Default: 0.05"
              />
            </div>
          </div>

          <div className="actions">
            <button className="primary-btn" onClick={handleRun}>
              Run Analysis
            </button>
            <button className="secondary-btn" onClick={handleReset}>
              Reset
            </button>
          </div>

          {error && <div className="alert error">{error}</div>}
        </aside>

        {/* RESULTS PANEL */}
        <div className="results-panel">
          {!chiResult && !depResult && (
            <div className="placeholder-state">
              <div className="placeholder-icon">📊</div>
              <h3>Ready to Analyze</h3>
              <p>
                Enter your random numbers on the left and click "Run Analysis"
                to see the results here.
              </p>
            </div>
          )}

          {/* CHI SQUARE RESULTS */}
          {chiResult && (
            <div className="result-with-aside">
              <div className="result-content-main">
                <div
                  className={`result-banner ${
                    chiResult.isUniform ? "success" : "failure"
                  }`}
                >
                  <div className="banner-icon">
                    {chiResult.isUniform ? "✅" : "❌"}
                  </div>
                  <div className="banner-content">
                    <h3>
                      {chiResult.isUniform
                        ? "Hypothesis Accepted"
                        : "Hypothesis Rejected"}
                    </h3>
                    <p>
                      {chiResult.isUniform
                        ? "The numbers are Uniformly Distributed."
                        : "The numbers are NOT Uniformly Distributed."}
                    </p>
                  </div>
                </div>

                {eduMode && (
                  <div className="edu-card">
                    <h4>🎓 Exam Explanation</h4>
                    <p>
                      <strong>Hypothesis:</strong> H₀: Uniform Distribution. H₁:
                      Not Uniform.
                      <br />
                      <strong>Calculations:</strong> With{" "}
                      <em>N={chiResult.N}</em> and <em>k={chiResult.k}</em>, we
                      calculated χ²₀ = {chiResult.chiStat.toFixed(4)}.<br />
                      <strong>Decision:</strong> The critical values for α=
                      {chiResult.alpha} and df={chiResult.dof} is{" "}
                      {chiResult.criticalValue.toFixed(3)}.<br />
                      Since {chiResult.chiStat.toFixed(4)}{" "}
                      {chiResult.isUniform ? "<" : ">"}{" "}
                      {chiResult.criticalValue.toFixed(3)}, we{" "}
                      {chiResult.isUniform ? "Fail to Reject" : "Reject"} H₀.
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
                    <div className="value">
                      {chiResult.criticalValue.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="table-card">
                  <h3>Interval Breakdown (Click row to see numbers)</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Range [Start, End)</th>
                          <th>Observed (O)</th>
                          <th>Expected (E)</th>
                          <th>(O-E)²/E</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chiResult.intervals.map((row, i) => {
                          const isLast = i === chiResult.intervals.length - 1;
                          const rangeLabel = isLast
                            ? `[${row.start.toFixed(2)}, ${row.end.toFixed(2)}]`
                            : `[${row.start.toFixed(2)}, ${row.end.toFixed(
                                2
                              )})`;

                          return (
                            <tr
                              key={i}
                              onClick={() => setSelectedInterval(i)}
                              className={
                                selectedInterval === i
                                  ? "selected-row"
                                  : "clickable-row"
                              }
                            >
                              <td>{rangeLabel}</td>
                              <td>{row.oi}</td>
                              <td>{row.ei.toFixed(2)}</td>
                              <td>{row.chiPart.toFixed(4)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {selectedInterval !== null && (
                    <div className="interval-details">
                      <h4>Numbers in Interval {selectedInterval + 1}</h4>
                      <div className="number-list">
                        {getNumbersInInterval(
                          chiResult.intervals[selectedInterval].start,
                          chiResult.intervals[selectedInterval].end,
                          selectedInterval === chiResult.intervals.length - 1
                        ).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside className="result-aside">
                <div className="reference-card">
                  <h4>Reference Table</h4>
                  <img
                    src="/assets/chi_square_table.png"
                    alt="Chi-Square Table"
                    className="ref-img"
                  />
                </div>
              </aside>
            </div>
          )}

          {/* DEPENDENCY RESULTS */}
          {depResult && (
            <>
              {eduMode && (
                <div className="edu-card">
                  <h4>🎓 Exam Procedure</h4>
                  <p>
                    <strong>Method:</strong> Z-Test for Auto-Correlation.
                    <br />
                    <strong>Formula:</strong> Z = r_xx(k) / σ where σ ≈ 1/√N
                    <br />
                    <strong>Calculations:</strong> N={depResult.N}, SE=
                    {(1 / Math.sqrt(depResult.N)).toFixed(4)}.<br />
                    <strong>Critical Value:</strong> Z({depResult.alpha}) =
                    &plusmn;{depResult.zCritical.toFixed(4)}.<br />
                    If any |Z| &gt; {depResult.zCritical.toFixed(4)}, the
                    hypothesis of independence is rejected.
                  </p>
                </div>
              )}

              <div className="table-card">
                <h3>Auto-Correlation Table</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Lag (k)</th>
                        <th>Correlation r_xx(k)</th>
                        <th>Z-Statistic</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depResult.correlations.map((row) => (
                        <tr
                          key={row.k}
                          className={row.isSignificant ? "row-failure" : ""}
                        >
                          <td>{row.k}</td>
                          <td>{row.value.toFixed(6)}</td>
                          <td>{row.zStatistic.toFixed(4)}</td>
                          <td>
                            {row.isSignificant ? (
                              <span className="badge error">Dependent</span>
                            ) : (
                              <span className="badge success">Independent</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="result-inference-box">
                <div className="result-metrics">
                  <div className="metric">
                    Avg(|r_xx(k)|) ={" "}
                    <strong>{depResult.avgAbsCorrelation.toFixed(6)}</strong>
                  </div>
                  <div className="metric">
                    Z<sub>critical</sub> ={" "}
                    <strong>{depResult.zCritical.toFixed(4)}</strong>
                  </div>
                </div>

                {!depResult.isIndependent ? (
                  <div className="result-status-box failure">
                    <span className="status-icon">⚠️</span>
                    <div>
                      <strong>DEPENDENT</strong>
                      <div className="micro-text">
                        One or more lags exceeded Z-critical.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="result-status-box success">
                    <span className="status-icon">✅</span>
                    <div>
                      <strong>INDEPENDENT</strong>
                      <div className="micro-text">
                        All lags within Z-critical range.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="result-message-simple">
                {depResult.isIndependent
                  ? "You can indicate independence"
                  : "You can indicate dependence"}
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
        
        /* INTERACTIVE TABLE */
        .clickable-row {
            cursor: pointer;
            transition: background 0.2s;
        }
        .clickable-row:hover {
            background: #f1f5f9;
        }
        .selected-row {
            background: #e0e7ff !important; /* Indigo 100 */
        }
        .interval-details {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        .interval-details h4 {
            margin: 0 0 12px 0;
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
        }
        .number-list {
            font-family: 'Fira Code', monospace;
            font-size: 13px;
            line-height: 1.6;
            color: #334155;
            word-break: break-all;
        }
        .result-metrics {
            display: flex;
            gap: 24px;
            margin-bottom: 16px;
        }
        .metric {
            font-size: 16px;
            color: #475569;
        }
        .result-message-simple {
            margin-top: 12px;
            font-size: 18px;
            font-weight: 700;
            text-align: center;
            color: #334155;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge.success { background: #dcfce7; color: #166534; }
        .badge.error { background: #fee2e2; color: #991b1b; }
        .row-failure td {
            background-color: #fef2f2;
            color: #991b1b;
        }
        .micro-text { font-size: 12px; font-weight: normal; opacity: 0.8; }

        .result-with-aside {
            display: flex;
            gap: 24px;
            align-items: flex-start;
        }
        .result-content-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }
        .result-aside {
            width: 450px;
            position: sticky;
            top: 24px;
        }
        .reference-card {
            background: white;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .reference-card h4 {
            margin: 0 0 12px 0;
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .ref-img {
            width: 100%;
            height: auto;
            border-radius: 4px;
        }
        
        @media (max-width: 1200px) {
            .result-with-aside {
                flex-direction: column;
            }
            .result-aside {
                width: 100%;
                position: static;
            }
        }
      `}</style>
    </main>
  );
}
