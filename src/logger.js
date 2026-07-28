/**
 * Lightweight structured logger for the automation workflow.
 *
 * @param {string} scope - Logical scope for log messages.
 * @returns {{ info: Function, warn: Function, error: Function, debug: Function }} Logger instance.
 */
export function createLogger(scope = 'app') {
  const write = (level, message, details) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${scope}]`;

    if (details instanceof Error) {
      console.log(`${prefix} ${message}\n${details.stack || details.message}`);
      return;
    }

    if (details && typeof details === 'object') {
      console.log(`${prefix} ${message} ${JSON.stringify(details)}`);
      return;
    }

    if (typeof details !== 'undefined') {
      console.log(`${prefix} ${message} ${details}`);
      return;
    }

    console.log(`${prefix} ${message}`);
  };

  return {
    info(message, details) {
      write('INFO', message, details);
    },
    warn(message, details) {
      write('WARN', message, details);
    },
    error(message, details) {
      write('ERROR', message, details);
    },
    debug(message, details) {
      write('DEBUG', message, details);
    }
  };
}

export const logger = createLogger('cause-list');

export default logger;