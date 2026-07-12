# OtterFit Product Roadmap

This roadmap turns the current product direction into buildable, testable milestones. The goal is to make OtterFit feel more useful than a generic calorie tracker: photo-first, memory-rich, emotionally sticky, and decision-friendly.

## Product Positioning

OtterFit is a mobile-first food and body rhythm companion. The core promise is:

> Take a photo before eating, optionally take another after eating, and let TATA help estimate calories, keep the memory, and decide the next better meal.

OtterFit should avoid feeling like a cold health dashboard. The tone is quiet, warm, and precise: Notion / Headspace calm, with TATA as a low-pressure companion.

## Non-Negotiable Core

1. Account-scoped onboarding
   - First-time users fill goal, height, weight, and target calories.
   - Returning users should not be asked again.
   - Data must follow the account, not just the browser.

2. Photo calorie estimate
   - Before-meal photo is the primary action.
   - AI must show what food it thinks it saw.
   - When AI is unavailable, local rules must return a useful estimate instead of zero or a raw provider error.

3. Before/after meal memory
   - Before photo saves immediately.
   - After photo is optional, not forced.
   - When after photo exists, the app stores both photos and estimates actual consumed calories.

4. Today album
   - User can see today's date, meal slots, all photos, calories, and nutrition details.
   - Meal slot should be inferred by photo time: breakfast, lunch, snack, dinner.

5. Daily calorie and nutrition control
   - Track calories, protein, fiber, water, sugar, sodium, and step burn.
   - Next-meal advice should be based on the biggest gap or excess, not generic diet text.

6. Automatic steps
   - No manual enable button in normal UI.
   - Page-open motion estimate is acceptable for MVP, with clear status text.

7. TATA growth and retention
   - Healthy patterns make TATA look better.
   - Heavy/sugary/salty patterns change TATA state.
   - Missed days can trigger lazy/decay state.
   - Growth should tie to streaks, meal logging, water, steps, and nutrition balance.

## v41 Completed

- Passwordless beta login.
- Account profile persistence API.
- Daily state persistence API.
- Meal persistence API with before/after photo fields.
- Text calorie estimates for soups, drinks, rice, bento, fried rice, and common meals.
- AI response fallback that returns usable calorie data instead of raw failure.
- Today album with date controls, meal slots, photos, calories, macros, and next advice.
- TATA visual state and growth score.
- Water tracking.
- Auto step status and page-open step estimate.
- PWA manifest and icons.
- API smoke test and UI smoke test.
- Nutrition baselines documented in `NUTRITION_GUIDELINES.md`.

## Next Milestone: v42 Trust and Meal Flow

### User-facing improvements

- Add an obvious "飯後補拍" action on saved before-meal cards in today's album. Implemented in v41.1 as a visible action for today's meals that have a before photo but no after photo.
- Add a small "估算可信度" line. Implemented in v41.2 inside the estimate result card:
  - High: AI saw food and portion clearly.
  - Medium: local rule or text-assisted estimate.
  - Low: photo was stored but estimate needs manual correction.
- Add "這餐吃完後" advice block immediately after saving a meal. Implemented in v41.3 as `這餐之後` action card:
  - next meal time window,
  - what to prioritize,
  - what to avoid.
- Make TATA's daily state message explicitly mention why it changed:
  - sugar,
  - sodium,
  - low fiber,
  - strong protein/fiber balance,
  - water gap.
  Implemented in v42 with a consistent `原因：... 建議：...` message for each TATA state.
- Add a visible TATA growth report on the home screen. Implemented in v43 as `塔塔今日成長報告`:
  - today XP,
  - what made TATA prettier,
  - what affected TATA's appearance,
  - next evolution score/day gap.
- Polish automatic step tracking in v44:
  - no normal UI enable button,
  - visible auto/waiting/offline status pill,
  - page-open motion estimate remains automatic after platform permission is available.
- Make account-scoped body data visible in v45:
  - body tab shows `帳號體態已保存`,
  - height, weight, goal, and calorie target are shown as account-bound data,
  - copy explains that same-account login reads the saved profile across browsers.
- Make calorie estimates explainable in v46:
  - result card shows `本次估算依據`,
  - explains AI/local source, detected foods, portion clues, and how to correct,
  - improves trust when AI falls back to local rules.
- Add hydration rhythm in v47:
  - nutrition panel shows `塔塔喝水節奏`,
  - suggests next 250ml/500ml based on current water gap and time of day,
  - ties hydration progress back to TATA's thirsty state.
- Improve decision support in v48:
  - `塔塔幫我選` shows a decision summary before the A/B/C cards,
  - explains kcal budget, priority gaps, and what to avoid,
  - selected option is copied into the meal text inputs for faster testing.
- Improve today's memory page in v49:
  - album shows `今日總結`,
  - summarizes meal count, photo count, calories, walking burn, remaining calories, and key risks,
  - makes the date page useful as a daily review instead of only a list.
- Make TATA growth more game-like in v50:
  - growth report shows `塔塔故事章節`,
  - each chapter has current/unlocked/locked progress from total score and streak,
  - users can see why healthier eating, hydration, photos, and steps make TATA evolve over time.
- Make next-meal decisions testable in v51:
  - today's date page shows a next-meal decision panel instead of a single generic sentence,
  - A/B/C choices are ranked from calorie budget, protein gap, fiber gap, hydration, sugar, and sodium,
  - protein target uses the higher of FDA Daily Value 50g and 0.8g/kg body-weight baseline.
- Improve calorie-estimate stability in v52:
  - final server rules override older duplicated text estimators with clean beverage/soup/meal baselines,
  - drink-like AI results above 280 kcal are guarded so a can photo does not fall back to a fixed 520 kcal meal,
  - smoke tests cover Coke can and beer/lemon detections.
- Smooth the "do not make me decide" flow in v53:
  - choosing an A/B/C TATA recommendation now leaves a visible `塔塔已選好` card in the eating assistant,
  - the chosen text is copied into the photo/text estimate inputs,
  - the user sees the next three steps: choose direction, take before-meal photo, optionally add after-meal photo.
- Improve memory recall in v54:
  - album gets a `最近回憶` strip with recent meal dates, photo counts, calories, and cover images,
  - `/api/user-meal-dates` lists account-scoped dates so memories survive across browsers,
  - tapping a recent memory card jumps to that day and loads its saved photos.
- Make TATA's body state more legible in v55:
  - the hero card shows a `塔塔外觀變化` style panel through `tataAppearancePanel`,
  - sugar, sodium, oil, calorie surplus, hydration, fiber, and balanced days each explain the visible change,
  - users can understand why eating healthier makes TATA look brighter and overeating makes TATA look heavier.
- Polish PWA identity in v56:
  - `manifest.webmanifest` now has clean Chinese name and description,
  - install metadata clearly says TATA helps with photo calories, memories, hydration, steps, and body rhythm,
  - existing TATA tomato icon assets are verified by smoke tests.
- Make automatic steps feel truly automatic in v57-v58:
  - body tab copy now says automatic sync instead of an enable flow,
  - status pill reads `自動同步` while waiting for phone motion data,
  - three chips explain that open-page walking is saved to today and does not reset body records.
  - v58 bumps the app shell cache so phones receive the latest automatic-step wording immediately.
- Add a photo-first daily decision brief in v59:
  - eating assistant now opens with `今日決策`,
  - the card summarizes meal/photo count, calorie status, biggest nutrition gap, next meal time, and the next focus,
  - CTA keeps the product promise: take a before-meal photo first, then let TATA choose directions without fixed portion shortcuts.
- Improve first-screen action hierarchy in v60:
  - `今日決策` now renders above the TATA hero so users see the next action immediately,
  - TATA story chapters remain available but are collapsed by default,
  - tests assert the decision card appears before the hero and the story section stays collapsible.
- Make TATA's three-choice decision flow more executable in v61:
  - A/B/C decision cards now show compact tags for priority, speed/stability, what to avoid, and photo correction,
  - selected recommendation card includes a direct before-meal photo CTA,
  - selected recommendation can branch into nearby restaurant search while still preserving the photo-first calorie workflow.
- Improve perceived photo-analysis speed and stability in v62:
  - photo preview appears immediately after the image is read, before the AI result returns,
  - loading states explain `照片已讀取` and `AI 辨識中`,
  - client-side AI wait is shortened so slow analysis falls back to a local editable estimate instead of making the user feel stuck.
- Make photo memories more central in v63:
  - album now includes a `照片回憶流` for the selected date,
  - before-meal and after-meal photos appear as horizontal cards with meal slot, calories, and memory badges,
  - tapping a memory card opens the existing detailed photo modal with before/after comparison when available.
- Fuse body and trend context in v64:
  - body tab now starts with a `身體節奏總覽` card,
  - the card combines BMI, today weight, walking burn, calorie balance, and 7-day weight direction,
  - TATA gives one next action from the same nutrition gaps used by the meal decision engine.
- Stabilize optional after-meal correction in v65:
  - meal records now keep their id through the album and today detail UI,
  - after-meal photos update the original meal instead of falling through as a new broken record,
  - if AI confidence is low or pending state is stale, the photo is still attached to the latest matching meal as a memory-safe correction.
- Tighten AI calorie recognition prompts in v66:
  - OpenAI and Gemini prompts now require concrete visible food names instead of generic `照片餐點` labels,
  - both prompts explicitly reject fixed 520 kcal behavior for uncertain photos,
  - drink cans, soups, and after-meal remaining-photo scenarios have stronger calorie rules and smoke coverage.
- Strengthen retention through TATA's next-day loop in v67:
  - TATA growth now includes a `明日讓塔塔靠近...` action card,
  - the card generates three next-day actions from today's protein, fiber, water, step, sugar, and sodium gaps,
  - users can see exactly what to do tomorrow to move TATA toward the next stage.
- Reduce decision fatigue in v68:
  - the eating assistant now always shows `不想決定？塔塔給三條路`,
  - users can choose `在家煮`, `外食點`, or `附近找` without typing a question first,
  - each path is generated from today's calorie and nutrition gaps, then still routes back to photo-first estimation.

### Technical improvements

- Remove duplicate legacy helper definitions in `server.js` after confirming smoke tests still pass.
- Split large inline `index.html` script into maintainable modules.
- Add a browser-driven smoke test for the actual rendered mobile page.
- Add stable sample image fixtures for before/after photo tests.

### Acceptance criteria

- A new user can register, set body data, log a before photo, close the browser, return with the same account, and still see the same body profile.
- A user can enter "冬瓜湯", "韓式泡菜湯", "可樂", "零卡可樂", "雞腿便當", "炒飯" and never get a fixed 520 kcal fallback.
- After-meal photo can be added later without deleting the before-meal photo.
- Today album shows the meal in the right slot and contains both photos after补拍.
- TATA state changes explain the reason in one short sentence.
- `scripts/otterfit-smoke-test.js` and `scripts/otterfit-ui-smoke-test.js` pass locally and against the tunnel URL.

## Later Milestones

### v43 Decision Engine

- "塔塔幫我選" becomes a richer meal decision game.
- User can ask:
  - 等等吃什麼？
  - 今天缺什麼？
  - 想喝飲料
  - 晚餐喝湯
  - 找附近餐廳
  - 找健康食譜
- Recommendations should rank by today's deficit/excess:
  - protein gap,
  - fiber gap,
  - sugar overage,
  - sodium overage,
  - remaining calories,
  - water gap.

### v44 Memory and Retention

- Calendar memory view.
- Meal photo timeline.
- Weekly "你照顧自己的證據" recap.
- TATA story chapters unlocked by consistent logging.

### v45 Real Data Platform

- Replace local JSON storage with production database/auth.
- Add image storage for meal photos.
- Add privacy/export/delete controls.
- Add real step source integration where platform policy allows it.

## Collaboration Notes

- v69 meal decision flow:
  - Three-route card now creates a saved `currentMealPlan` instead of only showing advice.
  - The selected route is passed into photo AI context as a hint while calories still depend on the actual photo and portion.
  - Saved meals keep `mealPlan` metadata so Today's diary, photo timeline, history list, and photo detail can show why this meal was chosen.
  - Completed meals clear the active plan so the next meal is not polluted by stale context.
- v70 account body profile guard:
  - Account profile now has one `getAccountProfileSnapshot()` shape with height, baseline weight, goal, target calories, onboarding state, and `profileVersion`.
  - Remote daily state can store dated weight logs but no longer overwrites the registered account baseline weight.
  - Smoke tests now assert dated daily weight does not reset account profile weight.
- v71 automatic step polish:
  - Step tracking retries automatically when the page returns from background or pageshow.
  - iOS motion permission is handled from the first normal touch without presenting a manual enable button.
  - Step copy now frames the feature as automatic recording, with saved-step fallback when the browser blocks sensors.
- v72 photo session stability:
  - Each photo capture now gets an `activePhotoSessionId` so late AI responses from the previous photo cannot overwrite the newest capture.
  - Confirming a stale photo result is blocked with a clear toast.
  - After-meal re-shoot restores the original meal plan context before opening the camera.
- v73 today photo brief:
  - Album now has a `今日照片總覽` card with before-photo, after-photo, completed comparison, pending after-photo, and calorie totals.
  - The card gives a direct action to shoot the next before photo or complete the latest pending after photo.
  - This makes the daily photo memory loop visible before users scroll into detailed meal slots.
- v74 instant photo estimate:
  - When a photo has a typed meal hint or active meal plan, the UI shows a local text-based estimate immediately while visual AI continues in the background.
  - If the user confirms before AI returns, the late AI result is cancelled so it cannot overwrite the saved meal.
  - This reduces perceived waiting time while preserving photo-first correction when AI returns in time.
- v75 water reminder:
  - Body/nutrition now shows a dedicated next-water reminder card with current intake, remaining gap, next suggested time, and one-tap logging.
  - The reminder changes by time of day so morning, lunch, afternoon, dinner, and late-night guidance feel different.
  - Smoke tests now guard the water reminder planner and renderer so the hydration loop stays visible in mobile QA.
- v76 stable calorie fallback:
  - Server-side final rules now keep drinks, soups, rice meals, bento, fried rice, noodles, and salad out of the generic 520 kcal path.
  - Text-assisted photo estimates now preserve visible food names such as cola and soup even when visual AI is slow or unavailable.
  - API smoke tests cover soup variants, drinks, fried rice, and after-photo fallback so the second-photo flow remains testable.
- v77 today meal ledger:
  - Today's album now has a `今日吃飯明細` ledger between the photo brief and recap.
  - The ledger lists meals by time with meal slot, kcal, macros, before/after photo status, and a quick after-photo action.
  - UI smoke tests guard the ledger container, renderer, row class, and meal-time formatter.
- v78 TATA level quest:
  - Home now has a `塔塔升級任務` card that turns photo logging, nutrition balance, water, and steps into visible XP sources.
  - Users can see current XP, distance to the next TATA stage, and the smallest next action that helps TATA grow.
  - This supports the core product promise: TATA is not decoration, but a long-term companion that helps users eat better and reach goals.
- v79 place memory MVP:
  - Meal confirmation now has optional restaurant/place memory fields: name, location, rating, and next-time note.
  - Place memory persists through local storage and the server meal API, then appears in today's ledger, memory cards, history rows, and photo detail modal.
  - This is the first step toward a personal food memory map similar to lightweight Google Maps reviews.
- v80 restaurant revisit list:
  - Album now has a `餐廳回訪清單` that groups saved meal place memories by restaurant/place.
  - Each place shows revisit count, average rating, average kcal, latest meal, location, and next-time note.
  - This makes place memory findable, not just attached to individual meals.
- v81 place search and filter:
  - The restaurant revisit list now includes search by restaurant, location, latest meal, or next-time note.
  - A high-rating filter lets users quickly find places worth returning to.
  - This is the next step toward a personal food review map without interrupting the photo-first meal flow.

- v82 nutrition decision engine:
  - Added a shared nutrition gap diagnosis layer for TATA coaching, next-meal advice, and decision cards.
  - Updated daily fiber targeting to support the official 14g/1000kcal framing while keeping FDA DV 28g as the floor.
  - TATA now explains what photo AI monitors: food items, portion ratio, container size, sauce/soup, drinks, and before/after leftovers.
  - Meal suggestions now come from reusable templates so recipe search, nearby restaurant search, and the three-choice game can converge on the same reasoning.

- v83 restaurant revisit actions:
  - The restaurant revisit list now gives a TATA revisit recommendation based on the place's average calories, rating, latest meal, saved notes, and today's nutrition gaps.
  - Each place has a Google Maps search action so users can find the restaurant again from their memory log.
  - A "next time order like this" action creates a meal plan, pre-fills the restaurant and meal name, and moves the user into the photo-first flow.

- v84 meal-opening memory habit:
  - Restaurant memory now has a detail panel showing meals, photos, calories, ratings, and notes for a single place.
  - The copy frames the behavior around "open OtterFit when eating" because each photo becomes a personal food memory.
  - This keeps the Google Maps-style place memory as a retention layer while the product priority shifts back to making meal logging a daily habit.

- v85 eat-before-opening habit:
  - Added a first-screen meal-opening habit card above the decision surface.
  - The card frames the daily behavior as "open OtterFit when eating" and directly routes to the before-meal camera.
  - It tracks breakfast, lunch, snack, and dinner as lightweight states so users see progress without needing to understand every feature.
  - This version prioritizes mass-use onboarding and repeated meal logging before deeper restaurant-review features.

- v86 first-meal quick start:
  - New users can choose "take the first meal first, fill body data later" from the first onboarding step.
  - The quick path stores the account profile with current defaults, marks onboarding as done, opens the main app, and routes directly to before-meal photo capture.
  - This lowers the time-to-first-photo while keeping full height, weight, and goal editing available in the body trend area.

- v87 first-meal retention hook:
  - The first saved meal now changes the post-meal card into a retention moment instead of only a nutrition summary.
  - It tells users they completed the most important behavior: opening OtterFit before eating and saving the meal.
  - It gives two clear next actions: add an after-meal photo for better accuracy, or ask TATA what to eat next.
  - The copy makes tomorrow's return lightweight: just open the app and photograph the first meal again.

- v88 shareable meal recap:
  - Added a post-meal share action so users can invite friends from the strongest emotional moment: right after logging a meal.
  - Uses native share when available and falls back to copying a text recap.
  - The share text includes meal name, calories, today's meal/photo count, TATA's next advice, and a lightweight invitation to try the same before-meal photo habit.

- v89 tomorrow first-meal promise:
  - Added an in-app promise card that lets users agree with TATA to photograph tomorrow's first meal.
  - After a meal is saved, users can set the next-day first-meal habit directly from the post-meal action area.
  - When the promise date arrives, the card changes to a due-state CTA that routes straight to the before-meal camera.
  - This is not a real push notification yet; it is a low-friction retention loop inside the app shell.

- v90 one-tap today recommendation:
  - The home decision card now shows TATA's current recommended meal direction, target calories, and meal slot.
  - Added a "照建議吃" action for users who do not want to decide; it creates a meal plan, pre-fills the food name, and sends them to the photo-first flow.
  - The copy explicitly says this is only a direction, not a fixed portion shortcut, so photo AI still calibrates calories from the actual plate.
  - This supports the mass-use loop: open the app at mealtime, accept a good-enough healthy direction, then take the before-meal photo.

- v91 weekly meal-photo streak:
  - Added a home card that turns the last seven days of meal photos into a visible habit streak.
  - The streak counts meal records only, not passive step data, so it reinforces the core behavior: open OtterFit when eating.
  - Each day opens the matching memory date, while today's primary action routes to the first meal photo or after-meal photo recovery.
  - This makes TATA's growth feel tied to real meal memories instead of abstract points.

- v92 meal-time nudge:
  - Upgraded the "eat, then open OtterFit" card with a time-aware nudge for breakfast, lunch, snack, and dinner.
  - If the current meal slot has not been logged, the card asks for a before-meal photo; if it has a pending before photo, it asks for the after-meal recovery photo.
  - When the current slot is already handled, it gently points to the next missing meal slot.
  - This reduces the "what should I do now?" moment when users open the app around mealtime.

- v93 missed-meal recovery:
  - Added a clear "剛吃完補記" path for users who forgot the before-meal photo.
  - The recovery path clears stale before-photo state, opens the after-photo camera, and explains that the meal can still be saved to today's memory.
  - This protects the main habit loop from failure: missing the ideal before-photo moment no longer means the user abandons the app for that meal.
  - Before-meal photos remain the recommended path for accuracy, while after-only photos act as a retention-friendly fallback.

- v94 photo framing coach:
  - Added a short photo coach directly under the before/after camera buttons.
  - The tips ask users to keep the full plate in frame, show soup/drink container clues, and use the same angle for after-meal photos.
  - This improves practical AI stability without slowing the photo-first flow.
  - It also explains why soup, drinks, and second photos need better visual context for calorie estimation.

- v95 shareable daily recap:
  - Added a "分享今日回憶" action to the daily recap card in the album view.
  - The share text summarizes meal count, photo count, calories, protein, fiber, meal names, and TATA's next reminder.
  - It uses native sharing when available and clipboard fallback when not.
  - This turns the daily food diary into a lightweight invitation loop instead of only a private log.

- v96 recent place quick recall:
  - Added a recent-place memory card inside the photo-first eating assistant.
  - If the user has saved restaurant/place memories, the card shows the top three places with last meal, average calories, and TATA revisit advice.
  - Tapping a place reuses the existing revisit-plan flow, pre-fills the restaurant context, and routes back to before-meal photo capture.
  - This starts bridging the future Google Maps-style memory layer into the main mealtime habit without making it mandatory.

- v97 today three-step route:
  - Added a simple home route card: take the before-meal photo, recover with after-photo or water, then review the memory or ask the next-meal coach.
  - The card changes completion state based on today's meals, after-photo state, and water progress.
  - This gives first-day testers a clear path without adding another dense dashboard.
  - It reinforces the core product loop: open at mealtime, capture the meal, then let TATA guide the next action.

- v98 home-screen install nudge:
  - Added a lightweight prompt to place OtterFit on the phone home screen.
  - The card hides when running as an installed PWA or after the user dismisses it for the day.
  - It gives iOS/Android-specific short steps and keeps the primary action on "take the first meal photo".
  - This supports retention by making mealtime opening faster than hunting for a browser link.

- v99 data health check:
  - Added a visible "資料健康檢查" card in the body tab for tester confidence.
  - It shows account profile, today's meal/photo count, water, steps, step burn, today date binding, and today's weight log.
  - It exposes one-tap refresh and sync actions so profile/daily-state issues can be verified without guessing.
  - It reinforces the data rule that account baseline body data and dated daily records are separate.

- v100 after-photo stability:
  - Preserved the server `provider` source on the client so local fallback, timeout, generic guard, and drink guard results are no longer mislabeled as confident AI vision.
  - Added after-photo context: the second photo now carries the target before-meal name and before-meal calories to the API.
  - Added a local after-photo fallback that saves the second photo and estimates remaining food conservatively when AI is slow or unstable.
  - Updated server logic so after-meal scenarios do not use first-photo text fast estimates as if they were remaining-food estimates.

- v101 today action timeline:
  - Added a "今天吃飯流程" timeline inside the album/date view.
  - It turns today's state into a clear next step: take a before-meal photo, add an after-meal photo, drink water, or ask TATA for the next meal.
  - It uses meal/photo/water/nutrition state so the album becomes a live mealtime workflow, not only a passive history list.
  - Historical dates switch to review mode with a direct action back to today.

- v102 decision radar:
  - Added a "塔塔決策雷達" surface to explain why the next meal recommendation was chosen.
  - The radar shows priority, recommended eating pattern, backup option, and what the next photo should verify.
  - TATA A/B/C choices now persist as a real meal plan (`tata_decision`) so the later photo record keeps the decision context.
  - This moves next-meal advice from generic coaching into a visible decision system.

- v103 TATA feeding feedback:
  - Added a "今天餵給塔塔的能量" card below daily missions.
  - It translates photos, after-meal correction, protein, fiber, water, steps, sugar, sodium, and calorie balance into TATA appearance feedback.
  - It shows a beauty score, photo memory count, appearance warnings, and the next smallest care action.
  - This makes TATA feel more like a living companion whose state changes with the user's food day.

- v104 place revisit insight:
  - Added a `店家回訪洞察` layer to restaurant/place memory.
  - Each remembered place now evaluates best meal memory, calorie/rating/photo context, soup/sauce/sugar/fried-food risk, and today's protein/fiber/sodium gaps.
  - The place detail panel now gives a clear `最佳回憶`, `風險提醒`, and `下次點法` so the app helps users decide how to order next time.
  - This moves place memory closer to a personal food map: not just where the user ate, but whether and how they should return.

- v105 post-meal next decision:
  - Added a post-meal decision bridge so saving a meal immediately creates the next mealtime action.
  - The card shows next meal time, recommended food direction, target kcal, what to avoid, and why the recommendation was chosen.
  - A new `post_meal_next` plan route persists the recommendation as `currentMealPlan`, pre-fills the photo flow, and keeps the next meal photo-first.
  - This strengthens the retention loop: eating and saving a meal naturally leads to the next time the user opens OtterFit.

- v106 today return mission:
  - Added a first-screen `今天回來做什麼` mission card between the three-step route and TATA.
  - It condenses meals, photos, water, steps, streak, and daily mission completion into one current best action.
  - The card adapts to states such as no first meal, pending after-photo, low water, nutrition gap, strong day, or tomorrow promise.
  - This makes the app feel like a daily ritual: open OtterFit, see exactly one next action, then continue the photo-first loop.

- v107 TATA status sharing:
  - Added a first-screen `塔塔今日狀態卡` below the TATA feeding feedback.
  - It turns the user's day into a shareable TATA state: meals, photos, total calories, beauty score, streak, and next action.
  - Sharing uses the native Web Share API with clipboard fallback, matching the existing meal and daily recap share flows.
  - This supports lightweight growth: the product can be shared as a warm daily companion, not only as a calorie tracker.

- v108 place memory health:
  - Added `店家記憶健康度` to the album view.
  - The card scores saved restaurants by address, rating, next-time note, photo evidence, and repeat visits.
  - Revisit list items now show a memory completeness tag so users know which places are reliable enough to revisit.
  - This prepares the later Google Maps-like layer while keeping the main photo-first eating flow lightweight.

- v109 incomplete place filter:
  - Added a `待補資料` filter to the restaurant revisit list.
  - The place memory health card now routes users directly to places that still need address, rating, notes, photos, or repeat-visit evidence.
  - High-rating and incomplete filters are mutually exclusive so testers can understand why the list changes.
  - This makes the personal food map more actionable without making place data mandatory during meal capture.

- v110 place detail completion checklist:
  - Added a `補齊這家店的記憶` checklist inside each place detail panel.
  - The checklist shows whether location, rating, next-time note, photos, and repeat-visit evidence are complete.
  - It gives two direct actions: take a before-meal photo next time, or create a revisit meal plan.
  - This closes the loop from "find incomplete places" to "know exactly how to improve this place memory."

- v111 recent place completion hint:
  - Added memory completeness hints directly inside the photo tab's recent-place card.
  - Each recent place now shows its memory score and the next small field to complete.
  - Selecting a recent place also reminds the user what to fill this time.
  - This brings the personal food map work back into the main mealtime flow instead of hiding it only in the album.

- v112 meal countdown decision card:
  - Added a first-screen `開飯倒數` card that reads the next meal window and today nutrition gaps.
  - The card changes behavior for current mealtime, near mealtime, and early planning moments.
  - It keeps the product promise clear: suggestions are only a direction; calories are corrected by before-meal photos, portions, containers, soup, and sauces.
  - This makes the app feel useful before the user opens the camera, especially for people who do not want to decide what to eat.

- v113 daily life check-in layer:
  - Reframed the first screen around daily check-ins: meal photo, water, weight, sleep/bowel, and "what should I eat?"
  - Added separate before/after camera and album inputs so LINE or mobile browsers can upload existing photos as well as open the camera.
  - Added direct height and daily-weight inputs so testers and daily users do not need to tap plus/minus repeatedly.
  - Added lightweight sleep, bowel, and energy logging to daily state, keeping TATA, trends, body data, album, and past memories as the second layer.
  - Added quick correction chips for drink and soup misreads so a cola can photo can be corrected without hand-entering calories.

- v114 daily completion dashboard:
  - Turned the first-layer daily check-in card into a live completion dashboard.
  - It now summarizes meal photos, water, today's weight, and sleep/bowel/energy status at a glance.
  - The card chooses the next best action in order: first meal photo, after-photo recovery, water, daily weight, life state, or meal advice.
  - This supports the "daily check-in" habit loop while keeping TATA, trends, albums, and historical insights as the second layer.

- v115 daily check-in score:
  - Added a gentle `今日打卡` score and progress bar to the first-layer daily card.
  - The score counts the four daily life anchors: meal, water, weight, and sleep/bowel/energy.
  - This gives immediate feedback without turning the app into a strict health dashboard.
  - The intent is retention: users can open the app, do one small action, and feel the day becoming more complete.

- v116 life-state meal advice:
  - Connected sleep, bowel, and energy logs back into TATA's meal advice.
  - Low sleep and tiredness now nudge users away from sweet drinks and toward water, protein, and steady meals.
  - Bowel states now influence fiber, water, bland-food, and low-oil suggestions.
  - This makes "eat/drink/poop/sleep" logs feel useful instead of becoming passive form fields.

- v117 life-state memory card:
  - Added a `生活狀態回憶` card to the date-based album/day view.
  - The daily dashboard now shows sleep, bowel, and energy next to calories, photos, sugar, sodium, and step burn.
  - Saving sleep/bowel/energy immediately refreshes the first-layer daily score and the second-layer memory page.
  - This turns daily check-ins into a retrievable life diary instead of one-time form inputs.

- v118 post-photo memory focus:
  - Added `goToTodayMealMemory()` so every saved before-meal, after-meal, or fallback photo returns to today's meal detail page.
  - The just-saved meal row is highlighted with a `剛剛更新` tag so testers can verify where the photo landed.
  - Meal rows now distinguish pending after-photo, completed before/after comparison, and after-photo saved states more clearly.
  - This improves the core habit loop: take a meal photo, see it saved in today's memory, then know whether after-photo is optional or complete.

- v119 stable meal-decision coach:
  - Added a visible `coachAnswerStatus` card so "不知道吃什麼" always produces immediate feedback.
  - `askTataCoach()` now labels the answer mode as decision, recipe, nearby, or nutrition analysis before rendering content.
  - Decision questions refresh both the A/B/C cards and the three-path decision card, then scroll to the actionable result.
  - This makes the daily "what should I eat?" entry feel reliable even before the user has a meal photo.

- v120 lightweight place memory after saving:
  - Added a `補店名/評分` action to each meal row in today's meal detail ledger.
  - Users can add restaurant name, rating, and next-time notes after the meal photo is already saved.
  - Place edits refresh today's memory, place-memory health, and the revisit list immediately.
  - This keeps mealtime photo capture lightweight while still growing the later personal food-map layer.

- v121 inline place-memory editor:
  - Replaced the quick place-memory prompt flow with an in-page `placeQuickEditPanel`.
  - The panel lets users edit restaurant name, rating, branch/location hint, and next-time note without leaving the app surface.
  - The editor opens from the meal ledger, scrolls into view, saves back to today's meal, then refocuses the updated row.
  - This makes the restaurant-memory layer feel intentional and mobile-friendly instead of a browser prompt workaround.

- v122 historical place-memory editing:
  - Added `goToMealMemoryDate()` so memory edits can return to the original date instead of forcing today.
  - The meal ledger now receives the selected memory date and shows the place-memory edit action for historical meals too.
  - Users can improve old meal photos with restaurant name, rating, branch hint, and next-time notes after the fact.
  - This makes the album a living food-memory system, not only today's log.

- v123 meal-row map return:
  - Added `openMealPlaceMap()` so any meal with place memory can open Google Maps directly from the meal ledger.
  - Meal rows now show `開地圖` next to the place-memory editor once a restaurant or location exists.
  - If a user taps map before adding a place, TATA opens the inline place-memory editor instead.
  - This closes the loop from meal photo memory to "I can find this restaurant again."

- v124 meal-row revisit plan:
  - Added `selectMealRevisitPlan()` so an old meal row can become the next meal plan directly.
  - Meal rows with place memory now show `照這餐再吃` beside the map and edit actions.
  - The revisit plan pre-fills the food name, place name, place address, target kcal, and source memory date.
  - This connects memory to action: find the place, repeat a good meal, then photo-check the new portion.

- v125 next-meal resume card:
  - Added a first-screen `mealPlanResumeCard` so saved `currentMealPlan` state is visible when the user reopens the app.
  - The daily core "next step" now prioritizes active meal plans after after-photo recovery, routing users back to the photo-first flow.
  - `resumeCurrentMealPlan()` restores the selected food, place memory, and target kcal in the photo tab before opening the next meal workflow.
  - This closes the everyday loop from "ask TATA what to eat" to "open OtterFit again and photograph the actual meal."

- v126 today memory preview:
  - Added a first-screen `todayMemoryPreviewCard` with today's date, meal count, photo count, calories, water, weight, and latest meal.
  - The primary action changes from "take the first meal photo" to "view today's details" after the first meal exists.
  - `openTodayMemory()` jumps directly to today's album timeline, meal ledger, and calorie detail without making users understand the second-layer navigation first.
  - This makes the daily habit feel like a check-in: open OtterFit, see today's life/food state, then photograph, ask TATA, or review the day.

- v127 bottom photo source sheet:
  - Replaced the center bottom `開飯拍` direct camera label with a source chooser.
  - The sheet offers before-meal camera, before-meal album, after-meal camera, and after-meal album from the same high-frequency entry point.
  - The old `bottomPhotoInput` was later removed in v186 because hidden file inputs can accidentally cover the whole bottom nav on some cached/mobile states.
  - This makes mobile/LINE testing smoother and supports the real habit: people can photograph now or upload the meal photo they already took.

- v128 account baseline weight separation:
  - Added `accountWeightKg` so the registered baseline body weight is kept separate from dated daily weight logs.
  - `getAccountProfileSnapshot()` now saves the account baseline weight instead of whatever the user typed as today's weight.
  - Daily weight quick buttons and direct input now sync only today's daily state, not the remote user profile.
  - Profile copy explicitly tells testers that registered body data follows the account, while today's weight is date-bound.

- v129 photo analysis retry recovery:
  - Added `retryCurrentPhotoAnalysis()` so low-confidence or fallback photo results can rerun AI analysis without asking the user to pick the photo again.
  - Low-trust estimate cards now show `重新辨識照片` and `用餐名重估` actions directly inside the explanation area.
  - Retry keeps the current before/after phase, existing photo, typed meal hint, and meal plan context, then falls back safely if AI is still unavailable.
  - This improves the core camera habit when the first or second photo analysis is unstable: the photo stays on screen and the user has a clear recovery path.

- v130 first-layer TATA snapshot:
  - Added a first-screen `tataHomeSnapshotCard` between today's memory preview and the eating habit card.
  - The card explains TATA's current stage, beauty score, photo memories, water gap, and appearance warnings from today's eating, drinking, walking, and nutrition state.
  - The primary action follows the same smallest-next-step logic as the feeding feedback: take the first meal photo, add water, ask TATA for the next meal, or continue photographing.
  - This moves TATA from a second-layer mascot into the everyday check-in loop: open OtterFit, understand how TATA changed today, then do one useful action.

- v131 first-layer decision and photo-source reliability:
  - Added `openMealDecisionCoach()` so "不知道吃什麼" immediately switches to the eating assistant, shows a visible answer status, renders A/B/C choices, and scrolls to the result.
  - Updated the first-layer photo CTAs to open the photo source sheet instead of forcing camera-only capture.
  - The main daily buttons, meal-opening card, today decision card, today memory preview, and selected recommendation CTA now support both live camera and album selection.
  - This makes the everyday loop easier to test on mobile/LINE: ask what to eat, pick a direction, then photograph or upload the actual meal.

- v132 first-layer daily weight logging:
  - Added `todayWeightQuickCard` to the home screen so daily users can enter today's weight without digging into the body tab.
  - `recordTodayWeight()` now centralizes daily weight writes for both the home card and body tab direct input.
  - The copy explicitly says today's weight is a dated log and will not overwrite the registered baseline body profile.
  - This supports the daily check-in loop: eat, drink, weight, ask what to eat, then let TATA and trends use the data later.

- v133 first-layer life check-in:
  - Added `todayLifeQuickCard` to the home screen for sleep hours, bowel state, and energy state.
  - `recordLifeLog()` centralizes the life-state write path so the home card and body tab stay consistent.
  - The daily core "sleep/bowel" action now focuses the home card instead of forcing users into the body tab.
  - TATA can use these first-layer life signals for next-meal advice while the album/trend pages keep them as richer memory context.

- v134 first-layer water check-in:
  - Added `todayWaterQuickCard` to the home screen so hydration is visible next to meals, weight, and life state.
  - The card shows current water, target, remaining gap, progress, and the next suggested amount from `getWaterReminderPlan()`.
  - The daily core water action now focuses the home water card instead of only adding 250ml silently.
  - This completes the first-layer daily loop more cleanly: eat, drink, weight, sleep/bowel/energy, and ask TATA what to eat.

- v135 post-meal place-memory nudge:
  - Added `renderPostMealPlaceNudge()` to the meal completion card.
  - If the saved meal has no place, the card offers a lightweight "補店名/評分" action and explains that it is optional.
  - If the meal already has a place, the card gives "開地圖", "照這餐再吃", and note-edit actions.
  - `promptPlaceMemoryAfterSave()` opens the inline place editor after saving a meal without blocking the photo-first logging loop.
  - This plants the later Google Maps-like memory layer while keeping the mass-use behavior centered on taking meal photos.

- v136 photo draft recovery:
  - Added an account/date-scoped `activePhotoDraft` so a just-read before/after photo is saved before AI returns.
  - AI success, local fallback, instant estimate, retry, and restored-photo states all refresh the same draft.
  - If mobile/LINE browsing interrupts the second photo, the daily alert can restore the photo and rerun analysis without forcing a re-shoot.
  - Successfully saved meals clear the draft, so completed photos do not reappear as unfinished work.

- v137 daily action hub:
  - Replaced the static first-screen action buttons with `dailyCoreActionHub`.
  - The hub now shows the true daily first-layer actions: meal photo, water, today weight, sleep/bowel, ask TATA what to eat, and today's memory.
  - Button labels and meta copy change with today's state, including pending after-photo, meal count, water amount, saved weight, and life-log completion.
  - Added `focusTodayWeightQuick()` so daily weight entry stays on the home quick card instead of forcing users into the body/trend layer.

- v138 decision detail cards:
  - Added `getDecisionOptionDetail()` and `renderDecisionOptionDetails()` to every TATA A/B/C meal decision card.
  - Each option now explains today's reason, what the photo should verify, and the immediate next step.
  - Selected TATA decisions persist `decisionDetail` into the meal plan, so later meal records can remember why the app suggested that direction.
  - This makes the "I do not want to decide what to eat" loop more trustworthy and more executable before the user takes the meal photo.

- v139 decision memory persistence:
  - Added `getMealDecisionMemory()` so today's ledger, history rows, and the photo detail modal can show why TATA suggested a meal.
  - Today's meal ledger now shows `塔塔決策` alongside nutrition and place memory.
  - History and photo detail surfaces show the original decision reason and what the photo was meant to verify.
  - Server meal normalization now preserves `mealPlan` and nested `decisionDetail`, so this context survives account-based cross-browser testing.

- v140 decision memory API guard:
  - Expanded `scripts/otterfit-smoke-test.js` with an actual `/api/user-meals` save/read round trip containing `mealPlan.decisionDetail`.
  - The test now proves route, route label, food name, target kcal, reason, photo-check target, and next step survive server normalization.
  - This turns decision memory from a UI-only promise into a verified account-level persistence requirement.

- v141 meal flow clarity and AI trust guard:
  - Added a fixed `mealFlowCard` at the top of the meal-photo screen so users always see the sequence: before photo, eat, after photo, save memory.
  - When a before photo has been saved, the primary CTA becomes "吃完了，補飯後照" and routes back to the latest meal needing an after photo.
  - Added estimate stability memory and warnings when repeated same-period estimates differ too much or an after photo looks like it was counted as a full meal.
  - Reworded web step tracking to be honest: the web app estimates steps while open; full lock-screen/background health sync belongs to the native HealthKit/Google Fit phase.

- v142 contextual bottom photo action:
  - The fixed bottom camera button now reads the same meal-flow state as `mealFlowCard`.
  - It changes from "開飯拍" to "飯後補拍", "儲存餐前", "儲存飯後", "恢復照片", or "拍這餐" depending on the user's current meal state.
  - This keeps the most-thumbed mobile CTA aligned with the correct next action, reducing the chance that users lose the after-meal correction path.

- v143 contextual photo-source sheet:
  - The camera/source sheet now has dynamic title and body copy for before-photo versus after-photo states.
  - After-photo mode highlights after-photo options and explains that the image will be attached back to the same meal instead of becoming a new meal.
  - Before-photo mode uses active meal-plan context when TATA has already suggested what to eat, reinforcing the photo-first calorie correction promise.

- v144 after-photo source priority:
  - After-photo mode now moves "飯後拍照" and "飯後相簿" to the first row of the source sheet instead of only highlighting them.
  - Before-photo options move lower only while the user is correcting an existing meal, reducing the second-photo mis-tap that created unstable duplicate estimates.
  - This keeps the before/after calorie correction loop visually obvious on mobile: first photo starts the meal, second photo saves back into the same memory.

- v145 client visual estimate guard:
  - Added a client-side guard before photo results render so drink cans, cola, beer, lemon slices, and generic image names cannot be displayed as a fixed 520 kcal meal.
  - The app now corrects suspicious drink-like AI results to drink-specific calories even if the external vision provider returns a high generic meal estimate.
  - Generic "photo meal estimate" results at exactly 520 kcal are downgraded to a lower-confidence conservative estimate and explicitly ask for meal-name correction.

- v146 focused daily table:
  - Added a first-layer "TODAY TABLE" card directly under the daily check-in card.
  - The card turns the messy daily surface into one current state: before photo, save before, after photo, save memory, or next meal.
  - It keeps the after-photo correction path explicit with copy that the after photo goes back into the same meal instead of creating a duplicate record.

- v147 course / group meal mode:
  - Researched the older Toma/self-discipline tomato prototype and brought forward its strongest meal-specific idea: course-by-course logging.
  - Added a lightweight first-layer course mode for hotpot, set meals, omakase, and group dining so users do not have to force a whole table into one generic estimate.

- v148 nutrition-aware tomorrow promise:
  - Upgraded "tomorrow first meal" from a generic reminder into a saved nutrition mission.
  - The promise now carries the top TATA growth task, such as protein, fiber, water, lower sugar, lower sodium, or walking.
  - Post-meal copy now explains the recommended next-day task so the user knows why to return before the first meal.

- v149 clearer after-photo recovery:
  - Added a first-layer "pending after-photo" alert to the Today Table when any meal has a before photo but no after photo.
  - Added per-meal "補這餐飯後照" actions in today's meal ledger so users can attach the after photo to the exact meal instead of starting a new record.
  - Reinforced copy that after photos are attached back to the same meal and will not create messy duplicate records.

- v150 personal place guide:
  - Turned restaurant memory into a more decision-oriented personal guide, closer to a private Google Map layer.
  - Each remembered place can now show when to go, how to order next time, and what to avoid based on average calories, ratings, meal history, and today's nutrition gaps.
  - Added direct "建立回訪點餐" and map actions inside the guide so place memory can become the next meal plan.

- v151 smarter streak loop:
  - Fixed the meal streak card so it only asks for an after-meal photo when a meal actually needs one.
  - If today's meals are already complete, the primary action becomes next-meal advice instead of a dead-end after-photo CTA.
  - Added a visible habit milestone line showing how many days remain until the next 3/7/14-day streak milestone.

- v152 synchronized meal-open action:
  - The first-screen "吃飯就打開" card now prioritizes any pending after-meal photo across the whole day, not only the current meal slot.
  - The card title, nudge, slot states, and primary CTA now point to the same next action so users do not get mixed signals.
  - Pending meals show as "待補" in the slot strip and route directly back to the exact meal's after-photo flow.

- v153 post-save follow-up in today's ledger:
  - Added a `剛剛這餐已存好` follow-up card inside the today memory page after a meal is saved.
  - The card uses the focused meal id to offer the correct next step: attach an after-photo to the same meal, ask TATA what to eat next, or set tomorrow's first-meal promise.
  - This makes the post-photo landing feel complete instead of dropping users into a ledger without guidance.

- v154 post-save calorie budget:
  - Added a three-number budget strip to the `剛剛這餐已存好` card: today's remaining/over calories, calories already eaten, and next-meal budget.
  - The follow-up copy now explains whether the user still has room today or has exceeded target, then suggests the next meal budget.
  - This keeps the first-layer daily eating loop focused on calorie control immediately after saving a meal.

- v155 first-layer daily routine strip:
  - Reframed the home daily core headline around `吃喝拉撒睡` instead of a generic dashboard.
  - Added a `今天五件事` routine strip for eating, water, daily weight, bowel/sleep/life state, and next-meal decision.
  - This makes the first screen match the real daily use case: open OtterFit, do one small life action, then let deeper memories, TATA growth, body data, and trends build underneath.

- v156 decision-to-photo bridge:
  - Added a `塔塔先排這餐` bridge above TATA's decision cards and inside the next-meal decision panel.
  - The bridge shows the recommended food direction, target kcal, priority gap, meal window, and the avoid note.
  - Its primary action selects the safest recommendation and routes the user into the before-meal photo flow, keeping calorie estimation photo-first instead of fixed-portion quick picks.

- v157 post-save place memory bridge:
  - Added a place-memory block inside the `剛剛這餐已存好` follow-up card.
  - If the saved meal has no place yet, the card offers `順手補店名，下次找得到` and opens the inline place editor.
  - If the saved meal already has a place, the card offers map revisit and `照這餐再吃`, turning the photo log into a lightweight personal food map without making place data mandatory.

- v158 TATA care pulse:
  - Added a first-layer `TATA CARE` card directly under the TATA home snapshot.
  - The card turns TATA's current appearance warning or stable state into one concrete care task.
  - It reuses today's return mission and feeding feedback so TATA's companionship points to the same next action as the daily habit loop.

- v159 first-screen daily mainline:
  - Added a `今日主線` block inside the top Daily Core card.
  - The block reuses `getTodayReturnMission()` so the first screen and the later return-mission card always point to the same next action.
  - This makes the first app-open moment clearer: users see the one thing to do now before scanning all other daily tools.
- v160 same-meal after-photo lock:
  - Added a first-layer `daily-core-after-lock` prompt when a meal has a before photo but no after photo.
  - The prompt shows the exact meal slot/name/kcal and routes `補飯後` through `startAfterPhotoForMeal(index, event)` so it returns to the original meal instead of creating a new record.
  - This directly supports the core eating loop: before photo, eat, after photo, same-meal calorie correction, then next-meal advice.
- v161 visible decision coach:
  - Updated `askTataCoach()` so every direct decision entry first opens the photo/coach tab.
  - Preset questions now write into `tataCoachInput`, making the answer area feel connected to the button the user tapped.
  - This fixes home/diary/body buttons that asked TATA but could leave the user on a page where the decision cards were hidden.
- v162 place memory deep search:
  - Expanded restaurant revisit search from name/address/last meal to full historical meal memory.
  - Users can now search by saved meal names, meal slot, date, notes, kcal, protein, fiber, sugar, or sodium clues.
  - Matching results show a `搜尋命中` line so the user knows which previous meal made the restaurant appear.
- v163 TATA appearance forecast:
  - Added a first-layer `塔塔外觀預報` inside the TATA TODAY card.
  - The forecast explains current appearance, the nutrition/lifestyle reason, and one concrete `救回漂亮` action.
  - This makes the pet loop clearer: eating well makes TATA prettier, while sugar/sodium/calorie/water/protein/fiber issues change TATA visibly.
- v164 10-second meal launchpad:
  - Added a visible `10 秒開飯入口` inside the first-screen meal opening card.
  - The launchpad separates `飯前拍`, `選照片`, and `不知道吃什麼` so new users do not have to understand the full photo source sheet first.
  - Pending after-photo meals reuse the same launchpad as `補飯後`, keeping the before/after calorie correction flow on the first screen.
- v165 onboarding direct body input:
  - Added direct height and weight inputs in onboarding step 2, with Enter and apply buttons for faster testing.
  - The direct inputs sync with sliders and immediately recalculate BMI and calorie target.
  - Expanded slider ranges to match the direct fields so exact user body data is not silently reset.
- v166 before/after photo stability:
  - Fixed the after-photo merge path so the original `photoBefore` is preserved when the saved meal stores its before image there instead of `photo`.
  - Added smoke coverage for the same-meal before/after join so the second photo cannot silently wipe the first photo.
  - This makes the core meal memory loop more reliable: first photo estimates, second photo corrects or safely saves back to the same record.
- v167 first-layer daily focus:
  - Tightened the home daily core into five states: eating, water, daily weight, life log, and asking what to eat next.
  - Kept the action hub to six everyday actions: photo meal, water, weight, sleep/bowel, ask food, and view today.
  - Moved non-everyday behavior like course mode out of the daily action hub so the first screen feels like a fast daily check-in.
- v168 low-friction place memory:
  - Added one-tap post-meal quick ratings: `想再去`, `普通`, and `不再去`.
  - Fixed place-memory patch updates so adding only a rating or note no longer clears an existing store name/address.
  - This keeps the Google-Maps-like second layer lightweight while the first-layer meal photo habit stays fast.
- v169 tomorrow first-meal promise payoff:
  - Added `completeTomorrowMealPromiseIfDue()` so the first meal on the promised day marks yesterday's promise as completed.
  - Persisted `lastPromiseWin` so the home card can say the promised first meal was actually completed instead of silently disappearing.
  - This makes TATA feel more like a companion who remembers and rewards the user's return habit.
  - Pending after-photo states reuse the same launchpad but point the primary action back to the original meal.
- v170 repeated photo estimate stability:
  - Added a same-window estimate consistency guard so repeated photos of the same meal do not swing wildly between two calorie values.
  - If the second result looks generic or overlaps the previous food but differs too much, OtterFit keeps the previous estimate, marks the result low confidence, and explains what TATA saw.
  - This directly improves the before/after and repeated-photo testing flow while AI provider quality is still variable.
- v171 same-day after-photo flow:
  - After-photo actions now resolve against today's meal records first, so a previously viewed history date cannot steal the "補飯後照" target.
  - Starting an after-photo correction opens the photo source sheet, letting users either take a new photo or select one from the album.
  - Today's meal ledger now has first-layer quick actions for after-photo correction, the next meal photo, asking what to eat, and water logging.
- v172 no-decision meal coach:
  - The "不知道吃什麼" / "問吃什麼" path now renders one stable decision result instead of immediately re-running itself and causing a visual jump.
  - Added a one-tap "塔塔直接幫我選" action that selects the top recommendation and opens the before-photo source sheet.
  - This supports users who do not want to decide: TATA chooses the direction, then photo estimation still handles the real portion.
- v173 daily open value:
  - The return mission card now explains why opening OtterFit today matters: photo memories, calorie control, TATA growth, and place memory.
  - The value copy changes with today's actual meals, photos, and place clues instead of being generic marketing text.
  - This reinforces the core habit: open the app when eating because each meal becomes useful memory, not just a calorie number.
- v174 cross-date meal memory search:
  - Added "查找吃過什麼" inside the album so users can search prior meals by food name, restaurant, date, meal slot, note, or plan context.
  - Search results jump directly back to the matching date and meal row, making old photos and calories usable instead of buried by date navigation.
  - This starts the broader personal food-memory layer while keeping the first-layer daily photo habit intact.
- v175 per-meal AI nutritionist and tester accounts:
  - After saving a meal, the follow-up card now shows TATA's nutritionist advice with meal score, strengths, gaps, and next-meal guidance.
  - The post-save card can turn that advice into a next-meal plan so the user returns to the photo-first flow.
  - Added numbered tester accounts `001` through `010` so mobile QA can test onboarding, body profile persistence, and meal history independently.
- v176 place memory passport:
  - Added a `個人飲食地圖護照` card above the restaurant memory tools.
  - The card summarizes remembered places, meal photos, revisit-ready places, and overall memory completeness.
  - It highlights the next useful restaurant memory and gives direct actions for high-trust revisits or incomplete place data, moving TATA closer to a private food-memory map.
- v176.1 bottom navigation tap fix:
  - Hid the bottom-nav file input so its absolute positioning no longer covers the whole mobile bottom bar.
  - Bottom buttons now keep their own actions: eating opens the meal assistant, body opens body trends, album opens memories, and trend scrolls to the trend section.
  - Smoke tests guard the CSS rule so future photo-input changes do not turn every bottom tap into camera launch again.
- v177 private place category filters:
  - Added personal restaurant category chips for `減脂友善`, `高蛋白`, `親子友善`, and `控糖友善`.
  - Categories are inferred from the user's saved place memories, meal names, notes, calories, protein, fiber, sugar, sodium, rating, and revisit count.
  - Place search now includes these inferred category labels, moving the restaurant memory layer closer to a private nutrition-aware Google Maps while keeping meal logging photo-first.
- v178 proactive TATA coach:
  - Added a first-layer `TATA COACH` card that proactively surfaces the top 1-3 issues from today's meal memory.
  - Alerts cover missing first photo, pending after-photo correction, protein/fiber/water gaps, sugar/sodium/calorie overages, and repeated outside eating.
  - Each alert has a direct next action, so TATA starts behaving like a coach who notices problems instead of only answering when asked.
- v179 10-second photo estimate progress:
  - Added a `mealSpeedPromiseCard` directly under the meal flow card so photo capture has a visible status from photo read to estimate to advice to save.
  - Loading, AI success, and local fallback states now all refresh the same progress card, making it clear when the user can safely store the meal.
  - This supports the MVP promise: take a meal photo, get a usable estimate quickly, then save the meal memory without wondering whether the app is stuck.
- v180 auto-saved meal analysis draft:
  - Upgraded `activePhotoDraft` into a complete auto-saved meal snapshot with food name, macros, confidence, notes, items, meal plan context, and photo linkage.
  - AI success, local fallback, quick corrections, and portion changes now refresh the auto-saved draft before the user formally records the meal.
  - Restoring an interrupted photo can now recover the analyzed meal instead of falling back to a generic pending-photo state, moving the MVP closer to "photo, advice, saved" within one short flow.
- v181 immediate nutritionist advice:
  - Added an `immediateNutritionCoachCard` inside the estimate result so every usable photo or text estimate can show a TATA nutritionist readout before the user formally saves.
  - The card projects today's budget after this meal and shows meal score, strengths, gaps, goal-aware coaching, and the next-meal recommendation.
  - This moves the MVP from "photo -> numbers" toward "photo -> professional advice -> saved memory" in the same 10-second decision surface.
- v182 visible food recognition summary:
  - Added a `foodRecognitionSummaryCard` to the estimate result so AI/local recognition shows food name, portion, and main ingredients as first-class outputs.
  - The summary is refreshed with every estimate, correction, and portion change, and it clears during a new photo loading state so stale recognition cannot remain on screen.
  - This makes the MVP food-recognition requirement visible to users instead of burying it in item rows or estimate explanation copy.
- v183 complete MVP health goals:
  - Expanded onboarding and profile persistence from three goals to the MVP set: fat loss, muscle gain, body maintenance, healthy eating, and healthy weight gain.
  - Calorie target calculation now adjusts differently for fat loss, muscle gain, maintenance, healthy eating, and gain goals.
  - Immediate and post-save nutritionist advice now has goal-specific branches for maintenance and healthy eating instead of routing every non-gain/non-fitness user into fat-loss copy.
- v184 three-meal rhythm habit card:
  - Added a first-layer `dailyThreeMealRhythmCard` focused on breakfast, lunch, and dinner photo completion.
  - The card shows 0/3 through 3/3 progress, marks each meal slot as photographed/recorded/pending, and routes the primary action to the next missing meal photo.
  - This turns the North Star behavior into a visible daily loop: users should open TATA at each meal, not only when they remember to log calories.
- v185 automatic meal location snapshot:
  - Added a non-blocking `captureMealLocationSnapshot()` during photo capture so meal drafts can remember browser geolocation when permission is available.
  - Auto-saved meal snapshots and formally saved meals now preserve location latitude, longitude, accuracy, captured time, and source without overwriting manually entered restaurant names.
  - Server meal normalization now persists those location fields, moving place memory closer to automatic restaurant history instead of only optional manual entry.
- v186 bottom navigation photo overlay fix:
  - Removed the hidden `bottomPhotoInput` from the fixed bottom nav so the file input cannot accidentally cover every bottom button.
  - The center bottom photo button now only opens the photo source sheet; the actual camera/album inputs live inside the meal photo controls.
  - Expanded the bottom navigation hit test to click each button and verify that only "開飯拍" opens the photo sheet, while eating/body/album/trend switch to their own destinations.
- v187 personal diet memory profile:
  - Added a `personalDietMemoryCard` to the memory album so TATA summarizes the user's recent eating identity, not just individual logs.
  - The profile scans recent meal memory for frequently eaten foods, remembered restaurants/locations, repeated nutrition issues, and the next small improvement.
  - Recurring issue detection now flags low protein, low fiber, high sugar, high sodium/sauce/soup, calorie-heavy meals, and fried/high-fat patterns.
  - This moves the product toward the second-stage promise: TATA remembers what the user likes and which habits need coaching over time.
- v188 memory-driven proactive coach:
  - Connected the personal diet memory profile to the first-layer `TATA COACH` card so proactive coaching can use recent habits, not only today's totals.
  - The coach can now surface "最近記憶" repeated issues, "常吃模式" frequent foods, and recent outside-eating memory when those patterns matter for the next meal.
  - This advances the third-stage promise: TATA starts reminding users before they ask, based on their personal history.
- v189 natural place memory search:
  - Added `parsePlaceSearchIntent()` and `doesPlaceMatchSearchIntent()` so the restaurant memory list can understand natural searches such as "去年壽司", "台中牛排", "親子友善", "高蛋白", and "控糖".
  - Search can now combine year, city, food keywords, and personal diet categories instead of only doing raw text matching.
  - The place memory search input now previews the long-term Google Maps-like direction directly in the placeholder.
- v190 place nutrition dataset cards:
  - Added `getPlaceNutritionDataset()` and `renderPlaceNutritionDataset()` so restaurant search results show average kcal, protein, fiber, sugar, and sodium from the user's own logged meals.
  - Dataset cells highlight risky patterns such as high sodium, high sugar, low fiber, low protein, or calorie-heavy places.
  - This makes the private food map more data-backed: users can compare restaurants using real nutrition history, not only notes and ratings.
- v191 goal-fit restaurant scoring:
  - Added `getPlaceGoalFitScore()` and `renderPlaceGoalFit()` so each remembered restaurant can be scored against the user's current goal.
  - The same place is interpreted differently for fat loss, muscle gain, maintenance, healthy eating, and healthy weight gain.
  - Search results now explain why a restaurant is "很適合", "可安排", "要會點", or "先慎選", plus the next ordering move.

- v192 goal-fit restaurant filtering:
  - Added a `目標適合` filter to the restaurant revisit list so users can narrow remembered places to restaurants scoring at least 68/100 for their current health goal.
  - When enabled, matching places are sorted by goal-fit score first, then rating, making the private food map more useful for deciding where to eat next.
  - The filter works alongside natural searches such as high protein, sugar control, city, food, or date, while staying easy to use on mobile.

- v193 estimate calibration coach:
  - Added an `estimateCalibrationCard` between the estimate explanation and recognition summary so photo results explain whether they are ready to save or should be corrected first.
  - `getEstimateCalibrationCoach()` checks confidence, source, named foods, portion clues, soup/drink cues, after-photo state, and high-calorie meals to decide the most important missing detail.
  - This makes photo calorie results feel less like raw numbers and more like a nutritionist saying what to trust, what to confirm, and what to do before saving.
- v194 projected next-meal planning:
  - Added `getNutritionStatusForMeals()` so next-meal advice can be calculated from any meal set, including the current unsaved photo estimate.
  - The immediate nutritionist card now projects calories, protein, fiber, sugar, and sodium after the visible estimate before recommending the next meal.
  - The "用這份建議排下一餐" action now creates a `current_estimate_next` plan, preventing the app from ignoring the meal the user just photographed.
- v195 estimate save status:
  - Added an `estimateSaveStatusCard` above the formal record button so users can tell whether a photo result is only a recoverable draft or has been formally entered.
  - The card shows a three-step state: photo kept, analysis saved, and final account entry still requiring the bottom button.
  - Auto-saved draft refreshes now update the save-status card immediately, reducing the chance that users assume a calorie estimate already became a meal record.
- v196 reliable album picker entry:
  - Centralized photo source mapping with `getPhotoInputIdForMode()` so every camera and album button targets the correct file input.
  - Album launches now record `lastPhotoPickerRequest`, clear stale file values, and show a highlighted fallback button if the mobile browser does not open the picker.
  - This prioritizes functional reliability over adding more surface area: meal-photo and album import buttons must actually work before the interface is simplified further.
- v197 simplified estimate result:
  - The meal estimate result now keeps the first layer focused on photo, food name, calories/macros, TATA nutritionist advice, draft/save status, and the formal record button.
  - Technical trust details, recognition explanation, item rows, portion adjustment, manual correction, and optional restaurant memory are still available but collapsed under `進階細節與修正`.
  - This responds to tester feedback that the interface felt too complex while preserving the functions needed for accurate correction.

- v198 photo-response reliability:
  - Photo and album selection now immediately shows a visible `照片已收到` state before image compression or AI analysis, so mobile users can tell the tap worked.
  - If AI visual recognition is slow, the app now promotes a local quick fallback estimate after a few seconds and keeps the selected photo, nutrition coach card, and draft/save status visible.
  - Added a Playwright photo-response smoke test that blocks the AI endpoint and confirms album import still produces a visible calorie result instead of feeling frozen.
- v199 auto nutritionist draft:
  - Every completed photo estimate now auto-saves a recoverable meal-record draft with calories, macros, goal-aware nutritionist score, strength, gap, and next-meal advice.
  - The draft remains separate from formal meal records to avoid duplicate calorie accounting, but it makes the MVP promise truer: leaving the page after analysis still preserves the nutritionist result.
  - The photo-response smoke test now verifies the auto draft contains the nutrition coach payload and is not marked as a formal record.
- v200 visible food recognition:
  - The first-layer estimate result now shows an AI food recognition summary before the advanced section: food name, portion, and main ingredients.
  - Auto meal drafts now persist the same recognition summary, so the saved nutritionist draft carries the reasoning behind the calorie estimate instead of only numbers.
  - The photo-response smoke test verifies the recognition summary is visible while advanced details stay collapsed by default.
- v203 P0 performance simplification:
  - Extracted the large inline CSS and JS into `styles.css` and `app.js`, with service-worker caching and explicit query-versioned asset links.
  - Simplified the initial home view to five visible modules: main mission, quick record strip, TATA state, today summary, and next-meal advice.
  - Added home-mode and lazy tab hydration so the detailed meal/body/memory panels are not part of the initial active view.
  - Removed external Google Fonts and replaced visible English module kickers with Traditional Chinese labels.
  - Added a performance budget smoke test for DOMContentLoaded, FCP, active-view DOM, and visible button count.
- v204 flow/router/lifecycle fix:
  - Clarified the meal-photo flow so a before-meal photo is the main path and immediately produces calories, macros, and nutritionist advice; after-meal photos are now explicitly optional calibration.
  - Added a dedicated trend tab route instead of reusing the body tab, so the bottom `趨勢` entry no longer shows height/weight inputs.
  - Extended tab lifecycle cleanup so inactive panels unmount after switching, keeping DOM bounded even after users visit meal, body, trend, and memory.

## Next Product Core: Place Memory

- Meal photos should eventually remember where the user ate, restaurant notes, and whether the meal was worth returning to.
- The target experience is closer to a personal food memory map: photo, calories, meal result, location, restaurant condition, and next-time notes.
- This should remain optional and lightweight so the main flow stays photo-first.

- Gemini can help with TATA illustration variants, app icon polish, and marketing visuals.
- Manus can help run long-form exploratory QA and visual comparison reports.
- Codex should keep owning app logic, API behavior, tests, and deployability.
