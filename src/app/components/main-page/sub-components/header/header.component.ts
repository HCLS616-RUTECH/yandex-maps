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
    private readonly _mapsService: MapsService,
    private readonly _changesStore: ChangesStore
  ) {}

  get isHaveChanges(): boolean {
    return this._changesStore.isHaveChanges();
  }

  get actionTitle(): string {
    return this._mapsService.actionTitle();
  }

  handleSaveChanges(): void {
    this._mapsService.saveChanges();
  }

  handleUpdate(): void {
    this._mapsService.updateZones();
  }
}
