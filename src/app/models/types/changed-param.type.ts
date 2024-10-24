import { ISelectedParams } from '../interfaces/selected-params.interface';

export type TChangedParam = 'coordinates' | keyof Omit<ISelectedParams, 'id'>;
