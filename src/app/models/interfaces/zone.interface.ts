import { TBbox } from '../types/bbox.type';
import { TPoint } from '../types/point.type';

export interface IZone {
  id: string;
  name: string;
  color: string;
  coordinates: Array<TPoint[]>;
  bbox: TBbox;
}
