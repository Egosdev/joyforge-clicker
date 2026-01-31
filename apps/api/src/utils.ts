export function normalizeCaseInsensitiveName(input: string): { display: string; lower: string } {
  const display = input.trim();
  const lower = display.toLocaleLowerCase('en-US');
  return { display, lower };
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
