import './index.css';

const TOOLBAR_ID = 'weimob-apollo-toolbar';
const COPY_BUTTON_CLASS = 'weimob-apollo-copy';
const PROCESSED_ATTRIBUTE = 'data-weimob-apollo-copy-ready';

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
  if (!value) return;

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
    document.execCommand('copy');
    textarea.remove();
  }
}

function showCopyFeedback(button: HTMLButtonElement, copied: boolean): void {
  const originalText = '复制';
  button.textContent = copied ? '已复制' : '复制失败';
  button.classList.toggle('weimob-apollo-copy--failed', !copied);
  window.setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('weimob-apollo-copy--failed');
  }, 1200);
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

function addCopyButtons(): void {
  document.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const columnIndexes = copyableColumnIndexes(table);
    if (!columnIndexes.length) return;

    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
      if (row.hasAttribute(PROCESSED_ATTRIBUTE)) return;
      const cells = Array.from(row.children) as HTMLTableCellElement[];
      columnIndexes.forEach((index) => {
        const cell = cells[index];
        if (!cell) return;
        const value = cell.innerText.trim();
        const button = document.createElement('button');
        button.type = 'button';
        button.className = COPY_BUTTON_CLASS;
        button.textContent = '复制';
        button.title = '复制此单元格内容';
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          try {
            await copyText(value);
            showCopyFeedback(button, true);
          } catch {
            showCopyFeedback(button, false);
          }
        });
        cell.append(button);
      });
      row.setAttribute(PROCESSED_ATTRIBUTE, '');
    });
  });
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
  addCopyButtons();
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
new MutationObserver(scheduleRefresh).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
window.addEventListener('hashchange', scheduleRefresh, { signal: controller.signal });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    controller.abort();
    document.getElementById(TOOLBAR_ID)?.remove();
    document.querySelectorAll(`.${COPY_BUTTON_CLASS}`).forEach((button) => button.remove());
    document.querySelectorAll(`[${PROCESSED_ATTRIBUTE}]`).forEach((row) => row.removeAttribute(PROCESSED_ATTRIBUTE));
  });
}
