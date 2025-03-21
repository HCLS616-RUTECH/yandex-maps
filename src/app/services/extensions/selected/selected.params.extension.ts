import { IZone } from '../../../models/interfaces/zone.interface';
import { TBbox } from '../../../models/types/bbox.type';
import { TChangedParam } from '../../../models/types/changed-param.type';
import { TDefaultParams } from '../../../models/types/default-params.type';
import { TPoint } from '../../../models/types/point.type';
import { ActionStore } from '../../../stores/action.store';
import { SelectedStore } from '../../../stores/selected.store';
import { ComputingService } from '../../computing.service';
import { MapSettingsExtension } from '../map/map.settings.extension';

type TKeys = Extract<keyof IZone, keyof SelectedParamsExtension>;

export class SelectedParamsExtension {
  constructor(
    private readonly _selected: SelectedStore,
    private readonly _settings: MapSettingsExtension,
    private readonly _action: ActionStore,
    private readonly _computing: ComputingService
  ) {}

  get state(): IZone | null {
    const value = this._selected.state;
    if (!value) {
      return value;
    }

    return {
      id: value.properties.get('id'),
      color: this.color,
      name: this.name,
      coordinates: [this.coordinates],
      bbox: this.bbox,
    };
  }

  set state(state: Partial<IZone>) {
    const keys = Object.keys(state) as TKeys[];

    keys.forEach((key) => ((this as any)[key] = state[key]));
  }

  get color(): string {
    const value = this._selected.state;
    if (!value) {
      return `#${this._settings.baseColor}`;
    }

    const fillColor: string = value.options.get('fillColor').slice(0, 6);
    const dragColor: string = this._settings.dragColor.slice(0, 6);

    const color: string =
      fillColor === dragColor
        ? this._settings.colorCache.slice(0, 6)
        : fillColor;

    return `#${color}`;
  }

  set color(color: string) {
    color = `${color.replace('#', '')}${this._settings.opacity}`;

    this._selected.state?.options.set('fillColor', color);
  }

  get name(): string {
    const value = this._selected.state;
    if (!value) {
      return 'Ошибка ###';
    }

    return value.properties.get('name');
  }

  set name(name: string) {
    this._selected.state?.properties.set({ name });
  }

  get coordinates(): TPoint[] {
    return this._selected.state?.geometry?.getCoordinates()[0] ?? [];
  }

  set coordinates(coordinates: Array<TPoint[]>) {
    this._selected.state?.geometry?.setCoordinates(coordinates);
    this._selected.state?.properties.set({
      bbox: this._selected.state?.geometry?.getBounds(),
    });

    // Чинит багу с точкой, которая отрывается от вершины при логике с одинаковыми вершинами
    if (this._action.state === 'EDITING_POLYGON') {
      this._selected.state?.editor.stopEditing();
      this._selected.state?.editor.startEditing();
    }
  }

  get bbox(): TBbox {
    return (
      this._selected.state?.geometry?.getBounds() ??
      this._selected.state?.properties.get('bbox') ??
      []
    );
  }

  set bbox(bbox: TBbox) {
    this._selected.state?.properties.set({ bbox });
  }

  get default(): TDefaultParams | null {
    return this._selected.state?.properties.get('default') ?? null;
  }

  checkIsDefault = (
    params: TChangedParam[]
  ): Partial<Record<TChangedParam, boolean>> => {
    const value = this._selected.state;
    if (!value) {
      return { color: false, name: false, coordinates: false };
    }

    const defaultParams = this.default;
    if (!defaultParams) {
      return { color: false, name: false, coordinates: false };
    }

    const result: Partial<Record<TChangedParam, boolean>> = {};

    params.forEach((param) => {
      switch (param) {
        case 'color':
          result.color = this.color.replace('#', '') === defaultParams.color;
          break;
        case 'name':
          result.name = this.name === defaultParams.name;
          break;
        case 'coordinates':
          result.coordinates = this._computing.checkIsSameCoordinates(
            this._selected.coordinates,
            defaultParams.coordinates[0]
          );
          break;
      }
    });

    return result;
  };
}
