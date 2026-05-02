/**
 * Слой доступа к данным.
 *
 * Все компоненты ходят за схемами/проектами/ветками только сюда.
 * На 11 неделе плана внутренности заменим на fetch к бэкенду —
 * сигнатуры публичных методов остаются такими же, UI не трогаем.
 */

export type DiagramXml = string;

const KEY_CURRENT = 'petria:current-diagram';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // квота переполнена / приватный режим — молча игнорируем
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const dataLayer = {
  loadCurrentDiagram(): DiagramXml | null {
    return safeGet(KEY_CURRENT);
  },

  saveCurrentDiagram(xml: DiagramXml): void {
    safeSet(KEY_CURRENT, xml);
  },

  clearCurrentDiagram(): void {
    safeRemove(KEY_CURRENT);
  },
};
