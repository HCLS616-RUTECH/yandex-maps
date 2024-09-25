import { Component, OnInit } from '@angular/core';
import { MapsService } from '../../services/maps.service';
import { ActionsComponent } from './sub-components/actions/actions.component';
import { ExtendsComponent } from './sub-components/extends/extends.component';
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
    ExtendsComponent,
    FooterComponent,
  ],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
})
export class MainPageComponent implements OnInit {
  map: any;

  constructor(private readonly _mapsService: MapsService) {}

  ngOnInit(): void {
    this._mapsService.initMap();
  }
}
