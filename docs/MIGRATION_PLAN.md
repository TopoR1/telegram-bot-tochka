# План миграции на JavaScript

Документ фиксирует текущую структуру каталога `src/` и перечисляет шаги миграции с учётом используемых типов. План сгруппирован по основным модулям (`bot`, `services`, `storage`, `utils`). Отдельно отмечены зависимости между модулями и участки, где ранее опирались на статическую типизацию.

## Общая структура

- `index.ts` — точка входа приложения, инициализация Telegraf-бота, загрузка конфигурации, настройка каталогов.
- `config.ts` — сборка конфигурации из `config/default.json`, переменных окружения и CLI. Определяет типы `BotConfig`, `AppConfig`, `PollingConfig`, `WebhookConfig`.
- `bot/` — Telegraf-бот: создание экземпляра, обработчики команд и клавиатуры, управление сессией в памяти.
- `services/` — доменная логика: хранение и обновление профилей курьеров/администраторов, разбор XLSX, сопоставление курьеров, рассылки, отчётность.
- `services/types.ts` содержит интерфейсы `CourierRecord`, `AdminRecord`, `AdminProfile`, `CourierCard`, `DeliveryRecord`, `GroupBinding`, `AnnouncementPayload` и строковое перечисление статусов доставок.
- `storage/` — обёртки над файловым хранилищем: общее хранилище `JsonStore`, конкретные репозитории (`courierStore`, `adminStore`, `deliveriesStore` и т.д.), механизмы миграции данных.
- `utils/` — вспомогательные функции для форматирования, логирования, работы с телефоном и ФИО.

В TypeScript-версии типы модулей пересекаются следующим образом:

| Модуль | Используемые типы |
| --- | --- |
| `bot` | `BotContext`, `CourierRecord`, `AdminProfile`, `GroupBinding` |
| `services` | `CourierRecord`, `AdminRecord`, `CourierCard`, `DeliveryRecord`, `AnnouncementPayload`, `GroupBinding`, строковое перечисление `DeliveryStatus` |
| `storage` | Коллекции `Record<string, CourierRecord>` / `Record<string, AdminRecord>`, `AnnouncementPayload[]`, служебные типы `JsonStoreOptions<T>`, `MigrationResult<T>` |
| `utils` | Не вводит собственных типов, но использует структуры из `services/types.ts` и примитивы |

## Модуль `bot`

**Компоненты:**

- `bot/index.ts` — функция `createBot(token: string)`, регистрирующая все обработчики.
- `bot/handlers/*.ts` — обработчики команд (`start`, `help`, `chatMembers`, `adminUpload` и т.д.).
- `bot/adminHandlers.ts` — специализированные команды администраторов (`/bind_group`, `/announce`).
- `bot/session.ts` — in-memory session manager (`SessionState`), методы `attachSession`, `persistSession`.
- `bot/types.ts` — интерфейс `BotContext` с расширением Telegraf `Context`.

**Зависимости:** практически все обработчики используют сервисы (`courierService`, `adminService`, `dispatch`, `group-announcements`) и хранилища. Тип `BotContext` агрегирует `CourierRecord`, `AdminProfile` и вспомогательную сессию.

**План миграции:**

1. Переписать `BotContext` на JSDoc-тип с расширением базового `Context`. Для сессионных структур (`SessionState`, `PendingGroupBinding`) создать JSDoc-описания и экспортировать функции-хелперы.
2. Обновить `session.ts`: заменить generic `Map<number, SessionState>` на plain `Map`, добавить JSDoc-комментарии и сохранить runtime-валидацию (`if (!userId) return`).
3. В обработчиках добавить JSDoc для `ctx` и входных аргументов, а также проверки там, где раньше полагались на типы.
4. В `createBot` оставить проверку токена и задокументировать возвращаемый `Telegraf`.

## Модуль `services`

**Компоненты:**

- `services/types.ts` — центральное описание доменных структур. Интерфейсы для курьеров, администраторов, карточек, анонсов; строковое перечисление `DeliveryStatus`.
- `courierService.ts` / `adminService.ts` — CRUD-операции для профилей с таймстемпами `dayjs`.
- `dispatch.ts`, `broadcast.ts`, `group-announcements.ts` — отправка карточек и анонсов, формирование сообщений.
- `matching.ts`, `courierMatcher.ts`, `task-search.ts` — алгоритмы сопоставления курьеров по телефону и имени.
- `xlsxParser.ts` — парсинг XLSX-файлов и преобразование в `CourierCard[]`.
- `delivery-report.ts` — агрегирование истории доставок и формирование текстового отчёта.

**План миграции:**

1. В `services/types.ts` заменить интерфейсы на JSDoc-`@typedef`, сформировать константы `DeliveryStatus` и массив значений для runtime-проверок, добавить guard-функции `isCourierRecord`, `isGroupBinding`, `isAnnouncementPayload`.
2. В сервисах, работающих с данными (`courierService`, `adminService`, `dispatch`), добавить проверки аргументов (`telegramId` — целое число, `updater` — функция) и JSDoc над экспортируемыми функциями.
3. В модулях, формирующих сообщения (`delivery-report`, `group-announcements`, `broadcast`), документировать входные структуры и использовать guard-функции до обработки данных.
4. В `xlsxParser` описать ожидаемую структуру листов и предусмотреть проверки результата парсинга.

## Модуль `storage`

**Компоненты:**

- `jsonStore.ts` — generic-хранилище на файловой системе с Ajv-валидацией и атомарными записями. Типы `JsonStoreOptions<T>` и `MigrationResult<T>`.
- `index.ts` — экспорт готовых стореджей (`courierStore`, `adminStore`, `announcementStore`).
- `deliveriesStore.ts`, `usersStore.ts`, `groupBindingsStore.ts`, `adminTablesStore.ts` — специализированные хранилища с миграциями и служебными типами (`DeliveriesState`, `UserState` и т.д.).

**План миграции:**

1. В `jsonStore.ts` описать `JsonStoreOptions` и `MigrationResult` через JSDoc с `@template T`, добавить комментарии к методам `read`, `write`, `update`.
2. В `index.ts` задокументировать типы коллекций (`Record<string, CourierRecord>` и т.п.) и снабдить инстансы `JsonStore` JSDoc-аннотациями.
3. В специализированных сторах сохранить существующие runtime-проверки (`isDeliveriesStoreData`, `isUserRecord`) и дополнительно снабдить экспортируемые функции JSDoc.
4. Убедиться, что миграции (возврат `MigrationResult`) корректно работают без TypeScript generic-ов; при необходимости переиспользовать guard-функции из `services/types.ts`.

## Модуль `utils`

**Компоненты:**

- `logger.ts` — запись в журнал и ротация файлов (использует `fs-extra`).
- `format.ts` — функции форматирования карточек и сообщений (даты, статусы, шаблоны).
- `phone.ts` — нормализация и проверка телефонных номеров.
- `name.ts` — утилиты для работы с ФИО.

**План миграции:**

1. Удалить TypeScript-аннотации и заменить их JSDoc-комментариями, особенно для функций, возвращающих сложные объекты (`formatTaskCard`, `writeAuditLog`).
2. Проверить, что функции, зависящие от конфигурации (`writeAuditLog`) корректно обрабатывают ошибки записи и создают каталоги (runtime-проверки).
3. Для строковых утилит (`normalizePhone`) обеспечить проверку типа входного значения.

## Завершение миграции

- Сформировать зеркальные `.js`-версии всех файлов и удалить исходные `.ts`.
- Обновить `package.json`: убрать TypeScript-зависимости, добавить ESLint и скрипты запуска без компиляции.
- Удалить `tsconfig.json`, настроить ESLint под JavaScript и убедиться, что `npm run build`, `npm start`, `npm run dev` работают напрямую с Node.js.
- Обновить документацию (`README.md`) с инструкциями по запуску JavaScript-версии и описанием зависимостей.
- Провести smoke-тест: запуск бота в режиме `polling` на тестовом токене, проверка загрузки XLSX (через мок) и записи аудита.
