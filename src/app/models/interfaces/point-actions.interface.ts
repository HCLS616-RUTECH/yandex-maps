export interface IPointActions {
  id?: 'removeVertex' | 'startDrawing' | 'stopDrawing' | string;
  title: 'Удалить точку' | 'Продолжить' | 'Завершить' | string;
  onClick?: () => void;
}
