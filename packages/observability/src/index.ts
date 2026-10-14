type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Minimal structured logger. Swap for pino/OTel later behind the same shape.
 * Never log secrets; redact known-sensitive keys.
 */
const REDACT = /(authorization|api[-_]?key|secret|private[-_]?key|seed|password|token)/i;

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT.test(k) ? '[REDACTED]' : v;
  }
  return out;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(
  bindings: Record<string, unknown> = {},
  minLevel: Level = (process.env.LOG_LEVEL as Level) || 'info',
): Logger {
  const log = (level: Level, msg: string, meta?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[minLevel]) return;
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg,
      ...redact({ ...bindings, ...meta }),
    });
    if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
  };

  return {
    debug: (m, x) => log('debug', m, x),
    info: (m, x) => log('info', m, x),
    warn: (m, x) => log('warn', m, x),
    error: (m, x) => log('error', m, x),
    child: (b) => createLogger({ ...bindings, ...b }, minLevel),
  };
}

export const logger = createLogger({ app: 'micow' });
