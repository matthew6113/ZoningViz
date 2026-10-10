// Minimal argv parsing for the Node CLIs. node:util parseArgs treats negative
// numbers (longitudes) as flags, so this is hand-rolled.
export interface ParsedArgs {
  flags: Set<string>;
  values: Map<string, string>;
  positionals: string[];
}

export function parseCliArgs(argv: string[], booleanFlags: string[], valueFlags: string[] = []): ParsedArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!/^--?[a-z]/i.test(arg)) {
      positionals.push(arg);
    } else if (valueFlags.includes(arg)) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      values.set(arg, value);
    } else if (booleanFlags.includes(arg)) {
      flags.add(arg);
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
  }
  return { flags, values, positionals };
}
