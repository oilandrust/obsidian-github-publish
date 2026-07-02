const PREFIX = '[GitHub Publish]';

export function log(message: string, ...details: unknown[]): void {
  if (details.length > 0) {
    console.log(PREFIX, message, ...details);
  } else {
    console.log(PREFIX, message);
  }
}

export function logWarn(message: string, ...details: unknown[]): void {
  if (details.length > 0) {
    console.warn(PREFIX, message, ...details);
  } else {
    console.warn(PREFIX, message);
  }
}

export function logError(message: string, ...details: unknown[]): void {
  if (details.length > 0) {
    console.error(PREFIX, message, ...details);
  } else {
    console.error(PREFIX, message);
  }
}
