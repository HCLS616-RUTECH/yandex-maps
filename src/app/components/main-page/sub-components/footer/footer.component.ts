import { ChangeDetectionStrategy, Component, VERSION } from '@angular/core';
import { MapsService } from '../../../../services/maps.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  constructor(private readonly _mapService: MapsService) {}

  get angularVersion(): string {
    return VERSION.full;
  }

  get yandexVersion(): string {
    return this._mapService.yandexVersion();
  }
}
