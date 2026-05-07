import { Decimal } from 'decimal.js';
export declare class Ingredient {
    id: string;
    name: string;
    baseUnit: string;
    parent: Ingredient | null;
    parentId: string | null;
    children: Ingredient[];
    isGlobal: boolean;
    normalizedName: string;
    synonyms: string | null;
    createdBy: string | null;
    hierarchyLevel: number;
    density: Decimal;
    allowMassVolumeConversion: boolean;
    normalizeName(): void;
}
