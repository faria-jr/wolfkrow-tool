/**
 * Base para value objects imutáveis com equality por valor (value semantics).
 * Subclasses validam no `static create()` e expõem construtor privado.
 */
export abstract class ValueObject<T> {
  protected constructor(readonly value: T) {}

  equals(other: unknown): boolean {
    if (!(other instanceof ValueObject)) return false;
    if (Array.isArray(this.value) && Array.isArray(other.value)) {
      return arraysEqual(this.value, other.value);
    }
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }

  hashCode(): string {
    return JSON.stringify(this.value);
  }
}

function arraysEqual(a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
