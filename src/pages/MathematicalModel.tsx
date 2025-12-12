import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type Results =
  | {
      error: string
    }
  | {
      Ls: number
      Lq: number
      Ws: number
      Wq: number
      R: number
      Po: number
      Pn: number | null
    }

export function MathematicalModelPage() {
  const [lambda, setLambda] = useState('')
  const [mu, setMu] = useState('')
  const [nCustomers, setNCustomers] = useState('')

  const results = useMemo((): Results | null => {
    const λ = Number(lambda)
    const μ = Number(mu)
    const n = Number(nCustomers) || 0

    if (!lambda || !mu || !Number.isFinite(λ) || !Number.isFinite(μ) || μ <= 0) {
      return null
    }

    if (λ >= μ) {
      return { error: 'Lambda (λ) must be less than Mu (μ) for stable system' }
    }

    // Calculate all measures
    const Ls = λ / (μ - λ) // Expected number of customers in the system
    const Lq = (λ * λ) / (μ * (μ - λ)) // Expected number of customers in the queue
    const Ws = 1 / (μ - λ) // Expected time spent in the system
    const Wq = λ / (μ * (μ - λ)) // Expected time spent in the queue
    const R = (λ / μ) * 100 // Server utilization (%)
    const Po = 100 - R // Probability of having no customer in the system (%)
    const Pn = Number.isFinite(n) && n >= 0 ? Math.pow(R / 100, n) * (1 - R / 100) : null // Probability of having n customers

    return {
      Ls,
      Lq,
      Ws,
      Wq,
      R,
      Po,
      Pn,
    }
  }, [lambda, mu, nCustomers])

  return (
    <main className="page detail">
      <Link to="/" className="back-link">
        ← Back to home
      </Link>
      <h1>Mathematical Model - System Measures of Performance</h1>
      <p className="detail-body">
        Enter the arrival rate (λ) and service rate (μ) to calculate queueing theory performance
        measures.
      </p>

      <section className="panel">
        <div className="panel-header">
          <h2>Inputs</h2>
        </div>

        <div className="input-grid slim">
          <label className="stacked">
            <span>Lambda (λ) - Arrival Rate</span>
            <input
              type="text"
              value={lambda}
              onChange={(e) => setLambda(e.target.value)}
              placeholder="e.g., 0.5"
            />
          </label>
          <label className="stacked">
            <span>Mu (μ) - Service Rate</span>
            <input
              type="text"
              value={mu}
              onChange={(e) => setMu(e.target.value)}
              placeholder="e.g., 1.0"
            />
          </label>
          <label className="stacked">
            <span>n - Number of Customers (for Pn)</span>
            <input
              type="text"
              value={nCustomers}
              onChange={(e) => setNCustomers(e.target.value)}
              placeholder="e.g., 3"
            />
          </label>
        </div>

        {results?.error && <div className="alert error">{results.error}</div>}
      </section>

      {results && !('error' in results) && (
        <section className="panel">
          <div className="panel-header">
            <h2>System Measures of Performance</h2>
          </div>

          <div className="measures-grid">
            <div className="measure-card">
              <div className="measure-label">Ls</div>
              <div className="measure-description">Expected number of customers in the system</div>
              <div className="measure-formula">λ / (μ - λ)</div>
              <div className="measure-value">{results.Ls.toFixed(4)}</div>
            </div>

            <div className="measure-card">
              <div className="measure-label">Lq</div>
              <div className="measure-description">Expected number of customers in the queue</div>
              <div className="measure-formula">λ² / (μ(μ - λ))</div>
              <div className="measure-value">{results.Lq.toFixed(4)}</div>
            </div>

            <div className="measure-card">
              <div className="measure-label">Ws</div>
              <div className="measure-description">Expected time spent in the system</div>
              <div className="measure-formula">1 / (μ - λ)</div>
              <div className="measure-value">{results.Ws.toFixed(4)}</div>
            </div>

            <div className="measure-card">
              <div className="measure-label">Wq</div>
              <div className="measure-description">Expected time spent in the queue</div>
              <div className="measure-formula">λ / (μ(μ - λ))</div>
              <div className="measure-value">{results.Wq.toFixed(4)}</div>
            </div>

            <div className="measure-card">
              <div className="measure-label">R</div>
              <div className="measure-description">Server utilization</div>
              <div className="measure-formula">(λ / μ) × 100</div>
              <div className="measure-value">{results.R.toFixed(2)}%</div>
            </div>

            <div className="measure-card">
              <div className="measure-label">Po</div>
              <div className="measure-description">Probability of having no customer in the system</div>
              <div className="measure-formula">100 - R</div>
              <div className="measure-value">{results.Po.toFixed(2)}%</div>
            </div>

            <div className="measure-card">
              <div className="measure-label">Pn</div>
              <div className="measure-description">
                Probability of having n customers in the system
              </div>
              <div className="measure-formula">Rⁿ × (1 - R)</div>
              <div className="measure-value">
                {results.Pn !== null ? results.Pn.toFixed(6) : 'Enter n value'}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

