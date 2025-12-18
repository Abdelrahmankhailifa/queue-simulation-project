import { useState } from 'react'
import { middleSquare, lcg, normalizeValues } from '../utils/rng'

type RngMode = 'manual' | 'midsquare' | 'lcg'

interface RngInputProps {
    label: string
    value: string
    onChange: (val: string) => void
    scale?: number // Target scale, e.g. 100 for 1-100
    defaultCount?: number
}

export function RngInput({ label, value, onChange, scale = 100, defaultCount = 10 }: RngInputProps) {
    const [mode, setMode] = useState<RngMode>('manual')

    // Mid Square Params
    const [seed, setSeed] = useState<string>('1234')
    const [msCount, setMsCount] = useState<string>(defaultCount.toString())

    // LCG Params
    const [z0, setZ0] = useState<string>('27')
    const [a, setA] = useState<string>('17')
    const [c, setC] = useState<string>('43')
    const [m, setM] = useState<string>('100')
    const [lcgCount, setLcgCount] = useState<string>(defaultCount.toString())

    const [genError, setGenError] = useState<string | null>(null)

    const handleManualChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value)
    }

    const generate = () => {
        setGenError(null)
        try {
            let rawNumbers: number[] = []
            let sourceMax = 1

            if (mode === 'midsquare') {
                const s = parseInt(seed, 10)
                const cnt = parseInt(msCount, 10)
                if (isNaN(s)) throw new Error('Invalid Seed')
                if (isNaN(cnt) || cnt <= 0) throw new Error('Invalid Count')

                // Assume 4 digits for simplicity unless seed is larger
                const digits = Math.max(4, seed.length)
                sourceMax = Math.pow(10, digits)

                const res = middleSquare(s, cnt, digits)
                if (res.error) throw new Error(res.error)
                rawNumbers = res.numbers
            }
            else if (mode === 'lcg') {
                const z = parseInt(z0, 10)
                const mul = parseInt(a, 10)
                const inc = parseInt(c, 10)
                const mod = parseInt(m, 10)
                const cnt = parseInt(lcgCount, 10)

                if (isNaN(z) || isNaN(mul) || isNaN(inc) || isNaN(mod) || isNaN(cnt)) {
                    throw new Error('All LCG parameters must be numbers')
                }
                if (mod <= 0) throw new Error('Modulus m must be > 0')

                sourceMax = mod
                const res = lcg(z, mul, inc, mod, cnt)
                if (res.error) throw new Error(res.error)
                rawNumbers = res.numbers
            }

            // Normalize
            const finalNumbers = normalizeValues(rawNumbers, scale, sourceMax)

            // Update parent
            onChange(finalNumbers.join(', '))

            // Switch to manual to let them see/edit? Or stay in mode?
            // Staying in mode might be confusing if they want to edit.
            // But maybe better to show "Generated!" and let them switch to manual if they want to tweak.
            // For now, we populate the value. The parent renders this component,
            // but where does the value display?
            // We should probably render the value in a textarea below the controls if not in manual mode,
            // or just have a consistent textarea at the bottom that is read-only in generator modes?
            // Actually, standard pattern: Generator fills the box, User can then edit.
            // So effectively we just push the string and maybe switch mode to manual or keep it.
            // Let's keep the mode but show the result in a textarea that is editable.

        } catch (err: any) {
            setGenError(err.message)
        }
    }

    return (
        <div className="rng-input-container">
            <label className="stacked-label">
                <span className="label-text">{label}</span>
                <div className="rng-tabs">
                    <button
                        className={`rng-tab ${mode === 'manual' ? 'active' : ''}`}
                        onClick={() => setMode('manual')}
                    >
                        Manual
                    </button>
                    <button
                        className={`rng-tab ${mode === 'midsquare' ? 'active' : ''}`}
                        onClick={() => setMode('midsquare')}
                    >
                        Middle-Square
                    </button>
                    <button
                        className={`rng-tab ${mode === 'lcg' ? 'active' : ''}`}
                        onClick={() => setMode('lcg')}
                    >
                        LCG
                    </button>
                </div>
            </label>

            {mode === 'midsquare' && (
                <div className="rng-controls">
                    <div className="control-row">
                        <label>
                            Seed
                            <input value={seed} onChange={e => setSeed(e.target.value)} placeholder="e.g. 1234" />
                        </label>
                        <label>
                            Count
                            <input type="number" value={msCount} onChange={e => setMsCount(e.target.value)} />
                        </label>
                    </div>
                    <button className="generate-btn" onClick={generate}>Generate</button>
                </div>
            )}

            {mode === 'lcg' && (
                <div className="rng-controls">
                    <div className="control-row">
                        <label>
                            Z₀ (Seed)
                            <input value={z0} onChange={e => setZ0(e.target.value)} />
                        </label>
                        <label>
                            a (Multiplier)
                            <input value={a} onChange={e => setA(e.target.value)} />
                        </label>
                        <label>
                            c (Increment)
                            <input value={c} onChange={e => setC(e.target.value)} />
                        </label>
                        <label>
                            m (Modulus)
                            <input value={m} onChange={e => setM(e.target.value)} />
                        </label>
                        <label>
                            Count
                            <input type="number" value={lcgCount} onChange={e => setLcgCount(e.target.value)} style={{ width: '60px' }} />
                        </label>
                    </div>
                    <button className="generate-btn" onClick={generate}>Generate</button>
                </div>
            )}

            {genError && <div className="rng-error">{genError}</div>}

            <textarea
                className="rng-textarea"
                value={value}
                onChange={handleManualChange}
                placeholder="Generated numbers will appear here..."
                rows={3}
            />

            <style>{`
        .rng-input-container {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .stacked-label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }
        .label-text {
          font-weight: 600;
          color: #334155;
          font-size: 14px;
        }
        .rng-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid #cbd5e1;
        }
        .rng-tab {
          background: none;
          border: none;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
          color: #64748b;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .rng-tab:hover { color: #334155; }
        .rng-tab.active {
          color: #4338ca;
          border-bottom-color: #4338ca;
          font-weight: 600;
        }
        .rng-controls {
          margin-bottom: 12px;
          background: white;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        .control-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 8px;
        }
        .control-row label {
          display: flex;
          flex-direction: column;
          font-size: 12px;
          color: #64748b;
        }
        .control-row input {
          margin-top: 4px;
          padding: 4px 8px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 13px;
          width: 80px;
        }
        .generate-btn {
          background: #4338ca;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .generate-btn:hover {
          background: #3730a3;
        }
        .rng-textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
        }
        .rng-textarea:focus {
          outline: none;
          border-color: #4338ca;
          box-shadow: 0 0 0 2px rgba(67, 56, 202, 0.1);
        }
        .rng-error {
          color: #ef4444;
          font-size: 13px;
          margin-bottom: 8px;
        }
      `}</style>
        </div>
    )
}
