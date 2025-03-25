import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BrandAngularIcon } from '../../../../shared/icons/brand-angular.icon';
import { BrandYandexIcon } from '../../../../shared/icons/brand-yandex.icon';
import { VersionsStore } from '../../../../stores/versions.store';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [BrandAngularIcon, BrandYandexIcon],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  constructor(private readonly _versions: VersionsStore) {}

  get angular(): string {
    return this._versions.angular;
  }

  get yandex(): string {
    return this._versions.yandex;
  }
}
