import { ValueTransformer } from 'typeorm';

export class ColumnFloatTransformer implements ValueTransformer {
  to(data: number | null | undefined): string | null {
    if (data === null || data === undefined) {
      return null;
    }
    return data.toString();
  }

  from(data: string | null | undefined): number | null {
    if (data === null || data === undefined) {
      return null;
    }
    const parsed = parseFloat(data);
    return isNaN(parsed) ? null : parsed;
  }
}
