import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DistributionTable, type CumulativeRow, type DistRow } from '../components/DistributionTable'
import { RngInput } from '../components/RngInput'
import { exportToPdf } from '../utils/export'

type SimulationRow = {
  cycle: number
  day: number
  beginningInventory: number
  randDemand: number
  demand: number
  endingInventory: number
  shortage: number
  orderQuantity: number | null
  randLeadTime: number | null
  daysUntilArrival: number | null
}

const tolerance = 0.001

function buildCumulative(dist: DistRow[], scale: number = 100): { rows: CumulativeRow[]; error?: string } {
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
    const cumulativeScaled = Math.round(row.cumulative * scale)
    const start = previousEnd + 1
    const end = Math.min(scale, cumulativeScaled)
    row.rangeStart = start
    row.rangeEnd = end
  })

  return { rows }
}

function mapRandomToValue(rand: number, ranges: CumulativeRow[], scale: number = 100) {
  // For scale=100: 0 becomes 100
  // For scale=10: 0 becomes 10
  const normalized = rand === 0 ? scale : rand
  return ranges.find((r) => normalized >= r.rangeStart && normalized <= r.rangeEnd)?.value ?? null
}

function toCsv(rows: SimulationRow[], totals?: any) {
  const header = [
    'Cycle',
    'Day',
    'Beginning Inventory',
    'Random Digits for Demand',
    'Demand',
    'Ending Inventory',
    'Shortage Quantity',
    'Order Quantity',
    'Random Digits for Lead Time',
    'Days until Order Arrives',
  ]
  const body = rows
    .map((r) =>
      [
        r.cycle,
        r.day,
        r.beginningInventory,
        r.randDemand,
        r.demand,
        r.endingInventory,
        r.shortage,
        r.orderQuantity ?? '-',
        r.randLeadTime ?? '-',
        r.daysUntilArrival ?? '-',
      ].join(','),
    )
    .join('\n')

  let csv = [header.join(','), body].join('\n')

  if (totals) {
    csv += '\n\nPerformance Analysis\n'
    csv += `Average Ending Inventory,${totals.avgEndingInventory.toFixed(2)}\n`
    csv += `Shortage Days,${totals.shortageDays}\n`
    csv += `Shortage Probability,${(totals.shortageProbability * 100).toFixed(2)}%\n`
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

export function InventoryPage() {
  const demand = useDistributionState([
    { value: 0, probability: 0.1 },
    { value: 1, probability: 0.25 },
    { value: 2, probability: 0.35 },
    { value: 3, probability: 0.21 },
    { value: 4, probability: 0.09 },
  ])
  const leadTime = useDistributionState([
    { value: 1, probability: 0.6 },
    { value: 2, probability: 0.3 },
    { value: 3, probability: 0.1 },
  ])

  const [initialInventory, setInitialInventory] = useState(3)
  const [inventoryLimit, setInventoryLimit] = useState(11)
  const [initialOrderQuantity, setInitialOrderQuantity] = useState(8)
  const [initialOrderLeadTime, setInitialOrderLeadTime] = useState(2)
  const [demandDigits, setDemandDigits] = useState('24,35,65,81,54,03,87,27,73,70,47,45,48,17,09,42,87,26,36,40,07,63,19,88,12')
  const [leadTimeDigits, setLeadTimeDigits] = useState('5,0,3,4,8')
  const [numCycles, setNumCycles] = useState(5)
  const [daysPerCycle, setDaysPerCycle] = useState(5)

  const [demandTable, setDemandTable] = useState<CumulativeRow[]>([])
  const [leadTimeTable, setLeadTimeTable] = useState<CumulativeRow[]>([])
  const [simRows, setSimRows] = useState<SimulationRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const reorderPoint = useMemo(() => {
    if (demand.rows.length === 0 || leadTime.rows.length === 0) return 3

    const expectedDemand = demand.rows.reduce((sum, row) => {
      return sum + (row.value * row.probability)
    }, 0)

    const expectedLeadTime = leadTime.rows.reduce((sum, row) => {
      return sum + (row.value * row.probability)
    }, 0)

    return Math.ceil(expectedDemand * expectedLeadTime) + 1
  }, [demand.rows, leadTime.rows])

  const parseDigits = (value: string, scale: number = 100) =>
    value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((d) => Number(d))
      .map((d) => (d === 0 ? scale : d)) // 0 becomes 100 (for scale=100) or 10 (for scale=10)
      .filter((d) => Number.isFinite(d) && d >= 1 && d <= scale)

  const handleGenerateTables = () => {
    const demandRes = buildCumulative(demand.rows, 100) // Demand uses 100 scale
    const leadTimeRes = buildCumulative(leadTime.rows, 10) // Lead time uses 10 scale
    if (demandRes.error) {
      setError(`Demand: ${demandRes.error}`)
      setDemandTable([])
      setLeadTimeTable([])
      return
    }
    if (leadTimeRes.error) {
      setError(`Lead Time: ${leadTimeRes.error}`)
      setDemandTable([])
      setLeadTimeTable([])
      return
    }
    setError(null)
    setDemandTable(demandRes.rows)
    setLeadTimeTable(leadTimeRes.rows)
  }

  const runSimulation = () => {
    const cycles = Number.isFinite(numCycles) ? Math.floor(numCycles) : 0
    const days = Number.isFinite(daysPerCycle) ? Math.floor(daysPerCycle) : 0
    const initInv = Number.isFinite(initialInventory) ? Math.floor(initialInventory) : 0
    const invLimit = Number.isFinite(inventoryLimit) ? Math.floor(inventoryLimit) : 0
    const initOrderQty = Number.isFinite(initialOrderQuantity) ? Math.floor(initialOrderQuantity) : 0
    const initOrderLead = Number.isFinite(initialOrderLeadTime) ? Math.floor(initialOrderLeadTime) : 0
    const reorder = reorderPoint

    if (cycles < 1 || days < 1) {
      setError('Number of cycles and days per cycle must be at least 1')
      return
    }
    if (initInv < 0) {
      setError('Initial inventory must be non-negative')
      return
    }
    if (invLimit <= reorder) {
      setError('Inventory limit must be greater than reorder point')
      return
    }
    if (initOrderQty < 0) {
      setError('Initial order quantity must be non-negative')
      return
    }
    if (initOrderLead < 0) {
      setError('Initial order lead time must be non-negative')
      return
    }

    const demandRes = buildCumulative(demand.rows, 100)
    const leadTimeRes = buildCumulative(leadTime.rows, 10)
    if (demandRes.error) {
      setError(`Demand: ${demandRes.error}`)
      return
    }
    if (leadTimeRes.error) {
      setError(`Lead Time: ${leadTimeRes.error}`)
      return
    }

    const demandNums = parseDigits(demandDigits, 100)
    const leadTimeNums = parseDigits(leadTimeDigits, 10)

    const totalDays = cycles * days
    if (demandNums.length < totalDays) {
      setError(`Not enough demand random digits. Need ${totalDays}, got ${demandNums.length}`)
      return
    }
    if (demandNums.some((d) => d < 1 || d > 100)) {
      setError('Demand random digits must be between 01 and 00 (i.e., 1 to 100)')
      return
    }
    if (leadTimeNums.some((d) => d < 1 || d > 10)) {
      setError('Lead time random digits must be between 0 and 9 (i.e., 1 to 10 after conversion)')
      return
    }

    const table: SimulationRow[] = []

    let inventory = initInv
    const pendingOrders: Array<{ quantity: number, arrivalCycle: number, arrivalDay: number }> = []

    // Add initial order if specified
    if (initOrderQty > 0 && initOrderLead > 0) {
      pendingOrders.push({
        quantity: initOrderQty,
        arrivalCycle: 1,
        arrivalDay: initOrderLead + 1 // Arrival is lead time + 1 (e.g., 2 days lead time -> arrives day 3)
      })
    }

    let demandIndex = 0
    let leadTimeIndex = 0

    for (let cycle = 1; cycle <= cycles; cycle++) {
      for (let day = 1; day <= days; day++) {
        // Process arrivals at the BEGINNING of the day
        let arrivalsToday = 0
        const ordersArrivingToday = pendingOrders.filter(order =>
          order.arrivalCycle === cycle && order.arrivalDay === day
        )
        ordersArrivingToday.forEach(order => {
          arrivalsToday += order.quantity
        })

        // Remove arrived orders
        pendingOrders.splice(0, pendingOrders.length,
          ...pendingOrders.filter(order => !(order.arrivalCycle === cycle && order.arrivalDay === day)))

        // Update inventory with arrivals
        inventory += arrivalsToday

        const beginningInventoryForDisplay = inventory

        // Calculate days until next arrival (for display)
        let daysUntilNextArrival: number | null = null
        if (pendingOrders.length > 0) {
          // Find the next order that will arrive in THIS cycle
          const ordersThisCycle = pendingOrders.filter(o => o.arrivalCycle === cycle)
          if (ordersThisCycle.length > 0) {
            const nextArrivalDay = Math.min(...ordersThisCycle.map(o => o.arrivalDay))
            // Example: Arrives Day 3.
            // Day 1: 3 - 1 - 1 = 1
            // Day 2: 3 - 2 - 1 = 0
            daysUntilNextArrival = Math.max(0, nextArrivalDay - day - 1)
          }
        }

        // Process demand
        const randDemand = demandNums[demandIndex++]
        const demandToday = mapRandomToValue(randDemand, demandRes.rows, 100)

        if (demandToday === null) {
          setError(`Demand random digit ${randDemand} could not be mapped. Check tables.`)
          return
        }

        // Calculate ending inventory and shortage
        let endingInventory: number

        let accumulatedShortage = (table.length > 0) ? table[table.length - 1].shortage : 0

        // Step 1: Fulfill accumulated shortage from previous days
        if (accumulatedShortage > 0) {
          if (inventory >= accumulatedShortage) {
            inventory -= accumulatedShortage
            accumulatedShortage = 0
          } else {
            accumulatedShortage -= inventory
            inventory = 0
          }
        }

        // Step 2: Satisfy current demand
        if (inventory >= demandToday) {
          endingInventory = inventory - demandToday
        } else {
          // Cannot fully satisfy demand
          const unmetDemand = demandToday - inventory
          accumulatedShortage += unmetDemand
          endingInventory = 0
        }

        // Current total shortage to display (and use in calc) is the accumulated shortage
        const shortage = accumulatedShortage

        // Order quantity calculation - ONLY ON LAST DAY OF CYCLE (Day 5)
        let orderQuantity: number | null = null
        let randLeadTime: number | null = null

        // Check if we need to place an order - ALWAYS ON LAST DAY (Periodic Review)
        if (day === days) {
          // Formula: Q = Limit - Ending Inventory + Shortage
          // With shortage being the cumulative backlog, this correctly restores inventory position.
          orderQuantity = invLimit - endingInventory + shortage

          if (orderQuantity > 0) {
            if (leadTimeIndex < leadTimeNums.length) {
              randLeadTime = leadTimeNums[leadTimeIndex++]
              const leadTimeDays = mapRandomToValue(randLeadTime, leadTimeRes.rows, 10)

              if (leadTimeDays === null) {
                setError(`Lead time random digit ${randLeadTime} could not be mapped. Check tables.`)
                return
              }

              // Calculate Arrival Time accurately using absolute days
              // Current Absolute Day (at end of today) = (cycle - 1) * days + day
              const currentAbsDay = (cycle - 1) * days + day

              // Arrival is after leadTimeDays passes. 
              const arrivalAbsDay = currentAbsDay + leadTimeDays + 1

              const arrivalCycle = Math.ceil(arrivalAbsDay / days)
              let arrivalDay = arrivalAbsDay % days
              if (arrivalDay === 0) arrivalDay = days

              pendingOrders.push({
                quantity: orderQuantity,
                arrivalCycle,
                arrivalDay
              })

              // OVERWRITE "Days until Order Arrives" for the current day to show the lead time
              daysUntilNextArrival = leadTimeDays
            } else {
              // ran out of random digits
              randLeadTime = null
            }
          }
        }

        table.push({
          cycle,
          day,
          beginningInventory: beginningInventoryForDisplay,
          randDemand,
          demand: demandToday,
          endingInventory,
          shortage,
          orderQuantity,
          randLeadTime,
          daysUntilArrival: daysUntilNextArrival,
        })

        // Update inventory for next day
        inventory = endingInventory
      }
    }

    setError(null)
    setDemandTable(demandRes.rows)
    setLeadTimeTable(leadTimeRes.rows)
    setSimRows(table)
  }

  const handleDownloadCsv = () => {
    if (!simRows.length) return
    const blob = new Blob([toCsv(simRows, totals)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inventory-simulation.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = () => {
    if (!simRows.length || !totals) return
    const headers = [
      'Cyc',
      'Day',
      'Beg Inv',
      'Dem Dig',
      'Dem',
      'End Inv',
      'Short',
      'Ord Qty',
      'LT Dig',
      'Days Arr',
    ]
    const body = simRows.map((r) => [
      r.cycle,
      r.day,
      r.beginningInventory,
      r.randDemand,
      r.demand,
      r.endingInventory,
      r.shortage,
      r.orderQuantity ?? '-',
      r.randLeadTime ?? '-',
      r.daysUntilArrival ?? '-',
    ])

    const pdfSummary = {
      'Average Ending Inventory': totals.avgEndingInventory.toFixed(2),
      'Shortage Days': totals.shortageDays.toString(),
      'Shortage Probability': `${(totals.shortageProbability * 100).toFixed(2)}%`,
    }

    exportToPdf('inventory-simulation', 'Inventory Simulation', headers, body, pdfSummary)
  }

  const totals = useMemo(() => {
    if (!simRows.length) return null

    const sumEndingInventory = simRows.reduce((acc, row) => acc + row.endingInventory, 0)
    const avgEndingInventory = sumEndingInventory / simRows.length
    const shortageDays = simRows.filter(row => row.shortage > 0).length
    const shortageProbability = shortageDays / simRows.length

    return {
      sumEndingInventory,
      avgEndingInventory,
      shortageDays,
      shortageProbability
    }
  }, [simRows])

  return (
    <main className="page detail">
      <Link to="/" className="back-link">
        ← Back to home
      </Link>
      <h1 style={{ marginRight: '24px' }}>Inventory Simulation</h1>
      <p className="detail-body" style={{ marginRight: '24px' }}>
        Simulate inventory management using mathematical equations. Define demand and lead time
        distributions, set inventory parameters, and run period-by-period calculations.
      </p>

      <section className="panel">
        <div className="panel-header">
          <h2 style={{ marginRight: '24px' }}>Inputs</h2>
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
            title="Demand Distribution"
            valueLabel="Demand"
            rows={demand.rows}
            cumulativeRows={demandTable}
            onAdd={demand.addRow}
            onRemove={demand.removeRow}
            onUpdate={demand.updateRow}
          />

          <DistributionTable
            title="Lead Time Distribution"
            valueLabel="Lead Time"
            rows={leadTime.rows}
            cumulativeRows={leadTimeTable}
            onAdd={leadTime.addRow}
            onRemove={leadTime.removeRow}
            onUpdate={leadTime.updateRow}
          />
        </div>

        <div className="input-grid slim">
          <label className="stacked">
            <span>Initial Inventory (I_0)</span>
            <input
              type="text"
              value={initialInventory}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setInitialInventory(0)
                } else {
                  const num = Math.floor(Number(val))
                  if (Number.isFinite(num) && num >= 0) {
                    setInitialInventory(num)
                  }
                }
              }}
            />
          </label>
          <label className="stacked">
            <span>Inventory Limit (Max Inventory)</span>
            <input
              type="text"
              value={inventoryLimit}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setInventoryLimit(0)
                } else {
                  const num = Math.floor(Number(val))
                  if (Number.isFinite(num) && num >= 0) {
                    setInventoryLimit(num)
                  }
                }
              }}
            />
          </label>
          <label className="stacked">
            <span>Initial Order Quantity (Optional)</span>
            <input
              type="text"
              value={initialOrderQuantity}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setInitialOrderQuantity(0)
                } else {
                  const num = Math.floor(Number(val))
                  if (Number.isFinite(num) && num >= 0) {
                    setInitialOrderQuantity(num)
                  }
                }
              }}
              placeholder="0 means no initial order"
            />
          </label>
          <label className="stacked">
            <span>Initial Order Lead Time (Days)</span>
            <input
              type="text"
              value={initialOrderLeadTime}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setInitialOrderLeadTime(0)
                } else {
                  const num = Math.floor(Number(val))
                  if (Number.isFinite(num) && num >= 0) {
                    setInitialOrderLeadTime(num)
                  }
                }
              }}
              placeholder="0 means arrives immediately"
            />
          </label>
          <label className="stacked">
            <span>Number of Cycles</span>
            <input
              type="text"
              value={numCycles}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setNumCycles(0)
                } else {
                  const num = Math.floor(Number(val))
                  if (Number.isFinite(num) && num >= 0) {
                    setNumCycles(num)
                  }
                }
              }}
            />
          </label>
          <label className="stacked">
            <span>Days per Cycle</span>
            <input
              type="text"
              value={daysPerCycle}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  setDaysPerCycle(0)
                } else {
                  const num = Math.floor(Number(val))
                  if (Number.isFinite(num) && num >= 0) {
                    setDaysPerCycle(num)
                  }
                }
              }}
            />
          </label>
        </div>

        <div className="input-grid slim">
          <RngInput
            label="Random digits (demand) - 00 to 99"
            value={demandDigits}
            onChange={setDemandDigits}
            scale={100}
          />
          <RngInput
            label="Random digits (lead time) - 0 to 9"
            value={leadTimeDigits}
            onChange={setLeadTimeDigits}
            scale={10}
          />
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginRight: '24px' }}>Performance Analysis</h2>
        {totals ? (
          <div className="input-grid slim">
            <div className="stat-box">
              <label>Average Ending Inventory</label>
              <div className="stat-value">{totals.avgEndingInventory.toFixed(2)}</div>
            </div>
            <div className="stat-box">
              <label>Shortage Days</label>
              <div className="stat-value">{totals.shortageDays}</div>
            </div>
            <div className="stat-box">
              <label>Shortage Probability</label>
              <div className="stat-value">{(totals.shortageProbability * 100).toFixed(2)}%</div>
            </div>
          </div>
        ) : <p>Run simulation to see results.</p>}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2 style={{ marginRight: '24px' }}>Simulation Table ({numCycles} Cycles)</h2>
          <div className="panel-actions">
            <button className="secondary" disabled={!simRows.length} onClick={handleDownloadCsv}>
              Download CSV
            </button>
            <button className="secondary" disabled={!simRows.length} onClick={handleDownloadPdf}>
              Download PDF
            </button>
          </div>
        </div>
        <div className="table scroll inventory-table">
          <div className="table-row table-head sticky">
            <div>Cycle</div>
            <div>Day</div>
            <div>Beginning Inventory</div>
            <div>Random Digits for Demand</div>
            <div>Demand</div>
            <div>Ending Inventory</div>
            <div>Shortage Quantity</div>
            <div>Order Quantity</div>
            <div>Random Digits for Lead Time</div>
            <div>Days until Order Arrives</div>
          </div>
          {simRows.map((row, idx) => (
            <div className="table-row" key={idx}>
              <div>{row.cycle}</div>
              <div>{row.day}</div>
              <div>{row.beginningInventory}</div>
              <div>{row.randDemand}</div>
              <div>{row.demand}</div>
              <div>{row.endingInventory}</div>
              <div>{row.shortage}</div>
              <div>{row.orderQuantity ?? '-'}</div>
              <div>{row.randLeadTime ?? '-'}</div>
              <div>{row.daysUntilArrival ?? '-'}</div>
            </div>
          ))}
          {totals && (
            <div className="table-row total">
              <div />
              <div />
              <div />
              <div />
              <div />
              <div>{totals.sumEndingInventory}</div>
              <div />
              <div />
              <div />
              <div />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}