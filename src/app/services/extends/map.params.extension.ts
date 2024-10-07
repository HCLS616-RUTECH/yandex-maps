import { Injectable } from '@angular/core';
import { Polygon } from 'yandex-maps';

@Injectable({
  providedIn: 'root',
})
export class MapParamsExtension {
  private readonly BASE_PARAMS = {
    map: {
      // center: [55.76, 37.64],
      // zoom: 10,
      center: [49.8765293803552, 38.09430233469668],
      zoom: 8,
      controls: [
        'zoomControl',
        'geolocationControl',
        'searchControl',
        'rulerControl',
      ],
      minZoom: 4,
      maxZoom: 14,
    },
    colors: {
      opacity: 60,
      base: '00FF00',
      new: 'FFFF00',
      drag: 'FF0000',
      cache: '00FF0088',
    },
    stroke: {
      color: '0000FF',
      width: 1,
      selected: 3,
    },
  };

  get map(): typeof this.BASE_PARAMS.map {
    return this.BASE_PARAMS.map;
  }

  get baseColor(): string {
    return `${this.BASE_PARAMS.colors.base}${this.BASE_PARAMS.colors.opacity}`;
  }

  get newColor(): string {
    return `${this.BASE_PARAMS.colors.new}${this.BASE_PARAMS.colors.opacity}`;
  }

  get dragColor(): string {
    return `${this.BASE_PARAMS.colors.drag}${this.BASE_PARAMS.colors.opacity}`;
  }

  get stroke(): { strokeColor: string; strokeWidth: number } {
    return {
      strokeColor: this.BASE_PARAMS.stroke.color,
      strokeWidth: this.BASE_PARAMS.stroke.width,
    };
  }

  get strokeSelected(): { strokeColor: string; strokeWidth: number } {
    return {
      strokeColor: this.BASE_PARAMS.stroke.color,
      strokeWidth: this.BASE_PARAMS.stroke.selected,
    };
  }

  get colorCache(): string {
    return this.BASE_PARAMS.colors.cache;
  }

  set colorCache(cache: string) {
    this.BASE_PARAMS.colors.cache = cache;
  }

  createPolygonId(polygon: any): string {
    let id = '0';
    const keys = Object.keys(polygon);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].includes('id')) {
        id = (keys[i].match(/\d/g)?.join('') ?? '0') + polygon[keys[i]];
        i = keys.length;
      }
    }
    return id;
  }

  startDrag = (polygon: any): void => {
    polygon.options.set('draggable', true);
    this.colorCache = polygon.options.get('fillColor');
    polygon.options.set('fillColor', this.dragColor);

    this.animatePolygons([polygon]);
  };

  stopDrag = (polygon: any): void => {
    polygon.options.set('draggable', false);
    polygon.options.set('fillColor', this.colorCache);

    this.animatePolygons([polygon]);
  };

  animatePolygons(polygons: Polygon[]): void {
    const startTime = performance.now();
    const duration = 400;
    const maxOpacity = this.BASE_PARAMS.colors.opacity;

    function updateOpacity(timeStamp: number): void {
      const elapsedTime = timeStamp - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      const count = Math.floor(progress * maxOpacity);

      for (const polygon of polygons) {
        // @ts-ignore
        const color = polygon.options.get('fillColor').slice(0, 6);

        let opacity: string | number = '00';

        switch (true) {
          case count <= 0:
            opacity = '00';
            break;
          case count >= maxOpacity:
            opacity = maxOpacity;
            break;
          case Math.trunc(count) < 10:
            opacity = `0${Math.trunc(count)}`;
            break;
          default:
            opacity = Math.trunc(count);
        }

        polygon.options.set('fillColor', `${color}${opacity}`);
      }

      if (progress < 1) {
        requestAnimationFrame(updateOpacity);
      }
    }

    requestAnimationFrame(updateOpacity);
  }
}
