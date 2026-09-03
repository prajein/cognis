/**
 * Caret Coordinate Utility
 *
 * Provides a lightweight, zero-dependency implementation of the "hidden div mirror" 
 * technique to extract precise pixel coordinates of the caret within a <textarea>.
 * This is necessary because the native window.getSelection() API does not support 
 * <textarea> or <input> elements.
 */

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

const propertiesToCopy = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize'
];

export function getTextareaCaretCoordinates(element: HTMLTextAreaElement): CaretCoordinates | null {
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) return null;

  // The mirror div will replicate the textarea's style
  const div = document.createElement('div');
  div.id = 'cognis-caret-mirror-div';
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);
  
  // Default textarea styles
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';
  
  propertiesToCopy.forEach((prop) => {
    (style as any)[prop] = (computed as any)[prop];
  });

  if (window.navigator.userAgent.indexOf('Firefox') !== -1) {
    if (element.scrollHeight > parseInt(computed.height)) {
      style.overflowY = 'scroll';
    }
  } else {
    style.overflow = 'hidden';
  }

  div.textContent = element.value.substring(0, element.selectionEnd);

  // The span represents the exact position of the caret
  const span = document.createElement('span');
  span.textContent = element.value.substring(element.selectionEnd) || '.';
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth),
    height: parseInt(computed.lineHeight)
  };
  
  document.body.removeChild(div);
  
  // Convert mirror-local coordinates to viewport-relative coordinates
  const rect = element.getBoundingClientRect();
  
  return {
    top: rect.top - element.scrollTop + coordinates.top,
    left: rect.left - element.scrollLeft + coordinates.left,
    height: coordinates.height
  };
}
