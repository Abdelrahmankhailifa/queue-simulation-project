import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DistributionTable, type CumulativeRow, type DistRow } from '../components/DistributionTable'

type SimulationRow = {
  customer: number
  randArrival: number
  interarrival: number
  arrival: number
  randService: number
  service: number
  serviceStart: number
  serviceEnd: number
  waiting: number
  idle: number
  timeInSystem: number
}

const tolerance = 0.001

function buildCumulative(dist: DistRow[]): { rows: CumulativeRow[]; error?: string } {
  if (!dist.length) {
    return { rows: [], error: 'Add at least one row' }
  }
  let sum = 0
  const rows: CumulativeRow[] = dist.map((row) => {
    sum += row.probability
    return {
      value: row.value,
      probability: row.probability,
      cumulative: sum,
      rangeStart: 0,
      rangeEnd: 0,
    }
  })

  if (Math.abs(sum - 1) > tolerance) {
    return { rows: [], error: 'Probabilities must sum to 1' }
  }

  rows.forEach((row, idx) => {
    const previousEnd = idx === 0 ? 0 : rows[idx - 1].rangeEnd
    const cumulativeScaled = Math.round(row.cumulative * 100)
    const start = previousEnd + 1
    const end = Math.min(100, cumulativeScaled)
    row.rangeStart = start
    row.rangeEnd = end
  })

  return { rows }
}

function mapRandomToValue(rand: number, ranges: CumulativeRow[]) {
  const normalized = rand === 0 ? 100 : rand
  return ranges.find((r) => normalized >= r.rangeStart && normalized <= r.rangeEnd)?.value ?? null
}

function toCsv(rows: SimulationRow[]) {
  const header = [
    'Cust #',
    'Rand Arrival',
    'Interarrival',
    'Arrival',
    'Rand Service',
    'Service',
    'Service Start',
    'Service End',
    'Waiting',
    'Idle',
    'Time in System',
  ]
  const body = rows
    .map((r) =>
      [
        r.customer,
        r.randArrival,
        r.interarrival,
        r.arrival,
        r.randService,
        r.service,
        r.serviceStart,
        r.serviceEnd,
        r.waiting,
        r.idle,
        r.timeInSystem,
      ].join(','),
    )
    .join('\n')
  return [header.join(','), body].join('\n')
}

function useDistributionState(initial: DistRow[]) {
  const [rows, setRows] = useState<DistRow[]>(
    initial.map((r) => ({ value: r.value, probability: r.probability })),
  )

  const updateRow = (index: number, key: keyof DistRow, value: number | null) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index && value !== null ? { ...row, [key]: value } : row)),
    )
  }

  const addRow = () => setRows((prev) => [...prev, { value: 0, probability: 0 }])
  const removeRow = (index: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

  return { rows, setRows, updateRow, addRow, removeRow }
}

export function SingleServerPage() {
  const arrival = useDistributionState([
    { value: 1, probability: 0.25 },
    { value: 2, probability: 0.35 },
    { value: 3, probability: 0.4 },
  ])
  const service = useDistributionState([
    { value: 2, probability: 0.3 },
    { value: 3, probability: 0.5 },
    { value: 4, probability: 0.2 },
  ])

  const [arrivalDigits, setArrivalDigits] = useState('15,64,12,87,34,56,90,10')
  const [serviceDigits, setServiceDigits] = useState('05,44,70,22,91,39,60,08')
  const [customerCount, setCustomerCount] = useState(10)

  const [arrivalTable, setArrivalTable] = useState<CumulativeRow[]>([])
  const [serviceTable, setServiceTable] = useState<CumulativeRow[]>([])
  const [simRows, setSimRows] = useState<SimulationRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const summary = useMemo(() => {
    if (!simRows.length) return null
    const totalWaiting = simRows.reduce((acc, r) => acc + r.waiting, 0)
    const totalService = simRows.reduce((acc, r) => acc + r.service, 0)
    const totalIdle = simRows.reduce((acc, r) => acc + Math.max(r.idle, 0), 0)
    const lastEnd = simRows[simRows.length - 1].serviceEnd

    return {
      avgWaiting: totalWaiting / simRows.length,
      avgService: totalService / simRows.length,
      idlePercent: lastEnd ? (totalIdle / lastEnd) * 100 : 0,
      utilization: lastEnd ? (totalService / lastEnd) * 100 : 0,
    }
  }, [simRows])

  const totals = useMemo(() => {
    if (!simRows.length) return null
    const interarrival = simRows.reduce((acc, r) => acc + r.interarrival, 0)
    const arrival = simRows[simRows.length - 1].arrival
    const service = simRows.reduce((acc, r) => acc + r.service, 0)
    const serviceStart = '' // not summed in the reference table
    const serviceEnd = '' // not summed in the reference table
    const waiting = simRows.reduce((acc, r) => acc + r.waiting, 0)
    const timeInSystem = simRows.reduce((acc, r) => acc + r.timeInSystem, 0)
    const idle = simRows.reduce((acc, r) => acc + r.idle, 0)
    return {
      interarrival,
      arrival,
      service,
      serviceStart,
      serviceEnd,
      waiting,
      timeInSystem,
      idle,
    }
  }, [simRows])

  const parseDigits = (value: string) =>
    value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((d) => Number(d))
      .map((d) => (d === 0 ? 100 : d))
      .filter((d) => Number.isFinite(d))

  const handleGenerateTables = () => {
    const arrivalRes = buildCumulative(arrival.rows)
    const serviceRes = buildCumulative(service.rows)
    if (arrivalRes.error) {
      setError(`Arrival: ${arrivalRes.error}`)
      setArrivalTable([])
      setServiceTable([])
      return
    }
    if (serviceRes.error) {
      setError(`Service: ${serviceRes.error}`)
      setArrivalTable([])
      setServiceTable([])
      return
    }
    setError(null)
    setArrivalTable(arrivalRes.rows)
    setServiceTable(serviceRes.rows)
  }

  const runSimulation = () => {
    const count = Number.isFinite(customerCount) ? Math.floor(customerCount) : 0
    if (count < 1) {
      setError('Number of customers must be at least 1')
      return
    }
    const arrivalRes = buildCumulative(arrival.rows)
    const serviceRes = buildCumulative(service.rows)
    if (arrivalRes.error) {
      setError(`Arrival: ${arrivalRes.error}`)
      return
    }
    if (serviceRes.error) {
      setError(`Service: ${serviceRes.error}`)
      return
    }
    const arrivalNums = parseDigits(arrivalDigits)
    const serviceNums = parseDigits(serviceDigits)

    if (arrivalNums.length < count - 1) {
      setError('Not enough arrival random digits for the requested customers')
      return
    }
    if (serviceNums.length < count) {
      setError('Not enough service random digits for the requested customers')
      return
    }
    if ([...arrivalNums, ...serviceNums].some((d) => d < 1 || d > 100)) {
      setError('Random digits must be between 01 and 00 (i.e., 1 to 100)')
      return
    }

    const table: SimulationRow[] = []

    for (let i = 0; i < count; i++) {
      const customer = i + 1
      const randArrival = i === 0 ? 0 : arrivalNums[i - 1]
      const randService = serviceNums[i]

      const interarrival = i === 0 ? 0 : mapRandomToValue(randArrival, arrivalRes.rows)
      const serviceTime = mapRandomToValue(randService, serviceRes.rows)

      if (interarrival === null || serviceTime === null) {
        setError('Random digit could not be mapped to a time. Check tables.')
        return
      }

      const arrivalTime = i === 0 ? 0 : table[i - 1].arrival + interarrival
      const previousServiceEnd = i === 0 ? 0 : table[i - 1].serviceEnd
      const serviceStart = Math.max(arrivalTime, previousServiceEnd)
      const waiting = serviceStart - arrivalTime
      const idle = serviceStart - previousServiceEnd
      const serviceEnd = serviceStart + serviceTime
      const timeInSystem = waiting + serviceTime

      table.push({
        customer,
        randArrival,
        interarrival,
        arrival: arrivalTime,
        randService,
        service: serviceTime,
        serviceStart,
        serviceEnd,
        waiting,
        idle,
        timeInSystem,
      })
    }

    setError(null)
    setArrivalTable(arrivalRes.rows)
    setServiceTable(serviceRes.rows)
    setSimRows(table)
  }

  const handleDownload = () => {
    if (!simRows.length) return
    const blob = new Blob([toCsv(simRows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'single-server-simulation.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page detail">
      <Link to="/" className="back-link">
        ← Back to home
      </Link>
      <h1>Single-Server Queue Simulation</h1>
      <p className="detail-body">
        Configure arrival and service distributions, provide random digits, and run a discrete-event
        simulation for the single-server checkout scenario.
      </p>

      <section className="panel">
        <div className="panel-header">
          <h2>Inputs</h2>
          <div className="panel-actions">
            <button className="secondary" onClick={handleGenerateTables}>
              Generate Cumulative Tables
            </button>
            <button onClick={runSimulation}>Run Simulation</button>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="input-grid vertical">
          <DistributionTable
            title="Interarrival Distribution"
            valueLabel="Interarrival Time"
            rows={arrival.rows}
            cumulativeRows={arrivalTable}
            onAdd={arrival.addRow}
            onRemove={arrival.removeRow}
            onUpdate={arrival.updateRow}
          />

          <DistributionTable
            title="Service Distribution"
            valueLabel="Service Time"
            rows={service.rows}
            cumulativeRows={serviceTable}
            onAdd={service.addRow}
            onRemove={service.removeRow}
            onUpdate={service.updateRow}
          />
        </div>

        <div className="input-grid slim">
          <label className="stacked">
            <span>Random digits (arrival)</span>
            <input
              type="text"
              value={arrivalDigits}
              onChange={(e) => setArrivalDigits(e.target.value)}
              placeholder="Comma or space separated, e.g. 12,45,78"
            />
          </label>
          <label className="stacked">
            <span>Random digits (service)</span>
            <input
              type="text"
              value={serviceDigits}
              onChange={(e) => setServiceDigits(e.target.value)}
              placeholder="Comma or space separated, e.g. 34,90,12"
            />
          </label>
          <label className="stacked narrow">
            <span>Number of customers</span>
            <input
              type="text"
              value={customerCount}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setCustomerCount(0)
                } else {
                  const num = Math.floor(Number(val))
                  if (Number.isFinite(num) && num >= 0) {
                    setCustomerCount(num)
                  }
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Main Simulation Table</h2>
          <div className="panel-actions">
            <button className="secondary" disabled={!simRows.length} onClick={handleDownload}>
              Download CSV
            </button>
          </div>
        </div>
        <div className="table scroll">
          <div className="table-row table-head sticky">
            <div>Cust #</div>
            <div>Rand (Arr)</div>
            <div>Interarrival</div>
            <div>Arrival</div>
            <div>Rand (Svc)</div>
            <div>Service</div>
            <div>Service Start</div>
            <div>Service End</div>
            <div>Waiting</div>
            <div>Idle</div>
            <div>Time in System</div>
          </div>
          {simRows.map((row) => (
            <div className="table-row" key={row.customer}>
              <div>{row.customer}</div>
              <div>{row.randArrival}</div>
              <div>{row.interarrival}</div>
              <div>{row.arrival}</div>
              <div>{row.randService}</div>
              <div>{row.service}</div>
              <div>{row.serviceStart}</div>
              <div>{row.serviceEnd}</div>
              <div>{row.waiting}</div>
              <div>{row.idle}</div>
              <div>{row.timeInSystem}</div>
            </div>
          ))}
          {totals && (
            <div className="table-row total">
              <div>Summation</div>
              <div />
              <div>{totals.interarrival}</div>
              <div>{totals.arrival}</div>
              <div />
              <div>{totals.service}</div>
              <div>{totals.serviceStart}</div>
              <div>{totals.serviceEnd}</div>
              <div>{totals.waiting}</div>
              <div>{totals.idle}</div>
              <div>{totals.timeInSystem}</div>
            </div>
          )}
        </div>

        {summary && (
          <div className="summary">
            <div>
              <strong>Avg waiting:</strong> {summary.avgWaiting.toFixed(2)}
            </div>
            <div>
              <strong>Avg service:</strong> {summary.avgService.toFixed(2)}
            </div>
            <div>
              <strong>Server idle %:</strong> {summary.idlePercent.toFixed(1)}%
            </div>
            <div>
              <strong>Utilization:</strong> {summary.utilization.toFixed(1)}%
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

