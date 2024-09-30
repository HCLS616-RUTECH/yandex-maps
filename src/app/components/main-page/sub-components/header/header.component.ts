import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MapsService } from '../../../../services/maps.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgIf],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  constructor(private readonly _mapsService: MapsService) {}

  get isHaveChanges(): boolean {
    // return this._polygonsStore.isHaveChanges;
    return true;
  }

  handleSaveChanges(): void {
    this._mapsService.saveChanges();
  }
}
