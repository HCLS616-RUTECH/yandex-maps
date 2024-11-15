import { IZone } from '../interfaces/zone.interface';

export type TChangedParam = keyof Omit<IZone, 'id' | 'bbox'>;
