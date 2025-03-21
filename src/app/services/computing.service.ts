import { Injectable } from '@angular/core';
import { TBbox } from '../models/types/bbox.type';
import { TPoint } from '../models/types/point.type';

@Injectable({
  providedIn: 'root',
})
export class ComputingService {
  findVertexIndex = (
    oldCoordinates: TPoint[],
    newCoordinates: TPoint[]
  ): number => {
    let index = 0;

    if (!oldCoordinates.length) {
      return index;
    }

    for (let i = 0; i < newCoordinates.length; i++) {
      if (oldCoordinates[i] === undefined) {
        index = i;
        break;
      }

      const isSame = this.isSamePoints(oldCoordinates[i], newCoordinates[i]);

      if (isSame) {
        continue;
      }

      index = i;
      break;
    }

    return index;
  };

  checkIsSameCoordinates = (first: TPoint[], second: TPoint[]): boolean => {
    return first.every((point, index) =>
      this.isSamePoints(point, second[index])
    );
  };

  deleteSamePoints = (coordinates: TPoint[]): TPoint[] => {
    const hash = new Set<string>(
      coordinates.map((point) => JSON.stringify(point))
    );

    const newCoordinates: TPoint[] = Array.from(hash).map((point) =>
      JSON.parse(point)
    );

    return [...newCoordinates, newCoordinates[0]];
  };

  isSamePoints = (first: TPoint, second: TPoint): boolean => {
    return first[0] === second[0] && first[1] === second[1];
  };

  isPointInBBox = (point: TPoint, bbox: TBbox): boolean => {
    if (!point || !bbox) {
      return false;
    }

    const [southWest, northEast] = bbox;
    const [southWestLongitude, southWestLatitude] = southWest;
    const [northEastLongitude, northEastLatitude] = northEast;
    const [pointLongitude, pointLatitude] = point;

    return (
      pointLongitude >= southWestLongitude &&
      pointLongitude <= northEastLongitude &&
      pointLatitude >= southWestLatitude &&
      pointLatitude <= northEastLatitude
    );
  };

  isPointInPolygon = (point: TPoint, coordinates: TPoint[]): boolean => {
    const x = point[0];
    const y = point[1];
    let isInside = false;

    for (
      let i = 0, j = coordinates.length - 1;
      i < coordinates.length;
      j = i++
    ) {
      const xi = coordinates[i][0];
      const yi = coordinates[i][1];
      const xj = coordinates[j][0];
      const yj = coordinates[j][1];

      const isIntersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (isIntersect) {
        isInside = !isInside;
      }
    }

    return isInside;
  };

  isBBoxesIntersected = (zoneBbox: TBbox, screenBbox: TBbox): boolean => {
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

  getBboxCenter = (bbox: TBbox): TPoint => {
    const [southWest, northEast] = bbox;
    const [minLon, minLat] = southWest;
    const [maxLon, maxLat] = northEast;

    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    return [centerLon, centerLat];
  };

  getClosestPoint(targetPoint: TPoint, coordinates: TPoint[]): TPoint {
    let closestPoint = coordinates[0];
    let minDistance = Infinity;

    for (const point of coordinates) {
      const distance = this._getDistance(targetPoint, point);

      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    return closestPoint;
  }

  private _getDistance = (first: TPoint, second: TPoint): number => {
    const distanceLongitude = second[0] - first[0];
    const distanceLatitude = second[1] - first[1];

    return Math.sqrt(
      distanceLongitude * distanceLongitude +
        distanceLatitude * distanceLatitude
    );
  };
}
