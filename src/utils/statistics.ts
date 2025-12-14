// Chi-Square Critical Values for alpha = 0.05
const CHI_SQUARE_TABLE_0_05: Record<number, number> = {
    1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.070,
    6: 12.592, 7: 14.067, 8: 15.507, 9: 16.919, 10: 18.307,
    11: 19.675, 12: 21.026, 13: 22.362, 14: 23.685, 15: 24.996,
    16: 26.296, 17: 27.587, 18: 28.869, 19: 30.144, 20: 31.410,
    21: 32.671, 22: 33.924, 23: 35.172, 24: 36.415, 25: 37.652,
    26: 38.885, 27: 40.113, 28: 41.337, 29: 42.557, 30: 43.773,
}

// Normal Distribution Critical Values (Two-tailed)
const Z_CRITICAL_TABLE: Record<string, number> = {
    '0.05': 1.96,
    '0.01': 2.576,
    '0.10': 1.645
}

export interface ChiSquareResult {
    intervals: Array<{
        start: number
        end: number
        oi: number // Observed Frequency
        ei: number // Expected Frequency
        chiPart: number // (Oi-Ei)^2 / Ei
    }>
    chiStat: number
    criticalValue: number
    dof: number
    isUniform: boolean
    N: number
}

export function calculateChiSquare(numbers: number[], k: number, _alpha: number = 0.05): ChiSquareResult {
    const N = numbers.length
    const Ei = N / k
    const intervals = []
    let chiStat = 0

    for (let i = 0; i < k; i++) {
        const start = i / k
        const end = (i + 1) / k
        // Count Oi: number of items in [start, end)
        // Note: ensure 1.0 is handled if end=1 (usually standard random [0,1) ) 
        // but if user enters 1.0 explicitly, we might want to include it in last bucket or error.
        // Assume standard [0,1).
        const oi = numbers.filter(n => n >= start && (i === k - 1 ? n <= end : n < end)).length
        const chiPart = Math.pow(oi - Ei, 2) / Ei

        chiStat += chiPart
        intervals.push({ start, end, oi, ei: Ei, chiPart })
    }

    const dof = k - 1
    // Fallback for DoF > 30: Approximation -> 0.5 * (z_alpha + sqrt(2*dof - 1))^2 ? 
    // Or just use the last value / approximation. For this scope, let's limit or use approx.
    // Wilson-Hilferty approx: ChiSq ~ DoF * (1 - 2/(9*DoF) + z * sqrt(2/(9*DoF)))^3
    let criticalValue = CHI_SQUARE_TABLE_0_05[dof]
    if (!criticalValue) {
        if (dof > 30) {
            // Approximation for large DoF
            criticalValue = dof + 1.645 * Math.sqrt(2 * dof) // Very rough, prefer table 
            // Better: Chi ~ 0.5 * (1.645 + Math.sqrt(2*dof - 1))^2
            criticalValue = 0.5 * Math.pow(1.645 + Math.sqrt(2 * dof - 1), 2)
        } else {
            criticalValue = 3.841 // Default to 1 (DoF < 1 shouldn't happen)
        }
    }

    const isUniform = chiStat < criticalValue

    return {
        intervals,
        chiStat,
        criticalValue,
        dof,
        isUniform,
        N
    }
}

export interface DependencyResult {
    pairs: Array<{ x: number, y: number }>
    correlation: number // autocorrelation rho
    variance: number
    zStat: number // Z0
    criticalValue: number
    isIndependent: boolean
    N: number
}

export function calculateDependency(numbers: number[], lag: number = 1, _alpha: number = 0.05): DependencyResult {
    const N = numbers.length

    // Usually for Independence Test (Autocorrelation):
    // We compute estimator for autocorrelation at lag.
    // Formula: rho_hat = (Sum(X_i * X_{i+lag}) / (N - lag)) - 0.25 (approx mean subtraction 0.5*0.5? No)
    // Standard formulas:
    // Z0 = (rho_hat) / sigma_rho
    // rho_hat = [1/(N-m) * Sum(X_i * X_{i+m}) ] - 0.25 ? No this presumes Uniform(0,1).
    // E[X] = 0.5, Var[X] = 1/12.
    // Cov(X_i, X_{i+m}) = E[X_i * X_{i+m}] - E[X_i]E[X_{i+m}]
    // = 1/(N-m) * Sum(X_i * X_{i+m}) - 0.25.
    // rho_m = Cov / Var = Cov / (1/12).
    // Standard Deviation of estimator sigma_rho = sqrt(13N - 19) / (12(N-1)) ... wait, specific formulas vary.

    // Let's use the standard "Test for Autocorrelation" formula often taught in Sim courses (e.g. Banks et al):
    // M is the largest integer such that i + (M+1)lag <= N. 
    // Estimator: rho_im = (1/(M+1)) * Sum(R_{i+k*lag} * R_{i+(k+1)*lag}) - 0.25
    // wait, simplified: form Pairs (Ri, Ri+1) for lag 1.
    // sum product: Sum(Ri * Ri+1)
    // Theoretical expected sum: (N-1)/4 (since E[XY] = E[X]E[Y] = 0.25)
    // Std Dev of estimator: sqrt(13N - 19) / (12*(N-1))
    // Z = (ComputedRho - 0) / StdDev.

    // Actually simpler standard form:
    // Sum = sum_{k=0}^{M} R_{i+k*m} * R_{i+(k+1)*m}
    // rho = (1/(M+1)) * Sum - 0.25
    // SD = sqrt(13M + 7) / (12(M+1))
    // Z = rho / SD.
    // Let's implement that.

    // Correct M: Number of valid pairs of form (k, k+lag)
    // For lag 1: (0,1), (1,2)... (N-2, N-1). N-1 pairs.
    // Let's designate N_pairs.

    const pairs: Array<{ x: number, y: number }> = []
    let sumProd = 0

    // Using all non-overlapping pairs? Or overlapping?
    // Banks et al use: start index i. "Test implies looking at sub-sequence".
    // Usually we test *all* pairs (Overlapping) for Lag m.
    // Let's assume standard lag-m autocorrelation.
    // Pairs: (x_j, x_{j+m}) for j=0 to N-1-m.

    for (let j = 0; j < N - lag; j++) {
        const x = numbers[j]
        const y = numbers[j + lag]
        pairs.push({ x, y })
        sumProd += x * y
    }

    const N_pairs = pairs.length

    // Core Formula from Banks (Discrete Event System Simulation):
    // rho_hat = ( (1 / N_pairs) * sumProd ) - 0.25
    // sigma_rho = sqrt(13 * N_pairs + 7) / (12 * (N_pairs + 1))
    // Z = rho_hat / sigma_rho

    const rho_hat = (sumProd / N_pairs) - 0.25
    const sigma_rho = Math.sqrt(13 * N_pairs + 7) / (12 * (N_pairs + 1))

    const zStat = rho_hat / sigma_rho
    const criticalValue = Z_CRITICAL_TABLE['0.05'] || 1.96

    // Two-tailed test: -Z < zStat < Z
    const isIndependent = Math.abs(zStat) <= criticalValue

    return {
        pairs,
        correlation: rho_hat,
        variance: sigma_rho,
        zStat,
        criticalValue,
        isIndependent,
        N
    }
}
