# kahoot-horses

Небольшой MVP викторины в стиле Kahoot с тремя ролями:
- `teacher` создаёт и ведёт игру
- `player` подключается с телефона и отвечает на вопросы
- `screen` показывает общую гонку лошадей и итоговый podium

Стек:
- `client`: React + Vite + Socket.IO client
- `server`: Express + Socket.IO server
- `questions.json`: контент вопросов

## Что уже есть
- вход игроков по коду игры
- восстановление игрока после refresh через `localStorage`
- guarded state machine игры: `lobby -> question -> result -> lobby|finished`
- единый источник вопросов в [`questions.json`](/Users/kozi/Documents/kahoot-horses/questions.json)
- серверная нормализация и валидация вопросов в [`server/questions.js`](/Users/kozi/Documents/kahoot-horses/server/questions.js)
- TTL cleanup для старых сессий
- health/readiness endpoints: `/health`, `/ready`
- unit и integration тесты для сервера
- единая команда запуска `client + server`

## Структура
- [`client`](/Users/kozi/Documents/kahoot-horses/client) - интерфейсы teacher/player/screen
- [`server/index.js`](/Users/kozi/Documents/kahoot-horses/server/index.js) - HTTP + Socket.IO transport
- [`server/game.js`](/Users/kozi/Documents/kahoot-horses/server/game.js) - игровая доменная логика
- [`server/config.js`](/Users/kozi/Documents/kahoot-horses/server/config.js) - env-конфиг
- [`server/questions.js`](/Users/kozi/Documents/kahoot-horses/server/questions.js) - загрузка и валидация вопросов
- [`questions.json`](/Users/kozi/Documents/kahoot-horses/questions.json) - набор вопросов
- [`scripts/dev.sh`](/Users/kozi/Documents/kahoot-horses/scripts/dev.sh) - локальный запуск `server + client`
- [`package.json`](/Users/kozi/Documents/kahoot-horses/package.json) - корневые команды проекта

## Запуск локально
### 1. Установить зависимости
```bash
cd client && npm install
cd ../server && npm install
```

### 2. Запустить всё одной командой
```bash
npm run dev
```

Эта команда из корня проекта поднимает:
- server на `http://localhost:4000`
- client на `http://localhost:5173`

### 3. Или запустить части отдельно
#### Сервер
```bash
cd server
npm start
```

По умолчанию сервер стартует на `http://localhost:4000`.

#### Клиент
```bash
cd client
npm run dev
```

По умолчанию Vite поднимет клиент на `http://localhost:5173`.

Если сервер доступен не на `http://localhost:4000`, перед запуском клиента задайте:
```bash
VITE_SERVER_URL=http://localhost:4000 npm run dev
```

## Переменные окружения сервера
- `PORT` - порт сервера, по умолчанию `4000`
- `CLIENT_ORIGINS` - список origin через запятую для CORS, по умолчанию `*`
- `MAX_PLAYERS_PER_SESSION` - лимит игроков в сессии, по умолчанию `50`
- `SESSION_TTL_MS` - TTL сессии в миллисекундах, по умолчанию `14400000`
- `SESSION_CLEANUP_INTERVAL_MS` - интервал cleanup в миллисекундах, по умолчанию `300000`

Пример:
```bash
PORT=4000 CLIENT_ORIGINS=http://localhost:5173 npm start
```

## Проверки
### Из корня проекта
```bash
npm run lint
npm run build
npm run test
```

### Клиент
```bash
cd client
npm run lint
npm run build
```

### Сервер
```bash
cd server
npm test
```

`npm test` запускает:
- unit-тесты доменной логики сессий
- integration test для Socket.IO сценария teacher/player

## Игровой сценарий
1. Открой `/teacher`
2. Покажи QR или ссылку игрокам
3. Открой `/screen/:code` на проекторе
4. Запускай вопрос, показывай результаты, переходи к следующему

## Технические ограничения текущей версии
- сессии хранятся in-memory и пропадают при рестарте сервера
- авторизация teacher/player не реализована
- набор вопросов статический, хранится в JSON без админки и персистентного хранилища
