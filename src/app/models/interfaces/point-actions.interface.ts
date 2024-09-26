export interface IPointActions {
  id?: 'removeVertex' | 'startDrawing' | string;
  title: 'Удалить точку' | 'Продолжить' | string;
  onClick?: () => void;
}
