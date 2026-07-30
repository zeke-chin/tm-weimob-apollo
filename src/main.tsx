import './index.css';

const TOOLBAR_ID = 'weimob-apollo-toolbar';
const COPY_CELL_CLASS = 'weimob-apollo-copy-cell';
const COPY_CELL_ATTRIBUTE = 'data-weimob-apollo-copy-cell';
const TOAST_ID = 'weimob-apollo-copy-toast';

function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getToggleElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('a, button'))
    .filter((element) => element.id !== TOOLBAR_ID && isVisible(element))
    .filter((element) => {
      const text = element.textContent?.replace(/[\[\]【】\s]/g, '') ?? '';
      return text === '展开' || text === '收缩' || text === '展开/收缩';
    });
}

function namespaceContainer(toggle: HTMLElement): HTMLElement | null {
  let current = toggle.parentElement;
  while (current && current !== document.body) {
    if (/namespace/i.test(current.className)) return current;
    current = current.parentElement;
  }
  return null;
}

function isExpanded(toggle: HTMLElement): boolean | null {
  const text = toggle.textContent?.replace(/[\[\]【】\s]/g, '') ?? '';
  if (text === '收缩') return true;
  if (text === '展开') return false;

  // Apollo's legacy UI displays the static label “展开/收缩”.  Its table is
  // mounted only for open namespaces, which lets us keep this bulk operation
  // idempotent even when a page is currently in a mixed open/closed state.
  const container = namespaceContainer(toggle);
  if (!container) return null;
  return Array.from(container.querySelectorAll('table')).some(isVisible);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function toggleAll(target: 'expand' | 'collapse'): Promise<void> {
  const shouldBeExpanded = target === 'expand';
  const mismatched = getToggleElements().filter((element) => {
    const expanded = isExpanded(element);
    return expanded !== null && expanded !== shouldBeExpanded;
  });

  // The old Apollo page replaces parts of its DOM after an expand/collapse.
  // Triggering every link in one synchronous loop can therefore lose the later
  // collapse events.  Apply them one at a time instead.  If a just-expanded
  // page cannot be introspected reliably, the button's known "collapse" action
  // safely falls back to its visible namespace controls.
  const toggles = mismatched.length || target === 'expand'
    ? mismatched
    : getToggleElements();

  for (const toggle of toggles) {
    toggle.click();
    await delay(80);
  }
}

function setToolbarAction(action: 'expand' | 'collapse'): void {
  const button = document.querySelector<HTMLButtonElement>(`#${TOOLBAR_ID} button`);
  if (!button) return;
  button.dataset.action = action;
  button.textContent = action === 'expand' ? '全部展开' : '全部收缩';
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard copy failed');
  }
}

function showCopyFeedback(value: string, copied: boolean): void {
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.className = copied ? '' : 'weimob-apollo-copy-toast--failed';
  const preview = value.length > 60 ? `${value.slice(0, 60)}…` : value;
  toast.textContent = copied ? `「${preview}」已复制到剪切板` : '复制到剪切板失败';
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

function copyableColumnIndexes(table: HTMLTableElement): number[] {
  const header = table.querySelector('thead tr');
  if (!header) return [];
  const labels = ['Key', 'Value', '备注', '最后修改人'];
  return Array.from(header.children)
    .map((cell, index) => ({ index, text: cell.textContent?.trim() ?? '' }))
    .filter(({ text }) => labels.some((label) => text.startsWith(label)))
    .map(({ index }) => index);
}

function markCopyCells(): void {
  document.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const columnIndexes = copyableColumnIndexes(table);
    if (!columnIndexes.length) return;

    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      const cells = Array.from(row.children) as HTMLTableCellElement[];
      columnIndexes.forEach((index) => {
        const cell = cells[index];
        if (!cell || cell.hasAttribute(COPY_CELL_ATTRIBUTE) || !cell.innerText.trim()) return;
        cell.classList.add(COPY_CELL_CLASS);
        cell.setAttribute(COPY_CELL_ATTRIBUTE, '');
      });
    });
  });
}

function copyCellFromEventTarget(target: EventTarget | null): HTMLTableCellElement | null {
  return target instanceof Element
    ? target.closest<HTMLTableCellElement>(`td.${COPY_CELL_CLASS}`)
    : null;
}

let selectionGesture:
  | { cell: HTMLTableCellElement; x: number; y: number; moved: boolean; selected: boolean }
  | null = null;

function setupCopyInteraction(): void {
  document.addEventListener('mousedown', (event) => {
    const cell = copyCellFromEventTarget(event.target);
    if (!cell) {
      selectionGesture = null;
      return;
    }

    selectionGesture = { cell, x: event.clientX, y: event.clientY, moved: false, selected: false };
    // Apollo selects a cell on mousedown, before the click handler below can
    // intercept it. Stop that page-level interaction while preserving the
    // browser's default text-selection behavior for drag gestures.
    event.stopImmediatePropagation();
  }, { capture: true, signal: controller.signal });

  document.addEventListener('mousemove', (event) => {
    if (!selectionGesture) return;
    if (Math.abs(event.clientX - selectionGesture.x) + Math.abs(event.clientY - selectionGesture.y) > 3) {
      selectionGesture.moved = true;
    }
  }, { capture: true, signal: controller.signal });

  document.addEventListener('mouseup', (event) => {
    if (!selectionGesture) return;
    selectionGesture.selected = selectionGesture.moved && Boolean(window.getSelection()?.toString().trim());
    if (selectionGesture.selected) {
      // Apollo binds a click-like handler to these cells and opens its “查看”
      // dialog after a drag selection.  Stop that handler after the browser has
      // already made the native selection, so Cmd/Ctrl+C still works normally.
      event.stopImmediatePropagation();
    }
  }, { capture: true, signal: controller.signal });

  document.addEventListener('click', async (event) => {
    const cell = copyCellFromEventTarget(event.target);
    if (!cell) {
      selectionGesture = null;
      return;
    }

    const selected = selectionGesture?.cell === cell && selectionGesture.selected;
    selectionGesture = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (selected) return;

    const value = cell.innerText.trim();
    try {
      await copyText(value);
      showCopyFeedback(value, true);
    } catch {
      showCopyFeedback(value, false);
    }
  }, { capture: true, signal: controller.signal });
}

function mountToolbar(): void {
  if (document.getElementById(TOOLBAR_ID)) return;

  const toolbar = document.createElement('div');
  toolbar.id = TOOLBAR_ID;
  toolbar.innerHTML = `
    <button type="button"></button>
  `;
  toolbar.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    const action = button?.dataset.action;
    if (!button || (action !== 'expand' && action !== 'collapse') || button.disabled) return;

    button.disabled = true;
    button.textContent = action === 'expand' ? '正在展开…' : '正在收缩…';
    try {
      await toggleAll(action);
      setToolbarAction(action === 'expand' ? 'collapse' : 'expand');
    } finally {
      button.disabled = false;
    }
  });
  document.body.append(toolbar);
  setToolbarAction('expand');
}

function refresh(): void {
  mountToolbar();
  document.querySelectorAll('.weimob-apollo-copy').forEach((button) => button.remove());
  markCopyCells();
}

const controller = new AbortController();
let refreshQueued = false;

function scheduleRefresh(): void {
  if (refreshQueued) return;
  refreshQueued = true;
  window.requestAnimationFrame(() => {
    refreshQueued = false;
    refresh();
  });
}

refresh();
setupCopyInteraction();
new MutationObserver(scheduleRefresh).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
window.addEventListener('hashchange', scheduleRefresh, { signal: controller.signal });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    controller.abort();
    document.getElementById(TOOLBAR_ID)?.remove();
    document.getElementById(TOAST_ID)?.remove();
    document.querySelectorAll(`.${COPY_CELL_CLASS}`).forEach((cell) => cell.classList.remove(COPY_CELL_CLASS));
    document.querySelectorAll(`[${COPY_CELL_ATTRIBUTE}]`).forEach((cell) => cell.removeAttribute(COPY_CELL_ATTRIBUTE));
  });
}
