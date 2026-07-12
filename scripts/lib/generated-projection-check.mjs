export function serializeGeneratedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function assertGeneratedTextCurrent(name, expected, current) {
  if (current !== expected) {
    throw new Error(`${name} drift detected`);
  }
}

export function assertGeneratedJsonCurrent(name, expected, current) {
  assertGeneratedTextCurrent(name, serializeGeneratedJson(expected), current);
}
