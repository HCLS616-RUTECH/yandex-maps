import { IZone } from './zone.interface';

export interface IChangeZonesRequest {
  new: IZone[];
  edited: IZone[];
  deleted: string[];
}
