import { Queue } from '../classes/queue';
import { TCache } from '../types/cache.type';
import { TChangedParam } from '../types/changed-param.type';
import { IZone } from './zone.interface';

export interface IOptions {
  id: IZone['id'];
  name: IZone['name'];
  bbox: IZone['bbox'];
  new: boolean;
  default: {
    coordinates: IZone['coordinates'];
    bbox: IZone['bbox'];
    name: IZone['name'];
    color: IZone['color'];
  };
  cache: {
    index: number;
    queue: Queue<TCache>;
  };
  manipulations: {
    caches: boolean;
    computing: boolean;
    drag: boolean;
  };
  changes: Set<TChangedParam>;
}
