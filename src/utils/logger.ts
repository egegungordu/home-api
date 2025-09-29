type Level = 'debug' | 'info' | 'warn' | 'error'

const levelOrder: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = (process.env.LOG_LEVEL as Level) || 'info'

function shouldLog(level: Level): boolean {
  return levelOrder[level] >= levelOrder[configuredLevel]
}

export const logger = {
  debug: (...args: unknown[]) => shouldLog('debug') && console.debug(...args),
  info: (...args: unknown[]) => shouldLog('info') && console.info(...args),
  warn: (...args: unknown[]) => shouldLog('warn') && console.warn(...args),
  error: (...args: unknown[]) => shouldLog('error') && console.error(...args),
}


