# derby-quiz

Интерактивная викторина в стиле Kahoot с тремя ролями:
- `teacher` открывает сессию и управляет игрой
- `player` заходит с телефона и отвечает на вопросы
- `screen` показывает общую гонку лошадей и финальный podium

Текущая версия игры:
- весь интерфейс переведён на казахский язык
- вопросы создаются учителем и хранятся в SQLite-библиотеке наборов
- поддерживаются длинные тексты для оқу сауаттылығы
- поддерживаются изображения в самих вопросах и в вариантах ответа
- `teacher` защищён PIN-кодом доступа

## Стек
- `client`: React + Vite + TypeScript + Tailwind CSS + Socket.IO client
- `server`: Fastify + TypeScript + Socket.IO server
- `storage`: local SQLite через Drizzle/better-sqlite3
- `shared`: type-only контракты для вопросов, session state и Socket.IO events

## Что уже есть
- вход игроков по коду игры
- восстановление игрока после refresh через `localStorage`
- восстановление активных сессий из SQLite после рестарта сервера
- state machine игры: `lobby -> question -> result -> lobby|finished`
- библиотека наборов вопросов в SQLite
- серверная валидация rich-question и text-MCQ schema в [`server/questions.ts`](./server/questions.ts)
- Adaptive Queue: учитель может добавить быстрый повторный вопрос в текущую очередь после результатов
- runtime validation env/socket payloads через Zod
- TTL cleanup для старых сессий
- health/readiness/classroom endpoints: `/health`, `/ready`, `/classroom-info`
- unit и integration тесты для сервера
- единая команда classroom-запуска одним Node-процессом
- strict TypeScript typecheck для клиента, сервера и socket-контрактов

## Структура
- [`client`](./client) - интерфейсы teacher/player/screen
- [`client/src/components/ui.tsx`](./client/src/components/ui.tsx) - локальные UI primitives
- [`client/src/hooks/sessionHooks.ts`](./client/src/hooks/sessionHooks.ts) - typed session/socket hooks
- [`client/src/components/QuestionContent.tsx`](./client/src/components/QuestionContent.tsx) - общий renderer passage/image/options
- [`client/src/i18n/kz.ts`](./client/src/i18n/kz.ts) - казахский copy-слой
- [`shared/types.ts`](./shared/types.ts) - type-only contracts для client/server
- [`server/index.ts`](./server/index.ts) - HTTP + Socket.IO transport
- [`server/game.ts`](./server/game.ts) - игровая доменная логика
- [`server/db`](./server/db) - SQLite schema и repository
- [`server/validation.ts`](./server/validation.ts) - Zod schemas для socket payloads
- [`server/config.ts`](./server/config.ts) - env-конфиг
- [`server/questions.ts`](./server/questions.ts) - нормализация и валидация вопросов
- [`package.json`](./package.json) - корневые команды проекта

## Запуск локально

### 1. Установить зависимости
```bash
npm install
```

### 2. Добавить медиафайлы (если есть)
Изображения для вопросов кладутся в `client/public/`:
```
client/public/question-assets/<set-name>/image1.png
```

### 3. Запустить всё одной командой
```bash
npm run dev
```

Поднимает:
- server на `http://localhost:4000`
- client на `http://localhost:5173`

### 4. Classroom mode одним процессом
```bash
npm run classroom
```

Команда собирает клиент, собирает сервер и запускает Fastify так, чтобы он отдавал React build, HTTP endpoints и Socket.IO из одного Node-процесса. В терминале выводятся LAN-ссылки для teacher/screen/join и PIN учителя.

Данные сессий пишутся в:
```
server/data/classroom.sqlite
```

### 5. Или запустить части отдельно

#### Сервер
```bash
npm --workspace server run dev
```

Production-запуск сервера build-first:
```bash
npm --workspace server run build
npm --workspace server start
```

#### Клиент
```bash
npm --workspace client run dev
```

Если сервер доступен не на `http://localhost:4000`, перед запуском клиента задайте:
```bash
VITE_SERVER_URL=http://localhost:4000 npm --workspace client run dev
```

## Контент

Рабочий источник вопросов — SQLite-таблица `question_sets`. Учитель создаёт наборы после входа по PIN-коду на странице `/teacher`, выбирает набор и запускает игру из него.

В первой версии редактор поддерживает текстовые multiple-choice вопросы:
- текст вопроса
- 2-6 текстовых вариантов ответа
- один правильный вариант

Активная сессия получает копию выбранного набора. Если позже изменить набор в библиотеке, уже запущенная игра не меняется.

## Формат вопроса
Каждый вопрос содержит:
- `id`
- `type`: `mcq | reading_mcq | image_mcq`
- `stem`
- `passageTitle`
- `passage`
- `image` — путь относительно `client/public/` (например `/question-assets/set/image1.png`)
- `options`: массив `{ label, text, image }`
- `correctIndex`
- `groupId`
- `sourceMeta`

Вопросы, созданные через текущий UI-редактор, сохраняются как `mcq`, а rich-поля (`passageTitle`, `passage`, `image`, `groupId`, `sourceMeta`) заполняются `null`.

## Переменные окружения сервера
- `PORT` — порт сервера, по умолчанию `4000`
- `CLIENT_ORIGINS` — список origin через запятую для CORS, по умолчанию `*`
- `MAX_PLAYERS_PER_SESSION` — лимит игроков в сессии, по умолчанию `50`
- `SESSION_TTL_MS` — TTL сессии в миллисекундах, по умолчанию `14400000`
- `SESSION_CLEANUP_INTERVAL_MS` — интервал cleanup в миллисекундах, по умолчанию `300000`
- `TEACHER_ACCESS_PIN` — PIN для доступа на страницу учителя; если не задан, сервер сгенерирует PIN и выведет его в терминал
- `CLASSROOM_DATABASE_PATH` — путь к SQLite-файлу, по умолчанию `server/data/classroom.sqlite` при запуске через workspace scripts
- `CLASSROOM_STATIC_DIR` — путь к собранному клиенту для single-process classroom mode

Пример:
```bash
PORT=4000 CLIENT_ORIGINS=http://localhost:5173 TEACHER_ACCESS_PIN=246810 npm --workspace server run dev
```

## Проверки
```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run audit:prod
```

`npm test` запускает:
- strict TypeScript typecheck
- unit-тесты доменной логики сессий
- unit-тесты loader'а вопросов
- integration test для Socket.IO сценария teacher/player

## Игровой сценарий
1. Открой `/teacher`
2. Покажи QR или ссылку игрокам
3. Открой `/screen/:code` на проекторе
4. Запускай вопрос, показывай результаты, переходи к следующему

## Ограничения текущей версии
- runtime state держится in-memory для скорости, а активные сессии сохраняются в SQLite для restart restore
- teacher защищён PIN-кодом доступа, а teacher/player действия подтверждаются токенами сессии
- контентный слой не имеет админки или автоматического импорта из DOCX
