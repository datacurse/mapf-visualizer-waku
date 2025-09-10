import Two from "two.js";
import { Text } from "two.js/src/text";

export function centerTextBBoxLocal(text: Text) {
  const b = text.getBoundingClientRect(true);
  const cx = (b.left + b.right) / 2;
  const cy = (b.top + b.bottom) / 2;
  text.translation.add(cx, cy);
}