// Arabic without a mirrored layout: the window stays left to right (as in English), but
// every small block of text (a label, a title, a button text, a line of help) gets
// dir="auto". The browser then reads its first letter: Arabic text reads from right to
// left, English names stay as they are. Only blocks that hold nothing but text get it
// (no flex or grid boxes), and every text keeps the side of its box it has in English
// (global.css, data-keep-align), so nothing moves.

// tags that may sit inside a block of text
const INLINE = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'SMALL', 'BR', 'BDI', 'CODE', 'A', 'ABBR', 'SUB', 'SUP', 'MARK', 'KBD']);
// never touched (they decide their direction themselves, or are no text)
const SKIP = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'CANVAS', 'STYLE', 'SCRIPT', 'IMG', 'VIDEO', 'AUDIO', 'HTML', 'BODY', 'HEAD']);
const MARK = 'data-auto-dir';
const KEEP = 'data-keep-align';

// a block that only holds text (and simple inline tags with text in them)
export const isTextBlock = el => {
  if (!el || el.nodeType !== 1 || SKIP.has(el.tagName.toUpperCase())) return false;
  if (el.hasAttribute('dir') && !el.hasAttribute(MARK)) return false; // set on purpose
  let text = false;
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 3) {
      if (n.nodeValue.trim()) text = true;
    } else if (n.nodeType === 1) {
      if (!INLINE.has(n.tagName.toUpperCase())) return false;
      if (n.textContent.trim()) text = true;
    }
  }
  return text;
};

// the first real letter decides: Arabic (or Hebrew) -> right to left
const RTL_FIRST = /^[^A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]*[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
export const startsRtl = text => RTL_FIRST.test(text || '');
export const startsWithNumber = text => /^\s*[0-9\u0660-\u0669]/.test(text || '');

// flex and grid boxes keep their direction: it would flip the order of what is in them
const isRow = el => {
  if (!window.getComputedStyle) return false;
  const d = window.getComputedStyle(el).display;
  return d.indexOf('flex') > -1 || d.indexOf('grid') > -1;
};

const unmark = el => {
  if (!el.hasAttribute(MARK)) return;
  el.removeAttribute('dir');
  el.removeAttribute(MARK);
  el.removeAttribute(KEEP);
};

const mark = el => {
  if (!el || el.nodeType !== 1) return;
  // a small piece inside a block of text (the "10" in "Mods 10") goes with its block
  const parent = el.parentNode;
  if (INLINE.has(el.tagName.toUpperCase()) && parent && parent.nodeType === 1 && isTextBlock(parent)) {
    unmark(el);
    return;
  }
  if (!isTextBlock(el) || isRow(el)) {
    unmark(el);
    return;
  }
  const rtl = startsRtl(el.textContent);
  // the text keeps the side it has in English: a block that just follows the reading
  // direction (no set alignment) stays on the left (or right) as in English
  if (!el.hasAttribute(KEEP) && window.getComputedStyle) {
    const align = window.getComputedStyle(el).textAlign;
    if (align === 'start' || align === '-webkit-auto' || align === '') el.setAttribute(KEEP, 'left');
    if (align === 'end') el.setAttribute(KEEP, 'right');
  }
  // a text that starts with a number ("0 · Libraries", "3 mods") keeps the English
  // order, like a numbered list; the Arabic words in it still read right to left
  const dir = startsWithNumber(el.textContent) ? 'ltr' : 'auto';
  if (el.getAttribute('dir') !== dir) el.setAttribute('dir', dir);
  el.setAttribute(MARK, dir === 'ltr' ? 'number' : rtl ? 'rtl' : 'ltr');
};

const markTree = root => {
  if (!root || root.nodeType !== 1) return;
  mark(root);
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) mark(all[i]);
};

let observer = null;

// on: watch the window and mark every text block (also the ones that come later)
// off: take every mark away again
export const followTextDirection = on => {
  if (typeof document === 'undefined' || !document.body) return;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (!on) {
    Array.from(document.querySelectorAll('[' + MARK + ']')).forEach(unmark);
    return;
  }
  markTree(document.body);
  if (typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(list => {
    list.forEach(m => {
      if (m.type === 'characterData') {
        const p = m.target.parentNode;
        if (p) mark(p.nodeType === 1 && INLINE.has(p.tagName.toUpperCase()) ? p.parentNode : p);
        return;
      }
      mark(m.target); // it may hold only text now (or not any more)
      m.addedNodes.forEach(markTree);
      if (m.target.nodeType === 1 && INLINE.has(m.target.tagName.toUpperCase())) mark(m.target.parentNode);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
};
