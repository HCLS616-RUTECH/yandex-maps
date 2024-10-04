import { Injectable, signal } from '@angular/core';
import { debounceTime, Subject, switchMap, take } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { IPointActions } from '../models/interfaces/point-actions.interface';
import { IZone } from '../models/interfaces/zone.interface';
import { TActionState } from '../models/types/action-state.type';
import { TBbox } from '../models/types/bbox.type';
import { TFigureEvent } from '../models/types/figure-event.type';
import { TPoint } from '../models/types/point.type';
import { ActionStore } from '../stores/action.store';
import { ChangesStore } from '../stores/changes.store';
import { SelectedStore } from '../stores/selected.store';
import { VisualParamsStore } from '../stores/visual-params.store';
import { ComputingService } from './computing.service';
import { MapsHttpService } from './maps.http.service';

@Injectable({
  providedIn: 'root',
})
export class MapsService {
  vertexCount = signal<number>(0);

  private _map: any;

  // private _action: TActionState = 'EMPTY';
  private _lastFigureEvent: TFigureEvent = 'empty';
  private _polyline: any | null = null;
  private _polygon: any | null = null;
  // private _dash: any | null = null;
  // private _placemark: any | null = null;

  private _isAddingPolygons = false;

  private readonly _polygons = new Map<string, any>();
  private readonly _visiblePolygons = new Map<string, any>();
  private readonly _zones = new Map<string, IZone>();

  private readonly _request$ = new Subject<TBbox>();

  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor(
    private readonly _http: MapsHttpService,
    private readonly _computing: ComputingService,
    private readonly _changes: ChangesStore,
    private readonly _action: ActionStore,
    private readonly _selected: SelectedStore,
    private readonly _visualParams: VisualParamsStore
  ) {}

  initMap(): void {
    this.YANDEX_MAPS.ready(() => {
      const { center, zoom, maxZoom, minZoom } = this._visualParams.map;

      this._map = new this.YANDEX_MAPS.Map(
        'map',
        { center, zoom },
        { minZoom, maxZoom }
      );

      this._map.controls.add('zoomControl', {
        size: 'small',
      });

      this._request$
        .pipe(
          debounceTime(300),
          switchMap((bbox) => this._http.getZones(bbox))
        )
        .subscribe({
          next: (zones) => this._addNewPolygons(zones),
        });

      this._map.events.add('boundschange', (e: any) =>
        this._request$.next(this._map.getBounds())
      );

      // this._map.events.add('click', (event: any) =>
      //   console.log(event.get('coords'))
      // );

      this._request$.next(this._map.getBounds());
    });
  }

  setActionState(state: TActionState): void {
    switch (state) {
      case 'DRAWING_POLYLINE':
        this._drawingPolyline();
        break;
      case 'DRAWING_POLYGON':
        this._drawingPolygon();
        break;
      case 'EDITING_POLYGON':
        this._editPolygon();
        break;
      case 'DELETE_POLYGON':
        this._deletePolygon();
        break;
      case 'DRAG_POLYGON':
        this._dragPolygon();
        break;
    }
  }

  updateZones(): void {
    this._polygons.forEach((polygon) => this._map.geoObjects.remove(polygon));
    this._polygons.clear();
    this._visiblePolygons.clear();
    this._changes.state.new.forEach((polygon) =>
      this._map.geoObjects.remove(polygon)
    );
    this._changes.clear();
    this._clearPreviousActionsState();
    this._action.state = 'EMPTY';
    this._request$.next(this._map.getBounds());
  }

  saveChanges(): void {
    const body = this._changes.requestBody;

    this._http.saveChanges(body).pipe(take(1)).subscribe();
  }

  private _addNewPolygons(zones: IZone[]): void {
    const changes = this._changes.state;
    this._zones.clear();

    this._isAddingPolygons = true;

    const newPolygons: Polygon[] = [];

    for (let zone of zones) {
      if (changes.deleted.has(zone.id)) {
        continue;
      }

      this._zones.set(zone.id, zone);

      const visiblePolygon = this._visiblePolygons.get(zone.id);

      if (visiblePolygon) {
        // Чинит багу яндекс карт, при которой не до конца отрисовывается полигон, при движении экрана по картам
        visiblePolygon.options.set(
          'fillColor',
          visiblePolygon.options.get('fillColor')
        );
        continue;
      }

      if (this._polygons.has(zone.id)) {
        this._visiblePolygons.set(zone.id, this._polygons.get(zone.id));
        this._map.geoObjects.add(this._polygons.get(zone.id));
        newPolygons.push(this._polygons.get(zone.id));
        continue;
      }

      const polygon = new this.YANDEX_MAPS.Polygon(
        zone.coordinates,
        { id: zone.id, name: zone.name, bbox: zone.bbox, new: false },
        {
          ...this._visualParams.stroke,
          fillColor: zone.color,
        }
      );

      this._initPolygonActions(polygon);

      newPolygons.push(polygon);
      this._polygons.set(zone.id, polygon);
      this._visiblePolygons.set(zone.id, this._polygons.get(zone.id));
      this._map.geoObjects.add(polygon);
    }

    this._visiblePolygons.forEach((polygon, id) => {
      if (!this._zones.has(id) && !changes.new.has(id)) {
        this._map.geoObjects.remove(polygon);
        this._visiblePolygons.delete(id);
      }
    });

    changes.new.forEach((polygon, id) => {
      const isBboxesIntersected = this._computing.isBBoxesIntersected(
        changes.new.get(id).properties.get('bbox') as never as TBbox,
        this._map.getBounds()
      );

      if (!isBboxesIntersected && this._visiblePolygons.has(id)) {
        this._map.geoObjects.remove(polygon);
        this._visiblePolygons.delete(id);
      }

      if (isBboxesIntersected && !this._visiblePolygons.has(id)) {
        this._visiblePolygons.set(id, this._polygons.get(id));
        this._map.geoObjects.add(polygon);
        newPolygons.push(polygon);
      }
    });

    this._visualParams.animatePolygons(newPolygons);

    this._isAddingPolygons = false;
  }

  private _drawingPolygon(): void {
    this._clearPreviousActionsState();

    this._action.state = 'DRAWING_POLYGON';

    this._action.state === 'DRAWING_POLYGON'
      ? this._startDrawingPolygon()
      : this._endDrawingPolygon();
  }

  private _startDrawingPolygon(): void {
    if (this._polyline) {
      this._clearPolyLine();
    }

    this._polygon = new this.YANDEX_MAPS.Polygon(
      [],
      {},
      {
        ...this._visualParams.strokeSelected,
        fillColor: this._visualParams.newColor,
      }
    );

    this._map.geoObjects.add(this._polygon);
    this._polygon.editor.startDrawing();

    this._polygon.editor.events.add('vertexadd', this._newVertexHandler);
  }

  private _endDrawingPolygon(): void {
    const coordinates = this._polygon.geometry.getCoordinates()[0];

    if (coordinates.length < 4) {
      this._clearPolygon();
      return;
    }

    this._polygon.options.set('fillColor', this._visualParams.baseColor);

    const id = this._getPolygonId(this._polygon);
    this._polygon.properties.set({
      id,
      name: `Новая зона ${id}`,
      bbox: this._polygon.geometry.getBounds(),
      new: true,
    });

    this._changes.create(this._polygon);

    this._initPolygonActions(this._polygon);

    this._selected.state = this._polygon;

    this._polygon.editor.stopDrawing();

    this.setActionState('EDITING_POLYGON');

    this._polygons.set(id, this._polygon);
    this._visiblePolygons.set(id, this._polygon);

    this._polygon = null;
  }

  private _clearPolygon(): void {
    this._polygon.editor.stopDrawing();
    this._polygon.events.remove('vertexadd', this._newVertexHandler);
    this._map.geoObjects.remove(this._polygon);
    this._polygon = null;
  }

  private _drawingPolyline(): void {
    this._clearPreviousActionsState();

    if (this._polygon) {
      this._clearPolygon();
    }

    this._action.state = 'DRAWING_POLYLINE';

    this._action.state === 'DRAWING_POLYLINE'
      ? this._startDrawingPolyline()
      : this._endDrawingPolyline();
  }

  private _startDrawingPolyline(): void {
    this._polyline = new this.YANDEX_MAPS.Polyline(
      [],
      {},
      {
        ...this._visualParams.strokeSelected,
        editorMenuManager: (actions: IPointActions[]) => {
          const isPolyLineStartOrEnd = !!actions.find(
            (action) => action.title === 'Продолжить'
          );
          const { length } = this._polyline.geometry.getCoordinates();

          if (isPolyLineStartOrEnd && length > 2) {
            actions.push({
              title: 'Замкнуть полигон',
              onClick: () => {
                this._action.state = 'EMPTY';
                this._endDrawingPolyline();
              },
            });
          }

          return actions;
        },
      }
    );

    this._polyline.editor.events.add('vertexadd', this._newVertexHandler);

    this._map.geoObjects.add(this._polyline);
    this._polyline.editor.startEditing();
    this._polyline.editor.startDrawing();
  }

  private _endDrawingPolyline(): void {
    const coordinates = this._polyline.geometry.getCoordinates();

    if (coordinates.length > 2) {
      coordinates.push(coordinates[0]);

      const polygon = new this.YANDEX_MAPS.Polygon(
        [coordinates],
        {},
        {
          ...this._visualParams.strokeSelected,
          fillColor: this._visualParams.baseColor,
        }
      );

      this._map.geoObjects.add(polygon);

      const id = this._getPolygonId(polygon);
      polygon.properties.set({
        id,
        name: `Новая зона ${id}`,
        bbox: polygon.geometry.getBounds(),
        new: true,
      });

      this._changes.create(polygon);

      this._initPolygonActions(polygon);

      this._selected.state = polygon;
      this.setActionState('EDITING_POLYGON');

      this._polygons.set(id, polygon);
      this._visiblePolygons.set(id, polygon);
    }

    this._clearPolyLine();
  }

  private _clearPolyLine(): void {
    this._polyline.editor.stopEditing();
    this._polyline.editor.stopDrawing();
    this._polyline.events.remove('vertexadd', this._newVertexHandler);
    this._map.geoObjects.remove(this._polyline);
    this._polyline = null;
  }

  private _editPolygon(): void {
    const selected = this._selected.state;
    if (!selected) {
      return;
    }

    this._action.state = 'EDITING_POLYGON';

    const draggable = selected.properties.get('draggable') as never as boolean;
    if (draggable) {
      selected.options.set('fillColor', this._visualParams.colorCache);
    }

    this._action.state === 'EDITING_POLYGON'
      ? selected.editor.startEditing()
      : selected.editor.stopEditing();

    this._action.state === 'EDITING_POLYGON'
      ? this.vertexCount.set(selected.geometry?.getCoordinates()[0].length ?? 0)
      : this.vertexCount.set(0);
  }

  private _deletePolygon(): void {
    const selected = this._selected.state;
    if (!selected) {
      return;
    }

    this._polygons.delete(selected.properties.get('id') as never as string);
    this._changes.delete(selected);
    this._map.geoObjects.remove(selected);
  }

  private _dragPolygon(): void {
    const selected = this._selected.state;
    if (!selected) {
      return;
    }

    this._action.state = 'DRAG_POLYGON';

    selected.editor.stopEditing();

    if (this._action.state === 'DRAG_POLYGON') {
      // @ts-ignore
      selected.options.set('draggable', true);
      this._visualParams.colorCache = selected.options.get('fillColor');
      selected.options.set('fillColor', this._visualParams.dragColor);
    } else {
      // const id = selected.properties.get('id') as never as string;
      //
      // let color = '#00FF0088';
      //
      // const { changes } = this._changes;
      //
      // if (changes.new.has(id)) {
      //   color = changes.new.get(id).options.get('fillColor');
      // }
      //
      // if (changes.edited.has(id)) {
      //   color = changes.edited.get(id).options.get('fillColor');
      // }

      // const color = isNew ? this._changes.changes.new.get(id).options.get('fillColor') :
      // @ts-ignore
      selected.options.set('draggable', false);
      selected.options.set('fillColor', this._visualParams.colorCache);
    }

    this._visualParams.animatePolygons([selected]);
  }

  private _initPolygonActions = (polygon: Polygon): void => {
    polygon.events.add('click', (e: any) => {
      this._selected.state = e.originalEvent.target;
      if (!this._selected.state && this._action.state === 'EDITING_POLYGON') {
        e.originalEvent.target.editor.stopEditing();
        this._action.state = 'EMPTY';
      }
    });

    polygon.geometry?.events.add('change', (e: any) => {
      if (!this._isAddingPolygons) {
        this._changes.edit(polygon);
      }
    });

    polygon.editor.events.add('vertexadd', this._newVertexHandler);

    polygon.events.add('geometrychange', this._geometryChangeHandler);
  };

  private _getPolygonId(polygon: any): string {
    let id = '0';
    const keys = Object.keys(polygon);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].includes('id')) {
        id = (keys[i].match(/\d/g)?.join('') ?? '0') + polygon[keys[i]];
        i = keys.length;
      }
    }
    return id;
  }

  private _geometryChangeHandler = (event: any): void => {
    const isLastEventVertexAdd = this._lastFigureEvent === 'vertexadd';
    this._lastFigureEvent = 'geometrychange';

    this._selected.state?.properties.set({
      bbox: this._selected.state?.geometry.getBounds(),
    });

    if (isLastEventVertexAdd) {
      return;
    }

    const { oldCoordinates, newCoordinates } =
      event.originalEvent.originalEvent.originalEvent;

    if (oldCoordinates[0].length !== newCoordinates[0].length) {
      return;
    }

    for (let i = 0; i < newCoordinates[0].length; i++) {
      const isSame = this._computing.isSamePoints(
        oldCoordinates[0][i],
        newCoordinates[0][i]
      );

      if (isSame) {
        continue;
      }

      this._checkPoint(i);

      i = newCoordinates[0].length;
    }
  };

  private _newVertexHandler = (event: any): void => {
    this._lastFigureEvent = 'vertexadd';
    const { vertexIndex } = event.originalEvent;

    this._checkPoint(vertexIndex);
  };

  private _checkPoint = (vertexIndex: number): void => {
    let coordinates = [];

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        coordinates = this._polyline.geometry.getCoordinates();
        break;
      case 'DRAWING_POLYGON':
        coordinates = this._polygon.geometry.getCoordinates()[0];
        break;
      case 'EDITING_POLYGON':
        coordinates = this._selected.state.geometry.getCoordinates()[0];
        break;
    }

    this.vertexCount.set(coordinates.length);

    const checkResult = this._checkCoordinates(vertexIndex, coordinates);

    if (checkResult.changes) {
      switch (this._action.state) {
        case 'DRAWING_POLYLINE':
          this._polyline.geometry.setCoordinates(checkResult.coordinates);
          break;
        case 'DRAWING_POLYGON':
          this._polygon.geometry.setCoordinates([checkResult.coordinates]);
          break;
        case 'EDITING_POLYGON':
          this._selected.state.geometry.setCoordinates([
            checkResult.coordinates,
          ]);
          break;
      }
    }
  };

  private _checkCoordinates = (
    vertexIndex: number,
    coordinates: TPoint[]
  ): { changes: boolean; coordinates: TPoint[] } => {
    const result = { changes: false, coordinates };

    const newPoint = coordinates[vertexIndex];

    const polygons = Array.from(this._polygons.values());

    for (let i = 0; i < polygons.length; i++) {
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

        result.changes = true;

        switch (this._action.state) {
          case 'DRAWING_POLYLINE':
            result.coordinates = this._changeCoordinatesForPolyline(
              vertexIndex,
              coordinates,
              closestPoint
            );
            break;
          case 'DRAWING_POLYGON':
          case 'EDITING_POLYGON':
            result.coordinates = this._changeCoordinatesForPolygon(
              vertexIndex,
              coordinates,
              closestPoint
            );
            break;
        }

        i = polygons.length;
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

        this.vertexCount.set(coordinates.length);
      }
    }

    return newCoordinates;
  };

  private _changeCoordinatesForPolygon = (
    vertexIndex: number,
    coordinates: TPoint[],
    closestPoint: TPoint
  ): TPoint[] => {
    if (!vertexIndex) {
      return [closestPoint, closestPoint];
    }

    let newCoordinates = coordinates.slice();

    newCoordinates[vertexIndex] = closestPoint;

    const isSamePoint = this._computing.isSamePoints(
      coordinates[vertexIndex],
      coordinates[vertexIndex - 1]
    );

    if (isSamePoint) {
      newCoordinates = newCoordinates
        .slice(0, vertexIndex)
        .concat(newCoordinates.slice(vertexIndex, newCoordinates.length));

      this.vertexCount.set(coordinates.length);
    }

    return newCoordinates;
  };

  private _clearPreviousActionsState(): void {
    const selected = this._selected.state;

    if (selected) {
      this._selected.state = selected;
      // @ts-ignore
      selected.options.set('draggable', false);
      selected.options.set('fillColor', this._visualParams.colorCache);
      selected.editor.stopEditing();
    }
  }

  // private _initPlaceMark(): void {
  //   this._placemark = new this.YANDEX_MAPS.Placemark(
  //     [0, 0],
  //     {},
  //     {
  //       cursor: 'grab',
  //       iconLayout: 'default#imageWithContent',
  //       iconContentLayout: this.YANDEX_MAPS.templateLayoutFactory.createClass(
  //         '<div style="width: 15px; height: 15px; background-color: white; border: 1px solid black; border-radius: 50%;"></div>'
  //       ),
  //       iconImageSize: [15, 15],
  //       iconImageOffset: [-10, -10],
  //     }
  //   );
  //   this._map.geoObjects.add(this._placemark);
  //   this._map.events.add('mousemove', this._movePlaceMark);
  //   this._placemark.events.add('click', this._onPointClick);
  // }
  //
  // private _movePlaceMark = (e: any): void => {
  //   const coords = e.get('coords');
  //   this._placemark.geometry.setCoordinates(coords);
  // };

  // private _initDash(): void {
  //   this._dash = new this.YANDEX_MAPS.Polyline(
  //     [
  //       [0, 0],
  //       [0, 0],
  //     ],
  //     {},
  //     {
  //       strokeColor: '#00000088',
  //       strokeWidth: 3,
  //       strokeStyle: 'dash',
  //       editorMaxPoints: 2,
  //       // editorMenuManager: function (items) {
  //       //   items.push({
  //       //     title: 'Удалить линию',
  //       //     onClick: function () {
  //       //       myMap.geoObjects.remove(myPolyline);
  //       //     },
  //       //   });
  //       //   return items;
  //       // },
  //     }
  //   );
  //   this._map.geoObjects.add(this._dash);
  //   this._map.events.add('mousemove', this._moveDash);
  // }
  //
  // private _moveDash = (e: any): void => {
  //   const coordinates = this._polyline.geometry.getCoordinates();
  //
  //   if (!coordinates.length) {
  //     return;
  //   }
  //
  //   const lastPoint = coordinates[coordinates.length - 1];
  //   const dynamicPoint = e.get('coords');
  //
  //   this._dash.geometry.setCoordinates([lastPoint, dynamicPoint]);
  // };

  // private _onPointClick = (e: any): void => {
  //   if (!this._polyline) {
  //     return;
  //   }
  //
  //   console.log([...this._polyline.geometry.getCoordinates(), e.get('coords')]);
  //
  //   this._polyline.geometry.setCoordinates([
  //     ...this._polyline.geometry.getCoordinates(),
  //     e.get('coords'),
  //   ]);
  // };
  //

  // private _updateLastPoint = (e: any): void => {
  //   if (!this._drawing) {
  //     return;
  //   }
  //
  //   const coords = this._snapToGrid(e.get('coords'));
  //
  //   const updatedCoords = this._polyline.geometry.getCoordinates().slice();
  //   updatedCoords[updatedCoords.length - 1] = coords;
  //   this._polyline.geometry.setCoordinates(updatedCoords);
  // };
  //
  // private _snapToGrid = (coords: [number, number]): [number, number] => {
  //   const gridSize = 0.01; // Размер сетки (чем меньше, тем ближе примагничивание)
  //   const snappedLat = Math.round(coords[0] / gridSize) * gridSize;
  //   const snappedLng = Math.round(coords[1] / gridSize) * gridSize;
  //   return [snappedLat, snappedLng];
  // };
}
