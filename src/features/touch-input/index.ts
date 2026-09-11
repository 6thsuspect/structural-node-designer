/* Touch input support — public entry point (pure helpers). */

export {
  TAP_MOVE_THRESHOLD,
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE,
  MIN_ZOOM,
  MAX_ZOOM,
  isWithinTapThreshold,
  computePinchView,
  TOOLBOX_TOUCH_DROP_EVENT,
} from './touchInput';

export type {
  Point,
  PinchViewStart,
  PinchViewCurrent,
  ToolboxTouchDropDetail,
} from './touchInput';
