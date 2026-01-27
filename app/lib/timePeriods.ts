// Time period constants in milliseconds
// These can be easily changed to adjust the pricing redirect logic

export const TIME_PERIODS = {
  MINUTE: 60 * 1000,        // 1 minute
  HOUR: 60 * 60 * 1000,     // 1 hour
  DAY: 24 * 60 * 60 * 1000, // 1 day
  THREE_DAYS: 3 * 24 * 60 * 60 * 1000, // 3 days
  WEEK: 7 * 24 * 60 * 60 * 1000, // 1 week
} as const

// Default time period to check for redirecting to pricing page
// Change this to TIME_PERIODS.MINUTE, HOUR, DAY, or WEEK
export const PRICING_REDIRECT_THRESHOLD = TIME_PERIODS.THREE_DAYS

