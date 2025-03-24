import { BehaviorSubject, map, Observable, Subject } from 'rxjs';
import { IPointActions } from '../../../models/interfaces/point-actions.interface';
import { TPoint } from '../../../models/types/point.type';
import { ActionStore } from '../../../stores/action.store';
import { MapSourcesStore } from '../../../stores/map-sources.store';
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
    return this._state$.value?.geometry.getCoordinates()[0] ?? [];
  }

  set coordinates(coordinates: TPoint[]) {
    this._state$.value?.geometry.setCoordinates([coordinates]);
  }

  startDrawing(handler: (event: any) => void): void {
    const polygon = new this.YANDEX_MAPS.Polygon(
      [],
      {},
      {
        ...this._settings.strokes.selected,
        fillColor: this._settings.colors.new,
        editorMenuManager: (actions: IPointActions[]) =>
          actions.filter((action) => action.title !== 'Завершить'),
      }
    );

    this._map.add(polygon);
    polygon.editor.startDrawing();

    polygon.geometry.events.add('change', handler);
    this._state$.next(polygon);
  }

  stopDrawing(handler: (event: any) => void): void {
    const { value } = this._state$;
    if (!value) {
      return;
    }

    const coordinates = this._computing.deleteSamePoints(this.coordinates);

    if (coordinates.length < 4) {
      return this.clear(handler);
    }

    if (coordinates.length !== this.coordinates.length) {
      this.coordinates = coordinates;
    }

    value.options.set('fillColor', this._settings.colors.base);

    const id = this._settings.createPolygonId(value);

    const options = this._sources.options.forNew(
      id,
      coordinates,
      value.geometry.getBounds()
    );

    value.properties.set(options);

    this._clearStates(handler);

    this._emitter$.next(value);

    this._state$.next(null);
  }

  clear = (handler: (event: any) => void): void => {
    if (this._state$.value) {
      this._clearStates(handler);

      this._map.remove(this._state$.value);

      this._state$.next(null);
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

    value.editor.stopDrawing();
    value.geometry.events.remove('change', handler);
    this._action.state = 'EMPTY';
  };
}
