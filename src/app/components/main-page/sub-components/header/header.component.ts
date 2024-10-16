import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MapsService } from '../../../../services/maps.service';
import { ChangesStore } from '../../../../stores/changes.store';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgIf],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  constructor(
    private readonly _mapService: MapsService,
    private readonly _changesStore: ChangesStore
  ) {}

  get isHaveChanges(): boolean {
    return this._changesStore.isHaveChanges();
  }

  handleSaveChanges(): void {
    this._mapService.saveChanges();
  }

  handleUpdateMap(): void {
    this._mapService.updateMap();
  }
}
