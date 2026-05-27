const timestamps = {}

export function rateLimit(key, minIntervalMs = 1000) {
  const now = Date.now()
  const last = timestamps[key] || 0
  if (now - last < minIntervalMs) return false
  timestamps[key] = now
  return true
}
