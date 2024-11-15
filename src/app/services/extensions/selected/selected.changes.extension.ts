import { TChangedParam } from '../../../models/types/changed-param.type';
import { SelectedStore } from '../../../stores/selected.store';

export class SelectedChangesExtension {
  constructor(private readonly _selected: SelectedStore) {}

  get state(): TChangedParam[] {
    const value = this._selected.state;
    if (!value) {
      return [];
    }

    return Array.from(value.properties.get('changes'));
  }

  add = (params: TChangedParam[]): void => {
    const value = this._selected.state;
    if (!value) {
      return;
    }

    const changes = value.properties.get('changes') as Set<TChangedParam>;

    params.forEach((param) => {
      changes.add(param);
    });

    value.properties.set({ changes });
  };

  remove = (params: TChangedParam[]): void => {
    const value = this._selected.state;
    if (!value) {
      return;
    }

    const changes = value.properties.get('changes') as Set<TChangedParam>;

    params.forEach((param) => changes.delete(param));

    value.properties.set({ changes });
  };
}
