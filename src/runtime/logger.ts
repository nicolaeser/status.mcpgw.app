type LogFields = Record<string, boolean | number | string | null | undefined>;
export type LoggingMode = "none" | "standard";

interface LogOptions {
  privacySafe?: boolean;
}

let loggingMode: LoggingMode = "standard";

export function configureLogger(mode: LoggingMode): void {
  loggingMode = mode;
}

function formatFields(fields: LogFields = {}): string {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function write(
  level: "error" | "info" | "warn",
  message: string,
  fields?: LogFields,
  options: LogOptions = {},
): void {
  const outputFields =
    loggingMode === "none" && !options.privacySafe ? undefined : fields;
  const line = `[${level}] ${message}${formatFields(outputFields)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields, options?: LogOptions) =>
    write("info", message, fields, options),
  warn: (message: string, fields?: LogFields, options?: LogOptions) =>
    write("warn", message, fields, options),
  error: (message: string, fields?: LogFields, options?: LogOptions) =>
    write("error", message, fields, options),
};
