import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TActionState } from '../../../../models/types/action-state.type';
import { MainManager } from '../../../../services/main.manager';
import { SelectedStore } from '../../../../stores/selected.store';

@Component({
  selector: 'app-actions',
  standalone: true,
  imports: [],
  templateUrl: './actions.component.html',
  styleUrl: './actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionsComponent {
  constructor(
    private readonly _main: MainManager,
    private readonly _selected: SelectedStore
  ) {}

  get isSelected(): boolean {
    return !!this._selected.state;
  }

  handleSetActionState(state: TActionState): void {
    this._main.setAction(state);
  }
}
