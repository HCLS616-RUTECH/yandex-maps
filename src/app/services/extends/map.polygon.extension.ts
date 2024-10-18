import { Observable, Subject } from 'rxjs';
import { IPointActions } from '../../models/interfaces/point-actions.interface';
import { TPoint } from '../../models/types/point.type';
import { ActionStore } from '../../stores/action.store';
import { VertexCountStore } from '../../stores/vertex-count.store';
import { ComputingService } from '../computing.service';
import { MapParamsExtension } from './map.params.extension';

export class PolygonExtension {
  private _polygon: any | null = null;

  private readonly _emitter$ = new Subject<any>();

  constructor(
    private readonly _map: any,
    private readonly YANDEX_MAPS: any,
    private readonly _action: ActionStore,
    private readonly _vertexCount: VertexCountStore,
    private readonly _computing: ComputingService,
    private readonly _params: MapParamsExtension
  ) {}

  get emitter$(): Observable<any> {
    return this._emitter$.asObservable();
  }

  get coordinates(): TPoint[] {
    return this._polygon?.geometry.getCoordinates()[0] ?? [];
  }

  set coordinates(coordinates: TPoint[]) {
    this._polygon?.geometry.setCoordinates([coordinates]);
  }

  startDrawing(
    newVertexHandler: (event: any) => void,
    changeHandler: (event: any) => void
  ): void {
    this._polygon = new this.YANDEX_MAPS.Polygon(
      [],
      {},
      {
        ...this._params.strokeSelected,
        fillColor: this._params.newColor,
        editorMenuManager: (actions: IPointActions[]) =>
          actions.filter((action) => action.title !== 'Завершить'),
      }
    );

    this._map.geoObjects.add(this._polygon);
    this._polygon.editor.startDrawing();

    this._polygon.editor.events.add('vertexadd', newVertexHandler);
    this._polygon.geometry.events.add('change', changeHandler);
  }

  stopDrawing(
    newVertexHandler: (event: any) => void,
    changeHandler: (event: any) => void
  ): void {
    const coordinates = this._computing.deleteSamePoints(
      this._polygon.geometry.getCoordinates()[0]
    );

    if (coordinates.length < 4) {
      this._vertexCount.clear();
      return this.clear(newVertexHandler, changeHandler);
    }

    if (
      coordinates.length !== this._polygon.geometry.getCoordinates()[0].length
    ) {
      this.coordinates = coordinates;
    }

    this._polygon.options.set('fillColor', this._params.baseColor);

    const id = this._params.createPolygonId(this._polygon);
    this._polygon.properties.set({
      id,
      name: `Новая зона ${id}`,
      bbox: this._polygon.geometry.getBounds(),
      new: true,
    });

    this._clearStates(newVertexHandler, changeHandler);

    this._emitter$.next(this._polygon);

    this._polygon = null;
  }

  clear = (
    newVertexHandler: (event: any) => void,
    changeHandler: (event: any) => void
  ): void => {
    if (this._polygon) {
      this._clearStates(newVertexHandler, changeHandler);

      this._map.geoObjects.remove(this._polygon);

      this._polygon = null;
      this._emitter$.next(null);

      this._vertexCount.clear();
    }
  };

  private _clearStates = (
    newVertexHandler: (event: any) => void,
    changeHandler: (event: any) => void
  ): void => {
    this._polygon.editor.stopDrawing();
    this._polygon.events.remove('vertexadd', newVertexHandler);
    this._polygon.geometry.events.remove('change', changeHandler);
    this._action.state = 'EMPTY';
  };
}
