import { Component } from '@angular/core';
import { TActionState } from '../../../../models/types/action-state.type';
import { MapsService } from '../../../../services/maps.service';

@Component({
  selector: 'app-actions',
  standalone: true,
  imports: [],
  templateUrl: './actions.component.html',
  styleUrl: './actions.component.scss',
})
export class ActionsComponent {
  constructor(private readonly _service: MapsService) {}

  handleSetActionState(state: TActionState): void {
    this._service.setActionState(state);
  }
}
