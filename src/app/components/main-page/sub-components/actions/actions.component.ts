import { Component } from '@angular/core';
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

  handleSetDrawingState(): void {
    this._service.setDrawingState();
  }

  ppp() {
    this._service.ppp();
  }
}
