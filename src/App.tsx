import { Link, Route, Routes } from 'react-router-dom'
import { SingleServerPage } from './pages/SingleServer'
import { MultiServerPage } from './pages/MultiServer'
import { InventoryPage } from './pages/Inventory'
import { MathematicalModelPage } from './pages/MathematicalModel'
import { TestRandomNumbersPage } from './pages/TestRandomNumbers'
import './App.css'

const options = [
  {
    title: 'Single Server',
    path: '/single-server',
    description: 'Analyze a single-server queue and its performance.',
  },
  {
    title: 'Multi Server',
    path: '/multi-server',
    description: 'Explore multi-server behavior and load distribution.',
  },
  {
    title: 'Inventory',
    path: '/inventory',
    description: 'Track stock levels, demand, and replenishment policies.',
  },
  {
    title: 'Mathematical Model',
    path: '/mathematical-model',
    description: 'Work with a mathematical model.',
  },
  {
    title: 'Test the Random Numbers',
    path: '/test-random-numbers',
    description: 'Test and validate random number generation.',
  },
] as const

function Landing() {
  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Simulation Project</p>
        <h1>Welcome in our simulation project</h1>
        <p className="subhead">Choose a module to start exploring.</p>
      </header>

      <section className="grid">
        {options.map((option) => (
          <Link key={option.path} to={option.path} className="card">
            <div className="card-title">{option.title}</div>
            <p className="card-description">{option.description}</p>
            <span className="card-cta">Open →</span>
          </Link>
        ))}
      </section>
    </main>
  )
}

function ModulePage({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <main className="page detail">
      <Link to="/" className="back-link">
        ← Back to home
      </Link>
      <h1>{title}</h1>
      <p className="detail-body">{body}</p>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/single-server"
        element={<SingleServerPage />}
      />
      <Route
        path="/multi-server"
        element={<MultiServerPage />}
      />
      <Route
        path="/inventory"
        element={<InventoryPage />}
      />
      <Route
        path="/static"
        element={
          <ModulePage
            title="Static Model"
            body="This page will host the static model content."
          />
        }
      />
      <Route path="/mathematical-model" element={<MathematicalModelPage />} />
      <Route path="/test-random-numbers" element={<TestRandomNumbersPage />} />
    </Routes>
  )
}

export default App
