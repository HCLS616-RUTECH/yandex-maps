import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TActionState } from '../../../../models/types/action-state.type';
import { MapsService } from '../../../../services/maps.service';
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
    private readonly _service: MapsService,
    private readonly _selected: SelectedStore
  ) {}

  get isSelected(): boolean {
    return !!this._selected.state;
  }

  handleSetActionState(state: TActionState): void {
    this._service.setActionState(state);
  }
}
