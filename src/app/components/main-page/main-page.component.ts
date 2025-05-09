import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
} from '@angular/core';
import { MainManager } from '../../services/main.manager';
import { ActionsComponent } from './sub-components/actions/actions.component';
import { EditorComponent } from './sub-components/editor/editor.component';
import { FooterComponent } from './sub-components/footer/footer.component';
import { HeaderComponent } from './sub-components/header/header.component';
import { MapsComponent } from './sub-components/maps/maps.component';

@Component({
  selector: 'main-page',
  standalone: true,
  imports: [
    HeaderComponent,
    ActionsComponent,
    MapsComponent,
    FooterComponent,
    EditorComponent,
  ],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainPageComponent {
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    this._main.keyboardHandler(event);
  }

  constructor(private readonly _main: MainManager) {}
}
