# paipachi ?箇

paipachi ?舀?璈??憌脤??澈擃?憟蕭頩?Web App?敹?撽???找摯蝞??霈?憛雿輻??????敺???批銝憭拍????餈質馱瘞游??郊?詻?????蝻箏??
## Current Test Build

- App version: `paipachi-app-v214`
- PWA cache: `paipachi-pwa-v214`
- Local URL: http://localhost:8788/
- Vercel production: https://paipachi.vercel.app/

## Core Features

- Passwordless beta login by account name.
- First-use onboarding for goal, height, weight, and target calories.
- Account-scoped profile persistence, so height and weight do not reset after browser changes when the same account is used.
- Before-meal photo estimate and optional after-meal photo comparison.
- Today album with date, meal slots, photos, calories, macros, and next-meal advice.
- Text-assisted calorie estimate for soups, drinks, rice, bento, fried rice, and common meals.
- Daily nutrition status for protein, fiber, water, sugar, sodium, and calories.
- Water tracking and automatic step estimate while the phone page is open.
- TATA growth/state system that reacts to healthier or heavier eating patterns.

## Smoke Tests

Use the bundled Node runtime on this machine:

```powershell
& 'C:\Users\krake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\scripts\paipachi-smoke-test.js
```

```powershell
& 'C:\Users\krake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\scripts\paipachi-ui-smoke-test.js
```

```powershell
node .\scripts\p4-static-smoke-test.js
```

## Vercel Deployment

This build includes `vercel.json` for SPA refresh support, long-lived cache headers for `app.js` and `styles.css`, and no-cache headers for `index.html` and `sw.js`.

```powershell
npm i -g vercel
vercel login
vercel --prod
```

After deployment, verify:

- The production URL opens on mobile: https://paipachi.vercel.app/
- Refreshing nested routes falls back to `index.html`.
- `styles.css?v=214` and `app.js?v=214` are served with immutable cache headers.
- `sw.js` updates without stale caching.

Public tunnel UI smoke:

```powershell
$env:paipachi_BASE_URL='https://agency-drawings-hero-push.trycloudflare.com'; & 'C:\Users\krake\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\scripts\paipachi-ui-smoke-test.js
```

## Reference Docs

- `paipachi_V41_TEST_NOTES.md`: current test checklist.
- `NUTRITION_GUIDELINES.md`: nutrition baselines and official sources used by the app.
- `PRODUCT_ROADMAP.md`: product direction, milestones, and acceptance criteria.
