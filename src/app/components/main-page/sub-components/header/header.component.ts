import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MainManager } from '../../../../services/main.manager';
import { ArrowBackUpIcon } from '../../../../shared/icons/arrow-back-up.icon';
import { DeviceFloppyIcon } from '../../../../shared/icons/device-floppy.icon';
import { ReloadIcon } from '../../../../shared/icons/reload.icon';
import { ChangesStore } from '../../../../stores/changes.store';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgIf, ReloadIcon, DeviceFloppyIcon, ArrowBackUpIcon],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  constructor(
    private readonly _main: MainManager,
    private readonly _changesStore: ChangesStore
  ) {}

  get isHaveChanges(): boolean {
    return this._changesStore.isHaveChanges();
  }

  handleSaveChanges(): void {
    // this._main.saveChanges();
  }

  handleUpdateMap(): void {
    this._main.updateMap();
  }
}
