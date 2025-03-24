import { BehaviorSubject, map, Observable, Subject } from 'rxjs';
import { Queue } from '../../../models/classes/queue';
import { IOptions } from '../../../models/interfaces/options.interface';
import { IPointActions } from '../../../models/interfaces/point-actions.interface';
import { TCache } from '../../../models/types/cache.type';
import { TPoint } from '../../../models/types/point.type';
import { ActionStore } from '../../../stores/action.store';
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
    private readonly _settings: SettingsStore
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

  startDrawing(drawingHandler: (event: any) => void): void {
    const polyline = new this.YANDEX_MAPS.Polyline(
      [],
      {},
      {
        ...this._settings.strokeSelected,
        editorMenuManager: (actions: IPointActions[]) => {
          actions = actions.filter((action) => action.title !== 'Завершить');

          const isPolyLineStartOrEnd = !!actions.find(
            (action) => action.title === 'Продолжить'
          );

          if (isPolyLineStartOrEnd && this.coordinates.length > 2) {
            actions.push({
              title: 'Замкнуть полигон',
              onClick: () => this.stopDrawing(drawingHandler),
            });
          }

          return actions;
        },
      }
    );

    polyline.geometry.events.add('change', drawingHandler);

    this._map.add(polyline);
    polyline.editor.startEditing();
    polyline.editor.startDrawing();
    this._state$.next(polyline);
  }

  stopDrawing(drawingHandler: (event: any) => void): void {
    if (!this._state$.value) {
      return;
    }

    const coordinates = this._computing.deleteSamePoints(this.coordinates);

    if (coordinates.length < 4) {
      return this.clear(drawingHandler);
    }

    const polygon = new this.YANDEX_MAPS.Polygon(
      [coordinates],
      {},
      {
        ...this._settings.strokeSelected,
        fillColor: this._settings.baseColor,
      }
    );

    this._map.add(polygon);

    const id = this._settings.createPolygonId(polygon);
    const options: IOptions = {
      id,
      name: `Новая зона ${id}`,
      bbox: polygon.geometry.getBounds(),
      new: false,
      default: {
        coordinates: [coordinates],
        bbox: polygon.geometry.getBounds(),
        name: `Новая зона ${id}`,
        color: this._settings.baseColor,
      },
      cache: {
        index: 0,
        queue: new Queue<TCache>({
          name: `Новая зона ${id}`,
          color: this._settings.baseColor,
          coordinates: [coordinates],
        }),
      },
      manipulations: { caches: false, computing: false, drag: false },
      changes: new Set(),
    };

    polygon.properties.set(options);

    this._clearStates(drawingHandler);

    this._emitter$.next(polygon);
  }

  clear = (drawingHandler: (event: any) => void): void => {
    if (this._state$.value) {
      this._clearStates(drawingHandler);

      this._emitter$.next(null);
    }
  };

  update = (): void => {
    this._state$.next(this._state$.value);
  };

  private _clearStates = (drawingHandler: (event: any) => void): void => {
    const { value } = this._state$;
    if (!value) {
      return;
    }

    value.editor.stopEditing();
    value.editor.stopDrawing();
    value.events.remove('change', drawingHandler);
    this._map.remove(value);
    this._state$.next(null);
    this._action.state = 'EMPTY';
  };
}
