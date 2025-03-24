import { Queue } from '../../../models/classes/queue';
import { IOptions } from '../../../models/interfaces/options.interface';
import { TCache } from '../../../models/types/cache.type';
import { TChangedParam } from '../../../models/types/changed-param.type';
import { SelectedStore } from '../../../stores/selected.store';
import { SelectedChangesExtension } from './selected.changes.extension';
import { SelectedParamsExtension } from './selected.params.extension';

export class SelectedCacheExtension {
  constructor(
    private readonly _selected: SelectedStore,
    private readonly _params: SelectedParamsExtension,
    private readonly _changes: SelectedChangesExtension
  ) {}

  get state(): IOptions['cache'] {
    const value = this._selected.state;
    if (!value) {
      return { index: -1, queue: new Queue() };
    }

    return value.properties.get('cache') as IOptions['cache'];
  }

  update = (cache: IOptions['cache']) => {
    const value = this._selected.state;
    if (!value) {
      return;
    }

    value.properties.set({ cache });
  };

  add = (item: TCache): void => {
    const value = this._selected.state;
    if (!value) {
      return;
    }

    if (this._selected.manipulations.caches) {
      return;
    }

    this._setProcessState(true);

    const cache = this.state;

    if (cache.index < cache.queue.length - 1) {
      cache.queue.cut(cache.index + 1);

      const keys = Object.keys(item) as TChangedParam[];
      const result = this._params.checkIsDefault(keys);

      keys.forEach((key) => {
        result[key] ? this._changes.remove([key]) : this._changes.add([key]);
      });
    }

    cache.queue.add(item);
    cache.index = cache.queue.length - 1;

    this.update(cache);

    this._setProcessState(false);
  };

  move = (to: 'back' | 'forward'): void => {
    const value = this._selected.state;
    if (!value) {
      return;
    }

    this._setProcessState(true);

    const cache = this.state;

    switch (to) {
      case 'back':
        this._back(cache);
        break;
      case 'forward':
        this._forward(cache);
        break;
    }
  };

  private _back = (cache: IOptions['cache']): void => {
    if (cache.index <= 0) {
      return;
    }

    cache.index = cache.index - 1;

    this._change(cache);
  };

  private _forward = (cache: IOptions['cache']): void => {
    if (cache.index >= cache.queue.length - 1) {
      return;
    }

    cache.index = cache.index + 1;

    this._change(cache);
  };

  private _change = (cache: IOptions['cache']): void => {
    this._params.state = cache.queue[cache.index];

    this.update(cache);

    this._setProcessState(false);
  };

  private _setProcessState = (state: boolean): void => {
    this._selected.manipulations = { caches: state };
  };
}
