import { TBbox } from '../../../models/types/bbox.type';
import { TPoint } from '../../../models/types/point.type';
import { ActionStore } from '../../../stores/action.store';
import { ChangesStore } from '../../../stores/changes.store';
import { MapSourcesStore } from '../../../stores/map-sources.store';
import { SelectedStore } from '../../../stores/selected.store';
import { ComputingService } from '../../computing.service';
import { MainManager } from '../../main.manager';
import { IntersectionsExtension } from './main.intersections.extension';
import { PolygonExtension } from './main.polygon.extension';
import { PolylineExtension } from './main.polyline.extension';

export class MainHandlersExtension {
  constructor(
    private readonly _main: MainManager,
    private readonly _polyline: PolylineExtension,
    private readonly _polygon: PolygonExtension,
    private readonly _intersections: IntersectionsExtension,
    private readonly _computing: ComputingService,
    private readonly _sources: MapSourcesStore,
    private readonly _changes: ChangesStore,
    private readonly _action: ActionStore,
    private readonly _selected: SelectedStore
  ) {}

  draw = (event: any): void => {
    const { oldCoordinates, newCoordinates } = event.originalEvent;

    let vertexIndex = 0;

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        vertexIndex = this._computing.findVertexIndex(
          oldCoordinates,
          newCoordinates
        );
        break;
      case 'DRAWING_POLYGON':
        vertexIndex = this._computing.findVertexIndex(
          oldCoordinates[0] ?? [],
          newCoordinates[0]
        );
        break;
    }

    this._checkPoint(vertexIndex);

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        this._polyline.update();
        break;
      case 'DRAWING_POLYGON':
        this._polygon.update();
        break;
    }
  };

  geometryChange = (event: any): void => {
    if (this._selected.manipulations.drag) {
      return;
    }

    if (this._selected.manipulations.computing) {
      return;
    }

    this._selected.manipulations = { computing: true };

    const { oldCoordinates, newCoordinates } =
      event.originalEvent.originalEvent.originalEvent;

    const vertexIndex = this._computing.findVertexIndex(
      oldCoordinates[0],
      newCoordinates[0]
    );

    this._checkPoint(vertexIndex);

    this._intersections.check(this._selected.state);

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');

    this._selected.manipulations = { computing: false };
  };

  dragend = (event: any): void => {
    const coordinates = this._selected.coordinates;
    const result: { [key: string]: TPoint[] } = {};

    for (let i = 0; i < coordinates.length; i++) {
      const current = this._checkCoordinates(i, coordinates);

      if (current) {
        result[i] = current;
      }
    }

    const indexes = Object.keys(result);

    if (indexes.length) {
      let newCoordinates = coordinates;

      indexes.forEach(
        // @ts-ignore
        (index) => (newCoordinates[index] = result[index][index])
      );

      this._main.setNewParams({
        coordinates: [this._computing.deleteSamePoints(newCoordinates)],
      });
    } else {
      this._selected.check({ coordinates: [coordinates] });
    }

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');

    this._intersections.check(this._selected.state);

    this._selected.manipulations = { drag: false };
  };

  private _checkPoint = (vertexIndex: number): void => {
    let coordinates: TPoint[] = [];

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        coordinates = this._polyline.coordinates;
        break;
      case 'DRAWING_POLYGON':
        coordinates = this._polygon.coordinates;
        break;
      case 'EDITING_POLYGON':
        coordinates = this._selected.coordinates;
        break;
    }

    const checkResult = this._checkCoordinates(vertexIndex, coordinates);

    if (checkResult) {
      switch (this._action.state) {
        case 'DRAWING_POLYLINE':
          this._polyline.coordinates = checkResult;
          break;
        case 'DRAWING_POLYGON':
          this._polygon.coordinates = checkResult;
          break;
        case 'EDITING_POLYGON':
          this._main.setNewParams({ coordinates: [checkResult] });
          break;
      }
    }

    if (!checkResult && this._action.state === 'EDITING_POLYGON') {
      this._selected.check({ coordinates: [this._selected.coordinates] });
    }
  };

  private _checkCoordinates = (
    vertexIndex: number,
    coordinates: TPoint[]
  ): TPoint[] | null => {
    let result: TPoint[] | null = null;

    const newPoint = coordinates[vertexIndex];

    const polygons = this._sources.values('POLYGONS_ALL');

    for (let i = 0; i < polygons.length; i++) {
      if (
        polygons[i].properties.get('id') ===
        this._selected.state?.properties.get('id')
      ) {
        continue;
      }

      const bbox = polygons[i].properties.get('bbox') as never as TBbox;

      if (!this._computing.isPointInBBox(newPoint, bbox)) {
        continue;
      }

      const isPointInPolygon = this._computing.isPointInPolygon(
        newPoint,
        polygons[i].geometry.getCoordinates()[0]
      );

      if (isPointInPolygon) {
        const closestPoint = this._computing.getClosestPoint(
          newPoint,
          polygons[i].geometry.getCoordinates()[0]
        );

        if (
          this._computing.isSamePoints(coordinates[vertexIndex], closestPoint)
        ) {
          continue;
        }

        switch (this._action.state) {
          case 'DRAWING_POLYLINE':
            result = this._changeCoordinatesForPolyline(
              vertexIndex,
              coordinates,
              closestPoint
            );
            break;
          case 'DRAWING_POLYGON':
          case 'EDITING_POLYGON':
          case 'DRAG_POLYGON':
            result = this._changeCoordinatesForPolygon(
              vertexIndex,
              coordinates,
              closestPoint
            );
            break;
        }

        break;
      }
    }

    return result;
  };

  private _changeCoordinatesForPolyline = (
    vertexIndex: number,
    coordinates: TPoint[],
    closestPoint: TPoint
  ): TPoint[] => {
    let newCoordinates = coordinates.slice();

    newCoordinates[vertexIndex] = closestPoint;

    if (newCoordinates.length > 1) {
      const isSamePoint = !!vertexIndex
        ? this._computing.isSamePoints(
            coordinates[vertexIndex - 1],
            closestPoint
          )
        : this._computing.isSamePoints(
            coordinates[vertexIndex + 1],
            closestPoint
          );

      if (isSamePoint) {
        newCoordinates = !!vertexIndex
          ? newCoordinates.slice(0, coordinates.length - 1)
          : newCoordinates.slice(1, coordinates.length);
      }
    }

    return newCoordinates;
  };

  private _changeCoordinatesForPolygon = (
    vertexIndex: number,
    coordinates: TPoint[],
    closestPoint: TPoint
  ): TPoint[] => {
    if (vertexIndex === 0 && coordinates.length < 3) {
      return [closestPoint, closestPoint];
    }

    let newCoordinates = coordinates.slice();

    if (vertexIndex === 0) {
      newCoordinates[0] = closestPoint;
      newCoordinates[newCoordinates.length - 1] = closestPoint;
    } else {
      newCoordinates[vertexIndex] = closestPoint;
    }

    const isSamePoint =
      vertexIndex !== 0
        ? this._computing.isSamePoints(
            coordinates[vertexIndex],
            coordinates[vertexIndex - 1]
          )
        : this._computing.isSamePoints(
            coordinates[vertexIndex],
            coordinates[vertexIndex + 1]
          );

    if (isSamePoint) {
      newCoordinates =
        vertexIndex !== 0
          ? newCoordinates
              .slice(0, vertexIndex - 1)
              .concat(newCoordinates.slice(vertexIndex, newCoordinates.length))
          : [
              closestPoint,
              ...newCoordinates.slice(1, newCoordinates.length - 1),
              closestPoint,
            ];
    }

    return newCoordinates;
  };
}
