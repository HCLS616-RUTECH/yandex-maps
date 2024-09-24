import { Component } from '@angular/core';
import { ActionsComponent } from '../actions/actions.component';
import { ExtendsComponent } from '../extends/extends.component';
import { FooterComponent } from '../footer/footer.component';
import { HeaderComponent } from '../header/header.component';
import { MapsComponent } from '../maps/maps.component';

@Component({
  selector: 'main-page',
  standalone: true,
  imports: [
    HeaderComponent,
    ActionsComponent,
    MapsComponent,
    ExtendsComponent,
    FooterComponent,
  ],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
})
export class MainPageComponent {}
