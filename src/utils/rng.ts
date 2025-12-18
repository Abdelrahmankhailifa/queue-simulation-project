export type RngResult = {
    numbers: number[]
    error?: string
}

/**
 * Mid-Square Method
 * @param seed Initial seed
 * @param count Number of values to generate
 * @param digits Number of digits (default 4)
 */
export function middleSquare(seed: number, count: number, digits: number = 4): RngResult {
    const nums: number[] = []
    let current = seed

    for (let i = 0; i < count; i++) {
        let sq = current * current
        // Pad with leading zeros to 2*digits length
        let s = sq.toString().padStart(digits * 2, '0')

        // Extract middle 'digits'
        // Example: digits=4, 2*digits=8. Middle 4 are from index 2 to 6.
        // Length 8: 0 1 [2 3 4 5] 6 7
        const start = Math.floor(digits / 2)
        const mid = s.substring(start, start + digits)

        current = parseInt(mid, 10)
        nums.push(current)
    }

    return { numbers: nums }
}

/**
 * Linear Congruential Generator
 * X_{n+1} = (a * X_n + c) % m
 */
export function lcg(z0: number, a: number, c: number, m: number, count: number): RngResult {
    const nums: number[] = []
    let current = z0

    if (m <= 0) return { numbers: [], error: 'Modulus m must be > 0' }

    for (let i = 0; i < count; i++) {
        current = (a * current + c) % m
        nums.push(current)
    }

    return { numbers: nums }
}

/**
 * Helper to normalize numbers to a specific scale (e.g. 1-100)
 * Logic: Take the raw number, map it to 0-1 range based on its potential max, then scale.
 */
export function normalizeValues(
    values: number[],
    scaleTo: number,
    sourceMax: number // The theoretical max + 1 (e.g. 100 for 0-99, or 'm' for LCG)
): number[] {
    return values.map(v => {
        // Normalize to 0-1 (approx)
        const normalized = v / sourceMax
        // User requested rounding: 37.5 -> 38, 37.4 -> 37.
        // This corresponds to Math.round() logic.
        return Math.round(normalized * scaleTo)
    })
}
