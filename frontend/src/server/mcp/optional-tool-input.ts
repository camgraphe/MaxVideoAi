type NullishKeys<T extends Record<string, unknown>> = {
  [Key in keyof T]-?: null extends T[Key]
    ? Key
    : undefined extends T[Key]
      ? Key
      : never;
}[keyof T];

export type WithoutNullishValues<T extends Record<string, unknown>> = {
  [Key in Exclude<keyof T, NullishKeys<T>>]: T[Key];
} & {
  [Key in NullishKeys<T>]?: Exclude<T[Key], null | undefined>;
};

export function omitNullishToolInput<T extends Record<string, unknown>>(
  input: T,
): WithoutNullishValues<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== undefined),
  ) as WithoutNullishValues<T>;
}
