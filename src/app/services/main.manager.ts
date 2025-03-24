import { Injectable } from '@angular/core';
import { debounceTime, Subject, switchMap, take } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { IZone } from '../models/interfaces/zone.interface';
import { TActionState } from '../models/types/action-state.type';
import { TBbox } from '../models/types/bbox.type';
import { TChangedParam } from '../models/types/changed-param.type';
import { ActionStore } from '../stores/action.store';
import { ChangesStore } from '../stores/changes.store';
import { MapSourcesStore } from '../stores/map-sources.store';
import { MapStore } from '../stores/map.store';
import { SelectedStore } from '../stores/selected.store';
import { SettingsStore } from '../stores/settings.store';
import { VersionsStore } from '../stores/versions.store';
import { VertexesStore } from '../stores/vertexes.store';
import { ComputingService } from './computing.service';
import { MainExtensions } from './extensions/main/main.extensions.extension';
import { MapsHttpService } from './maps.http.service';

// TODO: 1. editorMenuManager: завершить рисование для полигона, удалить добавить внутренний контур        - -
// TODO: 2. Бага с дижением кэша вправо по клавише                                                         -
// TODO: 3. Бага с добавлением первой точки нового полигона или кривой в пределах существующего полигона   -

@Injectable({
  providedIn: 'root',
})
export class MainManager {
  private _extensions: any | MainExtensions;

  private readonly _request$ = new Subject<TBbox>();

  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor(
    private readonly _http: MapsHttpService,
    private readonly _map: MapStore,
    private readonly _sources: MapSourcesStore,
    private readonly _settings: SettingsStore,
    private readonly _versions: VersionsStore,
    private readonly _computing: ComputingService,
    private readonly _changes: ChangesStore,
    private readonly _action: ActionStore,
    private readonly _selected: SelectedStore,
    private readonly _vertexes: VertexesStore
  ) {
    this.YANDEX_MAPS.ready(() => {
      this._versions.yandex = this.YANDEX_MAPS.meta.version;

      this._map.init(this._request$);

      this._extensions = new MainExtensions(
        this,
        this.YANDEX_MAPS,
        this._map,
        this._action,
        this._vertexes,
        this._computing,
        this._settings,
        this._selected,
        this._sources,
        this._changes
      );

      this._request$
        .pipe(
          debounceTime(300),
          switchMap((bbox) => this._http.getZones(bbox))
        )
        .subscribe({
          next: (zones) => {
            this._addNewPolygons(zones);
          },
        });

      // this._map.events.add('click', (event: any) =>
      //   console.log(event.get('coords'))
      // );

      this._request$.next(this._map.bounds);

      document.querySelector('.ymaps-2-1-79-map-copyrights-promo')?.remove();
    });
  }

  get intersections(): boolean {
    return this._extensions?.intersections?.existence ?? false;
  }

  flyToIntersection = (): void => {
    this._extensions.intersections.fly();
  };

  keyboardHandler = (event: KeyboardEvent): void => {
    return this._extensions.keyboard.handler(event);
  };

  setAction(action: TActionState): void {
    this._extensions.actions.produce[action]();
  }

  updateMap(): void {
    this._map.clear(this._sources.state.polygons.all);
    this._sources.clear();

    this._map.clear(this._changes.state.new);
    this._changes.clear();

    this._extensions.intersections.clear();

    this.clearShapes();

    this._action.state = 'EMPTY';

    this._request$.next(this._map.bounds);
  }

  saveChanges(): void {
    if (!this._changes.isHaveChanges()) {
      return;
    }

    const body = this._changes.requestBody;

    this._http.saveChanges(body).pipe(take(1)).subscribe();
  }

  setNewParams = (params: Partial<IZone>): void => {
    if (!this._selected.state) {
      return;
    }

    this._selected.params = params;

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');
  };

  clearChangedParams = (params: TChangedParam[]): void => {
    if (!this._selected.state) {
      return;
    }

    this._selected.manipulations = { computing: true };

    const defaultParams = this._selected.defaultParams!;

    this._selected.params = params.reduce(
      (acc, key) => ({ ...acc, [key]: defaultParams[key] }),
      {}
    );

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');

    this._selected.manipulations = { computing: false };
  };

  clearShapes = (): void => {
    this._extensions.polyline.clear(this._extensions.handlers.draw);
    this._extensions.polygon.clear(this._extensions.handlers.draw);
    this._selected.clear();
  };

  private _addNewPolygons(zones: IZone[]): void {
    const changes = this._changes.state;
    this._sources.clear('ZONES');

    const newPolygons: Polygon[] = [];

    for (let zone of zones) {
      if (changes.deleted.has(zone.id)) {
        continue;
      }

      this._sources.add.zone(zone.id);

      const visible = this._sources.get(zone.id, 'POLYGONS_VISIBLE');

      if (visible) {
        // Чинит багу яндекс карт, при которой не до конца отрисовывается полигон, при движении экрана по картам
        visible.options.set('fillColor', visible.options.get('fillColor'));
        continue;
      }

      if (this._sources.has(zone.id, 'POLYGONS_ALL')) {
        const current = this._sources.get(zone.id, 'POLYGONS_ALL');
        this._sources.add.polygon.visible(zone.id, current);
        this._map.add(current);
        newPolygons.push(current);
        continue;
      }

      const options = this._sources.options.fromZone(zone);

      const polygon = new this.YANDEX_MAPS.Polygon(zone.coordinates, options, {
        ...this._settings.strokes.base,
        fillColor: zone.color,
      });

      this._extensions.actions.initPolygonActions(polygon);

      newPolygons.push(polygon);
      this._sources.add.polygon.all(zone.id, polygon);
      this._sources.add.polygon.visible(zone.id, polygon);
      this._map.add(polygon);
    }

    this._sources.state.polygons.visible.forEach((polygon, id) => {
      const requirement =
        !this._sources.has(id, 'ZONES') &&
        !changes.new.has(id) &&
        !changes.edited.has(id);

      if (requirement) {
        this._map.remove(polygon);
        this._sources.remove(id, 'POLYGONS_VISIBLE');
      }
    });

    const { bounds } = this._map;

    changes.edited.forEach((polygon, id) => {
      const isBboxesIntersected = this._computing.isBBoxesIntersected(
        polygon.properties.get('bbox') as never as TBbox,
        bounds
      );

      if (isBboxesIntersected && this._sources.has(id, 'POLYGONS_VISIBLE')) {
        return;
      }

      if (!isBboxesIntersected && this._sources.has(id, 'POLYGONS_VISIBLE')) {
        this._map.remove(polygon);
        this._sources.remove(id, 'POLYGONS_VISIBLE');
      }

      if (isBboxesIntersected && !this._sources.has(id, 'POLYGONS_VISIBLE')) {
        this._sources.add.polygon.visible(id, polygon);
        this._map.add(polygon);
        newPolygons.push(polygon);
      }
    });

    changes.new.forEach((polygon, id) => {
      const isBboxesIntersected = this._computing.isBBoxesIntersected(
        polygon.properties.get('bbox') as never as TBbox,
        bounds
      );

      if (!isBboxesIntersected && this._sources.has(id, 'POLYGONS_VISIBLE')) {
        this._map.remove(polygon);
        this._sources.remove(id, 'POLYGONS_VISIBLE');
      }

      if (isBboxesIntersected && !this._sources.has(id, 'POLYGONS_VISIBLE')) {
        this._sources.add.polygon.visible(id, polygon);
        this._map.add(polygon);
        newPolygons.push(polygon);
      }
    });

    this._settings.animate(newPolygons);

    this._extensions.intersections.checkBounds(bounds);
  }
}
