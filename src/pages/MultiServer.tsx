import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DistributionTable, type CumulativeRow, type DistRow } from '../components/DistributionTable'
import { RngInput } from '../components/RngInput'
import { exportToPdf } from '../utils/export'

type SimulationRow = {
  customer: number
  randArrival: number
  interarrival: number
  arrival: number
  randService: number
  service1: number | null
  serviceStart1: number | null
  serviceEnd1: number | null
  service2: number | null
  serviceStart2: number | null
  serviceEnd2: number | null
  waiting: number
  idle1: number
  idle2: number
  timeInSystem: number
  serverUsed: 1 | 2 | null
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

function toCsv(rows: SimulationRow[], summary?: { [key: string]: number }) {
  const header = [
    'Customer No.',
    'Random Digits for Arrival',
    'Time between Arrivals',
    'Clock Time of Arrival',
    'Random Digits for Service',
    'Server 1: Time Service Begins',
    'Server 1: Service Time',
    'Server 1: Time Service Ends',
    'Server 2: Time Service Begins',
    'Server 2: Service Time',
    'Server 2: Time Service Ends',
    'Time in Queue',
  ]
  const body = rows
    .map((r) =>
      [
        r.customer,
        r.randArrival,
        r.interarrival,
        r.arrival,
        r.randService,
        r.serviceStart1 ?? '',
        r.service1 ?? '',
        r.serviceEnd1 ?? '',
        r.serviceStart2 ?? '',
        r.service2 ?? '',
        r.serviceEnd2 ?? '',
        r.waiting,
      ].join(','),
    )
    .join('\n')

  let csv = [header.join(','), body].join('\n')

  if (summary) {
    csv += '\n\nPerformance Analysis\n'
    csv += `Avg waiting,${summary.avgWaiting.toFixed(2)}\n`
    csv += `Avg service (Server 1),${summary.avgService1.toFixed(2)}\n`
    csv += `Avg service (Server 2),${summary.avgService2.toFixed(2)}\n`
    csv += `Server 1 idle %,${summary.idlePercent1.toFixed(1)}%\n`
    csv += `Server 2 idle %,${summary.idlePercent2.toFixed(1)}%\n`
    csv += `Server 1 utilization,${summary.utilization1.toFixed(1)}%\n`
    csv += `Server 2 utilization,${summary.utilization2.toFixed(1)}%\n`
  }

  return csv
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

export function MultiServerPage() {
  const arrival = useDistributionState([
    { value: 1, probability: 0.25 },
    { value: 2, probability: 0.35 },
    { value: 3, probability: 0.4 },
  ])
  const service1 = useDistributionState([
    { value: 2, probability: 0.3 },
    { value: 3, probability: 0.5 },
    { value: 4, probability: 0.2 },
  ])
  const service2 = useDistributionState([
    { value: 2, probability: 0.3 },
    { value: 3, probability: 0.5 },
    { value: 4, probability: 0.2 },
  ])

  const [arrivalDigits, setArrivalDigits] = useState('15,64,12,87,34,56,90,10')
  const [serviceDigits, setServiceDigits] = useState('05,44,70,22,91,39,60,08')
  const [customerCount, setCustomerCount] = useState(8)
  const [priorityServer, setPriorityServer] = useState<1 | 2>(1)

  const [arrivalTable, setArrivalTable] = useState<CumulativeRow[]>([])
  const [service1Table, setService1Table] = useState<CumulativeRow[]>([])
  const [service2Table, setService2Table] = useState<CumulativeRow[]>([])
  const [simRows, setSimRows] = useState<SimulationRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const summary = useMemo(() => {
    if (!simRows.length) return null
    const totalWaiting = simRows.reduce((acc, r) => acc + r.waiting, 0)
    // Only sum service times for servers that were actually used (have serviceStart)
    const totalService1 = simRows.reduce((acc, r) => acc + (r.serviceStart1 !== null ? (r.service1 ?? 0) : 0), 0)
    const totalService2 = simRows.reduce((acc, r) => acc + (r.serviceStart2 !== null ? (r.service2 ?? 0) : 0), 0)
    const totalIdle1 = simRows.reduce((acc, r) => acc + Math.max(r.idle1, 0), 0)
    const totalIdle2 = simRows.reduce((acc, r) => acc + Math.max(r.idle2, 0), 0)

    // Find the last service end time from either server
    const lastEnd1 = simRows.length > 0 ? Math.max(...simRows.map(r => r.serviceEnd1 ?? 0)) : 0
    const lastEnd2 = simRows.length > 0 ? Math.max(...simRows.map(r => r.serviceEnd2 ?? 0)) : 0
    const lastEnd = Math.max(lastEnd1, lastEnd2)

    const service1Count = simRows.filter(r => r.serviceStart1 !== null).length
    const service2Count = simRows.filter(r => r.serviceStart2 !== null).length

    return {
      avgWaiting: totalWaiting / simRows.length,
      avgService1: service1Count > 0 ? totalService1 / service1Count : 0,
      avgService2: service2Count > 0 ? totalService2 / service2Count : 0,
      idlePercent1: lastEnd ? (totalIdle1 / lastEnd) * 100 : 0,
      idlePercent2: lastEnd ? (totalIdle2 / lastEnd) * 100 : 0,
      utilization1: lastEnd ? (totalService1 / lastEnd) * 100 : 0,
      utilization2: lastEnd ? (totalService2 / lastEnd) * 100 : 0,
    }
  }, [simRows])

  const totals = useMemo(() => {
    if (!simRows.length) return null
    const interarrival = simRows.reduce((acc, r) => acc + r.interarrival, 0)
    const arrival = simRows[simRows.length - 1].arrival
    // Only sum service times for servers that were actually used
    const service1 = simRows.reduce((acc, r) => acc + (r.serviceStart1 !== null ? (r.service1 ?? 0) : 0), 0)
    const service2 = simRows.reduce((acc, r) => acc + (r.serviceStart2 !== null ? (r.service2 ?? 0) : 0), 0)
    const serviceStart1 = '' // not summed
    const serviceEnd1 = '' // not summed
    const serviceStart2 = '' // not summed
    const serviceEnd2 = '' // not summed
    const waiting = simRows.reduce((acc, r) => acc + r.waiting, 0)
    const timeInSystem = simRows.reduce((acc, r) => acc + r.timeInSystem, 0)
    const idle1 = simRows.reduce((acc, r) => acc + r.idle1, 0)
    const idle2 = simRows.reduce((acc, r) => acc + r.idle2, 0)
    return {
      interarrival,
      arrival,
      service1,
      service2,
      serviceStart1,
      serviceEnd1,
      serviceStart2,
      serviceEnd2,
      waiting,
      timeInSystem,
      idle1,
      idle2,
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
    const service1Res = buildCumulative(service1.rows)
    const service2Res = buildCumulative(service2.rows)
    if (arrivalRes.error) {
      setError(`Arrival: ${arrivalRes.error}`)
      setArrivalTable([])
      setService1Table([])
      setService2Table([])
      return
    }
    if (service1Res.error) {
      setError(`Server 1: ${service1Res.error}`)
      setArrivalTable([])
      setService1Table([])
      setService2Table([])
      return
    }
    if (service2Res.error) {
      setError(`Server 2: ${service2Res.error}`)
      setArrivalTable([])
      setService1Table([])
      setService2Table([])
      return
    }
    setError(null)
    setArrivalTable(arrivalRes.rows)
    setService1Table(service1Res.rows)
    setService2Table(service2Res.rows)
  }

  const runSimulation = () => {
    const count = Number.isFinite(customerCount) ? Math.floor(customerCount) : 0
    if (count < 1) {
      setError('Number of customers must be at least 1')
      return
    }
    const arrivalRes = buildCumulative(arrival.rows)
    const service1Res = buildCumulative(service1.rows)
    const service2Res = buildCumulative(service2.rows)
    if (arrivalRes.error) {
      setError(`Arrival: ${arrivalRes.error}`)
      return
    }
    if (service1Res.error) {
      setError(`Server 1: ${service1Res.error}`)
      return
    }
    if (service2Res.error) {
      setError(`Server 2: ${service2Res.error}`)
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
    let server1End = 0 // When server 1 will be free
    let server2End = 0 // When server 2 will be free

    for (let i = 0; i < count; i++) {
      const customer = i + 1
      const randArrival = i === 0 ? 0 : arrivalNums[i - 1]
      const randService = serviceNums[i]

      const interarrival = i === 0 ? 0 : mapRandomToValue(randArrival, arrivalRes.rows)
      const serviceTime1 = mapRandomToValue(randService, service1Res.rows)
      const serviceTime2 = mapRandomToValue(randService, service2Res.rows)

      if (interarrival === null || serviceTime1 === null || serviceTime2 === null) {
        setError('Random digit could not be mapped to a time. Check tables.')
        return
      }

      const arrivalTime = i === 0 ? 0 : table[i - 1].arrival + interarrival

      // Determine which server to use
      let serverUsed: 1 | 2 | null = null
      let serviceStart = 0
      let serviceEnd = 0
      let serviceTime = 0
      let waiting = 0
      let idle1 = 0
      let idle2 = 0

      const server1Available = arrivalTime >= server1End
      const server2Available = arrivalTime >= server2End

      // Get the actual last end time for each server (when they were last busy)
      const prevServer1End = server1End
      const prevServer2End = server2End

      if (server1Available && server2Available) {
        // Both servers are idle - use priority server
        if (priorityServer === 1) {
          serverUsed = 1
          serviceTime = serviceTime1
          serviceStart = arrivalTime
          serviceEnd = arrivalTime + serviceTime1
          idle1 = Math.max(0, arrivalTime - prevServer1End)
          idle2 = 0
          server1End = serviceEnd
          waiting = 0
        } else {
          serverUsed = 2
          serviceTime = serviceTime2
          serviceStart = arrivalTime
          serviceEnd = arrivalTime + serviceTime2
          idle1 = 0
          idle2 = Math.max(0, arrivalTime - prevServer2End)
          server2End = serviceEnd
          waiting = 0
        }
      } else if (server1Available) {
        // Server 1 is idle, use it
        serverUsed = 1
        serviceTime = serviceTime1
        serviceStart = arrivalTime
        serviceEnd = arrivalTime + serviceTime1
        idle1 = Math.max(0, arrivalTime - prevServer1End)
        idle2 = 0
        server1End = serviceEnd
        waiting = 0
      } else if (server2Available) {
        // Server 2 is idle, use it
        serverUsed = 2
        serviceTime = serviceTime2
        serviceStart = arrivalTime
        serviceEnd = arrivalTime + serviceTime2
        idle1 = 0
        idle2 = Math.max(0, arrivalTime - prevServer2End)
        server2End = serviceEnd
        waiting = 0
      } else {
        // Both servers are busy - wait for the one that becomes available first
        if (server1End <= server2End) {
          serverUsed = 1
          serviceTime = serviceTime1
          serviceStart = server1End
          serviceEnd = server1End + serviceTime1
          server1End = serviceEnd
          idle1 = 0
          idle2 = 0
          waiting = serviceStart - arrivalTime
        } else {
          serverUsed = 2
          serviceTime = serviceTime2
          serviceStart = server2End
          serviceEnd = server2End + serviceTime2
          server2End = serviceEnd
          idle1 = 0
          idle2 = 0
          waiting = serviceStart - arrivalTime
        }
      }

      const timeInSystem = waiting + serviceTime

      table.push({
        customer,
        randArrival,
        interarrival,
        arrival: arrivalTime,
        randService,
        service1: serverUsed === 1 ? serviceTime1 : null, // Only show if Server 1 is used
        serviceStart1: serverUsed === 1 ? serviceStart : null,
        serviceEnd1: serverUsed === 1 ? serviceEnd : null,
        service2: serverUsed === 2 ? serviceTime2 : null, // Only show if Server 2 is used
        serviceStart2: serverUsed === 2 ? serviceStart : null,
        serviceEnd2: serverUsed === 2 ? serviceEnd : null,
        waiting,
        idle1,
        idle2,
        timeInSystem,
        serverUsed,
      })
    }

    setError(null)
    setArrivalTable(arrivalRes.rows)
    setService1Table(service1Res.rows)
    setService2Table(service2Res.rows)
    setSimRows(table)
  }

  const handleDownloadCsv = () => {
    if (!simRows.length) return
    const blob = new Blob([toCsv(simRows, summary || {})], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'multi-server-simulation.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = () => {
    if (!simRows.length || !summary) return
    const headers = [
      'Cust #',
      'Arr.',
      'S1 Start',
      'S1 Svc',
      'S1 End',
      'S2 Start',
      'S2 Svc',
      'S2 End',
      'Wait',
    ]
    const body = simRows.map((r) => [
      r.customer,
      r.arrival,
      r.serviceStart1 ?? '-',
      r.service1 ?? '-',
      r.serviceEnd1 ?? '-',
      r.serviceStart2 ?? '-',
      r.service2 ?? '-',
      r.serviceEnd2 ?? '-',
      r.waiting,
    ])

    const pdfSummary = {
      'Avg waiting': summary.avgWaiting.toFixed(2),
      'Avg service (Server 1)': summary.avgService1.toFixed(2),
      'Avg service (Server 2)': summary.avgService2.toFixed(2),
      'Server 1 idle %': `${summary.idlePercent1.toFixed(1)}%`,
      'Server 2 idle %': `${summary.idlePercent2.toFixed(1)}%`,
      'Server 1 utilization': `${summary.utilization1.toFixed(1)}%`,
      'Server 2 utilization': `${summary.utilization2.toFixed(1)}%`,
    }

    exportToPdf('multi-server-simulation', 'Multi-Server Queue Simulation', headers, body, pdfSummary)
  }

  return (
    <main className="page detail">
      <Link to="/" className="back-link">
        ← Back to home
      </Link>
      <h1>Multi-Server Queue Simulation</h1>
      <p className="detail-body">
        Configure arrival and service distributions for two servers, provide random digits, and run a
        discrete-event simulation. A single random number is used to look up service times in both
        distributions. When both servers are idle, the <strong>priority server</strong> is chosen.
        When one server is busy, customers use the idle server.
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
            title="Server 1 Distribution"
            valueLabel="Service Time"
            rows={service1.rows}
            cumulativeRows={service1Table}
            onAdd={service1.addRow}
            onRemove={service1.removeRow}
            onUpdate={service1.updateRow}
          />

          <DistributionTable
            title="Server 2 Distribution"
            valueLabel="Service Time"
            rows={service2.rows}
            cumulativeRows={service2Table}
            onAdd={service2.addRow}
            onRemove={service2.removeRow}
            onUpdate={service2.updateRow}
          />
        </div>

        <div className="input-grid slim">
          <RngInput
            label="Random digits (arrival)"
            value={arrivalDigits}
            onChange={setArrivalDigits}
            scale={100}
          />
          <RngInput
            label="Random digits (service)"
            value={serviceDigits}
            onChange={setServiceDigits}
            scale={100}
          />
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
          <label className="stacked narrow">
            <span>Priority Server</span>
            <select
              value={priorityServer}
              onChange={(e) => setPriorityServer(Number(e.target.value) as 1 | 2)}
            >
              <option value={1}>Server 1</option>
              <option value={2}>Server 2</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Main Simulation Table</h2>
          <div className="panel-actions">
            <button className="secondary" disabled={!simRows.length} onClick={handleDownloadCsv}>
              Download CSV
            </button>
            <button className="secondary" disabled={!simRows.length} onClick={handleDownloadPdf}>
              Download PDF
            </button>
          </div>
        </div>
        <div className="table scroll multi-server-table">
          <div className="table-row table-head sticky">
            <div>Customer No.</div>
            <div>Random Digits for Arrival</div>
            <div>Time between Arrivals</div>
            <div>Clock Time of Arrival</div>
            <div>Random Digits for Service</div>
            <div className="spacer"></div>
            <div>Server 1: Time Service Begins</div>
            <div>Server 1: Service Time</div>
            <div>Server 1: Time Service Ends</div>
            <div className="spacer"></div>
            <div>Server 2: Time Service Begins</div>
            <div>Server 2: Service Time</div>
            <div>Server 2: Time Service Ends</div>
            <div className="spacer"></div>
            <div>Time in Queue</div>
          </div>
          {simRows.map((row) => (
            <div className="table-row" key={row.customer}>
              <div>{row.customer}</div>
              <div>{row.randArrival}</div>
              <div>{row.interarrival}</div>
              <div>{row.arrival}</div>
              <div>{row.randService}</div>
              <div className="spacer"></div>
              <div>{row.serviceStart1 ?? ''}</div>
              <div>{row.service1 ?? ''}</div>
              <div>{row.serviceEnd1 ?? ''}</div>
              <div className="spacer"></div>
              <div>{row.serviceStart2 ?? ''}</div>
              <div>{row.service2 ?? ''}</div>
              <div>{row.serviceEnd2 ?? ''}</div>
              <div className="spacer"></div>
              <div>{row.waiting}</div>
            </div>
          ))}
          {totals && (
            <div className="table-row total">
              <div>Summation</div>
              <div />
              <div>{totals.interarrival}</div>
              <div>{totals.arrival}</div>
              <div />
              <div className="spacer"></div>
              <div>{totals.serviceStart1}</div>
              <div>{totals.service1}</div>
              <div>{totals.serviceEnd1}</div>
              <div className="spacer"></div>
              <div>{totals.serviceStart2}</div>
              <div>{totals.service2}</div>
              <div>{totals.serviceEnd2}</div>
              <div className="spacer"></div>
              <div>{totals.waiting}</div>
            </div>
          )}
        </div>

        {summary && (
          <div className="summary">
            <div>
              <strong>Avg waiting:</strong> {summary.avgWaiting.toFixed(2)}
            </div>
            <div>
              <strong>Avg service (Server 1):</strong> {summary.avgService1.toFixed(2)}
            </div>
            <div>
              <strong>Avg service (Server 2):</strong> {summary.avgService2.toFixed(2)}
            </div>
            <div>
              <strong>Server 1 idle %:</strong> {summary.idlePercent1.toFixed(1)}%
            </div>
            <div>
              <strong>Server 2 idle %:</strong> {summary.idlePercent2.toFixed(1)}%
            </div>
            <div>
              <strong>Server 1 utilization:</strong> {summary.utilization1.toFixed(1)}%
            </div>
            <div>
              <strong>Server 2 utilization:</strong> {summary.utilization2.toFixed(1)}%
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

