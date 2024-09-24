import { Component, OnInit } from '@angular/core';

@Component({
  standalone: true,
  imports: [],
  selector: 'app-maps',
  templateUrl: './maps.component.html',
  styleUrl: './maps.component.scss',
})
export class MapsComponent implements OnInit {
  map: any;

  constructor() {}

  ngOnInit(): void {
    this.initMap();
  }

  initMap(): void {
    const ymaps = (window as any).ymaps;

    ymaps.ready(() => {
      this.map = new ymaps.Map('map', {
        center: [55.76, 37.64],
        zoom: 11,
      });

      const placemark = new ymaps.Placemark([55.751574, 37.573856], {
        balloonContent: 'Москва!',
      });
      this.map.geoObjects.add(placemark);
    });
  }
}
