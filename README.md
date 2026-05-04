# derby-quiz

Интерактивная викторина в стиле Kahoot с тремя ролями:
- `teacher` открывает сессию и управляет игрой
- `player` заходит с телефона и отвечает на вопросы
- `screen` показывает общую гонку лошадей и финальный podium

Текущая версия игры:
- весь интерфейс переведён на казахский язык
- вопросы хранятся в [`questions.json`](./questions.json)
- поддерживаются длинные тексты для оқу сауаттылығы
- поддерживаются изображения в самих вопросах и в вариантах ответа
- `teacher` защищён PIN-кодом доступа

## Стек
- `client`: React + Vite + TypeScript + Socket.IO client
- `server`: Express + TypeScript + Socket.IO server
- `shared`: type-only контракты для вопросов, session state и Socket.IO events
- `questions.json`: нормализованный набор rich-вопросов для runtime

## Что уже есть
- вход игроков по коду игры
- восстановление игрока после refresh через `localStorage`
- state machine игры: `lobby -> question -> result -> lobby|finished`
- единый источник вопросов в [`questions.json`](./questions.json)
- серверная валидация rich-question schema в [`server/questions.ts`](./server/questions.ts)
- TTL cleanup для старых сессий
- health/readiness endpoints: `/health`, `/ready`
- unit и integration тесты для сервера
- единая команда запуска `client + server`
- strict TypeScript typecheck для клиента, сервера и socket-контрактов

## Структура
- [`client`](./client) - интерфейсы teacher/player/screen
- [`client/src/components/QuestionContent.tsx`](./client/src/components/QuestionContent.tsx) - общий renderer passage/image/options
- [`client/src/i18n/kz.ts`](./client/src/i18n/kz.ts) - казахский copy-слой
- [`shared/types.ts`](./shared/types.ts) - type-only contracts для client/server
- [`server/index.ts`](./server/index.ts) - HTTP + Socket.IO transport
- [`server/game.ts`](./server/game.ts) - игровая доменная логика
- [`server/config.ts`](./server/config.ts) - env-конфиг
- [`server/questions.ts`](./server/questions.ts) - загрузка и валидация вопросов
- [`questions.json`](./questions.json) - runtime-набор вопросов
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

### 4. Или запустить части отдельно

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

Рабочий источник вопросов: [`questions.json`](./questions.json)

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

## Переменные окружения сервера
- `PORT` — порт сервера, по умолчанию `4000`
- `CLIENT_ORIGINS` — список origin через запятую для CORS, по умолчанию `*`
- `MAX_PLAYERS_PER_SESSION` — лимит игроков в сессии, по умолчанию `50`
- `SESSION_TTL_MS` — TTL сессии в миллисекундах, по умолчанию `14400000`
- `SESSION_CLEANUP_INTERVAL_MS` — интервал cleanup в миллисекундах, по умолчанию `300000`
- `TEACHER_ACCESS_PIN` — PIN для доступа на страницу учителя; если не задан, сервер сгенерирует PIN и выведет его в терминал

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
- сессии хранятся in-memory и пропадают при рестарте сервера
- teacher защищён PIN-кодом доступа, а teacher/player действия подтверждаются токенами сессии
- контентный слой не имеет админки или автоматического импорта из DOCX
