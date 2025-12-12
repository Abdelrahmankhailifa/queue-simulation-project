import { ReactNode, useState } from 'react'
import { formatDigit } from '../utils/format'

export type DistRow = { value: number; probability: number }
export type CumulativeRow = {
  value: number
  probability: number
  cumulative: number
  rangeStart: number
  rangeEnd: number
}

type Props = {
  title: string
  valueLabel: string
  rows: DistRow[]
  cumulativeRows?: CumulativeRow[]
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, key: keyof DistRow, value: number | null) => void
  actions?: ReactNode
}

export function DistributionTable({
  title,
  valueLabel,
  rows,
  cumulativeRows = [],
  onAdd,
  onRemove,
  onUpdate,
  actions,
}: Props) {
  const [valueStrings, setValueStrings] = useState<Record<number, string>>({})
  const [probStrings, setProbStrings] = useState<Record<number, string>>({})

  const parse = (val: string) => {
    if (val === '' || val === '-') return null
    const num = Number(val)
    return Number.isFinite(num) ? num : null
  }

  const getValueDisplay = (idx: number, current: number) => {
    if (idx in valueStrings) return valueStrings[idx]
    return current === 0 ? '' : String(current)
  }

  const getProbDisplay = (idx: number, current: number) => {
    if (idx in probStrings) return probStrings[idx]
    return current === 0 ? '' : String(current)
  }

  const handleValueChange = (idx: number, val: string) => {
    setValueStrings((prev) => ({ ...prev, [idx]: val }))
    const parsed = parse(val)
    if (parsed !== null || val === '') {
      onUpdate(idx, 'value', parsed)
    }
  }

  const handleProbChange = (idx: number, val: string) => {
    setProbStrings((prev) => ({ ...prev, [idx]: val }))
    // Allow typing "0." without immediately converting - only update if it's a complete number
    if (val === '' || val === '0.' || val.endsWith('.')) {
      // Don't update the number value yet, just keep the string
      return
    }
    const parsed = parse(val)
    if (parsed !== null) {
      onUpdate(idx, 'probability', parsed)
    }
  }

  const handleValueBlur = (idx: number) => {
    const val = valueStrings[idx]
    if (val !== undefined) {
      const parsed = parse(val)
      if (parsed === null && val !== '') {
        setValueStrings((prev) => {
          const next = { ...prev }
          delete next[idx]
          return next
        })
      }
    }
  }

  const handleProbBlur = (idx: number) => {
    const val = probStrings[idx]
    if (val !== undefined) {
      const parsed = parse(val)
      if (parsed !== null) {
        // Update the value on blur if it's valid
        onUpdate(idx, 'probability', parsed)
      }
      // Clean up string state if invalid or empty
      if (parsed === null && val !== '' && val !== '0.') {
        setProbStrings((prev) => {
          const next = { ...prev }
          delete next[idx]
          return next
        })
      } else if (val === '' || val === '0.') {
        // Clear the string state if empty or just "0."
        setProbStrings((prev) => {
          const next = { ...prev }
          delete next[idx]
          return next
        })
      }
    }
  }

  return (
    <div className="card-table">
      <div className="card-table-header">
        <h3>{title}</h3>
        <div className="panel-actions">
          {actions}
          <button className="ghost" onClick={onAdd}>
            + Add row
          </button>
        </div>
      </div>
      <div className="table">
        <div className="table-row table-head">
          <div>{valueLabel}</div>
          <div>Probability</div>
          <div>Cumulative Probability</div>
          <div>Random-Digit Assignment</div>
          <div />
        </div>
        {rows.map((row, idx) => {
          const cumRow = cumulativeRows[idx]
          const cumulativeText = cumRow ? cumRow.cumulative.toFixed(3) : ''
          const rangeText = cumRow
            ? `${formatDigit(cumRow.rangeStart)}-${formatDigit(cumRow.rangeEnd)}`
            : ''
          return (
            <div className="table-row" key={idx}>
              <div>
                <input
                  type="text"
                  value={getValueDisplay(idx, row.value)}
                  onChange={(e) => handleValueChange(idx, e.target.value)}
                  onBlur={() => handleValueBlur(idx)}
                />
              </div>
              <div>
                <input
                  type="text"
                  value={getProbDisplay(idx, row.probability)}
                  onChange={(e) => handleProbChange(idx, e.target.value)}
                  onBlur={() => handleProbBlur(idx)}
                />
              </div>
              <div className="muted">{cumulativeText}</div>
              <div className="muted">{rangeText}</div>
              <div>
                <button className="ghost" onClick={() => onRemove(idx)}>
                  Remove
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

