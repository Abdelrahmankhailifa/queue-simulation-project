export const formatDigit = (n: number) => (n === 100 ? '00' : n.toString().padStart(2, '0'))

