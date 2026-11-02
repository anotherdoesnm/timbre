# Timbre — клиент Harmony

> Имя: **Timbre** (тембр — та же нота, другая окраска). «Harmony» — платформа, поэтому в
> названии клиента его нет: этого требует TRADEMARK апстрима, а видимая строка
> «Powered by Harmony» остаётся.

Статический скелет клиента: раскладка и палитра в духе Cinny, данные — моки, Supabase не подключён.
Это проверка «попадаем ли в ощущение», а не работающий клиент.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Что внутри

| Файл | Что делает |
|---|---|
| `src/styles/tokens.css` | палитра Cinny dark (`src/colors.css.ts`), радиусы, отступы, ширины панелей |
| `src/data/mock.ts` | серверы (реальные публичные с har.mony.lol), каналы, сообщения, участники |
| `src/components/ServerRail.vue` | рейл серверов 64 px, индикатор активного, точка непрочитанного |
| `src/components/RoomList.vue` | список каналов по категориям, бейджи упоминаний, замок у зашифрованных |
| `src/components/ChatHeader.vue` | шапка 48 px, топик, переключатель участников |
| `src/components/MessageList.vue` | группировка сообщений, hover-тулбар, пустое состояние для E2EE-канала |
| `src/components/Composer.vue` | поле ввода с тулбаром, `disabled` в зашифрованном канале |
| `src/components/MemberList.vue` | правая панель, роли, отошедшие, офлайн |
| `src/components/AuthScreen.vue` | вход: адрес инстанса → карточка инстанса → провайдеры / пароль |
| `src/services/discover.ts` | `GET /api/federation/instance-info` + `/auth/v1/settings`, четыре класса ошибок |

Зашифрованные каналы (`design`, `mod-chat`) показывают заглушку и выключенный композер — это то
правило «никакого даунгрейда», а не временная недоделка.

Полный список сделанного и планов — [`ROADMAP.md`](ROADMAP.md).

## Идентификаторы

| Что | Значение |
|---|---|
| Имя продукта | **Timbre** |
| npm-пакет | `timbre` |
| Tauri bundle identifier | `xyz.doesnmlab.timbre` |
| Кто платформа | Harmony (не входит в имя клиента — TRADEMARK апстрима) |

## Происхождение токенов

Значения цветов взяты из Cinny (AGPL-3.0): `src/colors.css.ts` → `darkTheme`, шкала `folds`.
Имена переписаны в обычные CSS-переменные, чтобы SFC могли их использовать без `vanilla-extract`.
Если рестайл пойдёт в релиз — это производная работа, исходники публикуются под AGPL.

## Скриншоты

`shots/chat-general.png` — канал `# general`, `shots/chat-encrypted.png` — зашифрованный `# design`,
`shots/auth-idle.png` — вход (пусто), `shots/auth-instance.png` — инстанс найден (`?demo=1`),
`shots/auth-error.png` — ошибка, `shots/auth-callback.png` — возврат с OAuth (`?demo=1`),
`shots/auth-live.png` — реальный ответ har.mony.lol через dev-прокси (без моков).
Снято headless-Chromium'ом через `scripts/screenshot.mjs` (1440x900, DPR 2).

Восстановить тулчейн в этой песочнице (Chrome for Testing качается в `.pw`, системных
библиотек нет — они распаковываются из deb'ов в `.libs`):

```bash
export PLAYWRIGHT_BROWSERS_PATH=$PWD/.pw LD_LIBRARY_PATH=$PWD/.libs/root/usr/lib/x86_64-linux-gnu
npx playwright install chromium
mkdir -p .libs && cd .libs && apt-get download libglib2.0-0 libnss3 libxi6 libwayland-server0 # + остальные
for f in *.deb; do dpkg-deb -x "$f" root/; done
```

Шрифт — Inter (variable, latin + cyrillic) в `public/fonts/`, локально, без CDN.

## Dev-прокси (CORS)

Инстанс не отдаёт `Access-Control-Allow-Origin` ни на `instance-info`, ни на `config.json`,
поэтому браузер с `localhost:5173` не может его опросить. Для разработки в `vite.config.ts`
поднят посредник:

```
/__instance/har.mony.lol/api/federation/instance-info   →  https://har.mony.lol/api/federation/instance-info
/__instance/db.mony.lol/auth/v1/settings                →  https://db.mony.lol/auth/v1/settings
```

Он работает только в `vite dev` (`apply: 'serve'`), пробрасывает заголовки (нужен `apikey` для GoTrue)
и не попадает в сборку. В проде запрос идёт напрямую — из Tauri это нормально, из браузера нужен
релей или CORS на инстансе.

## Маршруты

`#auth` (по умолчанию) — экран входа, `#chat` — оболочка чата. `?demo=1` подставляет
заготовленный ответ `instance-info` и помечает карточку инстанса плашкой «демо».

Без `?demo=1` делается настоящий запрос. Из браузера на чужом origin он сейчас падает:
`instance-info` не отдаёт `Access-Control-Allow-Origin`, и это ровно то состояние, что
на `screenshot-5.png`. В Tauri (запрос через Rust) или за релеем — проходит.

## Tauri

`src-tauri/` — каркас оболочки: `identifier` = `xyz.doesnmlab.timbre`, фронт берётся из `dist`.

```bash
npm run build
npx tauri android init --ci      # один раз, генерирует src-tauri/gen/android
npx tauri android build --apk --debug --target aarch64
npx tauri build                  # десктоп, нужен libwebkit2gtk-4.1-dev и rust
```

Почему Tauri вообще нужен: в браузере на чужом origin логин через OAuth не работает —
`redirect_to` не в allowlist инстанса, и GoTrue уводит на SITE_URL. Внутри Tauri origin
свой (`tauri://localhost` / `http://tauri.localhost`), и официальный десктоп входит точно
так же, поэтому запись в списке уже есть.

OAuth в оболочке идёт через попап-окно (`src/services/tauriOAuth.ts`): главное окно не
навигируется, попап возвращается на `/auth/callback`, сессия ложится в общее хранилище,
попап шлёт `timbre:oauth-complete` и закрывается.

Сборка APK — `.forgejo/workflows/apk.yml`, раннер с меткой `android` (runnerd).
`src-tauri/debug.keystore` лежит в репозитории намеренно: без него свежая VM генерирует
новый debug-ключ на каждый ран, и Android отказывается ставить сборку поверх предыдущей. Rust и
конфиг Tauri в этом репозитории **ещё не компилировались** — первый прогон в CI и есть
проверка.

## Дальше

1. OAuth-флоу: popup в Tauri, `redirect_to` = `${origin}/auth/callback`; для веба нужен
   `ADDITIONAL_REDIRECT_URLS` на инстансе.
2. Подменить моки на стор из форка (сохранив `script`, заменив `template`/`style`).
3. Ленивая инициализация Supabase вместо модульной.
