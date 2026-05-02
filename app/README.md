# Petria Editor (v1)

React + Vite + TypeScript версия редактора BPMN. Часть **недели 1**
12-недельного плана: чистый каркас, перенос редактора, автосохранение
в `localStorage`.

## Запуск

```bash
cd app
npm install
npm run dev
```

Откроется на `http://localhost:5173`.

## Скрипты

| Команда             | Что делает                                  |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | dev-сервер с hot reload                     |
| `npm run build`     | продакшн-сборка в `dist/` (с проверкой TS)  |
| `npm run preview`   | локальный просмотр продакшн-сборки          |
| `npm run typecheck` | проверка типов без сборки                   |

## Структура

```
app/
├── src/
│   ├── components/
│   │   ├── BpmnEditor.tsx   # обёртка над bpmn-js Modeler
│   │   └── Toolbar.tsx      # тулбар с базовыми действиями
│   ├── lib/
│   │   ├── bpmn.ts          # EMPTY_XML и константы
│   │   └── dataLayer.ts     # ⚠ единая точка доступа к данным
│   ├── styles/app.css
│   ├── types/bpmn-js.d.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Архитектурный принцип: dataLayer

Весь UI ходит за схемами **только через `dataLayer`**. Сейчас под капотом
`localStorage`, на 11 неделе плана внутренности заменим на fetch к API.
Сигнатуры публичных методов остаются прежними — UI не трогаем.

## Что уже работает (неделя 1)

- bpmn-js Modeler в React-компоненте.
- Тулбар: новая схема, загрузка/скачивание XML, скачивание SVG, fit-to-view.
- Автосохранение в `localStorage` с debounce 500мс.
- Восстановление последней схемы при перезагрузке страницы.

## Следующие недели

См. план в корневом `README.md`.
