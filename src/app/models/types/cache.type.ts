import { IZone } from '../interfaces/zone.interface';

export type TCache = Omit<IZone, 'id' | 'bbox'>;
