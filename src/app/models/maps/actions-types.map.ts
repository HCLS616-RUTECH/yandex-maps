import { TActionState } from '../types/action-state.type';

export const MActionsTypes: Record<TActionState, string> = {
  DRAWING_POLYLINE: 'Рисуется кривая',
  DRAWING_POLYGON: 'Рисуется полигон',
  EDITING_POLYGON: 'Редактируется полигон',
  DELETE_POLYGON: '',
  DRAG_POLYGON: 'Перетаскивается полигон',
  EMPTY: '',
};
