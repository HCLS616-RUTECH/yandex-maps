import { Injectable } from '@angular/core';
import { Polygon } from 'yandex-maps';

interface IStroke {
  color: string;
  width: number;
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
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
    },
    stroke: {
      color: '0000FF',
      widths: {
        base: 1,
        selected: 3,
      },
    },
  };

  get map(): typeof this.BASE_PARAMS.map {
    return this.BASE_PARAMS.map;
  }

  get colors(): Omit<typeof this.BASE_PARAMS.colors, 'opacity'> & {
    intersection: string;
  } {
    return {
      base: `${this.BASE_PARAMS.colors.base}${this.BASE_PARAMS.colors.opacity}`,
      new: `${this.BASE_PARAMS.colors.new}${this.BASE_PARAMS.colors.opacity}`,
      drag: `${this.BASE_PARAMS.colors.drag}${this.BASE_PARAMS.colors.opacity}`,
      intersection: `${this.BASE_PARAMS.colors.drag}90`,
    };
  }

  get strokes(): { base: IStroke; selected: IStroke } {
    return {
      base: {
        color: this.BASE_PARAMS.stroke.color,
        width: this.BASE_PARAMS.stroke.widths.base,
      },
      selected: {
        color: this.BASE_PARAMS.stroke.color,
        width: this.BASE_PARAMS.stroke.widths.selected,
      },
    };
  }

  get opacity(): number {
    return this.BASE_PARAMS.colors.opacity;
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

  animate = (polygons: Polygon[]): void => {
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
  };
}
