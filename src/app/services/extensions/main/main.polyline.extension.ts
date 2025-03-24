import { BehaviorSubject, map, Observable, Subject } from 'rxjs';
import { IPointActions } from '../../../models/interfaces/point-actions.interface';
import { TPoint } from '../../../models/types/point.type';
import { ActionStore } from '../../../stores/action.store';
import { MapSourcesStore } from '../../../stores/map-sources.store';
import { MapStore } from '../../../stores/map.store';
import { SettingsStore } from '../../../stores/settings.store';
import { VertexesStore } from '../../../stores/vertexes.store';
import { ComputingService } from '../../computing.service';

export class PolylineExtension {
  private readonly _state$ = new BehaviorSubject<any | null>(null);
  private readonly _emitter$ = new Subject<any>();

  constructor(
    private readonly YANDEX_MAPS: any,
    private readonly _map: MapStore,
    private readonly _action: ActionStore,
    private readonly _vertexes: VertexesStore,
    private readonly _computing: ComputingService,
    private readonly _settings: SettingsStore,
    private readonly _sources: MapSourcesStore
  ) {
    this._vertexes.state = this._state$
      .asObservable()
      .pipe(map(() => this.coordinates.length));
  }

  get emitter$(): Observable<any> {
    return this._emitter$.asObservable();
  }

  get coordinates(): TPoint[] {
    return this._state$.value?.geometry.getCoordinates() ?? [];
  }

  set coordinates(coordinates: TPoint[]) {
    const { value } = this._state$;
    if (!value) {
      return;
    }

    value.geometry.setCoordinates(coordinates);

    // Чинит багу с точкой, которая отрывается от вершины при логике с одинаковыми вершинами
    value.editor.stopEditing();
    value.editor.startEditing();

    value.editor.stopDrawing();
    value.editor.startDrawing();
  }

  startDrawing(handler: (event: any) => void): void {
    const polyline = new this.YANDEX_MAPS.Polyline(
      [],
      {},
      {
        strokeColor: this._settings.strokes.selected.color,
        strokeWidth: this._settings.strokes.selected.width,
        editorMenuManager: (actions: IPointActions[]) => {
          actions = actions.filter((action) => action.title !== 'Завершить');

          const isPolyLineStartOrEnd = !!actions.find(
            (action) => action.title === 'Продолжить'
          );

          if (isPolyLineStartOrEnd && this.coordinates.length > 2) {
            actions.push({
              title: 'Замкнуть полигон',
              onClick: () => this.stopDrawing(handler),
            });
          }

          return actions;
        },
      }
    );

    polyline.geometry.events.add('change', handler);

    this._map.add(polyline);
    polyline.editor.startEditing();
    polyline.editor.startDrawing();
    this._state$.next(polyline);
  }

  stopDrawing(handler: (event: any) => void): void {
    if (!this._state$.value) {
      return;
    }

    const coordinates = this._computing.deleteSamePoints(this.coordinates);

    if (coordinates.length < 4) {
      return this.clear(handler);
    }

    const polygon = new this.YANDEX_MAPS.Polygon(
      [coordinates],
      {},
      {
        strokeColor: this._settings.strokes.selected.color,
        strokeWidth: this._settings.strokes.selected.width,
        fillColor: this._settings.colors.base,
      }
    );

    this._map.add(polygon);

    const id = this._settings.createPolygonId(polygon);

    const options = this._sources.options.forNew(
      id,
      coordinates,
      polygon.geometry.getBounds()
    );

    polygon.properties.set(options);

    this._clearStates(handler);

    this._emitter$.next(polygon);
  }

  clear = (handler: (event: any) => void): void => {
    if (this._state$.value) {
      this._clearStates(handler);

      this._emitter$.next(null);
    }
  };

  update = (): void => {
    this._state$.next(this._state$.value);
  };

  private _clearStates = (handler: (event: any) => void): void => {
    const { value } = this._state$;
    if (!value) {
      return;
    }

    value.editor.stopEditing();
    value.editor.stopDrawing();
    value.events.remove('change', handler);
    this._map.remove(value);
    this._state$.next(null);
    this._action.state = 'EMPTY';
  };
}
