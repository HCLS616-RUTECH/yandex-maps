import { Injectable } from '@angular/core';
import { Polygon } from 'yandex-maps';

@Injectable({
  providedIn: 'root',
})
export class VisualParamsStore {
  private readonly BASE_PARAMS = {
    map: {
      // center: [55.76, 37.64],
      // zoom: 10,
      center: [49.8765293803552, 38.09430233469668],
      zoom: 8,
      minZoom: 4,
      maxZoom: 14,
    },
    colors: {
      opacity: '88',
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

  animatePolygons(polygons: Polygon[]): void {
    const startTime = performance.now();
    const duration = 400;
    const maxOpacity = 88;

    function updateOpacity(timeStamp: number): void {
      const elapsedTime = timeStamp - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      const count = Math.floor(progress * maxOpacity);

      for (const polygon of polygons) {
        // @ts-ignore
        const color = polygon.options.get('fillColor').slice(0, 6);

        let opacity: string | number = 0;

        switch (true) {
          case count <= 0:
            opacity = `00`;
            break;
          case count >= 88:
            opacity = 88;
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
