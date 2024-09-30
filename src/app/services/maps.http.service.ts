import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { debounceTime, Observable, of } from 'rxjs';
import { IChangeZonesRequest } from '../models/interfaces/change-zones-request.interface';
import { IZone } from '../models/interfaces/zone.interface';
import { TBbox } from '../models/types/bbox.type';

@Injectable({
  providedIn: 'root',
})
export class MapsHttpService {
  constructor(private readonly _http: HttpClient) {}

  getZones(bbox: TBbox): Observable<IZone[]> {
    return of(this._emitHttpGetZones(bbox)).pipe(debounceTime(2000));
  }

  saveChanges(body: IChangeZonesRequest): Observable<void> {
    this._emitHttpSaveChanges(body);

    return of().pipe(debounceTime(1000));
  }

  private _emitHttpSaveChanges(body: IChangeZonesRequest): void {
    const zones: IZone[] = JSON.parse(localStorage.getItem('zones') ?? '[]');

    const changedZones: IZone[] = body.new;

    for (let zone of zones) {
      if (body.deleted.includes(zone.id)) {
        continue;
      }

      zone =
        body.edited.find((editedZone) => editedZone.id === zone.id) ?? zone;

      changedZones.push(zone);
    }

    localStorage.setItem('zones', JSON.stringify(changedZones));
  }

  private _emitHttpGetZones(bbox: TBbox): IZone[] {
    const zones: IZone[] = JSON.parse(localStorage.getItem('zones') ?? '[]');

    return zones.filter((zone) => this._isBBoxIntersect(zone.bbox, bbox));
  }

  private _isBBoxIntersect = (zoneBbox: TBbox, screenBbox: TBbox) => {
    const [zoneBboxSouthWest, zoneBboxNorthEast] = zoneBbox;
    const [screenBboxSouthWest, screenBboxNorthEast] = screenBbox;

    const isLatOverlap =
      zoneBboxSouthWest[0] <= screenBboxNorthEast[0] &&
      zoneBboxNorthEast[0] >= screenBboxSouthWest[0];
    const isLngOverlap =
      zoneBboxSouthWest[1] <= screenBboxNorthEast[1] &&
      zoneBboxNorthEast[1] >= screenBboxSouthWest[1];

    return isLatOverlap && isLngOverlap;
  };
}
