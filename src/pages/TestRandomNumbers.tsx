import { Link } from 'react-router-dom'

export function TestRandomNumbersPage() {
  return (
    <main className="page detail">
      <Link to="/" className="back-link">
        ← Back to home
      </Link>
      <h1>Test the Random Numbers</h1>
      <p className="detail-body">
        This page is for testing random numbers functionality.
      </p>
    </main>
  )
}

