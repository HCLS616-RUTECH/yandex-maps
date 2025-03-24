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

export class PolygonExtension {
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
    return this._state$.value?.geometry.getCoordinates()[0] ?? [];
  }

  set coordinates(coordinates: TPoint[]) {
    this._state$.value?.geometry.setCoordinates([coordinates]);
  }

  startDrawing(drawingHandler: (event: any) => void): void {
    const polygon = new this.YANDEX_MAPS.Polygon(
      [],
      {},
      {
        ...this._settings.strokeSelected,
        fillColor: this._settings.newColor,
        editorMenuManager: (actions: IPointActions[]) =>
          actions.filter((action) => action.title !== 'Завершить'),
      }
    );

    this._map.add(polygon);
    polygon.editor.startDrawing();

    polygon.geometry.events.add('change', drawingHandler);
    this._state$.next(polygon);
  }

  stopDrawing(drawingHandler: (event: any) => void): void {
    const { value } = this._state$;
    if (!value) {
      return;
    }

    const coordinates = this._computing.deleteSamePoints(this.coordinates);

    if (coordinates.length < 4) {
      return this.clear(drawingHandler);
    }

    if (coordinates.length !== this.coordinates.length) {
      this.coordinates = coordinates;
    }

    value.options.set('fillColor', this._settings.baseColor);

    const id = this._settings.createPolygonId(value);
    const options: IOptions = {
      id,
      name: `Новая зона ${id}`,
      bbox: value.geometry.getBounds(),
      new: false,
      default: {
        coordinates: [coordinates],
        bbox: value.geometry.getBounds(),
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

    value.properties.set(options);

    this._clearStates(drawingHandler);

    this._emitter$.next(value);

    this._state$.next(null);
  }

  clear = (drawingHandler: (event: any) => void): void => {
    if (this._state$.value) {
      this._clearStates(drawingHandler);

      this._map.remove(this._state$.value);

      this._state$.next(null);
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

    value.editor.stopDrawing();
    value.geometry.events.remove('change', drawingHandler);
    this._action.state = 'EMPTY';
  };
}
