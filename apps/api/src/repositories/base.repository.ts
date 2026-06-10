type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type Transformable = Primitive | Date | Transformable[] | { [key: string]: Transformable };

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export abstract class BaseRepository {
  protected toCamelCase<T>(dbRow: Transformable): T {
    return this.transformKeys(dbRow, toCamelKey, true) as T;
  }

  protected toSnakeCase<T>(entity: Transformable): T {
    return this.transformKeys(entity, toSnakeKey, false) as T;
  }

  private transformKeys(
    value: Transformable,
    transformKey: (key: string) => string,
    convertDates: boolean,
  ): Transformable {
    if (Array.isArray(value)) {
      return value.map((item) => this.transformKeys(item, transformKey, convertDates));
    }

    if (value instanceof Date || value === null || value === undefined) {
      return value;
    }

    if (typeof value !== 'object') {
      return convertDates && isIsoDateString(value) ? new Date(value) : value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        transformKey(key),
        this.transformKeys(nestedValue, transformKey, convertDates),
      ]),
    );
  }
}

function toCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

function toSnakeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function isIsoDateString(value: Primitive): value is string {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}
