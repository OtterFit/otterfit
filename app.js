        const APP_VERSION = "paipachi-app-v216";
        const VALID_USERS = ["001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "Lynn", "Leia", "Andrew", "Sally"];
        const DAILY_GUIDELINES = {
            fiberG: 28,
            fiberPer1000Kcal: 14,
            waterMl: 2000,
            proteinDvG: 50,
            proteinPerKg: 0.8,
            sodiumMg: 2300,
            sugarEnergyRatio: 0.1,
            sourceNote: "FDA/DGA/DRI 公開基準：纖維 DV 28g（約 14g/1000kcal）、蛋白質 DV 50g 且依體重 0.8g/kg、鈉 <2300mg、添加糖 <10% 熱量；喝水為 2000ml 產品追蹤目標"
        };
        function ensureFreshAppVersion() {
            try {
                const key = "paipachi:appVersion";
                if (localStorage.getItem(key) === APP_VERSION) return;
                localStorage.setItem(key, APP_VERSION);
                if ('caches' in window) caches.keys().then(keys => keys.forEach(name => caches.delete(name)));
                if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.update()));
            } catch (error) {}
        }
        ensureFreshAppVersion();
        const lazyTabStore = {};

        function hydrateTabPanel(panelId) {
            const panel = document.getElementById(panelId);
            if (!panel || panel.dataset.lazy !== "true") return;
            panel.innerHTML = lazyTabStore[panelId] || "";
            panel.dataset.lazy = "false";
        }

        function dehydrateInactiveTabs() {
            const isHomeMode = document.getElementById('mainAppContainer')?.classList.contains('home-mode');
            ["tab-photo", "tab-body", "tab-trend", "tab-diet"].forEach(panelId => {
                const panel = document.getElementById(panelId);
                if (!panel || (!isHomeMode && panel.classList.contains('active')) || panel.dataset.lazy === "true") return;
                lazyTabStore[panelId] = panel.innerHTML;
                panel.innerHTML = "";
                panel.dataset.lazy = "true";
            });
        }

        let currentUser = "";
        function createDefaultUserData() {
            return { targetCalories: 1750, consumedCalories: 0, totalProtein: 0, totalFiber: 0, waterMl: 0, currentWeight: 75.0, accountWeightKg: 75.0, currentHeight: 170, currentSteps: 0, streakDays: 0, dietRecords: [], selectedTone: "slim", onboardCompleted: false };
        }
        let userData = createDefaultUserData();

        let undoSnapshot = null; let undoTimeoutTimer = null;
        let selectedMeal = { name: "照片餐點估算", calories: 520, protein: 22, carbs: 58, fat: 18, fiber: 0, sugar: 0, sodium: 0, mealQuality: "unknown", healthFlags: [], items: [], photo: "", source: "photo_estimate", aiResult: null, corrected: false, warning: "" };
        let selectedMealName = selectedMeal.name; let selectedMealKcal = selectedMeal.calories;
        let selectedP = selectedMeal.protein; let selectedV = selectedMeal.carbs; let selectedF = selectedMeal.fat;
        let selectedFiber = selectedMeal.fiber; let selectedSugar = selectedMeal.sugar; let selectedSodium = selectedMeal.sodium;
        let selectedPortion = 1;
        let photoCapturePhase = "before";
        let activePhotoSessionId = 0;
        let activePhotoDraft = null;
        let lastPhotoPickerRequest = null;
        let autoSavedMealDraft = null;
        let activeMealLocationSnapshot = null;
        let pendingBeforeMeal = null;
        let currentMealPlan = null;
        let memorySelectedDate = "";
        let memoryRenderedRecords = [];
        let lastSavedMealFocusId = "";
        let activePlaceQuickEdit = { mealId: "", dateKey: "" };
        let recentMemoryDates = [];
        let memorySearchQuery = "";
        let placeRevisitQuery = "";
        let placeRevisitHighOnly = false;
        let placeRevisitGoalFitOnly = false;
        let placeRevisitIncompleteOnly = false;
        let placeRevisitCategory = "all";
        let selectedPlaceMemoryKey = "";

        const progressCircle = document.getElementById('progressCircle');
        const caloriesLeftDisplay = document.getElementById('caloriesLeftDisplay');
        const tomaGiantAvatar = document.getElementById('tomaGiantAvatar');
        const tomaStageBadge = document.getElementById('tomaStageBadge');
        const tomaBubble = document.getElementById('tomaBubble');
        const tataStateNote = document.getElementById('tataStateNote');

        // 🦦🍅 海獺吃番茄原創隨機驚喜台詞庫
        const pokeQuotes = [
            "（嚼嚼）...我是塔塔。這顆番茄甜度剛剛好。你忙你的，我陪你慢慢來。",
            "被你發現了。我看起來圓滾滾，但我其實在很認真地練核心。",
            "相機已就緒。你不用完美，我們只要比昨天更懂自己一點點。",
            "躺平只是我的偽裝。塔塔其實在默默維持狀態。",
            "少吃一口醬汁，明天我陪你多賺 3000 步。"
        ];

        const OTTER_STAGES = [
            { name: '番茄守門獺．塔塔', minScore: 0, minDays: 0, story: '塔塔剛搬進健康小窩，正在學會記住你的第一餐。', bubble: '（嚼嚼）...我是塔塔。這顆番茄甜度剛剛好。先記一餐就好，慢慢來，我陪你往前。' },
            { name: '微結實晨光獺', minScore: 180, minDays: 3, story: '塔塔開始懂你的作息，身體也跟著變輕快。', bubble: '我們已經建立初步記錄囉，塔塔覺得自己的身體也跟著變輕快了。' },
            { name: '結實活力獺', minScore: 450, minDays: 7, story: '塔塔會把拍照餐點、步數和蛋白質串起來。', bubble: '今天的目標完成得很漂亮。你有看到嗎？塔塔的手臂好像也更有力了！' },
            { name: '精實流線獺', minScore: 1200, minDays: 14, story: '塔塔已經能看懂你的高低起伏，幫你守住不暴衝的節奏。', bubble: '我們最近的節奏很穩，今天只要守住關鍵目標就很好。少吃一口醬汁，明天我陪你多賺 3000 步。' },
            { name: '超精實水獺', minScore: 2800, minDays: 30, story: '塔塔把這段日子收進回憶相簿，提醒你：你真的做得到。', bubble: '你真的把自己照顧得很好。躺平只是我的偽裝，塔塔會陪你把這份狀態一直維持下去。' }
        ];

        async function executeSecureLogin() {
            const rawUserIn = document.getElementById('loginUsername').value.trim();
            const userIn = VALID_USERS.find(name => name.toLowerCase() === rawUserIn.toLowerCase()) || rawUserIn;
            const errorEl = document.getElementById('loginErrorMsg');

            if (isValidUsername(userIn)) {
                errorEl.style.display = "none";
                currentUser = userIn;
                localStorage.setItem('paipachi:currentUser', currentUser);
                document.getElementById('loginOverlay').style.display = "none";

                await loadUserProfile(currentUser);
                if (isOnboardingDone(currentUser)) { enterMainApplication(); }
                else { launchOnboardWorkflow(); }
            } else {
                errorEl.style.display = "block";
            }
        }

        function launchOnboardWorkflow() {
            document.getElementById('onboardOverlay').style.display = "flex";
            document.getElementById('bottomNav').style.display = "none";
            document.getElementById('onboardScreen1').classList.add('active');
            document.getElementById('onboardScreen2').classList.remove('active');
            document.getElementById('onboardStepBadge').innerText = "步驟 1 / 2";
            syncOnboardBodyInputs();
            syncOnboardGoalCards();
            calculateOnboardBmi();
        }

        function selectOnboardTone(btn, tone) {
            document.querySelectorAll('.onboard-card-click').forEach(c => c.classList.remove('selected'));
            btn.classList.add('selected');
            userData.selectedTone = tone;
            calculateOnboardBmi();
        }

        function syncOnboardGoalCards() {
            document.querySelectorAll('.onboard-card-click').forEach(card => card.classList.remove('selected'));
            const goalIndex = { slim: 0, fitness: 1, maintain: 2, healthy: 3, gain: 4 }[userData.selectedTone] ?? 0;
            document.querySelectorAll('.onboard-card-click')[goalIndex]?.classList.add('selected');
        }

        function goToOnboardStep2() {
            syncOnboardBodyInputs();
            document.getElementById('onboardScreen1').classList.remove('active');
            document.getElementById('onboardScreen2').classList.add('active');
            document.getElementById('onboardStepBadge').innerText = "步驟 2 / 2";
        }

        function syncOnboardBodyInputs() {
            const heightSlider = document.getElementById('heightSlider');
            const weightSlider = document.getElementById('weightSlider');
            if (heightSlider && Number.isFinite(Number(userData.currentHeight))) heightSlider.value = userData.currentHeight;
            if (weightSlider && Number.isFinite(Number(userData.currentWeight))) weightSlider.value = userData.currentWeight;
        }

        function calculateOnboardBmi() {
            const h = parseFloat(document.getElementById('heightSlider').value);
            const w = parseFloat(document.getElementById('weightSlider').value);
            const heightInput = document.getElementById('onboardHeightInput');
            const weightInput = document.getElementById('onboardWeightInput');

            document.getElementById('sliderHeightVal').innerText = h;
            document.getElementById('sliderWeightVal').innerText = w.toFixed(1);
            if (heightInput && document.activeElement !== heightInput) heightInput.value = String(Math.round(h));
            if (weightInput && document.activeElement !== weightInput) weightInput.value = w.toFixed(1);

            const bmi = w / ((h/100) * (h/100));
            document.getElementById('onboardBmiDisplay').innerText = bmi.toFixed(1);

            const estimatedTdee = Math.round((10 * w + 6.25 * h - 5 * 30 + 5) * 1.35);
            let calcKcal = estimatedTdee;
            if (userData.selectedTone === 'slim') calcKcal -= 300;
            if (userData.selectedTone === 'fitness') calcKcal += 100;
            if (userData.selectedTone === 'healthy') calcKcal -= 100;
            if (userData.selectedTone === 'gain') calcKcal += 250;
            calcKcal = Math.max(1200, Math.min(3200, calcKcal));

            document.getElementById('onboardKcalDisplay').innerHTML = `${calcKcal}<span> kcal</span>`;

            userData.currentHeight = h;
            userData.currentWeight = w;
            userData.accountWeightKg = w;
            userData.targetCalories = calcKcal;
        }

        function syncOnboardDirectInput(type) {
            const heightSlider = document.getElementById('heightSlider');
            const weightSlider = document.getElementById('weightSlider');
            const heightInput = document.getElementById('onboardHeightInput');
            const weightInput = document.getElementById('onboardWeightInput');
            if (type === 'height') {
                const value = Number(heightInput?.value || 0);
                if (!Number.isFinite(value) || value < 120 || value > 230) {
                    showToast("請輸入合理身高，例如 166");
                    return false;
                }
                if (heightSlider) heightSlider.value = String(Math.max(120, Math.min(230, Math.round(value))));
                if (heightInput) heightInput.value = String(Math.round(value));
            }
            if (type === 'weight') {
                const value = Number(weightInput?.value || 0);
                if (!Number.isFinite(value) || value < 30 || value > 250) {
                    showToast("請輸入合理體重，例如 58.5");
                    return false;
                }
                if (weightSlider) weightSlider.value = String(Math.max(30, Math.min(250, Math.round(value * 10) / 10)));
                if (weightInput) weightInput.value = (Math.round(value * 10) / 10).toFixed(1);
            }
            calculateOnboardBmi();
            return true;
        }

        async function completeOnboardWorkflow() {
            userData.onboardCompleted = true;
            userData.streakDays = 0;
            if (currentUser) {
                localStorage.setItem(`paipachi:${currentUser}:calorieTarget`, String(userData.targetCalories));
                localStorage.setItem(`paipachi:${currentUser}:calorieGoal`, userData.selectedTone);
                localStorage.setItem(dailyKey('weight'), userData.currentWeight.toFixed(1));
                localStorage.setItem(`paipachi:${currentUser}:profile`, JSON.stringify(getAccountProfileSnapshot()));
                localStorage.setItem(`paipachi:${currentUser}:onboardingDone`, 'true');
            }
            saveToStorage();
            await saveRemoteUserProfile();

            document.getElementById('onboardOverlay').style.display = "none";
            enterMainApplication();
            renderProfileSyncCard("remote");

            document.getElementById('exerciseAlert').style.display = "block";
            document.getElementById('exerciseAlert').innerHTML = `💡 <b>小窩初始進度：</b>健康小窩已完成 20%，只差你的第一餐照片囉。`;
        }

        function quickStartFirstMeal() {
            calculateOnboardBmi();
            userData.onboardCompleted = true;
            userData.streakDays = 0;
            if (currentUser) {
                localStorage.setItem(`paipachi:${currentUser}:calorieTarget`, String(userData.targetCalories));
                localStorage.setItem(`paipachi:${currentUser}:calorieGoal`, userData.selectedTone);
                localStorage.setItem(dailyKey('weight'), userData.currentWeight.toFixed(1));
                localStorage.setItem(`paipachi:${currentUser}:profile`, JSON.stringify(getAccountProfileSnapshot()));
                localStorage.setItem(`paipachi:${currentUser}:onboardingDone`, 'true');
            }
            saveToStorage();
            saveRemoteUserProfile().catch(error => console.warn('Quick-start profile save failed', error));
            document.getElementById('onboardOverlay').style.display = "none";
            enterMainApplication();
            renderProfileSyncCard("local");
            document.getElementById('exerciseAlert').style.display = "block";
            document.getElementById('exerciseAlert').innerHTML = `先拍第一餐就好。身高體重之後可在身體趨勢補，塔塔先幫你把今天吃飯回憶留下來。`;
            tomaBubble.innerText = "先不用把資料填到完美。吃飯前拍一張，我先幫你記住這餐。";
            openPhotoPicker('before');
        }

        function enterMainApplication() {
            document.getElementById('mainAppContainer').style.display = "block";
            document.getElementById('bottomNav').style.display = "grid";
            document.getElementById('logoutBtn').innerText = `${currentUser} (登出)`;

            document.getElementById('loginUsername').value = "";
            bindTabNavigation();
            switchTabById('tab-photo');
            document.getElementById('mainAppContainer')?.classList.add('home-mode');
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
            cleanMealHistoryStore();
            loadDailyStores();
            fetchRemoteMealsForDate(todayKeyDate()).then(payload => {
                if (payload && Array.isArray(payload.meals)) {
                    loadDailyStores();
                    updateUI(false);
                    if (memorySelectedDate === todayKeyDate()) renderTodayDiarySummary();
                }
            });
            fetchRemoteDailyState(todayKeyDate()).then(payload => {
                if (payload && payload.state) {
                    loadDailyStores();
                    updateUI(false);
                    if (memorySelectedDate === todayKeyDate()) renderTodayDiarySummary();
                }
            });
            checkOtterDecay();
            markActive();
            updateUI(false);
            renderP3WeeklyReportCard();
            renderProfileSyncCard("local");
            startAutomaticStepCounter();
            renderInstallNudgeCard();
            setTimeout(dehydrateInactiveTabs, 0);
        }

        function handleLogout() {
            saveToStorage();
            localStorage.removeItem('paipachi:currentUser');
            currentUser = "";
            document.getElementById('mainAppContainer').style.display = "none";
            document.getElementById('bottomNav').style.display = "none";
            document.getElementById('onboardOverlay').style.display = "none";
            document.getElementById('loginOverlay').style.display = "flex";
        }

        function saveToStorage() {
            if (currentUser) {
                localStorage.setItem(`paipachi_user_${currentUser}`, JSON.stringify(userData));
                persistLocalUserProfile();
            }
        }

        function persistLocalUserProfile() {
            if (!currentUser) return;
            localStorage.setItem(`paipachi:${currentUser}:calorieTarget`, String(userData.targetCalories));
            localStorage.setItem(`paipachi:${currentUser}:calorieGoal`, userData.selectedTone);
            localStorage.setItem(`paipachi:${currentUser}:profile`, JSON.stringify(getAccountProfileSnapshot()));
        }

        function getAccountProfileSnapshot() {
            const accountWeight = Number(userData.accountWeightKg || userData.currentWeight || 0);
            return {
                heightCm: userData.currentHeight,
                weightKg: accountWeight,
                goal: userData.selectedTone,
                calorieTarget: userData.targetCalories,
                onboardingDone: Boolean(userData.onboardCompleted),
                profileVersion: 2,
                updatedAt: new Date().toISOString()
            };
        }

        function getGoalLabel(goal = userData.selectedTone) {
            if (goal === "fitness") return "健身增肌";
            if (goal === "maintain") return "維持體態";
            if (goal === "healthy") return "健康飲食";
            if (goal === "gain") return "健康增重";
            return "瘦身控卡";
        }

        function isBetaTesterAccount(username = currentUser) {
            const normalized = String(username || "").trim().toLowerCase();
            return VALID_USERS.some(name => String(name).toLowerCase() === normalized);
        }

        function ensureBetaTesterProfile(username = currentUser) {
            if (!username || !isBetaTesterAccount(username) || isOnboardingDone(username)) return false;
            userData = {
                ...createDefaultUserData(),
                ...userData,
                onboardCompleted: true,
                selectedTone: userData.selectedTone || "slim",
                targetCalories: Number(userData.targetCalories || 1750),
                currentHeight: Number(userData.currentHeight || 170),
                currentWeight: Number(userData.currentWeight || 75),
                accountWeightKg: Number(userData.accountWeightKg || userData.currentWeight || 75)
            };
            localStorage.setItem(`paipachi:${username}:onboardingDone`, "true");
            localStorage.setItem(`paipachi:${username}:calorieTarget`, String(userData.targetCalories));
            localStorage.setItem(`paipachi:${username}:calorieGoal`, userData.selectedTone);
            localStorage.setItem(`paipachi:${username}:profile`, JSON.stringify(getAccountProfileSnapshot()));
            localStorage.setItem(`paipachi_user_${username}`, JSON.stringify(userData));
            return true;
        }

        function renderProfileSyncCard(source = "local") {
            const textEl = document.getElementById('profileSyncText');
            const pillEl = document.getElementById('profileSyncPill');
            if (!textEl || !pillEl || !currentUser) return;
            const todayWeight = currentUser ? localStorage.getItem(dailyKey('weight')) : "";
            const accountWeight = Number(userData.accountWeightKg || userData.currentWeight || 0);
            const remoteHint = source === "remote" ? "已讀取帳號雲端資料" : "本機與帳號資料已保存";
            pillEl.innerText = remoteHint;
            textEl.innerText = `${currentUser} 的體態資料已綁定帳號：身高 ${Math.round(userData.currentHeight || 0)}cm、註冊基準體重 ${accountWeight.toFixed(1)}kg、目標 ${getGoalLabel()}、每日目標 ${Math.round(userData.targetCalories || 0)} kcal。${todayWeight ? `今天體重紀錄 ${Number(todayWeight).toFixed(1)}kg，` : ""}換瀏覽器登入同帳號會優先讀取註冊資料，今日體重只綁今天。`;
        }

        function escapeDataHealthText(value) {
            return String(value ?? "").replace(/[&<>"']/g, (char) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char]));
        }

        function p2SafeText(value) {
            return escapeDataHealthText(value || "");
        }

        function getP2MealItems(meal = selectedMeal) {
            const items = Array.isArray(meal.items) ? meal.items.filter(item => item && (item.name || item.portion || item.calories)) : [];
            if (items.length) {
                return items.slice(0, 4).map(item => ({
                    name: item.name || meal.name || "照片餐點",
                    portion: item.portion || "約 1 份",
                    calories: Math.max(0, Math.round(Number(item.calories || item.kcal || 0)))
                }));
            }
            return [{
                name: meal.name || selectedMealName || "照片餐點",
                portion: Number(selectedPortion || 1) === 1 ? "約 1 份" : `約 ${Number(selectedPortion || 1).toFixed(2)} 份`,
                calories: Math.max(0, Math.round(Number(selectedMealKcal || meal.calories || 0)))
            }];
        }

        function getP2MealScore() {
            const kcal = Math.max(0, Math.round(Number(selectedMealKcal || 0)));
            const protein = Math.max(0, Math.round(Number(selectedP || 0)));
            const fiber = Math.max(0, Math.round(Number(selectedFiber || 0)));
            const fat = Math.max(0, Math.round(Number(selectedF || 0)));
            const sodium = Math.max(0, Math.round(Number(selectedSodium || 0)));
            let score = 78;
            if (protein >= 25) score += 10;
            else if (protein < 12) score -= 12;
            if (fiber >= 6) score += 8;
            else if (fiber < 3) score -= 8;
            if (kcal > 850) score -= 12;
            if (fat > 35) score -= 8;
            if (sodium > 1100) score -= 8;
            if (selectedMeal.confidence === "low") score -= 5;
            return Math.max(0, Math.min(100, Math.round(score)));
        }

        function getP2CoachAdvice(score = getP2MealScore()) {
            const protein = Math.max(0, Math.round(Number(selectedP || 0)));
            const fiber = Math.max(0, Math.round(Number(selectedFiber || 0)));
            const kcal = Math.max(0, Math.round(Number(selectedMealKcal || 0)));
            const good = protein >= 25
                ? "蛋白質有撐住，這餐比較有飽足感。"
                : fiber >= 5
                    ? "纖維量不錯，蔬菜或原型食物有出現。"
                    : kcal <= 550
                        ? "熱量還算收斂，今天後面比較好安排。"
                        : "你有把這餐拍下來，塔塔已經能幫你接下一步。";
            const gap = protein < 18
                ? "蛋白質偏少。"
                : fiber < 4
                    ? "纖維還可以再補一點。"
                    : kcal > 850
                        ? "熱量偏高，下一餐要收一下主食和油脂。"
                        : score < 70
                            ? "這餐有幾個地方需要下一餐補回來。"
                            : "這餐整體穩，重點是把節奏延續。";
            const next = protein < 18
                ? "下一餐加一掌心的魚、雞、蛋、豆腐或豆干。"
                : fiber < 4
                    ? "下一餐補一份青菜、菇類或海帶。"
                    : kcal > 850
                        ? "下一餐抓清爽一點，湯底少喝、醬料分開。"
                        : "下一餐維持蛋白質加蔬菜，主食正常半碗到一碗。";
            return { good, gap, next };
        }

        function renderP2ResultCard() {
            const summary = document.getElementById('p2ResultSummaryCard');
            const progress = document.getElementById('p2MacroProgressCard');
            const coach = document.getElementById('p2TataCoachCard');
            const hasEstimate = Number(selectedMealKcal || selectedMeal?.calories || 0) > 0 && selectedMeal?.source !== "photo_loading";
            if (!hasEstimate) {
                [summary, progress, coach].forEach(el => {
                    if (!el) return;
                    el.classList.remove('active');
                    el.innerHTML = "";
                });
                return;
            }
            const score = getP2MealScore();
            const scoreClass = score >= 80 ? "good" : (score >= 65 ? "mid" : "low");
            const sourceLabel = getEstimateSourceLabel(selectedMeal.source);
            const items = getP2MealItems(selectedMeal);
            const itemHtml = items.map(item => `
                <div class="p2-recognition-item">
                    <strong>${p2SafeText(item.name)}</strong>
                    <span>${p2SafeText(item.portion)}${item.calories ? ` · ${item.calories} kcal` : ""}</span>
                </div>
            `).join("");
            if (summary) {
                summary.classList.add('active');
                summary.innerHTML = `
                    <div class="p2-result-top">
                        <div>
                            <div class="p2-result-kicker">10 秒本餐分析</div>
                            <div class="p2-result-title">${p2SafeText(selectedMealName || selectedMeal.name || "照片餐點")}</div>
                        </div>
                        <div class="p2-score-badge ${scoreClass}"><span>${score}</span><small>本餐分</small></div>
                    </div>
                    <div class="p2-recognition-list">${itemHtml}</div>
                `;
            }
            const rows = [
                { label: "熱量", value: selectedMealKcal, unit: "kcal", max: 850, cls: "" },
                { label: "蛋白質", value: selectedP, unit: "g", max: 35, cls: "protein" },
                { label: "碳水", value: selectedV, unit: "g", max: 95, cls: "carbs" },
                { label: "脂肪", value: selectedF, unit: "g", max: 35, cls: "fat" },
                { label: "纖維", value: selectedFiber, unit: "g", max: 10, cls: "fiber" }
            ];
            if (progress) {
                progress.classList.add('active');
                progress.innerHTML = rows.map(row => {
                    const pct = Math.max(4, Math.min(100, Math.round((Number(row.value || 0) / row.max) * 100)));
                    return `
                        <div class="p2-macro-row">
                            <span>${row.label}</span>
                            <div class="p2-macro-bar"><div class="p2-macro-fill ${row.cls}" style="width:${pct}%"></div></div>
                            <strong>${Math.round(Number(row.value || 0))}${row.unit}</strong>
                        </div>
                    `;
                }).join("");
            }
            const advice = getP2CoachAdvice(score);
            if (coach) {
                coach.classList.add('active');
                coach.innerHTML = `
                    <div class="p2-tata-avatar" aria-hidden="true">塔</div>
                    <div class="p2-tata-body">
                        <div class="p2-tata-title">塔塔營養師建議</div>
                        <div class="p2-tata-line"><strong>優點：</strong>${p2SafeText(advice.good)}</div>
                        <div class="p2-tata-line"><strong>不足：</strong>${p2SafeText(advice.gap)}</div>
                        <div class="p2-tata-line"><strong>下一餐：</strong>${p2SafeText(advice.next)}</div>
                        <div class="p2-tata-line"><strong>來源：</strong>${p2SafeText(sourceLabel)}，飯前照已可直接記錄；飯後照只是加分校正。</div>
                    </div>
                `;
            }
        }

        function getDataHealthSnapshot() {
            const today = todayKeyDate();
            const profile = currentUser ? safeJsonObject(localStorage.getItem(`paipachi:${currentUser}:profile`)) : null;
            const todayMeals = currentUser ? safeJsonArray(localStorage.getItem(`paipachi:${currentUser}:meals:${today}`)) : [];
            const mealIds = new Set();
            const mergedMeals = [];
            [...todayMeals, ...(Array.isArray(userData.dietRecords) ? userData.dietRecords : [])].forEach((meal, index) => {
                const id = meal?.id || `${meal?.name || "meal"}-${meal?.time || index}`;
                if (mealIds.has(id)) return;
                mealIds.add(id);
                mergedMeals.push(meal || {});
            });
            const photoCount = mergedMeals.reduce((sum, meal) => sum
                + (meal.photoBefore ? 1 : 0)
                + (meal.photoAfter ? 1 : 0)
                + (meal.photo && !meal.photoBefore ? 1 : 0), 0);
            const dailyState = currentUser ? buildDailyStatePayload(today) : {};
            return {
                username: currentUser || "",
                today,
                hasProfile: Boolean(profile || userData.onboardCompleted),
                profileVersion: profile?.profileVersion || 0,
                heightCm: Number(profile?.heightCm || userData.currentHeight || 0),
                weightKg: Number(profile?.weightKg || userData.accountWeightKg || userData.currentWeight || 0),
                goal: profile?.goal || userData.selectedTone,
                calorieTarget: Number(profile?.calorieTarget || userData.targetCalories || 0),
                mealsCount: mergedMeals.length,
                photoCount,
                waterMl: Number(dailyState.waterMl || 0),
                steps: Number(dailyState.steps || 0),
                stepBurn: Math.round(Number(dailyState.steps || 0) * 0.04),
                todayWeightKg: Number(dailyState.weightKg || 0),
                savedAt: profile?.updatedAt || ""
            };
        }

        function renderDataHealthCard() {
            const card = document.getElementById('dataHealthCard');
            if (!card || !currentUser) return;
            const snapshot = getDataHealthSnapshot();
            const status = snapshot.hasProfile ? "帳號資料可讀取" : "等待初次註冊";
            const profileLabel = snapshot.hasProfile
                ? `${Math.round(snapshot.heightCm)}cm / ${snapshot.weightKg.toFixed(1)}kg`
                : "尚未建立";
            const todayWeightText = snapshot.todayWeightKg > 0 ? `今日體重 ${snapshot.todayWeightKg.toFixed(1)}kg` : "今日體重未記";
            card.innerHTML = `
                <div class="data-health-top">
                    <div class="data-health-title">資料健康檢查</div>
                    <div class="data-health-pill">${escapeDataHealthText(status)}</div>
                </div>
                <div class="data-health-grid">
                    <div class="data-health-item"><strong>${escapeDataHealthText(profileLabel)}</strong><span>帳號體態：${escapeDataHealthText(getGoalLabel(snapshot.goal))} / ${Math.round(snapshot.calorieTarget || 0)} kcal</span></div>
                    <div class="data-health-item"><strong>${snapshot.mealsCount} 餐 / ${snapshot.photoCount} 張</strong><span>今日餐點與照片已綁 ${escapeDataHealthText(snapshot.today)}</span></div>
                    <div class="data-health-item"><strong>${Math.round(snapshot.waterMl)} ml</strong><span>喝水紀錄，本機今日狀態</span></div>
                    <div class="data-health-item"><strong>${Math.round(snapshot.steps)} 步</strong><span>約消耗 ${snapshot.stepBurn} kcal，${escapeDataHealthText(todayWeightText)}</span></div>
                </div>
                <div class="data-health-note">測試重點：第一次註冊後，身高、基準體重、目標熱量會跟著 ${escapeDataHealthText(snapshot.username)} 保存；每日體重、步數、喝水和餐照則綁在今天日期，不會拿每日體重去覆蓋帳號基準資料。</div>
                <div class="data-health-actions">
                    <button type="button" onclick="refreshDataHealthNow()">重新讀取資料</button>
                    <button class="primary" type="button" onclick="syncDataHealthNow()">同步今天狀態</button>
                </div>
            `;
        }

        async function syncDataHealthNow() {
            if (!currentUser) return;
            await Promise.all([
                saveRemoteUserProfile(),
                syncRemoteMealsForDate(todayKeyDate()),
                syncRemoteDailyState(todayKeyDate())
            ]);
            renderProfileSyncCard("remote");
            renderDataHealthCard();
            showToast("已同步帳號體態與今天資料。");
        }

        async function refreshDataHealthNow() {
            if (!currentUser) return;
            await Promise.all([
                fetchRemoteMealsForDate(todayKeyDate()),
                fetchRemoteDailyState(todayKeyDate())
            ]);
            loadDailyStores();
            updateUI(false);
            renderProfileSyncCard("remote");
            renderDataHealthCard();
            showToast("已重新讀取今天資料。");
        }

        function getCurrentUser() { return currentUser; }
        function todayKeyDate(date = new Date()) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        function addDaysKey(days, date = new Date()) {
            const next = new Date(date);
            next.setDate(next.getDate() + days);
            return todayKeyDate(next);
        }
        function dailyKey(feature, date = todayKeyDate()) { return `paipachi:${currentUser}:${feature}:${date}`; }
        async function loadUserProfile(username) {
            const savedData = localStorage.getItem(`paipachi_user_${username}`);
            userData = createDefaultUserData();
            if (savedData) {
                try {
                    userData = { ...createDefaultUserData(), ...JSON.parse(savedData) };
                } catch (error) {
                    localStorage.removeItem(`paipachi_user_${username}`);
                    userData = createDefaultUserData();
                }
            }
            if (!Number.isFinite(Number(userData.accountWeightKg)) || Number(userData.accountWeightKg) <= 0) {
                userData.accountWeightKg = Number(userData.currentWeight || 75);
            }

            try {
                const profile = JSON.parse(localStorage.getItem(`paipachi:${username}:profile`) || 'null');
                if (profile) {
                    if (Number.isFinite(Number(profile.heightCm))) userData.currentHeight = Number(profile.heightCm);
                    if (Number.isFinite(Number(profile.weightKg))) {
                        userData.accountWeightKg = Number(profile.weightKg);
                        userData.currentWeight = Number(profile.weightKg);
                    }
                    if (Number.isFinite(Number(profile.calorieTarget))) userData.targetCalories = Number(profile.calorieTarget);
                    if (profile.goal) userData.selectedTone = profile.goal;
                    if (profile.onboardingDone) userData.onboardCompleted = true;
                }
            } catch (error) {
                localStorage.removeItem(`paipachi:${username}:profile`);
            }

            const savedGoal = localStorage.getItem(`paipachi:${username}:calorieGoal`);
            if (savedGoal) userData.selectedTone = savedGoal;
            const savedTarget = Number(localStorage.getItem(`paipachi:${username}:calorieTarget`));
            if (Number.isFinite(savedTarget) && savedTarget > 0) userData.targetCalories = savedTarget;

            try {
                const response = await fetch(`/api/user-profile?username=${encodeURIComponent(username)}`, { cache: 'no-store' });
                if (response.ok) {
                    const payload = await response.json();
                    const remote = payload.profile;
                    if (remote) {
                        if (Number.isFinite(Number(remote.heightCm))) userData.currentHeight = Number(remote.heightCm);
                        if (Number.isFinite(Number(remote.weightKg))) {
                            userData.accountWeightKg = Number(remote.weightKg);
                            userData.currentWeight = Number(remote.weightKg);
                        }
                        if (Number.isFinite(Number(remote.calorieTarget))) userData.targetCalories = Number(remote.calorieTarget);
                        if (remote.goal) userData.selectedTone = remote.goal;
                        if (remote.onboardingDone) {
                            userData.onboardCompleted = true;
                            localStorage.setItem(`paipachi:${username}:onboardingDone`, 'true');
                            localStorage.setItem(`paipachi:${username}:calorieTarget`, String(userData.targetCalories));
                            localStorage.setItem(`paipachi:${username}:calorieGoal`, userData.selectedTone);
                            localStorage.setItem(`paipachi:${username}:profile`, JSON.stringify({ ...getAccountProfileSnapshot(), updatedAt: remote.updatedAt || new Date().toISOString() }));
                            renderProfileSyncCard("remote");
                        }
                    }
                }
            } catch (error) {
                console.warn('Remote profile unavailable', error);
            }

            if (isOnboardingDone(username)) {
                userData.onboardCompleted = true;
                localStorage.setItem(`paipachi:${username}:onboardingDone`, 'true');
            }
            if (ensureBetaTesterProfile(username)) {
                saveRemoteUserProfile().catch(error => console.warn('Beta tester profile save failed', error));
            }
        }

        function isValidUsername(username) {
            return /^[A-Za-z0-9_-]{1,32}$/.test(String(username || ""));
        }
        async function saveRemoteUserProfile() {
            if (!currentUser) return;
            try {
                await fetch('/api/user-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser,
                        profile: {
                            ...getAccountProfileSnapshot()
                        }
                    })
                });
            } catch (error) {
                console.warn('Remote profile save failed', error);
            }
        }

        async function fetchRemoteMealsForDate(dateKey = todayKeyDate()) {
            if (!currentUser) return null;
            try {
                const response = await fetch(`/api/user-meals?username=${encodeURIComponent(currentUser)}&date=${encodeURIComponent(dateKey)}`);
                if (!response.ok) return null;
                const payload = await response.json();
                if (!Array.isArray(payload.meals)) return null;
                const localKey = `paipachi:${currentUser}:meals:${dateKey}`;
                const localMeals = safeJsonArray(localStorage.getItem(localKey));
                if (payload.meals.length || !localMeals.length) {
                    localStorage.setItem(localKey, JSON.stringify(payload.meals));
                    replaceMealHistoryForDate(dateKey, payload.meals);
                }
                return payload;
            } catch (error) {
                console.warn('Remote meals fetch failed', error);
                return null;
            }
        }

        async function fetchRemoteMealDates(limit = 10) {
            if (!currentUser) return [];
            try {
                const response = await fetch(`/api/user-meal-dates?username=${encodeURIComponent(currentUser)}&limit=${encodeURIComponent(limit)}`, { cache: 'no-store' });
                if (!response.ok) return buildLocalMemoryDateSummaries(limit);
                const payload = await response.json();
                recentMemoryDates = Array.isArray(payload.dates) ? payload.dates : [];
                return recentMemoryDates.length ? recentMemoryDates : buildLocalMemoryDateSummaries(limit);
            } catch (error) {
                console.warn('Remote meal dates fetch failed', error);
                return buildLocalMemoryDateSummaries(limit);
            }
        }

        function buildLocalMemoryDateSummaries(limit = 10) {
            if (!currentUser) return [];
            const byDate = new Map();
            getMealHistory(250).forEach(meal => {
                const date = meal.dateKey || normalizeMealDateKey(meal.createdAt) || todayKeyDate();
                if (!byDate.has(date)) byDate.set(date, []);
                byDate.get(date).push(meal);
            });
            if (!byDate.size) {
                const prefix = `paipachi:${currentUser}:meals:`;
                Object.keys(localStorage)
                    .filter(key => key.startsWith(prefix))
                    .map(key => key.slice(prefix.length))
                    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
                    .forEach(date => byDate.set(date, safeJsonArray(localStorage.getItem(`${prefix}${date}`))));
            }
            return [...byDate.entries()]
                .sort((a, b) => b[0].localeCompare(a[0]))
                .slice(0, limit)
                .map(([date, meals]) => {
                    const calories = meals.reduce((sum, meal) => sum + Number(meal.calories || meal.kcal || 0), 0);
                    const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore ? 1 : 0) + (meal.photoAfter ? 1 : (meal.photo && !meal.photoBefore ? 1 : 0)), 0);
                    const cover = meals.map(meal => meal.thumbnail || meal.photoBefore || meal.photo || meal.photoAfter).find(Boolean) || "";
                    return { date, mealCount: meals.length, photoCount, calories, cover };
                })
                .filter(entry => entry.mealCount || entry.photoCount);
        }

        function mealHistoryKey(username = currentUser) {
            return username ? `paipachi:${username}:mealHistory` : "";
        }

        function normalizeMealDateKey(value) {
            if (!value) return "";
            if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? "" : todayKeyDate(date);
        }

        function getMealHistoryThumbnail(meal = {}) {
            const source = meal.thumbnail || meal.photoBefore || meal.photo || meal.photoAfter || "";
            if (!source || typeof source !== "string") return "";
            return source.length <= 120000 ? source : "";
        }

        function normalizeMealHistoryEntry(meal = {}, dateKey = "") {
            const createdAt = meal.createdAt || meal.capturedAt || new Date().toISOString();
            const normalizedDate = dateKey || meal.dateKey || normalizeMealDateKey(createdAt) || todayKeyDate();
            const id = meal.id || `meal_${normalizedDate}_${Math.round(Number(meal.calories || meal.kcal || 0))}_${String(meal.name || "meal").slice(0, 12)}`;
            return {
                id,
                dateKey: normalizedDate,
                time: meal.time || "",
                mealSlot: meal.mealSlot || getMealSlot(new Date(createdAt)),
                name: String(meal.name || meal.finalName || "餐點").trim(),
                calories: Math.max(0, Math.round(Number(meal.calories || meal.kcal || 0))),
                protein: Math.max(0, Math.round(Number(meal.protein || 0))),
                carbs: Math.max(0, Math.round(Number(meal.carbs || 0))),
                fat: Math.max(0, Math.round(Number(meal.fat || 0))),
                fiber: Math.max(0, Math.round(Number(meal.fiber || 0))),
                sugar: Math.max(0, Math.round(Number(meal.sugar || 0))),
                sodium: Math.max(0, Math.round(Number(meal.sodium || 0))),
                placeName: meal.placeName || meal.restaurantName || "",
                placeAddress: meal.placeAddress || meal.locationName || "",
                placeRating: Number(meal.placeRating || 0),
                nextAdvice: meal.nextAdvice || "",
                source: meal.source || "",
                thumbnail: getMealHistoryThumbnail(meal),
                hasBeforePhoto: Boolean(meal.photoBefore || meal.photo),
                hasAfterPhoto: Boolean(meal.photoAfter),
                createdAt,
                updatedAt: meal.updatedAt || createdAt
            };
        }

        function writeMealHistory(entries = []) {
            const key = mealHistoryKey();
            if (!key) return [];
            const unique = new Map();
            entries.forEach(entry => {
                if (!entry || !entry.id) return;
                unique.set(`${entry.dateKey}:${entry.id}`, entry);
            });
            const list = [...unique.values()]
                .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
                .slice(0, 360);
            try {
                localStorage.setItem(key, JSON.stringify(list));
            } catch (error) {
                const compact = list.map(entry => ({ ...entry, thumbnail: "" })).slice(0, 240);
                localStorage.setItem(key, JSON.stringify(compact));
            }
            return list;
        }

        function rebuildMealHistoryFromDailyStores(limitDays = 120) {
            if (!currentUser) return [];
            const prefix = `paipachi:${currentUser}:meals:`;
            const dates = Object.keys(localStorage)
                .filter(key => key.startsWith(prefix))
                .map(key => key.slice(prefix.length))
                .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
                .sort()
                .reverse()
                .slice(0, limitDays);
            const entries = [];
            dates.forEach(date => {
                safeJsonArray(localStorage.getItem(`${prefix}${date}`))
                    .forEach(meal => entries.push(normalizeMealHistoryEntry(meal, date)));
            });
            return writeMealHistory(entries);
        }

        function getMealHistory(limit = 360) {
            if (!currentUser) return [];
            const key = mealHistoryKey();
            let list = safeJsonArray(localStorage.getItem(key));
            if (!list.length) list = rebuildMealHistoryFromDailyStores();
            return list.slice(0, limit);
        }

        function upsertMealHistory(meal, dateKey = todayKeyDate()) {
            if (!currentUser || !meal) return [];
            const entry = normalizeMealHistoryEntry(meal, dateKey);
            const existing = getMealHistory(360).filter(item => !(item.id === entry.id && item.dateKey === entry.dateKey));
            return writeMealHistory([entry, ...existing]);
        }

        function isValidMealMemoryEntry(meal = {}) {
            const name = String(meal.name || meal.finalName || meal.foodName || meal.food || "").trim();
            const calories = Math.round(Number(meal.calories || meal.kcal || 0));
            if (!name || name === "餐點" || name === "照片待確認") return false;
            if (!Number.isFinite(calories) || calories <= 0) return false;
            return true;
        }

        function cleanMealHistoryStore() {
            if (!currentUser) return [];
            const key = mealHistoryKey();
            const raw = safeJsonArray(localStorage.getItem(key));
            if (!raw.length) return [];
            const cleaned = raw
                .filter(isValidMealMemoryEntry)
                .map(entry => normalizeMealHistoryEntry(entry, entry.dateKey || normalizeMealDateKey(entry.createdAt)))
                .filter(isValidMealMemoryEntry);
            if (cleaned.length !== raw.length) return writeMealHistory(cleaned);
            return raw;
        }

        function replaceMealHistoryForDate(dateKey = todayKeyDate(), meals = safeJsonArray(localStorage.getItem(`paipachi:${currentUser}:meals:${dateKey}`))) {
            if (!currentUser) return [];
            const existing = getMealHistory(360).filter(item => item.dateKey !== dateKey);
            const entries = (meals || []).filter(isValidMealMemoryEntry).map(meal => normalizeMealHistoryEntry(meal, dateKey));
            return writeMealHistory([...entries, ...existing]);
        }

        function getStoredMealsForDate(dateKey = todayKeyDate()) {
            if (!currentUser) return [];
            const dailyMeals = safeJsonArray(localStorage.getItem(`paipachi:${currentUser}:meals:${dateKey}`));
            if (dailyMeals.length) return dailyMeals;
            return getMealHistory(360).filter(meal => meal.dateKey === dateKey);
        }

        async function syncRemoteMealsForDate(dateKey = todayKeyDate()) {
            if (!currentUser) return;
            try {
                const meals = safeJsonArray(localStorage.getItem(`paipachi:${currentUser}:meals:${dateKey}`));
                await fetch('/api/user-meals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser, date: dateKey, meals })
                });
                if (dateKey === todayKeyDate() || dateKey === memorySelectedDate) refreshRecentMemoryStrip();
            } catch (error) {
                console.warn('Remote meals sync failed', error);
            }
        }

        function buildDailyStatePayload(dateKey = todayKeyDate()) {
            return {
                waterMl: Number(localStorage.getItem(`paipachi:${currentUser}:water:${dateKey}`) || userData.waterMl || 0),
                steps: Number(localStorage.getItem(`paipachi:${currentUser}:steps:${dateKey}`) || userData.currentSteps || 0),
                weightKg: Number(localStorage.getItem(`paipachi:${currentUser}:weight:${dateKey}`) || userData.currentWeight || 0),
                dailyScore: Number(localStorage.getItem(`paipachi:${currentUser}:dailyScore:${dateKey}`) || 0),
                otterStage: Number(localStorage.getItem(`paipachi:${currentUser}:otterStage`) || 0),
                totalScore: Number(localStorage.getItem(`paipachi:${currentUser}:totalScore`) || 0),
                streakDays: Number(userData.streakDays || 0),
                sleepHours: Number(localStorage.getItem(`paipachi:${currentUser}:sleepHours:${dateKey}`) || 0),
                bowelState: localStorage.getItem(`paipachi:${currentUser}:bowelState:${dateKey}`) || "",
                energyState: localStorage.getItem(`paipachi:${currentUser}:energyState:${dateKey}`) || "",
                lastActive: localStorage.getItem(`paipachi:${currentUser}:lastActive`) || ""
            };
        }

        function applyRemoteDailyState(dateKey, state) {
            if (!currentUser || !state) return;
            if (Number.isFinite(Number(state.waterMl))) localStorage.setItem(`paipachi:${currentUser}:water:${dateKey}`, String(Math.max(0, Math.round(Number(state.waterMl)))));
            if (Number.isFinite(Number(state.steps))) localStorage.setItem(`paipachi:${currentUser}:steps:${dateKey}`, String(Math.max(0, Math.round(Number(state.steps)))));
            if (Number.isFinite(Number(state.weightKg)) && Number(state.weightKg) > 0) localStorage.setItem(`paipachi:${currentUser}:weight:${dateKey}`, Number(state.weightKg).toFixed(1));
            if (Number.isFinite(Number(state.dailyScore))) localStorage.setItem(`paipachi:${currentUser}:dailyScore:${dateKey}`, String(Math.max(0, Math.round(Number(state.dailyScore)))));
            if (Number.isFinite(Number(state.sleepHours)) && Number(state.sleepHours) > 0) localStorage.setItem(`paipachi:${currentUser}:sleepHours:${dateKey}`, String(Math.max(0, Math.min(16, Number(state.sleepHours)))));
            if (state.bowelState) localStorage.setItem(`paipachi:${currentUser}:bowelState:${dateKey}`, String(state.bowelState));
            if (state.energyState) localStorage.setItem(`paipachi:${currentUser}:energyState:${dateKey}`, String(state.energyState));
            if (dateKey === todayKeyDate()) {
                if (Number.isFinite(Number(state.waterMl))) userData.waterMl = Math.max(0, Math.round(Number(state.waterMl)));
                if (Number.isFinite(Number(state.steps))) userData.currentSteps = Math.max(0, Math.round(Number(state.steps)));
                // Daily state is a dated body log, not the account baseline profile.
                // Keeping these separate prevents a stale daily sync from resetting the registered body data.
                if (Number.isFinite(Number(state.otterStage))) localStorage.setItem(`paipachi:${currentUser}:otterStage`, String(Math.max(0, Math.round(Number(state.otterStage)))));
                if (Number.isFinite(Number(state.totalScore))) localStorage.setItem(`paipachi:${currentUser}:totalScore`, String(Math.max(0, Math.round(Number(state.totalScore)))));
                if (Number.isFinite(Number(state.streakDays))) userData.streakDays = Math.max(0, Math.round(Number(state.streakDays)));
                if (state.lastActive) localStorage.setItem(`paipachi:${currentUser}:lastActive`, String(state.lastActive));
                renderProfileSyncCard("remote");
            }
        }

        async function fetchRemoteDailyState(dateKey = todayKeyDate()) {
            if (!currentUser) return null;
            try {
                const response = await fetch(`/api/user-daily-state?username=${encodeURIComponent(currentUser)}&date=${encodeURIComponent(dateKey)}`);
                if (!response.ok) return null;
                const payload = await response.json();
                if (payload.state) applyRemoteDailyState(dateKey, payload.state);
                return payload;
            } catch (error) {
                console.warn('Remote daily state fetch failed', error);
                return null;
            }
        }

        async function syncRemoteDailyState(dateKey = todayKeyDate()) {
            if (!currentUser) return;
            try {
                await fetch('/api/user-daily-state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser, date: dateKey, state: buildDailyStatePayload(dateKey) })
                });
            } catch (error) {
                console.warn('Remote daily state sync failed', error);
            }
        }
        function isOnboardingDone(username) {
            const hasProfile = Boolean(localStorage.getItem(`paipachi:${username}:profile`));
            const hasTarget = Boolean(localStorage.getItem(`paipachi:${username}:calorieTarget`));
            return localStorage.getItem(`paipachi:${username}:onboardingDone`) === 'true' || userData.onboardCompleted === true || (hasProfile && hasTarget);
        }
        function safeJsonArray(value) {
            try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; }
            catch (error) { return []; }
        }

        function safeJsonObject(value) {
            try {
                const parsed = JSON.parse(value || 'null');
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
            } catch (error) {
                return null;
            }
        }

        function getPhotoDraftKey() {
            return dailyKey('activePhotoDraft');
        }

        function getAutoMealRecordDraftKey() {
            return dailyKey('autoMealRecordDraft');
        }

        function getActivePhotoDraft() {
            if (!currentUser) return null;
            const draft = safeJsonObject(localStorage.getItem(getPhotoDraftKey()));
            if (!draft?.photo || !String(draft.photo).startsWith('data:image/')) return null;
            const savedAt = Date.parse(draft.savedAt || "");
            if (!Number.isFinite(savedAt) || Date.now() - savedAt > 6 * 60 * 60 * 1000) {
                clearActivePhotoDraft();
                return null;
            }
            autoSavedMealDraft = draft.autoSaved ? draft : null;
            return draft;
        }

        function saveActivePhotoDraft({ phase = photoCapturePhase, photo = "", fileName = "", photoSessionId = activePhotoSessionId, status = "loaded", meal = null } = {}) {
            if (!currentUser || !photo || !String(photo).startsWith('data:image/')) return false;
            const normalizedMeal = meal ? normalizeMealEstimate(meal, meal.source || selectedMeal.source || 'photo_draft') : null;
            const mealSnapshot = normalizedMeal ? {
                ...normalizedMeal,
                photo: "",
                phase: phase === "after" ? "after" : "before",
                photoSessionId,
                locationSnapshot: meal.locationSnapshot || activeMealLocationSnapshot || null,
                mealSlot: meal.mealSlot || getMealSlot(new Date()),
                capturedAt: meal.capturedAt || new Date().toISOString(),
                confidence: meal.confidence || normalizedMeal.confidence || "medium",
                warning: meal.warning || normalizedMeal.warning || "",
                notes: meal.notes || normalizedMeal.notes || "",
                mealPlan: meal.mealPlan || currentMealPlan || null
            } : null;
            activePhotoDraft = {
                phase: phase === "after" ? "after" : "before",
                photo,
                fileName,
                photoSessionId,
                status,
                autoSaved: Boolean(mealSnapshot),
                savedAt: new Date().toISOString(),
                mealName: normalizedMeal?.name || selectedMealName || fileName || "",
                calories: Number(normalizedMeal?.calories || selectedMealKcal || 0),
                protein: Number(normalizedMeal?.protein || selectedP || 0),
                carbs: Number(normalizedMeal?.carbs || selectedV || 0),
                fat: Number(normalizedMeal?.fat || selectedF || 0),
                source: normalizedMeal?.source || selectedMeal.source || status,
                locationSnapshot: mealSnapshot?.locationSnapshot || activeMealLocationSnapshot || null,
                mealSnapshot
            };
            autoSavedMealDraft = mealSnapshot ? { ...activePhotoDraft } : autoSavedMealDraft;
            try {
                localStorage.setItem(getPhotoDraftKey(), JSON.stringify(activePhotoDraft));
                return true;
            } catch (error) {
                return false;
            }
        }

        function saveAutoMealRecordDraft({ phase = photoCapturePhase, photo = "", fileName = "", photoSessionId = activePhotoSessionId, meal = selectedMeal, status = "auto_saved" } = {}) {
            if (!currentUser || !meal || !photo || !String(photo).startsWith('data:image/')) return false;
            const normalizedMeal = normalizeMealEstimate(meal, meal.source || selectedMeal.source || "auto_meal_draft");
            const draftMeal = {
                ...normalizedMeal,
                photo,
                phase: phase === "after" ? "after" : "before",
                mealSlot: meal.mealSlot || getMealSlot(new Date()),
                capturedAt: meal.capturedAt || new Date().toISOString(),
                locationSnapshot: meal.locationSnapshot || activeMealLocationSnapshot || null,
                photoSessionId,
                confidence: meal.confidence || normalizedMeal.confidence || "medium",
                warning: meal.warning || normalizedMeal.warning || "",
                notes: meal.notes || normalizedMeal.notes || "",
                mealPlan: meal.mealPlan || currentMealPlan || null
            };
            const projectedMeals = [...(Array.isArray(userData.dietRecords) ? userData.dietRecords : []), {
                ...draftMeal,
                kcal: draftMeal.calories
            }];
            const budget = getTodayCalorieBudgetSnapshot(projectedMeals);
            const projectedStatus = getNutritionStatusForMeals(projectedMeals, budget.left);
            const next = getNextMealSuggestion(new Date(), budget.left, projectedStatus);
            const coach = getSavedMealNutritionCoach(draftMeal, budget, next);
            const recognitionSummary = getFoodRecognitionSummary(draftMeal);
            const draft = {
                id: `auto_draft_${photoSessionId}`,
                status,
                phase: draftMeal.phase,
                photo,
                fileName,
                photoSessionId,
                savedAt: new Date().toISOString(),
                meal: {
                    ...draftMeal,
                    photo: "",
                    nextAdvice: coach.nextLine,
                    nutritionCoach: coach,
                    recognitionSummary
                },
                recognitionSummary,
                nutritionCoach: coach,
                nextAdvice: coach.nextLine,
                goal: userData.selectedTone || "slim",
                isFormalRecord: false
            };
            try {
                localStorage.setItem(getAutoMealRecordDraftKey(), JSON.stringify(draft));
                return true;
            } catch (error) {
                return false;
            }
        }

        function getAutoMealRecordDraft() {
            if (!currentUser) return null;
            const draft = safeJsonObject(localStorage.getItem(getAutoMealRecordDraftKey()));
            if (!draft?.meal || !draft?.photoSessionId) return null;
            const savedAt = Date.parse(draft.savedAt || "");
            if (!Number.isFinite(savedAt) || Date.now() - savedAt > 6 * 60 * 60 * 1000) {
                localStorage.removeItem(getAutoMealRecordDraftKey());
                return null;
            }
            return draft;
        }

        function clearActivePhotoDraft() {
            activePhotoDraft = null;
            autoSavedMealDraft = null;
            if (!currentUser) return;
            localStorage.removeItem(getPhotoDraftKey());
            localStorage.removeItem(getAutoMealRecordDraftKey());
        }

        function formatMealLocationSnapshot(snapshot = activeMealLocationSnapshot) {
            if (!snapshot || !Number.isFinite(Number(snapshot.latitude)) || !Number.isFinite(Number(snapshot.longitude))) return "";
            return `定位 ${Number(snapshot.latitude).toFixed(5)}, ${Number(snapshot.longitude).toFixed(5)}`;
        }

        function captureMealLocationSnapshot(photoSessionId = activePhotoSessionId) {
            activeMealLocationSnapshot = null;
            if (!navigator.geolocation) return Promise.resolve(null);
            return new Promise(resolve => {
                navigator.geolocation.getCurrentPosition(
                    position => {
                        if (photoSessionId !== activePhotoSessionId) return resolve(null);
                        const snapshot = {
                            latitude: Number(position.coords.latitude.toFixed(5)),
                            longitude: Number(position.coords.longitude.toFixed(5)),
                            accuracy: Math.max(0, Math.round(Number(position.coords.accuracy || 0))),
                            capturedAt: new Date().toISOString(),
                            source: "browser_geolocation"
                        };
                        activeMealLocationSnapshot = snapshot;
                        resolve(snapshot);
                    },
                    () => resolve(null),
                    { enableHighAccuracy: false, timeout: 1200, maximumAge: 900000 }
                );
            });
        }

        function autoSaveMealDraft({ phase = photoCapturePhase, photo = "", fileName = "", photoSessionId = activePhotoSessionId, meal = selectedMeal, status = "auto_saved" } = {}) {
            if (!meal || !photo || !String(photo).startsWith('data:image/')) return false;
            const saved = saveActivePhotoDraft({ phase, photo, fileName, photoSessionId, status, meal });
            const recordDraftSaved = saveAutoMealRecordDraft({ phase, photo, fileName, photoSessionId, meal, status });
            if (saved) {
                selectedMeal.autoSavedDraftAt = new Date().toISOString();
                selectedMeal.autoSavedDraftStatus = status;
                selectedMeal.autoMealRecordDraftSaved = recordDraftSaved;
                renderMealSpeedPromiseCard();
                renderEstimateSaveStatusCard();
            }
            return saved || recordDraftSaved;
        }

        function autoSaveSelectedMealDraft(status = "auto_corrected") {
            if (!selectedMeal?.photo || !String(selectedMeal.photo).startsWith('data:image/')) return false;
            const mealForDraft = {
                ...selectedMeal,
                calories: selectedMealKcal || selectedMeal.calories,
                protein: selectedP || selectedMeal.protein,
                carbs: selectedV || selectedMeal.carbs,
                fat: selectedF || selectedMeal.fat,
                fiber: selectedFiber || selectedMeal.fiber || 0,
                sugar: selectedSugar || selectedMeal.sugar || 0,
                sodium: selectedSodium || selectedMeal.sodium || 0,
                portion: Number(selectedPortion.toFixed(2)),
                items: scaleMealItems(selectedMeal.items || [], selectedPortion)
            };
            return autoSaveMealDraft({
                phase: selectedMeal.phase === "after" ? "after" : "before",
                photo: selectedMeal.photo,
                fileName: selectedMeal.name || "",
                photoSessionId: selectedMeal.photoSessionId || activePhotoSessionId,
                meal: mealForDraft,
                status
            });
        }

        function restoreActivePhotoDraft() {
            const draft = getActivePhotoDraft();
            if (!draft) {
                showToast("沒有可恢復的照片草稿，請重新拍或從相簿選。");
                return false;
            }
            const phase = draft.phase === "after" ? "after" : "before";
            const photoSessionId = Date.now();
            activePhotoSessionId = photoSessionId;
            photoCapturePhase = phase;
            switchTabById('tab-photo');
            if (draft.mealName && !/照片|image|jpg|jpeg|png|heic|待確認/i.test(draft.mealName)) {
                const quickInput = document.getElementById('quickFoodName');
                if (quickInput && !quickInput.value.trim()) quickInput.value = draft.mealName;
            }
            if (draft.mealSnapshot && Number(draft.mealSnapshot.calories || 0) > 0) {
                showEstimateResult({ ...draft.mealSnapshot, photo: draft.photo }, draft.photo, phase, photoSessionId);
                selectedMeal.autoSavedDraftAt = draft.savedAt || new Date().toISOString();
                selectedMeal.autoSavedDraftStatus = draft.status || "restored";
                renderMealSpeedPromiseCard();
            } else {
                showPhotoPendingResult(
                    draft.photo,
                    "剛剛照片分析中斷，塔塔已恢復照片草稿；可以重新辨識，或補餐名後直接重估。",
                    phase,
                    draft.mealName || draft.fileName || "",
                    photoSessionId
                );
            }
            saveActivePhotoDraft({ ...draft, phase, photoSessionId, status: "restored", meal: draft.mealSnapshot || null });
            try { document.getElementById('estimateResult')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (error) {}
            showToast(draft.mealSnapshot ? "已恢復剛剛自動保存的餐點分析。" : "已恢復剛剛照片，可重新辨識。");
            return true;
        }

        function loadDailyStores() {
            if (!currentUser) return;
            const meals = safeJsonArray(localStorage.getItem(dailyKey('meals')));
            userData.dietRecords = [];
            userData.consumedCalories = 0;
            userData.totalProtein = 0;
            userData.totalFiber = 0;
            if (meals.length) {
                userData.dietRecords = meals.map(meal => ({
                    id: meal.id || "",
                    name: meal.name || meal.finalName || meal.foodName,
                    kcal: Number(meal.calories || meal.kcal || 0),
                    protein: Number(meal.protein || 0),
                    carbs: Number(meal.carbs || 0),
                    fat: Number(meal.fat || 0),
                    fiber: Number(meal.fiber || estimateFiberFromMeal(meal) || 0),
                    sugar: Number(meal.sugar || 0),
                    sodium: Number(meal.sodium || 0),
                    healthFlags: Array.isArray(meal.healthFlags) ? meal.healthFlags : (Array.isArray(meal.health_flags) ? meal.health_flags : []),
                    mealQuality: meal.mealQuality || meal.meal_quality || "unknown",
                    photo: meal.photo || "",
                    photoBefore: meal.photoBefore || "",
                    photoAfter: meal.photoAfter || "",
                    beforeCalories: Number(meal.beforeCalories || 0),
                    afterCalories: Number(meal.afterCalories || 0),
                    consumedCalories: Number(meal.consumedCalories || meal.calories || meal.kcal || 0),
                    consumedRatio: Number(meal.consumedRatio || 0),
                    remainingRatio: Number(meal.remainingRatio || 0),
                    comparisonNote: meal.comparisonNote || "",
                    comparisonReliable: meal.comparisonReliable !== false,
                    mealSlot: meal.mealSlot || "",
                    placeName: meal.placeName || meal.restaurantName || "",
                    placeAddress: meal.placeAddress || meal.locationName || "",
                    placeRating: Number(meal.placeRating || 0),
                    placeNote: meal.placeNote || meal.restaurantNote || "",
                    nextAdvice: meal.nextAdvice || "",
                    mealPlan: meal.mealPlan || null,
                    source: meal.source || "manual",
                    time: meal.time || "",
                    items: Array.isArray(meal.items) ? meal.items : [],
                    corrected: Boolean(meal.corrected),
                    aiResult: meal.aiResult || null
                }));
                userData.consumedCalories = userData.dietRecords.reduce((sum, meal) => sum + Number(meal.kcal || 0), 0);
                userData.totalProtein = userData.dietRecords.reduce((sum, meal) => sum + Number(meal.protein || 0), 0);
                userData.totalFiber = userData.dietRecords.reduce((sum, meal) => sum + Number(meal.fiber || 0), 0);
            }

            const savedSteps = parseInt(localStorage.getItem(dailyKey('steps')) || '', 10);
            if (!Number.isNaN(savedSteps)) userData.currentSteps = savedSteps;
            const savedWater = parseInt(localStorage.getItem(dailyKey('water')) || '', 10);
            userData.waterMl = Number.isNaN(savedWater) ? 0 : Math.max(0, savedWater);

            updateStepDisplay(userData.currentSteps);
            pendingBeforeMeal = safeJsonObject(localStorage.getItem(dailyKey('pendingBeforeMeal')));
            currentMealPlan = safeJsonObject(localStorage.getItem(dailyKey('currentMealPlan')));
            if (currentMealPlan) {
                renderSelectedDecisionCard(
                    { title: `${currentMealPlan.routeLabel || '塔塔建議'}：${currentMealPlan.foodName || '本餐計畫'}`, body: currentMealPlan.body || '照這個方向吃，拍飯前照後再用實際份量校正。' },
                    currentMealPlan.foodName || '本餐計畫',
                    currentMealPlan
                );
            }
            if (pendingBeforeMeal) {
                const alert = document.getElementById('exerciseAlert');
                alert.style.display = "block";
                alert.innerHTML = `已儲存 ${pendingBeforeMeal.mealSlot || '這餐'}餐前照。吃完再拍一張飯後照，塔塔會扣掉剩餘量估算實際吃下。`;
            }
            const photoDraft = getActivePhotoDraft();
            if (photoDraft) {
                const alert = document.getElementById('exerciseAlert');
                const phaseLabel = photoDraft.phase === "after" ? "飯後" : "飯前";
                const draftCopy = `剛剛有一張${phaseLabel}照片還沒完成儲存。<button class="mini-action-btn" onclick="restoreActivePhotoDraft()">恢復剛剛照片</button>`;
                alert.style.display = "block";
                alert.innerHTML = alert.innerHTML ? `${alert.innerHTML}<br>${draftCopy}` : draftCopy;
            }
        }

        function mealToDietRecord(meal, date = todayKeyDate()) {
            return {
                id: meal.id || "",
                name: meal.name || meal.finalName || meal.foodName || "餐點",
                kcal: Number(meal.calories || meal.kcal || 0),
                protein: Number(meal.protein || 0),
                carbs: Number(meal.carbs || 0),
                fat: Number(meal.fat || 0),
                fiber: Number(meal.fiber || estimateFiberFromMeal(meal) || 0),
                sugar: Number(meal.sugar || 0),
                sodium: Number(meal.sodium || 0),
                healthFlags: Array.isArray(meal.healthFlags) ? meal.healthFlags : (Array.isArray(meal.health_flags) ? meal.health_flags : []),
                mealQuality: meal.mealQuality || meal.meal_quality || "unknown",
                photo: meal.photo || "",
                photoBefore: meal.photoBefore || "",
                photoAfter: meal.photoAfter || "",
                beforeCalories: Number(meal.beforeCalories || 0),
                afterCalories: Number(meal.afterCalories || 0),
                consumedCalories: Number(meal.consumedCalories || meal.calories || meal.kcal || 0),
                consumedRatio: Number(meal.consumedRatio || 0),
                remainingRatio: Number(meal.remainingRatio || 0),
                comparisonNote: meal.comparisonNote || "",
                comparisonReliable: meal.comparisonReliable !== false,
                mealSlot: meal.mealSlot || "",
                nextAdvice: meal.nextAdvice || "",
                mealPlan: meal.mealPlan || null,
                source: meal.source || "manual",
                time: meal.time || "",
                date,
                items: Array.isArray(meal.items) ? meal.items : [],
                corrected: Boolean(meal.corrected),
                aiResult: meal.aiResult || null
            };
        }

        function getMealsForDate(dateKey) {
            if (!currentUser) return [];
            if (dateKey === todayKeyDate()) return userData.dietRecords || [];
            const meals = safeJsonArray(localStorage.getItem(`paipachi:${currentUser}:meals:${dateKey}`));
            return meals.map(meal => mealToDietRecord(meal, dateKey));
        }

        function shiftMemoryDate(days) {
            const base = memorySelectedDate ? new Date(`${memorySelectedDate}T00:00:00`) : new Date();
            base.setDate(base.getDate() + days);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (base > today) base.setTime(today.getTime());
            memorySelectedDate = todayKeyDate(base);
            renderTodayDiarySummary();
            refreshRecentMemoryStrip();
            fetchRemoteMealsForDate(memorySelectedDate).then(payload => {
                if (payload && Array.isArray(payload.meals)) renderTodayDiarySummary();
            });
            fetchRemoteDailyState(memorySelectedDate).then(payload => {
                if (payload && payload.state) renderTodayDiarySummary();
            });
        }

        function setMemoryDateToday() {
            memorySelectedDate = todayKeyDate();
            renderTodayDiarySummary();
            refreshRecentMemoryStrip();
            fetchRemoteMealsForDate(memorySelectedDate).then(payload => {
                if (payload && Array.isArray(payload.meals)) {
                    loadDailyStores();
                    updateUI(false);
                    renderTodayDiarySummary();
                }
            });
            fetchRemoteDailyState(memorySelectedDate).then(payload => {
                if (payload && payload.state) {
                    loadDailyStores();
                    updateUI(false);
                    renderTodayDiarySummary();
                }
            });
        }

        function openRecentMemoryDate(dateKey) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return;
            memorySelectedDate = dateKey;
            renderTodayDiarySummary();
            fetchRemoteMealsForDate(dateKey).then(payload => {
                if (payload && Array.isArray(payload.meals)) renderTodayDiarySummary();
            });
            fetchRemoteDailyState(dateKey).then(payload => {
                if (payload && payload.state) renderTodayDiarySummary();
            });
        }

        function renderRecentMemoryStrip(entries = recentMemoryDates) {
            const container = document.getElementById('recentMemoryStrip');
            if (!container) return;
            const list = Array.isArray(entries) && entries.length ? entries : buildLocalMemoryDateSummaries(10);
            if (!list.length) {
                container.innerHTML = `<div class="recent-memory-title"><strong>最近回憶</strong><span>拍第一餐後會自動出現</span></div>`;
                return;
            }
            container.innerHTML = `
                <div class="recent-memory-title"><strong>最近回憶</strong><span>${list.length} 天有紀錄</span></div>
                <div class="recent-memory-list">
                    ${list.map(entry => {
                        const active = entry.date === memorySelectedDate ? ' active' : '';
                        const date = new Date(`${entry.date}T00:00:00`);
                        const label = date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', weekday: 'short' });
                        const cover = entry.cover
                            ? `<img class="recent-memory-cover" src="${entry.cover}" alt="${label} 餐點照片">`
                            : `<div class="recent-memory-cover" aria-hidden="true"></div>`;
                        return `
                            <button class="recent-memory-card${active}" type="button" onclick="openRecentMemoryDate('${entry.date}')">
                                ${cover}
                                <div class="recent-memory-date">${label}</div>
                                <div class="recent-memory-meta">${entry.mealCount || 0} 筆餐 · ${entry.photoCount || 0} 張照片 · ${Math.round(entry.calories || 0)} kcal</div>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        function getMemorySearchDateKeys(limit = 60) {
            if (!currentUser) return [];
            const dates = new Set([todayKeyDate(), memorySelectedDate]);
            recentMemoryDates.forEach(entry => {
                const date = entry?.date || entry?.key || entry;
                if (/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) dates.add(date);
            });
            const prefix = `paipachi:${currentUser}:meals:`;
            Object.keys(localStorage)
                .filter(key => key.startsWith(prefix))
                .map(key => key.slice(prefix.length))
                .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
                .forEach(date => dates.add(date));
            return [...dates].filter(Boolean).sort().reverse().slice(0, limit);
        }

        function getMealMemorySearchText(meal = {}, dateKey = "") {
            return [
                dateKey,
                meal.name,
                meal.finalName,
                meal.mealSlot,
                meal.placeName,
                meal.restaurantName,
                meal.placeAddress,
                meal.locationName,
                meal.placeNote,
                meal.restaurantNote,
                meal.nextAdvice,
                meal.mealPlan?.foodName,
                meal.mealPlan?.routeLabel,
                ...(Array.isArray(meal.items) ? meal.items.map(item => `${item.name || ""} ${item.portion || ""}`) : [])
            ].filter(Boolean).join(" ").toLowerCase();
        }

        function searchMealMemories(query = memorySearchQuery, limit = 8) {
            const needle = String(query || "").trim().toLowerCase();
            if (!needle || !currentUser) return [];
            const results = [];
            getMemorySearchDateKeys(80).forEach(dateKey => {
                getMealsForDate(dateKey).forEach((meal, mealIndex) => {
                    if (results.length >= limit) return;
                    if (!getMealMemorySearchText(meal, dateKey).includes(needle)) return;
                    results.push({ dateKey, meal, mealIndex });
                });
            });
            return results;
        }

        function renderMemorySearchPanel() {
            const panel = document.getElementById('memorySearchPanel');
            if (!panel) return;
            const results = searchMealMemories(memorySearchQuery, 8);
            window.memorySearchRendered = results;
            const query = String(memorySearchQuery || "");
            const resultHtml = !query.trim()
                ? '<div class="memory-search-empty">輸入餐名、店名、日期或備註，例如「牛肉湯」、「可樂」、「想再去」。之後點結果就能跳回那天那餐。</div>'
                : (results.length ? `<div class="memory-search-results">${results.map((result, index) => {
                    const meal = result.meal || {};
                    const photo = meal.photoBefore || meal.photo || meal.photoAfter || "";
                    const place = formatPlaceMemory(meal);
                    const subtitle = [result.dateKey, meal.mealSlot || "餐點", place || "", meal.placeRating ? `${meal.placeRating}/5` : ""].filter(Boolean).join(" · ");
                    const safeName = escapeDataHealthText(meal.name || meal.finalName || "餐點回憶");
                    const safeSubtitle = escapeDataHealthText(subtitle);
                    const safePhoto = escapeDataHealthText(photo);
                    return `
                        <button class="memory-search-result" type="button" onclick="openMemorySearchResult(${index})">
                            ${photo ? `<img class="memory-search-thumb" src="${safePhoto}" alt="${safeName}照片">` : '<div class="memory-search-thumb" aria-hidden="true"></div>'}
                            <div>
                                <div class="memory-search-name">${safeName}</div>
                                <div class="memory-search-sub">${safeSubtitle}</div>
                            </div>
                            <div class="memory-search-kcal">${meal.kcal || meal.calories || 0} kcal</div>
                        </button>
                    `;
                }).join('')}</div>` : '<div class="memory-search-empty">目前沒有命中。可以改搜餐點、店名、日期或備註；店名也可以先在今天明細補上。</div>');
            panel.innerHTML = `
                <div class="memory-search-top">
                    <div class="memory-search-title">查找吃過什麼</div>
                    <div class="memory-search-meta">${query.trim() ? `${results.length} 筆命中` : '跨日期回憶'}</div>
                </div>
                <input id="memorySearchInput" class="memory-search-input" type="search" value="${escapeDataHealthText(query)}" placeholder="搜尋餐名、店名、日期、備註" oninput="handleMemorySearch(this.value)">
                ${resultHtml}
            `;
        }

        function handleMemorySearch(value) {
            memorySearchQuery = String(value || "");
            renderMemorySearchPanel();
            setTimeout(() => {
                const input = document.getElementById('memorySearchInput');
                if (!input) return;
                input.focus();
                try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) {}
            }, 0);
        }

        function openMemorySearchResult(index) {
            const result = Array.isArray(window.memorySearchRendered) ? window.memorySearchRendered[index] : null;
            if (!result) return false;
            const mealId = result.meal?.id || "";
            showToast(`已找到 ${result.dateKey} 的「${result.meal?.name || "餐點"}」。`);
            return goToMealMemoryDate(result.dateKey, mealId, 'todayMealLedger');
        }

        function refreshRecentMemoryStrip() {
            renderRecentMemoryStrip();
            renderMemorySearchPanel();
            fetchRemoteMealDates(10).then(entries => {
                renderRecentMemoryStrip(entries);
                renderMemorySearchPanel();
            });
        }

        async function initAuth() {
            const saved = localStorage.getItem('paipachi:currentUser');
            if (!saved || !isValidUsername(saved)) {
                localStorage.removeItem('paipachi:currentUser');
                document.getElementById('loginOverlay').style.display = "flex";
                document.getElementById('mainAppContainer').style.display = "none";
                document.getElementById('bottomNav').style.display = "none";
                return;
            }
            currentUser = saved;
            await loadUserProfile(currentUser);
            document.getElementById('loginOverlay').style.display = "none";
            if (isOnboardingDone(currentUser)) enterMainApplication();
            else launchOnboardWorkflow();
        }

        function showToast(message) {
            const toast = document.getElementById('achievementToast');
            if (!toast) { tomaBubble.innerText = message; return; }
            const messageEl = toast.querySelector('div[style*="11px"]');
            if (messageEl) messageEl.innerText = message;
            toast.classList.add('active');
            setTimeout(() => { toast.classList.remove('active'); }, 2500);
        }

        function dismissToast() {
            document.getElementById('achievementToast').classList.remove('active');
        }

        function isRunningStandalone() {
            return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
        }

        function dismissInstallNudge() {
            if (currentUser) localStorage.setItem(`paipachi:${currentUser}:installNudgeDismissed`, todayKeyDate());
            renderInstallNudgeCard();
        }

        function renderInstallNudgeCard() {
            const card = document.getElementById('installNudgeCard');
            if (!card || !currentUser) return;
            const dismissed = localStorage.getItem(`paipachi:${currentUser}:installNudgeDismissed`);
            if (isRunningStandalone() || dismissed === todayKeyDate()) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
            const isAndroid = /android/i.test(navigator.userAgent || "");
            const steps = isiOS
                ? ["點分享", "加入主畫面", "吃飯時直接開"]
                : (isAndroid ? ["點選單", "安裝 App", "吃飯時直接開"] : ["固定捷徑", "開飯前打開", "照片自動成回憶"]);
            card.classList.add('active');
            card.innerHTML = `
                <div class="install-nudge-top">
                    <div class="install-nudge-title">把 拍拍吃 放到手機主畫面</div>
                    <button class="install-nudge-close" type="button" aria-label="稍後再說" onclick="dismissInstallNudge()">×</button>
                </div>
                <div class="install-nudge-body">吃飯時不用翻連結。主畫面一點開，塔塔就接著今天的照片、熱量和下一餐建議。</div>
                <div class="install-nudge-steps">${steps.map(step => `<div class="install-nudge-step">${step}</div>`).join('')}</div>
                <div class="install-nudge-actions">
                    <button class="install-nudge-action primary" type="button" onclick="openPhotoPicker('before')">先拍一餐</button>
                    <button class="install-nudge-action" type="button" onclick="dismissInstallNudge()">今天稍後</button>
                </div>
            `;
        }

        function buildMealShareText(meal = null) {
            const meals = Array.isArray(userData.dietRecords) && userData.dietRecords.length
                ? userData.dietRecords
                : getStoredMealsForDate(todayKeyDate());
            const targetMeal = meal || meals[meals.length - 1] || {};
            const total = meals.reduce((sum, item) => sum + Number(item.kcal || item.calories || 0), 0);
            const photos = meals.reduce((sum, item) => sum + (item.photoBefore ? 1 : 0) + (item.photoAfter ? 1 : (item.photo ? 1 : 0)), 0);
            const kcal = targetMeal.kcal || targetMeal.calories || 0;
            const name = targetMeal.name || "這餐";
            const slot = targetMeal.mealSlot || getMealSlot(new Date());
            const next = shortNextAdvice(targetMeal.nextAdvice || getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories).text);
            return `我剛用 拍拍吃 記錄了${slot}「${name}」：約 ${kcal} kcal。今天已留下 ${meals.length} 餐、${photos} 張照片，共 ${total} kcal。${next ? `塔塔提醒：${next}` : "吃飯前拍一下，熱量和回憶都留下來。"} 你也可以吃飯前拍一下，讓塔塔幫你看下一餐。`;
        }

        async function shareMealRecap(mealId = "") {
            const meals = Array.isArray(userData.dietRecords) && userData.dietRecords.length
                ? userData.dietRecords
                : getStoredMealsForDate(todayKeyDate());
            const meal = mealId ? meals.find(item => item.id === mealId) : meals[meals.length - 1];
            const text = buildMealShareText(meal);
            const shareData = {
                title: "拍拍吃 吃飯紀錄",
                text,
                url: location.origin ? `${location.origin}${location.pathname}` : ""
            };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                    showToast("已打開分享。邀朋友一起吃飯前拍一下。");
                    return;
                }
            } catch (error) {
                if (error && error.name === "AbortError") return;
            }
            try {
                await navigator.clipboard.writeText(`${shareData.text}${shareData.url ? `\n${shareData.url}` : ""}`);
                showToast("分享文字已複製，可以貼給朋友。");
            } catch (error) {
                showToast("分享文字已準備好：吃飯前拍一下，讓塔塔幫你看下一餐。");
                tomaBubble.innerText = text;
            }
        }

        function buildDailyShareText(dateKey = todayKeyDate()) {
            const meals = getMealsForDate(dateKey);
            const total = meals.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0);
            const photos = meals.reduce((sum, meal) => sum + (meal.photoBefore ? 1 : 0) + (meal.photoAfter ? 1 : (meal.photo ? 1 : 0)), 0);
            const protein = meals.reduce((sum, meal) => sum + Number(meal.protein || 0), 0);
            const fiber = meals.reduce((sum, meal) => sum + Number(meal.fiber || 0), 0);
            const label = dateKey === todayKeyDate() ? "今天" : dateKey;
            const mealNames = meals.map(meal => meal.name).filter(Boolean).slice(0, 3).join("、");
            const next = meals.length
                ? shortNextAdvice([...meals].reverse().find(meal => meal.nextAdvice)?.nextAdvice || getNextMealSuggestion(new Date(), userData.targetCalories - total).text)
                : "先拍第一餐，塔塔才知道下一餐怎麼補。";
            return meals.length
                ? `我的 拍拍吃 ${label}吃飯回憶：留下 ${meals.length} 餐、${photos} 張照片，共約 ${total} kcal。蛋白質 ${protein}g、纖維 ${fiber}g。${mealNames ? `今天吃了：${mealNames}。` : ""}塔塔提醒：${next} 你也可以吃飯前拍一下，讓塔塔幫你記熱量和回憶。`
                : `我的 拍拍吃 ${label}還在等第一餐照片。吃飯前拍一下，塔塔會幫你留下照片回憶、估熱量，還會提醒下一餐怎麼吃。`;
        }

        async function shareDailyRecap(dateKey = memorySelectedDate || todayKeyDate()) {
            const text = buildDailyShareText(dateKey);
            const shareData = {
                title: "拍拍吃 今日吃飯回憶",
                text,
                url: location.origin ? `${location.origin}${location.pathname}` : ""
            };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                    showToast("已打開今日回憶分享。");
                    return;
                }
            } catch (error) {
                if (error && error.name === "AbortError") return;
            }
            try {
                await navigator.clipboard.writeText(`${shareData.text}${shareData.url ? `\n${shareData.url}` : ""}`);
                showToast("今日回憶已複製，可以貼給朋友。");
            } catch (error) {
                showToast("今日回憶分享文字已準備好。");
                tomaBubble.innerText = text;
            }
        }

        function getTataShareSnapshot(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0) + (meal.photoAfter ? 1 : 0), 0);
            const total = meals.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0);
            const feedback = getTataFeedingFeedback(status, growth);
            const next = getTodayReturnMission(status, growth).next;
            const stage = OTTER_STAGES[growth?.stage || 0] || OTTER_STAGES[0];
            const title = meals.length
                ? `今天塔塔狀態：${feedback.mood}`
                : "今天塔塔還在等第一餐";
            const body = meals.length
                ? `我今天用 拍拍吃 留下 ${meals.length} 餐、${photoCount} 張照片，共約 ${total} kcal。塔塔漂亮分 ${feedback.beautyScore}/100，下一步是「${next.title}」。`
                : "我準備用 拍拍吃 吃飯前拍一下，讓塔塔幫我記照片、估熱量，順便提醒下一餐怎麼吃。";
            return { title, body, meals, photoCount, total, feedback, next, stage, growth };
        }

        function buildTataShareText(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const snapshot = getTataShareSnapshot(status, growth);
            const streakText = snapshot.growth?.streak ? `連續 ${snapshot.growth.streak} 天，` : "";
            const stageText = snapshot.stage?.name ? `目前是「${snapshot.stage.name}」。` : "";
            return `${snapshot.title}。${streakText}${snapshot.body}${stageText} 吃飯前拍一下，照片、熱量、下一餐建議和塔塔狀態都會留下來。`;
        }

        async function shareTataStatus() {
            const text = buildTataShareText();
            const shareData = {
                title: "拍拍吃 塔塔今日狀態",
                text,
                url: location.origin ? `${location.origin}${location.pathname}` : ""
            };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                    showToast("已打開塔塔狀態分享。");
                    return;
                }
            } catch (error) {
                if (error && error.name === "AbortError") return;
            }
            try {
                await navigator.clipboard.writeText(`${shareData.text}${shareData.url ? `\n${shareData.url}` : ""}`);
                showToast("塔塔狀態已複製，可以貼給朋友。");
            } catch (error) {
                showToast("塔塔狀態分享文字已準備好。");
                tomaBubble.innerText = text;
            }
        }

        // 🌟 修復 Bug 4：分頁平滑滾動自動置頂
        function switchTab(btn, panelId) {
            const activePanel = document.getElementById(panelId);
            if (!activePanel) return false;
            document.getElementById('mainAppContainer')?.classList.remove('home-mode');
            hydrateTabPanel(panelId);
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.bottom-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll(`[data-panel="${panelId}"]`).forEach(b => b.classList.add('active'));
            if (btn) btn.classList.add('active');
            activePanel.classList.add('active');
            try { activePanel.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (error) { activePanel.scrollIntoView(); }
            if (panelId === 'tab-trend') renderTrendSummary();
            if (panelId === 'tab-diet') {
                renderTodayDiarySummary();
                refreshRecentMemoryStrip();
            }
            setTimeout(dehydrateInactiveTabs, 0);
            return true;
        }

        function switchTabById(panelId) {
            return switchTab(null, panelId);
        }

        function switchToTrend() {
            const switched = switchTab(null, 'tab-trend');
            if (!switched) return false;
            document.querySelectorAll('.bottom-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('[data-panel="tab-trend"]').forEach(b => b.classList.add('active'));
            renderTrendSummary();
            const target = document.getElementById('trendSummary') || document.getElementById('tab-trend');
            setTimeout(() => {
                try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                catch (error) { target.scrollIntoView(); }
            }, 80);
            return true;
        }

        function goToTodayMealMemory(mealId = "", sectionId = "todayMealLedger") {
            return goToMealMemoryDate(todayKeyDate(), mealId, sectionId);
        }

        function goToMealMemoryDate(dateKey = todayKeyDate(), mealId = "", sectionId = "todayMealLedger") {
            if (mealId) lastSavedMealFocusId = mealId;
            memorySelectedDate = dateKey || todayKeyDate();
            switchTabById('tab-diet');
            renderTodayDiarySummary();
            setTimeout(() => {
                const focusRow = mealId ? document.querySelector(`[data-meal-id="${mealId}"]`) : null;
                const target = focusRow || document.getElementById(sectionId) || document.getElementById('tab-diet');
                try { target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                catch (error) { target?.scrollIntoView(); }
            }, 90);
            return false;
        }

        function bindTabNavigation() {
            document.querySelectorAll('[data-panel]').forEach(button => {
                if (button.dataset.boundTab === 'true') return;
                button.dataset.boundTab = 'true';
                button.addEventListener('click', event => {
                    const panelId = event.currentTarget.dataset.panel;
                    if (!panelId) return;
                    event.preventDefault();
                    if (panelId === 'tab-trend') {
                        switchToTrend();
                        return;
                    }
                    switchTab(event.currentTarget, panelId);
                });
            });
        }

        window.switchTab = switchTab;
        window.switchTabById = switchTabById;
        window.switchToTrend = switchToTrend;

        function triggerAIEstimate() {
            showEstimateResult(selectedMeal, selectedMeal.photo || "");
            document.getElementById('modalEchoText').innerText = `"${selectedMealName}"`;
            document.getElementById('modalKcalText').innerText = `${selectedMealKcal - 40} - ${selectedMealKcal + 40}`;
            document.getElementById('badgeProtein').innerText = `蛋白質：${selectedP}g`;
            document.getElementById('badgeVeg').innerText = `碳水：${selectedV}g`;
            document.getElementById('badgeFat').innerText = `脂肪：${selectedF}g`;
            document.getElementById('estimateModal').style.display = "flex";
        }

        function estimateTypedMeal() {
            const input = document.getElementById('quickFoodName');
            const name = input.value.trim();
            if (!name) {
                showToast("先輸入餐點名稱，例如冬瓜湯。");
                return;
            }
            const estimate = estimateFoodByText(name);
            showEstimateResult(estimate, "");
            document.getElementById('manualFoodName').value = name;
            document.getElementById('manualCalories').value = estimate.calories || "";
            tomaBubble.innerText = `我先幫你估：${name} 約 ${estimate.calories} kcal。份量不一樣可以再微調。`;
        }

        function closeEstimateModal(event) {
            if (event && event.target !== document.getElementById('estimateModal')) return;
            document.getElementById('estimateModal').style.display = "none";
        }

        function closeMealPhotoModal(event) {
            if (event && event.target !== document.getElementById('mealPhotoModal')) return;
            document.getElementById('mealPhotoModal').style.display = "none";
        }

        function openPhotoSourceSheet(preferredPhase = "before") {
            const sheet = document.getElementById('photoSourceSheet');
            if (!sheet) {
                openPhotoPicker(preferredPhase === "after" ? "after" : "before");
                return;
            }
            const phase = preferredPhase === "after" ? "after" : "before";
            sheet.dataset.preferredPhase = phase;
            renderPhotoSourceSheet(phase);
            sheet.classList.add('active');
            showToast(phase === "after" ? "飯後照是可選校正，會補回同一餐。" : "飯前照會立即估熱量與營養。");
        }

        function renderPhotoSourceSheet(phase = "before") {
            const title = document.getElementById('photoSourceTitle');
            const body = document.getElementById('photoSourceBody');
            const beforeButtons = [document.getElementById('photoSourceBeforeCamera'), document.getElementById('photoSourceBeforeAlbum')].filter(Boolean);
            const afterButtons = [document.getElementById('photoSourceAfterCamera'), document.getElementById('photoSourceAfterAlbum')].filter(Boolean);
            beforeButtons.concat(afterButtons).forEach(button => button.classList.remove('primary'));
            const pending = resolveAfterPhotoTargetMeal();
            if (phase === "after") {
                beforeButtons.forEach(button => button.classList.remove('primary'));
                afterButtons.forEach(button => button.classList.add('primary'));
                setPhotoSourceOptionOrder({ afterFirst: true });
                if (title) title.innerText = pending ? `補拍 ${pending.mealSlot || "這餐"}飯後照` : "補一張飯後照";
                if (body) body.innerText = pending
                    ? `這張會補回「${pending.name || "這餐"}」，塔塔會用餐前估算和剩餘量校正實際吃下，不會當成新的一餐。`
                    : "如果剛剛忘了飯前照，也可以先保存飯後照當回憶；補餐名會讓估算更穩。";
                return;
            }
            beforeButtons.forEach(button => button.classList.add('primary'));
            setPhotoSourceOptionOrder({ afterFirst: false });
            if (title) title.innerText = currentMealPlan ? `拍「${currentMealPlan.foodName || "這餐"}」飯前照` : "開飯前，先拍這餐";
            if (body) body.innerText = currentMealPlan
                ? "塔塔已經有這餐方向，飯前照會用實際份量、容器、湯汁和醬料重新校正熱量。"
                : "飯前照拍完就會立即出熱量、營養與建議；飯後照只是可選校正，不是必要步驟。";
        }

        function setPhotoSourceOptionOrder({ afterFirst = false } = {}) {
            const beforeCamera = document.getElementById('photoSourceBeforeCamera');
            const beforeAlbum = document.getElementById('photoSourceBeforeAlbum');
            const afterCamera = document.getElementById('photoSourceAfterCamera');
            const afterAlbum = document.getElementById('photoSourceAfterAlbum');
            if (beforeCamera) beforeCamera.style.order = afterFirst ? 3 : 1;
            if (beforeAlbum) beforeAlbum.style.order = afterFirst ? 4 : 2;
            if (afterCamera) afterCamera.style.order = afterFirst ? 1 : 3;
            if (afterAlbum) afterAlbum.style.order = afterFirst ? 2 : 4;
        }

        function closePhotoSourceSheet(event = null) {
            const sheet = document.getElementById('photoSourceSheet');
            if (!sheet) return;
            if (event && event.target !== sheet) return;
            sheet.classList.remove('active');
        }

        function choosePhotoSource(mode) {
            openPhotoPicker(mode || 'before');
        }

        function getPhotoInputIdForMode(mode = "before") {
            const inputMap = {
                before: 'photoInput',
                camera: 'photoInput',
                beforeAlbum: 'photoAlbumInput',
                album: 'photoAlbumInput',
                after: 'afterPhotoInput',
                afterAlbum: 'afterPhotoAlbumInput'
            };
            return inputMap[mode] || 'photoInput';
        }

        function getPhotoPickerFallbackLabel(mode = "before") {
            const id = getPhotoInputIdForMode(mode);
            const input = document.getElementById(id);
            return input ? input.closest('label.photo-btn-label') : null;
        }

        function openPhotoPicker(mode) {
            closePhotoSourceSheet();
            document.getElementById('estimateModal').style.display = "none";
            switchTabById('tab-photo');
            const inputId = getPhotoInputIdForMode(mode);
            const input = document.getElementById(inputId);
            lastPhotoPickerRequest = { mode, inputId, at: Date.now() };
            if (!input) {
                showToast("找不到照片入口，請重新整理後再試。");
                return false;
            }
            input.value = "";
            try {
                input.click();
            } catch (error) {
                showPhotoPickerFallback(mode);
            }
            if (/album/i.test(String(mode || ""))) {
                setTimeout(() => {
                    const fresh = lastPhotoPickerRequest && lastPhotoPickerRequest.inputId === inputId && Date.now() - lastPhotoPickerRequest.at < 1800;
                    if (fresh && !(input.files && input.files.length)) showPhotoPickerFallback(mode);
                }, 1200);
            }
            return false;
        }

        function showPhotoPickerFallback(mode = "before") {
            const label = getPhotoPickerFallbackLabel(mode);
            if (label) {
                label.classList.add('awaiting');
                try { label.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) { label.scrollIntoView(); }
                setTimeout(() => label.classList.remove('awaiting'), 1800);
            }
            const album = /album/i.test(String(mode || ""));
            showToast(album ? "如果相簿沒有跳出，請點亮起的相簿按鈕再選一次。" : "如果相機沒有跳出，請點亮起的拍照按鈕再試一次。");
            return false;
        }

        function startMissedMealRecovery(slot = getMealSlot(new Date())) {
            pendingBeforeMeal = null;
            localStorage.removeItem(dailyKey('pendingBeforeMeal'));
            switchTabById('tab-photo');
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            if (quickInput && !quickInput.value.trim()) quickInput.value = `${slot}剛吃完補記`;
            if (manualInput && !manualInput.value.trim()) manualInput.value = `${slot}剛吃完補記`;
            setCoachMessage(`錯過飯前照也沒關係。現在拍一張飯後照，塔塔會先把這餐放進今天回憶；如果 AI 不確定，你補餐點名稱後我會用文字估熱量。下次同餐別再優先拍飯前照，準度會更好。`);
            openPhotoPicker('after');
        }

        function startAfterPhotoForMeal(index, event) {
            if (event) event.stopPropagation();
            const sourceRecords = getTodayMealRecordsForAfterPhoto();
            const meal = sourceRecords[index];
            if (!meal) {
                showToast("找不到今天這餐，先到今日明細確認餐點。");
                openTodayMemory();
                return false;
            }
            if (!meal.photoBefore && !meal.photo) {
                showToast("這餐沒有餐前照，飯後照會先作為回憶保存。");
            }
            pendingBeforeMeal = { ...meal, savedMealId: meal.id };
            localStorage.setItem(dailyKey('pendingBeforeMeal'), JSON.stringify(pendingBeforeMeal));
            if (meal.mealPlan) {
                currentMealPlan = { ...meal.mealPlan };
                localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
                renderSelectedDecisionCard(
                    { title: `${currentMealPlan.routeLabel || '塔塔計畫'}：${currentMealPlan.foodName || meal.name}`, body: currentMealPlan.body || '這張飯後照會補回同一餐。' },
                    currentMealPlan.foodName || meal.name,
                    currentMealPlan
                );
            }
            tomaBubble.innerText = `準備補拍 ${meal.mealSlot || '這餐'} 的飯後照。塔塔會和餐前照比對，估算實際吃下多少。`;
            renderMealFlowCard();
            renderMealSpeedPromiseCard();
            renderBottomPhotoAction();
            showToast("已選定這餐，可拍飯後照或從相簿補選。");
            openPhotoSourceSheet('after');
            return false;
        }

        function getTodayMealRecordsForAfterPhoto() {
            return Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
        }

        function getMealSlot(date = new Date()) {
            const minutes = date.getHours() * 60 + date.getMinutes();
            if (minutes >= 5 * 60 && minutes < 10 * 60 + 30) return "早餐";
            if (minutes >= 10 * 60 + 30 && minutes <= 14 * 60 + 30) return "午餐";
            if (minutes >= 17 * 60 && minutes < 21 * 60) return "晚餐";
            if (minutes >= 21 * 60 || minutes < 5 * 60) return "宵夜";
            return "點心";
        }

        function getDailyNutritionTargets() {
            const weight = Number(userData.currentWeight || 0);
            const protein = Math.max(DAILY_GUIDELINES.proteinDvG, Math.round((weight || 60) * DAILY_GUIDELINES.proteinPerKg));
            const calories = Math.max(1200, Math.round(Number(userData.targetCalories || 1750)));
            const fiber = Math.max(DAILY_GUIDELINES.fiberG, Math.round((calories / 1000) * DAILY_GUIDELINES.fiberPer1000Kcal));
            const sugarLimit = Math.round((calories * DAILY_GUIDELINES.sugarEnergyRatio) / 4);
            return {
                protein,
                fiber,
                water: DAILY_GUIDELINES.waterMl,
                calories,
                sugar: sugarLimit,
                sodium: DAILY_GUIDELINES.sodiumMg
            };
        }

        function estimateFiberFromMeal(meal) {
            const text = [
                meal?.name,
                meal?.finalName,
                meal?.foodName,
                ...(Array.isArray(meal?.items) ? meal.items.map(item => item.name) : [])
            ].filter(Boolean).join(' ');
            if (!text) return 0;
            let fiber = 0;
            if (/[沙拉生菜青菜蔬菜菠菜花椰菜菇菇瓜海帶紫菜]/.test(text)) fiber += 5;
            if (/[地瓜番薯南瓜玉米燕麥糙米全穀雜糧豆腐豆干豆類紅豆綠豆]/.test(text)) fiber += 4;
            if (/[水果蘋果香蕉芭樂莓奇異果]/.test(text)) fiber += 3;
            if (/[湯羹soup]/i.test(text) && /[青菜蔬菜菇瓜海帶紫菜]/.test(text)) fiber += 2;
            return Math.min(12, fiber);
        }

        function getNutritionStatusForMeals(meals = userData.dietRecords || [], caloriesLeft = null) {
            const targets = getDailyNutritionTargets();
            const list = Array.isArray(meals) ? meals : [];
            const proteinNow = Math.round(list.reduce((sum, meal) => sum + Number(meal.protein || 0), 0));
            const fiberNow = Math.round(list.reduce((sum, meal) => sum + Number(meal.fiber || estimateFiberFromMeal(meal) || 0), 0));
            const waterNow = Math.round(userData.waterMl || 0);
            const sugarNow = Math.round(list.reduce((sum, meal) => sum + Number(meal.sugar || 0), 0));
            const sodiumNow = Math.round(list.reduce((sum, meal) => sum + Number(meal.sodium || 0), 0));
            const totalCalories = Math.round(list.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0));
            const stepBurn = Math.round(Math.max(0, Number(userData.currentSteps || 0)) * 0.04);
            const targetCalories = Math.max(0, Math.round(Number(userData.targetCalories || 0)));
            const resolvedCaloriesLeft = caloriesLeft === null
                ? Math.max(0, targetCalories - totalCalories + stepBurn)
                : Math.max(0, Number(caloriesLeft || 0));
            return {
                targets,
                proteinNow,
                fiberNow,
                waterNow,
                sugarNow,
                sodiumNow,
                proteinGap: Math.max(0, targets.protein - proteinNow),
                fiberGap: Math.max(0, targets.fiber - fiberNow),
                waterGap: Math.max(0, targets.water - waterNow),
                sugarLeft: Math.max(0, targets.sugar - sugarNow),
                sugarOver: Math.max(0, sugarNow - targets.sugar),
                sodiumLeft: Math.max(0, targets.sodium - sodiumNow),
                sodiumOver: Math.max(0, sodiumNow - targets.sodium),
                caloriesLeft: Math.round(resolvedCaloriesLeft),
                caloriesOver: Math.max(0, totalCalories - targetCalories - stepBurn)
            };
        }

        function getNutritionStatus(caloriesLeft = userData.targetCalories - userData.consumedCalories) {
            const todayMeals = currentUser ? getStoredMealsForDate(todayKeyDate()) : [];
            const meals = todayMeals.length
                ? todayMeals.map(meal => mealToDietRecord(meal, todayKeyDate()))
                : (userData.dietRecords || []);
            const totalCalories = meals.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0);
            const stepBurn = Math.round(Math.max(0, Number(userData.currentSteps || 0)) * 0.04);
            const resolvedLeft = Math.max(0, Math.round(Number(userData.targetCalories || 0) - totalCalories + stepBurn));
            return getNutritionStatusForMeals(meals, caloriesLeft === null ? resolvedLeft : resolvedLeft);
        }

        function getNutritionPriorities(status = getNutritionStatus()) {
            const priorities = [];
            if (status.sodiumOver > 0) priorities.push({ key: "sodium", label: "先降鈉", score: 100 + status.sodiumOver / 50, reason: `鈉已超 ${status.sodiumOver}mg` });
            if (status.sugarOver > 0) priorities.push({ key: "sugar", label: "先控糖", score: 96 + status.sugarOver, reason: `糖已超 ${status.sugarOver}g` });
            if (status.caloriesOver > 0) priorities.push({ key: "calories", label: "輕量收尾", score: 92 + status.caloriesOver / 30, reason: `熱量已超 ${status.caloriesOver} kcal` });
            if (status.proteinGap >= 18) priorities.push({ key: "protein", label: "補蛋白質", score: 80 + status.proteinGap, reason: `蛋白質還差 ${status.proteinGap}g` });
            if (status.fiberGap >= 8) priorities.push({ key: "fiber", label: "補纖維", score: 72 + status.fiberGap, reason: `纖維還差 ${status.fiberGap}g` });
            if (status.waterGap >= 700) priorities.push({ key: "water", label: "先補水", score: 64 + status.waterGap / 100, reason: `水還差 ${status.waterGap}ml` });
            if (!priorities.length) priorities.push({ key: "balance", label: "均衡維持", score: 50, reason: "今天節奏還穩" });
            return priorities.sort((a, b) => b.score - a.score);
        }

        function getPrimaryNutritionPriority(status = getNutritionStatus()) {
            return getNutritionPriorities(status)[0];
        }

        function getNutritionGapDiagnosis(status = getNutritionStatus()) {
            const priorities = getNutritionPriorities(status);
            const primary = priorities[0] || { key: "balance", label: "均衡維持", reason: "今天節奏還穩" };
            const deficits = [];
            if (status.proteinGap > 0) deficits.push(`蛋白質差 ${status.proteinGap}g`);
            if (status.fiberGap > 0) deficits.push(`纖維差 ${status.fiberGap}g`);
            if (status.waterGap > 0) deficits.push(`水差 ${status.waterGap}ml`);
            if (status.sugarOver > 0) deficits.push(`糖超 ${status.sugarOver}g`);
            if (status.sodiumOver > 0) deficits.push(`鈉超 ${status.sodiumOver}mg`);
            if (status.caloriesOver > 0) deficits.push(`熱量超 ${status.caloriesOver} kcal`);
            const plateRule = primary.key === "protein"
                ? "下一餐先放一掌心蛋白質，再補兩拳蔬菜和半份主食。"
                : primary.key === "fiber"
                    ? "下一餐先把蔬菜、菇類、豆類或全穀補上，蛋白質不要漏。"
                    : primary.key === "sodium"
                        ? "下一餐走少醬少湯底，湯可以吃料但不要喝完。"
                        : primary.key === "sugar"
                            ? "下一餐飲料無糖，主食正常但甜點先延後。"
                            : primary.key === "calories"
                                ? "下一餐輕量收尾，但仍保留蛋白質避免餓到反撲。"
                                : primary.key === "water"
                                    ? "先補 300-500ml 水，再決定要吃熱食或外食。"
                                    : "維持一掌蛋白質、兩拳蔬菜、半到一拳主食。";
            return {
                primary,
                priorities,
                deficits,
                plateRule,
                baseline: `今日基準：蛋白質 ${status.targets.protein}g、纖維 ${status.targets.fiber}g、水 ${status.targets.water}ml、鈉低於 ${status.targets.sodium}mg、糖低於 ${status.targets.sugar}g。`,
                aiSees: "AI 會看食物品項、份量比例、容器大小、醬汁/湯汁、飲料種類，以及飯前飯後剩餘量；照片只是起點，最後仍以你的實際份量校正。"
            };
        }

        function getTataMealTemplates(status = getNutritionStatus(), advice = null) {
            const primary = advice?.priority || getPrimaryNutritionPriority(status);
            const kcal = Math.max(220, Math.min(750, Math.round(advice?.suggestedKcal || status.caloriesLeft || 450)));
            const cap = value => Math.max(220, Math.min(750, Math.round(value)));
            const table = {
                sodium: [
                    { title: "最穩", kcal: cap(Math.min(kcal, 520)), foodName: "茶葉蛋沙拉無糖茶", body: "茶葉蛋 2 顆 + 沙拉 + 無糖茶，醬料半包，先把鈉壓下來。", query: "低鈉 高蛋白 沙拉 茶葉蛋" },
                    { title: "最方便", kcal: cap(Math.min(kcal, 650)), foodName: "清蒸水煮便當", body: "清蒸/水煮便當，飯半碗，醬料分開，湯不要喝完。", query: "低鈉 清蒸 健康便當" },
                    { title: "想吃熱的", kcal: cap(Math.min(kcal, 500)), foodName: "豆腐青菜湯加雞胸", body: "豆腐青菜湯 + 雞胸或魚，湯底喝一半以下。", query: "低鈉 豆腐 青菜湯 雞胸" }
                ],
                sugar: [
                    { title: "最穩", kcal: cap(Math.min(kcal, 520)), foodName: "蛋豆魚蔬菜無糖飲", body: "雞蛋、豆腐或魚肉 + 兩拳青菜 + 無糖飲，先讓糖回穩。", query: "控糖 高蛋白 蔬菜餐" },
                    { title: "最方便", kcal: cap(Math.min(kcal, 620)), foodName: "舒肥雞便當半飯", body: "雞胸沙拉或舒肥雞便當，飯半份，不加甜醬。", query: "控糖 舒肥雞 便當" },
                    { title: "想開心", kcal: cap(Math.min(kcal, 650)), foodName: "無糖飲正常主餐", body: "主餐可正常吃，但甜飲改零卡或無糖，飯後補水。", query: "無糖飲 健康外食" }
                ],
                calories: [
                    { title: "最穩", kcal: 280, foodName: "清湯青菜茶葉蛋", body: "清湯 + 青菜 + 茶葉蛋，今晚收尾不硬撐。", query: "低卡 清湯 青菜 茶葉蛋" },
                    { title: "最方便", kcal: 320, foodName: "無糖豆漿茶葉蛋沙拉", body: "無糖豆漿 + 茶葉蛋 + 小沙拉，不再加甜飲。", query: "低卡 超商 無糖豆漿 茶葉蛋" },
                    { title: "想吃熱的", kcal: 350, foodName: "豆腐青菜湯", body: "豆腐青菜湯，主食先跳過或只吃兩口。", query: "低卡 豆腐 青菜湯" }
                ],
                protein: [
                    { title: "最穩", kcal, foodName: "雞胸魚豆腐半飯青菜", body: "雞胸/魚/豆腐 + 半碗飯 + 兩拳菜，先把蛋白質補起來。", query: "高蛋白 雞胸 魚 豆腐 青菜" },
                    { title: "最方便", kcal: cap(Math.min(kcal, 620)), foodName: "超商雞胸茶葉蛋地瓜", body: "超商雞胸 + 茶葉蛋 + 地瓜 + 無糖茶，快速補蛋白。", query: "超商 高蛋白 雞胸 茶葉蛋 地瓜" },
                    { title: "想吃餐廳", kcal: cap(Math.min(kcal, 700)), foodName: "烤魚定食少醬", body: "定食選烤魚/雞腿去皮，醬汁少一半，飯看熱量餘額調整。", query: "烤魚 定食 高蛋白 少醬" }
                ],
                fiber: [
                    { title: "最穩", kcal, foodName: "雙倍蔬菜豆腐蛋魚", body: "蔬菜量加倍，搭豆腐、蛋或魚，纖維和蛋白一起補。", query: "高纖 蔬菜 豆腐 蛋 魚" },
                    { title: "最方便", kcal: cap(Math.min(kcal, 560)), foodName: "沙拉地瓜茶葉蛋", body: "沙拉 + 地瓜 + 茶葉蛋，醬料半包。", query: "高纖 沙拉 地瓜 茶葉蛋" },
                    { title: "想吃餐廳", kcal: cap(Math.min(kcal, 650)), foodName: "蔬菜定食半飯", body: "越式/日式定食，主食半份、青菜加點。", query: "高纖 外食 蔬菜 定食" }
                ],
                water: [
                    { title: "最穩", kcal: cap(Math.min(kcal, 520)), foodName: "雞蛋豆腐青菜盤", body: "先喝 500ml 水，再吃雞蛋豆腐青菜盤。", query: "補水 雞蛋 豆腐 青菜" },
                    { title: "最方便", kcal: cap(Math.min(kcal, 600)), foodName: "無糖茶雞胸沙拉地瓜", body: "無糖茶 + 雞胸沙拉 + 地瓜，醬料半包。", query: "無糖茶 雞胸 沙拉 地瓜" },
                    { title: "想喝湯", kcal: cap(Math.min(kcal, 500)), foodName: "清湯加豆腐青菜", body: "清湯可以，湯底喝一半，補水但別補鈉。", query: "清湯 豆腐 青菜 低鈉" }
                ],
                balance: [
                    { title: "最穩", kcal, foodName: "塔塔均衡餐盤", body: "一掌蛋白質 + 半碗主食 + 兩拳菜，照盤子比例走。", query: "均衡餐盤 高蛋白 高纖" },
                    { title: "最方便", kcal: cap(Math.min(kcal, 650)), foodName: "健康便當無糖飲", body: "健康便當或超商雞胸組合，飲料無糖。", query: "健康便當 無糖 高蛋白" },
                    { title: "最開心", kcal: cap(Math.min(kcal, 700)), foodName: "想吃的拍照校正", body: "想吃的可以吃，但先拍照，份量由塔塔校正。", query: "健康外食 均衡 選擇" }
                ]
            };
            return table[primary.key] || table.balance;
        }

        function getNextMealSuggestion(date = new Date(), caloriesLeft = userData.targetCalories - userData.consumedCalories, statusOverride = null) {
            const hour = date.getHours();
            let slot = "明日早餐";
            let time = "07:30-09:00";
            if (hour < 10) { slot = "午餐"; time = "12:00-13:30"; }
            else if (hour < 14) { slot = "點心"; time = "15:30-16:30"; }
            else if (hour < 17) { slot = "晚餐"; time = "18:00-19:30"; }

            const status = statusOverride || getNutritionStatus(caloriesLeft);
            const priority = getPrimaryNutritionPriority(status);
            const left = status.caloriesLeft;
            const lifeAdvice = getLifeWellnessAdvice();
            let focus = priority.label || "穩住熱量";
            let food = "半碗飯或地瓜、手掌大小蛋白質，再加一份青菜";
            if (priority.key === "sodium") {
                focus = "降鈉補水";
                food = "白開水、清蒸或水煮蛋白質、兩拳青菜；先避開湯底、滷味、泡菜和重醬料";
            } else if (priority.key === "sugar") {
                focus = "控糖回穩";
                food = "無糖飲、雞蛋/豆腐/魚肉，加蔬菜；主食半份，先不要甜點和手搖";
            } else if (priority.key === "calories" || left < 350) {
                focus = "輕量收尾";
                food = "清湯、青菜和低脂蛋白質，主食少量就好";
            } else if (priority.key === "protein") {
                focus = "補蛋白質";
                food = "雞胸、魚、蛋、豆腐或豆干，搭青菜和少量主食";
            } else if (priority.key === "fiber") {
                focus = "補纖維";
                food = "兩拳蔬菜、菇類、海帶、地瓜或糙米飯，蛋白質照放一掌心";
            } else if (priority.key === "water") {
                focus = "先補水";
                food = "先喝 300-500ml 水，再選清湯、蔬菜和低油蛋白質";
            } else if (left > 800) {
                focus = "補足能量";
                food = "一份主食、蛋白質和蔬菜，別讓熱量缺口太大";
            }
            const suggestedKcal = Math.max(220, Math.min(750, left || 250));
            const diagnosis = getNutritionGapDiagnosis(status);
            const templates = getTataMealTemplates(status, { priority, suggestedKcal });
            return {
                slot,
                time,
                food,
                focus,
                priority,
                priorities: getNutritionPriorities(status).slice(0, 3),
                diagnosis,
                lifeAdvice,
                templates,
                suggestedKcal,
                status,
                text: `下一餐建議：${slot} ${time}，主軸是${focus}，因為${priority.reason}。抓 ${suggestedKcal} kcal 左右；可以選 ${food}。${diagnosis.plateRule}${lifeAdvice.mealNudge ? ` ${lifeAdvice.summary}${lifeAdvice.mealNudge}` : ""}`
            };
        }

        function getAvoidanceText(priority) {
            const key = priority?.key || "balance";
            if (key === "sodium") return "先避開湯底喝完、泡菜、滷味、重醬料。";
            if (key === "sugar") return "先避開甜飲、甜點、勾芡甜醬。";
            if (key === "calories") return "先避開炸物、加飯、宵夜甜飲。";
            if (key === "protein") return "先避開只有澱粉的餐，記得補一掌蛋白質。";
            if (key === "fiber") return "先避開只有肉和飯，下一餐至少加兩拳蔬菜。";
            if (key === "water") return "先避開含糖飲，先補 300-500ml 水。";
            return "保持份量，不用硬餓，下一餐照盤子比例走。";
        }

        function getNextMealWindowState(advice = getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories), nowInput = new Date()) {
            const now = new Date(nowInput);
            const match = String(advice?.time || "").match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
            if (!match) {
                return { state: "later", minutesToStart: 90, minutesToEnd: 180, countdownLabel: "等等", actionLabel: "排下一餐" };
            }
            const start = new Date(now);
            start.setHours(Number(match[1]), Number(match[2]), 0, 0);
            const end = new Date(now);
            end.setHours(Number(match[3]), Number(match[4]), 0, 0);
            if (String(advice?.slot || "").includes("明日") || end.getTime() <= now.getTime() - 30 * 60000) {
                start.setDate(start.getDate() + 1);
                end.setDate(end.getDate() + 1);
            }
            const minutesToStart = Math.round((start.getTime() - now.getTime()) / 60000);
            const minutesToEnd = Math.round((end.getTime() - now.getTime()) / 60000);
            if (minutesToStart <= 0 && minutesToEnd >= 0) {
                return { state: "now", minutesToStart, minutesToEnd, countdownLabel: "現在", actionLabel: "先拍飯前照" };
            }
            if (minutesToStart <= 60) {
                return { state: "soon", minutesToStart, minutesToEnd, countdownLabel: `${Math.max(1, minutesToStart)} 分`, actionLabel: "先決定吃什麼" };
            }
            const hours = Math.floor(minutesToStart / 60);
            const mins = minutesToStart % 60;
            const label = hours >= 1 ? `${hours} 小時${mins ? ` ${mins} 分` : ""}` : `${Math.max(1, minutesToStart)} 分`;
            return { state: "later", minutesToStart, minutesToEnd, countdownLabel: label, actionLabel: "排下一餐" };
        }

        function renderMealCountdownCard(statusInput) {
            const card = document.getElementById('mealCountdownCard');
            if (!card) return;
            const status = statusInput || getNutritionStatus();
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            const windowState = getNextMealWindowState(advice, new Date());
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const hasMeals = meals.length > 0;
            const waitingAfter = meals.some(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            let title = `下一餐：${advice.slot}`;
            let body = `主軸是${advice.focus}，目標抓 ${advice.suggestedKcal} kcal。塔塔會依飯前照片看到的食物、份量、容器大小、湯汁和醬料再校正，不用快選固定份量。`;
            let primaryLabel = "排下一餐";
            let primaryAction = "startTodayRecommendedMealPlan()";
            let secondaryLabel = "塔塔幫我選";
            let secondaryAction = "openMealDecisionCoach('等等吃什麼')";
            if (windowState.state === "now") {
                title = `現在接近${advice.slot}，先拍飯前照`;
                body = `開飯倒數已到。先拍飯前照，吃完可補飯後照校正剩量；這餐完成後，塔塔會依缺蛋白質、纖維、水分、糖與鈉給下一餐建議。`;
                primaryLabel = "先拍飯前照";
                primaryAction = "openPhotoSourceSheet('before')";
            } else if (windowState.state === "soon") {
                title = `距離${advice.slot}約 ${windowState.countdownLabel}`;
                body = `可以先讓塔塔給三個方向，開飯前再拍照校正份量。今天缺口：${advice.priority?.reason || "先穩住熱量和份量"}。`;
                primaryLabel = hasMeals ? "排下一餐" : "先問塔塔";
                primaryAction = hasMeals ? "startTodayRecommendedMealPlan()" : "openMealDecisionCoach('等等吃什麼')";
            } else if (!hasMeals) {
                title = `今天第一餐，先讓塔塔有資料`;
                body = `還沒開始也沒關係。先用塔塔建議決定方向，真正熱量以飯前照辨識食物和份量後校正。`;
                primaryLabel = "先問塔塔";
                primaryAction = "openMealDecisionCoach('等等吃什麼')";
            }
            if (waitingAfter) {
                secondaryLabel = "補飯後照";
                secondaryAction = "startLatestAfterPhoto(event)";
            }
            const avoidText = getAvoidanceText(advice.priority);
            card.classList.add('active');
            card.innerHTML = `
                <div class="meal-countdown-top">
                    <div>
                        <div class="meal-countdown-kicker">開飯倒數</div>
                        <div class="meal-countdown-title">${title}</div>
                    </div>
                    <div class="meal-countdown-time"><strong>${windowState.countdownLabel}</strong><span>${advice.time}</span></div>
                </div>
                <div class="meal-countdown-body">${body} ${avoidText}</div>
                <div class="meal-countdown-grid">
                    <div class="meal-countdown-stat"><div class="label">餐別</div><div class="value">${advice.slot}</div></div>
                    <div class="meal-countdown-stat"><div class="label">建議熱量</div><div class="value">${advice.suggestedKcal} kcal</div></div>
                    <div class="meal-countdown-stat"><div class="label">這餐重點</div><div class="value">${advice.focus}</div></div>
                </div>
                <div class="meal-countdown-actions">
                    <button class="meal-countdown-action primary" type="button" onclick="${primaryAction}">${primaryLabel}</button>
                    <button class="meal-countdown-action" type="button" onclick="${secondaryAction}">${secondaryLabel}</button>
                </div>
            `;
        }

        function renderTodayDecisionBrief(statusInput) {
            const card = document.getElementById('todayDecisionBrief');
            if (!card) return;
            const status = statusInput || getNutritionStatus();
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            const priority = advice.priority || getPrimaryNutritionPriority(status);
            const templates = getTataMealTemplates(status, advice);
            const recommendation = templates[0] || { title: advice.food || advice.focus, kcal: advice.suggestedKcal, body: advice.text || "" };
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const hasMeals = meals.length > 0;
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore ? 1 : 0) + (meal.photoAfter ? 1 : (meal.photo ? 1 : 0)), 0);
            const todayLabel = new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', weekday: 'short' });
            const calorieValue = status.caloriesOver > 0 ? `超 ${status.caloriesOver}` : `${status.caloriesLeft}`;
            const calorieUnit = status.caloriesOver > 0 ? "kcal" : "kcal";
            const gapText = priority?.reason || "今天節奏還穩";
            const avoidText = getAvoidanceText(priority);
            const title = hasMeals
                ? `下一步：${advice.focus}`
                : "開飯前先拍，塔塔再幫你選";
            const body = hasMeals
                ? `今天已記 ${meals.length} 餐、${photoCount} 張照片。下一餐抓 ${advice.suggestedKcal} kcal 左右，主軸是 ${advice.focus}；按「照建議吃」只會建立方向，真正熱量仍以飯前照和份量校正，不用快選固定份量。`
                : `先拍飯前照，塔塔會看食物品項、容器大小、份量比例、湯汁和醬料；不想決定時，可先用塔塔建議建立方向，再用照片校正份量。`;
            const decisionLabel = hasMeals ? "請塔塔幫我選" : "先看三個方向";
            card.innerHTML = `
                <div class="today-decision-top">
                    <div>
                        <div class="today-decision-kicker">今日決策</div>
                        <div class="today-decision-title">${title}</div>
                    </div>
                    <div class="today-decision-time">${todayLabel}<br>${advice.slot} ${advice.time}</div>
                </div>
                <div class="today-decision-body">${body} ${avoidText}</div>
                <div class="today-decision-grid">
                    <div class="today-decision-metric${status.caloriesOver > 0 ? ' warn' : ''}">
                        <div class="label">${status.caloriesOver > 0 ? '熱量狀態' : '熱量餘額'}</div>
                        <div class="value">${calorieValue} ${calorieUnit}</div>
                    </div>
                    <div class="today-decision-metric">
                        <div class="label">最大缺口</div>
                        <div class="value">${gapText}</div>
                    </div>
                    <div class="today-decision-metric">
                        <div class="label">下一餐主軸</div>
                        <div class="value">${advice.focus}</div>
                    </div>
                </div>
                <div class="today-recommendation-row">
                    <div class="today-recommendation-chip"><span>塔塔建議</span><strong>${recommendation.title}</strong></div>
                    <div class="today-recommendation-chip"><span>目標</span><strong>${recommendation.kcal || advice.suggestedKcal} kcal</strong></div>
                    <div class="today-recommendation-chip"><span>餐別</span><strong>${advice.slot}</strong></div>
                </div>
                <div class="today-decision-actions triple">
                    <button class="today-decision-action primary" type="button" onclick="openPhotoSourceSheet('before')">飯前拍 / 選照片</button>
                    <button class="today-decision-action" type="button" onclick="startTodayRecommendedMealPlan()">照建議吃</button>
                    <button class="today-decision-action" type="button" onclick="openMealDecisionCoach('塔塔幫我選')">${decisionLabel}</button>
                </div>
            `;
        }

        function renderTodayRouteCard() {
            const card = document.getElementById('todayRouteCard');
            if (!card) return;
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const hasMeal = meals.length > 0;
            const waitingAfter = meals.some(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            const hasAfter = meals.some(meal => meal.photoAfter);
            const hasMemory = hasMeal;
            const waterOk = Number(userData.waterMl || 0) >= 1000;
            const steps = [
                {
                    title: "開飯前先拍",
                    body: hasMeal ? `已留下 ${meals.length} 餐，今天的回憶開始成形。` : "先拍第一餐，塔塔才有照片和份量基準。",
                    done: hasMeal,
                    action: "openPhotoSourceSheet('before')",
                    label: hasMeal ? "再拍一餐" : "去拍照"
                },
                {
                    title: "吃完校正或補水",
                    body: waitingAfter ? "最近一餐還能補飯後照，熱量會更接近實際吃下。" : (waterOk ? "水分節奏有接上，下一餐判斷會更穩。" : "如果暫時不補飯後照，先喝一杯水也算照顧自己。"),
                    done: hasAfter || waterOk,
                    action: waitingAfter ? "startLatestAfterPhoto(event)" : "addWater(250)",
                    label: waitingAfter ? "補飯後" : "+250ml"
                },
                {
                    title: "看回憶，問下一餐",
                    body: hasMemory ? "今日相簿會整理照片、熱量和塔塔建議。" : "等第一餐完成後，這裡會變成今天的吃飯日記。",
                    done: hasMeal,
                    action: hasMeal ? "switchTabById('tab-diet')" : "askTataCoach('等等吃什麼')",
                    label: hasMeal ? "看回憶" : "先問塔塔"
                }
            ];
            const currentIndex = Math.max(0, steps.findIndex(step => !step.done));
            const doneCount = steps.filter(step => step.done).length;
            card.innerHTML = `
                <div class="today-route-top">
                    <div class="today-route-title">今天三步，慢慢來</div>
                    <div class="today-route-meta">${doneCount} / ${steps.length}</div>
                </div>
                <div class="today-route-steps">
                    ${steps.map((step, index) => `
                        <div class="today-route-step${step.done ? ' done' : ''}${index === currentIndex && !step.done ? ' current' : ''}">
                            <div class="today-route-number">${step.done ? '✓' : index + 1}</div>
                            <div class="today-route-copy"><strong>${step.title}</strong><span>${step.body}</span></div>
                            <button class="today-route-action" type="button" onclick="${step.action}">${step.label}</button>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function startTodayRecommendedMealPlan() {
            const status = getNutritionStatus();
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            const templates = getTataMealTemplates(status, advice);
            const option = templates[0] || { title: advice.food || advice.focus, kcal: advice.suggestedKcal, body: advice.text || "" };
            currentMealPlan = {
                id: `today_rec_${Date.now()}`,
                route: "today_recommendation",
                routeLabel: "今日塔塔建議",
                foodName: option.title,
                focus: advice.focus,
                targetKcal: option.kcal || advice.suggestedKcal,
                mealSlot: advice.slot || getMealSlot(new Date()),
                time: advice.time || "",
                body: option.body,
                createdAt: new Date().toISOString()
            };
            if (currentUser) localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
            renderSelectedDecisionCard({ title: option.title, body: option.body }, currentMealPlan.foodName, currentMealPlan);
            renderTodayDecisionBrief(status);
            renderMealDecisionPathCard(status, advice);
            switchTabById('tab-photo');
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            if (quickInput) quickInput.value = currentMealPlan.foodName;
            if (manualInput) manualInput.value = currentMealPlan.foodName;
            setCoachMessage(`塔塔先幫你選「${currentMealPlan.foodName}」。這只是吃飯方向，目標約 ${currentMealPlan.targetKcal} kcal；開飯前拍照後，AI 會依實際份量、容器大小、醬料和湯汁重新校正。`);
            showToast("已建立今日建議，接著拍飯前照校正份量。");
        }

        function getNextMealSlotForHabit(date = new Date()) {
            const hour = date.getHours();
            if (hour < 10) return "早餐";
            if (hour < 14) return "午餐";
            if (hour < 17) return "點心";
            if (hour < 22) return "晚餐";
            return "早餐";
        }

        function getMealOpenTimeNudge(meals, targetSlot, currentSlot) {
            const pendingAfter = getPendingAfterPhotoMeals(meals)[0];
            if (pendingAfter) {
                const meal = pendingAfter.meal || {};
                return {
                    title: `${meal.mealSlot || "這餐"}還能補飯後照`,
                    body: `「${meal.name || "剛剛那餐"}」已經有飯前照。現在補一張飯後照，會回到同一餐，不會新增亂掉的紀錄。`,
                    label: "補這餐飯後",
                    action: `startAfterPhotoForMeal(${pendingAfter.index}, event)`,
                    secondaryLabel: "看今天明細",
                    secondaryAction: "openTodayMemory(event)",
                    primaryMainLabel: "補這餐飯後照",
                    primaryMainAction: `startAfterPhotoForMeal(${pendingAfter.index}, event)`
                };
            }
            const slotMeals = (meals || []).filter(meal => (meal.mealSlot || "餐點") === currentSlot);
            const waitingAfter = slotMeals.find(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            const currentDone = slotMeals.length > 0;
            if (waitingAfter) {
                return {
                    title: `${currentSlot}吃完了嗎？補一張更準`,
                    body: "飯後照可以扣掉剩餘量，讓今天吃下的熱量更接近真實狀況。",
                    label: "補飯後照",
                    action: "startLatestAfterPhoto(event)",
                    secondaryLabel: "先看今日回憶",
                    secondaryAction: "switchTabById('tab-diet')",
                    primaryMainLabel: "補飯後照",
                    primaryMainAction: "startLatestAfterPhoto(event)"
                };
            }
            if (!currentDone) {
                return {
                    title: `現在是${currentSlot}時間，先拍一下`,
                    body: "不用先算份量。飯前照最準；如果已經吃到一半或剛吃完，也可以先用飯後照補記，不讓今天斷掉。",
                    label: "拍飯前照",
                    action: "openPhotoPicker('before')",
                    secondaryLabel: "剛吃完補記",
                    secondaryAction: `startMissedMealRecovery('${currentSlot}')`,
                    primaryMainLabel: `拍${currentSlot} / 選照片`,
                    primaryMainAction: "openPhotoSourceSheet('before')"
                };
            }
            return {
                title: `${currentSlot}已記好，下一個重點是${targetSlot}`,
                body: "今天節奏已經接上。下一餐前再打開一次，塔塔會用新的照片更新建議。",
                label: `拍${targetSlot}`,
                action: "openPhotoSourceSheet('before')",
                secondaryLabel: "不知道吃什麼",
                secondaryAction: "openMealDecisionCoach('等等吃什麼')",
                primaryMainLabel: `拍${targetSlot} / 選照片`,
                primaryMainAction: "openPhotoSourceSheet('before')"
            };
        }

        function renderMealOpenHabitCard() {
            const card = document.getElementById('mealOpenHabitCard');
            if (!card) return;
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const slots = ["早餐", "午餐", "點心", "晚餐"];
            const currentSlot = getNextMealSlotForHabit(new Date());
            const doneSlots = new Set(meals.map(meal => meal.mealSlot || "餐點"));
            const pendingAfterItems = getPendingAfterPhotoMeals(meals);
            const pendingSlots = new Set(pendingAfterItems.map(item => item.meal.mealSlot || "餐點"));
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore ? 1 : 0) + (meal.photoAfter ? 1 : (meal.photo ? 1 : 0)), 0);
            const remainingSlots = slots.filter(slot => !doneSlots.has(slot));
            const targetSlot = remainingSlots.includes(currentSlot) ? currentSlot : (remainingSlots[0] || currentSlot);
            const nudge = getMealOpenTimeNudge(meals, targetSlot, currentSlot);
            const hasMeals = meals.length > 0;
            const title = pendingAfterItems.length
                ? `今天有 ${pendingAfterItems.length} 餐待補飯後照`
                : (hasMeals ? `今天已記 ${meals.length} 餐，下一餐繼續拍` : "這餐先拍一下，塔塔幫你記住");
            const pill = pendingAfterItems.length ? "先補更準" : (hasMeals ? `${photoCount} 張照片` : "等第一餐");
            const body = pendingAfterItems.length
                ? "先把飯後照補回原本那一餐，熱量和回憶會更準；補完再問塔塔下一餐怎麼吃。"
                : (hasMeals
                    ? `吃飯前打開 拍拍吃，今天的照片、熱量和下一餐建議都會留下來。下一個重點是 ${targetSlot}，拍一下就好，不用先算。`
                    : `不用先想熱量。開飯前拍一張，拍拍吃 會留下照片回憶、估算熱量，並告訴你下一餐怎麼補。`);
            const progress = slots.map(slot => {
                const done = doneSlots.has(slot);
                const pendingAfter = pendingSlots.has(slot);
                const isNext = !done && slot === targetSlot;
                const state = pendingAfter ? "待補" : (done ? "已記" : (isNext ? "現在" : "待拍"));
                return `<div class="meal-open-slot${done ? ' done' : ''}${pendingAfter || isNext ? ' next' : ''}">${slot}<br>${state}</div>`;
            }).join('');
            const primaryMainLabel = nudge.primaryMainLabel || (hasMeals ? `拍${targetSlot} / 選照片` : '拍照 / 從相簿選');
            const primaryMainAction = nudge.primaryMainAction || "openPhotoSourceSheet('before')";
            card.innerHTML = `
                <div class="meal-open-top">
                    <div>
                        <div class="meal-open-kicker">吃飯就打開</div>
                        <div class="meal-open-title">${title}</div>
                    </div>
                    <div class="meal-open-pill">${pill}</div>
                </div>
                <div class="meal-open-body">${body}</div>
                <div class="meal-open-nudge">
                    <div><strong>${nudge.title}</strong><span>${nudge.body}</span></div>
                    <div class="meal-open-nudge-actions">
                        <button type="button" onclick="${nudge.action}">${nudge.label}</button>
                        ${nudge.secondaryLabel ? `<button class="secondary" type="button" onclick="${nudge.secondaryAction}">${nudge.secondaryLabel}</button>` : ''}
                    </div>
                </div>
                <div class="meal-open-progress">${progress}</div>
                <div class="meal-open-launch" aria-label="10 秒開飯入口">
                    <button class="meal-open-launch-btn primary" type="button" onclick="${pendingAfterItems.length ? 'startLatestAfterPhoto(event)' : "openPhotoPicker('before')"}"><strong>${pendingAfterItems.length ? '補飯後' : '飯前拍'}</strong><span>${pendingAfterItems.length ? '回到同一餐' : '現在開相機'}</span></button>
                    <button class="meal-open-launch-btn" type="button" onclick="${pendingAfterItems.length ? "openPhotoPicker('afterAlbum')" : "openPhotoPicker('beforeAlbum')"}"><strong>選照片</strong><span>${pendingAfterItems.length ? '飯後相簿補選' : 'LINE/相簿補選'}</span></button>
                    <button class="meal-open-launch-btn" type="button" onclick="openMealDecisionCoach('等等吃什麼')"><strong>不知道吃什麼</strong><span>塔塔先給方向</span></button>
                </div>
                <div class="meal-open-actions">
                    <button class="meal-open-action primary" type="button" onclick="${primaryMainAction}">${primaryMainLabel}</button>
                    <button class="meal-open-action" type="button" onclick="openMealDecisionCoach('等等吃什麼')">不知道吃什麼</button>
                </div>
            `;
        }

        function getDailyThreeMealRhythmState(date = new Date()) {
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const slots = ["早餐", "午餐", "晚餐"];
            const currentSlot = getMealSlot(date);
            const doneSlots = new Set(meals.map(meal => meal.mealSlot || "餐點"));
            const photoSlots = new Set(meals.filter(meal => meal.photoBefore || meal.photo || meal.photoAfter).map(meal => meal.mealSlot || "餐點"));
            const completed = slots.filter(slot => doneSlots.has(slot)).length;
            const currentIndex = Math.max(0, slots.indexOf(currentSlot));
            const nextSlot = slots.find(slot => !doneSlots.has(slot) && slots.indexOf(slot) >= currentIndex) || slots.find(slot => !doneSlots.has(slot)) || "";
            const slotsState = slots.map(slot => ({
                slot,
                done: doneSlots.has(slot),
                hasPhoto: photoSlots.has(slot),
                current: slot === nextSlot,
                label: doneSlots.has(slot) ? (photoSlots.has(slot) ? "已拍照" : "已記錄") : (slot === nextSlot ? "下一餐" : "待拍")
            }));
            const allDone = completed === slots.length;
            const title = allDone ? "今天三餐都有留下" : `今天三餐節奏 ${completed}/3`;
            const body = allDone
                ? "早餐、午餐、晚餐都已進今天記憶。接下來只要補飯後照、喝水，或問塔塔明天第一餐。"
                : `${nextSlot || "下一餐"}開飯前拍一下就好。塔塔會把照片、熱量、營養師建議和下一餐方向接起來。`;
            return { slotsState, completed, nextSlot, allDone, title, body };
        }

        function renderDailyThreeMealRhythmCard() {
            const card = document.getElementById('dailyThreeMealRhythmCard');
            if (!card) return;
            const state = getDailyThreeMealRhythmState();
            const primaryAction = state.allDone ? "setTomorrowFirstMealPromise()" : "openPhotoSourceSheet('before')";
            const primaryLabel = state.allDone ? "約明天第一餐" : `拍${state.nextSlot || "下一餐"}`;
            card.innerHTML = `
                <div class="three-meal-rhythm-top">
                    <div>
                        <div class="three-meal-rhythm-kicker">三餐拍照習慣</div>
                        <div class="three-meal-rhythm-title">${state.title}</div>
                    </div>
                    <div class="three-meal-rhythm-pill">${state.completed}/3</div>
                </div>
                <div class="three-meal-rhythm-body">${state.body}</div>
                <div class="three-meal-rhythm-grid">
                    ${state.slotsState.map(item => `
                        <div class="three-meal-rhythm-slot${item.done ? ' done' : ''}${item.current ? ' next' : ''}">
                            <strong>${item.slot}</strong>
                            <span>${item.label}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="three-meal-rhythm-actions">
                    <button class="three-meal-rhythm-action primary" type="button" onclick="${primaryAction}">${primaryLabel}</button>
                    <button class="three-meal-rhythm-action" type="button" onclick="openMealDecisionCoach('等等吃什麼')">問塔塔怎麼吃</button>
                </div>
            `;
        }

        function getTomorrowPromise() {
            if (!currentUser) return null;
            return safeJsonObject(localStorage.getItem(`paipachi:${currentUser}:tomorrowMealPromise`));
        }

        function buildTomorrowPromiseFocus() {
            const status = getNutritionStatus();
            const growth = updateOtterGrowth();
            const plan = getTomorrowGrowthPlan(status, growth);
            const first = Array.isArray(plan.items) && plan.items.length ? plan.items[0] : null;
            return {
                title: first?.title || "照今天節奏拍第一餐",
                body: first?.body || "明天第一餐先拍一下，塔塔會接著今天的回憶判斷下一步。",
                xp: first?.xp || "+12",
                planTitle: plan.title || "明日讓塔塔靠近下一階",
                createdFrom: todayKeyDate()
            };
        }

        function setTomorrowFirstMealPromise() {
            if (!currentUser) return;
            const focus = buildTomorrowPromiseFocus();
            const promise = {
                date: addDaysKey(1),
                slot: "早餐",
                focus,
                createdAt: new Date().toISOString(),
                done: false
            };
            localStorage.setItem(`paipachi:${currentUser}:tomorrowMealPromise`, JSON.stringify(promise));
            renderTomorrowMealPromiseCard();
            showToast(`塔塔記住了：明天第一餐先做「${focus.title}」。`);
        }

        function clearTomorrowFirstMealPromise() {
            if (!currentUser) return;
            localStorage.removeItem(`paipachi:${currentUser}:tomorrowMealPromise`);
            renderTomorrowMealPromiseCard();
            showToast("已取消明天第一餐約定。");
        }

        function completeTomorrowMealPromiseIfDue(meal) {
            if (!currentUser || !meal) return null;
            const promise = getTomorrowPromise();
            const today = todayKeyDate();
            if (!promise || promise.done || promise.date !== today) return null;
            const completed = {
                ...promise,
                done: true,
                completedAt: new Date().toISOString(),
                completedMealId: meal.id || "",
                completedMealName: meal.name || "第一餐",
                completedMealCalories: Math.max(0, Math.round(Number(meal.calories || meal.kcal || 0)))
            };
            localStorage.setItem(`paipachi:${currentUser}:tomorrowMealPromise`, JSON.stringify(completed));
            localStorage.setItem(`paipachi:${currentUser}:lastPromiseWin:${today}`, JSON.stringify(completed));
            return completed;
        }

        function getTodayPromiseWin() {
            if (!currentUser) return null;
            return safeJsonObject(localStorage.getItem(`paipachi:${currentUser}:lastPromiseWin:${todayKeyDate()}`));
        }

        function renderTomorrowMealPromiseCard() {
            const card = document.getElementById('tomorrowMealPromiseCard');
            if (!card) return;
            const promise = getTomorrowPromise();
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const today = todayKeyDate();
            if (promise && promise.date === today && meals.length > 0 && !promise.done) completeTomorrowMealPromiseIfDue(meals[0]);
            const updated = getTomorrowPromise();
            const promiseWin = getTodayPromiseWin();
            if (promiseWin && promiseWin.date === today && promiseWin.done) {
                const focus = promiseWin.focus || {};
                card.classList.add('active');
                card.innerHTML = `
                    <div class="tomorrow-promise-top">
                        <div class="tomorrow-promise-title">昨天約好的第一餐已完成</div>
                        <div class="tomorrow-promise-meta">${focus.xp || "+12"} 已兌現</div>
                    </div>
                    <div class="tomorrow-promise-body">塔塔記得你昨天說好要「${focus.title || '先拍第一餐'}」。今天已用「${promiseWin.completedMealName || '第一餐'}」接上，約 ${promiseWin.completedMealCalories || 0} kcal。明天還可以再約一個很小的任務。</div>
                    <div class="tomorrow-promise-actions">
                        <button class="primary" type="button" onclick="setTomorrowFirstMealPromise()">再約明天第一餐</button>
                        <button type="button" onclick="openTodayMemory()">看今天回憶</button>
                    </div>
                `;
                return;
            }
            if (!updated || updated.done) {
                if (meals.length > 0) {
                    const focus = buildTomorrowPromiseFocus();
                    card.classList.add('active');
                    card.innerHTML = `
                        <div class="tomorrow-promise-top">
                            <div class="tomorrow-promise-title">明天第一餐，先約一個小任務</div>
                            <div class="tomorrow-promise-meta">${focus.xp || "回來很簡單"}</div>
                        </div>
                        <div class="tomorrow-promise-body">塔塔建議：${focus.title}。${focus.body} 明天吃第一餐時打開 拍拍吃，拍一下，今天的節奏就接得上。</div>
                        <div class="tomorrow-promise-actions">
                            <button class="primary" type="button" onclick="setTomorrowFirstMealPromise()">明天第一餐提醒我</button>
                            <button type="button" onclick="openPhotoPicker('before')">今天再拍一餐</button>
                        </div>
                    `;
                } else {
                    card.classList.remove('active');
                    card.innerHTML = "";
                }
                return;
            }
            const isDueToday = updated.date === today;
            const focus = updated.focus || buildTomorrowPromiseFocus();
            card.classList.add('active');
            card.innerHTML = `
                <div class="tomorrow-promise-top">
                    <div class="tomorrow-promise-title">${isDueToday ? '塔塔記得：今天第一餐先拍' : `已約好：${focus.title}`}</div>
                    <div class="tomorrow-promise-meta">${isDueToday ? '今天' : updated.date} ${focus.xp ? `・${focus.xp}` : ''}</div>
                </div>
                <div class="tomorrow-promise-body">${isDueToday ? `昨天約好的任務是「${focus.title}」。${focus.body} 吃第一餐前拍一下，就算完成今天最重要的一步。` : `明天第一餐任務：「${focus.title}」。${focus.body} 打開 拍拍吃 拍一下，塔塔會接著今天的回憶陪你。`}</div>
                <div class="tomorrow-promise-actions">
                    <button class="primary" type="button" onclick="openPhotoPicker('before')">${isDueToday ? '完成第一餐拍照' : '現在再拍一餐'}</button>
                    <button type="button" onclick="clearTomorrowFirstMealPromise()">取消約定</button>
                </div>
            `;
        }

        function renderPostMealDecisionBridge(meal, adviceInput) {
            const advice = typeof adviceInput === "object" && adviceInput
                ? adviceInput
                : getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories);
            const status = advice.status || getNutritionStatus();
            const priority = advice.priority || getPrimaryNutritionPriority(status);
            const templates = advice.templates || getTataMealTemplates(status, advice);
            const recommendation = templates[0] || { title: advice.food || advice.focus, foodName: advice.food || "塔塔均衡餐盤", kcal: advice.suggestedKcal, body: advice.text || "" };
            const avoidText = getAvoidanceText(priority).replace(/[。.]$/, "");
            const mealName = meal?.name || "這餐";
            const reason = priority.reason || "今天節奏還穩";
            return `
                <div class="post-meal-decision-bridge">
                    <div class="post-meal-decision-head">
                        <div class="post-meal-decision-title">吃完這餐，下一餐先排好</div>
                        <div class="post-meal-decision-time">${advice.slot} ${advice.time}</div>
                    </div>
                    <div class="post-meal-decision-body">${mealName} 已進今天紀錄。現在最重要的是「${advice.focus}」，因為${reason}。塔塔先給方向，下一餐仍要飯前拍照校正實際份量。</div>
                    <div class="post-meal-decision-grid">
                        <div class="post-meal-decision-cell"><strong>建議吃</strong><span>${shortNextAdvice(recommendation.foodName || recommendation.title)}</span></div>
                        <div class="post-meal-decision-cell"><strong>目標熱量</strong><span>${recommendation.kcal || advice.suggestedKcal} kcal</span></div>
                        <div class="post-meal-decision-cell"><strong>先避開</strong><span>${shortNextAdvice(avoidText)}</span></div>
                    </div>
                    <button class="post-meal-decision-cta" type="button" onclick="startPostMealRecommendedPlan()">幫我排下一餐，等等直接拍</button>
                </div>
            `;
        }

        function renderPostMealPlaceNudge(meal) {
            if (!meal || !meal.id) return "";
            const mealId = meal.id || "";
            const dateKey = meal.memoryDate || todayKeyDate();
            const placeName = meal.placeName || meal.restaurantName || "";
            const rating = Number(meal.placeRating || 0);
            if (placeName) {
                return `
                    <div class="post-meal-decision-bridge place-memory-nudge">
                        <div class="post-meal-decision-head">
                            <div class="post-meal-decision-title">這餐已留下地點記憶</div>
                            <div class="post-meal-decision-time">${rating ? `${rating}/5` : '可補評分'}</div>
                        </div>
                        <div class="post-meal-decision-body">已記住「${placeName}」。之後相簿會把這家店整理進回訪清單，下次可以開地圖或照這餐再吃。</div>
                        <div class="meal-open-actions" style="margin-top:10px;">
                            <button class="meal-open-action primary" type="button" onclick="openMealPlaceMap('${mealId}', '${dateKey}', event)">開地圖</button>
                            <button class="meal-open-action" type="button" onclick="selectMealRevisitPlan('${mealId}', '${dateKey}', event)">照這餐再吃</button>
                            <button class="meal-open-action" type="button" onclick="editMealPlaceMemory('${mealId}', '${dateKey}', event)">補備註</button>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="post-meal-decision-bridge place-memory-nudge">
                    <div class="post-meal-decision-head">
                        <div class="post-meal-decision-title">順手補店名，下次找得到</div>
                        <div class="post-meal-decision-time">可跳過</div>
                    </div>
                    <div class="post-meal-decision-body">這不是必填。補店名、評分或一句下次備註後，相簿會把它變成你的個人餐廳回憶，之後可開地圖回訪。</div>
                    <div class="meal-open-actions" style="margin-top:10px;">
                        <button class="meal-open-action" type="button" onclick="return quickRateMealPlace('${mealId}', '${dateKey}', 5, '想再去', event)">想再去</button>
                        <button class="meal-open-action" type="button" onclick="return quickRateMealPlace('${mealId}', '${dateKey}', 3, '普通', event)">普通</button>
                        <button class="meal-open-action" type="button" onclick="return quickRateMealPlace('${mealId}', '${dateKey}', 1, '不再去', event)">不再去</button>
                    </div>
                    <div class="meal-open-actions" style="margin-top:10px;">
                        <button class="meal-open-action primary" type="button" onclick="editMealPlaceMemory('${mealId}', '${dateKey}', event)">補店名/評分</button>
                        <button class="meal-open-action" type="button" onclick="switchTabById('tab-diet')">稍後在相簿補</button>
                    </div>
                </div>
            `;
        }

        function promptPlaceMemoryAfterSave(meal) {
            if (!meal || !meal.id || meal.placeName || meal.restaurantName) return;
            setTimeout(() => {
                if (memorySelectedDate !== todayKeyDate()) memorySelectedDate = todayKeyDate();
                openPlaceQuickEdit(meal.id, todayKeyDate());
                const hint = document.getElementById('placeQuickEditHint');
                if (hint) hint.innerText = "剛剛這餐已存好。補店名/評分是選填，但之後就能在相簿找回這家店。";
            }, 180);
        }

        function startPostMealRecommendedPlan(context = {}) {
            const meals = Array.isArray(context.projectedMeals) ? context.projectedMeals : null;
            const budget = meals ? getTodayCalorieBudgetSnapshot(meals) : null;
            const status = context.status || (meals ? getNutritionStatusForMeals(meals, budget.left) : getNutritionStatus());
            const advice = context.advice || getNextMealSuggestion(new Date(), status.caloriesLeft, status);
            const templates = advice.templates || getTataMealTemplates(status, advice);
            const option = templates[0] || { title: advice.food || advice.focus, foodName: advice.food || "塔塔均衡餐盤", kcal: advice.suggestedKcal, body: advice.text || "" };
            currentMealPlan = {
                id: `post_meal_next_${Date.now()}`,
                route: context.route || "post_meal_next",
                routeLabel: context.routeLabel || "飯後下一餐計畫",
                foodName: option.foodName || option.title || advice.food,
                focus: advice.focus,
                targetKcal: option.kcal || advice.suggestedKcal,
                mealSlot: advice.slot || getMealSlot(new Date()),
                time: advice.time || "",
                body: `${option.body || advice.text} ${getAvoidanceText(advice.priority)} 下一餐開飯前拍照，塔塔會用實際份量重新估算。`,
                createdAt: new Date().toISOString()
            };
            if (currentUser) localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
            renderSelectedDecisionCard({ title: `下一餐：${currentMealPlan.foodName}`, body: currentMealPlan.body }, currentMealPlan.foodName, currentMealPlan);
            switchTabById('tab-photo');
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            if (quickInput) quickInput.value = currentMealPlan.foodName || "";
            if (manualInput) manualInput.value = currentMealPlan.foodName || "";
            setCoachMessage(`${context.coachPrefix || "塔塔已先幫你排下一餐"}：${currentMealPlan.foodName}，目標約 ${currentMealPlan.targetKcal} kcal。等等開飯前直接拍照，我會依實際份量校正，不用快選固定份量。`);
            showToast("已建立下一餐計畫，等等直接拍。");
        }

        function startCurrentEstimateRecommendedPlan() {
            const meal = buildCurrentEstimateMealForCoach();
            if (!meal) {
                showToast("先拍照或輸入餐點，塔塔才知道下一餐要怎麼排。");
                return false;
            }
            const projectedMeals = [...(Array.isArray(userData.dietRecords) ? userData.dietRecords : []), meal];
            const budget = getTodayCalorieBudgetSnapshot(projectedMeals);
            const status = getNutritionStatusForMeals(projectedMeals, budget.left);
            const advice = getNextMealSuggestion(new Date(), budget.left, status);
            startPostMealRecommendedPlan({
                projectedMeals,
                status,
                advice,
                route: "current_estimate_next",
                routeLabel: "估算後下一餐計畫",
                coachPrefix: `塔塔已把「${meal.name || '這餐'}」先算進今天`
            });
            return false;
        }

        function renderPostMealActionCard(meal, adviceInput) {
            const card = document.getElementById('postMealActionCard');
            if (!card) return;
            if (!meal) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const advice = typeof adviceInput === "object" && adviceInput
                ? adviceInput
                : getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories);
            const avoidText = getAvoidanceText(advice.priority);
            const priorityReason = advice.priority?.reason || "今天節奏還穩";
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const isFirstMeal = meals.length <= 1;
            const photoCount = meals.reduce((sum, item) => sum + (item.photoBefore ? 1 : 0) + (item.photoAfter ? 1 : (item.photo ? 1 : 0)), 0);
            const title = isFirstMeal ? "第一餐完成，明天會更簡單" : "這餐之後";
            const body = isFirstMeal
                ? `你已經完成 拍拍吃 最重要的第一步：吃飯前打開並留下這餐。明天不用做很多事，先拍第一餐，塔塔就能延續今天的回憶和熱量節奏。`
                : `剛剛記錄了 ${meal.name || '這餐'}，下一步主軸是${advice.focus}，因為${priorityReason}。抓 ${advice.suggestedKcal} kcal 左右，可以選 ${advice.food}。`;
            const meta = isFirstMeal ? `今日 ${photoCount || 1} 張照片` : `${advice.slot} ${advice.time}`;
            const focusText = isFirstMeal ? "明天先拍第一餐" : (advice.priority?.label || advice.focus);
            card.innerHTML = `
                <div class="next-meal-plan-top">
                    <div class="next-meal-plan-title">${title}</div>
                    <div class="next-meal-plan-time">${meta}</div>
                </div>
                <div class="next-meal-plan-body">${body}</div>
                <div class="post-meal-action-grid">
                    <div class="post-meal-action-mini"><div class="label">${isFirstMeal ? '回來理由' : '優先補'}</div><div class="value">${isFirstMeal ? '看回憶和下一餐' : advice.focus}</div></div>
                    <div class="post-meal-action-mini"><div class="label">${isFirstMeal ? '下一步' : '先避開'}</div><div class="value">${isFirstMeal ? '飯後可補拍' : avoidText}</div></div>
                </div>
                ${renderPostMealDecisionBridge(meal, advice)}
                ${renderPostMealPlaceNudge(meal)}
                <div class="meal-open-actions post-meal-share-actions" style="margin-top:10px;">
                    <button class="meal-open-action primary" type="button" onclick="startLatestAfterPhoto(event)">${isFirstMeal ? '吃完補拍更準' : '飯後補拍'}</button>
                    <button class="meal-open-action" type="button" onclick="startPostMealRecommendedPlan()">${isFirstMeal ? '排下一餐' : '照建議排餐'}</button>
                    <button class="meal-open-action" type="button" onclick="askTataCoach('等等吃什麼')">${isFirstMeal ? '問塔塔' : '問塔塔'}</button>
                    <button class="meal-open-action" type="button" onclick="shareMealRecap('${meal.id || ''}')">${isFirstMeal ? '分享第一餐' : '分享這餐'}</button>
                    <button class="meal-open-action" type="button" onclick="setTomorrowFirstMealPromise()">約明天第一餐</button>
                </div>
                <div class="next-meal-plan-focus">${focusText}</div>
            `;
            card.classList.add('active');
        }

        function composeTataStateNote(reason, action) {
            return `原因：${reason} 建議：${action}`;
        }

        function buildTataDecisionOptions(advice) {
            const status = advice.status || getNutritionStatus();
            const templates = advice.templates || getTataMealTemplates(status, advice);
            return templates.map(option => `${option.title}：${option.kcal} kcal｜${option.body}`);
        }

        function buildDecisionGameMessage(advice) {
            const options = buildTataDecisionOptions(advice);
            const priorities = (advice.priorities || []).map(item => item.label).join(' > ');
            const diagnosis = advice.diagnosis || getNutritionGapDiagnosis(advice.status || getNutritionStatus());
            return `塔塔幫你三選一（判斷順序：${priorities || advice.focus}）：A ${options[0]}。B ${options[1]}。C ${options[2]}。${diagnosis.aiSees} 選完先拍飯前照；吃完可補拍校正。`;
        }

        function splitDecisionText(text) {
            const parts = String(text || '').split(/[:：]/);
            if (parts.length <= 1) return { title: String(text || '塔塔推薦'), body: '選完先拍飯前照，塔塔會用實際份量估熱量。' };
            return { title: parts.shift().trim(), body: parts.join('：').trim() };
        }

        function getDecisionOptionTags(option, advice, index = 0) {
            const tags = [];
            const priorityLabel = advice?.priority?.label || advice?.focus || "均衡";
            tags.push(priorityLabel);
            if (index === 0) tags.push("最穩");
            if (index === 1) tags.push("最快");
            if (index === 2) tags.push("保留彈性");
            const avoid = getAvoidanceText(advice?.priority).replace(/^先避開/, "避開").replace(/[。.]$/, "");
            tags.push(avoid.length > 12 ? avoid.slice(0, 12) : avoid);
            tags.push("飯前拍照校正");
            return tags.slice(0, 4);
        }

        function getDecisionPhotoCheck(priorityKey = "balance") {
            if (priorityKey === "sodium") return "湯底、醬料、泡菜/滷味有沒有入鏡";
            if (priorityKey === "sugar") return "飲料甜度、甜醬、甜點份量";
            if (priorityKey === "protein") return "肉、蛋、豆腐大小是不是一掌心";
            if (priorityKey === "fiber") return "蔬菜、菇類、全穀佔盤面多少";
            if (priorityKey === "water") return "湯品鹹度與飲料是不是無糖";
            if (priorityKey === "calories") return "主食和油炸/醬汁實際份量";
            return "整份餐、容器大小、醬汁和主食比例";
        }

        function getDecisionOptionDetail(option, advice, index = 0) {
            const status = advice?.status || getNutritionStatus();
            const diagnosis = advice?.diagnosis || getNutritionGapDiagnosis(status);
            const priority = advice?.priority || diagnosis.primary || getPrimaryNutritionPriority(status);
            const deficits = diagnosis.deficits.length ? diagnosis.deficits.slice(0, 3).join("、") : "目前節奏穩，維持均衡餐盤";
            const why = index === 0
                ? `最穩先處理：${priority.label}。${deficits}`
                : index === 1
                    ? `最快可執行：不用想太久，仍照 ${priority.label} 補。`
                    : `保留彈性：想吃外食也可以，但先避開 ${getAvoidanceText(priority).replace(/^先避開/, "")}`;
            const next = index === 0
                ? `目標約 ${advice?.suggestedKcal || option.kcal || 450} kcal，吃前拍照後再校正。`
                : index === 1
                    ? "直接帶去點餐，照片會確認份量，不用快選固定份。"
                    : "適合不知道想吃什麼時先選方向，再用照片修正。";
            return {
                why,
                photoCheck: getDecisionPhotoCheck(priority.key),
                next
            };
        }

        function renderDecisionOptionDetails(option, advice, index = 0) {
            const detail = getDecisionOptionDetail(option, advice, index);
            return `
                <div class="decision-card-reasons">
                    <div class="decision-card-reason"><strong>今日理由</strong>${detail.why}</div>
                    <div class="decision-card-reason"><strong>照片確認</strong>${detail.photoCheck}</div>
                    <div class="decision-card-reason"><strong>下一步</strong>${detail.next}</div>
                </div>
            `;
        }

        function getMealDecisionMemory(meal = {}) {
            const plan = meal.mealPlan || {};
            const detail = plan.decisionDetail || {};
            if (!plan.routeLabel && !detail.why && !detail.photoCheck) return null;
            return {
                title: plan.routeLabel || "塔塔建議",
                focus: plan.focus || "均衡",
                targetKcal: plan.targetKcal || "",
                why: detail.why || plan.body || "",
                photoCheck: detail.photoCheck || "",
                next: detail.next || ""
            };
        }

        function renderDecisionSummary(advice) {
            const status = advice?.status || getNutritionStatus();
            const avoidText = getAvoidanceText(advice?.priority);
            const priorities = (advice?.priorities || []).map(item => item.label).slice(0, 3).join(" > ") || advice?.focus || "均衡";
            const diagnosis = advice?.diagnosis || getNutritionGapDiagnosis(status);
            return `
                <div class="decision-summary">
                    <div class="decision-summary-title">塔塔幫你做選擇</div>
                    <div class="decision-summary-body">下一餐抓 ${advice?.suggestedKcal || 450} kcal 左右，先補 ${advice?.focus || "均衡餐盤"}。${diagnosis.baseline} 目前 ${diagnosis.deficits.join("、") || "沒有明顯缺口"}。</div>
                    <div class="decision-summary-tags">
                        <span class="decision-summary-tag">判斷順序：${priorities}</span>
                        <span class="decision-summary-tag">先避開：${avoidText}</span>
                        <span class="decision-summary-tag">AI 看份量/容器/醬汁/飯後剩量</span>
                    </div>
                </div>
            `;
        }

        function renderDecisionActionBridge(advice) {
            const status = advice?.status || getNutritionStatus();
            const options = buildTataDecisionOptions(advice);
            const first = splitDecisionText(options[0] || "塔塔推薦：均衡餐盤");
            const foodName = getDecisionFoodName(first);
            const avoidText = getAvoidanceText(advice?.priority);
            const priority = advice?.priority || getPrimaryNutritionPriority(status);
            return `
                <div class="decision-action-bridge">
                    <div class="decision-action-top">
                        <div class="decision-action-title">塔塔先排這餐：${foodName}</div>
                        <div class="decision-action-budget">${advice?.suggestedKcal || 450} kcal</div>
                    </div>
                    <div class="decision-action-body">不想決定就先走這個方向：${first.body || advice?.food || "一掌蛋白質、兩拳蔬菜、半份主食"}。重點是先補 ${advice?.focus || priority.label}；${avoidText} 等等開飯前拍照，熱量會依實際份量校正。</div>
                    <div class="decision-action-grid">
                        <div class="decision-action-stat"><strong>${priority.label}</strong><span>優先處理</span></div>
                        <div class="decision-action-stat"><strong>${status.caloriesLeft}</strong><span>今日剩 kcal</span></div>
                        <div class="decision-action-stat"><strong>${advice?.slot || getMealSlot(new Date())}</strong><span>${advice?.time || "下一餐"}</span></div>
                    </div>
                    <div class="decision-action-actions">
                        <button class="decision-action-btn primary" type="button" onclick="selectTataDecisionAndOpen(0)">塔塔直接幫我選</button>
                        <button class="decision-action-btn" type="button" onclick="askTataCoach('找附近餐廳')">找附近可吃的</button>
                    </div>
                </div>
            `;
        }

        function renderDecisionRadar(advice) {
            const status = advice?.status || getNutritionStatus();
            const priority = advice?.priority || getPrimaryNutritionPriority(status);
            const diagnosis = advice?.diagnosis || getNutritionGapDiagnosis(status);
            const templates = advice?.templates || getTataMealTemplates(status, advice);
            const best = templates[0] || { foodName: advice?.food || "塔塔均衡餐盤", body: advice?.text || "照盤子比例走。" };
            const second = templates[1] || templates[0] || best;
            const avoid = getAvoidanceText(priority);
            const photoCheck = priority.key === "sodium"
                ? "拍到湯底、醬料和加工品，塔塔才知道鈉風險。"
                : priority.key === "sugar"
                    ? "拍到飲料、甜醬和甜點，塔塔會把糖算進去。"
                    : priority.key === "protein"
                        ? "拍到肉、蛋、豆腐大小，塔塔會確認蛋白質份量。"
                        : priority.key === "fiber"
                            ? "拍到蔬菜、菇類、全穀比例，塔塔會看纖維。"
                            : "拍到整份餐和容器，塔塔會依實際份量校正。";
            return `
                <div class="decision-radar">
                    <div class="decision-radar-top">
                        <div class="decision-radar-title">塔塔決策雷達</div>
                        <div class="decision-radar-meta">${priority.label}</div>
                    </div>
                    <div class="decision-radar-grid">
                        <div class="decision-radar-item primary"><strong>先補：${priority.label}</strong><span>${priority.reason}。${diagnosis.plateRule}</span></div>
                        <div class="decision-radar-item"><strong>建議吃法</strong><span>${best.foodName || best.title}，${best.body}</span></div>
                        <div class="decision-radar-item"><strong>備案選擇</strong><span>${second.foodName || second.title}，不想決定時選這個也可以。</span></div>
                        <div class="decision-radar-item"><strong>照片確認</strong><span>${avoid} ${photoCheck}</span></div>
                    </div>
                </div>
            `;
        }

        function renderNextMealDecisionPanel(advice, hasMeals = false) {
            const status = advice?.status || getNutritionStatus();
            const options = buildTataDecisionOptions(advice);
            const marks = ['A', 'B', 'C'];
            const priorities = (advice?.priorities || []).map(item => item.label).slice(0, 3).join(" > ") || advice?.focus || "均衡";
            const optionCards = options.map((text, index) => {
                const option = splitDecisionText(text);
                const tags = getDecisionOptionTags(option, advice, index);
                return `
                    <button class="decision-card" type="button" onclick="selectTataDecision(${index})">
                        <div class="decision-card-top">
                            <span class="decision-card-mark">${marks[index]}</span>
                            <span class="decision-card-title">${option.title}</span>
                            <span class="decision-card-kcal">${advice?.focus || '拍照校正'}</span>
                        </div>
                        <div class="decision-card-body">${option.body}</div>
                        <div class="decision-card-tags">${tags.map(tag => `<span class="decision-card-tag">${tag}</span>`).join('')}</div>
                        ${renderDecisionOptionDetails(option, advice, index)}
                        <div class="decision-card-action">選這個，帶去飯前拍</div>
                    </button>
                `;
            }).join('');
            window.tataLastDecisionOptions = options;
            return `
                <div class="next-meal-plan-top">
                    <div class="next-meal-plan-title">${hasMeals ? '這餐之後，塔塔幫你決定' : '今天第一餐，塔塔幫你決定'}</div>
                    <div class="next-meal-plan-time">${advice.slot} ${advice.time}</div>
                </div>
                <div class="next-meal-plan-body">下一餐抓 ${advice.suggestedKcal} kcal 左右，先處理「${advice.focus}」。判斷順序：${priorities}。AI 拍照會再依實際份量校正，不用快選固定份量。</div>
                ${renderDecisionActionBridge(advice)}
                ${renderDecisionRadar(advice)}
                <div class="next-meal-baseline">
                    <span>蛋白 ${status.proteinNow}/${status.targets.protein}g</span>
                    <span>纖維 ${status.fiberNow}/${status.targets.fiber}g</span>
                    <span>水 ${status.waterNow}/${status.targets.water}ml</span>
                    <span>糖剩 ${status.sugarLeft}g</span>
                    <span>鈉剩 ${status.sodiumLeft}mg</span>
                    <span>熱量剩 ${status.caloriesLeft} kcal</span>
                </div>
                <div class="next-meal-decision-grid">${optionCards}</div>
                <div class="next-meal-plan-focus">官方基準：${DAILY_GUIDELINES.sourceNote}。${(advice.diagnosis || getNutritionGapDiagnosis(status)).aiSees}</div>
            `;
        }

        function getMealDecisionPaths(status = getNutritionStatus(), advice = getNextMealSuggestion(new Date(), status.caloriesLeft)) {
            const priority = advice.priority || getPrimaryNutritionPriority(status);
            const homeMap = {
                protein: ["豆腐蛋花湯 + 半碗飯 + 青菜", "蛋白質優先，煮起來快，油和鈉都比較好控。"],
                fiber: ["菇菇青菜豆腐鍋 + 地瓜", "纖維先補起來，主食用地瓜或全穀更穩。"],
                water: ["清湯豆腐青菜碗", "想喝湯可以，但湯底不要太鹹，先補水分。"],
                sodium: ["蒸蛋 + 燙青菜 + 白飯半碗", "今天鈉偏高，明天或下一餐先把醬料和湯底降下來。"],
                sugar: ["雞蛋豆腐蔬菜盤 + 無糖茶", "糖先收住，保留飽足感但不要再加甜飲。"],
                calories: ["清湯 + 茶葉蛋 + 小沙拉", "熱量接近收尾，用輕量但有蛋白質的組合。"]
            };
            const outMap = {
                protein: ["雞胸/烤魚便當，飯半碗", "外食直接找一掌蛋白質，醬汁分開。"],
                fiber: ["健康便當加菜，飯半碗", "菜量加倍，主食不要全拿掉，血糖比較穩。"],
                water: ["湯品可吃料，搭無糖茶", "可以喝熱的，但湯底喝一半以下。"],
                sodium: ["清蒸/烤物便當，少醬少湯", "避開滷味、泡菜湯、拉麵湯和重醬。"],
                sugar: ["定食 + 無糖飲", "甜飲先換掉，主餐正常吃比較能持續。"],
                calories: ["小份定食或沙拉加蛋", "收尾餐不空腹硬撐，避免晚上暴食。"]
            };
            const mapKey = homeMap[priority.key] ? priority.key : "protein";
            const [homeTitle, homeBody] = homeMap[mapKey];
            const [outTitle, outBody] = outMap[mapKey];
            return [
                { route: "home", title: "在家煮", focus: advice.focus, foodName: homeTitle, body: `${homeTitle}。${homeBody}`, followup: "找健康食譜" },
                { route: "eatout", title: "外食點", focus: `${advice.suggestedKcal} kcal`, foodName: outTitle, body: `${outTitle}。${outBody}`, followup: "塔塔幫我選" },
                { route: "nearby", title: "附近找", focus: "地圖", foodName: `${advice.focus}附近餐廳`, body: `找附近符合「${advice.focus}」的餐廳；到店後先拍飯前照，份量交給 AI 校正。`, followup: "找附近餐廳" }
            ];
        }

        function renderMealDecisionPathCard(status, adviceInput = null) {
            const card = document.getElementById('mealDecisionPathCard');
            if (!card) return;
            const advice = adviceInput || getNextMealSuggestion(new Date(), status.caloriesLeft);
            const paths = getMealDecisionPaths(status, advice);
            window.tataMealDecisionPaths = paths;
            const priorityText = (advice.priorities || []).map(item => item.label).slice(0, 3).join(" > ") || advice.focus;
            card.innerHTML = `
                <div class="meal-path-top">
                    <div class="meal-path-title">不想決定？塔塔給三條路</div>
                    <div class="meal-path-meta">${advice.slot} ${advice.time}</div>
                </div>
                <div class="meal-path-body">依今天缺口先排「${priorityText}」。你只要選一條路，吃前拍照，熱量和份量再校正。</div>
                <div class="meal-path-grid">
                    ${paths.map((path, index) => `
                        <button class="meal-path-option${currentMealPlan?.route === path.route ? ' selected' : ''}" type="button" onclick="selectMealDecisionPath(${index})">
                            <div class="meal-path-option-top"><strong>${path.title}</strong><em>${path.focus}</em></div>
                            <span>${path.body}</span>
                        </button>
                    `).join('')}
                </div>
            `;
            card.classList.add('active');
        }

        function selectMealDecisionPath(index) {
            const status = getNutritionStatus();
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            const paths = Array.isArray(window.tataMealDecisionPaths) && window.tataMealDecisionPaths.length
                ? window.tataMealDecisionPaths
                : getMealDecisionPaths(status, advice);
            const path = paths[index] || paths[0];
            if (!path) return;
            currentMealPlan = {
                id: `plan_${Date.now()}`,
                route: path.route,
                routeLabel: path.title,
                foodName: path.foodName || path.title,
                focus: advice.focus,
                targetKcal: advice.suggestedKcal,
                mealSlot: advice.slot || getMealSlot(new Date()),
                time: advice.time || "",
                body: path.body,
                createdAt: new Date().toISOString()
            };
            if (currentUser) localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
            const option = { title: `${path.title}：${currentMealPlan.foodName}`, body: path.body };
            renderSelectedDecisionCard(option, currentMealPlan.foodName, currentMealPlan);
            renderMealDecisionPathCard(status, advice);
            switchTabById('tab-photo');
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            if (quickInput) quickInput.value = currentMealPlan.foodName;
            if (manualInput) manualInput.value = currentMealPlan.foodName;
            setCoachMessage(`已選「${path.title}」。這餐先照「${currentMealPlan.foodName}」走，目標約 ${currentMealPlan.targetKcal} kcal；拍飯前照後，AI 會用實際份量校正，不會用固定份量。`);
            if (path.followup === "找健康食譜") renderRecipeCards(getRecipeOptions(status));
            else hideRecipeCards();
            if (path.followup === "找附近餐廳") requestNearbyRestaurants(advice);
            else hideNearbyRestaurantCards();
            showToast("本餐計畫已建立，接著拍飯前照。");
        }

        function renderTataDecisionCards(advice) {
            const container = document.getElementById('tataDecisionCards');
            if (!container) return;
            const options = buildTataDecisionOptions(advice);
            const marks = ['A', 'B', 'C'];
            const meta = advice?.focus || '拍照校正';
            container.style.display = 'grid';
            container.innerHTML = renderDecisionActionBridge(advice) + renderDecisionSummary(advice) + renderDecisionRadar(advice) + options.map((text, index) => {
                const option = splitDecisionText(text);
                const tags = getDecisionOptionTags(option, advice, index);
                return `
                    <button class="decision-card" type="button" onclick="selectTataDecision(${index})">
                        <div class="decision-card-top">
                            <span class="decision-card-mark">${marks[index]}</span>
                            <span class="decision-card-title">${option.title}</span>
                            <span class="decision-card-kcal">${meta}</span>
                        </div>
                        <div class="decision-card-body">${option.body}</div>
                        <div class="decision-card-tags">${tags.map(tag => `<span class="decision-card-tag">${tag}</span>`).join('')}</div>
                        ${renderDecisionOptionDetails(option, advice, index)}
                        <div class="decision-card-action">選這個，去飯前拍</div>
                    </button>
                `;
            }).join('');
            window.tataLastDecisionOptions = options;
        }

        function hideTataDecisionCards() {
            const container = document.getElementById('tataDecisionCards');
            if (!container) return;
            container.style.display = 'none';
            container.innerHTML = '';
        }

        function hideNearbyRestaurantCards() {
            const container = document.getElementById('nearbyRestaurantCards');
            if (!container) return;
            container.style.display = 'none';
            container.innerHTML = '';
        }

        function hideRecipeCards() {
            const container = document.getElementById('recipeCards');
            if (!container) return;
            container.style.display = 'none';
            container.innerHTML = '';
        }

        function getRecipeOptions(status = getNutritionStatus()) {
            if (status.sodiumOver > 0) {
                return [
                    { title: "番茄豆腐雞肉湯", query: "番茄 豆腐 雞肉湯 低鈉 食譜", focus: "低鈉補蛋白", body: "用番茄、豆腐、雞肉撐味道，少鹽少醬，湯底不用喝完。" },
                    { title: "清蒸魚蔬菜盤", query: "清蒸魚 蔬菜 低鈉 食譜", focus: "低鈉清爽", body: "用蔥薑蒜和檸檬提味，主食半碗，幫塔塔消腫。" },
                    { title: "菇菇蛋花青菜湯", query: "菇菇 蛋花 青菜湯 低鈉 食譜", focus: "補水纖維", body: "菇類和青菜提高纖維，蛋花補蛋白，鹽先少放。" }
                ];
            }
            if (status.sugarOver > 0) {
                return [
                    { title: "雞胸花椰菜溫沙拉", query: "雞胸 花椰菜 溫沙拉 控糖 食譜", focus: "控糖補蛋白", body: "避開甜醬，用橄欖油、檸檬、胡椒調味。" },
                    { title: "豆腐炒蛋青菜盤", query: "豆腐 炒蛋 青菜 控糖 食譜", focus: "穩血糖", body: "蛋白質先補足，主食半份，不再加含糖飲。" },
                    { title: "鮭魚菇菇蔬菜盤", query: "鮭魚 菇菇 蔬菜 控糖 食譜", focus: "高飽足", body: "油脂天然但份量控制，配兩拳蔬菜。" }
                ];
            }
            if (status.proteinGap >= 18) {
                return [
                    { title: "雞胸番茄蛋飯", query: "雞胸 番茄 蛋 高蛋白 食譜", focus: "補蛋白", body: "一掌雞胸加蛋，飯半到一碗，適合訓練日。" },
                    { title: "豆腐鮪魚蔬菜碗", query: "豆腐 鮪魚 蔬菜碗 高蛋白 食譜", focus: "快手", body: "不用大煮，豆腐、鮪魚、蔬菜直接組合。" },
                    { title: "烤魚地瓜青菜盤", query: "烤魚 地瓜 青菜 高蛋白 食譜", focus: "均衡", body: "魚補蛋白，地瓜補主食，青菜補纖維。" }
                ];
            }
            if (status.fiberGap >= 8) {
                return [
                    { title: "地瓜雞胸蔬菜碗", query: "地瓜 雞胸 蔬菜碗 高纖 食譜", focus: "補纖維", body: "地瓜和兩拳蔬菜補纖維，雞胸補蛋白。" },
                    { title: "菇菇豆腐糙米飯", query: "菇菇 豆腐 糙米 高纖 食譜", focus: "全穀豆類", body: "糙米半碗，菇類加量，蛋白質用豆腐補。" },
                    { title: "海帶芽蛋花湯配飯", query: "海帶芽 蛋花湯 高纖 食譜", focus: "輕量補菜", body: "湯走清淡，配半碗飯或地瓜。" }
                ];
            }
            return [
                { title: "塔塔均衡餐盤", query: "健康 均衡餐盤 高蛋白 高纖 食譜", focus: "均衡", body: "一掌蛋白質、兩拳蔬菜、半到一拳主食。" },
                { title: "番茄雞蛋豆腐鍋", query: "番茄 雞蛋 豆腐鍋 健康 食譜", focus: "舒服熱食", body: "湯底清爽，蛋白質夠，適合晚餐。" },
                { title: "烤魚蔬菜糙米碗", query: "烤魚 蔬菜 糙米碗 健康 食譜", focus: "穩定飽足", body: "主食、蛋白質、纖維都有，適合不知道吃什麼。" }
            ];
        }

        function buildRecipeSearchUrl(query) {
            return `https://www.google.com/search?q=${encodeURIComponent(`${query} 最新`)}`;
        }

        function renderRecipeCards(options) {
            const container = document.getElementById('recipeCards');
            if (!container) return;
            container.style.display = 'grid';
            container.innerHTML = options.map(option => `
                <a class="recipe-card" href="${buildRecipeSearchUrl(option.query)}" target="_blank" rel="noopener noreferrer">
                    <div class="recipe-card-top">
                        <span class="recipe-card-title">${option.title}</span>
                        <span class="recipe-card-focus">${option.focus}</span>
                    </div>
                    <div class="recipe-card-body">${option.body}</div>
                    <div class="recipe-card-action">搜尋最新做法</div>
                </a>
            `).join('');
        }

        function getNearbyRestaurantOptions(status = getNutritionStatus()) {
            if (status.sodiumOver > 0) {
                return [
                    { title: "清蒸健康便當", query: "清蒸 健康便當", focus: "低鈉", body: "飯半碗、醬料分開，避開滷汁和湯底。" },
                    { title: "日式烤魚定食", query: "日式 烤魚 定食", focus: "少醬", body: "選烤魚或雞肉，味噌湯少喝，醬汁少一半。" },
                    { title: "沙拉碗加蛋白質", query: "沙拉碗 雞胸 豆腐", focus: "補水纖維", body: "醬料半份，搭無糖飲，幫塔塔消腫。" }
                ];
            }
            if (status.sugarOver > 0) {
                return [
                    { title: "健康便當", query: "健康便當 雞胸", focus: "控糖", body: "主食半份、飲料無糖，蛋白質照放。" },
                    { title: "沙拉碗", query: "沙拉碗 雞胸", focus: "補纖維", body: "加蛋或豆腐，醬料另外放。" },
                    { title: "日式定食", query: "日式 定食 烤魚", focus: "穩血糖", body: "選烤物，不加甜醬，飯半碗。" }
                ];
            }
            if (status.proteinGap >= 18) {
                return [
                    { title: "雞胸健康便當", query: "雞胸 健康便當", focus: "補蛋白", body: "一掌蛋白質、兩拳菜，飯半到一碗看熱量餘額。" },
                    { title: "烤魚定食", query: "烤魚 定食", focus: "補蛋白", body: "優先烤魚、烤雞，醬汁少一半。" },
                    { title: "豆腐鍋清湯", query: "豆腐鍋 清湯", focus: "熱食", body: "清湯、少喝湯底，主食半份。" }
                ];
            }
            if (status.fiberGap >= 8) {
                return [
                    { title: "沙拉碗", query: "沙拉碗", focus: "補纖維", body: "加雞胸、蛋或豆腐，醬料半份。" },
                    { title: "蔬食便當", query: "蔬食 健康便當", focus: "補蔬菜", body: "注意蛋白質要補到，豆腐蛋類優先。" },
                    { title: "越式河粉", query: "越式 河粉", focus: "清爽", body: "湯少喝，青菜加量，主食正常即可。" }
                ];
            }
            return [
                { title: "健康便當", query: "健康便當", focus: "均衡", body: "蛋白質一掌、菜兩拳、飯半到一碗。" },
                { title: "日式定食", query: "日式 定食", focus: "好執行", body: "選烤魚或雞肉，醬汁少一半。" },
                { title: "沙拉碗", query: "沙拉碗", focus: "輕量", body: "加蛋白質，不要只吃菜。" }
            ];
        }

        function buildMapsUrl(query, coords) {
            const fullQuery = coords
                ? `${query} near ${coords.latitude},${coords.longitude}`
                : `${query} 附近`;
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;
        }

        function buildPlaceMapsUrl(place = {}) {
            const query = [place.name, place.address].filter(Boolean).join(" ");
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || place.name || "餐廳")}`;
        }

        function openMealPlaceMap(mealId, dateKey = memorySelectedDate || todayKeyDate(), event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const meals = getMealsForDate(dateKey);
            const meal = meals.find(item => item.id === mealId);
            if (!meal) {
                showToast("找不到這餐，先重新整理回憶。");
                return false;
            }
            const name = meal.placeName || meal.restaurantName || "";
            const address = meal.placeAddress || meal.locationName || "";
            if (!name && !address) {
                showToast("先補店名，塔塔才知道要帶你去哪。");
                return openPlaceQuickEdit(mealId, dateKey, event);
            }
            const url = buildPlaceMapsUrl({ name, address });
            window.open(url, "_blank", "noopener,noreferrer");
            showToast("已開啟地圖回訪。");
            return false;
        }

        function selectMealRevisitPlan(mealId, dateKey = memorySelectedDate || todayKeyDate(), event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const meals = getMealsForDate(dateKey);
            const meal = meals.find(item => item.id === mealId);
            if (!meal) {
                showToast("找不到這餐，先重新整理回憶。");
                return false;
            }
            const status = getNutritionStatus();
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            const foodName = meal.name || meal.finalName || "回訪餐點";
            const placeName = meal.placeName || meal.restaurantName || "";
            const placeAddress = meal.placeAddress || meal.locationName || "";
            const targetKcal = Math.max(120, Math.round(Number(meal.kcal || meal.calories || advice.suggestedKcal || 450)));
            currentMealPlan = {
                id: `meal_revisit_${Date.now()}`,
                route: "meal_revisit",
                routeLabel: placeName ? `回訪 ${placeName}` : "照回憶再吃",
                foodName,
                focus: advice.focus,
                targetKcal,
                mealSlot: advice.slot || getMealSlot(new Date()),
                time: advice.time || "",
                body: `${dateKey} 吃過「${foodName}」，上次約 ${targetKcal} kcal。這次先照這個方向點，飯前拍照後塔塔會依實際份量重新校正。${meal.placeNote || meal.restaurantNote ? ` 上次備註：${meal.placeNote || meal.restaurantNote}` : ""}`,
                placeName,
                placeAddress,
                sourceMealId: mealId,
                sourceDate: dateKey,
                createdAt: new Date().toISOString()
            };
            if (currentUser) localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
            renderSelectedDecisionCard({ title: currentMealPlan.routeLabel, body: currentMealPlan.body }, currentMealPlan.foodName, currentMealPlan);
            switchTabById('tab-photo');
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            const placeInput = document.getElementById('mealPlaceName');
            const addressInput = document.getElementById('mealPlaceAddress');
            if (quickInput) quickInput.value = currentMealPlan.foodName;
            if (manualInput) manualInput.value = currentMealPlan.foodName;
            if (placeInput) placeInput.value = placeName;
            if (addressInput) addressInput.value = placeAddress;
            setCoachMessage(`已建立回訪計畫：${currentMealPlan.foodName}。到店或開飯前拍照，塔塔會用這次的實際份量校正熱量。`);
            showToast("已建立回訪點餐計畫。");
            return false;
        }

        function renderNearbyRestaurantCards(options, coords = null) {
            const container = document.getElementById('nearbyRestaurantCards');
            if (!container) return;
            container.style.display = 'grid';
            container.innerHTML = options.map(option => `
                <a class="nearby-card" href="${buildMapsUrl(option.query, coords)}" target="_blank" rel="noopener noreferrer">
                    <div class="nearby-card-top">
                        <span class="nearby-card-title">${option.title}</span>
                        <span class="nearby-card-focus">${option.focus}</span>
                    </div>
                    <div class="nearby-card-body">${option.body}</div>
                    <div class="nearby-card-action">${coords ? '用目前位置開地圖' : '開 Google Maps 搜尋'}</div>
                </a>
            `).join('');
        }

        function requestNearbyRestaurants(advice) {
            const status = advice?.status || getNutritionStatus();
            const options = getNearbyRestaurantOptions(status);
            renderNearbyRestaurantCards(options, null);
            if (!navigator.geolocation) {
                setCoachMessage("這個瀏覽器沒有提供定位，塔塔先幫你準備一般地圖搜尋卡。點卡片後可在 Google Maps 用目前位置找附近。");
                renderNearbyRestaurantCards(options, null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                position => {
                    const coords = {
                        latitude: Number(position.coords.latitude.toFixed(5)),
                        longitude: Number(position.coords.longitude.toFixed(5))
                    };
                    renderNearbyRestaurantCards(options, coords);
                    setCoachMessage("塔塔已用你的目前位置準備附近餐廳搜尋。先選一種方向，到店後記得拍飯前照，份量才會準。");
                },
                () => {
                    setCoachMessage("定位沒有開也沒關係。塔塔先放一般 Google Maps 搜尋卡，打開後你可以用地圖自己的目前位置找附近。");
                    renderNearbyRestaurantCards(options, null);
                },
                { enableHighAccuracy: false, timeout: 4500, maximumAge: 600000 }
            );
        }

        function selectTataDecision(index) {
            const options = Array.isArray(window.tataLastDecisionOptions) ? window.tataLastDecisionOptions : [];
            const selected = options[index] || options[0] || '塔塔推薦均衡餐盤';
            const option = splitDecisionText(selected);
            const status = getNutritionStatus();
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            photoCapturePhase = "before";
            switchTabById('tab-photo');
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            const decisionName = getDecisionFoodName(option);
            if (quickInput) quickInput.value = decisionName;
            if (manualInput) manualInput.value = decisionName;
            currentMealPlan = {
                id: `decision_${Date.now()}`,
                route: "tata_decision",
                routeLabel: `塔塔${option.title}`,
                foodName: decisionName,
                focus: advice.focus,
                targetKcal: advice.suggestedKcal,
                mealSlot: advice.slot || getMealSlot(new Date()),
                time: advice.time || "",
                body: option.body,
                decisionDetail: getDecisionOptionDetail(option, advice, index),
                createdAt: new Date().toISOString()
            };
            if (currentUser) localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
            const message = `好，這餐先走「${option.title}」。照這個方向點餐後，先拍飯前照；塔塔會看實際份量估熱量，吃完想更準再補拍飯後照。`;
            document.getElementById('exerciseAlert').style.display = "block";
            document.getElementById('exerciseAlert').innerHTML = message;
            renderSelectedDecisionCard(option, decisionName, currentMealPlan);
            tomaBubble.innerText = message;
            showToast("已選好，接著拍飯前照。");
        }

        function selectTataDecisionAndOpen(index = 0) {
            selectTataDecision(index);
            setTimeout(() => openPhotoSourceSheet('before'), 80);
            return false;
        }

        function getDecisionFoodName(option) {
            const title = String(option?.title || '').replace(/[：:｜|]/g, '').trim();
            const body = String(option?.body || '').trim();
            const genericTitle = /^(最穩|最方便|想吃熱的|想開心|想吃餐廳|最開心|快手|均衡|舒服熱食)$/.test(title);
            if (!genericTitle && title.length >= 3) return title;
            const bodyFood = body
                .replace(/^約\s*\d+\s*kcal[，,、\s]*/i, '')
                .replace(/，.*$/, '')
                .replace(/。.*$/, '')
                .trim();
            return bodyFood || title || "塔塔推薦均衡餐盤";
        }

        function renderSelectedDecisionCard(option, decisionName, plan = currentMealPlan) {
            const card = document.getElementById('selectedDecisionCard');
            if (!card) return;
            const planLine = plan
                ? `<div class="selected-decision-body">本餐計畫：${plan.routeLabel || '塔塔建議'} · ${plan.focus || '均衡'} · 目標約 ${plan.targetKcal || '待估'} kcal。照片估算仍會以實際份量為準。</div>`
                : "";
            const detail = plan?.decisionDetail ? `
                <div class="decision-card-reasons">
                    <div class="decision-card-reason"><strong>為什麼選它</strong>${plan.decisionDetail.why}</div>
                    <div class="decision-card-reason"><strong>拍照要看</strong>${plan.decisionDetail.photoCheck}</div>
                </div>
            ` : "";
            card.innerHTML = `
                <div class="selected-decision-title">塔塔已選好：${option.title}</div>
                <div class="selected-decision-body">${option.body} 已幫你帶入「${decisionName}」。點餐或準備好後，直接拍飯前照；AI 會依照片裡的實際份量、容器大小與醬汁校正熱量。</div>
                ${planLine}
                ${detail}
                <div class="selected-decision-steps">
                    <div class="selected-decision-step">1 選好方向</div>
                    <div class="selected-decision-step">2 飯前拍照</div>
                    <div class="selected-decision-step">3 吃完可補拍</div>
                </div>
                <div class="selected-decision-actions">
                    <button class="selected-decision-action primary" type="button" onclick="openPhotoSourceSheet('before')">拍飯前照 / 選照片</button>
                    <button class="selected-decision-action" type="button" onclick="askTataCoach('找附近餐廳')">找附近可吃的</button>
                </div>
            `;
            card.classList.add('active');
            renderMealPlanResumeCard();
        }

        function clearCurrentMealPlan() {
            currentMealPlan = null;
            if (currentUser) localStorage.removeItem(dailyKey('currentMealPlan'));
            const card = document.getElementById('selectedDecisionCard');
            if (card) {
                card.classList.remove('active');
                card.innerHTML = "";
            }
            renderMealPlanResumeCard();
        }

        function hasActiveMealPlan() {
            return !!(currentMealPlan && String(currentMealPlan.foodName || "").trim());
        }

        function resumeCurrentMealPlan(event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!hasActiveMealPlan()) {
                askTataCoach('等等吃什麼');
                return false;
            }
            switchTabById('tab-photo');
            const plan = currentMealPlan;
            renderSelectedDecisionCard(
                {
                    title: plan.routeLabel || "塔塔已排好下一餐",
                    body: plan.body || "這只是吃飯方向，不是固定份量。開飯前拍照後，塔塔會重新看實際份量、湯汁、醬料與容器大小。"
                },
                plan.foodName || "本餐計畫",
                plan
            );
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            const placeInput = document.getElementById('mealPlaceName');
            const addressInput = document.getElementById('mealPlaceAddress');
            if (quickInput) quickInput.value = plan.foodName || "";
            if (manualInput) manualInput.value = plan.foodName || "";
            if (placeInput && plan.placeName) placeInput.value = plan.placeName;
            if (addressInput && plan.placeAddress) addressInput.value = plan.placeAddress;
            setCoachMessage(`續接上次計畫：${plan.foodName}。到店或開飯前拍一張，塔塔會用照片重新校正份量，不會把上次熱量直接套用。`);
            setTimeout(() => {
                const target = document.getElementById('selectedDecisionCard') || document.getElementById('tab-photo');
                try { target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                catch (error) { target?.scrollIntoView(); }
            }, 80);
            return false;
        }

        function renderMealPlanResumeCard() {
            const card = document.getElementById('mealPlanResumeCard');
            if (!card) return;
            if (!hasActiveMealPlan()) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const plan = currentMealPlan;
            const meta = [plan.routeLabel, plan.mealSlot, plan.time].filter(Boolean).join(' · ') || "下一餐計畫";
            const targetKcal = plan.targetKcal ? `${plan.targetKcal} kcal` : "拍照後估";
            const place = [plan.placeName, plan.placeAddress].filter(Boolean).join(' · ') || "到店再補";
            const body = plan.sourceDate
                ? `${plan.sourceDate} 吃過的記憶可以變成這次方向；真正熱量仍以這次飯前照片校正。`
                : (plan.body || "塔塔已幫你先定方向。等等開飯前直接拍照，照片會判斷實際份量，不用重新選一次。");
            card.classList.add('active');
            card.innerHTML = `
                <div class="meal-plan-resume-top">
                    <div>
                        <div class="meal-plan-resume-kicker">NEXT MEAL</div>
                        <div class="meal-plan-resume-title">續接下一餐：${plan.foodName}</div>
                    </div>
                    <div class="meal-plan-resume-pill">${meta}</div>
                </div>
                <div class="meal-plan-resume-body">${body}</div>
                <div class="meal-plan-resume-grid">
                    <div class="meal-plan-resume-cell"><div class="label">建議吃</div><div class="value">${plan.foodName}</div></div>
                    <div class="meal-plan-resume-cell"><div class="label">目標熱量</div><div class="value">${targetKcal}</div></div>
                    <div class="meal-plan-resume-cell"><div class="label">地點記憶</div><div class="value">${place}</div></div>
                </div>
                <div class="meal-plan-resume-actions">
                    <button class="meal-plan-resume-action primary" type="button" onclick="resumeCurrentMealPlan(event)">繼續這餐去拍</button>
                    <button class="meal-plan-resume-action" type="button" onclick="askTataCoach('塔塔幫我選')">重新問塔塔</button>
                </div>
            `;
        }

        function openTodayMemory(event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            memorySelectedDate = todayKeyDate();
            switchTabById('tab-diet');
            renderTodayDiarySummary();
            setTimeout(() => {
                const target = document.getElementById('todayActionTimeline') || document.getElementById('todayMealLedger') || document.getElementById('tab-diet');
                try { target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                catch (error) { target?.scrollIntoView(); }
            }, 80);
            return false;
        }

        function renderTodayMemoryPreviewCard() {
            const card = document.getElementById('todayMemoryPreviewCard');
            if (!card) return;
            const dateKey = todayKeyDate();
            const dateObj = new Date(`${dateKey}T00:00:00`);
            const meals = getMealsForDate(dateKey);
            const total = meals.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0);
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore ? 1 : 0) + (meal.photoAfter ? 1 : (meal.photo && !meal.photoBefore ? 1 : 0)), 0);
            const waitingAfter = meals.filter(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter).length;
            const water = Math.max(0, Math.round(Number(userData.waterMl || 0)));
            const todayWeight = currentUser ? localStorage.getItem(dailyKey('weight')) : "";
            const latest = [...meals].reverse().find(meal => meal.photoBefore || meal.photo || meal.photoAfter || meal.name) || null;
            const latestPhoto = latest ? (latest.photoBefore || latest.photo || latest.photoAfter || "") : "";
            const latestBody = latest
                ? `${latest.mealSlot || '餐點'} · ${latest.kcal || latest.calories || 0} kcal${latest.nextAdvice ? ` · ${shortNextAdvice(latest.nextAdvice)}` : ''}`
                : "今天還沒有照片。吃飯前先拍一張，塔塔會自動放進今天回憶。";
            const title = meals.length ? "今天已經有吃飯回憶" : "今天先留第一張吃飯回憶";
            const body = meals.length
                ? `今天已留下 ${meals.length} 餐、${photoCount} 張照片，共約 ${total} kcal。${waitingAfter ? `還有 ${waitingAfter} 餐可補飯後照。` : '下一餐可以直接問塔塔怎麼補。'}`
                : "不用先打開報表。首頁就能看到今天日期、餐點照片、熱量和下一步。";
            card.innerHTML = `
                <div class="today-memory-preview-top">
                    <div>
                        <div class="today-memory-preview-kicker">TODAY MEMORY</div>
                        <div class="today-memory-preview-title">${title}</div>
                    </div>
                    <div class="today-memory-preview-date"><strong>${dateObj.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}</strong>${dateObj.toLocaleDateString('zh-TW', { weekday: 'short' })}</div>
                </div>
                <div class="today-memory-preview-body">${body}</div>
                <div class="today-memory-preview-grid">
                    <div class="today-memory-preview-stat${meals.length ? '' : ' warn'}"><strong>${meals.length}</strong><span>餐點</span></div>
                    <div class="today-memory-preview-stat${photoCount ? '' : ' warn'}"><strong>${photoCount}</strong><span>照片</span></div>
                    <div class="today-memory-preview-stat"><strong>${total}</strong><span>kcal</span></div>
                    <div class="today-memory-preview-stat${todayWeight ? '' : ' warn'}"><strong>${todayWeight || '--'}</strong><span>kg</span></div>
                </div>
                <div class="today-memory-preview-latest">
                    ${latestPhoto ? `<img class="today-memory-preview-thumb" src="${latestPhoto}" alt="${latest?.name || '最新餐點'}照片">` : '<div class="today-memory-preview-thumb" aria-hidden="true"></div>'}
                    <div><strong>${latest ? (latest.name || '最新餐點') : '等第一餐'}</strong><span>${latestBody} · 喝水 ${water}ml</span></div>
                </div>
                <div class="today-memory-preview-actions">
                    <button class="today-memory-preview-action primary" type="button" onclick="${meals.length ? 'openTodayMemory(event)' : "openPhotoSourceSheet('before')"}">${meals.length ? '看今天明細' : '拍第一餐'}</button>
                    <button class="today-memory-preview-action" type="button" onclick="openMealDecisionCoach('等等吃什麼')">問下一餐</button>
                </div>
            `;
        }

        function getTataAppearanceForecast(status = getNutritionStatus(), feedback = getTataFeedingFeedback(status)) {
            const warning = feedback.warn[0] || null;
            const beauty = Math.max(0, Math.min(100, Number(feedback.beautyScore || 0)));
            if (!warning && beauty >= 70) {
                return {
                    state: "漂亮發光",
                    reason: "照片、蛋白質、纖維和水分都有接上",
                    rescue: "下一餐照缺口微調",
                    warn: false
                };
            }
            if (!warning) {
                return {
                    state: "穩定成長",
                    reason: "今天資料正在累積",
                    rescue: "再拍一餐或補水",
                    warn: false
                };
            }
            if (warning.title.includes("糖")) {
                return { state: "甜甜沉沉", reason: "含糖飲或甜食讓番茄變重", rescue: "下一杯改無糖", warn: true };
            }
            if (warning.title.includes("鈉")) {
                return { state: "鹽鹽浮腫", reason: "湯底或醬料偏重", rescue: "補水，下一餐少醬", warn: true };
            }
            if (warning.title.includes("肚肚")) {
                return { state: "肚肚滿載", reason: "熱量超過今天目標", rescue: "清湯青菜低脂蛋白", warn: true };
            }
            if (warning.title.includes("水分")) {
                return { state: "有點口渴", reason: `水分還差 ${status.waterGap || 0}ml`, rescue: "先補 250ml", warn: true };
            }
            if (warning.title.includes("蛋白")) {
                return { state: "有點鬆鬆", reason: `蛋白質還差 ${status.proteinGap || 0}g`, rescue: "補蛋豆魚雞", warn: true };
            }
            if (warning.title.includes("纖維")) {
                return { state: "光澤不足", reason: `纖維還差 ${status.fiberGap || 0}g`, rescue: "加青菜菇類豆腐", warn: true };
            }
            return {
                state: "等待照顧",
                reason: warning.body || "今天還少一個關鍵紀錄",
                rescue: feedback.primaryAction?.label || "完成下一步",
                warn: true
            };
        }

        function renderTataAppearanceForecast(forecast) {
            const cells = [
                { label: "現在外觀", value: forecast.state, warn: forecast.warn },
                { label: "變化原因", value: forecast.reason, warn: forecast.warn },
                { label: "救回漂亮", value: forecast.rescue, warn: false }
            ];
            return `
                <div class="tata-appearance-forecast" aria-label="塔塔外觀預報">
                    ${cells.map(cell => `
                        <div class="tata-appearance-forecast-cell${cell.warn ? ' warn' : ''}">
                            <strong>${cell.label}</strong>
                            <span>${cell.value}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function renderTataHomeSnapshot(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const card = document.getElementById('tataHomeSnapshotCard');
            if (!card) return;
            const stage = OTTER_STAGES[growth?.stage || 0] || OTTER_STAGES[0];
            const nextStage = OTTER_STAGES[(growth?.stage || 0) + 1] || null;
            const feedback = getTataFeedingFeedback(status, growth);
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0) + (meal.photoAfter ? 1 : 0), 0);
            const waterGap = Math.max(0, Math.round((status?.targets?.water || DAILY_GUIDELINES.waterMl || 2400) - Number(userData.waterMl || 0)));
            const xpGap = nextStage ? Math.max(0, Math.round(nextStage.minScore - Number(growth?.totalScore || 0))) : 0;
            const warning = feedback.warn[0] || null;
            const appearanceForecast = getTataAppearanceForecast(status, feedback);
            const body = meals.length
                ? `今天 ${meals.length} 餐、${photoCount} 張照片已經變成塔塔的成長記憶。${warning ? `外觀提醒：${warning.title}，${warning.body}` : '目前狀態穩，下一餐照著營養缺口補就好。'}`
                : "塔塔還在等今天第一張吃飯照片。飯前拍一張，牠就能把熱量、照片回憶和下一餐建議接起來。";
            const nextLine = warning
                ? warning.body
                : (nextStage ? `再累積 ${xpGap} XP，塔塔會靠近「${nextStage.name}」。` : "今天維持這個節奏，塔塔會穩穩漂亮。");
            const secondaryLabel = meals.length ? "看今日回憶" : "問等等吃什麼";
            const secondaryAction = meals.length ? "openTodayMemory(event)" : "openMealDecisionCoach('等等吃什麼')";
            card.classList.add('active');
            card.innerHTML = `
                <div class="tata-home-snapshot-top">
                    <div>
                        <div class="tata-home-snapshot-kicker">TATA TODAY</div>
                        <div class="tata-home-snapshot-title">塔塔現在：${stage.name}</div>
                    </div>
                    <div class="tata-home-snapshot-pill">${feedback.mood}</div>
                </div>
                <div class="tata-home-snapshot-body">${body}</div>
                <div class="tata-home-snapshot-grid">
                    <div class="tata-home-snapshot-stat"><strong>${feedback.beautyScore}</strong><span>漂亮分</span></div>
                    <div class="tata-home-snapshot-stat${photoCount ? '' : ' warn'}"><strong>${photoCount}</strong><span>照片回憶</span></div>
                    <div class="tata-home-snapshot-stat${warning ? ' warn' : ''}"><strong>${feedback.warn.length}</strong><span>外觀提醒</span></div>
                    <div class="tata-home-snapshot-stat${waterGap ? ' warn' : ''}"><strong>${waterGap}</strong><span>缺水 ml</span></div>
                </div>
                ${renderTataAppearanceForecast(appearanceForecast)}
                <div class="tata-home-snapshot-actionline"><strong>下一步：</strong>${nextLine}</div>
                <div class="tata-home-snapshot-actions">
                    <button class="tata-home-snapshot-action primary" type="button" onclick="${feedback.primaryAction.action}">${feedback.primaryAction.label}</button>
                    <button class="tata-home-snapshot-action" type="button" onclick="${secondaryAction}">${secondaryLabel}</button>
                </div>
            `;
        }

        function getTataCarePulse(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const feedback = getTataFeedingFeedback(status, growth);
            const mission = getTodayReturnMission(status, growth);
            const stage = OTTER_STAGES[growth?.stage || 0] || OTTER_STAGES[0];
            const warning = feedback.warn[0] || null;
            const good = feedback.good[0] || null;
            const title = warning ? `塔塔今天想先處理：${warning.title}` : `塔塔今天狀態穩：${stage.name}`;
            const body = warning
                ? `${warning.body} 先做一件小事就好，塔塔會把這次照顧記進今天的成長。`
                : (good ? `${good.body} 接下來只要守住下一步，塔塔就能維持漂亮狀態。` : "先留下今天第一餐，塔塔才會開始累積照片回憶。");
            const taskTitle = mission.next?.title || feedback.primaryAction.label || "照顧塔塔";
            const taskBody = mission.next?.body || "做完這一步，今天的吃飯節奏會更完整。";
            const primaryLabel = mission.next?.primaryLabel || feedback.primaryAction.label || "開始";
            const primaryAction = mission.next?.primaryAction || feedback.primaryAction.action || "openPhotoPicker('before')";
            const secondaryLabel = warning ? "看為什麼" : "看今日回憶";
            const secondaryAction = warning ? "switchToTrend()" : "openTodayMemory(event)";
            return {
                mood: feedback.mood,
                title,
                body,
                taskTitle,
                taskBody,
                primaryLabel,
                primaryAction,
                secondaryLabel,
                secondaryAction
            };
        }

        function renderTataCarePulseCard(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const card = document.getElementById('tataCarePulseCard');
            if (!card) return;
            const pulse = getTataCarePulse(status, growth);
            card.classList.add('active');
            card.innerHTML = `
                <div class="tata-care-pulse-top">
                    <div>
                        <div class="tata-care-pulse-kicker">TATA CARE</div>
                        <div class="tata-care-pulse-title">${pulse.title}</div>
                    </div>
                    <div class="tata-care-pulse-meta">${pulse.mood}</div>
                </div>
                <div class="tata-care-pulse-body">${pulse.body}</div>
                <div class="tata-care-pulse-task">${pulse.taskTitle}<span>${pulse.taskBody}</span></div>
                <div class="tata-care-pulse-actions">
                    <button class="tata-care-pulse-action primary" type="button" onclick="${pulse.primaryAction}">${pulse.primaryLabel}</button>
                    <button class="tata-care-pulse-action" type="button" onclick="${pulse.secondaryAction}">${pulse.secondaryLabel}</button>
                </div>
            `;
        }

        function getTataProactiveCoachAlerts(status = getNutritionStatus()) {
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const alerts = [];
            const add = (alert) => alerts.push(alert);
            const memoryProfile = getPersonalDietMemoryProfile(21);
            const pendingAfter = getPendingAfterPhotoMeals(meals).length;
            const outsideMeals = meals.filter(meal => meal.placeName || meal.restaurantName).length;
            const recentOutside = meals.slice(-3).filter(meal => meal.placeName || meal.restaurantName).length;
            if (!meals.length) {
                add({
                    key: "first_photo",
                    level: "urgent",
                    icon: "1",
                    title: "今天還沒有餐點照片",
                    body: "先拍第一餐，塔塔才有熱量、營養和下一餐建議的起點。",
                    now: "先拍",
                    action: "openPhotoSourceSheet('before')"
                });
            }
            if (pendingAfter > 0) {
                add({
                    key: "after_photo",
                    level: "warn",
                    icon: "2",
                    title: `${pendingAfter} 餐可補飯後照`,
                    body: "飯後照會回到同一筆餐點，讓熱量和份量記憶更準。",
                    now: "補拍",
                    action: "startLatestAfterPhoto(event)"
                });
            }
            if (status.sodiumOver > 0) {
                add({
                    key: "sodium",
                    level: "urgent",
                    icon: "Na",
                    title: `鈉已超 ${status.sodiumOver}mg`,
                    body: "下一餐湯底少喝、醬料分開，先補水讓狀態拉回來。",
                    now: "少醬",
                    action: "openMealDecisionCoach('下一餐少鈉怎麼吃')"
                });
            }
            if (status.sugarOver > 0) {
                add({
                    key: "sugar",
                    level: "urgent",
                    icon: "糖",
                    title: `糖已超 ${status.sugarOver}g`,
                    body: "飲料先改無糖，下一餐補蛋白質和蔬菜，甜點留到明天。",
                    now: "控糖",
                    action: "openMealDecisionCoach('今天控糖下一餐怎麼吃')"
                });
            }
            if (status.caloriesOver > 0) {
                add({
                    key: "calories",
                    level: "warn",
                    icon: "k",
                    title: `熱量超 ${status.caloriesOver} kcal`,
                    body: "今天剩下餐次走清湯、青菜和低脂蛋白質，主食半份。",
                    now: "收尾",
                    action: "openMealDecisionCoach('熱量超標下一餐怎麼吃')"
                });
            }
            if (status.proteinGap >= 18) {
                add({
                    key: "protein",
                    level: "warn",
                    icon: "P",
                    title: `蛋白質還差 ${status.proteinGap}g`,
                    body: "下一餐優先雞、魚、蛋、豆腐或無糖豆漿，先補一掌心。",
                    now: "補蛋白",
                    action: "openMealDecisionCoach('幫我補蛋白質')"
                });
            }
            if (status.fiberGap >= 8) {
                add({
                    key: "fiber",
                    level: "warn",
                    icon: "F",
                    title: `纖維還差 ${status.fiberGap}g`,
                    body: "加兩拳蔬菜、菇類、海帶、豆類或地瓜，讓飽足感穩住。",
                    now: "加菜",
                    action: "openMealDecisionCoach('幫我補纖維')"
                });
            }
            if (status.waterGap >= 700) {
                add({
                    key: "water",
                    level: "warn",
                    icon: "水",
                    title: `水分還差 ${status.waterGap}ml`,
                    body: "先補 250ml 到 500ml，再決定下一餐，飽足和判斷會更穩。",
                    now: "喝水",
                    action: "focusTodayWaterQuick()"
                });
            }
            if (outsideMeals >= 2 && recentOutside >= 2 && (status.sodiumOver > 0 || status.fiberGap >= 8 || status.caloriesOver > 0)) {
                add({
                    key: "outside",
                    level: "warn",
                    icon: "店",
                    title: "連續外食要拉回節奏",
                    body: "塔塔看到今天多餐有店家記憶，下一餐先選高蛋白、少醬、加菜。",
                    now: "找店",
                    action: "switchTabById('tab-diet')"
                });
            }
            if (memoryProfile.mealCount >= 3 && memoryProfile.topIssue?.count >= 2) {
                add({
                    key: `memory_${memoryProfile.topIssue.key || "habit"}`,
                    level: memoryProfile.topIssue.count >= 4 ? "urgent" : "warn",
                    icon: "記",
                    title: `最近記憶：${memoryProfile.topIssue.label}`,
                    body: `這不是單餐偶發，TATA 在最近 ${memoryProfile.mealCount} 餐看到 ${memoryProfile.topIssue.count} 次。${memoryProfile.nextAction}`,
                    now: "調整",
                    action: "openMealDecisionCoach('根據我的飲食記憶下一餐怎麼吃')"
                });
            }
            const frequentFood = memoryProfile.topFoods?.[0];
            if (memoryProfile.mealCount >= 4 && frequentFood && frequentFood.count >= 3) {
                add({
                    key: "memory_food",
                    level: "warn",
                    icon: "食",
                    title: `常吃模式：${frequentFood.name}`,
                    body: `最近常出現 ${frequentFood.count} 次。下次吃同類食物時，先拍照，TATA 會用你的目標幫你調份量和搭配。`,
                    now: "看記憶",
                    action: "switchTabById('tab-diet')"
                });
            }
            if (memoryProfile.placeMealCount >= 3 && memoryProfile.placeCount >= 2 && (status.sodiumOver > 0 || status.fiberGap >= 8 || memoryProfile.topIssue?.key === "sodium")) {
                add({
                    key: "memory_place",
                    level: "warn",
                    icon: "店",
                    title: "最近外食記憶偏多",
                    body: `TATA 已記住 ${memoryProfile.placeCount} 個地點、${memoryProfile.placeMealCount} 餐外食。下一餐先找高蛋白、加菜、少醬的店。`,
                    now: "找店",
                    action: "switchTabById('tab-diet')"
                });
            }
            if (!alerts.length) {
                add({
                    key: "steady",
                    level: "good",
                    icon: "OK",
                    title: "今天節奏穩定",
                    body: "下一餐照常飯前拍照，塔塔會持續看熱量、蛋白質、纖維、水、糖和鈉。",
                    now: "維持",
                    action: "openPhotoSourceSheet('before')"
                });
            }
            const rank = { urgent: 3, warn: 2, good: 1 };
            const unique = [];
            const seen = new Set();
            alerts
                .sort((a, b) => (rank[b.level] || 0) - (rank[a.level] || 0))
                .forEach(alert => {
                    if (seen.has(alert.key)) return;
                    seen.add(alert.key);
                    unique.push(alert);
                });
            return unique.slice(0, 3);
        }

        function renderTataProactiveCoachCard(status = getNutritionStatus()) {
            const card = document.getElementById('tataProactiveCoachCard');
            if (!card) return;
            const alerts = getTataProactiveCoachAlerts(status);
            const primary = alerts[0] || { title: "先拍第一餐", action: "openPhotoSourceSheet('before')" };
            const urgentCount = alerts.filter(alert => alert.level === "urgent").length;
            const warnCount = alerts.filter(alert => alert.level === "warn").length;
            const meta = urgentCount ? `${urgentCount} 個需先處理` : (warnCount ? `${warnCount} 個提醒` : "節奏穩定");
            const body = alerts.some(alert => alert.level !== "good")
                ? "塔塔會主動看今天的照片與營養缺口，先提醒最會影響下一餐決策的事。"
                : "今天沒有明顯超標或大缺口，維持每餐拍照，讓記憶繼續累積。";
            card.classList.add('active');
            card.innerHTML = `
                <div class="tata-proactive-coach-top">
                    <div>
                        <div class="tata-proactive-coach-kicker">塔塔教練</div>
                        <div class="tata-proactive-coach-title">主動教練提醒</div>
                    </div>
                    <div class="tata-proactive-coach-meta">${meta}</div>
                </div>
                <div class="tata-proactive-coach-body">${body}</div>
                <div class="tata-proactive-coach-list">
                    ${alerts.map(alert => `
                        <div class="tata-proactive-coach-alert ${alert.level}">
                            <div class="tata-proactive-coach-icon">${alert.icon}</div>
                            <div class="tata-proactive-coach-copy"><strong>${alert.title}</strong><span>${alert.body}</span></div>
                            <div class="tata-proactive-coach-now">${alert.now}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="tata-proactive-coach-actions">
                    <button class="tata-proactive-coach-action primary" type="button" onclick="${primary.action}">${primary.now || '開始'}</button>
                    <button class="tata-proactive-coach-action" type="button" onclick="openMealDecisionCoach('塔塔主動提醒我下一餐')">問塔塔怎麼調</button>
                </div>
            `;
        }

        function getP3WeeklyMealInsight(status = getNutritionStatus()) {
            const rows = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateKey = todayKeyDate(date);
                const meals = getStoredMealsForDate(dateKey);
                const calories = meals.reduce((sum, meal) => sum + Number(meal.calories || meal.kcal || 0), 0);
                const protein = meals.reduce((sum, meal) => sum + Number(meal.protein || 0), 0);
                const fiber = meals.reduce((sum, meal) => sum + Number(meal.fiber || 0), 0);
                const sodium = meals.reduce((sum, meal) => sum + Number(meal.sodium || 0), 0);
                rows.push({ dateKey, meals, calories, protein, fiber, sodium });
            }
            const activeRows = rows.filter(row => row.meals.length);
            if (!activeRows.length) {
                return {
                    title: "先建立第一筆飲食記憶",
                    body: "拍完飯前照後，塔塔會從最近 7 天的熱量、蛋白質、纖維和鈉來主動提醒下一餐。",
                    next: "先拍飯前照"
                };
            }
            const avgCalories = Math.round(activeRows.reduce((sum, row) => sum + row.calories, 0) / activeRows.length);
            const avgProtein = Math.round(activeRows.reduce((sum, row) => sum + row.protein, 0) / activeRows.length);
            const avgFiber = Math.round(activeRows.reduce((sum, row) => sum + row.fiber, 0) / activeRows.length);
            const avgSodium = Math.round(activeRows.reduce((sum, row) => sum + row.sodium, 0) / activeRows.length);
            const target = Number(userData.targetCalories || 0);
            let title = `近 7 天已記 ${activeRows.length} 天`;
            let body = `平均 ${avgCalories} kcal、蛋白質 ${avgProtein}g、纖維 ${avgFiber}g。`;
            let next = "下一餐維持飯前拍照，讓建議越來越貼近你。";
            if (target && avgCalories > target * 1.12) {
                title = "這週熱量偏高";
                next = "下一餐主食半份、醬料分開，蛋白質和青菜保留。";
            } else if (target && avgCalories < target * 0.78) {
                title = "這週吃得偏少";
                next = "下一餐補一掌心蛋白質，加半碗主食，不要只喝飲料撐過去。";
            } else if (avgProtein < 55) {
                title = "蛋白質常常不夠";
                next = "下一餐優先選雞、魚、蛋、豆腐或豆干。";
            } else if (avgFiber < 18) {
                title = "纖維需要補";
                next = "下一餐加一份青菜、菇類、海帶或無糖豆漿。";
            } else if (avgSodium > 2200 || status.sodiumOver > 0) {
                title = "鈉偏高，先收湯底醬料";
                next = "下一餐少喝湯、少滷汁，飲料選無糖。";
            }
            return { title, body, next };
        }

        function getP3RecentHistoryAnalysis(days = 7) {
            const rows = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateKey = todayKeyDate(date);
                const meals = getStoredMealsForDate(dateKey);
                const calories = meals.reduce((sum, meal) => sum + Number(meal.calories || meal.kcal || 0), 0);
                const protein = meals.reduce((sum, meal) => sum + Number(meal.protein || 0), 0);
                const fiber = meals.reduce((sum, meal) => sum + Number(meal.fiber || 0), 0);
                const outside = meals.some(meal => meal.placeName || meal.restaurantName || meal.placeAddress || meal.locationName);
                rows.push({ dateKey, meals, mealCount: meals.length, calories, protein, fiber, outside });
            }
            const active = rows.filter(row => row.mealCount > 0);
            const avg = (key) => active.length ? Math.round(active.reduce((sum, row) => sum + Number(row[key] || 0), 0) / active.length) : 0;
            let lowProteinStreak = 0;
            for (let i = rows.length - 1; i >= 0; i--) {
                if (rows[i].mealCount && rows[i].protein < 50) lowProteinStreak += 1;
                else if (rows[i].mealCount) break;
            }
            let outsideStreak = 0;
            for (let i = rows.length - 1; i >= 0; i--) {
                if (rows[i].mealCount && rows[i].outside) outsideStreak += 1;
                else if (rows[i].mealCount) break;
            }
            return {
                rows,
                active,
                activeDays: active.length,
                mealCount: active.reduce((sum, row) => sum + row.mealCount, 0),
                avgCalories: avg("calories"),
                avgProtein: avg("protein"),
                avgFiber: avg("fiber"),
                lowProteinStreak,
                outsideStreak,
                hasEnough: active.length >= 3
            };
        }

        function getP3HistoryContextLine(status = getNutritionStatus()) {
            const analysis = getP3RecentHistoryAnalysis(7);
            if (!analysis.hasEnough) return "";
            if (analysis.lowProteinStreak >= 3) return `這週蛋白質平均只有 ${analysis.avgProtein}g，已連續 ${analysis.lowProteinStreak} 天偏低，下一餐先把雞、魚、蛋、豆腐補上。`;
            if (analysis.outsideStreak >= 3) return `最近連續 ${analysis.outsideStreak} 天外食了，今晚試試自己煮？簡單一份蛋白質加青菜就很夠。`;
            if (analysis.avgFiber < 18 || status.fiberGap >= 8) return `這週纖維平均 ${analysis.avgFiber}g，最近蔬菜量偏少，下一餐先補青菜、菇類或海帶。`;
            return `這週已記錄 ${analysis.activeDays} 天、${analysis.mealCount} 餐，最近平均 ${analysis.avgCalories} kcal，下一餐照今天缺口微調就好。`;
        }

        function withP3HistoryContext(text = "", status = getNutritionStatus()) {
            const line = getP3HistoryContextLine(status);
            if (!line) return text;
            return `${line} ${text}`;
        }

        function getP3YesterdayMeals() {
            const date = new Date();
            date.setDate(date.getDate() - 1);
            const key = todayKeyDate(date);
            return { key, meals: getStoredMealsForDate(key) };
        }

        function getP3LastMealAt() {
            const history = getMealHistory(30);
            const latest = history.find(isValidMealMemoryEntry);
            const time = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;
            return Number.isFinite(time) ? time : 0;
        }

        function getP3ProactiveGreeting(now = new Date(), status = getNutritionStatus()) {
            const hour = now.getHours();
            const minute = now.getMinutes();
            const minutes = hour * 60 + minute;
            const yesterday = getP3YesterdayMeals();
            const yesterdayKcal = yesterday.meals.reduce((sum, meal) => sum + Number(meal.calories || meal.kcal || 0), 0);
            const yesterdayLunch = yesterday.meals.find(meal => (meal.mealSlot || "").includes("午")) || yesterday.meals[0];
            const lastMealAt = getP3LastMealAt();
            if (lastMealAt && Date.now() - lastMealAt > 24 * 60 * 60 * 1000) {
                return "塔塔有點想你了...今天吃了什麼？拍一張給我看看，我們先從一餐開始。";
            }
            if (minutes >= 8 * 60 && minutes <= 9 * 60) {
                const kcalText = yesterdayKcal ? `昨天吃了 ${Math.round(yesterdayKcal)} kcal，` : "昨天資料還在累積，";
                return `早安！${kcalText}今天目標 ${Math.round(Number(userData.targetCalories || status.targets.calories || 0))} kcal。早餐記得拍～`;
            }
            if (minutes >= 11 * 60 + 30 && minutes <= 12 * 60 + 30) {
                const lunchName = yesterdayLunch?.name || yesterdayLunch?.finalName || yesterdayLunch?.foodName || "";
                return lunchName
                    ? `午餐時間到了！昨天午餐吃了 ${lunchName}，今天想換口味嗎？`
                    : "午餐時間到了！今天想吃清爽一點，還是補蛋白質？拍一下塔塔幫你看。";
            }
            if (minutes >= 18 * 60 && minutes <= 19 * 60) {
                return `晚餐時間到。今天還差 ${status.caloriesLeft} kcal 和 ${status.proteinGap}g 蛋白質，可以用一份主餐蛋白加一份青菜收尾。`;
            }
            const context = getP3HistoryContextLine(status);
            return context || "塔塔在這裡。今天先拍一餐就好，我會幫你把下一步接起來。";
        }

        function isInvalidMealName(name = "") {
            const value = String(name || "").trim();
            return !value || value === "餐點" || value === "照片待確認" || value === "undefined" || value === "null";
        }

        function getP3ProactiveGreeting(now = new Date(), status = getNutritionStatus()) {
            const minutes = now.getHours() * 60 + now.getMinutes();
            const yesterday = getP3YesterdayMeals();
            const yesterdayKcal = yesterday.meals.reduce((sum, meal) => sum + Number(meal.calories || meal.kcal || 0), 0);
            const yesterdayLunch = yesterday.meals.find(meal => String(meal.mealSlot || "").includes("午")) || yesterday.meals[0];
            const lastMealAt = getP3LastMealAt();
            if (lastMealAt && Date.now() - lastMealAt > 24 * 60 * 60 * 1000) {
                return "塔塔有點想你了...今天吃了什麼？拍一張給我看看";
            }
            if (minutes >= 8 * 60 && minutes <= 9 * 60) {
                const kcalText = yesterdayKcal ? `昨天吃了 ${Math.round(yesterdayKcal)} kcal，` : "昨天資料還在累積，";
                return `早安！${kcalText}今天目標 ${Math.round(Number(userData.targetCalories || status.targets.calories || 0))} kcal。早餐記得拍～`;
            }
            if (minutes >= 11 * 60 + 30 && minutes <= 12 * 60 + 30) {
                const lunchName = yesterdayLunch?.name || yesterdayLunch?.finalName || yesterdayLunch?.foodName || "";
                if (isInvalidMealName(lunchName)) return "午餐時間到了！今天想吃什麼？拍一張給塔塔看～";
                return `午餐時間到了！昨天午餐吃了 ${lunchName}，今天想換口味嗎？`;
            }
            if (minutes >= 18 * 60 && minutes <= 19 * 60) {
                return `晚餐時間到。今天還差 ${status.caloriesLeft} kcal 和 ${status.proteinGap}g 蛋白質，可以用一份主餐蛋白加一份青菜收尾。`;
            }
            const context = getP3HistoryContextLine(status);
            return context || "塔塔在這裡。今天先拍一餐就好，我會幫你把下一步接起來。";
        }

        function getP3WeekKey(date = new Date()) {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 4 - (d.getDay() || 7));
            const yearStart = new Date(d.getFullYear(), 0, 1);
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
        }

        function getP3WeeklyReport() {
            const analysis = getP3RecentHistoryAnalysis(7);
            if (analysis.activeDays < 7) return null;
            const scoreValues = analysis.active.flatMap(row => row.meals.map(meal => Number(meal.mealScore || meal.score || meal.nutritionScore || 0)).filter(score => score > 0));
            const avgScore = scoreValues.length ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length) : Math.max(60, Math.min(92, Math.round(100 - Math.abs((analysis.avgCalories || 0) - Number(userData.targetCalories || 1800)) / 35)));
            const proteinDays = analysis.active.filter(row => row.protein >= 50).length;
            let summary = "這週你有穩定留下紀錄，塔塔已經比較懂你的節奏了。";
            if (analysis.avgProtein < 50) summary = `這週蛋白質平均只有 ${analysis.avgProtein}g，下週先把每餐的蛋白質補穩。`;
            else if (analysis.avgFiber < 18) summary = `這週纖維平均 ${analysis.avgFiber}g，下週每餐加一份青菜會很有感。`;
            else if (analysis.outsideStreak >= 3) summary = `最近連續 ${analysis.outsideStreak} 天外食，下週挑一天自己煮，塔塔陪你把節奏拉回來。`;
            return { ...analysis, avgScore, proteinDays, summary, weekKey: getP3WeekKey() };
        }

        function dismissP3WeeklyReport() {
            if (!currentUser) return false;
            localStorage.setItem(`paipachi:${currentUser}:weeklyReportDismissed:${getP3WeekKey()}`, "true");
            renderP3WeeklyReportCard();
            return false;
        }

        function renderP3WeeklyReportCard() {
            const card = document.getElementById('p3WeeklyReportCard');
            if (!card || !currentUser) return;
            const report = getP3WeeklyReport();
            const dismissed = localStorage.getItem(`paipachi:${currentUser}:weeklyReportDismissed:${getP3WeekKey()}`) === "true";
            if (!report || dismissed) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            card.classList.add('active');
            card.innerHTML = `
                <div class="p3-weekly-report-top">
                    <div>
                        <div class="p3-weekly-report-kicker">上週週報</div>
                        <div class="p3-weekly-report-title">塔塔幫你整理最近 7 天</div>
                    </div>
                    <button class="p3-weekly-report-close" type="button" onclick="dismissP3WeeklyReport()" aria-label="關閉週報">×</button>
                </div>
                <div class="p3-weekly-report-grid">
                    <div><strong>${report.avgCalories}</strong><span>平均 kcal</span></div>
                    <div><strong>${report.proteinDays}/7</strong><span>蛋白達標</span></div>
                    <div><strong>${report.mealCount}</strong><span>記錄餐數</span></div>
                    <div><strong>${report.avgScore}</strong><span>平均本餐分</span></div>
                </div>
                <div class="p3-weekly-report-body">${p2SafeText(report.summary)}</div>
            `;
        }

        function renderTataProactiveCoachCard(status = getNutritionStatus()) {
            const card = document.getElementById('tataProactiveCoachCard');
            if (!card) return;
            const meals = Array.isArray(userData.dietRecords) && userData.dietRecords.length
                ? userData.dietRecords
                : getStoredMealsForDate(todayKeyDate());
            const pendingAfter = getPendingAfterPhotoMeals(meals).length;
            const alerts = [];
            if (!meals.length) {
                alerts.push({ level: "urgent", icon: "1", title: "先拍第一餐", body: "有第一張飯前照後，塔塔才能開始累積你的飲食記憶。", now: "拍照", action: "openPhotoSourceSheet('before')" });
            }
            if (pendingAfter > 0) {
                alerts.push({ level: "warn", icon: "2", title: `${pendingAfter} 餐可補飯後照`, body: "飯後照是加分校正，不會阻擋本餐數據，但補了會讓長期記憶更準。", now: "補拍", action: "startLatestAfterPhoto(event)" });
            }
            if (status.sodiumOver > 0) {
                alerts.push({ level: "urgent", icon: "Na", title: `鈉超出 ${status.sodiumOver}mg`, body: "下一餐先避開湯底、滷汁和重醬料。", now: "調整", action: "openMealDecisionCoach('下一餐幫我降鈉')" });
            }
            if (status.proteinGap > 0) {
                alerts.push({ level: "warn", icon: "P", title: `蛋白質差 ${status.proteinGap}g`, body: "下一餐補一掌心雞、魚、蛋、豆腐或豆干。", now: "補蛋白", action: "openMealDecisionCoach('下一餐補蛋白質')" });
            }
            if (!alerts.length) {
                alerts.push({ level: "good", icon: "OK", title: "今天節奏穩", body: "維持每餐飯前拍照，塔塔會用長期記憶幫你微調下一餐。", now: "繼續", action: "openMealDecisionCoach('等等吃什麼')" });
            }
            const weekly = getP3WeeklyMealInsight(status);
            const greeting = getP3ProactiveGreeting(new Date(), status);
            const primary = alerts[0] || { level: "good", title: weekly.title, body: weekly.body, now: "拍下一餐", action: "openPhotoSourceSheet('before')" };
            const urgentCount = alerts.filter(alert => alert.level === "urgent").length;
            const warnCount = alerts.filter(alert => alert.level === "warn").length;
            const meta = urgentCount ? `${urgentCount} 個需先處理` : (warnCount ? `${warnCount} 個提醒` : "節奏穩定");
            const list = alerts.length ? alerts.slice(0, 3) : [primary];
            card.classList.add('active');
            card.innerHTML = `
                <div class="tata-proactive-coach-top">
                    <div>
                        <div class="tata-proactive-coach-kicker">塔塔教練</div>
                        <div class="tata-proactive-coach-title">主動教練提醒</div>
                    </div>
                    <div class="tata-proactive-coach-meta">${meta}</div>
                </div>
                <div class="tata-proactive-coach-body">
                    ${p2SafeText(greeting)}<br>
                    <strong>${p2SafeText(weekly.title)}</strong><br>
                    ${p2SafeText(weekly.body)}<br>
                    下一步：${p2SafeText(weekly.next)}
                </div>
                <div class="tata-proactive-coach-list">
                    ${list.map(alert => `
                        <div class="tata-proactive-coach-alert ${alert.level || 'good'}">
                            <div class="tata-proactive-coach-icon">${p2SafeText(alert.icon || "T")}</div>
                            <div class="tata-proactive-coach-copy"><strong>${p2SafeText(alert.title)}</strong><span>${p2SafeText(alert.body)}</span></div>
                            <div class="tata-proactive-coach-now">${p2SafeText(alert.now || "現在")}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="tata-proactive-coach-actions">
                    <button class="tata-proactive-coach-action primary" type="button" onclick="${primary.action || "openPhotoSourceSheet('before')"}">${p2SafeText(primary.now || '開始')}</button>
                    <button class="tata-proactive-coach-action" type="button" onclick="openMealDecisionCoach('塔塔主動提醒我下一餐')">問塔塔怎麼調</button>
                </div>
            `;
        }

        function renderTodayWaterQuickCard(status = getNutritionStatus()) {
            const card = document.getElementById('todayWaterQuickCard');
            if (!card) return;
            const plan = getWaterReminderPlan(status);
            const waterNow = Math.max(0, Math.round(Number(userData.waterMl || 0)));
            const target = Math.max(1, Math.round(status?.targets?.water || DAILY_GUIDELINES.waterMl || 2000));
            const gap = Math.max(0, target - waterNow);
            const progress = Math.max(0, Math.min(100, Math.round((waterNow / target) * 100)));
            const done = gap === 0;
            const title = done ? "今天水分已達標" : `今天還差 ${gap}ml 水`;
            const body = done
                ? "喝水節奏已經穩住，接下來口渴再補就好。塔塔不會叫你硬灌水。"
                : `${plan.timing} ${plan.nextAmount}ml。先補一杯，等等吃飯或問塔塔時，判斷會更穩。`;
            card.classList.add('active');
            card.innerHTML = `
                <div class="today-water-quick-top">
                    <div>
                        <div class="today-water-quick-kicker">喝水檢查</div>
                        <div class="today-water-quick-title">${title}</div>
                    </div>
                    <div class="today-water-quick-pill">${progress}%</div>
                </div>
                <div class="today-water-quick-body">${body}</div>
                <div class="today-water-quick-bar" aria-hidden="true"><div class="today-water-quick-fill" style="width:${progress}%"></div></div>
                <div class="today-water-quick-grid">
                    <div class="today-water-quick-stat"><strong>${waterNow}</strong><span>已喝 ml</span></div>
                    <div class="today-water-quick-stat"><strong>${target}</strong><span>目標 ml</span></div>
                    <div class="today-water-quick-stat"><strong>${gap}</strong><span>剩餘 ml</span></div>
                </div>
                <div class="today-water-quick-actions">
                    <button class="today-water-quick-action primary" type="button" onclick="addWater(${plan.nextAmount || 250})">+${plan.nextAmount || 250}</button>
                    <button class="today-water-quick-action" type="button" onclick="addWater(250)">+250</button>
                    <button class="today-water-quick-action" type="button" onclick="addWater(500)">+500</button>
                    <button class="today-water-quick-action" type="button" onclick="addWater(-250)">-250</button>
                </div>
            `;
        }

        function focusTodayWaterQuick() {
            const card = document.getElementById('todayWaterQuickCard');
            if (card) {
                try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) { card.scrollIntoView(); }
                return false;
            }
            addWater(250);
            return false;
        }

        function renderTodayWeightQuickCard() {
            const card = document.getElementById('todayWeightQuickCard');
            if (!card || !currentUser) return;
            const todayWeight = localStorage.getItem(dailyKey('weight'));
            const value = Number(todayWeight || userData.currentWeight || userData.accountWeightKg || 0);
            const hasTodayWeight = Number.isFinite(Number(todayWeight)) && Number(todayWeight) > 0;
            const accountWeight = Number(userData.accountWeightKg || userData.currentWeight || 0);
            const delta = hasTodayWeight && accountWeight ? Math.round((Number(todayWeight) - accountWeight) * 10) / 10 : 0;
            const title = hasTodayWeight ? `今日體重 ${Number(todayWeight).toFixed(1)} kg` : "今天體重還沒記";
            const pill = hasTodayWeight ? (Math.abs(delta) >= 0.1 ? `${delta > 0 ? '+' : ''}${delta}kg / 基準` : "接近基準") : "10 秒完成";
            const body = hasTodayWeight
                ? "這筆只綁今天日期，會進 7 日趨勢；不會覆蓋第一次註冊的身高與基準體重。需要修正時直接輸入或用微調。"
                : "不用進設定頁。輸入今天數字就好，塔塔會把它和餐照、喝水、步數一起看趨勢。";
            card.classList.add('active');
            card.innerHTML = `
                <div class="today-weight-quick-top">
                    <div>
                        <div class="today-weight-quick-kicker">今日身體</div>
                        <div class="today-weight-quick-title">${title}</div>
                    </div>
                    <div class="today-weight-quick-pill">${pill}</div>
                </div>
                <div class="today-weight-quick-body">${body}</div>
                <div class="today-weight-quick-row">
                    <input id="todayWeightQuickInput" class="today-weight-quick-input" type="number" min="30" max="250" step="0.1" inputmode="decimal" value="${value ? value.toFixed(1) : ''}" placeholder="今天體重 kg" onkeydown="if(event.key==='Enter') saveTodayWeightQuick()">
                    <button class="today-weight-quick-action" type="button" onclick="saveTodayWeightQuick()">記錄</button>
                </div>
                <div class="today-weight-quick-chips">
                    <button class="today-weight-quick-chip" type="button" onclick="quickTodayWeightDelta(-1)">-1kg</button>
                    <button class="today-weight-quick-chip" type="button" onclick="quickTodayWeightDelta(-0.5)">-0.5</button>
                    <button class="today-weight-quick-chip" type="button" onclick="quickTodayWeightDelta(0.5)">+0.5</button>
                    <button class="today-weight-quick-chip" type="button" onclick="quickTodayWeightDelta(1)">+1kg</button>
                </div>
                <div class="today-weight-quick-note">帳號基準體重：${accountWeight ? accountWeight.toFixed(1) : '--'} kg。今日體重是日期紀錄，換瀏覽器登入同帳號仍會保留註冊資料。</div>
            `;
        }

        function renderTodayLifeQuickCard() {
            const card = document.getElementById('todayLifeQuickCard');
            if (!card || !currentUser) return;
            const state = getLifeLogState();
            const labels = getLifeMemoryLabels(state);
            const advice = getLifeWellnessAdvice();
            const title = labels.hasAny ? `生活狀態 ${labels.completion}/3` : "睡眠、排便、活力也先記一下";
            const body = advice.summary
                ? `${advice.summary}${advice.mealNudge || '塔塔會把這些狀態放進下一餐建議。'}`
                : "不用寫日記。三個小欄位就能讓塔塔知道今天身體狀況，下一餐建議會更像真的陪你生活。";
            const pill = labels.completion >= 3 ? "已完整" : `${3 - labels.completion} 項待補`;
            card.classList.add('active');
            card.innerHTML = `
                <div class="today-life-quick-top">
                    <div>
                        <div class="today-life-quick-kicker">生活檢查</div>
                        <div class="today-life-quick-title">${title}</div>
                    </div>
                    <div class="today-life-quick-pill">${pill}</div>
                </div>
                <div class="today-life-quick-body">${body}</div>
                <div class="today-life-quick-grid">
                    <input id="todaySleepQuickInput" class="today-life-quick-input" type="number" min="0" max="16" step="0.5" inputmode="decimal" value="${state.sleepHours || ''}" placeholder="睡幾小時">
                    <select id="todayBowelQuickInput" class="today-life-quick-input" aria-label="首頁排便狀態">
                        <option value="" ${!state.bowelState ? 'selected' : ''}>排便</option>
                        <option value="normal" ${state.bowelState === 'normal' ? 'selected' : ''}>順暢</option>
                        <option value="none" ${state.bowelState === 'none' ? 'selected' : ''}>還沒有</option>
                        <option value="loose" ${state.bowelState === 'loose' ? 'selected' : ''}>偏軟</option>
                        <option value="hard" ${state.bowelState === 'hard' ? 'selected' : ''}>偏硬</option>
                    </select>
                    <select id="todayEnergyQuickInput" class="today-life-quick-input" aria-label="首頁今日活力">
                        <option value="" ${!state.energyState ? 'selected' : ''}>活力</option>
                        <option value="good" ${state.energyState === 'good' ? 'selected' : ''}>有精神</option>
                        <option value="ok" ${state.energyState === 'ok' ? 'selected' : ''}>普通</option>
                        <option value="tired" ${state.energyState === 'tired' ? 'selected' : ''}>偏累</option>
                    </select>
                    <button class="today-life-quick-action" type="button" onclick="saveTodayLifeQuick()">記錄</button>
                </div>
                <div class="today-life-quick-tags">
                    <div class="today-life-quick-tag${labels.sleepWarn ? ' warn' : ''}"><strong>${labels.sleepText}</strong><span>睡眠</span></div>
                    <div class="today-life-quick-tag${labels.bowelWarn ? ' warn' : ''}"><strong>${labels.bowelText}</strong><span>排便</span></div>
                    <div class="today-life-quick-tag${labels.energyWarn ? ' warn' : ''}"><strong>${labels.energyText}</strong><span>活力</span></div>
                </div>
            `;
        }

        function askNextMealAdvice() {
            const burnKcal = Math.round(userData.currentSteps * 0.04);
            const caloriesLeft = userData.targetCalories - userData.consumedCalories + burnKcal;
            const advice = getNextMealSuggestion(new Date(), caloriesLeft);
            const mealsCount = userData.dietRecords.length;
            const left = Math.max(0, Math.round(caloriesLeft));
            const prefix = mealsCount
                ? `今天已吃 ${userData.consumedCalories} kcal，還有約 ${left} kcal 可以安排。`
                : `今天還沒吃進紀錄，第一餐可以先穩住血糖和蛋白質。`;
            const status = advice.status;
            const sugarText = status.sugarOver > 0 ? `糖已超 ${status.sugarOver}g` : `糖額度還有 ${status.sugarLeft}g`;
            const sodiumText = status.sodiumOver > 0 ? `鈉已超 ${status.sodiumOver}mg` : `鈉額度還有 ${status.sodiumLeft}mg`;
            const gapText = `目前缺口：蛋白質 ${status.proteinGap}g、纖維 ${status.fiberGap}g、水 ${status.waterGap}ml；${sugarText}、${sodiumText}。`;
            const message = `${prefix}${gapText}${advice.text}`;
            document.getElementById('exerciseAlert').style.display = "block";
            document.getElementById('exerciseAlert').innerHTML = message;
            tomaBubble.innerText = message;
            renderTataDecisionCards(advice);
            showToast("塔塔已幫你排下一餐。");
        }

        function handleCoachKey(event) {
            if (event.key === 'Enter') askTataCoach();
        }

        function setCoachMessage(message) {
            document.getElementById('exerciseAlert').style.display = "block";
            document.getElementById('exerciseAlert').innerHTML = message;
            tomaBubble.innerText = message;
            showToast("塔塔回覆你了。");
        }

        function renderCoachAnswerStatus(question, mode, advice) {
            const card = document.getElementById('coachAnswerStatus');
            if (!card) return;
            const status = advice?.status || getNutritionStatus();
            const priority = advice?.priority || getPrimaryNutritionPriority(status);
            const modeText = mode === "recipe" ? "健康食譜方向"
                : mode === "nearby" ? "附近外食方向"
                : mode === "analysis" ? "今日缺口分析"
                : "塔塔三選一";
            const questionText = question || "等等吃什麼";
            card.classList.add('active');
            card.innerHTML = `
                <strong>已收到：${questionText}，塔塔正在用「${modeText}」回答</strong>
                <span>判斷依據：熱量剩 ${status.caloriesLeft} kcal、蛋白質缺 ${status.proteinGap}g、纖維缺 ${status.fiberGap}g、水分缺 ${status.waterGap}ml。優先處理：${priority.label}。真正熱量仍以飯前照片和份量校正。</span>
            `;
        }

        function hideCoachAnswerStatus() {
            const card = document.getElementById('coachAnswerStatus');
            if (!card) return;
            card.classList.remove('active');
            card.innerHTML = "";
        }

        function focusTataCoachAnswer(preferredId = "") {
            switchTabById('tab-photo');
            setTimeout(() => {
                const candidates = [
                    preferredId ? document.getElementById(preferredId) : null,
                    document.querySelector('#selectedDecisionCard.active'),
                    document.getElementById('tataDecisionCards')?.innerHTML ? document.getElementById('tataDecisionCards') : null,
                    document.getElementById('recipeCards')?.innerHTML ? document.getElementById('recipeCards') : null,
                    document.getElementById('nearbyRestaurantCards')?.innerHTML ? document.getElementById('nearbyRestaurantCards') : null,
                    document.getElementById('mealDecisionPathCard')?.innerHTML ? document.getElementById('mealDecisionPathCard') : null,
                    document.getElementById('coachAnswerStatus'),
                    document.getElementById('tataCoachInput')
                ];
                const target = candidates.find(Boolean);
                if (target && typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 80);
        }

        function openMealDecisionCoach(question = "等等吃什麼") {
            const text = String(question || "等等吃什麼").trim() || "等等吃什麼";
            switchTabById('tab-photo');
            const input = document.getElementById('tataCoachInput');
            if (input) input.value = text;
            const status = getNutritionStatus();
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            renderCoachAnswerStatus(text, "decision", advice);
            renderMealDecisionPathCard(status, advice);
            renderTataDecisionCards(advice);
            hideRecipeCards();
            hideNearbyRestaurantCards();
            setCoachMessage(`塔塔先幫你把「${text}」整理成三個方向。想省腦就按「塔塔直接幫我選」，系統會帶你到飯前拍照；真正熱量等照片裡的份量、容器、湯汁和醬料再校正。`);
            focusTataCoachAnswer('tataDecisionCards');
            return false;
        }

        function askTataCoach(presetText = "") {
            switchTabById('tab-photo');
            const input = document.getElementById('tataCoachInput');
            const requestedQuestion = String(presetText || '').trim();
            if (requestedQuestion && input) input.value = requestedQuestion;
            const question = String(requestedQuestion || input?.value || '').trim();
            const burnKcal = Math.round(userData.currentSteps * 0.04);
            const caloriesLeft = userData.targetCalories - userData.consumedCalories + burnKcal;
            const advice = getNextMealSuggestion(new Date(), caloriesLeft);
            const status = advice.status;
            const diagnosis = advice.diagnosis || getNutritionGapDiagnosis(status);
            const lifeLine = advice.lifeAdvice?.mealNudge ? `${advice.lifeAdvice.summary}${advice.lifeAdvice.mealNudge}` : "";
            if (input && presetText) {
                input.value = presetText;
                renderCoachAnswerStatus(presetText, "decision", advice);
                focusTataCoachAnswer('coachAnswerStatus');
            }
            if (!question) {
                renderCoachAnswerStatus("塔塔幫我選", "decision", advice);
                setCoachMessage(`你可以問我「塔塔幫我選」、「健康食譜」、「附近餐廳」或「想喝飲料可以嗎」。${diagnosis.baseline}${lifeLine}${buildDecisionGameMessage(advice)}`);
                renderTataDecisionCards(advice);
                renderMealDecisionPathCard(status, advice);
                hideRecipeCards();
                hideNearbyRestaurantCards();
                focusTataCoachAnswer('tataDecisionCards');
                return;
            }
            if (currentUser) {
                localStorage.setItem(dailyKey('lastCoachQuestion'), JSON.stringify({
                    question,
                    askedAt: new Date().toISOString()
                }));
            }

            let answer = "";
            let shouldShowDecisionCards = false;
            let shouldShowRecipeCards = false;
            let shouldShowNearbyCards = false;
            let answerMode = "analysis";
            if (/(養胃|溫和|胃不舒服|胃食道|胃酸|火燒心|反酸)/.test(question)) {
                answer = `已切換成「溫和養胃」餐食方向。這是日常養身建議，不是疾病治療。這一餐優先選溫熱、柔軟、少油、少辣、少酸：蒸蛋或豆腐＋魚／雞肉＋粥、白飯或地瓜，再配煮軟青菜；先吃七分飽，飲料以溫水為主。${diagnosis.baseline}`;
                shouldShowRecipeCards = true;
                answerMode = "recipe";
            } else if (/(健胃|養身|養生|日常養身|日常養生)/.test(question)) {
                answer = `「日常養身」不是只吃清粥，而是讓三餐規律又有營養。今天用一掌心蛋白質、兩拳蔬菜、半到一拳原型主食，細嚼慢嚥；發酵乳品或豆製品可依自己的耐受度少量加入。${diagnosis.baseline}`;
                shouldShowRecipeCards = true;
                answerMode = "recipe";
            } else if (/(順暢|纖維|便秘|排便)/.test(question)) {
                answer = `已切換成「順暢纖維」方向：這餐安排一份全穀或地瓜、兩拳熟蔬菜、一份水果，再把水分補足。纖維要逐步增加，若一下吃太多反而可能脹氣。今天纖維還差 ${status.fiberGap}g、水還差 ${status.waterGap}ml。`;
                shouldShowRecipeCards = true;
                answerMode = "recipe";
            } else if (/(經期|暖養|月經|生理期)/.test(question)) {
                answer = `已切換成「經期暖養」方向：優先溫熱餐、足量蛋白質及含鐵食物，例如牛肉、魚、蛋、豆腐配深綠色蔬菜；搭配富含維生素 C 的水果。若容易水腫，湯汁與重鹹醬料減量。`;
                shouldShowRecipeCards = true;
                answerMode = "recipe";
            } else if (/[幫我選選擇障礙不知道不想決定隨便遊戲抽牌三選一]/.test(question)) {
                answer = `${diagnosis.baseline}${diagnosis.plateRule}${lifeLine}${buildDecisionGameMessage(advice)}`;
                shouldShowDecisionCards = true;
                answerMode = "decision";
            } else if (/[食譜料理菜單健康均衡減脂健身增肌]/.test(question)) {
                answer = `${diagnosis.baseline}今天先用「一掌蛋白質、兩拳蔬菜、半到一拳主食」做健康均衡盤。塔塔已依 ${diagnosis.deficits.join("、") || "目前節奏"} 挑 3 個食譜方向；點卡片可以直接搜尋最新做法，煮好後一樣先拍飯前照。`;
                shouldShowRecipeCards = true;
                answerMode = "recipe";
            } else if (/[附近餐廳餐廳外食店家吃外面定位地圖]/.test(question)) {
                answer = `可以，塔塔先依今天缺口幫你篩外食方向：${diagnosis.plateRule}下面會放附近搜尋卡；打開地圖後，到店一樣先拍飯前照，讓估算回到你的實際份量。`;
                shouldShowNearbyCards = true;
                answerMode = "nearby";
            } else if (/[缺少缺什麼不足營養蛋白纖維水]/.test(question)) {
                const sugarStatus = status.sugarOver > 0 ? `糖已超 ${status.sugarOver}g，下一餐先無糖。` : `糖額度還有 ${status.sugarLeft}g。`;
                const sodiumStatus = status.sodiumOver > 0 ? `鈉已超 ${status.sodiumOver}mg，下一餐少湯底少醬。` : `鈉額度還有 ${status.sodiumLeft}mg。`;
                answer = `${diagnosis.baseline}今天重點：蛋白質還差 ${status.proteinGap}g、纖維還差 ${status.fiberGap}g、水還差 ${status.waterGap}ml，熱量還有約 ${status.caloriesLeft} kcal。${sugarStatus}${sodiumStatus}${advice.text}`;
            } else if (/[飲料可樂奶茶手搖咖啡酒啤酒]/.test(question)) {
                if (status.sugarOver > 0) {
                    answer = `今天糖已經超過官方 10% 熱量上限換算值約 ${status.sugarOver}g，塔塔建議改無糖茶、黑咖啡、氣泡水或零卡。想喝甜的留到明天，塔塔比較不會變沉。`;
                } else if (status.waterGap >= 700) {
                    answer = `可以想喝，但塔塔建議先補 300-500ml 水。若要喝飲料，選無糖茶、黑咖啡或零卡汽水；含糖可樂/奶茶先抓 140-350 kcal，今天熱量剩 ${status.caloriesLeft} kcal。`;
                } else if (status.caloriesLeft < 350) {
                    answer = `今天熱量餘額偏少，飲料建議選無糖茶、黑咖啡或零卡。想喝甜的可以小杯、半糖以下，並把下一餐主食減一點。`;
                } else {
                    answer = `可以安排，但把它當成點心熱量。建議無糖優先；若喝含糖飲，抓 140-350 kcal，下一餐補蛋白質和纖維，不要再加炸物。`;
                }
            } else if (/[湯鍋火鍋羹]/.test(question)) {
                if (status.sodiumOver > 0) {
                    answer = `今天鈉已經偏高，湯可以選清湯但少喝湯底，避開麻辣鍋、泡菜湯、拉麵湯和滷味湯汁。先補 500ml 水，下一餐用蒸蛋、豆腐、魚或雞胸補蛋白質。`;
                } else if (status.proteinGap >= 18) {
                    answer = `湯可以，優先選有蛋白質的湯：豆腐蛋花湯、魚湯、雞湯或牛肉清湯。少喝濃湯和勾芡，主食抓半碗就好。`;
                } else {
                    answer = `晚餐喝湯可以走清湯路線：青菜湯、菇湯、海帶湯，搭一掌心蛋白質。若是火鍋，湯底少喝、醬料少一半。`;
                }
            } else if (/[晚餐午餐早餐點心等等吃什麼吃啥建議]/.test(question)) {
                answer = `${advice.text}今天缺口是蛋白質 ${status.proteinGap}g、纖維 ${status.fiberGap}g、水 ${status.waterGap}ml；糖剩 ${status.sugarLeft}g、鈉剩 ${status.sodiumLeft}mg，所以先照缺口補，超標項目先收。${diagnosis.aiSees}${buildDecisionGameMessage(advice)}`;
                shouldShowDecisionCards = true;
                answerMode = "decision";
            } else {
                answer = `塔塔先用今天紀錄幫你判斷：${advice.text}${diagnosis.aiSees}如果你要吃特定餐點，直接輸入餐名或拍照，我會再幫你估熱量。也可以問「塔塔幫我選」讓我直接給三選一。`;
            }
            renderCoachAnswerStatus(question, answerMode, advice);
            setCoachMessage(answer);
            if (shouldShowDecisionCards) {
                renderTataDecisionCards(advice);
                renderMealDecisionPathCard(status, advice);
            } else hideTataDecisionCards();
            if (shouldShowRecipeCards) renderRecipeCards(getRecipeOptions(status));
            else hideRecipeCards();
            if (shouldShowNearbyCards) requestNearbyRestaurants(advice);
            else hideNearbyRestaurantCards();
            if (presetText || shouldShowDecisionCards || shouldShowRecipeCards || shouldShowNearbyCards) {
                const focusId = shouldShowDecisionCards ? 'tataDecisionCards' : (shouldShowRecipeCards ? 'recipeCards' : (shouldShowNearbyCards ? 'nearbyRestaurantCards' : 'coachAnswerStatus'));
                focusTataCoachAnswer(focusId);
            }
        }

        function buildFinalMealFromSelected() {
            const capturedAt = new Date();
            const phase = selectedMeal.phase || photoCapturePhase || "before";
            const placeMemory = getMealPlaceMemory();
            const base = {
                ...selectedMeal,
                name: selectedMealName,
                calories: selectedMealKcal,
                protein: selectedP,
                carbs: selectedV,
                fat: selectedF,
                fiber: selectedFiber,
                sugar: selectedSugar,
                sodium: selectedSodium,
                mealSlot: selectedMeal.mealSlot || getMealSlot(capturedAt),
                capturedAt: selectedMeal.capturedAt || capturedAt.toISOString(),
                mealPlan: currentMealPlan ? { ...currentMealPlan } : selectedMeal.mealPlan || null,
                ...placeMemory
            };

            if (phase !== "after") return base;

            const pending = resolveAfterPhotoTargetMeal();
            if (!pending) return { ...base, phase: "single_after" };

            const beforeCalories = Math.max(0, Math.round(Number(pending.calories || 0)));
            const remainingCalories = Math.max(0, Math.round(Number(base.calories || 0)));
            const beforePhotoSrc = pending.photoBefore || pending.photo || base.photoBefore || "";
            const afterPhotoSrc = base.photoAfter || base.photo || "";
            const afterIsLowTrust = isLowTrustAfterEstimate(base, beforeCalories, remainingCalories);
            const consumed = afterIsLowTrust
                ? beforeCalories
                : (beforeCalories > 0 ? Math.max(0, beforeCalories - Math.min(beforeCalories, remainingCalories)) : base.calories);
            const ratio = beforeCalories > 0 ? Math.max(0, Math.min(1, consumed / beforeCalories)) : 1;
            const nextAdvice = getNextMealSuggestion(capturedAt, userData.targetCalories - (userData.consumedCalories + consumed));
            const comparisonNote = buildMealComparisonNote(beforeCalories, remainingCalories, consumed, afterIsLowTrust, base);

            localStorage.removeItem(dailyKey('pendingBeforeMeal'));
            pendingBeforeMeal = null;
            return {
                ...pending,
                name: pending.name || base.name,
                calories: Math.max(1, Math.round(consumed || base.calories)),
                protein: Math.max(0, Math.round(Number(pending.protein || 0) * ratio)),
                carbs: Math.max(0, Math.round(Number(pending.carbs || 0) * ratio)),
                fat: Math.max(0, Math.round(Number(pending.fat || 0) * ratio)),
                fiber: Math.max(0, Math.round(Number(pending.fiber || 0) * ratio)),
                sugar: Math.max(0, Math.round(Number(pending.sugar || 0) * ratio)),
                sodium: Math.max(0, Math.round(Number(pending.sodium || 0) * ratio)),
                photo: pending.photo || beforePhotoSrc || base.photo,
                photoBefore: beforePhotoSrc,
                photoAfter: afterPhotoSrc,
                beforeCalories,
                afterCalories: remainingCalories,
                consumedCalories: Math.max(0, Math.round(consumed)),
                consumedRatio: Number(ratio.toFixed(2)),
                remainingRatio: beforeCalories > 0 ? Number(Math.min(1, remainingCalories / beforeCalories).toFixed(2)) : 0,
                comparisonNote,
                comparisonReliable: !afterIsLowTrust,
                mealSlot: pending.mealSlot || base.mealSlot,
                savedMealId: pending.savedMealId || pending.id || "",
                source: afterIsLowTrust ? "ai_before_after_photo_only" : "ai_before_after",
                phase: "final",
                nextAdvice: nextAdvice.text,
                mealPlan: pending.mealPlan || currentMealPlan || null,
                items: scaleMealItems(pending.items || base.items || [], ratio),
                corrected: Boolean(pending.corrected || base.corrected)
            };
        }

        function resolveAfterPhotoTargetMeal() {
            const pending = pendingBeforeMeal || safeJsonObject(localStorage.getItem(dailyKey('pendingBeforeMeal')));
            if (pending && (pending.savedMealId || pending.id || pending.photoBefore || pending.photo)) {
                return { ...pending, savedMealId: pending.savedMealId || pending.id || "" };
            }
            const meals = safeJsonArray(localStorage.getItem(dailyKey('meals')));
            const latest = [...meals].reverse().find(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            return latest ? { ...latest, savedMealId: latest.id || "" } : null;
        }

        function attachAfterPhotoToRecentMeal(candidateMeal) {
            const target = resolveAfterPhotoTargetMeal();
            if (!target || !target.savedMealId) return null;
            const beforeCalories = Math.max(0, Math.round(Number(target.beforeCalories || target.calories || 0)));
            const afterCalories = Math.max(0, Math.round(Number(candidateMeal.afterCalories || candidateMeal.calories || 0)));
            const fallbackPatch = {
                ...target,
                photoAfter: candidateMeal.photoAfter || candidateMeal.photo || "",
                afterCalories,
                consumedCalories: beforeCalories || Math.max(0, Math.round(Number(target.calories || 0))),
                consumedRatio: 1,
                remainingRatio: beforeCalories > 0 ? Number(Math.min(1, afterCalories / beforeCalories).toFixed(2)) : 0,
                comparisonReliable: false,
                comparisonNote: "飯後照已補進這餐。AI 若信心不足，先保留餐前熱量，照片仍會留在回憶裡。",
                source: "ai_before_after_photo_only",
                nextAdvice: candidateMeal.nextAdvice || getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories).text
            };
            return updateSavedMeal(target.savedMealId, fallbackPatch);
        }

        function isLowTrustAfterEstimate(afterMeal, beforeCalories, remainingCalories) {
            const source = String(afterMeal.source || "");
            if (afterMeal.confidence === "low") return true;
            if (/fallback|pending|unknown|local_text_unknown|manual_photo_fallback/.test(source)) return true;
            if (beforeCalories > 0 && remainingCalories >= beforeCalories * 0.95) return true;
            return false;
        }

        function buildMealComparisonNote(beforeCalories, remainingCalories, consumedCalories, lowTrust, afterMeal) {
            if (!beforeCalories) return "沒有餐前熱量基準，這張飯後照先作為回憶保存。";
            if (lowTrust) return "飯後照辨識信心不足，先保留餐前估算，只把飯後照片補進回憶。";
            const percent = Math.round((consumedCalories / beforeCalories) * 100);
            return `餐前 ${beforeCalories} kcal，飯後剩約 ${remainingCalories} kcal，估計吃下 ${consumedCalories} kcal（約 ${percent}%）。`;
        }

        function scaleMealItems(items, ratio) {
            if (!Array.isArray(items) || !items.length) return [];
            return items.map(item => ({
                ...item,
                portion: item.portion ? `${item.portion} · 已依吃下比例校正` : "已依吃下比例校正",
                calories: Math.max(0, Math.round(Number(item.calories || 0) * ratio)),
                protein: Math.max(0, Math.round(Number(item.protein || 0) * ratio)),
                carbs: Math.max(0, Math.round(Number(item.carbs || 0) * ratio)),
                fat: Math.max(0, Math.round(Number(item.fat || 0) * ratio)),
                fiber: Math.max(0, Math.round(Number(item.fiber || 0) * ratio)),
                sugar: Math.max(0, Math.round(Number(item.sugar || 0) * ratio)),
                sodium: Math.max(0, Math.round(Number(item.sodium || 0) * ratio))
            }));
        }

        function validateMealBeforeSave() {
            const name = String(selectedMealName || selectedMeal?.name || "").trim();
            const calories = Math.round(Number(selectedMealKcal || selectedMeal?.calories || 0));
            if (selectedMeal?.source === "photo_loading") return { ok: false, message: "照片還在分析中，請等熱量出現後再儲存。" };
            if (!name) return { ok: false, message: "這餐還沒有食物名稱，請補餐名或重新拍照。" };
            if (!Number.isFinite(calories) || calories <= 0) return { ok: false, message: "這餐熱量是 0 kcal，請先完成估算或輸入熱量。" };
            return { ok: true, name, calories };
        }

        function confirmAndStoreMeal() {
            const validation = validateMealBeforeSave();
            if (!validation.ok) {
                showToast(validation.message);
                return false;
            }
            if (selectedMeal.photoSessionId && selectedMeal.photoSessionId !== activePhotoSessionId) {
                showToast("這是上一張照片的結果，塔塔已改看最新照片，請等最新估算完成。");
                return;
            }
            if (selectedMeal.source === 'photo_pending' && (!selectedMealName || selectedMealKcal <= 0)) {
                showToast("照片已讀取，請先補上餐點名稱與熱量再儲存。");
                return;
            }
            document.getElementById('estimateModal').style.display = "none";
            document.getElementById('estimateResult').style.display = "none";
            const candidateMeal = buildFinalMealFromSelected();
            if (selectedMeal.photoSessionId && selectedMeal.photoSessionId === activePhotoSessionId) {
                activePhotoSessionId = Date.now();
            }
            if ((candidateMeal.phase || selectedMeal.phase) === "before") {
                const adviceObj = getNextMealSuggestion(new Date(), userData.targetCalories - (userData.consumedCalories + candidateMeal.calories));
                const advice = adviceObj.text;
                candidateMeal.photoBefore = candidateMeal.photo || "";
                candidateMeal.beforeCalories = candidateMeal.calories;
                candidateMeal.nextAdvice = advice;
                const meal = saveMeal(candidateMeal);
                const promiseWin = completeTomorrowMealPromiseIfDue(meal);
                userData.consumedCalories += meal.calories;
                userData.totalProtein += meal.protein;
                userData.totalFiber += meal.fiber || 0;
                userData.dietRecords.push(toDietRecord(meal));
                userData.streakDays = getStreak(currentUser);
                registerCourseMeal(meal);
                pendingBeforeMeal = { ...candidateMeal, savedMealId: meal.id };
                localStorage.setItem(dailyKey('pendingBeforeMeal'), JSON.stringify(pendingBeforeMeal));
                clearCurrentMealPlan();
                document.getElementById('exerciseAlert').style.display = "block";
                document.getElementById('exerciseAlert').innerHTML = `這餐先收進今天明細。飯後照可補拍校正，不強制。${advice}`;
                saveToStorage();
                updateOtterGrowth();
                updateUI(true);
                renderPostMealActionCard(meal, adviceObj);
                clearActivePhotoDraft();
                showToast(promiseWin ? `昨天約好的第一餐完成：${meal.name}` : `已收下這餐：${meal.name}（${meal.calories} kcal）`);
                tomaBubble.innerText = promiseWin ? `你有回來完成昨天約好的第一餐。塔塔有記得，今天就從這餐接著走。${advice}` : `這餐我先幫你看住了。${advice}`;
                reviveTataTomato();
                clearMealPlaceMemoryInputs();
                goToTodayMealMemory(meal.id);
                promptPlaceMemoryAfterSave(meal);
                return;
            }

            if (candidateMeal.phase === "final" && candidateMeal.savedMealId) {
                const updated = updateSavedMeal(candidateMeal.savedMealId, candidateMeal);
                if (updated) {
                    loadDailyStores();
                    clearCurrentMealPlan();
                    saveToStorage();
                    updateOtterGrowth();
                    updateUI(true);
                    renderPostMealActionCard(updated, getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories));
                    clearActivePhotoDraft();
                    showToast(`已用飯後照校正：${updated.name}（${updated.calories} kcal）`);
                    tomaBubble.innerText = updated.nextAdvice || getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories).text;
                    clearMealPlaceMemoryInputs();
                    goToTodayMealMemory(updated.id || candidateMeal.savedMealId);
                    return;
                }
            }

            if ((candidateMeal.phase || selectedMeal.phase) === "final" || (candidateMeal.phase || selectedMeal.phase) === "single_after") {
                const updated = attachAfterPhotoToRecentMeal(candidateMeal);
                if (updated) {
                    localStorage.removeItem(dailyKey('pendingBeforeMeal'));
                    pendingBeforeMeal = null;
                    clearCurrentMealPlan();
                    loadDailyStores();
                    saveToStorage();
                    updateOtterGrowth();
                    updateUI(true);
                    renderPostMealActionCard(updated, getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories));
                    clearActivePhotoDraft();
                    showToast(`飯後照已補到：${updated.name}`);
                    tomaBubble.innerText = updated.nextAdvice || "飯後照已補進回憶。這餐我先保留原估算，避免低信心 AI 亂扣熱量。";
                    clearMealPlaceMemoryInputs();
                    goToTodayMealMemory(updated.id || candidateMeal.savedMealId);
                    return;
                }
            }

            if ((candidateMeal.phase || selectedMeal.phase) === "before_disabled") {
                pendingBeforeMeal = candidateMeal;
                localStorage.setItem(dailyKey('pendingBeforeMeal'), JSON.stringify(candidateMeal));
                document.getElementById('exerciseAlert').style.display = "block";
                document.getElementById('exerciseAlert').innerHTML = `已儲存 ${candidateMeal.mealSlot || '這餐'}餐前照。吃完再拍一張飯後照，塔塔會扣掉剩餘量估算實際吃下。`;
                showToast("餐前照已存，吃完記得拍飯後照。");
                tomaBubble.innerText = "餐前照我收好了。吃完再拍一張，我會看剩下多少，幫你估實際吃下的熱量。";
                return;
            }

            candidateMeal.nextAdvice = candidateMeal.nextAdvice || getNextMealSuggestion(new Date(), userData.targetCalories - (userData.consumedCalories + Number(candidateMeal.calories || 0))).text;
            const meal = saveMeal(candidateMeal);
            const promiseWin = completeTomorrowMealPromiseIfDue(meal);
            userData.consumedCalories += meal.calories;
            userData.totalProtein += meal.protein;
            userData.totalFiber += meal.fiber || 0;
            userData.dietRecords.push(toDietRecord(meal));
            userData.streakDays = getStreak(currentUser);
            registerCourseMeal(meal);
            clearCurrentMealPlan();

            const adviceObj = getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories);
            const advice = meal.nextAdvice || adviceObj.text;
            meal.nextAdvice = advice;
            const lastRecord = userData.dietRecords[userData.dietRecords.length - 1];
            if (lastRecord && !lastRecord.nextAdvice) lastRecord.nextAdvice = advice;
            document.getElementById('exerciseAlert').style.display = "block";
            document.getElementById('exerciseAlert').innerHTML = `這餐已加入今天明細。${advice}`;

            saveToStorage();
            updateOtterGrowth();
            updateUI(true);
            renderPostMealActionCard(meal, adviceObj);
            clearActivePhotoDraft();

            // 🌟 修復 Bug 2：成就彈窗解耦為 2.5 秒自動解扣 Toast 提示
            showToast(promiseWin ? `昨天約好的第一餐完成：${meal.name}` : `已收下這餐：${meal.name}（${meal.calories} kcal）`);
            tomaBubble.innerText = promiseWin ? `你完成了昨天約好的第一餐。塔塔有把這次回來記住，明天會更容易。${advice}` : advice;
            reviveTataTomato();
            clearMealPlaceMemoryInputs();

            goToTodayMealMemory(meal.id);
        }

        function adjustWeight(amount) {
            const base = Number(localStorage.getItem(dailyKey('weight')) || userData.currentWeight || userData.accountWeightKg || 0);
            userData.currentWeight = Math.max(30, Math.min(250, Number(base + amount || 0)));
            document.getElementById('weightValueDisplay').innerHTML = `${userData.currentWeight.toFixed(1)} <span style="font-size:12px; color:var(--color-muted); font-weight:500;">kg</span>`;
            const weightInput = document.getElementById('weightDirectInput');
            if (weightInput) weightInput.value = userData.currentWeight.toFixed(1);
            if (currentUser) localStorage.setItem(dailyKey('weight'), userData.currentWeight.toFixed(1));
            markActive();
            reviveTataTomato();
            updateOtterGrowth();
            saveToStorage();
            syncRemoteDailyState(todayKeyDate());
            updateUI(false);
            renderProfileSyncCard("local");
        }

        function adjustHeight(amount) {
            userData.currentHeight = Math.max(140, Math.min(220, Math.round(Number(userData.currentHeight || 170) + amount)));
            const heightInput = document.getElementById('heightDirectInput');
            if (heightInput) heightInput.value = userData.currentHeight;
            markActive();
            saveToStorage();
            saveRemoteUserProfile();
            updateUI(false);
            renderProfileSyncCard("local");
        }

        function setTodayWeightFromInput() {
            const input = document.getElementById('weightDirectInput');
            const value = Number(input?.value);
            recordTodayWeight(value, "body");
        }

        function recordTodayWeight(value, source = "quick") {
            if (!Number.isFinite(value) || value < 30 || value > 250) {
                showToast("請輸入合理體重，例如 58.5");
                return false;
            }
            userData.currentWeight = Math.round(value * 10) / 10;
            if (currentUser) localStorage.setItem(dailyKey('weight'), userData.currentWeight.toFixed(1));
            const weightInput = document.getElementById('weightDirectInput');
            const quickInput = document.getElementById('todayWeightQuickInput');
            if (weightInput && document.activeElement !== weightInput) weightInput.value = userData.currentWeight.toFixed(1);
            if (quickInput && document.activeElement !== quickInput) quickInput.value = userData.currentWeight.toFixed(1);
            markActive();
            reviveTataTomato();
            updateOtterGrowth();
            saveToStorage();
            syncRemoteDailyState(todayKeyDate());
            updateUI(false);
            renderProfileSyncCard("local");
            showToast(`已記錄今日體重 ${userData.currentWeight.toFixed(1)} kg`);
            if (source === "quick") {
                const card = document.getElementById('todayWeightQuickCard');
                try { card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) {}
            }
            return true;
        }

        function setHeightFromInput() {
            const input = document.getElementById('heightDirectInput');
            const value = Number(input?.value);
            if (!Number.isFinite(value) || value < 120 || value > 230) {
                showToast("請輸入合理身高，例如 166");
                return;
            }
            userData.currentHeight = Math.round(value);
            markActive();
            saveToStorage();
            saveRemoteUserProfile();
            updateUI(false);
            renderProfileSyncCard("local");
            showToast(`已更新身高 ${userData.currentHeight} cm`);
        }

        function quickWeightDelta(amount) {
            const input = document.getElementById('weightDirectInput');
            const base = Number(input?.value || userData.currentWeight || 0);
            const next = Math.max(30, Math.min(250, Math.round((base + amount) * 10) / 10));
            if (input) input.value = next.toFixed(1);
            setTodayWeightFromInput();
        }

        function saveTodayWeightQuick() {
            const input = document.getElementById('todayWeightQuickInput');
            return recordTodayWeight(Number(input?.value), "quick");
        }

        function quickTodayWeightDelta(amount) {
            const input = document.getElementById('todayWeightQuickInput');
            const base = Number(input?.value || localStorage.getItem(dailyKey('weight')) || userData.currentWeight || userData.accountWeightKg || 0);
            const next = Math.max(30, Math.min(250, Math.round((base + amount) * 10) / 10));
            if (input) input.value = next.toFixed(1);
            return recordTodayWeight(next, "quick");
        }

        function openBodyQuickLog() {
            switchTabById('tab-body');
            setTimeout(() => {
                const input = document.getElementById('weightDirectInput');
                if (input) {
                    input.value = Number(userData.currentWeight || 0).toFixed(1);
                    input.focus();
                    input.select?.();
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 80);
        }

        function focusTodayWeightQuick() {
            const card = document.getElementById('todayWeightQuickCard');
            if (card) {
                try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) { card.scrollIntoView(); }
                setTimeout(() => {
                    const input = document.getElementById('todayWeightQuickInput');
                    if (input) {
                        input.focus();
                        input.select?.();
                    }
                }, 80);
                return false;
            }
            openBodyQuickLog();
            return false;
        }

        function getLifeLogKey(field, dateKey = todayKeyDate()) {
            return `paipachi:${currentUser}:${field}:${dateKey}`;
        }

        function getLifeLogState(dateKey = todayKeyDate()) {
            if (!currentUser) return { sleepHours: "", bowelState: "", energyState: "" };
            return {
                sleepHours: localStorage.getItem(getLifeLogKey('sleepHours', dateKey)) || "",
                bowelState: localStorage.getItem(getLifeLogKey('bowelState', dateKey)) || "",
                energyState: localStorage.getItem(getLifeLogKey('energyState', dateKey)) || ""
            };
        }

        function getLifeWellnessAdvice(dateKey = todayKeyDate()) {
            const state = getLifeLogState(dateKey);
            const sleep = Number(state.sleepHours || 0);
            const notes = [];
            const nudges = [];
            if (sleep && sleep < 6) {
                notes.push(`昨晚只睡 ${sleep} 小時`);
                nudges.push("今天別靠甜飲硬撐，下一餐用蛋白質、溫熱主食和水把精神拉穩。");
            } else if (sleep >= 7) {
                notes.push(`睡眠 ${sleep} 小時`);
            }
            if (state.energyState === "tired") {
                notes.push("活力偏累");
                nudges.push("先補水，再選好消化的蛋白質；咖啡可以，但甜點先延後。");
            } else if (state.energyState === "good") {
                notes.push("活力不錯");
            }
            if (state.bowelState === "none" || state.bowelState === "hard") {
                notes.push(state.bowelState === "hard" ? "排便偏硬" : "今天還沒排便");
                nudges.push("下一餐把纖維和水補上：青菜、菇類、地瓜、豆類都比炸物更適合。");
            } else if (state.bowelState === "loose") {
                notes.push("腸胃偏軟");
                nudges.push("下一餐先走清淡溫熱，少油、少辣、少奶茶，讓腸胃休息。");
            } else if (state.bowelState === "normal") {
                notes.push("排便順暢");
            }
            const mealNudge = nudges.length ? [...new Set(nudges)].join(" ") : "";
            const summary = notes.length ? `生活狀態：${notes.join("、")}。` : "";
            return { state, notes, mealNudge, summary };
        }

        function getLifeMemoryLabels(state = {}) {
            const sleep = Number(state.sleepHours || 0);
            const bowelMap = { normal: "順暢", none: "未排便", loose: "偏軟", hard: "偏硬" };
            const energyMap = { good: "有精神", ok: "普通", tired: "偏累" };
            const hasSleep = !!state.sleepHours;
            const hasBowel = !!state.bowelState;
            const hasEnergy = !!state.energyState;
            const sleepWarn = hasSleep && sleep < 6;
            const bowelWarn = state.bowelState === "none" || state.bowelState === "hard" || state.bowelState === "loose";
            const energyWarn = state.energyState === "tired";
            const completion = [hasSleep, hasBowel, hasEnergy].filter(Boolean).length;
            return {
                hasAny: completion > 0,
                completion,
                sleepText: hasSleep ? `${sleep} 小時` : "未記錄",
                bowelText: hasBowel ? (bowelMap[state.bowelState] || state.bowelState) : "未記錄",
                energyText: hasEnergy ? (energyMap[state.energyState] || state.energyState) : "未記錄",
                sleepWarn,
                bowelWarn,
                energyWarn
            };
        }

        function renderTodayLifeMemoryCard(dateKey = memorySelectedDate || todayKeyDate()) {
            const card = document.getElementById('todayLifeMemoryCard');
            if (!card) return;
            const isToday = dateKey === todayKeyDate();
            const advice = getLifeWellnessAdvice(dateKey);
            const labels = getLifeMemoryLabels(advice.state);
            card.classList.add('active');
            const body = labels.hasAny
                ? `${advice.summary || "生活狀態：已建立今天的身體感覺。"}${advice.mealNudge ? ` ${advice.mealNudge}` : " 塔塔會把這些狀態放進下一餐建議裡。"}`
                : `${isToday ? "今天" : "這天"}還沒有睡眠、排便與活力紀錄。這些不是壓力表，是讓塔塔更懂你等等該怎麼吃的線索。`;
            const action = isToday && !labels.hasAny
                ? `<button class="body-quick-btn" type="button" onclick="openLifeQuickLog()" style="margin-top:8px;">補生活狀態</button>`
                : "";
            card.innerHTML = `
                <div class="today-life-memory-top">
                    <div class="today-life-memory-title">生活狀態回憶</div>
                    <div class="today-life-memory-meta">${labels.completion}/3</div>
                </div>
                <div class="today-life-memory-body">${body}</div>
                ${action}
                <div class="today-life-memory-grid" aria-label="生活狀態明細">
                    <div class="today-life-memory-item${labels.sleepWarn ? ' warn' : ''}"><strong>${labels.sleepText}</strong><span>睡眠</span></div>
                    <div class="today-life-memory-item${labels.bowelWarn ? ' warn' : ''}"><strong>${labels.bowelText}</strong><span>排便</span></div>
                    <div class="today-life-memory-item${labels.energyWarn ? ' warn' : ''}"><strong>${labels.energyText}</strong><span>活力</span></div>
                </div>
            `;
        }

        function getPersonalDietMemoryDateKeys(limitDays = 21) {
            if (!currentUser) return [];
            const keys = new Set([todayKeyDate(), memorySelectedDate].filter(Boolean));
            (recentMemoryDates || []).forEach(item => {
                const key = item?.date || item?.key || item;
                if (key) keys.add(String(key));
            });
            const prefix = `paipachi:${currentUser}:meals:`;
            try {
                Object.keys(localStorage || {}).forEach(key => {
                    if (key.startsWith(prefix)) keys.add(key.slice(prefix.length));
                });
            } catch (error) {}
            const cutoff = new Date();
            cutoff.setHours(0, 0, 0, 0);
            cutoff.setDate(cutoff.getDate() - Math.max(1, limitDays - 1));
            return [...keys]
                .filter(Boolean)
                .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key))
                .filter(key => {
                    const date = new Date(`${key}T00:00:00`);
                    return Number.isFinite(date.getTime()) && date >= cutoff && date <= new Date(`${todayKeyDate()}T23:59:59`);
                })
                .sort((a, b) => String(b).localeCompare(String(a)));
        }

        function normalizeDietMemoryFoodName(name = "") {
            const cleaned = String(name || "")
                .replace(/[()（）【】\[\]{}]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            if (!cleaned || /^(餐點|未知餐點|食物|照片|飯前照|飯後照)$/i.test(cleaned)) return "";
            return cleaned.slice(0, 18);
        }

        function getMealDietIssueSignals(meal = {}) {
            const kcal = Number(meal.kcal || meal.calories || 0);
            const protein = Number(meal.protein || 0);
            const fiber = Number(meal.fiber || 0);
            const sugar = Number(meal.sugar || 0);
            const sodium = Number(meal.sodium || 0);
            const fat = Number(meal.fat || 0);
            const text = [
                meal.name,
                meal.nextAdvice,
                meal.placeNote,
                meal.restaurantNote,
                ...(Array.isArray(meal.items) ? meal.items.map(item => `${item.name || ""} ${item.category || ""}`) : [])
            ].join(" ");
            const signals = [];
            if (protein > 0 && protein < 20) signals.push("protein");
            if (fiber > 0 && fiber < 5) signals.push("fiber");
            if (sugar >= 20 || /奶茶|甜飲|可樂|蛋糕|甜點|冰淇淋|糖/.test(text)) signals.push("sugar");
            if (sodium >= 900 || /拉麵|泡麵|火鍋|麻辣|滷味|鹹酥|湯|醬|泡菜/.test(text)) signals.push("sodium");
            if (kcal >= 750) signals.push("calories");
            if (fat >= 30 || /炸|薯條|雞排|鹽酥|鹹酥|奶油|培根|披薩|漢堡/.test(text)) signals.push("fried");
            return [...new Set(signals)];
        }

        function getPersonalDietMemoryProfile(limitDays = 21) {
            const dateKeys = getPersonalDietMemoryDateKeys(limitDays);
            const seen = new Set();
            const meals = [];
            dateKeys.forEach(dateKey => {
                (getMealsForDate(dateKey) || []).forEach((meal, index) => {
                    const key = meal.id || `${dateKey}:${meal.time || ""}:${meal.name || ""}:${index}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    meals.push({ ...meal, memoryDate: dateKey });
                });
            });
            const foodCounts = new Map();
            const placeCounts = new Map();
            const issueCounts = new Map();
            let photoCount = 0;
            let placeMealCount = 0;
            meals.forEach(meal => {
                if (meal.photoBefore || meal.photo || meal.photoAfter) photoCount += 1;
                const names = [meal.name, ...(Array.isArray(meal.items) ? meal.items.map(item => item.name) : [])]
                    .map(normalizeDietMemoryFoodName)
                    .filter(Boolean);
                [...new Set(names)].forEach(name => foodCounts.set(name, (foodCounts.get(name) || 0) + 1));
                const placeName = normalizeDietMemoryFoodName(meal.placeName || meal.restaurantName || meal.locationName || "");
                const hasLocation = placeName || Number.isFinite(Number(meal.locationLatitude)) || Number.isFinite(Number(meal.locationLongitude));
                if (hasLocation) {
                    placeMealCount += 1;
                    const key = placeName || `定位 ${Number(meal.locationLatitude || 0).toFixed(3)},${Number(meal.locationLongitude || 0).toFixed(3)}`;
                    placeCounts.set(key, (placeCounts.get(key) || 0) + 1);
                }
                getMealDietIssueSignals(meal).forEach(issue => issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1));
            });
            const topFoods = [...foodCounts.entries()]
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'))
                .slice(0, 4)
                .map(([name, count]) => ({ name, count }));
            const topPlaces = [...placeCounts.entries()]
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'))
                .slice(0, 3)
                .map(([name, count]) => ({ name, count }));
            const issueMeta = {
                protein: { label: "蛋白質偏少", action: "下一餐先放一掌心雞、魚、蛋、豆腐或豆製品，再看主食份量。" },
                fiber: { label: "蔬菜纖維偏少", action: "下一餐加兩拳青菜、菇類、海帶或豆類，讓飽足感先穩住。" },
                sugar: { label: "糖分偏高", action: "下一餐飲料改無糖，甜點延後，主食正常吃不要再疊糖。" },
                sodium: { label: "鈉與醬湯偏高", action: "下一餐湯喝一半以下、醬料分開，優先吃料和蛋白質。" },
                calories: { label: "熱量餐偏多", action: "下一餐用半份主食加蛋白質收斂，不用挨餓但先別加大。" },
                fried: { label: "炸物油脂偏多", action: "下一餐把炸物換成滷、烤、蒸或水煮，飲料選水或無糖。" }
            };
            const issueList = [...issueCounts.entries()]
                .map(([key, count]) => ({ key, count, ...(issueMeta[key] || { label: key, action: "下一餐先拍照，塔塔會幫你校正。" }) }))
                .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-Hant'));
            const topIssue = issueList[0] || { key: "balance", count: 0, label: "資料累積中", action: "先連續拍早餐、午餐、晚餐，塔塔會開始看出你的習慣。" };
            const latestMeal = [...meals].sort((a, b) => {
                const aTime = new Date(a.capturedAt || a.createdAt || `${a.memoryDate || todayKeyDate()}T${a.time || "23:59"}`).getTime();
                const bTime = new Date(b.capturedAt || b.createdAt || `${b.memoryDate || todayKeyDate()}T${b.time || "23:59"}`).getTime();
                return bTime - aTime;
            })[0] || null;
            const dayCount = new Set(meals.map(meal => meal.memoryDate).filter(Boolean)).size;
            const goalLabel = getGoalLabel(userData.selectedTone || "slim");
            const nextAction = topIssue.action || "下一餐先拍飯前照，塔塔會用你的目標校正建議。";
            return {
                mealCount: meals.length,
                dayCount,
                photoCount,
                placeMealCount,
                placeCount: placeCounts.size,
                topFoods,
                topPlaces,
                issueList,
                topIssue,
                latestMeal,
                goalLabel,
                nextAction
            };
        }

        function renderPersonalDietMemoryCard(dateKey = memorySelectedDate || todayKeyDate()) {
            const card = document.getElementById('personalDietMemoryCard');
            if (!card) return;
            const profile = getPersonalDietMemoryProfile(21);
            card.classList.add('active');
            if (!profile.mealCount) {
                card.innerHTML = `
                    <div class="personal-diet-memory-top">
                        <div class="personal-diet-memory-title">個人飲食輪廓</div>
                        <div class="personal-diet-memory-meta">等第一餐</div>
                    </div>
                    <div class="personal-diet-memory-body">TATA 會從你拍下的每一餐開始記住：常吃什麼、常去哪裡、哪些習慣要慢慢改善。先拍一餐，這裡就會開始長出你的飲食資料庫。</div>
                    <div class="personal-diet-memory-actions">
                        <button class="personal-diet-memory-action primary" type="button" onclick="openPhotoSourceSheet('before')">拍第一餐</button>
                        <button class="personal-diet-memory-action" type="button" onclick="openMealDecisionCoach('等等吃什麼')">問塔塔</button>
                    </div>
                `;
                return;
            }
            const foodText = profile.topFoods.length
                ? profile.topFoods.map(food => `${food.name} ${food.count}次`).join("、")
                : "累積中";
            const placeText = profile.placeCount
                ? `${profile.placeCount} 個地點 / ${profile.placeMealCount} 餐`
                : "尚未記住地點";
            const placeTags = profile.topPlaces.map(place => `<span class="personal-diet-memory-tag">${place.name} ${place.count}次</span>`).join('');
            const issueTags = profile.issueList.slice(0, 3).map(issue => `<span class="personal-diet-memory-tag">${issue.label} ${issue.count}次</span>`).join('');
            const latestText = profile.latestMeal ? `${profile.latestMeal.name || "最近一餐"} · ${profile.latestMeal.kcal || profile.latestMeal.calories || 0} kcal` : "累積中";
            card.innerHTML = `
                <div class="personal-diet-memory-top">
                    <div class="personal-diet-memory-title">個人飲食輪廓</div>
                    <div class="personal-diet-memory-meta">${profile.dayCount} 天 · ${profile.mealCount} 餐</div>
                </div>
                <div class="personal-diet-memory-body">TATA 正在把你的餐點變成長期記憶：常吃食物、常去地點、反覆出現的營養問題，下一餐都會拿來調整建議。現在目標是「${profile.goalLabel}」。</div>
                <div class="personal-diet-memory-grid">
                    <div class="personal-diet-memory-cell"><strong>常吃</strong><span>${foodText}</span></div>
                    <div class="personal-diet-memory-cell"><strong>店 / 地點</strong><span>${placeText}</span></div>
                    <div class="personal-diet-memory-cell"><strong>常見問題</strong><span>${profile.topIssue.label}</span></div>
                    <div class="personal-diet-memory-cell"><strong>最近一餐</strong><span>${latestText}</span></div>
                </div>
                <div class="personal-diet-memory-tags">${issueTags}${placeTags || '<span class="personal-diet-memory-tag">地點記憶累積中</span>'}</div>
                <div class="personal-diet-memory-next">下一個小改善：${profile.nextAction}</div>
                <div class="personal-diet-memory-actions">
                    <button class="personal-diet-memory-action primary" type="button" onclick="openMealDecisionCoach('根據我的飲食記憶下一餐怎麼吃')">用記憶問下一餐</button>
                    <button class="personal-diet-memory-action" type="button" onclick="openPhotoSourceSheet('before')">拍下一餐</button>
                </div>
            `;
        }

        function renderLifeQuickLogSummary() {
            const summary = document.getElementById('lifeQuickLogSummary');
            const sleepInput = document.getElementById('sleepHoursInput');
            const bowelInput = document.getElementById('bowelStateInput');
            const energyInput = document.getElementById('energyStateInput');
            if (!summary) return;
            const state = getLifeLogState();
            if (sleepInput && document.activeElement !== sleepInput) sleepInput.value = state.sleepHours;
            if (bowelInput && document.activeElement !== bowelInput) bowelInput.value = state.bowelState;
            if (energyInput && document.activeElement !== energyInput) energyInput.value = state.energyState;
            const bowelMap = { normal: "順暢", none: "今天還沒有", loose: "偏軟/拉肚子", hard: "偏硬/便秘" };
            const energyMap = { good: "有精神", ok: "普通", tired: "偏累" };
            const parts = [];
            if (state.sleepHours) parts.push(`睡 ${state.sleepHours} 小時`);
            if (state.bowelState) parts.push(`排便：${bowelMap[state.bowelState] || state.bowelState}`);
            if (state.energyState) parts.push(`活力：${energyMap[state.energyState] || state.energyState}`);
            summary.innerText = parts.length ? `今天已記錄：${parts.join('、')}。` : "今天尚未記錄睡眠、排便與活力。";
        }

        function renderNutritionSummary(leftCalories = null) {
            const status = getNutritionStatus(leftCalories);
            const proteinText = document.getElementById('proteinNeedText');
            const fiberText = document.getElementById('fiberNeedText');
            const waterText = document.getElementById('waterNeedText');
            const calorieText = document.getElementById('calorieNeedText');
            const sugarText = document.getElementById('sugarNeedText');
            const sodiumText = document.getElementById('sodiumNeedText');
            const adviceEl = document.getElementById('dailyNutritionAdvice');
            if (proteinText) proteinText.innerText = `${status.proteinNow} / ${status.targets.protein}g`;
            if (fiberText) fiberText.innerText = `${status.fiberNow} / ${status.targets.fiber}g`;
            if (waterText) waterText.innerText = `${status.waterNow} / ${status.targets.water}ml`;
            if (calorieText) calorieText.innerText = `${status.caloriesLeft} kcal`;
            if (sugarText) sugarText.innerText = status.sugarOver > 0 ? `超 ${status.sugarOver}g` : `${status.sugarNow} / ${status.targets.sugar}g`;
            if (sodiumText) sodiumText.innerText = status.sodiumOver > 0 ? `超 ${status.sodiumOver}mg` : `${status.sodiumNow} / ${status.targets.sodium}mg`;
            setMiniBar('proteinNeedBar', status.proteinNow, status.targets.protein);
            setMiniBar('fiberNeedBar', status.fiberNow, status.targets.fiber);
            setMiniBar('waterNeedBar', status.waterNow, status.targets.water);
            setMiniBar('calorieNeedBar', Math.max(0, Number(userData.targetCalories || 0) - status.caloriesLeft), Number(userData.targetCalories || 0));
            setMiniBar('sugarNeedBar', status.sugarNow, status.targets.sugar);
            setMiniBar('sodiumNeedBar', status.sodiumNow, status.targets.sodium);
            renderWaterRhythm(status);
            renderWaterReminderCard(status);
            renderTodayDecisionBrief(status);
            if (adviceEl) {
                const next = getNextMealSuggestion(new Date(), status.caloriesLeft, status);
                const historyContext = getP3HistoryContextLine(status);
                const sugarLine = status.sugarOver > 0 ? `糖超 ${status.sugarOver}g` : `糖還有 ${status.sugarLeft}g`;
                const sodiumLine = status.sodiumOver > 0 ? `鈉超 ${status.sodiumOver}mg` : `鈉還有 ${status.sodiumLeft}mg`;
                adviceEl.innerText = `${historyContext ? `${historyContext} ` : ""}今天已攝取蛋白質 ${status.proteinNow}g、纖維 ${status.fiberNow}g、水 ${status.waterNow}ml；還差蛋白質 ${status.proteinGap}g、纖維 ${status.fiberGap}g、水 ${status.waterGap}ml，${sugarLine}、${sodiumLine}。下一餐：${next.focus || "均衡"}。`;
            }
            return status;
        }

        function getDailyCoreSnapshot() {
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const water = Math.max(0, Math.round(Number(userData.waterMl || 0)));
            const todayWeight = currentUser ? localStorage.getItem(dailyKey('weight')) : "";
            const life = getLifeLogState();
            const lifeCount = [life.sleepHours, life.bowelState, life.energyState].filter(Boolean).length;
            const waitingAfter = meals.some(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            const advice = getNextMealSuggestion(new Date(), userData.targetCalories - userData.consumedCalories);
            const lifeAdvice = advice.lifeAdvice || getLifeWellnessAdvice();
            const activePlan = hasActiveMealPlan() ? currentMealPlan : null;
            const askedMealDecision = Boolean(activePlan || localStorage.getItem(dailyKey('lastCoachQuestion')));
            const chips = [
                { key: "meal", label: "吃飯", value: meals.length ? `${meals.length} 餐` : "待拍", done: meals.length > 0, warn: waitingAfter },
                { key: "water", label: "喝水", value: `${water}ml`, done: water >= 1000, warn: water > 0 && water < 1000 },
                { key: "weight", label: "體重", value: todayWeight ? `${todayWeight}kg` : "待記", done: !!todayWeight },
                { key: "life", label: "拉撒睡", value: lifeCount ? `${lifeCount}/3` : "待記", done: lifeCount >= 2, warn: lifeCount === 1 },
                { key: "ask", label: "問餐", value: askedMealDecision ? "有方向" : "可問", done: askedMealDecision, warn: meals.length > 0 && !askedMealDecision }
            ];
            const completed = chips.filter(chip => chip.done).length;
            const completionText = completed >= 4 ? "今天很完整" : (completed >= 2 ? "節奏成形" : "剛開始");
            let next = { text: "先拍第一餐，塔塔才有今天的起點。", action: "openPhotoSourceSheet('before')", label: "拍照 / 選照片" };
            if (!meals.length) next = { text: `先留下第一餐。拍照後，下一餐會依 ${advice.focus} 來建議。`, action: "openPhotoSourceSheet('before')", label: "拍照 / 選照片" };
            else if (waitingAfter) next = { text: "最近一餐可以補飯後照，讓回憶和熱量更接近實際吃下。", action: "startLatestAfterPhoto(event)", label: "補飯後照" };
            else if (activePlan) next = { text: `已排好「${activePlan.foodName}」。到店或開飯前直接拍，塔塔會重新校正這次份量。`, action: "resumeCurrentMealPlan(event)", label: "繼續這餐" };
            else if (water < 1000) next = { text: `水目前 ${water}ml，先補一杯，塔塔狀態會更穩。`, action: "focusTodayWaterQuick()", label: "記喝水" };
            else if (!todayWeight) next = { text: "今天體重還沒記。輸入一次就好，不用每天調身高體重設定。", action: "openBodyQuickLog()", label: "記體重" };
            else if (lifeCount < 2) next = { text: "補一下睡眠、排便或活力，之後趨勢會更像生活紀錄。", action: "focusTodayLifeQuick()", label: "記生活狀態" };
            else if (lifeAdvice.mealNudge) next = { text: `${lifeAdvice.summary}${lifeAdvice.mealNudge}`, action: "openMealDecisionCoach('等等吃什麼')", label: "問吃什麼" };
            else next = { text: `今天打卡骨架已成形。下一餐主軸：${advice.focus}。`, action: "openMealDecisionCoach('等等吃什麼')", label: "問吃什麼" };
            return { chips, next, completed, total: chips.length, completionText };
        }

        function renderDailyCoreCard() {
            const statusEl = document.getElementById('dailyCoreStatus');
            const nextEl = document.getElementById('dailyCoreNext');
            const scoreEl = document.getElementById('dailyCoreScore');
            const progressEl = document.getElementById('dailyCoreProgressFill');
            if (!statusEl || !nextEl) return;
            const snapshot = getDailyCoreSnapshot();
            if (scoreEl) scoreEl.innerHTML = `<strong>${snapshot.completed}/${snapshot.total}</strong>${snapshot.completionText}`;
            if (progressEl) progressEl.style.width = `${Math.round((snapshot.completed / Math.max(1, snapshot.total)) * 100)}%`;
            statusEl.innerHTML = snapshot.chips.map(chip => `
                <div class="daily-core-chip${chip.done ? ' done' : ''}${chip.warn ? ' warn' : ''}">
                    <strong>${chip.value}</strong>
                    <span>${chip.label}</span>
                </div>
            `).join('');
            nextEl.innerHTML = `<strong>下一步：</strong>${snapshot.next.text} <button class="body-quick-btn" type="button" onclick="${snapshot.next.action}" style="margin-left:6px;">${snapshot.next.label}</button>`;
            renderDailyCoreMission();
            renderDailyCoreRoutine(snapshot);
            renderDailyCoreActionHub(snapshot);
        }

        function renderDailyCoreMission(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const missionEl = document.getElementById('dailyCoreMission');
            if (!missionEl) return;
            const mission = getTodayReturnMission(status, growth);
            const next = mission.next || {};
            const pendingAfterItems = getPendingAfterPhotoMeals(userData.dietRecords || []);
            const latestPendingAfter = pendingAfterItems[pendingAfterItems.length - 1];
            const afterLock = latestPendingAfter ? renderDailyCoreAfterLock(latestPendingAfter) : "";
            missionEl.innerHTML = `
                <div class="daily-core-mission-top">
                    <div class="daily-core-mission-title">今日主線：${next.title || '先拍第一餐'}</div>
                    <div class="daily-core-mission-meta">${mission.doneCount}/${mission.totalMissions} 任務</div>
                </div>
                <div class="daily-core-mission-body">${next.body || '下一步只做一件事就好，塔塔會把今天整理起來。'}</div>
                ${afterLock}
                <div class="daily-core-mission-actions">
                    <button class="daily-core-mission-action primary" type="button" onclick="${next.primaryAction || "openPhotoSourceSheet('before')"}">${next.primaryLabel || '開始'}</button>
                    <button class="daily-core-mission-action" type="button" onclick="${next.secondaryAction || "openMealDecisionCoach('等等吃什麼')"}">${next.secondaryLabel || '問塔塔'}</button>
                </div>
            `;
        }

        function renderDailyCoreAfterLock(item) {
            const meal = item?.meal || {};
            const index = Math.max(0, Number(item?.index || 0));
            const slot = meal.mealSlot || "這餐";
            const name = shortNextAdvice(meal.name || "餐點照片");
            const kcal = Math.round(Number(meal.kcal || meal.calories || meal.beforeCalories || 0));
            const meta = `${slot} · ${name}${kcal ? ` · 飯前估 ${kcal} kcal` : ""}`;
            return `
                <div class="daily-core-after-lock">
                    <div>
                        <strong>吃完這餐，補回同一筆</strong>
                        <span>${meta}。不用重建紀錄，飯後照會直接校正這餐。</span>
                    </div>
                    <button type="button" onclick="startAfterPhotoForMeal(${index}, event)">補飯後</button>
                </div>
            `;
        }

        function getDailyCoreRoutineItems(snapshot = getDailyCoreSnapshot()) {
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const waitingAfter = meals.some(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            const waterTarget = getDailyNutritionTargets().water || DAILY_GUIDELINES.waterMl;
            const water = Math.max(0, Math.round(Number(userData.waterMl || 0)));
            const todayWeight = Number(localStorage.getItem(dailyKey('weight')) || 0);
            const lifeState = getLifeLogState();
            const sleep = Number(lifeState.sleepHours || 0);
            const hasLife = Boolean(lifeState.sleepHours || lifeState.bowelState || lifeState.energyState);
            const askedOrPlanned = hasActiveMealPlan() || snapshot?.next?.label === "問吃什麼" || Boolean(localStorage.getItem(dailyKey('lastCoachQuestion')));
            return [
                { label: "吃", meta: waitingAfter ? "補飯後" : (meals.length ? `${meals.length}餐` : "先拍"), done: meals.length > 0 && !waitingAfter, warn: waitingAfter },
                { label: "喝", meta: water >= waterTarget ? "達標" : `${water}ml`, done: water >= waterTarget, warn: water > 0 && water < waterTarget },
                { label: "體重", meta: todayWeight ? `${todayWeight.toFixed(1)}kg` : "待記", done: Boolean(todayWeight) },
                { label: "拉撒睡", meta: hasLife ? `${sleep ? `${sleep}h ` : ""}${getLifeMemoryLabels(lifeState).bowelText}`.trim() : "待記", done: hasLife, warn: hasLife && (sleep && sleep < 6 || ["none", "hard", "loose"].includes(lifeState.bowelState)) },
                { label: "下一餐", meta: askedOrPlanned ? "有方向" : "可問", done: Boolean(askedOrPlanned), warn: !meals.length }
            ];
        }

        function renderDailyCoreRoutine(snapshot = getDailyCoreSnapshot()) {
            const routine = document.getElementById('dailyCoreRoutine');
            if (!routine) return;
            routine.innerHTML = getDailyCoreRoutineItems(snapshot).map(item => `
                <div class="daily-core-routine-item${item.done ? ' done' : ''}${item.warn ? ' warn' : ''}">
                    <strong>${item.label}</strong>
                    <span>${item.meta}</span>
                </div>
            `).join('');
        }

        function getDailyCoreActionHubItems(snapshot = getDailyCoreSnapshot()) {
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const mealCount = meals.length;
            const waitingAfter = meals.some(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            const todayWeight = Number(localStorage.getItem(dailyKey('weight')) || 0);
            const lifeState = getLifeLogState();
            const lifeCount = [lifeState.sleepHours, lifeState.bowelState, lifeState.energyState].filter(Boolean).length;
            const waterTarget = getDailyNutritionTargets().water || DAILY_GUIDELINES.waterMl;
            const waterDone = Number(userData.waterMl || 0) >= waterTarget;
            const waterLabel = `${Math.round(userData.waterMl || 0)}/${waterTarget}ml`;
            return [
                {
                    label: waitingAfter ? "飯後補拍" : mealCount ? "拍下一餐" : "吃飯拍照",
                    meta: mealCount ? `${mealCount} 餐已記` : "飯前照優先",
                    action: waitingAfter ? "startLatestAfterPhoto(event)" : "openPhotoSourceSheet('before')",
                    primary: true,
                    done: mealCount > 0
                },
                {
                    label: "喝水",
                    meta: waterDone ? "水分達標" : waterLabel,
                    action: "focusTodayWaterQuick()",
                    done: waterDone,
                    warn: !waterDone
                },
                {
                    label: "今日體重",
                    meta: todayWeight ? `${todayWeight.toFixed(1)} kg` : "輸入一次",
                    action: "focusTodayWeightQuick()",
                    done: Boolean(todayWeight)
                },
                {
                    label: "睡/排便",
                    meta: lifeCount >= 2 ? "生活已記" : `${lifeCount}/3 項`,
                    action: "focusTodayLifeQuick()",
                    done: lifeCount >= 2
                },
                {
                    label: "問吃什麼",
                    meta: snapshot?.next?.label === "問吃什麼" ? "照缺口建議" : "塔塔幫你選",
                    action: "openMealDecisionCoach('等等吃什麼')",
                    warn: mealCount === 0
                },
                {
                    label: "看今天",
                    meta: mealCount ? "照片與熱量" : "先建立回憶",
                    action: "openTodayMemory()",
                    done: mealCount > 0
                }
            ];
        }

        function renderDailyCoreActionHub(snapshot = getDailyCoreSnapshot()) {
            const hub = document.getElementById('dailyCoreActionHub');
            if (!hub) return;
            hub.innerHTML = getDailyCoreActionHubItems(snapshot).map(item => `
                <button class="daily-core-action${item.primary ? ' primary' : ''}${item.done ? ' done' : ''}${item.warn ? ' warn' : ''}" type="button" onclick="${item.action}">
                    <span>${item.label}</span>
                    <small>${item.meta}</small>
                </button>
            `).join('');
        }

        function getPendingAfterPhotoMeals(meals = userData.dietRecords || []) {
            return (Array.isArray(meals) ? meals : [])
                .map((meal, index) => ({ meal, index }))
                .filter(item => (item.meal.photoBefore || item.meal.photo) && !item.meal.photoAfter);
        }

        function renderDailyTableCard() {
            const card = document.getElementById('dailyTableCard');
            if (!card) return;
            const flow = getMealFlowState();
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const pendingMeal = resolveAfterPhotoTargetMeal();
            const pendingAfterMeals = getPendingAfterPhotoMeals(meals);
            const firstPendingAfter = pendingAfterMeals[0]?.meal || pendingMeal;
            const waterTarget = getDailyNutritionTargets().water || DAILY_GUIDELINES.waterMl;
            const waterMl = Math.round(userData.waterMl || 0);
            const todayWeight = Number(localStorage.getItem(dailyKey('weight')) || 0);
            const steps = [
                { label: "飯前拍", meta: "估份量", done: flow.beforeDone, current: flow.step === 1 },
                { label: "先吃飯", meta: "存餐前", done: flow.beforeDone && flow.step > 2, current: flow.step === 2 },
                { label: "飯後補", meta: "扣剩量", done: flow.afterDone, current: flow.step === 3 },
                { label: "看今天", meta: "回憶", done: meals.length > 0, current: flow.step === 4 }
            ];
            let title = flow.title || "吃飯前，先拍一下";
            let body = flow.body || "吃飯前拍照是主線；吃完可補飯後照，塔塔會把照片、熱量和下一餐建議接在同一天。";
            if (firstPendingAfter) {
                title = `這餐等飯後照：${firstPendingAfter.name || firstPendingAfter.mealSlot || "剛剛那餐"}`;
                body = "不用重開新紀錄。飯後照片會補回同一餐，用剩餘量校正實際吃下，也會一起進今天回憶。";
            } else if (meals.length > 0 && flow.type === "before") {
                title = "下一餐再拍一下就好";
                body = `今天已留下 ${meals.length} 餐。下一餐打開直接拍，塔塔會依今天缺的蛋白質、纖維、水分、糖與鈉給建議。`;
            }
            const secondaryAction = firstPendingAfter ? "openTodayMemory()" : "openMealDecisionCoach('等等吃什麼')";
            const secondaryLabel = firstPendingAfter ? "看今天" : "問吃什麼";
            const pendingAlert = pendingAfterMeals.length
                ? `<div class="daily-table-alert active"><strong>今天有 ${pendingAfterMeals.length} 餐可補飯後照</strong><span>${pendingAfterMeals.map(item => `${item.meal.mealSlot || '餐點'}「${item.meal.name || '未命名'}」`).slice(0, 2).join('、')}。補回同一餐，不會新增亂掉的紀錄。</span></div>`
                : "";
            card.innerHTML = `
                <div class="daily-table-top">
                    <div>
                        <div class="daily-table-kicker">今日餐桌</div>
                        <div class="daily-table-title">${title}</div>
                    </div>
                    <div class="daily-table-pill">${flow.pill || "吃飯主線"}</div>
                </div>
                <div class="daily-table-body">${body}</div>
                ${pendingAlert}
                <div class="daily-table-flow" aria-label="今日吃飯主流程">
                    ${steps.map(step => `
                        <div class="daily-table-step${step.done ? ' done' : ''}${step.current ? ' current' : ''}">
                            <strong>${step.label}</strong>
                            <span>${step.done ? '完成' : step.meta}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="daily-table-actions">
                    <button class="daily-table-action primary" type="button" onclick="${flow.primaryAction || "openPhotoSourceSheet('before')"}">${flow.primaryLabel || "飯前拍 / 選照片"}</button>
                    <button class="daily-table-action" type="button" onclick="${secondaryAction}">${secondaryLabel}</button>
                </div>
                <div class="daily-table-micro" aria-label="今日生活摘要">
                    <div class="daily-table-chip">餐照<br>${meals.length ? `${meals.length} 餐` : "待開始"}</div>
                    <div class="daily-table-chip">喝水<br>${waterMl}/${waterTarget}ml</div>
                    <div class="daily-table-chip">體重<br>${todayWeight ? `${todayWeight.toFixed(1)}kg` : "今日未記"}</div>
                </div>
            `;
        }

        function getCourseSession() {
            const saved = safeJsonObject(localStorage.getItem(dailyKey('courseSession')));
            if (!saved || !saved.id) return { active: false, courses: [] };
            return { ...saved, courses: Array.isArray(saved.courses) ? saved.courses : [] };
        }

        function saveCourseSession(session) {
            if (!currentUser || !session) return;
            localStorage.setItem(dailyKey('courseSession'), JSON.stringify({
                ...session,
                courses: Array.isArray(session.courses) ? session.courses : []
            }));
        }

        function startCourseMode() {
            const session = {
                id: `course_${Date.now()}`,
                active: true,
                name: `${getMealSlot(new Date())}聚餐`,
                startedAt: new Date().toISOString(),
                courses: [],
                totalCalories: 0
            };
            saveCourseSession(session);
            setCoachMessage("已開啟聚餐/套餐模式。接下來每一道都可以拍一下，塔塔會把它們收進同一場聚餐回憶。");
            showToast("聚餐模式已開啟，先拍第一道。");
            renderCourseModeCard();
            prepareCourseNextPhoto();
        }

        function prepareCourseNextPhoto() {
            const session = getCourseSession();
            if (!session.active) {
                startCourseMode();
                return;
            }
            const nextIndex = (session.courses?.length || 0) + 1;
            currentMealPlan = {
                id: `course_plan_${session.id}_${nextIndex}`,
                route: "course",
                routeLabel: session.name || "聚餐逐道記錄",
                foodName: `第 ${nextIndex} 道菜`,
                focus: "逐道拍照",
                targetKcal: "",
                mealSlot: getMealSlot(new Date()),
                time: "",
                body: "聚餐、套餐、火鍋或無菜單料理可以逐道拍。每一道先估一次，最後再看總量，不用把整桌硬塞成一餐。",
                courseSessionId: session.id,
                courseIndex: nextIndex,
                createdAt: new Date().toISOString()
            };
            localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
            renderSelectedDecisionCard({ title: currentMealPlan.routeLabel, body: currentMealPlan.body }, currentMealPlan.foodName, currentMealPlan);
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            if (quickInput) quickInput.value = "";
            if (manualInput) manualInput.value = "";
            switchTabById('tab-photo');
            setCoachMessage(`準備記錄 ${currentMealPlan.foodName}。拍照後會列入「${session.name}」同一場聚餐。`);
            openPhotoSourceSheet('before');
        }

        function openCourseFinalPhoto() {
            const session = getCourseSession();
            if (!session.active) {
                showToast("先開啟聚餐模式，再拍完食照。");
                return;
            }
            currentMealPlan = {
                id: `course_final_${session.id}`,
                route: "course_final",
                routeLabel: `${session.name || "聚餐"}完食校正`,
                foodName: "完食桌面剩餘量",
                focus: "完食校正",
                targetKcal: "",
                mealSlot: getMealSlot(new Date()),
                body: "最後拍桌面剩餘量、湯底、飲料和醬料，塔塔會提醒哪些可能讓總熱量或鈉偏高。",
                courseSessionId: session.id,
                createdAt: new Date().toISOString()
            };
            localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
            renderSelectedDecisionCard({ title: currentMealPlan.routeLabel, body: currentMealPlan.body }, currentMealPlan.foodName, currentMealPlan);
            switchTabById('tab-photo');
            openPhotoSourceSheet('after');
        }

        function registerCourseMeal(meal) {
            const plan = meal?.mealPlan || currentMealPlan || {};
            if (!/^course/.test(String(plan.route || ""))) return;
            const session = getCourseSession();
            if (!session.active || (plan.courseSessionId && session.id !== plan.courseSessionId)) return;
            const courses = Array.isArray(session.courses) ? [...session.courses] : [];
            const entry = {
                mealId: meal.id || "",
                index: plan.courseIndex || courses.length + 1,
                name: meal.name || plan.foodName || `第 ${courses.length + 1} 道`,
                calories: Math.max(0, Math.round(Number(meal.calories || meal.kcal || 0))),
                photo: meal.photoBefore || meal.photo || meal.photoAfter || "",
                savedAt: new Date().toISOString()
            };
            if (!courses.some(course => course.mealId && course.mealId === entry.mealId)) courses.push(entry);
            saveCourseSession({
                ...session,
                courses,
                totalCalories: courses.reduce((sum, course) => sum + Number(course.calories || 0), 0),
                lastCourseName: entry.name,
                updatedAt: new Date().toISOString()
            });
        }

        function finishCourseMode() {
            const session = getCourseSession();
            if (!session.id) return;
            saveCourseSession({ ...session, active: false, endedAt: new Date().toISOString() });
            clearCurrentMealPlan();
            renderCourseModeCard();
            renderDailyCoreCard();
            showToast("聚餐模式已收尾，今天相簿會保留逐道照片。");
            tomaBubble.innerText = `這場聚餐共記 ${session.courses?.length || 0} 道，約 ${session.totalCalories || 0} kcal。下次回看會更清楚。`;
        }

        function renderCourseModeCard() {
            const card = document.getElementById('courseModeCard');
            if (!card) return;
            const session = getCourseSession();
            const count = session.courses?.length || 0;
            const total = Math.round(Number(session.totalCalories || 0));
            if (!session.active && count <= 0) {
                card.innerHTML = `
                    <div class="course-mode-top">
                        <div>
                            <div class="course-mode-kicker">FROM TOMA</div>
                            <div class="course-mode-title">聚餐、火鍋、套餐不要硬算成一張</div>
                        </div>
                        <div class="course-mode-pill">可選</div>
                    </div>
                    <div class="course-mode-body">自律茄子的逐道記錄概念已移到 拍拍吃。多人聚餐時開啟，每一道拍一下，之後會變成同一場吃飯回憶。</div>
                    <div class="course-mode-actions">
                        <button class="course-mode-action primary" type="button" onclick="startCourseMode()">開啟聚餐模式</button>
                        <button class="course-mode-action" type="button" onclick="openMealDecisionCoach('聚餐怎麼吃')">先問怎麼吃</button>
                        <button class="course-mode-action" type="button" onclick="switchTabById('tab-diet')">看回憶</button>
                    </div>
                `;
                return;
            }
            card.innerHTML = `
                <div class="course-mode-top">
                    <div>
                        <div class="course-mode-kicker">COURSE MODE</div>
                        <div class="course-mode-title">${session.active ? (session.name || "聚餐逐道記錄中") : "聚餐已收尾"}</div>
                    </div>
                    <div class="course-mode-pill">${session.active ? "記錄中" : "已保存"}</div>
                </div>
                <div class="course-mode-body">${session.active ? "每上一道就拍一下；完食時可補桌面剩餘量，塔塔會把這些照片留在同一天。" : "這場聚餐已保存到今天回憶；之後可以從相簿回看每一道。"}</div>
                <div class="course-mode-stats">
                    <div class="course-mode-stat"><strong>${count}</strong><span>已記道數</span></div>
                    <div class="course-mode-stat"><strong>${total}</strong><span>累積 kcal</span></div>
                    <div class="course-mode-stat"><strong>${shortNextAdvice(session.lastCourseName || "待下一道")}</strong><span>最後一道</span></div>
                </div>
                <div class="course-mode-actions">
                    <button class="course-mode-action primary" type="button" onclick="${session.active ? "prepareCourseNextPhoto()" : "startCourseMode()"}">${session.active ? "拍下一道" : "再開一場"}</button>
                    <button class="course-mode-action" type="button" onclick="openCourseFinalPhoto()">完食補拍</button>
                    <button class="course-mode-action" type="button" onclick="finishCourseMode()">結束</button>
                </div>
            `;
        }

        function getMealFlowState() {
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const draft = getActivePhotoDraft();
            const pending = pendingBeforeMeal || safeJsonObject(localStorage.getItem(dailyKey('pendingBeforeMeal')));
            const latestNeedsAfter = [...meals].reverse().find(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            const hasBefore = Boolean(pending || latestNeedsAfter || selectedMeal.phase === "before");
            const hasAfter = Boolean((pending || latestNeedsAfter)?.photoAfter || selectedMeal.phase === "after");
            if (draft) {
                const phaseLabel = draft.phase === "after" ? "飯後照" : "飯前照";
                return {
                    title: `剛剛的${phaseLabel}還沒存完`,
                    pill: "可恢復",
                    body: "照片已先保留，不用重拍。先恢復照片，再決定要重新辨識、補餐名或儲存這餐。",
                    primaryLabel: "恢復剛剛照片",
                    primaryAction: "restoreActivePhotoDraft()",
                    secondaryLabel: "重新拍",
                    secondaryAction: `openPhotoSourceSheet('${draft.phase === "after" ? "after" : "before"}')`,
                    step: draft.phase === "after" ? 3 : 1,
                    beforeDone: draft.phase === "after" || hasBefore,
                    afterDone: draft.phase === "after",
                    saveDone: false
                };
            }
            if (pending || latestNeedsAfter) {
                const meal = pending || latestNeedsAfter;
                return {
                    title: `${meal.mealSlot || "這餐"}飯前照已存`,
                    pill: "等飯後",
                    body: `吃完不用重找入口，直接補一張飯後照。塔塔會把它綁回「${meal.name || "這餐"}」，用剩餘量校正實際吃下的熱量。`,
                    primaryLabel: "吃完了，補飯後照",
                    primaryAction: "startLatestAfterPhoto(event)",
                    secondaryLabel: "先看今天",
                    secondaryAction: "openTodayMemory(event)",
                    step: 3,
                    beforeDone: true,
                    afterDone: false,
                    saveDone: false
                };
            }
            if (currentMealPlan) {
                return {
                    title: `已排好：${currentMealPlan.foodName || "本餐計畫"}`,
                    pill: "開飯前拍",
                    body: "先照這個方向吃，開飯前拍一張讓塔塔用實際份量校正。飯後可再補照，熱量會更貼近你真正吃下的量。",
                    primaryLabel: "拍這餐 / 選照片",
                    primaryAction: "openPhotoSourceSheet('before')",
                    secondaryLabel: "重選吃什麼",
                    secondaryAction: "openMealDecisionCoach('等等吃什麼')",
                    step: 1,
                    beforeDone: false,
                    afterDone: false,
                    saveDone: false
                };
            }
            if (selectedMeal.photo && selectedMeal.phase === "after") {
                return {
                    title: "飯後照已讀取",
                    pill: "準備儲存",
                    body: "確認餐名與熱量後儲存，這張飯後照會進今天回憶；若有飯前照，塔塔會用它校正實際吃下。",
                    primaryLabel: pendingBeforeMeal ? "用飯後照校正" : "儲存飯後照",
                    primaryAction: "confirmAndStoreMeal()",
                    secondaryLabel: "再拍一次",
                    secondaryAction: "openPhotoSourceSheet('after')",
                    step: 4,
                    beforeDone: hasBefore,
                    afterDone: true,
                    saveDone: false
                };
            }
            if (selectedMeal.photo && selectedMeal.phase === "before") {
                return {
                    title: "飯前照已讀取",
                    pill: "先存餐前",
                    body: "先把飯前照存到今天。吃完後首頁和拍照頁都會出現「補飯後照」，不用再找入口。",
                    primaryLabel: "儲存餐前照",
                    primaryAction: "confirmAndStoreMeal()",
                    secondaryLabel: "重拍飯前",
                    secondaryAction: "openPhotoSourceSheet('before')",
                    step: 2,
                    beforeDone: true,
                    afterDone: false,
                    saveDone: false
                };
            }
            return {
                title: "這餐照這個順序就好",
                pill: meals.length ? "拍下一餐" : "第一餐",
                body: "開飯前拍一張，吃完可補飯後照。塔塔會保留照片回憶，也用前後差異校正熱量。",
                primaryLabel: "飯前拍 / 選照片",
                primaryAction: "openPhotoSourceSheet('before')",
                secondaryLabel: "不知道吃什麼",
                secondaryAction: "openMealDecisionCoach('等等吃什麼')",
                step: 1,
                beforeDone: false,
                afterDone: false,
                saveDone: false
            };
        }

        function renderMealFlowCard() {
            const card = document.getElementById('mealFlowCard');
            if (!card) return;
            const state = getMealFlowState();
            const steps = [
                { label: "飯前拍", meta: "看份量", done: state.beforeDone, current: state.step === 1 },
                { label: "開始吃", meta: "先存餐前", done: state.beforeDone && state.step > 2, current: state.step === 2 },
                { label: "飯後補", meta: "扣剩量", done: state.afterDone, current: state.step === 3 },
                { label: "存回憶", meta: "進今日", done: state.saveDone, current: state.step === 4 }
            ];
            card.innerHTML = `
                <div class="meal-flow-top">
                    <div>
                        <div class="meal-flow-kicker">本餐流程</div>
                        <div class="meal-flow-title">${state.title}</div>
                    </div>
                    <div class="meal-flow-pill">${state.pill}</div>
                </div>
                <div class="meal-flow-body">${state.body}</div>
                <div class="meal-flow-steps">
                    ${steps.map(step => `
                        <div class="meal-flow-step${step.done ? ' done' : ''}${step.current ? ' current' : ''}">
                            <strong>${step.label}</strong>
                            <span>${step.done ? '完成' : step.meta}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="meal-flow-actions">
                    <button class="meal-flow-action primary" type="button" onclick="${state.primaryAction}">${state.primaryLabel}</button>
                    <button class="meal-flow-action" type="button" onclick="${state.secondaryAction}">${state.secondaryLabel}</button>
                </div>
            `;
        }

        function getMealSpeedPromiseState() {
            const meal = selectedMeal || {};
            const hasPhoto = Boolean(meal.photo);
            const hasEstimate = hasPhoto && Number(meal.calories || 0) > 0;
            const isLoading = meal.source === "photo_loading";
            const isPending = meal.source === "photo_pending" || meal.confidence === "low";
            const phaseLabel = meal.phase === "after" ? "飯後照" : "飯前照";
            const draft = getActivePhotoDraft();
            const autoSaved = Boolean(meal.autoSavedDraftAt || (draft?.autoSaved && draft?.photoSessionId === meal.photoSessionId));
            if (isLoading || (hasPhoto && !hasEstimate)) {
                return {
                    visible: true,
                    title: `${phaseLabel}已讀取`,
                    pill: "辨識中",
                    body: meal.speedMessage || "塔塔正在看照片份量。若 AI 較慢，會先給本機估算，不會讓照片消失。",
                    step: 2
                };
            }
            if (hasEstimate) {
                return {
                    visible: true,
                    title: autoSaved ? "已自動保存分析" : (isPending ? "可先存，稍後補正" : "已可儲存"),
                    pill: autoSaved ? "草稿安全" : `${Math.round(Number(meal.calories || 0) * selectedPortion)} kcal`,
                    body: isPending
                        ? (autoSaved
                            ? "這份低信心估算已自動保存為草稿；補餐名、份量或重新辨識後會更準，確認後再正式入帳。"
                            : "這是保守估算；補餐名、份量或重新辨識後會更準，確認後再正式入帳。")
                        : (autoSaved
                            ? `已完成估算與營養師建議，並自動保存為可恢復草稿。確認餐名與熱量後，按下方按鈕把${phaseLabel}正式存進今天回憶。`
                            : `已完成估算與營養師建議。確認餐名與熱量後，按下方按鈕把${phaseLabel}正式存進今天回憶。`),
                    step: isPending ? 3 : 4
                };
            }
            return {
                visible: true,
                title: "10 秒估算進度",
                pill: "等照片",
                body: "拍照後，這裡會顯示照片讀取、AI/本機估算、營養師建議與可儲存狀態。",
                step: 1
            };
        }

        function renderMealSpeedPromiseCard() {
            const card = document.getElementById('mealSpeedPromiseCard');
            if (!card) return;
            const state = getMealSpeedPromiseState();
            card.classList.toggle('active', Boolean(state.visible));
            const steps = [
                { label: "照片", meta: "已保留", current: state.step === 1, done: state.step > 1 },
                { label: "估算", meta: "AI/本機", current: state.step === 2, done: state.step > 2 },
                { label: "建議", meta: "可修正", current: state.step === 3, done: state.step > 3 },
                { label: "儲存", meta: "進回憶", current: state.step === 4, done: false }
            ];
            card.innerHTML = `
                <div class="meal-speed-top">
                    <div>
                        <div class="meal-speed-kicker">10 秒估算進度</div>
                        <div class="meal-speed-title">${state.title}</div>
                    </div>
                    <div class="meal-speed-pill">${state.pill}</div>
                </div>
                <div class="meal-speed-body">${state.body}</div>
                <div class="meal-speed-steps">
                    ${steps.map(step => `
                        <div class="meal-speed-step${step.done ? ' done' : ''}${step.current ? ' current' : ''}">
                            <strong>${step.label}</strong>
                            <span>${step.done ? '完成' : step.meta}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function getEstimateSaveStatusState() {
            const meal = selectedMeal || {};
            const hasEstimate = Number(selectedMealKcal || meal.calories || 0) > 0;
            if (!hasEstimate || meal.source === "photo_loading") return null;
            const draft = getActivePhotoDraft();
            const recordDraft = getAutoMealRecordDraft();
            const autoSaved = Boolean(meal.autoSavedDraftAt || (draft?.autoSaved && draft?.photoSessionId === meal.photoSessionId) || (recordDraft?.photoSessionId === meal.photoSessionId));
            const phaseLabel = meal.phase === "after" ? "飯後照" : "飯前照";
            const lowTrust = meal.confidence === "low" || meal.source === "photo_pending";
            const title = autoSaved ? "分析草稿已安全保存" : "這餐還差最後一步";
            const meta = recordDraft ? "營養師草稿" : (autoSaved ? "草稿安全" : "未正式入帳");
            const body = autoSaved
                ? `${phaseLabel}、餐名、熱量、本餐評分、優點、不足與下一餐建議已自動保存在今天草稿；確認後按下方按鈕，塔塔才會把這餐算進正式明細，避免重複入帳。`
                : `${phaseLabel}已完成估算，但目前仍停在畫面上。按下方「正式記錄」後，才會進今天回憶、更新熱量與下一餐建議。`;
            return {
                title,
                meta,
                body: lowTrust ? `${body} 這份估算信心較低，建議先補餐名、份量或重新辨識再正式記錄。` : body,
                autoSaved,
                lowTrust
            };
        }

        function renderEstimateSaveStatusCard() {
            const card = document.getElementById('estimateSaveStatusCard');
            if (!card) return;
            const state = getEstimateSaveStatusState();
            if (!state) {
                card.classList.remove('active', 'safe');
                card.innerHTML = "";
                return;
            }
            card.classList.add('active');
            card.classList.toggle('safe', state.autoSaved && !state.lowTrust);
            const steps = [
                { label: "照片", meta: "已保留", done: true },
                { label: "分析", meta: state.autoSaved ? "草稿安全" : "已估算", done: true },
                { label: "入帳", meta: "按下方完成", current: true }
            ];
            card.innerHTML = `
                <div class="estimate-save-status-top">
                    <div class="estimate-save-status-title">${state.title}</div>
                    <div class="estimate-save-status-meta">${state.meta}</div>
                </div>
                <div class="estimate-save-status-body">${state.body}</div>
                <div class="estimate-save-status-steps">
                    ${steps.map(step => `
                        <div class="estimate-save-status-step${step.done ? ' done' : ''}${step.current ? ' current' : ''}">
                            <strong>${step.label}</strong>
                            <span>${step.meta}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function buildCurrentEstimateMealForCoach() {
            const meal = selectedMeal || {};
            const kcal = Math.round(Number(selectedMealKcal || meal.calories || 0));
            if (!kcal || meal.source === "photo_loading") return null;
            return {
                ...meal,
                name: selectedMealName || meal.name || "這餐",
                kcal,
                calories: kcal,
                protein: Math.round(Number(selectedP || meal.protein || 0)),
                carbs: Math.round(Number(selectedV || meal.carbs || 0)),
                fat: Math.round(Number(selectedF || meal.fat || 0)),
                fiber: Math.round(Number(selectedFiber || meal.fiber || 0)),
                sugar: Math.round(Number(selectedSugar || meal.sugar || 0)),
                sodium: Math.round(Number(selectedSodium || meal.sodium || 0)),
                items: Array.isArray(meal.items) ? meal.items : []
            };
        }

        function renderImmediateNutritionCoachCard() {
            const card = document.getElementById('immediateNutritionCoachCard');
            if (!card) return;
            const meal = buildCurrentEstimateMealForCoach();
            if (!meal) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const projectedMeals = [...(Array.isArray(userData.dietRecords) ? userData.dietRecords : []), meal];
            const budget = getTodayCalorieBudgetSnapshot(projectedMeals);
            const projectedStatus = getNutritionStatusForMeals(projectedMeals, budget.left);
            const next = getNextMealSuggestion(new Date(), budget.left, projectedStatus);
            const coach = getSavedMealNutritionCoach(meal, budget, next);
            card.classList.add('active');
            card.innerHTML = `
                <div class="post-meal-decision-head">
                    <div class="post-meal-decision-title">TATA 即時營養師</div>
                    <div class="post-meal-decision-meta">${getGoalLabel()} · ${coach.score}/100</div>
                </div>
                <div class="post-meal-decision-body">${coach.body}</div>
                <div class="immediate-nutrition-coach-grid">
                    <div class="immediate-nutrition-coach-cell"><strong>本餐評分</strong><span>${coach.score}/100</span></div>
                    <div class="immediate-nutrition-coach-cell"><strong>優點</strong><span>${shortNextAdvice(coach.good)}</span></div>
                    <div class="immediate-nutrition-coach-cell"><strong>不足</strong><span>${shortNextAdvice(coach.gap)}</span></div>
                </div>
                <div class="post-meal-decision-body">${coach.nextLine}</div>
                <button class="post-meal-decision-btn primary" type="button" onclick="startCurrentEstimateRecommendedPlan()">用這份建議排下一餐</button>
            `;
        }

        function renderImmediateNutritionCoachCard() {
            const card = document.getElementById('immediateNutritionCoachCard');
            if (!card) return;
            const meal = buildCurrentEstimateMealForCoach();
            if (!meal) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const projectedMeals = [...(Array.isArray(userData.dietRecords) ? userData.dietRecords : []), meal];
            const budget = getTodayCalorieBudgetSnapshot(projectedMeals);
            const projectedStatus = getNutritionStatusForMeals(projectedMeals, budget.left);
            const next = getNextMealSuggestion(new Date(), budget.left, projectedStatus);
            const coach = getSavedMealNutritionCoach(meal, budget, next);
            const score = getP2MealScore();
            const body = String(coach.body || "").replace(/本餐評分\s*\d+\/100。?/, `本餐評分 ${score}/100。`);
            card.classList.add('active');
            card.innerHTML = `
                <div class="post-meal-decision-head">
                    <div class="post-meal-decision-title">塔塔營養師建議</div>
                    <div class="post-meal-decision-meta">${getGoalLabel()} · ${score}/100</div>
                </div>
                <div class="post-meal-decision-body">${body}</div>
                <div class="immediate-nutrition-coach-grid">
                    <div class="immediate-nutrition-coach-cell"><strong>本餐評分</strong><span>${score}/100</span></div>
                    <div class="immediate-nutrition-coach-cell"><strong>優點</strong><span>${shortNextAdvice(coach.good)}</span></div>
                    <div class="immediate-nutrition-coach-cell"><strong>不足</strong><span>${shortNextAdvice(coach.gap)}</span></div>
                </div>
                <div class="post-meal-decision-body">${coach.nextLine}</div>
                <button class="post-meal-decision-btn primary" type="button" onclick="startCurrentEstimateRecommendedPlan()">照建議排下一餐</button>
            `;
        }

        function getBottomPhotoActionState() {
            const flow = getMealFlowState();
            const action = String(flow.primaryAction || "");
            if (action.includes("restoreActivePhotoDraft")) return { label: "恢復照片", type: "restore" };
            if (action.includes("startLatestAfterPhoto")) return { label: "飯後補拍", type: "after" };
            if (action.includes("confirmAndStoreMeal")) {
                const label = selectedMeal.phase === "after" ? "儲存飯後" : "儲存餐前";
                return { label, type: "confirm" };
            }
            if (currentMealPlan) return { label: "拍這餐", type: "before" };
            return { label: "開飯拍", type: "before" };
        }

        function renderBottomPhotoAction() {
            const button = document.getElementById('bottomPhotoAction');
            if (!button) return;
            const state = getBottomPhotoActionState();
            button.innerText = state.label;
            button.dataset.actionType = state.type;
            button.setAttribute('aria-label', state.label);
        }

        function handleBottomPhotoAction(event) {
            const state = getBottomPhotoActionState();
            if (state.type === "restore") return restoreActivePhotoDraft();
            if (state.type === "after") return startLatestAfterPhoto(event);
            if (state.type === "confirm") return confirmAndStoreMeal();
            return openPhotoSourceSheet('before');
        }

        function openLifeQuickLog() {
            switchTabById('tab-body');
            setTimeout(() => {
                const target = document.getElementById('lifeQuickLogCard');
                const input = document.getElementById('sleepHoursInput');
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input?.focus();
            }, 80);
        }

        function recordLifeLog({ sleepHours = "", bowelState = "", energyState = "" } = {}, source = "body") {
            if (!currentUser) return false;
            const sleepRaw = String(sleepHours ?? "").trim();
            const sleep = Number(sleepRaw);
            if (sleepRaw && (!Number.isFinite(sleep) || sleep < 0 || sleep > 16)) {
                showToast("請輸入合理睡眠時數，例如 6.5");
                return false;
            }
            if (sleepRaw) localStorage.setItem(getLifeLogKey('sleepHours'), String(Math.round(sleep * 10) / 10));
            else localStorage.removeItem(getLifeLogKey('sleepHours'));
            if (bowelState) localStorage.setItem(getLifeLogKey('bowelState'), String(bowelState));
            else localStorage.removeItem(getLifeLogKey('bowelState'));
            if (energyState) localStorage.setItem(getLifeLogKey('energyState'), String(energyState));
            else localStorage.removeItem(getLifeLogKey('energyState'));
            const nextState = getLifeLogState();
            const bodySleep = document.getElementById('sleepHoursInput');
            const bodyBowel = document.getElementById('bowelStateInput');
            const bodyEnergy = document.getElementById('energyStateInput');
            const quickSleep = document.getElementById('todaySleepQuickInput');
            const quickBowel = document.getElementById('todayBowelQuickInput');
            const quickEnergy = document.getElementById('todayEnergyQuickInput');
            if (bodySleep && document.activeElement !== bodySleep) bodySleep.value = nextState.sleepHours;
            if (bodyBowel && document.activeElement !== bodyBowel) bodyBowel.value = nextState.bowelState;
            if (bodyEnergy && document.activeElement !== bodyEnergy) bodyEnergy.value = nextState.energyState;
            if (quickSleep && document.activeElement !== quickSleep) quickSleep.value = nextState.sleepHours;
            if (quickBowel && document.activeElement !== quickBowel) quickBowel.value = nextState.bowelState;
            if (quickEnergy && document.activeElement !== quickEnergy) quickEnergy.value = nextState.energyState;
            renderLifeQuickLogSummary();
            renderDailyCoreCard();
            renderTodayLifeQuickCard();
            if (memorySelectedDate === todayKeyDate()) renderTodayDiarySummary();
            markActive();
            saveToStorage();
            syncRemoteDailyState(todayKeyDate());
            updateUI(false);
            showToast(source === "quick" ? "今天生活狀態已記錄。" : "已更新今天生活狀態。");
            return true;
        }

        function saveTodayLifeQuick() {
            return recordLifeLog({
                sleepHours: document.getElementById('todaySleepQuickInput')?.value || "",
                bowelState: document.getElementById('todayBowelQuickInput')?.value || "",
                energyState: document.getElementById('todayEnergyQuickInput')?.value || ""
            }, "quick");
        }

        function focusTodayLifeQuick() {
            const card = document.getElementById('todayLifeQuickCard');
            if (card) {
                try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) { card.scrollIntoView(); }
                setTimeout(() => document.getElementById('todaySleepQuickInput')?.focus(), 80);
                return false;
            }
            openLifeQuickLog();
            return false;
        }

        function saveLifeQuickLog() {
            if (!currentUser) return;
            return recordLifeLog({
                sleepHours: document.getElementById('sleepHoursInput')?.value || "",
                bowelState: document.getElementById('bowelStateInput')?.value || "",
                energyState: document.getElementById('energyStateInput')?.value || ""
            }, "body");
        }

        async function handlePhotoCapture(event, phase = "before") {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const capturePhase = phase === "after" ? "after" : "before";
            const photoSessionId = Date.now();
            activePhotoSessionId = photoSessionId;
            photoCapturePhase = capturePhase;
            const locationPromise = captureMealLocationSnapshot(photoSessionId);
            resetEstimateForNewPhoto(capturePhase, photoSessionId);
            switchTabById('tab-photo');
            showPhotoReceivedState(capturePhase);
            const base64 = await fileToBase64(file);
            if (photoSessionId !== activePhotoSessionId) return;
            if (!base64 || base64.length < 100) {
                showToast('照片讀取失敗，請重新拍攝');
                return;
            }
            const compressed = await compressImage(base64, 640, 0.72);
            if (photoSessionId !== activePhotoSessionId) return;
            await locationPromise;
            saveActivePhotoDraft({ phase: capturePhase, photo: compressed, fileName: file.name || "", photoSessionId, status: "loaded" });
            setEstimateLoadingState(
                "照片已讀取",
                capturePhase === "after"
                    ? "塔塔先保留飯後照片，接著辨識剩餘量並和餐前照比對。"
                    : "塔塔先保留飯前照片，接著辨識食物品項、容器大小、份量比例、湯汁與醬料。",
                compressed
            );
            if (capturePhase !== "after") {
                showInstantPhotoEstimateIfPossible(compressed, capturePhase, photoSessionId, file.name || "");
            }
            tomaBubble.innerText = capturePhase === "after"
                ? "我正在看餐後剩多少，等一下會和餐前照比對。"
                : "我正在看這餐的品項、份量、容器大小和湯汁醬料。先不用緊張，估算就是估算。";
            document.getElementById('estimateResult').style.display = "block";
            document.getElementById('mealName').innerText = capturePhase === "after" ? "分析餐後剩餘量..." : "分析餐前餐點...";
            let slowHintTimer = null;
            let quickFallbackTimer = null;
            try {
                slowHintTimer = setTimeout(() => {
                    if (photoSessionId !== activePhotoSessionId) return;
                    setEstimateLoadingState("AI 辨識中", "這次辨識稍慢，塔塔仍會在幾秒內改用本機估算，不會讓你卡住。", compressed);
                }, 2800);
                quickFallbackTimer = setTimeout(() => {
                    showQuickPhotoFallback(compressed, capturePhase, file.name || "", photoSessionId);
                }, 4200);
                const result = await estimateCalories(compressed, { phase: capturePhase, fileName: file.name || "", photoSessionId });
                if (photoSessionId !== activePhotoSessionId) return;
                showEstimateResult(result, compressed, capturePhase, photoSessionId);
                saveActivePhotoDraft({ phase: capturePhase, photo: compressed, fileName: file.name || "", photoSessionId, status: "estimated", meal: result });
            } catch (error) {
                if (photoSessionId !== activePhotoSessionId) return;
                showPhotoPendingResult(compressed, getFriendlyAiError(error.message), capturePhase, file.name || "", photoSessionId);
                saveActivePhotoDraft({ phase: capturePhase, photo: compressed, fileName: file.name || "", photoSessionId, status: "fallback", meal: selectedMeal });
                showToast("照片已讀取，先用本機估算或手動補正。");
                tomaBubble.innerText = capturePhase === "after"
                    ? "餐後照有讀到。AI 暫時不能用時，我會先用本機規則抓剩餘量，你可以輸入餐點名稱輔助。"
                    : "餐前照有讀到。AI 暫時不能用時，我會先用本機規則幫你抓一個保守熱量。";
            } finally {
                if (slowHintTimer) clearTimeout(slowHintTimer);
                if (quickFallbackTimer) clearTimeout(quickFallbackTimer);
                event.target.value = "";
            }
        }

        function scrollEstimateResultIntoView() {
            const resultEl = document.getElementById('estimateResult');
            if (!resultEl) return;
            setTimeout(() => {
                try { resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                catch (error) { resultEl.scrollIntoView(); }
            }, 60);
        }

        function showPhotoReceivedState(phase = photoCapturePhase) {
            const isAfter = phase === "after";
            setEstimateLoadingState(
                "照片已收到",
                isAfter
                    ? "相簿/相機照片已進來，正在壓縮並準備比對剩餘量。"
                    : "相簿/相機照片已進來，正在壓縮並準備估熱量。"
            );
            const mealNameEl = document.getElementById('mealName');
            if (mealNameEl) mealNameEl.innerText = isAfter ? "餐後照片讀取中..." : "餐前照片讀取中...";
            tomaBubble.innerText = isAfter
                ? "餐後照收到了。我會先顯示結果區，AI 慢的話也會先給可修改估算。"
                : "照片收到了。我會先顯示結果區，AI 慢的話也會先給可修改估算。";
            showToast("照片已收到，塔塔正在分析。");
            scrollEstimateResultIntoView();
        }

        function getPhotoEstimateHint(fileName = "") {
            const typedHint = document.getElementById('quickFoodName')?.value.trim();
            return typedHint || currentMealPlan?.foodName || fileName || "";
        }

        function showInstantPhotoEstimateIfPossible(photo, phase, photoSessionId, fileName = "") {
            const hint = getPhotoEstimateHint(fileName);
            if (!hint || /照片|image|jpg|jpeg|png|heic|待確認/i.test(hint)) return false;
            const estimate = estimateFoodByText(hint);
            if (!estimate || photoSessionId !== activePhotoSessionId) return false;
            showEstimateResult({
                ...estimate,
                source: "local_text_fast",
                confidence: "medium",
                notes: "照片已先讀取。塔塔先用餐點名稱/本餐計畫快速估算，AI 視覺回來後會用實際畫面更新。"
            }, photo, phase, photoSessionId);
            saveActivePhotoDraft({ phase, photo, fileName, photoSessionId, status: "instant", meal: estimate });
            const trust = document.getElementById('estimateTrustLine');
            if (trust) trust.innerHTML = `估算可信度：中 <span>先用餐名快速估算，AI 正在看照片份量，稍後會自動更新。</span>`;
            return true;
        }

        function resetEstimateForNewPhoto(phase, photoSessionId = activePhotoSessionId) {
            selectedPortion = 1;
            autoSavedMealDraft = null;
            const name = phase === "after" ? "餐後剩餘量分析中" : "餐前餐點分析中";
            selectedMeal = { name, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, healthFlags: [], mealQuality: "unknown", items: [], photo: "", source: "photo_loading", phase, warning: "", notes: "", photoSessionId, speedMessage: "照片正在讀取與壓縮，完成後會立刻進入 AI/本機估算。" };
            selectedMealName = "";
            selectedMealKcal = 0;
            selectedP = 0;
            selectedV = 0;
            selectedF = 0;
            selectedFiber = 0;
            selectedSugar = 0;
            selectedSodium = 0;
            const quickInput = document.getElementById('quickFoodName');
            const resultEl = document.getElementById('estimateResult');
            const note = document.getElementById('confidenceNote');
            const list = document.getElementById('foodItemsList');
            const meta = document.getElementById('estimateMeta');
            const trust = document.getElementById('estimateTrustLine');
            if (resultEl) {
                resultEl.style.display = "block";
                resultEl.classList.remove("result-ready");
            }
            if (note) { note.innerText = ""; note.style.display = "none"; }
            if (list) list.innerHTML = "";
            if (meta) meta.innerHTML = "";
            if (trust) {
                trust.classList.remove('loading');
                trust.innerHTML = "";
            }
            document.getElementById('mealName').innerText = name;
            document.getElementById('estCalories').innerText = "0";
            document.getElementById('estProtein').innerText = "0";
            document.getElementById('estCarbs').innerText = "0";
            document.getElementById('estFat').innerText = "0";
            renderP2ResultCard();
            document.getElementById('manualFoodName').value = quickInput?.value.trim() || "";
            document.getElementById('manualCalories').value = "";
            updateConfirmMealButton();
            renderImmediateNutritionCoachCard();
            renderMealSpeedPromiseCard();
            scrollEstimateResultIntoView();
        }

        function showQuickPhotoFallback(photo, phase = photoCapturePhase, fileName = "", photoSessionId = activePhotoSessionId) {
            if (photoSessionId !== activePhotoSessionId) return false;
            if (!selectedMeal || selectedMeal.source !== "photo_loading") return false;
            const typedHint = document.getElementById('quickFoodName')?.value.trim();
            const fallbackMeal = phase === "after"
                ? estimateAfterPhotoLocally(resolveAfterPhotoTargetMeal(), typedHint || fileName || "飯後剩餘量")
                : estimateMealLocally(typedHint || fileName || "照片待確認");
            showEstimateResult({
                ...fallbackMeal,
                source: "local_photo_quick_fallback",
                confidence: "low",
                notes: "AI 還在辨識，先給你可修改的保守估算；AI 回來後會自動更新。"
            }, photo, phase, photoSessionId);
            saveActivePhotoDraft({ phase, photo, fileName, photoSessionId, status: "quick_fallback", meal: selectedMeal });
            const trust = document.getElementById('estimateTrustLine');
            if (trust) trust.innerHTML = `估算可信度：低 <span>AI 還在跑，先用本機估算避免畫面卡住。可先補餐名或直接修正熱量。</span>`;
            showToast("AI 還在跑，先顯示可修改估算。");
            return true;
        }

        function showPhotoPendingResult(photo, message, phase = photoCapturePhase, fileName = "", photoSessionId = activePhotoSessionId) {
            const typedHint = document.getElementById('quickFoodName')?.value.trim();
            const fallbackMeal = phase === "after"
                ? estimateAfterPhotoLocally(resolveAfterPhotoTargetMeal(), typedHint || fileName || "飯後剩餘量")
                : estimateMealLocally(typedHint || fileName || "照片待確認");
            selectedMeal = {
                ...fallbackMeal,
                photo,
                source: "photo_pending",
                phase,
                mealSlot: getMealSlot(new Date()),
                capturedAt: new Date().toISOString(),
                locationSnapshot: activeMealLocationSnapshot || null,
                photoSessionId,
                confidence: "low",
                notes: message,
                warning: "AI 暫時無法完成估算，這是本機保守估算；補上餐點名稱或份量後，塔塔會立刻重估。"
            };
            applySelectedMealToUI();
            document.getElementById('estimateResult').style.display = "block";
            const photoEl = document.getElementById('mealPhoto');
            photoEl.src = photo;
            photoEl.style.display = "block";
            document.getElementById('manualFoodName').value = selectedMeal.name;
            document.getElementById('manualCalories').value = selectedMeal.calories || "";
            updateConfirmMealButton();
            autoSaveMealDraft({ phase, photo, fileName, photoSessionId, meal: selectedMeal, status: "auto_pending" });
            scrollEstimateResultIntoView();
        }

        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        function compressImage(dataUrl, maxSize = 800, quality = 0.8) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    let nextQuality = quality;
                    let output = canvas.toDataURL('image/jpeg', nextQuality);
                    while (output.length > 1024 * 1024 && nextQuality > 0.45) {
                        nextQuality -= 0.1;
                        output = canvas.toDataURL('image/jpeg', nextQuality);
                    }
                    resolve(output);
                };
                img.onerror = reject;
                img.src = dataUrl;
            });
        }

        async function estimateCalories(base64Image, context = {}) {
            const typedHint = document.getElementById('quickFoodName')?.value.trim() || "";
            const isAfterPhoto = (context.phase || photoCapturePhase) === "after";
            const afterTarget = isAfterPhoto ? resolveAfterPhotoTargetMeal() : null;
            const planHint = currentMealPlan
                ? `本餐計畫：${currentMealPlan.routeLabel || ''} / ${currentMealPlan.foodName || ''} / 目標約 ${currentMealPlan.targetKcal || ''} kcal / 重點 ${currentMealPlan.focus || ''}。`
                : "";
            const afterHint = afterTarget
                ? `飯後比對基準：餐前餐點 ${afterTarget.name || '這餐'}，餐前估算 ${Math.round(Number(afterTarget.beforeCalories || afterTarget.calories || 0))} kcal，請辨識照片中剩餘食物，不要把餐前完整熱量當成飯後剩餘量。`
                : "";
            const mealText = [typedHint, planHint, afterHint].filter(Boolean).join("；");
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5800);
            try {
                const response = await fetch('/api/analyze-meal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                        imageData: base64Image,
                        mealText,
                        portionLabel: `${selectedPortion} 份`,
                        mealType: getMealSlot(new Date()),
                        scenario: (context.phase || photoCapturePhase) === "after" ? "餐後剩餘量估算" : "餐前完整餐點估算",
                        photoSessionId: context.photoSessionId || activePhotoSessionId
                    })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(getFriendlyAiError(payload.message || payload.error || 'AI 估算失敗'));
                const providerSource = payload.provider || payload.source || 'ai_photo';
                const normalized = normalizeMealEstimate(payload, providerSource);
                if (!normalized.items.length || normalized.calories <= 0) {
                    return isAfterPhoto
                        ? estimateAfterPhotoLocally(afterTarget, typedHint || context.fileName || normalized.name || "")
                        : estimateMealLocally(typedHint || context.fileName || normalized.name || "照片待確認");
                }
                return normalized;
            } catch (error) {
                if (error.name === "AbortError") throw new Error("AI 辨識時間較長，先用本機估算並可手動修正。");
                throw error;
            } finally {
                clearTimeout(timer);
            }
        }

        function getFriendlyAiError(message) {
            const text = String(message || '');
            if (/quota|billing|exceeded|insufficient|plan/i.test(text)) return "AI 額度暫時不足，先用本機估算並可手動修正。";
            if (/timeout|時間過長/i.test(text)) return "AI 辨識時間較長，先用本機估算並可手動修正。";
            if (/api[_ -]?key|configured|OPENAI/i.test(text)) return "AI 服務尚未設定，先用本機估算並可手動修正。";
            return text.replace(/[A-Za-z0-9_./:-]{18,}/g, '').trim() || "AI 暫時不能用，先用本機估算並可手動修正。";
        }

        function normalizeMealEstimate(payload, source) {
            const items = Array.isArray(payload.items) ? payload.items : [];
            const normalizedItems = items.map(item => ({
                name: String(item.name || '餐點'),
                portion: String(item.portion || '份量未明'),
                calories: Math.max(0, Math.round(Number(item.calories ?? item.kcal ?? 0))),
                protein: Math.max(0, Math.round(Number(item.protein ?? item.protein_g ?? 0))),
                carbs: Math.max(0, Math.round(Number(item.carbs ?? item.carbs_g ?? 0))),
                fat: Math.max(0, Math.round(Number(item.fat ?? item.fat_g ?? 0))),
                fiber: Math.max(0, Math.round(Number(item.fiber ?? item.fiber_g ?? 0))),
                sugar: Math.max(0, Math.round(Number(item.sugar ?? item.sugar_g ?? 0))),
                sodium: Math.max(0, Math.round(Number(item.sodium ?? item.sodium_mg ?? 0)))
            }));
            const itemName = normalizedItems.map(item => item.name).slice(0, 2).join('、') || items[0]?.name;
            const itemCaloriesTotal = normalizedItems.reduce((sum, item) => sum + Number(item.calories || 0), 0);
            const calorieCandidates = [payload.total_calories, payload.total_kcal, payload.calories, payload.kcal, itemCaloriesTotal]
                .map(Number)
                .filter(value => Number.isFinite(value) && value > 0);
            const textFallback = estimateFoodByText(String(payload.name || payload.meal_name || itemName || ''));
            const calories = calorieCandidates.length ? calorieCandidates[0] : (textFallback?.calories || 430);
            const confidence = String(payload.confidence || 'medium');
            const check = sanityCheck(normalizedItems, calories);
            const healthFlags = normalizeClientHealthFlags(payload.health_flags || payload.healthFlags, normalizedItems, calories);
            const itemProtein = normalizedItems.reduce((sum, item) => sum + item.protein, 0);
            const itemCarbs = normalizedItems.reduce((sum, item) => sum + item.carbs, 0);
            const itemFat = normalizedItems.reduce((sum, item) => sum + item.fat, 0);
            const itemFiber = normalizedItems.reduce((sum, item) => sum + item.fiber, 0);
            const itemSugar = normalizedItems.reduce((sum, item) => sum + item.sugar, 0);
            const itemSodium = normalizedItems.reduce((sum, item) => sum + item.sodium, 0);
            const normalizedMeal = {
                name: String(payload.name || payload.meal_name || itemName || textFallback?.name || '照片餐點估算'),
                calories: Math.max(0, Math.round(calories)),
                protein: Math.max(0, Math.round(Number(payload.total_protein ?? payload.protein_g ?? payload.protein ?? (normalizedItems.length ? itemProtein : (textFallback?.protein ?? calories * 0.15 / 4))))),
                carbs: Math.max(0, Math.round(Number(payload.total_carbs ?? payload.carbs_g ?? payload.carbs ?? (normalizedItems.length ? itemCarbs : (textFallback?.carbs ?? calories * 0.5 / 4))))),
                fat: Math.max(0, Math.round(Number(payload.total_fat ?? payload.fat_g ?? payload.fat ?? (normalizedItems.length ? itemFat : (textFallback?.fat ?? calories * 0.35 / 9))))),
                fiber: Math.max(0, Math.round(Number(payload.total_fiber ?? payload.fiber_g ?? payload.fiber ?? (normalizedItems.length ? itemFiber : (textFallback?.fiber ?? estimateFiberFromMeal({ name: payload.name || itemName, items: normalizedItems })))))),
                sugar: Math.max(0, Math.round(Number(payload.total_sugar ?? payload.sugar_g ?? payload.sugar ?? (normalizedItems.length ? itemSugar : (textFallback?.sugar ?? 0))))),
                sodium: Math.max(0, Math.round(Number(payload.total_sodium ?? payload.sodium_mg ?? payload.sodium ?? (normalizedItems.length ? itemSodium : (textFallback?.sodium ?? 0))))),
                mealQuality: normalizeClientMealQuality(payload.meal_quality || payload.mealQuality, healthFlags, calories),
                healthFlags,
                confidence,
                notes: String(payload.notes || payload.advice || ''),
                items: normalizedItems.length ? normalizedItems : (textFallback?.items || [{ name: String(payload.name || payload.meal_name || '影像待確認餐點'), portion: '份量未明', calories: Math.max(0, Math.round(calories)), protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }]),
                warning: check.warning ? check.msg : '',
                source,
                aiResult: payload
            };
            return applyClientEstimateGuard(normalizedMeal);
        }

        function applyClientEstimateGuard(meal) {
            const seenText = [
                meal.name,
                meal.notes,
                ...(Array.isArray(meal.items) ? meal.items.map(item => `${item.name || ""} ${item.portion || ""}`) : [])
            ].join(" ");
            const isDrink = /可樂|cola|coke|coca|汽水|啤酒|beer|檸檬片|lemon|lime|飲料|罐/i.test(seenText);
            if (isDrink && Number(meal.calories || 0) > 280) {
                const isBeer = /啤酒|beer/i.test(seenText) && !/可樂|cola|coke|coca/i.test(seenText);
                const drinkEstimate = estimateFoodByText(isBeer ? "啤酒" : "可樂");
                if (drinkEstimate) {
                    return {
                        ...meal,
                        ...drinkEstimate,
                        name: drinkEstimate.name,
                        source: `${meal.source || "photo"}_client_drink_guard`,
                        confidence: "medium",
                        notes: "AI 看見像飲料罐但熱量高到像正餐，已用飲料防呆估算；若不是飲料，請用餐名重估。",
                        warning: [meal.warning, "已防止飲料被誤套成 520 kcal 正餐。"].filter(Boolean).join(" ")
                    };
                }
            }
            const genericName = isGenericEstimateName(seenText);
            if (genericName && Number(meal.calories || 0) === 520) {
                return applyEstimateConsistencyGuard({
                    ...meal,
                    calories: 430,
                    protein: 18,
                    carbs: 48,
                    fat: 15,
                    source: `${meal.source || "photo"}_client_generic_guard`,
                    confidence: "low",
                    notes: "AI 沒有穩定看出品項時，不直接採用固定 520 kcal；請輸入餐名或補飯後照校正。",
                    warning: [meal.warning, "AI 未看清品項，請補餐點名稱讓估算更準。"].filter(Boolean).join(" ")
                });
            }
            return applyEstimateConsistencyGuard(meal);
        }

        function isGenericEstimateName(text = "") {
            return /照片餐點|餐點估算|食物名稱|影像待確認|照片待確認|unknown/i.test(String(text || ""));
        }

        function getRecentEstimateForStability(phase = photoCapturePhase) {
            if (!currentUser) return null;
            const previous = safeJsonObject(localStorage.getItem(getEstimateMemoryKey(phase)));
            if (!previous?.calories) return null;
            const at = Number(previous.at || 0);
            if (!at || Date.now() - at > 15 * 60 * 1000) return null;
            return previous;
        }

        function getEstimateFoodTokens(source = {}) {
            const text = [
                source.name,
                source.notes,
                ...(Array.isArray(source.foods) ? source.foods : []),
                ...(Array.isArray(source.items) ? source.items.map(item => `${item.name || ""} ${item.portion || ""}`) : [])
            ].join(" ").toLowerCase();
            return [...new Set(text.split(/[\s,，、/｜|()+\-]+/).map(token => token.trim()).filter(token => token.length >= 2 && !isGenericEstimateName(token)).slice(0, 12))];
        }

        function hasEstimateFoodOverlap(current, previous) {
            const currentTokens = getEstimateFoodTokens(current);
            const previousTokens = getEstimateFoodTokens(previous);
            if (!currentTokens.length || !previousTokens.length) return false;
            return currentTokens.some(token => previousTokens.some(prev => token.includes(prev) || prev.includes(token)));
        }

        function scaleEstimateMacros(meal, targetCalories) {
            const currentCalories = Math.max(1, Number(meal.calories || 0));
            const ratio = Math.max(0.2, Math.min(3, targetCalories / currentCalories));
            const scale = value => Math.max(0, Math.round(Number(value || 0) * ratio));
            const items = Array.isArray(meal.items) ? meal.items.map(item => ({
                ...item,
                calories: scale(item.calories),
                protein: scale(item.protein),
                carbs: scale(item.carbs),
                fat: scale(item.fat),
                fiber: scale(item.fiber),
                sugar: scale(item.sugar),
                sodium: scale(item.sodium)
            })) : meal.items;
            return {
                ...meal,
                calories: Math.max(0, Math.round(targetCalories)),
                protein: scale(meal.protein),
                carbs: scale(meal.carbs),
                fat: scale(meal.fat),
                fiber: scale(meal.fiber),
                sugar: scale(meal.sugar),
                sodium: scale(meal.sodium),
                items
            };
        }

        function applyEstimateConsistencyGuard(meal, phase = photoCapturePhase) {
            if (!currentUser || !meal) return meal;
            const normalizedPhase = phase === "after" ? "after" : "before";
            const kcal = Math.max(0, Math.round(Number(meal.calories || 0)));
            const previous = getRecentEstimateForStability(normalizedPhase);
            if (!previous?.calories || !kcal) return meal;
            const previousKcal = Math.max(0, Math.round(Number(previous.calories || 0)));
            const diff = Math.abs(previousKcal - kcal);
            const smaller = Math.max(1, Math.min(previousKcal, kcal));
            const seenText = [
                meal.name,
                meal.notes,
                ...(Array.isArray(meal.items) ? meal.items.map(item => `${item.name || ""} ${item.portion || ""}`) : [])
            ].join(" ");
            const currentLooksGeneric = isGenericEstimateName(seenText);
            const sameFood = hasEstimateFoodOverlap(meal, previous);
            const veryFresh = Date.now() - Number(previous.at || 0) < 2 * 60 * 1000;
            const unstable = diff >= Math.max(150, Math.round(smaller * 0.35));
            if (!unstable || (!sameFood && !(currentLooksGeneric && veryFresh))) return meal;
            const stable = scaleEstimateMacros(meal, previousKcal);
            const previousName = previous.name && !isGenericEstimateName(previous.name) ? previous.name : meal.name;
            const foods = (previous.foods || []).filter(Boolean).slice(0, 3).join("、") || previousName || "這餐";
            return {
                ...stable,
                name: previousName || stable.name,
                source: `${meal.source || "photo"}_stability_guard`,
                confidence: "low",
                notes: [meal.notes, `同一時段前後估算差太大，塔塔先沿用上一張較穩的 ${previousKcal} kcal；AI 看到的食物：${foods}。`].filter(Boolean).join(" "),
                warning: [meal.warning, `同一時段前後估算差太大，已先用上一張估算 ${previousKcal} kcal 防止第二張飄掉。`].filter(Boolean).join(" ")
            };
        }

        function normalizeClientHealthFlags(sourceFlags, items, totalCalories) {
            const flags = new Set();
            if (Array.isArray(sourceFlags)) {
                sourceFlags.map(String).forEach(flag => {
                    const normalized = flag.toLowerCase();
                    if (normalized.includes('sugar') || normalized.includes('sweet')) flags.add('sugary');
                    else if (normalized.includes('sodium') || normalized.includes('salt')) flags.add('high_sodium');
                    else if (normalized.includes('fried') || normalized.includes('fat') || normalized.includes('oil')) flags.add('fried_or_high_fat');
                    else flags.add(flag);
                });
            }
            const text = items.map(item => item.name).join(' ');
            const sugar = items.reduce((sum, item) => sum + Number(item.sugar || 0), 0);
            const sodium = items.reduce((sum, item) => sum + Number(item.sodium || 0), 0);
            const fat = items.reduce((sum, item) => sum + Number(item.fat || 0), 0);
            if (/[炸薯條鹹酥雞炸雞天婦羅]/.test(text) || fat >= 35) flags.add('fried_or_high_fat');
            if (/[可樂汽水奶茶手搖果汁甜點蛋糕]/.test(text) || sugar >= 25) flags.add('sugary');
            if (/[泡麵拉麵火鍋麻辣滷味泡菜]/.test(text) || sodium >= 900) flags.add('high_sodium');
            if (/[沙拉青菜蔬菜地瓜糙米全穀豆]/.test(text)) flags.add('fiber_source');
            if (totalCalories >= 850) flags.add('heavy_meal');
            return [...flags];
        }

        function normalizeClientMealQuality(value, flags, totalCalories) {
            const quality = String(value || '').toLowerCase();
            const allowed = ['balanced', 'light', 'heavy', 'sugary', 'salty', 'fried', 'unknown'];
            if (allowed.includes(quality)) return quality;
            return inferMealQualityFromFlags(flags, totalCalories);
        }

        function inferMealQualityFromFlags(flags, totalCalories) {
            const list = Array.isArray(flags) ? flags : [];
            if (list.includes('sugary')) return 'sugary';
            if (list.includes('high_sodium')) return 'salty';
            if (list.includes('fried_or_high_fat')) return 'fried';
            if (list.includes('heavy_meal') || totalCalories >= 850) return 'heavy';
            if (list.includes('fiber_source')) return 'balanced';
            return 'unknown';
        }

        function sanityCheck(items, totalCalories) {
            for (const item of items) {
                const text = `${item.name} ${item.portion}`;
                if ((text.includes('小碟') || text.includes('小菜') || text.includes('配菜')) && item.calories > 200) {
                    return { warning: true, msg: '這個估算可能偏高：小碟配菜通常不超過 100 kcal，建議確認。' };
                }
            }
            if (totalCalories > 1500) return { warning: true, msg: '熱量偏高，請確認份量是否正確。' };
            return { warning: false };
        }

        function estimateMealLocally(fileName) {
            const name = (fileName || '').toLowerCase();
            const textEstimate = estimateFoodByText(fileName);
            if (textEstimate) return textEstimate;
            if (name.includes('salad') || name.includes('沙拉')) return { name: '照片餐點：沙拉類', calories: 320, protein: 18, carbs: 28, fat: 15, source: 'manual' };
            if (name.includes('rice') || name.includes('便當') || name.includes('飯')) return { name: '照片餐點：飯食類', calories: 680, protein: 28, carbs: 82, fat: 24, source: 'manual' };
            return {
                name: '照片待確認餐點',
                calories: 430,
                protein: 18,
                carbs: 48,
                fat: 15,
                fiber: 3,
                sugar: 6,
                sodium: 650,
                source: 'manual_photo_fallback',
                confidence: 'low',
                notes: '照片已讀取，但 AI 暫時不穩；先用一般一份餐點保守估算，補上餐名後會更準。',
                items: [{ name: '照片待確認餐點', portion: '約 1 份', calories: 430, protein: 18, carbs: 48, fat: 15, fiber: 3, sugar: 6, sodium: 650 }]
            };
        }

        let taiwanFoodDatabaseCache = null;

        function isGenericPhotoFileName(value = "") {
            const text = String(value || "").trim().toLowerCase();
            if (!text) return true;
            if (/\.(jpg|jpeg|png|webp|heic|gif)$/i.test(text)) return true;
            if (/^(img|image|photo|picture|dsc|pxl|screenshot|test|test_food|food|meal)[-_ ]?\d*/i.test(text)) return true;
            return false;
        }

        function cleanFoodSearchText(value = "") {
            const original = String(value || "").trim();
            if (isGenericPhotoFileName(original)) return "";
            return original
                .replace(/\.(jpg|jpeg|png|webp|heic|gif)$/ig, "")
                .replace(/[_-]+/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function makeFoodEntry(name, kcal, protein, carbs, fat, fiber = 3, sugar = 4, sodium = 650, aliases = [], portion = "約 1 份") {
            return { name, kcal, protein, carbs, fat, fiber, sugar, sodium, aliases, portion };
        }

        function getTaiwanFoodDatabase() {
            if (taiwanFoodDatabaseCache) return taiwanFoodDatabaseCache;
            const base = [
                makeFoodEntry("雞腿便當", 760, 38, 86, 28, 5, 8, 980, ["雞腿飯", "炸雞腿便當"], "約 1 盒"),
                makeFoodEntry("排骨便當", 820, 34, 92, 34, 4, 8, 1050, ["排骨飯", "炸排骨便當"], "約 1 盒"),
                makeFoodEntry("滷肉飯", 520, 16, 72, 18, 2, 6, 720, ["魯肉飯"], "約 1 碗"),
                makeFoodEntry("雞肉飯", 460, 22, 68, 12, 2, 4, 680, [], "約 1 碗"),
                makeFoodEntry("牛肉麵", 720, 36, 82, 26, 5, 6, 1450, ["紅燒牛肉麵"], "約 1 碗"),
                makeFoodEntry("乾麵", 520, 18, 78, 16, 4, 5, 920, ["陽春乾麵"], "約 1 碗"),
                makeFoodEntry("鍋燒意麵", 650, 24, 78, 24, 4, 5, 1350, [], "約 1 碗"),
                makeFoodEntry("水餃", 520, 24, 62, 18, 3, 4, 900, ["高麗菜水餃"], "約 10 顆"),
                makeFoodEntry("小籠包", 620, 26, 70, 26, 3, 6, 980, [], "約 8 顆"),
                makeFoodEntry("蚵仔煎", 430, 14, 52, 18, 3, 8, 780, [], "約 1 份"),
                makeFoodEntry("鹹酥雞", 680, 32, 46, 38, 3, 6, 1150, ["鹽酥雞"], "約 1 袋"),
                makeFoodEntry("滷味", 560, 30, 46, 24, 5, 8, 1550, [], "約 1 份"),
                makeFoodEntry("火鍋", 820, 42, 54, 46, 8, 10, 1800, ["小火鍋", "涮涮鍋"], "約 1 鍋"),
                makeFoodEntry("健康便當", 560, 36, 58, 18, 7, 6, 760, ["舒肥雞便當", "水煮便當"], "約 1 盒"),
                makeFoodEntry("雞胸沙拉", 360, 34, 24, 14, 7, 6, 520, ["舒肥雞沙拉"], "約 1 盒"),
                makeFoodEntry("地瓜", 180, 3, 41, 0, 5, 12, 60, ["烤地瓜"], "約 1 條"),
                makeFoodEntry("茶葉蛋", 75, 7, 1, 5, 0, 0, 230, [], "約 1 顆"),
                makeFoodEntry("無糖豆漿", 130, 10, 8, 6, 2, 3, 80, [], "約 1 杯"),
                makeFoodEntry("奶茶", 360, 6, 58, 12, 0, 46, 120, ["手搖奶茶"], "約 1 杯"),
                makeFoodEntry("珍珠奶茶", 520, 7, 82, 16, 1, 62, 160, ["波霸奶茶"], "約 1 杯"),
                makeFoodEntry("可樂", 140, 0, 35, 0, 0, 35, 20, ["cola", "coke"], "約 1 罐"),
                makeFoodEntry("拿鐵", 180, 9, 16, 8, 0, 12, 120, ["咖啡拿鐵"], "約 1 杯")
            ];
            const mains = [
                ["烤雞腿", 420, 34, 6, 26], ["滷雞腿", 390, 34, 8, 22], ["炸雞排", 620, 34, 38, 36],
                ["鯖魚", 360, 28, 2, 26], ["鮭魚", 430, 30, 4, 30], ["滷排骨", 460, 30, 18, 28],
                ["控肉", 520, 24, 12, 42], ["雞胸肉", 230, 38, 2, 6], ["豆腐", 220, 18, 10, 12],
                ["三杯雞", 520, 32, 18, 34]
            ];
            const staples = [
                ["白飯", 280, 5, 62, 1], ["糙米飯", 260, 6, 56, 2], ["炒飯", 650, 20, 90, 22],
                ["炒麵", 620, 18, 86, 22], ["粄條", 520, 16, 78, 14], ["米粉", 500, 15, 76, 13],
                ["意麵", 560, 18, 82, 18], ["河粉", 540, 18, 80, 14]
            ];
            const vegs = [
                ["燙青菜", 80, 4, 10, 3, 4], ["高麗菜", 90, 4, 12, 3, 4], ["地瓜葉", 95, 5, 11, 3, 5],
                ["花椰菜", 80, 5, 10, 2, 5], ["菇類", 70, 4, 9, 2, 4], ["海帶", 60, 2, 10, 1, 4]
            ];
            const soups = [
                ["味噌湯", 80, 5, 8, 3, 1, 3, 620], ["貢丸湯", 180, 10, 12, 10, 1, 3, 780],
                ["青菜蛋花湯", 120, 8, 8, 6, 2, 2, 520], ["魚湯", 220, 24, 6, 10, 1, 2, 760],
                ["玉米濃湯", 260, 8, 28, 12, 2, 8, 680]
            ];
            const breakfasts = [
                ["蛋餅", 330, 12, 38, 14, 2, 4, 620], ["飯糰", 520, 14, 82, 15, 4, 6, 780],
                ["蘿蔔糕", 360, 8, 54, 12, 2, 5, 720], ["吐司夾蛋", 360, 15, 42, 14, 3, 7, 620],
                ["漢堡蛋", 430, 20, 46, 18, 3, 8, 760], ["鐵板麵", 560, 18, 76, 20, 3, 8, 980]
            ];
            const snacks = [
                ["肉圓", 420, 14, 62, 14, 3, 8, 780], ["臭豆腐", 520, 18, 42, 30, 4, 6, 820],
                ["甜不辣", 430, 16, 58, 14, 3, 8, 900], ["章魚燒", 430, 16, 52, 18, 2, 8, 760],
                ["刈包", 520, 20, 56, 24, 3, 10, 780], ["蔥油餅", 460, 10, 55, 22, 2, 4, 680]
            ];
            const combos = [];
            mains.forEach(([main, kcal, p, c, f]) => {
                combos.push(makeFoodEntry(`${main}便當`, kcal + 300, p + 7, c + 68, f + 5, 5, 8, 980, [`${main}飯`], "約 1 盒"));
                combos.push(makeFoodEntry(`${main}半飯便當`, kcal + 190, p + 7, c + 42, f + 5, 5, 5, 880, [], "約 1 盒"));
            });
            staples.forEach(([name, kcal, p, c, f]) => combos.push(makeFoodEntry(name, kcal, p, c, f, 3, 5, 650, [], "約 1 碗")));
            vegs.forEach(([name, kcal, p, c, f, fiber]) => combos.push(makeFoodEntry(name, kcal, p, c, f, fiber, 3, 220, [], "約 1 份")));
            soups.forEach(([name, kcal, p, c, f, fiber, sugar, sodium]) => combos.push(makeFoodEntry(name, kcal, p, c, f, fiber, sugar, sodium, [], "約 1 碗")));
            breakfasts.forEach(([name, kcal, p, c, f, fiber, sugar, sodium]) => combos.push(makeFoodEntry(name, kcal, p, c, f, fiber, sugar, sodium, [], "約 1 份")));
            snacks.forEach(([name, kcal, p, c, f, fiber, sugar, sodium]) => combos.push(makeFoodEntry(name, kcal, p, c, f, fiber, sugar, sodium, [], "約 1 份")));
            mains.forEach(([main, kcal, p, c, f]) => vegs.forEach(([veg, vk, vp, vc, vf, vfi]) => {
                combos.push(makeFoodEntry(`${main}${veg}餐盤`, kcal + vk + 180, p + vp + 5, c + vc + 38, f + vf + 2, vfi + 2, 6, 780, [], "約 1 盤"));
            }));
            mains.forEach(([main, kcal, p, c, f]) => staples.forEach(([staple, sk, sp, sc, sf]) => {
                combos.push(makeFoodEntry(`${main}${staple}`, kcal + sk, p + sp, c + sc, f + sf, 4, 6, 860, [`${main}配${staple}`], "約 1 份"));
            }));
            staples.forEach(([staple, sk, sp, sc, sf]) => soups.forEach(([soup, tk, tp, tc, tf, tfi, ts, tna]) => {
                combos.push(makeFoodEntry(`${staple}加${soup}`, sk + tk, sp + tp, sc + tc, sf + tf, (tfi || 1) + 2, ts || 5, tna || 900, [], "約 1 套"));
            }));
            taiwanFoodDatabaseCache = [...base, ...combos].slice(0, 260);
            return taiwanFoodDatabaseCache;
        }

        function findTaiwanFoodEstimate(text = "") {
            const query = cleanFoodSearchText(text);
            if (!query) return null;
            const normalized = query.toLowerCase();
            return getTaiwanFoodDatabase().find(food => [food.name, ...(food.aliases || [])].some(name => {
                const value = String(name || "");
                return normalized.includes(value.toLowerCase()) || value.includes(query);
            })) || null;
        }

        function foodEntryToEstimate(entry, source = "local_food_database", confidence = "medium") {
            return {
                name: entry.name,
                calories: entry.kcal,
                protein: entry.protein,
                carbs: entry.carbs,
                fat: entry.fat,
                fiber: entry.fiber || 0,
                sugar: entry.sugar || 0,
                sodium: entry.sodium || 0,
                source,
                confidence,
                notes: `本機食物庫估算：已從 ${getTaiwanFoodDatabase().length} 筆台灣常見食物資料中配對。`,
                items: [{ name: entry.name, portion: entry.portion || "約 1 份", calories: entry.kcal, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, fiber: entry.fiber || 0, sugar: entry.sugar || 0, sodium: entry.sodium || 0 }]
            };
        }

        function getDefaultLocalMealEstimate() {
            return foodEntryToEstimate(makeFoodEntry("塔塔均衡餐盤", 560, 30, 62, 18, 7, 6, 720, ["照片待確認"], "約 1 盤"), "local_photo_default", "low");
        }

        function estimateMealLocally(fileName) {
            const hint = cleanFoodSearchText(document.getElementById('quickFoodName')?.value || "")
                || cleanFoodSearchText(currentMealPlan?.foodName || "")
                || cleanFoodSearchText(fileName || "");
            const dbMatch = findTaiwanFoodEstimate(hint);
            if (dbMatch) return foodEntryToEstimate(dbMatch);
            const textEstimate = hint ? estimateFoodByText(hint) : null;
            if (textEstimate && !isGenericPhotoFileName(textEstimate.name)) return { ...textEstimate, name: cleanFoodSearchText(textEstimate.name) || textEstimate.name };
            return getDefaultLocalMealEstimate();
        }

        function estimateAfterPhotoLocally(targetMeal, hint = "") {
            const beforeCalories = Math.max(0, Math.round(Number(targetMeal?.beforeCalories || targetMeal?.calories || 0)));
            const base = estimateFoodByText(hint || targetMeal?.name || "") || estimateMealLocally(targetMeal?.name || hint || "飯後剩餘量");
            const remainingCalories = beforeCalories ? Math.round(beforeCalories * 0.2) : Math.min(160, Math.round(Number(base.calories || 180) * 0.35));
            const ratio = beforeCalories ? Math.max(0.05, Math.min(0.5, remainingCalories / beforeCalories)) : 0.3;
            const items = (targetMeal?.items?.length ? targetMeal.items : base.items || []).map(item => ({
                ...item,
                name: item.name || targetMeal?.name || "飯後剩餘食物",
                portion: "飯後剩餘量保守估算",
                calories: Math.max(0, Math.round(Number(item.calories || remainingCalories) * ratio)),
                protein: Math.max(0, Math.round(Number(item.protein || base.protein || 0) * ratio)),
                carbs: Math.max(0, Math.round(Number(item.carbs || base.carbs || 0) * ratio)),
                fat: Math.max(0, Math.round(Number(item.fat || base.fat || 0) * ratio)),
                fiber: Math.max(0, Math.round(Number(item.fiber || base.fiber || 0) * ratio)),
                sugar: Math.max(0, Math.round(Number(item.sugar || base.sugar || 0) * ratio)),
                sodium: Math.max(0, Math.round(Number(item.sodium || base.sodium || 0) * ratio))
            }));
            return {
                name: targetMeal?.name ? `${targetMeal.name} 飯後剩餘` : "飯後剩餘量",
                calories: remainingCalories,
                protein: Math.max(0, Math.round(Number(base.protein || 0) * ratio)),
                carbs: Math.max(0, Math.round(Number(base.carbs || 0) * ratio)),
                fat: Math.max(0, Math.round(Number(base.fat || 0) * ratio)),
                fiber: Math.max(0, Math.round(Number(base.fiber || 0) * ratio)),
                sugar: Math.max(0, Math.round(Number(base.sugar || 0) * ratio)),
                sodium: Math.max(0, Math.round(Number(base.sodium || 0) * ratio)),
                source: "local_after_photo_fallback",
                confidence: "low",
                notes: "飯後照已讀取。AI 不穩時先用餐前餐點做剩餘量保守估算；若不確定，塔塔會保留餐前熱量，只把飯後照片補進回憶。",
                items: items.length ? items : [{ name: "飯後剩餘食物", portion: "飯後剩餘量保守估算", calories: remainingCalories, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }]
            };
        }

        function estimateFoodByText(text) {
            const raw = String(text || '').trim();
            if (!raw) return null;
            const soup = estimateSoupByText(raw);
            if (soup) return soup;
            const normalized = raw.toLowerCase();
            const rules = [
                { keys: ['零卡', '無糖可樂', 'zero'], kcal: 0, protein: 0, carbs: 0, fat: 0 },
                { keys: ['便當', '排骨便當', '雞腿便當'], kcal: 760, protein: 32, carbs: 88, fat: 28 },
                { keys: ['滷肉飯', '魯肉飯'], kcal: 520, protein: 16, carbs: 72, fat: 18 },
                { keys: ['白飯', '飯'], kcal: 280, protein: 5, carbs: 62, fat: 1 },
                { keys: ['炒飯'], kcal: 720, protein: 24, carbs: 88, fat: 28 },
                { keys: ['麵', '拉麵', '牛肉麵', '乾麵'], kcal: 650, protein: 26, carbs: 86, fat: 22 },
                { keys: ['水餃', '餃子'], kcal: 520, protein: 22, carbs: 60, fat: 20 },
                { keys: ['雞胸', '雞肉'], kcal: 260, protein: 38, carbs: 4, fat: 9 },
                { keys: ['牛肉', '豬肉', '排骨'], kcal: 430, protein: 30, carbs: 8, fat: 28 },
                { keys: ['魚', '鮭魚'], kcal: 360, protein: 28, carbs: 4, fat: 24 },
                { keys: ['蛋', '蛋料理'], kcal: 160, protein: 12, carbs: 2, fat: 11 },
                { keys: ['沙拉', '生菜'], kcal: 320, protein: 18, carbs: 28, fat: 15 },
                { keys: ['麵包', '吐司', '三明治'], kcal: 360, protein: 14, carbs: 48, fat: 12 },
                { keys: ['豆腐', '豆干'], kcal: 220, protein: 18, carbs: 10, fat: 12 },
                { keys: ['地瓜', '番薯'], kcal: 180, protein: 3, carbs: 42, fat: 0 },
                { keys: ['泡菜', '小菜'], kcal: 50, protein: 2, carbs: 8, fat: 1 },
                { keys: ['可樂', 'coke', 'cola', '汽水'], kcal: 140, protein: 0, carbs: 35, fat: 0 },
                { keys: ['啤酒'], kcal: 150, protein: 1, carbs: 13, fat: 0 }
            ];
            const matched = rules.find(rule => rule.keys.some(key => normalized.includes(key.toLowerCase()) || raw.includes(key)));
            const result = matched || { kcal: 430, protein: 18, carbs: 48, fat: 15, fiber: 3, sugar: 6, sodium: 650 };
            return {
                name: raw,
                calories: result.kcal,
                protein: result.protein,
                carbs: result.carbs,
                fat: result.fat,
                fiber: result.fiber || 0,
                sugar: result.sugar || 0,
                sodium: result.sodium || 0,
                source: matched ? 'local_text' : 'local_text_unknown',
                confidence: matched ? 'medium' : 'low',
                notes: matched ? '依常見一份餐點保守估算；份量偏大或醬料多時請加一點。' : '未命中明確餐點規則，先以一般餐點保守估算；可再補充份量或改名。',
                items: [{ name: raw, portion: '約 1 份', calories: result.kcal, protein: result.protein, carbs: result.carbs, fat: result.fat, fiber: result.fiber || 0, sugar: result.sugar || 0, sodium: result.sodium || 0 }]
            };
        }

        function estimateSoupByText(text) {
            const raw = String(text || '').trim();
            if (!raw) return null;
            const normalized = raw.toLowerCase();
            if (!/[湯汤羹soup]/i.test(raw)) return null;
            const rules = [
                { keys: ['清湯', '青菜湯', '海帶湯', '紫菜湯', '冬瓜湯', '蘿蔔湯', '菇', '菇菇湯', '蔬菜湯'], kcal: 90, protein: 4, carbs: 10, fat: 3 },
                { keys: ['味噌湯', '豆腐湯', '蛋花湯', '貢丸湯', '魚丸湯'], kcal: 150, protein: 9, carbs: 10, fat: 7 },
                { keys: ['雞湯', '排骨湯', '牛肉湯', '羊肉湯', '肉湯'], kcal: 260, protein: 20, carbs: 8, fat: 16 },
                { keys: ['酸辣湯', '羹', '勾芡'], kcal: 230, protein: 10, carbs: 24, fat: 10 },
                { keys: ['濃湯', '玉米濃湯', '奶油', '南瓜濃湯', '起司'], kcal: 320, protein: 9, carbs: 28, fat: 18 },
                { keys: ['火鍋', '鍋', '麻辣湯', '麻辣鍋'], kcal: 520, protein: 24, carbs: 28, fat: 34 }
            ];
            const matched = rules.find(rule => rule.keys.some(key => normalized.includes(key.toLowerCase()) || raw.includes(key)));
            const result = matched || { kcal: 180, protein: 8, carbs: 14, fat: 9 };
            return {
                name: raw || '湯品估算',
                calories: result.kcal,
                protein: result.protein,
                carbs: result.carbs,
                fat: result.fat,
                source: 'local_soup',
                confidence: matched ? 'medium' : 'low',
                notes: '依常見一碗湯品約 300-450 ml 保守估算；若料很多或有喝完整鍋湯，請手動調整。',
                items: [{ name: raw || '湯品', portion: '約 1 碗', calories: result.kcal, protein: result.protein, carbs: result.carbs, fat: result.fat }]
            };
        }

        function setEstimateLoadingState(stage, message, photo = "") {
            const resultEl = document.getElementById('estimateResult');
            const photoEl = document.getElementById('mealPhoto');
            const meta = document.getElementById('estimateMeta');
            const trust = document.getElementById('estimateTrustLine');
            const explain = document.getElementById('estimateExplainCard');
            const list = document.getElementById('foodItemsList');
            const note = document.getElementById('confidenceNote');
            const recognition = document.getElementById('foodRecognitionSummaryCard');
            const calibration = document.getElementById('estimateCalibrationCard');
            const saveStatus = document.getElementById('estimateSaveStatusCard');
            if (selectedMeal && selectedMeal.source === "photo_loading") {
                selectedMeal.photo = photo || selectedMeal.photo || "";
                selectedMeal.speedStage = stage;
                selectedMeal.speedMessage = message;
            }
            if (resultEl) resultEl.style.display = "block";
            if (photo && photoEl) {
                photoEl.src = photo;
                photoEl.style.display = "block";
            }
            if (meta) meta.innerHTML = `<span class="estimate-pill loading">${stage}</span><span class="estimate-pill">可補餐名加速</span>`;
            if (trust) {
                trust.classList.add('loading');
                trust.innerHTML = `${stage} <span>${message}</span>`;
            }
            if (explain) explain.innerHTML = `<strong>正在建立估算：</strong>${message} 如果 AI 較慢，塔塔會先用本機規則給可修改估算，不會讓照片消失。`;
            if (recognition) {
                recognition.classList.remove('active');
                recognition.innerHTML = "";
            }
            if (calibration) {
                calibration.classList.remove('active', 'warn');
                calibration.innerHTML = "";
            }
            if (saveStatus) {
                saveStatus.classList.remove('active', 'safe');
                saveStatus.innerHTML = "";
            }
            renderP2ResultCard();
            if (list) list.innerHTML = `<div class="food-item-row"><span><strong>AI 看到的食物</strong><br><span style="color:var(--color-muted);">讀取中，補餐名會更快更準</span></span><span>辨識中</span></div>`;
            if (note) {
                note.style.display = "block";
                note.innerText = "照片已先保留在畫面上。AI 若超時，仍可用本機估算或手動輸入餐點名稱。";
            }
            renderImmediateNutritionCoachCard();
            renderMealSpeedPromiseCard();
            scrollEstimateResultIntoView();
        }

        function showEstimateResult(meal, photo, phase = "single", photoSessionId = activePhotoSessionId) {
            selectedPortion = 1;
            const capturedAt = new Date();
            selectedMeal = {
                ...normalizeMealEstimate(meal, meal.source || 'photo_estimate'),
                photo: photo || meal.photo || "",
                source: meal.source || 'photo_estimate',
                phase,
                mealSlot: getMealSlot(capturedAt),
                capturedAt: capturedAt.toISOString(),
                locationSnapshot: activeMealLocationSnapshot || meal.locationSnapshot || null,
                photoSessionId
            };
            const stabilityWarning = getEstimateStabilityWarning(selectedMeal, phase);
            if (stabilityWarning) {
                selectedMeal.warning = [selectedMeal.warning, stabilityWarning].filter(Boolean).join(" ");
                selectedMeal.confidence = "low";
            }
            rememberEstimateForStability(selectedMeal, phase);
            applySelectedMealToUI();
            const resultEl = document.getElementById('estimateResult');
            resultEl.style.display = "block";
            resultEl.classList.remove("result-ready");
            void resultEl.offsetWidth;
            resultEl.classList.add("result-ready");
            const photoEl = document.getElementById('mealPhoto');
            if (selectedMeal.photo) { photoEl.src = selectedMeal.photo; photoEl.style.display = "block"; }
            else { photoEl.removeAttribute('src'); photoEl.style.display = "none"; }
            document.getElementById('manualFoodName').value = selectedMeal.name;
            document.getElementById('manualCalories').value = selectedMeal.calories || "";
            updateConfirmMealButton();
            autoSaveMealDraft({ phase, photo: selectedMeal.photo, photoSessionId, meal: selectedMeal, status: "auto_estimated" });
            scrollEstimateResultIntoView();
        }

        async function retryCurrentPhotoAnalysis() {
            const photo = selectedMeal.photo || document.getElementById('mealPhoto')?.src || "";
            if (!photo || !String(photo).startsWith("data:image/")) {
                showToast("目前沒有可重跑的照片，請重新拍或從相簿選。");
                return false;
            }
            const phase = selectedMeal.phase === "after" ? "after" : "before";
            const photoSessionId = Date.now();
            activePhotoSessionId = photoSessionId;
            photoCapturePhase = phase;
            setEstimateLoadingState("重新辨識照片", "塔塔正在用同一張照片重跑 AI；若仍失敗，會保留本機估算與照片。", photo);
            saveActivePhotoDraft({ phase, photo, fileName: selectedMeal.name || "", photoSessionId, status: "retrying", meal: selectedMeal });
            try {
                const result = await estimateCalories(photo, { phase, fileName: selectedMeal.name || "", photoSessionId });
                if (photoSessionId !== activePhotoSessionId) return false;
                showEstimateResult(result, photo, phase, photoSessionId);
                saveActivePhotoDraft({ phase, photo, fileName: selectedMeal.name || "", photoSessionId, status: "estimated", meal: result });
                showToast("照片已重新辨識。");
            } catch (error) {
                if (photoSessionId !== activePhotoSessionId) return false;
                showPhotoPendingResult(photo, getFriendlyAiError(error.message), phase, selectedMeal.name || "", photoSessionId);
                saveActivePhotoDraft({ phase, photo, fileName: selectedMeal.name || "", photoSessionId, status: "fallback", meal: selectedMeal });
                showToast("AI 仍不穩，已保留照片與本機估算。");
            }
            return false;
        }

        function updateConfirmMealButton() {
            const button = document.getElementById('confirmMealBtn');
            if (!button) return;
            if (selectedMeal.phase === "after") button.innerText = pendingBeforeMeal ? "套用飯後校正" : "儲存飯後照";
            else button.innerText = "儲存這餐";
        }

        function adjustPortion(amount) {
            selectedPortion = Math.max(0.25, Math.min(4, selectedPortion + amount));
            applySelectedMealToUI();
            autoSaveSelectedMealDraft("auto_portion_adjusted");
        }

        function applySelectedMealToUI() {
            selectedMealName = selectedMeal.name;
            selectedMealKcal = Math.round(selectedMeal.calories * selectedPortion);
            selectedP = Math.round(selectedMeal.protein * selectedPortion);
            selectedV = Math.round(selectedMeal.carbs * selectedPortion);
            selectedF = Math.round(selectedMeal.fat * selectedPortion);
            selectedFiber = Math.round((selectedMeal.fiber || estimateFiberFromMeal(selectedMeal) || 0) * selectedPortion);
            selectedSugar = Math.round((selectedMeal.sugar || 0) * selectedPortion);
            selectedSodium = Math.round((selectedMeal.sodium || 0) * selectedPortion);
            selectedMeal.healthFlags = normalizeClientHealthFlags(selectedMeal.healthFlags || [], selectedMeal.items || [], selectedMealKcal);
            selectedMeal.mealQuality = selectedMeal.mealQuality || inferMealQualityFromFlags(selectedMeal.healthFlags, selectedMealKcal);
            document.getElementById('mealName').innerText = selectedMealName;
            document.getElementById('estCalories').innerText = selectedMealKcal;
            document.getElementById('estProtein').innerText = selectedP;
            document.getElementById('estCarbs').innerText = selectedV;
            document.getElementById('estFat').innerText = selectedF;
            document.getElementById('portionCount').innerText = `${Number(selectedPortion.toFixed(2))} 份`;
            renderFoodItems();
            renderEstimateMeta();
            renderEstimateTrustLine();
            renderEstimateExplainCard();
            renderEstimateCalibrationCard();
            renderFoodRecognitionSummaryCard();
            renderConfidenceNote();
            renderEstimateSaveStatusCard();
            renderP2ResultCard();
            renderMealFlowCard();
            renderMealSpeedPromiseCard();
            renderImmediateNutritionCoachCard();
            renderBottomPhotoAction();
            updateConfirmMealButton();
        }

        function getEstimateTrustInfo(meal = selectedMeal) {
            const source = String(meal.source || "");
            const confidence = String(meal.confidence || "medium");
            const isAiVisual = source === "ai_photo" || source === "gemini" || source === "openai";
            const isLocal = /local|fallback|pending|manual_photo/.test(source);
            if (confidence === "high" && isAiVisual) {
                return { level: "高", body: "AI 視覺有看清楚食物與份量，仍可依實際湯汁、醬料或分食狀況微調。" };
            }
            if (confidence === "low") {
                return { level: "低", body: "照片或餐名資訊不足，塔塔先保守估算；建議補餐點名稱、份量或手動校正。" };
            }
            if (isLocal) {
                return { level: "中", body: "目前使用本機規則或文字輔助估算，速度快但份量差異仍需要你確認。" };
            }
            return { level: "中", body: "AI 已回傳可用結果；若實際份量、湯汁或醬料不同，可以用下方欄位微調。" };
        }

        function renderEstimateTrustLine() {
            const trustEl = document.getElementById('estimateTrustLine');
            if (!trustEl) return;
            trustEl.classList.remove('loading');
            const trust = getEstimateTrustInfo(selectedMeal);
            trustEl.innerHTML = `估算可信度：${trust.level} <span>${trust.body}</span>`;
        }

        function getEstimateSourceLabel(source = selectedMeal.source) {
            const sourceMap = {
                ai_photo: "AI 辨識",
                gemini: "AI 辨識",
                openai: "AI 辨識",
                gemini_text_assist: "文字輔助",
                openai_text_assist: "文字輔助",
                gemini_drink_guard: "飲料防呆",
                openai_drink_guard: "飲料防呆",
                gemini_drink_review: "飲料需確認",
                openai_drink_review: "飲料需確認",
                gemini_generic_guard: "本機估算",
                openai_generic_guard: "本機估算",
                local_text_fast: "本機估算",
                local_text: "本機估算",
                local_text_fallback: "本機估算",
                local_soup: "本機估算",
                local_photo_quick_fallback: "本機估算",
                local_food_database: "本機估算",
                local_photo_default: "本機估算",
                photo_pending: "本機估算",
                manual_photo_fallback: "本機估算",
                local_after_photo_fallback: "飯後校正估算",
                local_no_ai: "本機估算",
                local_ai_error: "本機估算",
                local_ai_timeout: "本機估算",
                local_invalid_ai: "本機估算"
            };
            return sourceMap[source] || "估算來源";
        }

        function renderEstimateExplainCard() {
            const card = document.getElementById('estimateExplainCard');
            if (!card) return;
            const seenFoods = (selectedMeal.items || []).map(item => item.name).filter(Boolean).slice(0, 4).join('、') || selectedMeal.name || "這餐";
            const portions = (selectedMeal.items || []).map(item => item.portion).filter(Boolean).slice(0, 3).join('、') || `${Number(selectedPortion.toFixed(2))} 份`;
            const sourceLabel = getEstimateSourceLabel(selectedMeal.source);
            const lowTrust = selectedMeal.confidence === "low" || /fallback|pending|unknown|manual_photo/.test(String(selectedMeal.source || ""));
            const action = lowTrust
                ? "若餐點名稱、湯汁喝完程度或份量不同，請直接改名稱/熱量再記錄。"
                : "若有分食、醬料、湯汁或飯後剩餘，可用份量鈕或飯後補拍校正。";
            const retryRow = lowTrust && selectedMeal.photo
                ? `<div class="estimate-retry-row"><button class="estimate-retry-btn primary" type="button" onclick="retryCurrentPhotoAnalysis()">重新辨識照片</button><button class="estimate-retry-btn" type="button" onclick="estimateTypedMeal()">用餐名重估</button></div>`
                : "";
            card.innerHTML = `<strong>本次估算依據：</strong>${sourceLabel} 判斷「${seenFoods}」，份量線索為 ${portions}。${action}${retryRow}`;
        }

        function getEstimateCalibrationCoach(meal = selectedMeal) {
            const trust = getEstimateTrustInfo(meal);
            const items = Array.isArray(meal.items) ? meal.items : [];
            const sourceLabel = getEstimateSourceLabel(meal.source);
            const kcal = Math.round(Number(selectedMealKcal || meal.calories || 0));
            const hasNamedItems = items.some(item => String(item.name || "").trim());
            const hasPortion = items.some(item => String(item.portion || "").trim()) || Number(selectedPortion || 0) !== 1;
            const isLowTrust = String(meal.confidence || "medium") === "low" || /fallback|pending|unknown|manual_photo|invalid|timeout/.test(String(meal.source || ""));
            const isAfter = meal.phase === "after";
            const needs = [];
            if (!hasNamedItems || /照片待確認|照片餐點|食物待確認/.test(String(meal.name || ""))) needs.push("餐點名稱");
            if (!hasPortion) needs.push("份量");
            if (/湯|鍋|拉麵|泡菜|咖哩|醬|飲料|可樂|奶茶|啤酒|soup|drink|cola|beer/i.test(`${meal.name || ""} ${(items || []).map(item => item.name).join(" ")}`)) needs.push("湯汁/飲料量");
            if (kcal >= 800) needs.push("是否分食");
            if (isAfter) needs.push("剩餘量");
            const missing = needs.length ? needs.slice(0, 3).join("、") : "暫無明顯缺口";
            const reliability = isLowTrust ? "需先確認" : (trust.level === "高" ? "可直接記錄" : "建議快看一眼");
            let action = "份量看起來合理，可以直接記錄；若有分食、醬料或飯後剩餘，再用份量鈕微調。";
            if (isLowTrust) action = "先補餐點名稱或熱量，必要時按重新辨識照片；塔塔會保留照片，不會讓這餐遺失。";
            else if (needs.includes("湯汁/飲料量")) action = "確認湯有沒有喝完、飲料是否含糖，這通常最影響熱量與鈉/糖。";
            else if (kcal >= 800) action = "這餐熱量偏高，若有分食或沒吃完，先把份量往下修再記錄。";
            else if (meal.phase === "before") action = "可以先存餐前照，吃完若剩很多再補飯後照，塔塔會校正實際吃下。";
            return {
                reliability,
                sourceLabel,
                missing,
                action,
                warn: isLowTrust || kcal >= 800,
                trustLevel: trust.level
            };
        }

        function renderEstimateCalibrationCard() {
            const card = document.getElementById('estimateCalibrationCard');
            if (!card) return;
            const hasEstimate = Number(selectedMealKcal || selectedMeal.calories || 0) > 0;
            if (!hasEstimate || selectedMeal.source === "photo_loading") {
                card.classList.remove('active', 'warn');
                card.innerHTML = "";
                return;
            }
            const coach = getEstimateCalibrationCoach(selectedMeal);
            card.classList.add('active');
            card.classList.toggle('warn', coach.warn);
            card.innerHTML = `
                <div class="estimate-calibration-top">
                    <div class="estimate-calibration-title">塔塔估算校正</div>
                    <div class="estimate-calibration-meta">${coach.reliability}</div>
                </div>
                <div class="estimate-calibration-grid">
                    <div class="estimate-calibration-cell"><strong>可信度</strong><span>${coach.trustLevel} · ${coach.sourceLabel}</span></div>
                    <div class="estimate-calibration-cell"><strong>最該確認</strong><span>${coach.missing}</span></div>
                    <div class="estimate-calibration-cell"><strong>現在動作</strong><span>${coach.warn ? "先校正" : "可記錄"}</span></div>
                </div>
                <div class="estimate-calibration-action">${coach.action}</div>
            `;
        }

        function getFoodRecognitionSummary(meal = selectedMeal) {
            const items = Array.isArray(meal.items) ? meal.items : [];
            const names = items.map(item => item.name).filter(Boolean);
            const portions = items.map(item => item.portion).filter(Boolean);
            const ingredientNames = names.length ? names : [meal.name || selectedMealName || "這餐"];
            const totalPortion = portions.length
                ? portions.slice(0, 3).join("、")
                : (Number(selectedPortion || 0) > 0 ? `約 ${Number(selectedPortion.toFixed(2))} 份` : "份量待確認");
            const mainFood = ingredientNames.slice(0, 2).join("、") || meal.name || "食物待確認";
            return {
                mainFood,
                portion: totalPortion,
                ingredients: ingredientNames.slice(0, 5).join("、") || "主要食材待確認",
                count: items.length,
                source: getEstimateSourceLabel(meal.source)
            };
        }

        function renderFoodRecognitionSummaryCard() {
            const card = document.getElementById('foodRecognitionSummaryCard');
            if (!card) return;
            const isLoading = selectedMeal.source === "photo_loading";
            const hasEstimate = Number(selectedMeal.calories || selectedMealKcal || 0) > 0;
            const hasRecognition = hasEstimate || (Array.isArray(selectedMeal.items) && selectedMeal.items.length);
            if (!hasRecognition || isLoading) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const summary = getFoodRecognitionSummary(selectedMeal);
            card.classList.add('active');
            card.innerHTML = `
                <div class="food-recognition-summary-top">
                    <div class="food-recognition-summary-title">AI 食物辨識摘要</div>
                    <div class="food-recognition-summary-meta">${summary.source}${summary.count ? ` · ${summary.count} 項` : ''}</div>
                </div>
                <div class="food-recognition-summary-grid">
                    <div class="food-recognition-summary-cell"><strong>食物名稱</strong><span>${summary.mainFood}</span></div>
                    <div class="food-recognition-summary-cell"><strong>份量</strong><span>${summary.portion}</span></div>
                    <div class="food-recognition-summary-cell"><strong>主要食材</strong><span>${summary.ingredients}</span></div>
                </div>
            `;
        }

        function renderEstimateMeta() {
            const meta = document.getElementById('estimateMeta');
            if (!meta) return;
            const confidenceMap = { high: "信心高", medium: "信心中", low: "需確認" };
            const sourceMap = {
                ai_photo: "AI 視覺",
                gemini: "AI 視覺",
                openai: "AI 視覺",
                gemini_text_assist: "文字輔助",
                openai_text_assist: "文字輔助",
                gemini_drink_guard: "飲料防呆",
                openai_drink_guard: "飲料防呆",
                gemini_drink_review: "飲料需確認",
                openai_drink_review: "飲料需確認",
                gemini_generic_guard: "本機保守估",
                openai_generic_guard: "本機保守估",
                local_text_fast: "文字快估",
                local_text: "文字估算",
                local_text_fallback: "文字估算",
                local_soup: "湯品規則",
                photo_pending: "本機保守估",
                manual_photo_fallback: "本機保守估",
                local_after_photo_fallback: "飯後保守估",
                local_no_ai: "本機保守估",
                local_ai_error: "本機保守估",
                local_ai_timeout: "本機保守估",
                local_invalid_ai: "本機保守估"
            };
            const phaseText = selectedMeal.phase === "after" ? "飯後照" : (selectedMeal.phase === "before" ? "飯前照" : "餐點");
            const pills = [
                { text: confidenceMap[selectedMeal.confidence] || "估算中", strong: selectedMeal.confidence !== "low" },
                { text: getEstimateSourceLabel(selectedMeal.source) },
                { text: selectedMeal.mealSlot || getMealSlot(new Date()) },
                { text: phaseText },
                selectedMeal.corrected ? { text: "已手動校正", strong: true } : null
            ].filter(Boolean);
            meta.innerHTML = pills.map(pill => `<span class="estimate-pill${pill.strong ? ' strong' : ''}">${pill.text}</span>`).join('');
        }

        function getEstimateMemoryKey(phase = photoCapturePhase) {
            return dailyKey(`lastEstimate:${phase === "after" ? "after" : "before"}`);
        }

        function rememberEstimateForStability(meal, phase = photoCapturePhase) {
            if (!currentUser || !meal) return;
            const payload = {
                at: Date.now(),
                phase: phase === "after" ? "after" : "before",
                calories: Math.max(0, Math.round(Number(meal.calories || 0))),
                name: meal.name || "",
                foods: (meal.items || []).map(item => item.name).filter(Boolean).slice(0, 4)
            };
            try { localStorage.setItem(getEstimateMemoryKey(phase), JSON.stringify(payload)); } catch (error) {}
        }

        function getEstimateStabilityWarning(meal, phase = photoCapturePhase) {
            if (!currentUser || !meal) return "";
            const kcal = Math.max(0, Math.round(Number(meal.calories || 0)));
            const normalizedPhase = phase === "after" ? "after" : "before";
            const pending = normalizedPhase === "after" ? resolveAfterPhotoTargetMeal() : null;
            const beforeKcal = Math.round(Number(pending?.beforeCalories || pending?.calories || 0));
            if (normalizedPhase === "after" && beforeKcal > 0 && kcal > beforeKcal * 0.9) {
                return `飯後照估到 ${kcal} kcal，接近餐前 ${beforeKcal} kcal。這可能是 AI 把剩餘量當完整餐，請確認剩多少、湯喝多少，再儲存。`;
            }
            const previous = safeJsonObject(localStorage.getItem(getEstimateMemoryKey(normalizedPhase)));
            if (!previous?.calories || !kcal) return "";
            const withinFreshWindow = Date.now() - Number(previous.at || 0) < 15 * 60 * 1000;
            if (!withinFreshWindow) return "";
            const smaller = Math.max(1, Math.min(previous.calories, kcal));
            const diff = Math.abs(previous.calories - kcal);
            if (diff >= Math.max(120, Math.round(smaller * 0.35))) {
                const foods = (meal.items || []).map(item => item.name).filter(Boolean).slice(0, 3).join("、") || meal.name || "這餐";
                return `同一時段前後估算差 ${diff} kcal。塔塔先標成不穩，AI 看到「${foods}」，建議補餐名、份量或直接校正熱量後再存。`;
            }
            return "";
        }

        function getQuickCorrectionOptions(meal = selectedMeal) {
            const text = [
                meal.name,
                meal.notes,
                meal.source,
                ...(meal.items || []).map(item => `${item.name || ""} ${item.portion || ""}`)
            ].join(" ");
            const options = [];
            const add = (label, foodName, primary = false) => options.push({ label, foodName, primary });
            if (/可樂|cola|coke|coca|汽水|啤酒|beer|檸檬|飲料|罐|drink/i.test(text)) {
                add("改成可樂", "可樂", true);
                add("零卡可樂", "零卡可樂");
                add("確定是啤酒", "啤酒");
            }
            if (/湯|汤|羹|soup|鍋/i.test(text)) {
                add("清湯", "清湯", true);
                add("泡菜湯", "韓式泡菜湯");
                add("濃湯", "玉米濃湯");
            }
            return options.slice(0, 4);
        }

        function applyQuickMealCorrection(foodName) {
            const estimate = estimateFoodByText(foodName);
            if (!estimate) return;
            selectedMeal = {
                ...selectedMeal,
                ...estimate,
                name: foodName,
                corrected: true,
                source: estimate.source || "local_text",
                confidence: "medium",
                notes: `已依你確認的「${foodName}」重新估算。`
            };
            selectedPortion = 1;
            applySelectedMealToUI();
            const nameInput = document.getElementById('manualFoodName');
            const caloriesInput = document.getElementById('manualCalories');
            if (nameInput) nameInput.value = foodName;
            if (caloriesInput) caloriesInput.value = estimate.calories;
            autoSaveSelectedMealDraft("auto_corrected");
            showToast(`已改成 ${foodName}，約 ${estimate.calories} kcal`);
        }

        function renderFoodItems() {
            const list = document.getElementById('foodItemsList');
            if (!list) return;
            const seenFoods = selectedMeal.items.map(item => item.name).filter(Boolean).slice(0, 5).join('、');
            const seenRow = seenFoods
                ? `<div class="food-item-row"><span><strong>AI 看到的食物</strong><br><span style="color:var(--color-muted);">${seenFoods}</span></span><span>辨識</span></div>`
                : "";
            const correctionOptions = getQuickCorrectionOptions(selectedMeal);
            const correctionRow = correctionOptions.length
                ? `<div class="quick-correction-row">${correctionOptions.map(option => `<button class="quick-correction-btn${option.primary ? ' primary' : ''}" type="button" onclick="applyQuickMealCorrection('${option.foodName}')">${option.label}</button>`).join('')}</div>`
                : "";
            list.innerHTML = seenRow + selectedMeal.items.map(item => {
                const itemCalories = Math.round(item.calories * selectedPortion);
                return `<div class="food-item-row"><span><strong>${item.name}</strong><br><span style="color:var(--color-muted);">${item.portion}</span></span><span>${itemCalories} kcal</span></div>`;
            }).join('') + correctionRow;
        }

        function renderConfidenceNote() {
            const note = document.getElementById('confidenceNote');
            const messages = [];
            if (selectedMeal.warning) messages.push(`⚠️ ${selectedMeal.warning}`);
            if (selectedMeal.confidence === 'low') messages.push('估算不太確定，建議手動調整。');
            if (selectedMeal.notes) messages.push(selectedMeal.notes);
            note.innerText = messages.map(getFriendlyAiError).join(' ');
            note.style.display = messages.length ? 'block' : 'none';
        }

        function previewTypedFoodEstimate() {
            const nameInput = document.getElementById('manualFoodName');
            const caloriesInput = document.getElementById('manualCalories');
            const typedName = nameInput.value.trim();
            if (!typedName) return;
            const shouldAutoFill = !caloriesInput.value || Number(caloriesInput.value) <= 0 || ['photo_pending', 'local_soup', 'local_text', 'local_text_unknown'].includes(selectedMeal.source);
            if (!shouldAutoFill) return;
            const estimate = estimateFoodByText(typedName);
            if (!estimate) return;
            selectedMeal = { ...selectedMeal, ...estimate, name: typedName, corrected: true };
            selectedPortion = 1;
            applySelectedMealToUI();
            nameInput.value = typedName;
            caloriesInput.value = estimate.calories;
        }

        function applyMealCorrection() {
            const name = document.getElementById('manualFoodName').value.trim();
            const calories = parseInt(document.getElementById('manualCalories').value || '', 10);
            if (name) {
                const estimate = estimateFoodByText(name);
                if (estimate) {
                    selectedMeal = {
                        ...selectedMeal,
                        ...estimate,
                        name,
                        corrected: true,
                        source: estimate.source || "local_text",
                        notes: `已依你輸入的「${name}」重新估算。`
                    };
                    selectedPortion = 1;
                    applySelectedMealToUI();
                    document.getElementById('manualFoodName').value = name;
                    document.getElementById('manualCalories').value = estimate.calories;
                    autoSaveSelectedMealDraft("auto_corrected");
                    showToast(`已用餐名重估：${name} 約 ${estimate.calories} kcal`);
                    return;
                }
            }
            if (name && (Number.isNaN(calories) || calories <= 0)) {
                const estimate = estimateFoodByText(name);
                if (estimate) {
                    selectedMeal = { ...selectedMeal, ...estimate, name, corrected: true };
                    selectedPortion = 1;
                    applySelectedMealToUI();
                    document.getElementById('manualFoodName').value = name;
                    document.getElementById('manualCalories').value = estimate.calories;
                    autoSaveSelectedMealDraft("auto_corrected");
                    showToast(`已估算：${name} 約 ${estimate.calories} kcal`);
                    return;
                }
            }
            if (name) selectedMeal.name = name;
            if (!Number.isNaN(calories) && calories >= 0) {
                const ratio = selectedMeal.calories > 0 ? calories / selectedMeal.calories : 1;
                selectedMeal.calories = calories;
                selectedMeal.protein = Math.max(0, Math.round(selectedMeal.protein * ratio));
                selectedMeal.carbs = Math.max(0, Math.round(selectedMeal.carbs * ratio));
                selectedMeal.fat = Math.max(0, Math.round(selectedMeal.fat * ratio));
                selectedMeal.fiber = Math.max(0, Math.round((selectedMeal.fiber || 0) * ratio));
                selectedMeal.sugar = Math.max(0, Math.round((selectedMeal.sugar || 0) * ratio));
                selectedMeal.sodium = Math.max(0, Math.round((selectedMeal.sodium || 0) * ratio));
                selectedMeal.items = [{ name: selectedMeal.name, portion: '手動修正', calories, protein: selectedMeal.protein, carbs: selectedMeal.carbs, fat: selectedMeal.fat, fiber: selectedMeal.fiber, sugar: selectedMeal.sugar, sodium: selectedMeal.sodium }];
            }
            selectedMeal.corrected = true;
            selectedPortion = 1;
            applySelectedMealToUI();
            autoSaveSelectedMealDraft("auto_corrected");
            showToast('已套用修正，請確認後記錄這餐。');
        }

        function getMealPlaceMemory() {
            const placeName = document.getElementById('mealPlaceName')?.value.trim() || "";
            const placeAddress = document.getElementById('mealPlaceAddress')?.value.trim() || "";
            const placeNote = document.getElementById('mealPlaceNote')?.value.trim() || "";
            const placeRating = Number(document.getElementById('mealPlaceRating')?.value || 0);
            const locationSnapshot = selectedMeal.locationSnapshot || activeMealLocationSnapshot || null;
            const locationLabel = formatMealLocationSnapshot(locationSnapshot);
            const finalAddress = placeAddress || locationLabel;
            return {
                placeName,
                restaurantName: placeName,
                placeAddress: finalAddress,
                locationName: finalAddress,
                locationSnapshot,
                locationLatitude: locationSnapshot?.latitude || null,
                locationLongitude: locationSnapshot?.longitude || null,
                locationAccuracy: locationSnapshot?.accuracy || null,
                locationCapturedAt: locationSnapshot?.capturedAt || "",
                locationSource: locationSnapshot?.source || "",
                placeRating: Number.isFinite(placeRating) ? Math.max(0, Math.min(5, Math.round(placeRating))) : 0,
                placeNote,
                restaurantNote: placeNote
            };
        }

        function clearMealPlaceMemoryInputs() {
            ['mealPlaceName', 'mealPlaceAddress', 'mealPlaceNote'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
            const rating = document.getElementById('mealPlaceRating');
            if (rating) rating.value = "";
        }

        function saveMeal(meal) {
            const now = new Date();
            const savedMeal = {
                id: 'meal_' + Date.now(),
                time: now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                name: meal.name,
                calories: Math.max(0, Math.round(Number(meal.calories || 0))),
                protein: Math.max(0, Math.round(Number(meal.protein || 0))),
                carbs: Math.max(0, Math.round(Number(meal.carbs || 0))),
                fat: Math.max(0, Math.round(Number(meal.fat || 0))),
                fiber: Math.max(0, Math.round(Number(meal.fiber || estimateFiberFromMeal(meal) || 0))),
                sugar: Math.max(0, Math.round(Number(meal.sugar || 0))),
                sodium: Math.max(0, Math.round(Number(meal.sodium || 0))),
                healthFlags: Array.isArray(meal.healthFlags) ? meal.healthFlags : (Array.isArray(meal.health_flags) ? meal.health_flags : []),
                mealQuality: meal.mealQuality || meal.meal_quality || "unknown",
                photo: meal.photo || "",
                photoBefore: meal.photoBefore || "",
                photoAfter: meal.photoAfter || "",
                beforeCalories: Math.max(0, Math.round(Number(meal.beforeCalories || 0))),
                afterCalories: Math.max(0, Math.round(Number(meal.afterCalories || 0))),
                consumedCalories: Math.max(0, Math.round(Number(meal.consumedCalories || meal.calories || 0))),
                consumedRatio: Number(meal.consumedRatio || 0),
                remainingRatio: Number(meal.remainingRatio || 0),
                comparisonNote: meal.comparisonNote || "",
                comparisonReliable: meal.comparisonReliable !== false,
                mealSlot: meal.mealSlot || getMealSlot(now),
                placeName: meal.placeName || meal.restaurantName || "",
                restaurantName: meal.restaurantName || meal.placeName || "",
                placeAddress: meal.placeAddress || meal.locationName || "",
                locationName: meal.locationName || meal.placeAddress || "",
                locationSnapshot: meal.locationSnapshot || null,
                locationLatitude: Number.isFinite(Number(meal.locationLatitude)) ? Number(meal.locationLatitude) : (meal.locationSnapshot?.latitude || null),
                locationLongitude: Number.isFinite(Number(meal.locationLongitude)) ? Number(meal.locationLongitude) : (meal.locationSnapshot?.longitude || null),
                locationAccuracy: Number.isFinite(Number(meal.locationAccuracy)) ? Number(meal.locationAccuracy) : (meal.locationSnapshot?.accuracy || null),
                locationCapturedAt: meal.locationCapturedAt || meal.locationSnapshot?.capturedAt || "",
                locationSource: meal.locationSource || meal.locationSnapshot?.source || "",
                placeRating: Math.max(0, Math.min(5, Math.round(Number(meal.placeRating || 0)))),
                placeNote: meal.placeNote || meal.restaurantNote || "",
                restaurantNote: meal.restaurantNote || meal.placeNote || "",
                nextAdvice: meal.nextAdvice || "",
                mealPlan: meal.mealPlan || null,
                aiResult: meal.aiResult || null,
                corrected: Boolean(meal.corrected),
                finalCalories: Math.max(0, Math.round(Number(meal.calories || 0))),
                finalName: meal.name,
                items: Array.isArray(meal.items) ? meal.items : [],
                source: meal.source || "manual",
                createdAt: now.toISOString()
            };
            const meals = safeJsonArray(localStorage.getItem(dailyKey('meals')));
            meals.push(savedMeal);
            localStorage.setItem(dailyKey('meals'), JSON.stringify(meals));
            upsertMealHistory(savedMeal, todayKeyDate());
            syncRemoteMealsForDate(todayKeyDate());
            return savedMeal;
        }

        function updateSavedMeal(mealId, patch) {
            if (!currentUser || !mealId) return null;
            const meals = safeJsonArray(localStorage.getItem(dailyKey('meals')));
            const index = meals.findIndex(meal => meal.id === mealId);
            if (index < 0) return null;
            const now = new Date();
            const updated = {
                ...meals[index],
                ...patch,
                id: mealId,
                time: meals[index].time,
                updatedAt: now.toISOString(),
                calories: Math.max(0, Math.round(Number(patch.calories ?? meals[index].calories ?? 0))),
                protein: Math.max(0, Math.round(Number(patch.protein ?? meals[index].protein ?? 0))),
                carbs: Math.max(0, Math.round(Number(patch.carbs ?? meals[index].carbs ?? 0))),
                fat: Math.max(0, Math.round(Number(patch.fat ?? meals[index].fat ?? 0))),
                fiber: Math.max(0, Math.round(Number(patch.fiber ?? meals[index].fiber ?? estimateFiberFromMeal(patch) ?? 0))),
                sugar: Math.max(0, Math.round(Number(patch.sugar ?? meals[index].sugar ?? 0))),
                sodium: Math.max(0, Math.round(Number(patch.sodium ?? meals[index].sodium ?? 0))),
                healthFlags: Array.isArray(patch.healthFlags) ? patch.healthFlags : (meals[index].healthFlags || []),
                mealQuality: patch.mealQuality || meals[index].mealQuality || "unknown",
                mealPlan: patch.mealPlan || meals[index].mealPlan || null,
                finalCalories: Math.max(0, Math.round(Number(patch.calories ?? meals[index].calories ?? 0))),
                source: patch.source || "ai_before_after",
                consumedCalories: Math.max(0, Math.round(Number(patch.consumedCalories ?? patch.calories ?? meals[index].calories ?? 0))),
                consumedRatio: Number(patch.consumedRatio ?? meals[index].consumedRatio ?? 0),
                remainingRatio: Number(patch.remainingRatio ?? meals[index].remainingRatio ?? 0),
                comparisonNote: patch.comparisonNote || meals[index].comparisonNote || "",
                comparisonReliable: patch.comparisonReliable !== false,
                placeName: patch.placeName || meals[index].placeName || meals[index].restaurantName || "",
                restaurantName: patch.restaurantName || patch.placeName || meals[index].restaurantName || meals[index].placeName || "",
                placeAddress: patch.placeAddress || meals[index].placeAddress || meals[index].locationName || "",
                locationName: patch.locationName || patch.placeAddress || meals[index].locationName || meals[index].placeAddress || "",
                locationSnapshot: patch.locationSnapshot || meals[index].locationSnapshot || null,
                locationLatitude: Number.isFinite(Number(patch.locationLatitude)) ? Number(patch.locationLatitude) : (meals[index].locationLatitude || patch.locationSnapshot?.latitude || null),
                locationLongitude: Number.isFinite(Number(patch.locationLongitude)) ? Number(patch.locationLongitude) : (meals[index].locationLongitude || patch.locationSnapshot?.longitude || null),
                locationAccuracy: Number.isFinite(Number(patch.locationAccuracy)) ? Number(patch.locationAccuracy) : (meals[index].locationAccuracy || patch.locationSnapshot?.accuracy || null),
                locationCapturedAt: patch.locationCapturedAt || meals[index].locationCapturedAt || patch.locationSnapshot?.capturedAt || "",
                locationSource: patch.locationSource || meals[index].locationSource || patch.locationSnapshot?.source || "",
                placeRating: Math.max(0, Math.min(5, Math.round(Number(patch.placeRating ?? meals[index].placeRating ?? 0)))),
                placeNote: patch.placeNote || meals[index].placeNote || meals[index].restaurantNote || "",
                restaurantNote: patch.restaurantNote || patch.placeNote || meals[index].restaurantNote || meals[index].placeNote || "",
                corrected: true
            };
            meals[index] = updated;
            localStorage.setItem(dailyKey('meals'), JSON.stringify(meals));
            upsertMealHistory(updated, todayKeyDate());
            syncRemoteMealsForDate(todayKeyDate());
            return updated;
        }

        function toDietRecord(meal) {
            return {
                id: meal.id || "",
                name: meal.name,
                kcal: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fat: meal.fat,
                fiber: meal.fiber,
                sugar: meal.sugar,
                sodium: meal.sodium,
                healthFlags: meal.healthFlags || [],
                mealQuality: meal.mealQuality || "unknown",
                photo: meal.photo,
                photoBefore: meal.photoBefore,
                photoAfter: meal.photoAfter,
                beforeCalories: meal.beforeCalories,
                afterCalories: meal.afterCalories,
                consumedCalories: meal.consumedCalories,
                consumedRatio: meal.consumedRatio,
                remainingRatio: meal.remainingRatio,
                comparisonNote: meal.comparisonNote,
                comparisonReliable: meal.comparisonReliable,
                mealSlot: meal.mealSlot,
                placeName: meal.placeName || meal.restaurantName || "",
                restaurantName: meal.restaurantName || meal.placeName || "",
                placeAddress: meal.placeAddress || meal.locationName || "",
                locationName: meal.locationName || meal.placeAddress || "",
                locationSnapshot: meal.locationSnapshot || null,
                locationLatitude: meal.locationLatitude || meal.locationSnapshot?.latitude || null,
                locationLongitude: meal.locationLongitude || meal.locationSnapshot?.longitude || null,
                locationAccuracy: meal.locationAccuracy || meal.locationSnapshot?.accuracy || null,
                locationCapturedAt: meal.locationCapturedAt || meal.locationSnapshot?.capturedAt || "",
                locationSource: meal.locationSource || meal.locationSnapshot?.source || "",
                placeRating: Number(meal.placeRating || 0),
                placeNote: meal.placeNote || meal.restaurantNote || "",
                restaurantNote: meal.restaurantNote || meal.placeNote || "",
                nextAdvice: meal.nextAdvice,
                source: meal.source,
                time: meal.time,
                items: meal.items || [],
                corrected: meal.corrected,
                aiResult: meal.aiResult || null
            };
        }

        function previewManualSteps() {
            updateStepDisplay(userData.currentSteps);
        }

        function saveManualSteps() {
            document.getElementById('stepCounterStatus').innerText = "Web 版會在 APP 開著時自動估步並保存到今天；完整背景同步要等原生健康資料串接。";
        }

        function selectPresetSteps(btn, steps) {
            document.getElementById('stepCounterStatus').innerText = "不需要手動選步數；APP 開著時會自動估步，背景鎖屏完整同步會在原生版處理。";
        }

        function adjustSteps(amount) {
            document.getElementById('stepCounterStatus').innerText = "不需要手動調整；目前 Web 版以開著 APP 自動估步為主。";
        }

        function saveSteps(steps) {
            if (!currentUser) return;
            localStorage.setItem(dailyKey('steps'), String(Math.max(0, Math.round(Number(steps || 0)))));
            updateStepDisplay(steps);
            scheduleStepStateSync();
        }

        function scheduleStepStateSync() {
            if (motionStepSyncTimer) return;
            motionStepSyncTimer = setTimeout(() => {
                motionStepSyncTimer = null;
                syncRemoteDailyState(todayKeyDate());
            }, 5000);
        }

        function updateStepDisplay(steps) {
            const safeSteps = Math.max(0, Math.round(Number(steps || 0)));
            const goal = 8000;
            const burn = Math.round(safeSteps * 0.04);
            const stepCount = document.getElementById('stepCount');
            const stepBar = document.getElementById('stepBar');
            const stepCalBurn = document.getElementById('stepCalBurn');
            const cardSteps = document.getElementById('cardSteps');
            if (stepCount) stepCount.innerText = safeSteps.toLocaleString();
            if (stepBar) stepBar.style.width = `${Math.min(100, (safeSteps / goal) * 100)}%`;
            if (stepCalBurn) stepCalBurn.innerText = `${burn} kcal`;
            if (cardSteps) cardSteps.innerHTML = `${safeSteps.toLocaleString()}<span>步</span>`;
        }

        let motionStepActive = false;
        let motionStepLastPeakAt = 0;
        let motionStepBaseline = 0;
        let motionPermissionPromptAttached = false;
        let motionStepLastPersistAt = 0;
        let motionStepSyncTimer = null;
        let automaticStepRetryBound = false;
        function motionStepPreferenceKey() {
            return currentUser ? `paipachi:${currentUser}:autoStepEnabled` : "paipachi:autoStepEnabled";
        }

        function setStepCounterStatus(message, mode = "waiting") {
            const statusEl = document.getElementById('stepCounterStatus');
            const pillEl = document.getElementById('stepAutoModePill');
            if (statusEl) statusEl.innerText = message;
            if (pillEl) {
                pillEl.classList.remove('waiting', 'offline');
                if (mode === "waiting") pillEl.classList.add('waiting');
                if (mode === "offline") pillEl.classList.add('offline');
                pillEl.innerText = mode === "active" ? "自動記錄中" : (mode === "offline" ? "沿用已保存" : "自動估步");
            }
        }

        function startAutomaticStepCounter() {
            bindAutomaticStepRetryEvents();
            if (motionStepActive) return;
            if (!('DeviceMotionEvent' in window)) {
                setStepCounterStatus('這個瀏覽器沒有提供動作感測；塔塔會先沿用今天已保存的步數，餐後散步仍可手動由手機健康 App 對照。', 'offline');
                return;
            }
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                setStepCounterStatus('自動估步待手機授權：你照常使用 App，第一次觸控後若系統跳出動作感測權限，允許後會在 APP 開著時記到今天。', 'waiting');
                attachMotionPermissionGesture();
                return;
            }
            activateMotionStepCounter();
        }

        function bindAutomaticStepRetryEvents() {
            if (automaticStepRetryBound) return;
            automaticStepRetryBound = true;
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && currentUser && !motionStepActive) startAutomaticStepCounter();
            });
            window.addEventListener('pageshow', () => {
                if (currentUser && !motionStepActive) startAutomaticStepCounter();
            });
        }

        function attachMotionPermissionGesture() {
            if (motionPermissionPromptAttached || motionStepActive) return;
            motionPermissionPromptAttached = true;
            const handler = () => {
                document.removeEventListener('pointerdown', handler);
                document.removeEventListener('touchend', handler);
                motionPermissionPromptAttached = false;
                requestMotionStepPermission();
            };
            document.addEventListener('pointerdown', handler, { once: true });
            document.addEventListener('touchend', handler, { once: true });
        }

        function requestMotionStepPermission() {
            if (motionStepActive) return;
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                DeviceMotionEvent.requestPermission().then(state => {
                    if (state === 'granted') activateMotionStepCounter();
                    else setStepCounterStatus('手機系統沒有開放動作感測；塔塔會先保留今天已記錄的步數，不影響餐點與體重紀錄。', 'offline');
                }).catch(() => { setStepCounterStatus('目前瀏覽器暫時無法讀取動作偵測；今天步數會先維持已保存的紀錄，不需要額外開關。', 'offline'); });
            } else if ('DeviceMotionEvent' in window) {
                activateMotionStepCounter();
            } else {
                setStepCounterStatus('目前瀏覽器沒有提供動作感測資料；今天步數會先維持已保存的紀錄，不影響熱量與照片紀錄。', 'offline');
            }
        }

        function activateMotionStepCounter() {
            motionStepActive = true;
            motionStepBaseline = 0;
            motionStepLastPeakAt = 0;
            window.removeEventListener('devicemotion', handleMotionStep);
            window.addEventListener('devicemotion', handleMotionStep);
            localStorage.setItem(motionStepPreferenceKey(), 'true');
            setStepCounterStatus('自動記錄中：手機放身上、APP 保持開啟時，塔塔會把步數保存到今天。', 'active');
        }

        function handleMotionStep(event) {
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;
            const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
            motionStepBaseline = motionStepBaseline ? (motionStepBaseline * 0.92 + magnitude * 0.08) : magnitude;
            const delta = magnitude - motionStepBaseline;
            const now = Date.now();
            if (delta > 1.35 && now - motionStepLastPeakAt > 360) {
                motionStepLastPeakAt = now;
                userData.currentSteps += 1;
                saveSteps(userData.currentSteps);
                if (now - motionStepLastPersistAt > 2500) {
                    motionStepLastPersistAt = now;
                    updateOtterGrowth();
                    saveToStorage();
                    updateUI(false);
                    setStepCounterStatus(`自動估步中：已保存 ${userData.currentSteps.toLocaleString()} 步，今日約消耗 ${Math.round(userData.currentSteps * 0.04)} kcal。`, 'active');
                }
            }
        }
        function triggerUndoableReset() {
            undoSnapshot = JSON.stringify({ userData, meals: localStorage.getItem(dailyKey('meals')), mealHistory: localStorage.getItem(mealHistoryKey()) });
            userData.consumedCalories = 0; userData.totalProtein = 0; userData.totalFiber = 0; userData.dietRecords = [];
            pendingBeforeMeal = null;
            localStorage.setItem(dailyKey('meals'), '[]');
            replaceMealHistoryForDate(todayKeyDate(), []);
            localStorage.removeItem(dailyKey('pendingBeforeMeal'));
            localStorage.removeItem(dailyKey('courseSession'));
            syncRemoteMealsForDate(todayKeyDate());
            document.getElementById('exerciseAlert').style.display = "none";
            const stepStatus = document.getElementById('stepCounterStatus');
            if (stepStatus) stepStatus.innerText = "今日餐點已清空；步數與體重不受影響。可在 3 秒內撤銷。";
            updateOtterGrowth();
            updateUI(false);
            syncRemoteDailyState(todayKeyDate());
            document.getElementById('undoBtn').style.display = "block";
            tomaBubble.innerText = "餐點先幫你收掉了，步數和體重我有保留。";
            undoTimeoutTimer = setTimeout(() => { document.getElementById('undoBtn').style.display = "none"; undoSnapshot = null; saveToStorage(); }, 3000);
        }

        function executeUndoAction() {
            if (undoSnapshot) {
                clearTimeout(undoTimeoutTimer);
                const snapshot = JSON.parse(undoSnapshot);
                userData = snapshot.userData || snapshot;
                if (snapshot.meals !== undefined) localStorage.setItem(dailyKey('meals'), snapshot.meals || '[]');
                if (snapshot.mealHistory !== undefined) localStorage.setItem(mealHistoryKey(), snapshot.mealHistory || '[]');
                syncRemoteMealsForDate(todayKeyDate());
                undoSnapshot = null;
                document.getElementById('undoBtn').style.display = "none";
                const stepStatus = document.getElementById('stepCounterStatus');
                if (stepStatus) stepStatus.innerText = "已還原清空前的步數與餐點紀錄。";
                updateOtterGrowth();
                updateUI(false);
                syncRemoteDailyState(todayKeyDate());
                tomaBubble.innerText = "已成功還原數據，剛剛差點就破壞水流了呢。";
            }
        }

        function triggerTomaPoke() {
            const aquariumEl = document.getElementById('tomaAquarium');
            aquariumEl.classList.add('wobble-pop'); setTimeout(() => { aquariumEl.classList.remove('wobble-pop'); }, 450);
            const randomQuote = pokeQuotes[Math.floor(Math.random() * pokeQuotes.length)];
            tomaBubble.innerText = randomQuote;
        }

        function handleLoginEnter(event) {
            if (event.key === "Enter") executeSecureLogin();
        }

        document.getElementById('loginUsername').addEventListener('keydown', handleLoginEnter);

        function calculateDailyScore(username) {
            const today = todayKeyDate();
            let score = 0;
            const meals = safeJsonArray(localStorage.getItem(`paipachi:${username}:meals:${today}`));
            if (meals.length >= 2) score += 25;
            else if (meals.length === 1) score += 12;

            const totalCal = meals.reduce((sum, meal) => sum + Number(meal.calories || meal.kcal || 0), 0);
            const target = Number(localStorage.getItem(`paipachi:${username}:calorieTarget`) || userData.targetCalories || 1800);
            if (totalCal >= target * 0.8 && totalCal <= target * 1.2) score += 20;
            else if (totalCal > target * 1.2) score -= 12;

            const totalProtein = meals.reduce((sum, meal) => sum + Number(meal.protein || 0), 0);
            const totalFiber = meals.reduce((sum, meal) => sum + Number(meal.fiber || estimateFiberFromMeal(meal) || 0), 0);
            const totalSugar = meals.reduce((sum, meal) => sum + Number(meal.sugar || 0), 0);
            const totalSodium = meals.reduce((sum, meal) => sum + Number(meal.sodium || 0), 0);
            const todayFlags = new Set(meals.flatMap(meal => meal.healthFlags || []));
            const proteinTarget = getDailyNutritionTargets().protein;
            const nutritionTargets = getDailyNutritionTargets();
            if (totalProtein >= proteinTarget * 0.8) score += 10;
            if (totalFiber >= DAILY_GUIDELINES.fiberG * 0.7) score += 8;
            if (totalSugar > nutritionTargets.sugar) score -= 10;
            if (totalSodium > nutritionTargets.sodium) score -= 8;
            if (todayFlags.has('fried_or_high_fat')) score -= 6;
            if (todayFlags.has('fiber_source') && totalProtein >= proteinTarget * 0.5) score += 5;

            const water = parseInt(localStorage.getItem(`paipachi:${username}:water:${today}`) || '0', 10) || 0;
            if (water >= 1500) score += 7;

            const steps = parseInt(localStorage.getItem(`paipachi:${username}:steps:${today}`) || '0', 10);
            if (steps >= 8000) score += 20;
            else if (steps >= 5000) score += 10;

            if (localStorage.getItem(`paipachi:${username}:weight:${today}`)) score += 10;

            const streak = getStreak(username);
            if (streak >= 3) score += 10;
            else if (streak >= 1) score += 5;

            return Math.max(0, Math.min(100, score));
        }

        function getDailyMissions(status = getNutritionStatus()) {
            const meals = userData.dietRecords || [];
            const proteinRatio = status.targets.protein ? status.proteinNow / status.targets.protein : 0;
            const fiberRatio = status.targets.fiber ? status.fiberNow / status.targets.fiber : 0;
            return [
                { done: meals.length >= 1, label: "開飯前拍下第一餐", reward: "+12" },
                { done: meals.length >= 2, label: "今天至少留下兩筆餐點", reward: "+25" },
                { done: proteinRatio >= 0.8, label: `蛋白質補到 80%（${status.proteinNow}/${status.targets.protein}g）`, reward: "+10" },
                { done: fiberRatio >= 0.7, label: `纖維補到 70%（${status.fiberNow}/${status.targets.fiber}g）`, reward: "+8" },
                { done: (userData.waterMl || 0) >= 1500, label: `喝水達 1500ml（${userData.waterMl || 0}ml）`, reward: "+7" },
                { done: (userData.currentSteps || 0) >= 5000, label: `走到 5000 步（${(userData.currentSteps || 0).toLocaleString()}步）`, reward: "+10" }
            ];
        }

        function renderDailyMissions(status) {
            const list = document.getElementById('dailyMissionList');
            const scoreEl = document.getElementById('missionScore');
            const hintEl = document.getElementById('missionHint');
            if (!list || !scoreEl) return;
            const missions = getDailyMissions(status);
            const doneCount = missions.filter(item => item.done).length;
            scoreEl.innerText = `${doneCount} / ${missions.length}`;
            if (hintEl) {
                hintEl.innerText = doneCount >= 4
                    ? "今天節奏很漂亮，塔塔正在發光。"
                    : "先完成一餐照片，再補水和蛋白質，塔塔會慢慢變亮。";
            }
            list.innerHTML = missions.map(item => `
                <div class="mission-item ${item.done ? 'done' : ''}">
                    <span class="mission-dot" aria-hidden="true"></span>
                    <span>${item.label}</span>
                    <span class="mission-reward">${item.reward}</span>
                </div>
            `).join('');
        }

        function getTodayReturnMission(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0) + (meal.photoAfter ? 1 : 0), 0);
            const waitingAfter = meals.some(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            const placeCount = meals.filter(meal => meal.placeName || meal.restaurantName || meal.placeAddress || meal.locationName).length;
            const missions = getDailyMissions(status);
            const doneCount = missions.filter(item => item.done).length;
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            let next = {
                title: "先拍今天第一餐",
                body: "只要先留下飯前照，塔塔就能幫你記照片、估熱量，並把下一餐接起來。",
                primaryLabel: "拍第一餐",
                primaryAction: "openPhotoPicker('before')",
                secondaryLabel: "不知道吃什麼",
                secondaryAction: "askTataCoach('等等吃什麼')"
            };
            if (meals.length && waitingAfter) {
                next = {
                    title: "補飯後照，讓這餐更準",
                    body: "今天已有餐前照，吃完補一張飯後照，塔塔會把剩量扣回來，這是準度最有感的一步。",
                    primaryLabel: "補飯後照",
                    primaryAction: "startLatestAfterPhoto(event)",
                    secondaryLabel: "看今日回憶",
                    secondaryAction: "switchTabById('tab-diet')"
                };
            } else if (status.waterGap >= 700) {
                next = {
                    title: "先補水，等等再吃",
                    body: `今天水還差 ${status.waterGap}ml。先補 250ml，塔塔的狀態和下一餐判斷都會穩一點。`,
                    primaryLabel: "+250ml",
                    primaryAction: "addWater(250)",
                    secondaryLabel: "問下一餐",
                    secondaryAction: "askTataCoach('等等吃什麼')"
                };
            } else if (status.proteinGap >= 18 || status.fiberGap >= 8 || status.sodiumOver > 0 || status.sugarOver > 0 || status.caloriesOver > 0) {
                next = {
                    title: `下一餐主軸：${advice.focus}`,
                    body: `${advice.priority?.reason || "今天節奏還穩"}。塔塔建議 ${advice.slot} ${advice.time} 抓 ${advice.suggestedKcal} kcal，開飯前仍用照片校正份量。`,
                    primaryLabel: "排下一餐",
                    primaryAction: "startPostMealRecommendedPlan()",
                    secondaryLabel: "塔塔三選一",
                    secondaryAction: "askTataCoach('塔塔幫我選')"
                };
            } else if (meals.length >= 2) {
                next = {
                    title: "今天節奏很漂亮",
                    body: "今天已經留下足夠回憶。可以看相簿回顧，或先約好明天第一餐，讓明天不用重新啟動。",
                    primaryLabel: "約明天第一餐",
                    primaryAction: "setTomorrowFirstMealPromise()",
                    secondaryLabel: "看今日回憶",
                    secondaryAction: "switchTabById('tab-diet')"
                };
            } else if (meals.length === 1) {
                next = {
                    title: "再留一餐，今天就成形",
                    body: "今天已經有第一餐。再拍下一餐，塔塔就能比較完整地控制熱量、蛋白質和纖維。",
                    primaryLabel: "拍下一餐",
                    primaryAction: "openPhotoPicker('before')",
                    secondaryLabel: "排下一餐",
                    secondaryAction: "startPostMealRecommendedPlan()"
                };
            }
            return {
                meals,
                photoCount,
                placeCount,
                doneCount,
                totalMissions: missions.length,
                streak: growth?.streak || userData.streakDays || 0,
                next
            };
        }

        function getTodayOpenValueItems(mission, status = getNutritionStatus()) {
            const meals = Array.isArray(mission?.meals) ? mission.meals : [];
            const photoCount = Number(mission?.photoCount || 0);
            const placeCount = Number(mission?.placeCount || 0);
            const total = meals.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0);
            const calorieText = meals.length
                ? `${Math.round(total)} kcal 已進今日控卡`
                : `先建立 ${Math.max(0, Math.round(status.caloriesLeft || userData.targetCalories || 0))} kcal 起點`;
            return [
                {
                    title: "照片回憶",
                    body: photoCount ? `${photoCount} 張照片會留在今天相簿，以後能回看自己吃過什麼。` : "第一張飯前照會自動留下餐別、照片和時間。"
                },
                {
                    title: "目標控卡",
                    body: `${calorieText}，下一餐會依蛋白質、纖維、水分、糖與鈉調整。`
                },
                {
                    title: "塔塔成長",
                    body: meals.length ? "吃得越穩，塔塔越漂亮；太甜太鹹太重也會反映在狀態。" : "今天先餵塔塔第一餐，成長故事才會開始累積。"
                },
                {
                    title: "店家記憶",
                    body: placeCount ? `${placeCount} 餐已有店家線索，下次可以回訪、開地圖或照這餐再吃。` : "順手補店名/評分，第二階段就能變成你的個人美食地圖。"
                }
            ];
        }

        function renderTodayReturnMissionCard(status, growth) {
            const card = document.getElementById('todayReturnMissionCard');
            if (!card) return;
            const mission = getTodayReturnMission(status, growth);
            const waterDone = (userData.waterMl || 0) >= 1500;
            const stepsDone = (userData.currentSteps || 0) >= 5000;
            const openValueItems = getTodayOpenValueItems(mission, status);
            card.classList.add('active');
            card.innerHTML = `
                <div class="today-return-top">
                    <div>
                        <div class="today-return-kicker">今天回來做什麼</div>
                        <div class="today-return-title">${mission.next.title}</div>
                    </div>
                    <div class="today-return-streak"><strong>${mission.streak || 0}</strong><span>連續天數</span></div>
                </div>
                <div class="today-return-body">${mission.next.body}</div>
                <div class="today-return-progress">
                    <div class="today-return-chip${mission.meals.length ? ' done' : ''}"><strong>${mission.meals.length}</strong><span>餐點</span></div>
                    <div class="today-return-chip${mission.photoCount ? ' done' : ''}"><strong>${mission.photoCount}</strong><span>照片</span></div>
                    <div class="today-return-chip${waterDone ? ' done' : ''}"><strong>${Math.round(userData.waterMl || 0)}</strong><span>喝水 ml</span></div>
                    <div class="today-return-chip${stepsDone ? ' done' : ''}"><strong>${Math.round(userData.currentSteps || 0).toLocaleString()}</strong><span>步數</span></div>
                </div>
                <div class="today-return-value-grid" aria-label="今天打開 拍拍吃 會得到什麼">
                    ${openValueItems.map(item => `<div class="today-return-value"><strong>${item.title}</strong><span>${item.body}</span></div>`).join('')}
                </div>
                <div class="today-return-next"><strong>塔塔今日任務 ${mission.doneCount}/${mission.totalMissions}</strong><span>完成越多，塔塔外觀越漂亮；吃太重也會直接反映在狀態裡。下一步只做一件事就好。</span></div>
                <div class="today-return-actions">
                    <button class="today-return-action primary" type="button" onclick="${mission.next.primaryAction}">${mission.next.primaryLabel}</button>
                    <button class="today-return-action" type="button" onclick="${mission.next.secondaryAction}">${mission.next.secondaryLabel}</button>
                </div>
            `;
        }

        function getTataFeedingFeedback(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const meals = userData.dietRecords || [];
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0) + (meal.photoAfter ? 1 : 0), 0);
            const afterCount = meals.filter(meal => meal.photoAfter).length;
            const good = [];
            const warn = [];
            if (meals.length) good.push({ title: "照片記憶", body: `今天留下 ${meals.length} 餐、${photoCount} 張照片，塔塔有回憶可以長大。`, xp: `+${meals.length >= 2 ? 25 : 12}` });
            else warn.push({ title: "還沒開飯", body: "今天還沒拍第一餐，塔塔還在等番茄。", xp: "+0" });
            if (afterCount) good.push({ title: "飯後校正", body: `${afterCount} 餐有飯後照，熱量更接近實際吃下。`, xp: "+準確" });
            if (status.proteinGap <= Math.max(10, Math.round(status.targets.protein * 0.2))) good.push({ title: "蛋白穩住", body: `蛋白質 ${status.proteinNow}/${status.targets.protein}g，塔塔比較結實。`, xp: "+10" });
            else warn.push({ title: "蛋白不足", body: `還差 ${status.proteinGap}g，下一餐補蛋、豆腐、魚或雞。`, xp: "待補" });
            if (status.fiberGap <= Math.max(6, Math.round(status.targets.fiber * 0.25))) good.push({ title: "纖維發光", body: `纖維 ${status.fiberNow}/${status.targets.fiber}g，番茄甜度上升。`, xp: "+8" });
            else warn.push({ title: "纖維不足", body: `還差 ${status.fiberGap}g，塔塔需要青菜、菇類或地瓜。`, xp: "待補" });
            if ((userData.waterMl || 0) >= 1500) good.push({ title: "水分有跟上", body: `已喝 ${userData.waterMl || 0}ml，塔塔毛色比較亮。`, xp: "+7" });
            else warn.push({ title: "水分偏少", body: `目前 ${userData.waterMl || 0}ml，先補 250ml 就好。`, xp: "待補" });
            if ((userData.currentSteps || 0) >= 5000) good.push({ title: "步行能量", body: `${(userData.currentSteps || 0).toLocaleString()} 步，飯後活動讓塔塔更輕。`, xp: "+10" });
            if (status.sugarOver > 0) warn.push({ title: "糖讓塔塔變沉", body: `糖超 ${status.sugarOver}g，下一杯先無糖。`, xp: "扣外觀" });
            if (status.sodiumOver > 0) warn.push({ title: "鈉讓塔塔水腫", body: `鈉超 ${status.sodiumOver}mg，湯底和醬料先減半。`, xp: "扣外觀" });
            if (status.caloriesOver > 0) warn.push({ title: "肚肚滿載", body: `熱量超 ${status.caloriesOver} kcal，下一餐輕量收尾。`, xp: "變沉" });
            const primaryAction = warn[0]?.title.includes("還沒開飯") ? { label: "拍第一餐", action: "openPhotoPicker('before')" }
                : warn[0]?.title.includes("水分") ? { label: "補 250ml 水", action: "addWater(250)" }
                : warn[0]?.title.includes("蛋白") || warn[0]?.title.includes("纖維") ? { label: "問下一餐", action: "askTataCoach('等等吃什麼')" }
                : warn[0] ? { label: "塔塔幫我選", action: "askTataCoach('塔塔幫我選')" }
                : { label: "拍下一餐", action: "openPhotoPicker('before')" };
            return {
                mood: warn.length ? "需要照顧" : "漂亮發光",
                beautyScore: Math.max(0, Math.min(100, Math.round(Number(growth?.score || 0)))),
                memoryCount: photoCount,
                good,
                warn,
                primaryAction
            };
        }

        function renderTataFeedCard(status, growth) {
            const card = document.getElementById('tataFeedCard');
            if (!card) return;
            const feedback = getTataFeedingFeedback(status, growth);
            const feedItems = [
                ...feedback.good.slice(0, 2).map(item => ({ ...item, type: "good", icon: "✓" })),
                ...feedback.warn.slice(0, 2).map(item => ({ ...item, type: "warn", icon: "!" }))
            ].slice(0, 4);
            const body = feedback.warn.length
                ? `塔塔今天有成長，但外觀正在提醒你：${feedback.warn[0].body}`
                : "今天的照片、營養和水分讓塔塔狀態很漂亮。接下來維持節奏就好。";
            card.innerHTML = `
                <div class="tata-feed-top">
                    <div class="tata-feed-title">今天餵給塔塔的能量</div>
                    <div class="tata-feed-meta">${feedback.mood}</div>
                </div>
                <div class="tata-feed-body">${body}</div>
                <div class="tata-feed-grid">
                    <div class="tata-feed-stat"><strong>${feedback.beautyScore}</strong><span>漂亮分</span></div>
                    <div class="tata-feed-stat"><strong>${feedback.memoryCount}</strong><span>照片回憶</span></div>
                    <div class="tata-feed-stat"><strong>${feedback.warn.length}</strong><span>外觀提醒</span></div>
                </div>
                <div class="tata-feed-list">
                    ${feedItems.map(item => `
                        <div class="tata-feed-item ${item.type}">
                            <div class="tata-feed-icon">${item.icon}</div>
                            <div class="tata-feed-copy"><strong>${item.title}</strong><span>${item.body}</span></div>
                            <div class="tata-feed-xp">${item.xp}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="tata-feed-actions">
                    <button class="tata-feed-action primary" type="button" onclick="${feedback.primaryAction.action}">${feedback.primaryAction.label}</button>
                    <button class="tata-feed-action" type="button" onclick="switchTabById('tab-diet')">看今日回憶</button>
                </div>
            `;
            card.classList.add('active');
        }

        function renderTataShareCard(status, growth) {
            const card = document.getElementById('tataShareCard');
            if (!card) return;
            const snapshot = getTataShareSnapshot(status, growth);
            const hasMeal = snapshot.meals.length > 0;
            const secondaryAction = hasMeal ? "switchTabById('tab-diet')" : "openPhotoPicker('before')";
            const secondaryLabel = hasMeal ? "看今日回憶" : "先拍第一餐";
            card.classList.add('active');
            card.innerHTML = `
                <div class="tata-share-top">
                    <div class="tata-share-title">塔塔今日狀態卡</div>
                    <div class="tata-share-meta">${hasMeal ? "可分享" : "等第一餐"}</div>
                </div>
                <div class="tata-share-preview">
                    <strong>${snapshot.title}</strong>
                    <span>${snapshot.body}</span>
                </div>
                <div class="tata-share-grid">
                    <div class="tata-share-stat"><strong>${snapshot.meals.length}</strong><span>餐點</span></div>
                    <div class="tata-share-stat"><strong>${snapshot.photoCount}</strong><span>照片</span></div>
                    <div class="tata-share-stat"><strong>${snapshot.feedback.beautyScore}</strong><span>漂亮分</span></div>
                </div>
                <div class="tata-share-actions">
                    <button class="tata-share-action primary" type="button" onclick="shareTataStatus()">分享塔塔狀態</button>
                    <button class="tata-share-action" type="button" onclick="${secondaryAction}">${secondaryLabel}</button>
                </div>
            `;
        }

        function getTataLevelQuest(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const meals = userData.dietRecords || [];
            const nextStage = OTTER_STAGES[growth.stage + 1];
            const stage = OTTER_STAGES[growth.stage] || OTTER_STAGES[0];
            const nextScore = nextStage ? nextStage.minScore : Math.max(stage.minScore + 100, growth.totalScore || 0);
            const prevScore = stage.minScore || 0;
            const stageSpan = Math.max(1, nextScore - prevScore);
            const progress = nextStage ? Math.max(0, Math.min(100, Math.round(((growth.totalScore - prevScore) / stageSpan) * 100))) : 100;
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0) + (meal.photoAfter ? 1 : 0), 0);
            const balanced = status.caloriesOver === 0 && status.sugarOver === 0 && status.sodiumOver === 0 && status.proteinGap <= Math.max(12, Math.round(status.targets.protein * 0.25));
            const sources = [
                {
                    key: "photo",
                    title: "拍照記憶",
                    done: meals.length >= 2,
                    warn: meals.length === 0,
                    score: meals.length >= 2 ? "+25 XP" : (meals.length === 1 ? "+12 XP" : "+0 XP"),
                    body: meals.length >= 2 ? `${photoCount} 張照片，今天有完整記錄。` : (meals.length === 1 ? "已有第一餐，再拍一餐會更穩。" : "先拍飯前照，塔塔才開始成長。")
                },
                {
                    key: "nutrition",
                    title: "營養平衡",
                    done: balanced,
                    warn: status.sugarOver > 0 || status.sodiumOver > 0 || status.caloriesOver > 0,
                    score: balanced ? "+18 XP" : "待補",
                    body: balanced ? "熱量、糖、鈉和蛋白質目前很穩。" : `蛋白差 ${status.proteinGap}g，纖維差 ${status.fiberGap}g。`
                },
                {
                    key: "water",
                    title: "喝水節奏",
                    done: (userData.waterMl || 0) >= 1500,
                    warn: status.waterGap >= 700,
                    score: (userData.waterMl || 0) >= 1500 ? "+7 XP" : "待補",
                    body: (userData.waterMl || 0) >= 1500 ? `已喝 ${userData.waterMl || 0}ml。` : `還差 ${status.waterGap}ml，先補下一杯。`
                },
                {
                    key: "steps",
                    title: "步行能量",
                    done: (userData.currentSteps || 0) >= 5000,
                    warn: (userData.currentSteps || 0) < 1500,
                    score: (userData.currentSteps || 0) >= 8000 ? "+20 XP" : ((userData.currentSteps || 0) >= 5000 ? "+10 XP" : "待累積"),
                    body: `${(userData.currentSteps || 0).toLocaleString()} 步，飯後走一段就會更亮。`
                }
            ];
            const scoreGap = nextStage ? Math.max(0, nextStage.minScore - growth.totalScore) : 0;
            const dayGap = nextStage ? Math.max(0, nextStage.minDays - growth.streak) : 0;
            const nextAction = sources.find(item => !item.done)?.body || "今天已經很漂亮，維持就好。";
            return { stage, nextStage, progress, scoreGap, dayGap, sources, nextAction };
        }

        function renderTataLevelQuest(status, growth) {
            const card = document.getElementById('tataLevelQuestCard');
            if (!card || !growth) return;
            const quest = getTataLevelQuest(status, growth);
            const title = quest.nextStage ? `塔塔升級任務：前往「${quest.nextStage.name}」` : "塔塔升級任務：維持最高狀態";
            const body = quest.nextStage
                ? `還差 ${quest.scoreGap} 分、${quest.dayGap} 天。今天先做最小下一步：${quest.nextAction}`
                : `塔塔已經抵達目前最高階。今天的任務是穩定拍照、喝水、步數和營養平衡。`;
            card.innerHTML = `
                <div class="tata-level-quest-top">
                    <div class="tata-level-quest-title">${title}</div>
                    <div class="tata-level-quest-meta">${growth.totalScore || 0} XP</div>
                </div>
                <div class="tata-level-track" aria-label="塔塔升級進度"><div class="tata-level-track-fill" style="width:${quest.progress}%"></div></div>
                <div class="tata-level-quest-body">${body}</div>
                <div class="tata-quest-source-grid">
                    ${quest.sources.map(item => `
                        <div class="tata-quest-source${item.done ? ' done' : ''}${item.warn ? ' warn' : ''}">
                            <strong>${item.title}</strong>
                            <span>${item.body}</span>
                            <b>${item.score}</b>
                        </div>
                    `).join('')}
                </div>
            `;
            card.classList.add('active');
        }

        function getTataGrowthDrivers(status = getNutritionStatus()) {
            const good = getDailyMissions(status)
                .filter(item => item.done)
                .map(item => `${item.label} ${item.reward}`);
            const warnings = [];
            const meals = userData.dietRecords || [];
            const todayFlags = new Set(meals.flatMap(meal => meal.healthFlags || []));
            if (status.caloriesOver > 0) warnings.push(`熱量超出 ${status.caloriesOver} kcal，塔塔肚肚會變沉。`);
            if (status.sugarOver > 0 || todayFlags.has('sugary')) warnings.push(`糖分偏高，先改無糖飲。`);
            if (status.sodiumOver > 0 || todayFlags.has('high_sodium')) warnings.push(`鈉偏高，下一餐少醬少湯底。`);
            if (todayFlags.has('fried_or_high_fat')) warnings.push(`油脂偏重，下一餐走清湯和低脂蛋白。`);
            if (status.fiberGap >= 10) warnings.push(`纖維還差 ${status.fiberGap}g，塔塔需要青菜和豆類。`);
            if (status.waterGap >= 700) warnings.push(`水還差 ${status.waterGap}ml，先補 250-500ml。`);
            return {
                good: good.length ? good : ["先拍下第一餐，塔塔就會開始累積今日成長。"],
                warnings: warnings.length ? warnings : ["目前沒有明顯扣分項，照下一餐建議補缺口就好。"]
            };
        }

        function getTomorrowGrowthPlan(status = getNutritionStatus(), growth = updateOtterGrowth()) {
            const plans = [];
            const meals = userData.dietRecords || [];
            if (meals.length < 2) {
                plans.push({ title: "留下兩餐照片", body: "明天至少拍兩餐，塔塔會有完整早午晚節奏可以判斷。", xp: "+25" });
            }
            if (status.proteinGap >= 12) {
                plans.push({ title: "先補一掌蛋白質", body: `蛋白質今天還差 ${status.proteinGap}g，明天第一餐先選蛋、豆腐、魚、雞或無糖豆漿。`, xp: "+10" });
            }
            if (status.fiberGap >= 7) {
                plans.push({ title: "加兩拳蔬菜", body: `纖維今天還差 ${status.fiberGap}g，明天至少補青菜、菇類、豆類或全穀。`, xp: "+8" });
            }
            if (status.waterGap >= 500) {
                plans.push({ title: "上午先喝 500ml", body: `水分今天還差 ${status.waterGap}ml，明天先把第一瓶水喝完，塔塔會比較亮。`, xp: "+7" });
            }
            if ((userData.currentSteps || 0) < 5000) {
                plans.push({ title: "飯後散步 10 分鐘", body: "明天不用硬運動，先把飯後散步變成 5000 步任務。", xp: "+10" });
            }
            if (status.sugarOver > 0) {
                plans.push({ title: "第一杯飲料無糖", body: "糖分今天偏高，明天第一杯先選無糖茶、黑咖啡或氣泡水。", xp: "保外觀" });
            }
            if (status.sodiumOver > 0) {
                plans.push({ title: "湯底醬料減半", body: "鈉今天偏高，明天湯可以吃料，湯底和醬料先少一半。", xp: "保外觀" });
            }
            if (!plans.length) {
                plans.push(
                    { title: "照今天節奏拍第一餐", body: "明天只要先拍第一餐，塔塔就能延續漂亮狀態。", xp: "+12" },
                    { title: "維持蛋白質和蔬菜", body: "蛋白質、纖維和水分守住，塔塔外觀會更穩。", xp: "+18" },
                    { title: "走到 5000 步", body: "飯後慢慢走，把今日熱量額度換回來。", xp: "+10" }
                );
            }
            const nextStage = OTTER_STAGES[growth.stage + 1];
            const scoreGap = nextStage ? Math.max(0, nextStage.minScore - growth.totalScore) : 0;
            const dayGap = nextStage ? Math.max(0, nextStage.minDays - growth.streak) : 0;
            return {
                title: nextStage ? `明日讓塔塔靠近「${nextStage.name}」` : "明日維持塔塔漂亮狀態",
                body: nextStage
                    ? `還差 ${scoreGap} 分、${dayGap} 天。明天先做下面三件事，比硬撐更容易升級。`
                    : "塔塔目前已在最高階，明天重點是穩定拍照、補水和少糖少鈉。",
                items: plans.slice(0, 3)
            };
        }

        function renderTomorrowGrowthPlan(status, growth) {
            const card = document.getElementById('tomorrowGrowthPlanCard');
            if (!card || !growth) return;
            const plan = getTomorrowGrowthPlan(status, growth);
            card.innerHTML = `
                <div class="tomorrow-growth-top">
                    <div class="tomorrow-growth-title">${plan.title}</div>
                    <div class="tomorrow-growth-meta">3 件事</div>
                </div>
                <div class="tomorrow-growth-body">${plan.body}</div>
                <div class="tomorrow-growth-list">
                    ${plan.items.map((item, index) => `
                        <div class="tomorrow-growth-item">
                            <div class="tomorrow-growth-rank">${index + 1}</div>
                            <div><strong>${item.title}</strong><span>${item.body}</span></div>
                            <div class="tomorrow-growth-xp">${item.xp}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            card.classList.add('active');
        }

        function renderTataStoryChapters(growth) {
            const totalScore = Number(growth.totalScore || 0);
            const streak = Number(growth.streak || 0);
            const chapterHtml = OTTER_STAGES.map((stage, index) => {
                const scoreGap = Math.max(0, stage.minScore - totalScore);
                const dayGap = Math.max(0, stage.minDays - streak);
                const unlocked = scoreGap === 0 && dayGap === 0;
                const current = index === growth.stage;
                const marker = current ? "今" : unlocked ? "✓" : index + 1;
                const meta = current
                    ? "目前章節：今天的飲食、喝水與步數會改變塔塔外觀。"
                    : unlocked
                        ? "已解鎖：這段回憶已收進塔塔故事。"
                        : `未解鎖：還差 ${scoreGap} 分、${dayGap} 天。`;
                return `
                    <div class="tata-chapter ${unlocked ? 'unlocked' : 'locked'} ${current ? 'current' : ''}">
                        <div class="tata-chapter-marker">${marker}</div>
                        <div>
                            <div class="tata-chapter-title">${stage.name}</div>
                            <div class="tata-chapter-story">${stage.story}</div>
                            <div class="tata-chapter-meta">${meta}</div>
                        </div>
                    </div>
                `;
            }).join('');
            return `
                <details class="tata-chapter-panel">
                    <summary class="tata-chapter-heading">
                        <strong>塔塔故事章節</strong>
                        <span>累積 ${totalScore} 分 · 連續 ${streak} 天</span>
                        <em class="tata-chapter-hint">展開</em>
                    </summary>
                    <div class="tata-chapter-list">${chapterHtml}</div>
                </details>
            `;
        }

        function renderTataGrowthCoach(status, growth) {
            const card = document.getElementById('tataGrowthCoachCard');
            if (!card || !growth) return;
            const stage = OTTER_STAGES[growth.stage] || OTTER_STAGES[0];
            const nextStage = OTTER_STAGES[growth.stage + 1];
            const drivers = getTataGrowthDrivers(status);
            const nextText = nextStage
                ? `下一階段「${nextStage.name}」還差 ${Math.max(0, nextStage.minScore - growth.totalScore)} 分、${Math.max(0, nextStage.minDays - growth.streak)} 天。`
                : "塔塔已到目前最高階，接下來是維持漂亮狀態。";
            card.innerHTML = `
                <div class="tata-growth-top">
                    <div class="tata-growth-title">塔塔今日成長報告</div>
                    <div class="tata-growth-level">${growth.score || 0} / 100 XP</div>
                </div>
                <div class="tata-growth-story">${stage.story} ${nextText}</div>
                <div class="tata-growth-grid">
                    <div class="tata-growth-mini good">
                        <div class="label">今天讓塔塔變漂亮</div>
                        <div class="value">${drivers.good.slice(0, 2).join("｜")}</div>
                    </div>
                    <div class="tata-growth-mini warn">
                        <div class="label">今天會影響外觀</div>
                        <div class="value">${drivers.warnings.slice(0, 2).join("｜")}</div>
                    </div>
                </div>
                ${renderTataStoryChapters(growth)}
            `;
            card.classList.add('active');
        }

        function getStreak(username) {
            let streak = 0;
            const date = new Date();
            while (true) {
                const dateStr = todayKeyDate(date);
                const meals = safeJsonArray(localStorage.getItem(`paipachi:${username}:meals:${dateStr}`));
                const steps = parseInt(localStorage.getItem(`paipachi:${username}:steps:${dateStr}`) || '0', 10);
                if (meals.length === 0 && (!steps || Number.isNaN(steps))) break;
                streak++;
                date.setDate(date.getDate() - 1);
            }
            return streak;
        }

        function getMealPhotoStreak(username = currentUser) {
            if (!username) return 0;
            let streak = 0;
            const date = new Date();
            while (true) {
                const dateStr = todayKeyDate(date);
                const meals = dateStr === todayKeyDate()
                    ? (userData.dietRecords || [])
                    : safeJsonArray(localStorage.getItem(`paipachi:${username}:meals:${dateStr}`));
                if (!meals.length) break;
                streak++;
                date.setDate(date.getDate() - 1);
            }
            return streak;
        }

        function getMealStreakWeek(username = currentUser) {
            const days = [];
            const today = todayKeyDate();
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateKey = todayKeyDate(date);
                const meals = dateKey === today
                    ? (userData.dietRecords || [])
                    : safeJsonArray(localStorage.getItem(`paipachi:${username}:meals:${dateKey}`));
                const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore ? 1 : 0) + (meal.photoAfter ? 1 : (meal.photo ? 1 : 0)), 0);
                days.push({
                    date: dateKey,
                    label: date.toLocaleDateString('zh-TW', { weekday: 'short' }),
                    mealCount: meals.length,
                    photoCount,
                    isToday: dateKey === today
                });
            }
            return days;
        }

        function renderMealStreakCard() {
            const card = document.getElementById('mealStreakCard');
            if (!card || !currentUser) return;
            const days = getMealStreakWeek(currentUser);
            const today = days[days.length - 1] || {};
            const streak = getMealPhotoStreak(currentUser);
            const weekMeals = days.reduce((sum, day) => sum + day.mealCount, 0);
            const weekPhotos = days.reduce((sum, day) => sum + day.photoCount, 0);
            const weekActiveDays = days.filter(day => day.mealCount > 0).length;
            const nextMilestone = streak >= 7 ? 14 : (streak >= 3 ? 7 : 3);
            const milestoneGap = Math.max(0, nextMilestone - streak);
            const pendingAfterCount = getPendingAfterPhotoMeals(userData.dietRecords || []).length;
            const title = today.mealCount
                ? `今天已留下 ${today.mealCount} 餐，連續 ${streak} 天`
                : "今天還差第一張飯前照";
            const body = today.mealCount
                ? `這週已有 ${weekActiveDays} 天打開 拍拍吃，留下 ${weekMeals} 餐、${weekPhotos} 張照片。下一步只做一件事：${pendingAfterCount ? '把待補飯後照補回同一餐' : '問塔塔下一餐或約好明天第一餐'}。`
                : `先拍今天第一餐就好。塔塔會把照片、熱量、餐別和下一餐建議放進今天的回憶；連續 ${nextMilestone} 天後，成長故事會更有感。`;
            const milestoneText = milestoneGap > 0
                ? `再 ${milestoneGap} 天到 ${nextMilestone} 天習慣里程碑`
                : `已達成 ${nextMilestone} 天習慣里程碑`;
            const milestoneBody = pendingAfterCount
                ? `今天還有 ${pendingAfterCount} 餐可補飯後照，補完會讓回憶和熱量更準。`
                : "不用完美，只要下次吃飯前再打開一次，塔塔的故事就會接著長。";
            let primaryLabel = "拍今天第一餐";
            let primaryAction = "openPhotoPicker('before')";
            if (today.mealCount && pendingAfterCount) {
                primaryLabel = "補飯後照";
                primaryAction = "startLatestAfterPhoto(event)";
            } else if (today.mealCount) {
                primaryLabel = "問下一餐";
                primaryAction = "askTataCoach('等等吃什麼')";
            }
            const secondaryLabel = today.mealCount ? "約明天第一餐" : "先問吃什麼";
            const secondaryAction = today.mealCount ? "setTomorrowFirstMealPromise()" : "askTataCoach('等等吃什麼')";
            card.classList.add('active');
            card.innerHTML = `
                <div class="meal-streak-top">
                    <div>
                        <div class="meal-streak-title">${title}</div>
                    </div>
                    <div class="meal-streak-meta">本週 ${weekMeals} 餐<br>${weekPhotos} 張照片</div>
                </div>
                <div class="meal-streak-body">${body}</div>
                <div class="meal-streak-milestone"><strong>${milestoneText}</strong><span>${milestoneBody}</span></div>
                <div class="meal-streak-week">
                    ${days.map(day => `
                        <button class="meal-streak-day${day.mealCount ? ' done' : ''}${day.isToday ? ' today' : ''}" type="button" onclick="openRecentMemoryDate('${day.date}')">
                            <span>${day.label}</span>
                            <strong>${day.mealCount || '-'}</strong>
                            <span>${day.photoCount || 0} 張</span>
                        </button>
                    `).join('')}
                </div>
                <div class="meal-streak-actions">
                    <button class="meal-streak-action primary" type="button" onclick="${primaryAction}">${primaryLabel}</button>
                    <button class="meal-streak-action" type="button" onclick="${secondaryAction}">${secondaryLabel}</button>
                </div>
            `;
        }

        function getTotalScore(username) {
            let total = 0;
            Object.keys(localStorage)
                .filter(key => key.startsWith(`paipachi:${username}:dailyScore:`))
                .forEach(key => { total += parseInt(localStorage.getItem(key) || '0', 10); });
            return total;
        }

        function updateOtterGrowth() {
            if (!currentUser) return { stage: 0, score: 0, totalScore: 0, streak: 0 };
            const today = todayKeyDate();
            const todayScore = calculateDailyScore(currentUser);
            localStorage.setItem(`paipachi:${currentUser}:dailyScore:${today}`, String(todayScore));
            const totalScore = getTotalScore(currentUser);
            const streak = getStreak(currentUser);
            let currentStage = 0;
            for (let i = OTTER_STAGES.length - 1; i >= 0; i--) {
                if (totalScore >= OTTER_STAGES[i].minScore && streak >= OTTER_STAGES[i].minDays) {
                    currentStage = i;
                    break;
                }
            }
            const prevStage = parseInt(localStorage.getItem(`paipachi:${currentUser}:otterStage`) || '0', 10);
            localStorage.setItem(`paipachi:${currentUser}:otterStage`, String(currentStage));
            localStorage.setItem(`paipachi:${currentUser}:totalScore`, String(totalScore));
            userData.streakDays = streak;
            updateOtterDisplay(currentStage, todayScore, totalScore, streak);
            syncRemoteDailyState(today);
            if (currentStage > prevStage) showEvolutionAnimation(OTTER_STAGES[currentStage]);
            return { stage: currentStage, score: todayScore, totalScore, streak };
        }

        function updateOtterDisplay(stage, todayScore, totalScore, streak) {
            const stageInfo = OTTER_STAGES[stage] || OTTER_STAGES[0];
            tomaStageBadge.innerText = stageInfo.name;
            const growthFill = document.getElementById('growthBarFill');
            const growthText = document.getElementById('growthScoreText');
            if (growthFill) growthFill.style.width = `${Math.min(100, todayScore || 0)}%`;
            if (growthText) growthText.innerText = `今日成長 ${todayScore || 0} / 100 分 · 連續 ${streak || 0} 天 · 累積 ${totalScore || 0} 分`;
        }

        function showEvolutionAnimation(stage) {
            const overlay = document.createElement('div');
            overlay.className = 'evolution-overlay';
            overlay.innerHTML = `
                <div class="evolution-content">
                    <div class="evolution-glow"></div>
                    <div class="evolution-otter">🦦</div>
                    <h2 style="font-family:var(--font-serif); font-size:20px; margin-bottom:8px;">塔塔進化了</h2>
                    <p style="font-size:13px; color:var(--color-muted); margin-bottom:18px;">${stage.name}</p>
                    <button class="btn-main-cta" style="height:42px;" onclick="this.closest('.evolution-overlay').remove()">收下</button>
                </div>
            `;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('show'), 50);
        }

        function checkOtterDecay() {
            if (!currentUser) return;
            const lastActive = localStorage.getItem(`paipachi:${currentUser}:lastActive`);
            if (!lastActive) return;
            const daysSince = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000);
            const currentStage = parseInt(localStorage.getItem(`paipachi:${currentUser}:otterStage`) || '0', 10);
            if (daysSince >= 3) enterTataDecayMode(daysSince);
            if (daysSince >= 14 && currentStage > 0) {
                const newStage = currentStage - 1;
                localStorage.setItem(`paipachi:${currentUser}:otterStage`, String(newStage));
                updateOtterDisplay(newStage, calculateDailyScore(currentUser), getTotalScore(currentUser), getStreak(currentUser));
                showToast("塔塔進入裝懶模式了。拍一餐，番茄就會回來。");
            } else if (daysSince >= 3) {
                showToast("塔塔的番茄不見了。記一餐，把它叫回來。");
            }
        }

        function enterTataDecayMode(daysSince) {
            const aquarium = document.getElementById('tomaAquarium');
            if (!aquarium) return;
            aquarium.classList.add('decay-mode');
            tomaBubble.innerText = `塔塔裝懶第 ${daysSince} 天。番茄先不見了，拍下新的一餐，它就會彈回來。`;
        }

        function reviveTataTomato() {
            const aquarium = document.getElementById('tomaAquarium');
            if (!aquarium || !aquarium.classList.contains('decay-mode')) return;
            aquarium.classList.remove('decay-mode');
            aquarium.classList.add('tomato-return');
            setTimeout(() => aquarium.classList.remove('tomato-return'), 700);
            tomaBubble.innerText = "番茄回來了。塔塔也醒了，今天就從這一餐重新開始。";
        }

        function markActive() {
            if (currentUser) {
                localStorage.setItem(`paipachi:${currentUser}:lastActive`, new Date().toISOString());
                syncRemoteDailyState(todayKeyDate());
            }
        }

        function getSevenDayWeightTrend() {
            if (!currentUser) return { delta: null, count: 0 };
            const weights = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const key = todayKeyDate(date);
                const value = Number(localStorage.getItem(`paipachi:${currentUser}:weight:${key}`));
                if (Number.isFinite(value) && value > 0) weights.push({ key, value });
            }
            if (weights.length < 2) return { delta: null, count: weights.length };
            return {
                delta: Number((weights[weights.length - 1].value - weights[0].value).toFixed(1)),
                count: weights.length
            };
        }

        function renderBodyRhythmCard(status = getNutritionStatus()) {
            const card = document.getElementById('bodyRhythmCard');
            if (!card) return;
            const heightM = Number(userData.currentHeight || 0) / 100;
            const weight = Number(userData.currentWeight || 0);
            const bmi = heightM > 0 ? weight / (heightM * heightM) : 0;
            const stepBurn = Math.round(Number(userData.currentSteps || 0) * 0.04);
            const trend = getSevenDayWeightTrend();
            const calorieBalance = status.caloriesOver > 0 ? `超 ${status.caloriesOver}` : `剩 ${status.caloriesLeft}`;
            const bodyTone = bmi >= 27 ? "身體負擔偏高" : bmi < 18.5 ? "需要穩定補給" : "體態區間穩定";
            const trendText = trend.delta === null
                ? "體重趨勢還在累積，先把今天資料保存好。"
                : Math.abs(trend.delta) < 0.4
                    ? "7 日體重幾乎持平，這是很適合觀察照片份量的狀態。"
                    : `7 日體重 ${trend.delta > 0 ? "上升" : "下降"} ${Math.abs(trend.delta)} kg，先看鹽分、水分和餐點份量，不用被單日數字綁架。`;
            let nextFocus = "下一餐先拍飯前照，塔塔用實際份量幫你估。";
            if (status.sodiumOver > 0) nextFocus = "下一餐先少湯底、少醬料，讓水分和鈉降下來。";
            else if (status.sugarOver > 0) nextFocus = "今天糖分偏高，下一餐先選無糖飲和原型食物。";
            else if (status.proteinGap >= 18) nextFocus = `蛋白質還差 ${status.proteinGap}g，下一餐優先補蛋、豆腐、魚或雞。`;
            else if (status.fiberGap >= 8) nextFocus = `纖維還差 ${status.fiberGap}g，下一餐加青菜、菇類、豆類或全穀。`;
            else if (status.caloriesLeft < 350) nextFocus = "熱量額度接近收尾，下一餐走清爽、湯汁醬料分開。";
            else if (stepBurn > 0) nextFocus = `今天步行已幫你多換回約 ${stepBurn} kcal，下一餐仍以拍照校正份量。`;

            card.innerHTML = `
                <div class="body-rhythm-top">
                    <div>
                        <div class="body-rhythm-kicker">身體節奏</div>
                        <div class="body-rhythm-title">身體節奏總覽</div>
                    </div>
                    <div class="body-rhythm-pill">${bodyTone}</div>
                </div>
                <div class="body-rhythm-body">${trendText}${nextFocus}</div>
                <div class="body-rhythm-grid">
                    <div class="body-rhythm-metric"><div class="label">BMI</div><div class="value">${bmi ? bmi.toFixed(1) : "--"}</div></div>
                    <div class="body-rhythm-metric"><div class="label">今日體重</div><div class="value">${weight ? weight.toFixed(1) : "--"}kg</div></div>
                    <div class="body-rhythm-metric"><div class="label">步行消耗</div><div class="value">${stepBurn}kcal</div></div>
                    <div class="body-rhythm-metric"><div class="label">熱量餘額</div><div class="value">${calorieBalance}kcal</div></div>
                </div>
                <div class="body-rhythm-actions">
                    <button class="body-rhythm-action primary" type="button" onclick="openPhotoPicker('camera')">飯前拍校正</button>
                    <button class="body-rhythm-action" type="button" onclick="switchToTrend()">看 7 日趨勢</button>
                </div>
            `;
        }

        function renderTrendSummary() {
            const container = document.getElementById('trendSummary');
            const insight = document.getElementById('trendInsight');
            if (!container || !currentUser) return;
            const rows = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const key = todayKeyDate(date);
                const meals = getStoredMealsForDate(key);
                const calories = meals.reduce((sum, meal) => sum + Number(meal.calories || meal.kcal || 0), 0);
                const steps = parseInt(localStorage.getItem(`paipachi:${currentUser}:steps:${key}`) || '0', 10) || 0;
                const weight = localStorage.getItem(`paipachi:${currentUser}:weight:${key}`);
                rows.push({ key, calories, steps, weight });
            }
            const hasData = rows.some(row => row.calories || row.steps || row.weight);
            if (!hasData) {
                if (insight) {
                    insight.innerHTML = `<div class="trend-insight-title">塔塔本週解讀</div><div class="trend-insight-text">還需要幾筆餐點、步數或體重紀錄。先拍今天第一餐，塔塔就能開始幫你看 7 日節奏。</div>`;
                }
                container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--color-muted); font-size:13px;">累積幾天紀錄後，這裡會顯示熱量、步數與體重趨勢。</div>`;
                return;
            }
            const activeDays = rows.filter(row => row.calories || row.steps || row.weight).length;
            const calorieDays = rows.filter(row => row.calories > 0);
            const avgCalories = calorieDays.length ? Math.round(calorieDays.reduce((sum, row) => sum + row.calories, 0) / calorieDays.length) : 0;
            const avgSteps = Math.round(rows.reduce((sum, row) => sum + row.steps, 0) / rows.length);
            const weights = rows
                .filter(row => row.weight !== null && row.weight !== undefined && row.weight !== '')
                .map(row => ({ ...row, weightNum: Number(row.weight) }))
                .filter(row => Number.isFinite(row.weightNum));
            const weightDelta = weights.length >= 2 ? Number((weights[weights.length - 1].weightNum - weights[0].weightNum).toFixed(1)) : null;
            const target = Number(userData.targetCalories || 0);
            let direction = "資料正在成形，塔塔會先看你有沒有穩定記錄。";
            if (calorieDays.length >= 2 && target > 0) {
                if (avgCalories > target * 1.12) direction = "這週熱量平均偏高，先把含糖飲、炸物和醬料收斂，塔塔會慢慢變輕。";
                else if (avgCalories < target * 0.78) direction = "這週熱量平均偏低，若你有訓練，下一餐要補足蛋白質和主食，不要硬餓。";
                else direction = "這週熱量節奏接近目標，接下來守住蛋白質、纖維和步數，塔塔會更亮。";
            }
            if (avgSteps >= 7000) direction += " 步數表現不錯，今天可以把它當成額外熱量緩衝。";
            else if (avgSteps > 0 && avgSteps < 4000) direction += " 步數偏低，飯後 10 分鐘散步會比硬少吃更舒服。";
            if (weightDelta !== null) {
                if (Math.abs(weightDelta) < 0.4) direction += " 體重波動很小，先看 7 日趨勢，不用被單日數字影響。";
                else direction += ` 這週體重變化 ${weightDelta > 0 ? '+' : ''}${weightDelta} kg，先搭配餐點照片看是不是水分、鹽分或份量造成。`;
            }
            if (insight) {
                insight.innerHTML = `
                    <div class="trend-insight-title">塔塔本週解讀</div>
                    <div class="trend-insight-text">${direction}</div>
                    <div class="trend-chip-grid">
                        <div class="trend-chip"><strong>${activeDays}/7</strong><span>有紀錄天</span></div>
                        <div class="trend-chip"><strong>${avgCalories || 0}</strong><span>平均 kcal</span></div>
                        <div class="trend-chip"><strong>${avgSteps.toLocaleString()}</strong><span>平均步數</span></div>
                    </div>
                `;
            }
            container.innerHTML = rows.map(row => {
                const [, month, day] = row.key.split('-');
                return `<div class="history-item"><div style="font-weight:700;">${month}/${day}</div><div style="color:var(--color-muted); font-size:12px;">${row.calories || 0} kcal · ${row.steps.toLocaleString()} 步${row.weight ? ` · ${row.weight} kg` : ''}</div></div>`;
            }).join('');
        }

        function addWater(amountMl) {
            userData.waterMl = Math.max(0, Math.min(5000, Math.round((userData.waterMl || 0) + amountMl)));
            localStorage.setItem(dailyKey('water'), String(userData.waterMl));
            saveToStorage();
            updateUI(false);
            syncRemoteDailyState(todayKeyDate());
            showToast(amountMl > 0 ? `已記錄 ${amountMl}ml，今天已喝 ${userData.waterMl}ml。` : `已調整喝水，今天已喝 ${userData.waterMl}ml。`);
        }

        function setMiniBar(id, current, target) {
            const bar = document.getElementById(id);
            if (!bar) return;
            const ratio = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            bar.style.width = `${ratio}%`;
        }

        function renderWaterRhythm(status) {
            const card = document.getElementById('waterRhythmCard');
            if (!card || !status) return;
            const plan = getWaterReminderPlan(status);
            const gap = Math.max(0, status.waterGap || 0);
            card.classList.toggle('done', gap === 0);
            if (gap === 0) {
                card.innerHTML = `<strong>塔塔喝水節奏</strong>今天水分已達標。接下來口渴再補就好，不需要硬灌水。`;
                return;
            }
            const reason = gap >= 1000
                ? "今天水分落後比較多，塔塔會比較容易口渴。"
                : (gap >= 500 ? "再補一點，塔塔狀態會比較穩。" : "快達標了，最後一小杯就好。");
            card.innerHTML = `<strong>塔塔喝水節奏</strong>${plan.timing} ${plan.nextAmount}ml。${reason} 目前還差 ${gap}ml。`;
        }

        function getWaterReminderPlan(status = getNutritionStatus(), now = new Date()) {
            const gap = Math.max(0, Math.round(status.waterGap || 0));
            const waterNow = Math.max(0, Math.round(status.waterNow || 0));
            const target = Math.max(1, Math.round(status.targets?.water || DAILY_GUIDELINES.waterMl || 2000));
            const hour = now.getHours();
            const nextAmount = gap >= 900 ? 500 : (gap > 0 ? Math.min(250, gap) : 0);
            let timing = "現在先補一杯";
            let nextTime = "現在";
            let stage = "起步";
            if (gap === 0) {
                return { gap, waterNow, target, nextAmount: 0, timing: "今天水分已達標", nextTime: "完成", stage: "達標", message: "今天水分已達標，接下來照口渴感小口補就好。" };
            }
            if (hour < 10) {
                timing = "早餐後到上午先補";
                nextTime = "10:30 前";
                stage = "上午補底";
            } else if (hour < 13) {
                timing = "午餐前後先補";
                nextTime = "13:30 前";
                stage = "午餐配速";
            } else if (hour < 17) {
                timing = "下午分兩次補";
                nextTime = "16:30 前";
                stage = "下午續航";
            } else if (hour < 21) {
                timing = "晚餐前後小口補";
                nextTime = "20:30 前";
                stage = "晚餐收斂";
            } else {
                timing = "睡前不要猛灌，先小口補";
                nextTime = "睡前 60 分鐘前";
                stage = "夜間保守";
            }
            const remainingCups = Math.max(1, Math.ceil(gap / 250));
            const pace = gap >= 1000 ? "水分落後，先把第一杯補起來。" : (gap >= 500 ? "節奏還能追，下一杯先排進來。" : "快達標了，最後一杯不用急。");
            return {
                gap,
                waterNow,
                target,
                nextAmount,
                timing,
                nextTime,
                stage,
                remainingCups,
                message: `${nextTime} 補 ${nextAmount}ml，今天還差 ${gap}ml，約 ${remainingCups} 杯。${pace}`
            };
        }

        function renderWaterReminderCard(status) {
            const card = document.getElementById('waterReminderCard');
            if (!card || !status) return;
            const plan = getWaterReminderPlan(status);
            card.classList.toggle('done', plan.gap === 0);
            const actionButtons = plan.gap === 0
                ? `<div class="water-reminder-actions"><button type="button" onclick="addWater(250)">口渴再 +250ml</button><button type="button" onclick="askTataCoach('我今天喝水夠嗎')">問塔塔</button></div>`
                : `<div class="water-reminder-actions"><button type="button" onclick="addWater(${plan.nextAmount})">記錄這杯 ${plan.nextAmount}ml</button><button type="button" onclick="askTataCoach('我想喝飲料')">想喝飲料</button></div>`;
            card.innerHTML = `
                <strong>下一杯水提醒</strong>
                ${plan.message}
                <div class="water-reminder-grid">
                    <div class="water-reminder-stat"><b>${plan.waterNow}</b><span>已喝 ml</span></div>
                    <div class="water-reminder-stat"><b>${plan.gap}</b><span>還差 ml</span></div>
                    <div class="water-reminder-stat"><b>${plan.nextTime}</b><span>${plan.stage}</span></div>
                </div>
                ${actionButtons}
            `;
        }

        function renderNutritionSummary(leftCalories) {
            const status = getNutritionStatus(leftCalories);
            const proteinText = document.getElementById('proteinNeedText');
            const fiberText = document.getElementById('fiberNeedText');
            const waterText = document.getElementById('waterNeedText');
            const calorieText = document.getElementById('calorieNeedText');
            const sugarText = document.getElementById('sugarNeedText');
            const sodiumText = document.getElementById('sodiumNeedText');
            const adviceEl = document.getElementById('dailyNutritionAdvice');
            if (proteinText) proteinText.innerText = `${status.proteinNow} / ${status.targets.protein}g`;
            if (fiberText) fiberText.innerText = `${status.fiberNow} / ${status.targets.fiber}g`;
            if (waterText) waterText.innerText = `${status.waterNow} / ${status.targets.water}ml`;
            if (calorieText) calorieText.innerText = `${status.caloriesLeft} kcal`;
            if (sugarText) sugarText.innerText = status.sugarOver > 0 ? `超 ${status.sugarOver}g` : `${status.sugarNow} / ${status.targets.sugar}g`;
            if (sodiumText) sodiumText.innerText = status.sodiumOver > 0 ? `超 ${status.sodiumOver}mg` : `${status.sodiumNow} / ${status.targets.sodium}mg`;
            setMiniBar('proteinNeedBar', status.proteinNow, status.targets.protein);
            setMiniBar('fiberNeedBar', status.fiberNow, status.targets.fiber);
            setMiniBar('waterNeedBar', status.waterNow, status.targets.water);
            setMiniBar('calorieNeedBar', Math.max(0, userData.targetCalories - status.caloriesLeft), userData.targetCalories);
            setMiniBar('sugarNeedBar', status.sugarNow, status.targets.sugar);
            setMiniBar('sodiumNeedBar', status.sodiumNow, status.targets.sodium);
            renderWaterRhythm(status);
            renderWaterReminderCard(status);
            renderTodayDecisionBrief(status);
            if (adviceEl) {
                const next = getNextMealSuggestion(new Date(), status.caloriesLeft);
                const sugarLine = status.sugarOver > 0 ? `糖已超 ${status.sugarOver}g` : `糖剩 ${status.sugarLeft}g`;
                const sodiumLine = status.sodiumOver > 0 ? `鈉已超 ${status.sodiumOver}mg` : `鈉剩 ${status.sodiumLeft}mg`;
                const priorityText = (next.priorities || []).map(item => item.label).join(' > ');
                adviceEl.innerText = `依 DGA/FDA/DRI 公開基準：纖維 ${status.targets.fiber}g、鈉低於 ${status.targets.sodium}mg、糖低於每日熱量 10%、蛋白質約 ${status.targets.protein}g；水分是塔塔的喝水追蹤目標。今天蛋白質還差 ${status.proteinGap}g、纖維還差 ${status.fiberGap}g、水還差 ${status.waterGap}ml；${sugarLine}、${sodiumLine}。優先順序：${priorityText}。${next.text}`;
            }
            return status;
        }

        function renderNutritionSummary(leftCalories = null) {
            const status = getNutritionStatus(leftCalories);
            const proteinText = document.getElementById('proteinNeedText');
            const fiberText = document.getElementById('fiberNeedText');
            const waterText = document.getElementById('waterNeedText');
            const calorieText = document.getElementById('calorieNeedText');
            const sugarText = document.getElementById('sugarNeedText');
            const sodiumText = document.getElementById('sodiumNeedText');
            const adviceEl = document.getElementById('dailyNutritionAdvice');
            if (proteinText) proteinText.innerText = `${status.proteinNow} / ${status.targets.protein}g`;
            if (fiberText) fiberText.innerText = `${status.fiberNow} / ${status.targets.fiber}g`;
            if (waterText) waterText.innerText = `${status.waterNow} / ${status.targets.water}ml`;
            if (calorieText) calorieText.innerText = `${status.caloriesLeft} kcal`;
            if (sugarText) sugarText.innerText = status.sugarOver > 0 ? `超 ${status.sugarOver}g` : `${status.sugarNow} / ${status.targets.sugar}g`;
            if (sodiumText) sodiumText.innerText = status.sodiumOver > 0 ? `超 ${status.sodiumOver}mg` : `${status.sodiumNow} / ${status.targets.sodium}mg`;
            setMiniBar('proteinNeedBar', status.proteinNow, status.targets.protein);
            setMiniBar('fiberNeedBar', status.fiberNow, status.targets.fiber);
            setMiniBar('waterNeedBar', status.waterNow, status.targets.water);
            setMiniBar('calorieNeedBar', Math.max(0, Number(userData.targetCalories || 0) - status.caloriesLeft), Number(userData.targetCalories || 0));
            setMiniBar('sugarNeedBar', status.sugarNow, status.targets.sugar);
            setMiniBar('sodiumNeedBar', status.sodiumNow, status.targets.sodium);
            renderWaterRhythm(status);
            renderWaterReminderCard(status);
            renderTodayDecisionBrief(status);
            if (adviceEl) {
                const next = getNextMealSuggestion(new Date(), status.caloriesLeft, status);
                const historyContext = getP3HistoryContextLine(status);
                const sugarLine = status.sugarOver > 0 ? `糖超 ${status.sugarOver}g` : `糖還有 ${status.sugarLeft}g`;
                const sodiumLine = status.sodiumOver > 0 ? `鈉超 ${status.sodiumOver}mg` : `鈉還有 ${status.sodiumLeft}mg`;
                adviceEl.innerText = `${historyContext ? `${historyContext} ` : ""}今天已攝取蛋白質 ${status.proteinNow}g、纖維 ${status.fiberNow}g、水 ${status.waterNow}ml；還差蛋白質 ${status.proteinGap}g、纖維 ${status.fiberGap}g、水 ${status.waterGap}ml，${sugarLine}、${sodiumLine}。下一餐：${next.focus || "均衡"}。`;
            }
            return status;
        }

        function updateTataFoodState(status) {
            const aquarium = document.getElementById('tomaAquarium');
            const noteEl = document.getElementById('tataStateNote');
            const statePill = document.getElementById('tataFoodStatePill');
            const appearancePanel = document.getElementById('tataAppearancePanel');
            if (!aquarium || !status) return;
            aquarium.classList.remove('tata-glow', 'tata-beauty', 'tata-heavy', 'tata-sugary', 'tata-salty', 'tata-oily', 'tata-thirsty');
            let note = composeTataStateNote(
                "還在等今天第一餐，塔塔需要餐點照片或文字才能判斷狀態。",
                "先拍飯前照，系統會看熱量、蛋白質、纖維、水分、糖與鈉，再決定塔塔今天的外觀。"
            );
            let label = "今日狀態：等第一餐";
            let appearance = [
                { title: "外觀待命", body: "拍餐後開始變化" },
                { title: "番茄普通", body: "等今天第一筆" },
                { title: "身形穩定", body: "先看熱量缺口" }
            ];
            const proteinOk = status.proteinGap <= 8;
            const fiberOk = status.fiberGap <= 5;
            const waterOk = status.waterGap <= 500;
            const calorieRatio = userData.targetCalories ? userData.consumedCalories / userData.targetCalories : 0;
            const todayFlags = new Set((userData.dietRecords || []).flatMap(meal => meal.healthFlags || []));
            if (status.sugarOver > 0 || todayFlags.has('sugary')) {
                aquarium.classList.add('tata-sugary');
                label = "今日狀態：甜甜沉沉";
                note = composeTataStateNote(
                    `含糖飲或甜食偏多，糖分已超出 ${status.sugarOver || 0}g，塔塔會變得甜甜沉沉。`,
                    "下一餐改無糖飲，補一份蛋白質和青菜，先不要再加甜點。"
                );
                appearance = [
                    { title: "甜甜沉沉", body: "番茄變鮮紅" },
                    { title: "身形變圓", body: "糖分偏高" },
                    { title: "下一步", body: "無糖飲補水" }
                ];
            } else if (status.sodiumOver > 0 || todayFlags.has('high_sodium')) {
                aquarium.classList.add('tata-salty');
                label = "今日狀態：鹽鹽浮腫";
                note = composeTataStateNote(
                    `鈉含量偏高${status.sodiumOver > 0 ? `，已超出 ${status.sodiumOver}mg` : ""}，塔塔臉頰會看起來比較浮。`,
                    "先喝水，下一餐少醬、少湯底，湯可以吃料但不要全部喝完。"
                );
                appearance = [
                    { title: "臉頰浮腫", body: "腮紅變重" },
                    { title: "動作變慢", body: "鈉偏高" },
                    { title: "下一步", body: "少醬少湯底" }
                ];
            } else if (todayFlags.has('fried_or_high_fat')) {
                aquarium.classList.add('tata-oily');
                label = "今日狀態：油油慢速";
                note = composeTataStateNote(
                    "今天餐點油脂偏重，塔塔肚子會變沉、動作變慢。",
                    "下一餐選清湯、燙青菜、雞胸、魚、豆腐或蛋，主食抓半份到一份。"
                );
                appearance = [
                    { title: "肚肚變沉", body: "油脂偏重" },
                    { title: "呼吸變慢", body: "動畫放緩" },
                    { title: "下一步", body: "清湯青菜蛋白" }
                ];
            } else if (status.caloriesOver > 0 || calorieRatio > 1.1) {
                aquarium.classList.add('tata-heavy');
                label = "今日狀態：肚肚滿載";
                note = composeTataStateNote(
                    `今天熱量已超出 ${status.caloriesOver || Math.round(userData.consumedCalories - userData.targetCalories)} kcal，塔塔肚肚會跟著滿載。`,
                    "下一餐走清湯、青菜和低脂蛋白質，主食先半份，讓總量拉回來。"
                );
                appearance = [
                    { title: "肚肚滿載", body: "身形加寬" },
                    { title: "熱量超標", body: "先輕量收尾" },
                    { title: "下一步", body: "主食半份" }
                ];
            } else if (!waterOk) {
                aquarium.classList.add('tata-thirsty');
                label = "今日狀態：有點口渴";
                note = composeTataStateNote(
                    `今天水分還差 ${status.waterGap}ml，塔塔會先進入口渴狀態。`,
                    "先補 250ml 到 500ml 水，再決定下一餐，飽足感和判斷會更穩。"
                );
                appearance = [
                    { title: "有點口渴", body: "光澤降低" },
                    { title: "水分缺口", body: `還差 ${status.waterGap}ml` },
                    { title: "下一步", body: "先喝 250ml" }
                ];
            } else if (proteinOk && fiberOk && calorieRatio >= 0.45 && calorieRatio <= 1.02) {
                aquarium.classList.add('tata-glow', 'tata-beauty');
                label = "今日狀態：漂亮發光";
                note = composeTataStateNote(
                    `蛋白質只差 ${status.proteinGap}g、纖維只差 ${status.fiberGap}g，熱量也在目標範圍內。`,
                    "維持這個節奏，下一餐補缺口就好，塔塔會變得更漂亮。"
                );
                appearance = [
                    { title: "漂亮發光", body: "毛色變亮" },
                    { title: "番茄更甜", body: "節奏穩定" },
                    { title: "下一步", body: "照缺口微調" }
                ];
            } else if (status.fiberGap >= 10) {
                aquarium.classList.add('tata-salty');
                label = "今日狀態：纖維不足";
                note = composeTataStateNote(
                    `纖維還差 ${status.fiberGap}g，今天蔬菜、豆類或全穀類不太夠。`,
                    "下一餐優先加一份青菜、菇類、海帶或豆腐，讓塔塔的狀態回亮。"
                );
                appearance = [
                    { title: "亮度不足", body: "纖維偏低" },
                    { title: "番茄不夠甜", body: "蔬菜不足" },
                    { title: "下一步", body: "兩拳蔬菜" }
                ];
            }
            if (statePill) statePill.innerText = label;
            if (noteEl) noteEl.innerText = note;
            renderTataAppearancePanel(appearancePanel, appearance);
        }

        function renderTataAppearancePanel(panel, items) {
            if (!panel) return;
            panel.innerHTML = (items || []).map(item => `
                <div class="tata-appearance-chip">
                    <strong>${item.title}</strong>
                    <span>${item.body}</span>
                </div>
            `).join('');
            panel.classList.add('active');
        }

        function getDailyCoreSnapshot() {
            const storedMeals = currentUser ? getStoredMealsForDate(todayKeyDate()) : [];
            const meals = storedMeals.length ? storedMeals.map(meal => mealToDietRecord(meal, todayKeyDate())) : (Array.isArray(userData.dietRecords) ? userData.dietRecords : []);
            const status = getNutritionStatus();
            const water = Math.max(0, Math.round(Number(userData.waterMl || 0)));
            const todayWeight = currentUser ? localStorage.getItem(dailyKey('weight')) : "";
            const life = getLifeLogState();
            const lifeCount = [life.sleepHours, life.bowelState, life.energyState].filter(Boolean).length;
            const waitingAfter = meals.some(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter);
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft, status);
            const historyContext = getP3HistoryContextLine(status);
            const activePlan = hasActiveMealPlan() ? currentMealPlan : null;
            const askedMealDecision = Boolean(activePlan || localStorage.getItem(dailyKey('lastCoachQuestion')));
            const chips = [
                { key: "meal", label: "吃飯", value: meals.length ? `${meals.length} 餐` : "未拍", done: meals.length > 0, warn: waitingAfter },
                { key: "water", label: "喝水", value: `${water}ml`, done: water >= 1000, warn: water > 0 && water < 1000 },
                { key: "weight", label: "體重", value: todayWeight ? `${todayWeight}kg` : "未記", done: !!todayWeight },
                { key: "life", label: "生活", value: lifeCount ? `${lifeCount}/3` : "未記", done: lifeCount >= 2, warn: lifeCount === 1 },
                { key: "ask", label: "下一餐", value: askedMealDecision ? "已排" : "未問", done: askedMealDecision, warn: meals.length > 0 && !askedMealDecision }
            ];
            const completed = chips.filter(chip => chip.done).length;
            const completionText = completed >= 4 ? "今日很穩" : (completed >= 2 ? "節奏成形" : "先做一件");
            let next = { text: "先拍第一餐，塔塔才有今天的起點。", action: "openPhotoSourceSheet('before')", label: "拍照 / 選照片" };
            if (!meals.length) next = { text: historyContext || "先拍第一餐，塔塔會用最近紀錄幫你接下一餐。", action: "openPhotoSourceSheet('before')", label: "拍照 / 選照片" };
            else if (waitingAfter) next = { text: "最近一餐可以補飯後照，讓長期記憶更接近實際吃下。", action: "startLatestAfterPhoto(event)", label: "補飯後照" };
            else if (activePlan) next = { text: `已排好「${activePlan.foodName}」。到店或開飯前直接拍，塔塔會重新校正份量。`, action: "resumeCurrentMealPlan(event)", label: "繼續這餐" };
            else if (historyContext) next = { text: historyContext, action: "openMealDecisionCoach('等等吃什麼')", label: "問下一餐" };
            else if (status.fiberGap >= 8) next = { text: `塔塔看過今天 ${meals.length} 餐了。下一步：補纖維。`, action: "openMealDecisionCoach('下一餐補纖維')", label: "問下一餐" };
            else if (status.proteinGap >= 18) next = { text: `塔塔看過今天 ${meals.length} 餐了。下一步：補蛋白質。`, action: "openMealDecisionCoach('下一餐補蛋白質')", label: "問下一餐" };
            else next = { text: `今天已留下 ${meals.length} 餐。${advice.focus ? `下一餐先看 ${advice.focus}。` : "下一餐照今天缺口微調。"}`, action: "openMealDecisionCoach('等等吃什麼')", label: "問下一餐" };
            return { chips, next, completed, total: chips.length, completionText };
        }

        function renderLeanHomeCards(nutritionStatus = getNutritionStatus(), growth = updateOtterGrowth()) {
            const summaryEl = document.getElementById('homeTodaySummaryCard');
            const nextEl = document.getElementById('homeNextMealAdviceCard');
            const meals = Array.isArray(userData.dietRecords) ? userData.dietRecords : [];
            const total = meals.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0);
            const water = Math.max(0, Math.round(Number(userData.waterMl || 0)));
            const next = getNextMealSuggestion(new Date(), Math.max(0, Number(userData.targetCalories || 0) - total), nutritionStatus);
            const mood = Math.max(0, Math.min(100, Math.round(Number(growth?.score || 0))));
            const streak = Math.max(0, Math.round(Number(growth?.streak || userData.streakDays || 0)));
            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="home-lean-top">
                        <div class="home-lean-title">今日摘要</div>
                        <div class="home-lean-pill">${todayKeyDate()}</div>
                    </div>
                    <div class="home-lean-body">今天先看三件事：拍了幾餐、吃了多少、喝水有沒有跟上。</div>
                    <div class="home-lean-grid">
                        <div class="home-lean-stat"><strong>${meals.length}</strong><span>餐點</span></div>
                        <div class="home-lean-stat"><strong>${Math.round(total)}</strong><span>kcal</span></div>
                        <div class="home-lean-stat"><strong>${water}</strong><span>喝水 ml</span></div>
                    </div>
                `;
            }
            if (nextEl) {
                nextEl.innerHTML = `
                    <div class="home-lean-top">
                        <div class="home-lean-title">下一餐建議</div>
                        <div class="home-lean-pill">${next.focus || "均衡"}</div>
                    </div>
                    <div class="home-lean-body">${next.text || `下一餐抓 ${next.suggestedKcal || 450} kcal，先補蛋白質和蔬菜。`}</div>
                `;
            }
            const statePill = document.getElementById('tataFoodStatePill');
            const bubble = document.getElementById('tomaBubble');
            if (statePill) statePill.innerText = `心情 ${mood}/100 · 連續 ${streak} 天`;
            if (bubble) bubble.innerText = meals.length
                ? `塔塔看過今天 ${meals.length} 餐了。下一步：${next.focus || "照建議補缺口"}。`
                : "塔塔在等今天第一餐。先拍一張，後面我會幫你接下一餐建議。";
        }

        function renderLeanHomeCards(nutritionStatus = getNutritionStatus(), growth = updateOtterGrowth()) {
            const summaryEl = document.getElementById('homeTodaySummaryCard');
            const nextEl = document.getElementById('homeNextMealAdviceCard');
            const storedMeals = currentUser ? getStoredMealsForDate(todayKeyDate()) : [];
            const meals = storedMeals.length ? storedMeals.map(meal => mealToDietRecord(meal, todayKeyDate())) : (Array.isArray(userData.dietRecords) ? userData.dietRecords : []);
            const total = meals.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0);
            const water = Math.max(0, Math.round(Number(userData.waterMl || 0)));
            const next = getNextMealSuggestion(new Date(), Math.max(0, Number(userData.targetCalories || 0) - total), nutritionStatus);
            const historyContext = getP3HistoryContextLine(nutritionStatus);
            const proactiveGreeting = getP3ProactiveGreeting(new Date(), nutritionStatus);
            const mood = Math.max(0, Math.min(100, Math.round(Number(growth?.score || 0))));
            const streak = Math.max(0, Math.round(Number(growth?.streak || userData.streakDays || 0)));
            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="home-lean-top">
                        <div class="home-lean-title">今日摘要</div>
                        <div class="home-lean-pill">${todayKeyDate()}</div>
                    </div>
                    <div class="home-lean-body">塔塔已同步今天的餐點、熱量與喝水紀錄。</div>
                    <div class="home-lean-grid">
                        <div class="home-lean-stat"><strong>${meals.length}</strong><span>餐點</span></div>
                        <div class="home-lean-stat"><strong>${Math.round(total)}</strong><span>kcal</span></div>
                        <div class="home-lean-stat"><strong>${water}</strong><span>喝水 ml</span></div>
                    </div>
                `;
            }
            if (nextEl) {
                const nextText = historyContext ? `${historyContext} ${next.text || ""}` : (next.text || `下一餐約 ${next.suggestedKcal || 450} kcal，先補蛋白質和蔬菜。`);
                nextEl.innerHTML = `
                    <div class="home-lean-top">
                        <div class="home-lean-title">下一餐建議</div>
                        <div class="home-lean-pill">${p2SafeText(next.focus || "均衡")}</div>
                    </div>
                    <div class="home-lean-body">${p2SafeText(nextText)}</div>
                `;
            }
            const statePill = document.getElementById('tataFoodStatePill');
            const bubble = document.getElementById('tomaBubble');
            if (statePill) statePill.innerText = `心情 ${mood}/100 · 連續 ${streak} 天`;
            if (bubble) bubble.innerText = proactiveGreeting;
            renderP3WeeklyReportCard();
        }

        function updateUI(isJustEaten) {
            let burnKcal = Math.round(userData.currentSteps * 0.04);
            let leftCalories = userData.targetCalories - userData.consumedCalories + burnKcal;
            if (leftCalories < 0) leftCalories = 0;
            let bmi = userData.currentWeight / ((userData.currentHeight/100) * (userData.currentHeight/100));

            const subTextEl = document.getElementById('exerciseSubText');
            if (userData.currentSteps > 0) { subTextEl.style.display = "block"; subTextEl.innerText = `已含今日步行消耗 +${burnKcal} kcal`; }
            else { subTextEl.style.display = "none"; }

            caloriesLeftDisplay.innerText = leftCalories;
            let progressRatio = userData.consumedCalories / userData.targetCalories;
            if (progressRatio > 0.8) progressRatio = 0.8;
            const offset = 266.4 - (progressRatio * 333);
            progressCircle.style.strokeDashoffset = offset;

            const consumedCard = document.getElementById('cardConsumed');
            const bmiCard = document.getElementById('cardBmi');
            const proteinCard = document.getElementById('cardProtein');
            const heightDisplay = document.getElementById('heightValueDisplay');
            const weightDisplay = document.getElementById('weightValueDisplay');
            if (consumedCard) consumedCard.innerHTML = `${userData.consumedCalories}<span>kcal</span>`;
            if (bmiCard) bmiCard.innerHTML = `${bmi.toFixed(1)}`;
            if (proteinCard) proteinCard.innerHTML = `${userData.totalProtein}<span>g</span>`;
            if (heightDisplay) heightDisplay.innerHTML = `${userData.currentHeight}<span style="font-size:12px; color:var(--color-muted); font-weight:500;"> cm</span>`;
            if (weightDisplay) weightDisplay.innerHTML = `${userData.currentWeight.toFixed(1)} <span style="font-size:12px; color:var(--color-muted); font-weight:500;">kg</span>`;
            const heightDirectInput = document.getElementById('heightDirectInput');
            const weightDirectInput = document.getElementById('weightDirectInput');
            const todayWeightQuickInput = document.getElementById('todayWeightQuickInput');
            if (heightDirectInput && document.activeElement !== heightDirectInput) heightDirectInput.value = Math.round(Number(userData.currentHeight || 170));
            if (weightDirectInput && document.activeElement !== weightDirectInput) weightDirectInput.value = Number(userData.currentWeight || 0).toFixed(1);
            if (todayWeightQuickInput && document.activeElement !== todayWeightQuickInput) todayWeightQuickInput.value = Number(userData.currentWeight || 0).toFixed(1);
            updateStepDisplay(userData.currentSteps);

            const growth = updateOtterGrowth();
            if (!isJustEaten) {
                const isDecayMode = document.getElementById('tomaAquarium')?.classList.contains('decay-mode');
                if (!isDecayMode) {
                    const stageBubble = OTTER_STAGES[growth.stage]?.bubble;
                    if (growth.streak >= 3 && stageBubble) tomaBubble.innerText = stageBubble;
                    else if(userData.selectedTone === 'fitness') tomaBubble.innerText = `嗨 ${currentUser}，今天我們守住蛋白質和活動量，讓訓練狀態在線。`;
                    else if(userData.selectedTone === 'maintain') tomaBubble.innerText = `嗨 ${currentUser}，今天不用大起大落，我會陪你維持份量、蛋白質和活動節奏。`;
                    else if(userData.selectedTone === 'healthy') tomaBubble.innerText = `你來啦 ${currentUser}。今天先把蛋白質、蔬菜、水分、糖和鈉顧好，健康習慣慢慢累積。`;
                    else if(userData.selectedTone === 'gain') tomaBubble.innerText = `你來啦 ${currentUser}。今天別吃太少，我會幫你確認熱量有沒有補到位。`;
                    else tomaBubble.innerText = `你來啦 ${currentUser}。今天先把餐點拍清楚，我陪你穩穩守住熱量赤字。`;
                }
            }

            // 🌟 修復 Bug 2：全繁體中文乾淨清洗，絕無英混雜字
            const nutritionStatus = renderNutritionSummary(leftCalories);
            renderInstallNudgeCard();
            renderDailyCoreCard();
            renderLeanHomeCards(nutritionStatus, growth);
            renderDailyThreeMealRhythmCard();
            renderDailyTableCard();
            renderCourseModeCard();
            renderMealPlanResumeCard();
            renderTodayMemoryPreviewCard();
            renderTataHomeSnapshot(nutritionStatus, growth);
            renderTataCarePulseCard(nutritionStatus, growth);
            renderTataProactiveCoachCard(nutritionStatus);
            renderTodayWaterQuickCard(nutritionStatus);
            renderTodayWeightQuickCard();
            renderTodayLifeQuickCard();
            renderMealOpenHabitCard();
            renderTodayRouteCard();
            renderTodayReturnMissionCard(nutritionStatus, growth);
            renderMealCountdownCard(nutritionStatus);
            renderLifeQuickLogSummary();
            renderPhotoPlaceMemoryCard();
            renderMealFlowCard();
            renderMealSpeedPromiseCard();
            renderBottomPhotoAction();
            renderTomorrowMealPromiseCard();
            renderMealStreakCard();
            renderDataHealthCard();
            renderBodyRhythmCard(nutritionStatus);
            renderMealDecisionPathCard(nutritionStatus);
            renderDailyMissions(nutritionStatus);
            updateTataFoodState(nutritionStatus);
            renderTataFeedCard(nutritionStatus, growth);
            renderTataShareCard(nutritionStatus, growth);
            renderTataLevelQuest(nutritionStatus, growth);
            renderTataGrowthCoach(nutritionStatus, growth);
            renderTomorrowGrowthPlan(nutritionStatus, growth);
            const historyList = document.getElementById('dietHistory');
            if (!historyList) {
                renderTodayDiarySummary();
                renderTrendSummary();
                return;
            }
            if (userData.dietRecords.length === 0) {
                historyList.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--color-muted); font-size: 13px;">今天還沒有美食紀錄唷，隨手拍下第一餐吧。</div>`;
            } else {
                historyList.innerHTML = userData.dietRecords.map((r, index) => renderHistoryItem(r, index)).join('');
            }
            renderTodayDiarySummary();
            renderTrendSummary();
        }

        function renderTodayDiarySummary() {
            const dateEl = document.getElementById('todayDiaryDate');
            const summaryEl = document.getElementById('todayDiarySummary');
            const dashboardEl = document.getElementById('todayDashboard');
            const actionTimelineEl = document.getElementById('todayActionTimeline');
            const photoBriefEl = document.getElementById('todayPhotoBrief');
            const mealLedgerEl = document.getElementById('todayMealLedger');
            const recapEl = document.getElementById('todayRecapCard');
            const nextPlanEl = document.getElementById('nextMealPlan');
            const memoryPhotoEl = document.getElementById('memoryPhotoTimeline');
            const slotsEl = document.getElementById('todayMealSlots');
            const slotDetailsEl = document.getElementById('todaySlotDetails');
            const savedFollowupEl = document.getElementById('todaySavedFollowupCard');
            const historyList = document.getElementById('dietHistory');
            if (!dateEl || !summaryEl) return;
            if (!memorySelectedDate) memorySelectedDate = todayKeyDate();
            const selectedDate = memorySelectedDate;
            const isToday = selectedDate === todayKeyDate();
            const dateObj = new Date(`${selectedDate}T00:00:00`);
            dateEl.innerText = dateObj.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
            const meals = getMealsForDate(selectedDate);
            memoryRenderedRecords = meals;
            const total = meals.reduce((sum, meal) => sum + Number(meal.kcal || 0), 0);
            const protein = meals.reduce((sum, meal) => sum + Number(meal.protein || 0), 0);
            const fiber = meals.reduce((sum, meal) => sum + Number(meal.fiber || 0), 0);
            const sugar = meals.reduce((sum, meal) => sum + Number(meal.sugar || 0), 0);
            const sodium = meals.reduce((sum, meal) => sum + Number(meal.sodium || 0), 0);
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore ? 1 : 0) + (meal.photoAfter ? 1 : (meal.photo && !meal.photoBefore ? 1 : 0)), 0);
            const stepsNow = isToday
                ? Math.max(0, Math.round(Number(userData.currentSteps || 0)))
                : Math.max(0, parseInt(localStorage.getItem(`paipachi:${currentUser}:steps:${selectedDate}`) || '0', 10) || 0);
            const stepBurn = Math.round(stepsNow * 0.04);
            const targets = getDailyNutritionTargets();
            const caloriesLeft = Math.max(0, Math.round((userData.targetCalories || 0) - total + stepBurn));
            const lifeAdvice = getLifeWellnessAdvice(selectedDate);
            const lifeLabels = getLifeMemoryLabels(lifeAdvice.state);
            const lifeTail = lifeAdvice.summary ? ` ${lifeAdvice.summary}` : "";
            const status = {
                targets,
                caloriesLeft,
                sugarLeft: Math.max(0, targets.sugar - sugar),
                sugarOver: Math.max(0, sugar - targets.sugar),
                sodiumLeft: Math.max(0, targets.sodium - sodium),
                sodiumOver: Math.max(0, sodium - targets.sodium)
            };
            const slotNames = ["早餐", "午餐", "點心", "晚餐"];
            const slotRows = slotNames.map(slot => {
                const slotMeals = meals.filter(meal => (meal.mealSlot || "餐點") === slot);
                const slotKcal = slotMeals.reduce((sum, meal) => sum + Number(meal.kcal || 0), 0);
                return { slot, count: slotMeals.length, kcal: slotKcal };
            });
            const slots = slotRows.filter(row => row.count).map(row => `${row.slot} ${row.kcal} kcal`).join('｜');
            summaryEl.innerText = meals.length
                ? `${isToday ? '今日' : '這天'} ${meals.length} 筆餐點，${photoCount} 張照片，共 ${total} kcal。蛋白質 ${protein}g、纖維 ${fiber}g、糖 ${sugar}g、鈉 ${sodium}mg。${slots}${lifeTail}`
                : `${isToday ? '今天' : '這天'}尚未建立餐點明細。${lifeTail}`;
            renderMemorySearchPanel();
            renderTodayLifeMemoryCard(selectedDate);
            renderPersonalDietMemoryCard(selectedDate);
            renderPlaceMemoryPassportCard();
            renderPlaceMemoryHealthCard();
            renderPlaceRevisitList();
            if (dashboardEl) {
                const sugarWarn = status.sugarOver > 0;
                const sodiumWarn = status.sodiumOver > 0;
                dashboardEl.innerHTML = [
                    { label: "今日總熱量", value: `${total} kcal`, warn: total > userData.targetCalories },
                    { label: "步行消耗", value: `${stepBurn} kcal`, warn: false },
                    { label: "餐點照片", value: `${photoCount} 張`, warn: false },
                    { label: "睡眠", value: lifeLabels.sleepText, warn: lifeLabels.sleepWarn },
                    { label: "排便", value: lifeLabels.bowelText, warn: lifeLabels.bowelWarn },
                    { label: "活力", value: lifeLabels.energyText, warn: lifeLabels.energyWarn },
                    { label: "糖額度", value: sugarWarn ? `超 ${status.sugarOver}g` : `剩 ${status.sugarLeft}g`, warn: sugarWarn },
                    { label: "鈉額度", value: sodiumWarn ? `超 ${status.sodiumOver}mg` : `剩 ${status.sodiumLeft}mg`, warn: sodiumWarn }
                ].map(card => `<div class="today-metric-card${card.warn ? ' warn' : ''}"><div class="label">${card.label}</div><div class="value">${card.value}</div></div>`).join('');
            }
            renderTodayPhotoBrief(photoBriefEl, {
                meals,
                total,
                photoCount,
                isToday
            });
            renderTodayActionTimeline(actionTimelineEl, {
                meals,
                total,
                protein,
                fiber,
                photoCount,
                caloriesLeft,
                stepBurn,
                isToday
            });
            renderTodayMealLedger(mealLedgerEl, meals, { total, photoCount, isToday, dateKey: selectedDate });
            renderTodaySavedFollowup(savedFollowupEl, meals, isToday);
            renderTodayRecapCard(recapEl, {
                meals,
                total,
                protein,
                fiber,
                sugar,
                sodium,
                photoCount,
                stepBurn,
                caloriesLeft,
                targets,
                isToday
            });
            if (nextPlanEl) {
                if (isToday) {
                    const next = getNextMealSuggestion(new Date(), status.caloriesLeft);
                    nextPlanEl.innerHTML = renderNextMealDecisionPanel(next, meals.length > 0);
                } else {
                    const lastAdvice = [...meals].reverse().find(meal => meal.nextAdvice)?.nextAdvice || "";
                    nextPlanEl.innerHTML = `
                        <div class="next-meal-plan-top">
                            <div class="next-meal-plan-title">這天的餐後回憶</div>
                            <div class="next-meal-plan-time">${photoCount} 張照片</div>
                        </div>
                        <div class="next-meal-plan-body">${lastAdvice ? shortNextAdvice(lastAdvice) : '這天沒有留下餐後建議，但照片和營養明細都會保留在下方。'}</div>
                        <div class="next-meal-plan-focus">${total} kcal</div>
                    `;
                }
            }
            renderMemoryPhotoTimeline(memoryPhotoEl, meals, isToday);
            if (slotsEl) {
                slotsEl.innerHTML = slotRows.map(row => `<div class="meal-slot-pill${row.count ? ' filled' : ''}">${row.slot} · ${row.count ? `${row.kcal} kcal` : '未記錄'}</div>`).join('');
            }
            if (slotDetailsEl) {
                slotDetailsEl.innerHTML = slotRows.map(row => renderTodaySlotDetail(row.slot, meals, isToday)).join('');
            }
            if (historyList) {
                historyList.innerHTML = meals.length
                    ? meals.map((r, index) => renderHistoryItem(r, index)).join('')
                    : `<div style="text-align: center; padding: 20px; color: var(--color-muted); font-size: 13px;">${isToday ? '今天還沒有美食紀錄唷，隨手拍下第一餐吧。' : '這天沒有照片回憶。'}</div>`;
            }
        }

        function renderTodayActionTimeline(card, data = {}) {
            if (!card) return;
            const meals = Array.isArray(data.meals) ? data.meals : [];
            const isToday = data.isToday;
            const beforeCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0), 0);
            const afterCount = meals.reduce((sum, meal) => sum + (meal.photoAfter ? 1 : 0), 0);
            const waitingAfter = isToday ? meals.filter(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter).length : 0;
            const waterNow = Math.max(0, Math.round(Number(userData.waterMl || 0)));
            const waterTarget = Math.max(1500, Number(getDailyNutritionTargets().water || DAILY_GUIDELINES.waterMl || 2000));
            const status = getNutritionStatus();
            const biggestGap = status.proteinGap >= 18 ? `蛋白質還差 ${status.proteinGap}g`
                : (status.fiberGap >= 8 ? `纖維還差 ${status.fiberGap}g`
                : (status.waterGap >= 500 ? `水分還差 ${status.waterGap}ml`
                : (status.sodiumOver > 0 ? `鈉超 ${status.sodiumOver}mg` : "節奏穩定")));
            const steps = [
                {
                    title: "開飯前先拍",
                    body: beforeCount ? `今天已留下 ${beforeCount} 張飯前/餐點照片。` : "拍第一餐，塔塔才知道今天怎麼幫你控卡。",
                    done: beforeCount > 0,
                    current: beforeCount === 0
                },
                {
                    title: "吃完可補拍",
                    body: waitingAfter ? `還有 ${waitingAfter} 餐可補飯後照，能讓實際吃下更準。` : (afterCount ? `已有 ${afterCount} 張飯後照。` : "飯後補拍不強制，但會讓回憶更完整。"),
                    done: afterCount > 0 || (beforeCount > 0 && waitingAfter === 0),
                    current: waitingAfter > 0
                },
                {
                    title: "補水或步行",
                    body: waterNow >= waterTarget ? `喝水 ${waterNow}ml，今天水分很穩。` : `目前 ${waterNow}ml / ${waterTarget}ml，可先補一杯水。`,
                    done: waterNow >= waterTarget,
                    current: beforeCount > 0 && waitingAfter === 0 && waterNow < waterTarget
                },
                {
                    title: "問下一餐怎麼吃",
                    body: meals.length ? `塔塔會依 ${biggestGap} 給下一餐建議。` : "第一餐後，這裡會變成下一餐決策入口。",
                    done: meals.length > 0 && data.caloriesLeft >= 0,
                    current: meals.length > 0 && waitingAfter === 0
                }
            ];
            let primaryAction = { label: "拍第一餐飯前照", action: "openPhotoPicker('before')" };
            if (!isToday) primaryAction = { label: "回到今天繼續", action: "setMemoryDateToday()" };
            else if (beforeCount === 0) primaryAction = { label: "現在拍飯前照", action: "openPhotoPicker('before')" };
            else if (waitingAfter > 0) primaryAction = { label: "補拍最近飯後照", action: "startLatestAfterPhoto(event)" };
            else if (waterNow < waterTarget) primaryAction = { label: "先補 250ml 水", action: "addWater(250)" };
            else primaryAction = { label: "問塔塔下一餐", action: "askTataCoach('等等吃什麼')" };
            const secondaryAction = isToday
                ? { label: "拍下一餐", action: "openPhotoPicker('before')" }
                : { label: "看今天", action: "setMemoryDateToday()" };
            const meta = isToday ? `${meals.length} 餐 · ${data.photoCount || 0} 張照片` : "歷史回顧";
            const body = isToday
                ? (meals.length ? `今天已記 ${data.total || 0} kcal，步行抵扣約 ${data.stepBurn || 0} kcal。下一步：${primaryAction.label}。` : "今天的第一步很簡單：開飯前拍一張，照片、熱量和餐別會自動進明細。")
                : `這是歷史日期。照片與熱量會保存，繼續記錄請回到今天。`;
            card.classList.toggle('past', !isToday);
            card.innerHTML = `
                <div class="today-action-top">
                    <div class="today-action-title">${isToday ? '今天吃飯流程' : '這天吃飯流程'}</div>
                    <div class="today-action-meta">${meta}</div>
                </div>
                <div class="today-action-body">${body}</div>
                <div class="today-action-steps">
                    ${steps.map((step, index) => `
                        <div class="today-action-step${step.done ? ' done' : ''}${step.current ? ' current' : ''}">
                            <div class="today-action-step-num">${step.done ? '✓' : index + 1}</div>
                            <div class="today-action-step-copy"><strong>${step.title}</strong><span>${step.body}</span></div>
                            <div class="today-action-step-status">${step.done ? '完成' : (step.current ? '現在' : '待辦')}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="today-action-actions">
                    <button class="today-action-btn primary" type="button" onclick="${primaryAction.action}">${primaryAction.label}</button>
                    <button class="today-action-btn" type="button" onclick="${secondaryAction.action}">${secondaryAction.label}</button>
                </div>
            `;
        }

        function renderTodayPhotoBrief(card, data) {
            if (!card || !data) return;
            const meals = data.meals || [];
            const beforeCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0), 0);
            const afterCount = meals.reduce((sum, meal) => sum + (meal.photoAfter ? 1 : 0), 0);
            const pairedCount = meals.filter(meal => (meal.photoBefore || meal.photo) && meal.photoAfter).length;
            const waitingAfter = data.isToday ? meals.filter(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter).length : 0;
            const lastMeal = [...meals].reverse().find(meal => meal.photoBefore || meal.photo || meal.photoAfter);
            const nextAction = waitingAfter > 0 ? "補拍最近一餐飯後照" : "拍下一餐飯前照";
            const action = waitingAfter > 0 ? "startLatestAfterPhoto(event)" : "openPhotoPicker('before')";
            if (!meals.length && !data.photoCount) {
                card.classList.add('active');
                card.innerHTML = `
                    <div class="today-photo-brief-top">
                        <div class="today-photo-brief-title">今日照片總覽</div>
                        <div class="today-photo-brief-meta">等第一張</div>
                    </div>
                    <div class="today-photo-brief-body">${data.isToday ? '吃飯前拍第一張，這裡會自動整理餐別、照片狀態和熱量，之後可以回看每一天。' : '這天沒有留下餐點照片。'}</div>
                    ${data.isToday ? '<button class="today-photo-brief-action" type="button" onclick="openPhotoPicker(\'before\')">拍第一張飯前照</button>' : ''}
                `;
                return;
            }
            const latestText = lastMeal
                ? `${lastMeal.mealSlot || '餐點'} · ${lastMeal.name || '餐點照片'}`
                : "尚未拍照";
            card.classList.add('active');
            card.innerHTML = `
                <div class="today-photo-brief-top">
                    <div class="today-photo-brief-title">${data.isToday ? '今日照片總覽' : '這天照片回顧'}</div>
                    <div class="today-photo-brief-meta">${data.photoCount || 0} 張 · ${data.total || 0} kcal</div>
                </div>
                <div class="today-photo-brief-body">最新：${latestText}。${pairedCount ? `已有 ${pairedCount} 餐完成前後比對。` : '飯後補拍不是強制，但能讓估算更接近實際吃下。'}${waitingAfter ? ` 還有 ${waitingAfter} 餐可補飯後照。` : ''}</div>
                <div class="today-photo-brief-grid">
                    <div class="today-photo-brief-stat"><strong>${beforeCount}</strong><span>飯前/餐點</span></div>
                    <div class="today-photo-brief-stat"><strong>${afterCount}</strong><span>飯後照</span></div>
                    <div class="today-photo-brief-stat"><strong>${pairedCount}</strong><span>前後比對</span></div>
                    <div class="today-photo-brief-stat"><strong>${waitingAfter}</strong><span>待補拍</span></div>
                </div>
                ${data.isToday ? `<button class="today-photo-brief-action" type="button" onclick="${action}">${nextAction}</button>` : ''}
            `;
        }

        function getMealDisplayTime(meal) {
            if (meal?.time) return String(meal.time).slice(0, 5);
            const raw = meal?.capturedAt || meal?.createdAt || meal?.date || "";
            if (raw) {
                const parsed = new Date(raw);
                if (!Number.isNaN(parsed.getTime())) {
                    return parsed.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
                }
            }
            return "--:--";
        }

        function renderTodayMealLedger(card, meals = [], data = {}) {
            if (!card) return;
            const ledgerDateKey = data.dateKey || memorySelectedDate || todayKeyDate();
            const sorted = [...(meals || [])].sort((a, b) => {
                const aTime = new Date(a.capturedAt || a.createdAt || `${a.date || todayKeyDate()}T${a.time || '23:59'}`).getTime();
                const bTime = new Date(b.capturedAt || b.createdAt || `${b.date || todayKeyDate()}T${b.time || '23:59'}`).getTime();
                return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
            });
            if (!sorted.length) {
                card.innerHTML = `
                    <div class="today-meal-ledger-top">
                        <div class="today-meal-ledger-title">${data.isToday ? '今日吃飯明細' : '這天吃飯明細'}</div>
                        <div class="today-meal-ledger-meta">0 筆</div>
                    </div>
                    <div class="today-meal-ledger-empty">${data.isToday ? '先拍飯前照，這裡會照時間自動整理早餐、午餐、點心與晚餐。' : '這天沒有留下餐點明細。'}</div>
                `;
                return;
            }
            const rows = sorted.map((meal) => {
                const originalIndex = meals.indexOf(meal);
                const hasBefore = Boolean(meal.photoBefore || meal.photo);
                const hasAfter = Boolean(meal.photoAfter);
                const status = hasBefore && hasAfter ? "已前後比對" : (hasBefore ? "待補飯後照" : (hasAfter ? "飯後照保存" : "無照片"));
                const slot = meal.mealSlot || getMealSlot(new Date(meal.capturedAt || Date.now()));
                const macro = `蛋白 ${meal.protein || 0}g · 纖維 ${meal.fiber || 0}g · 糖 ${meal.sugar || 0}g`;
                const placeText = formatPlaceMemory(meal);
                const decisionMemory = getMealDecisionMemory(meal);
                const mealId = meal.id || "";
                const isFocused = mealId && mealId === lastSavedMealFocusId;
                const todoClass = hasBefore && !hasAfter && data.isToday ? " todo" : "";
                const actionTag = hasBefore && !hasAfter && data.isToday
                    ? `<span class="today-meal-ledger-tag todo">可補飯後</span>`
                    : `<span class="today-meal-ledger-tag${hasAfter ? ' done' : ''}">${status}</span>`;
                const focusTag = isFocused ? '<span class="today-meal-ledger-tag focus">剛剛更新</span>' : '';
                const statusNote = isFocused
                    ? (hasBefore && hasAfter ? '這餐已完成飯前/飯後照片，之後可以回來看前後回憶。' : (hasBefore ? '這餐已進今日明細，吃完可以補飯後照，不強制。' : '這餐已保存到今天回憶。'))
                    : '';
                const placeAction = mealId
                    ? `<button class="today-meal-place-action" type="button" onclick="return editMealPlaceMemory('${mealId}', '${ledgerDateKey}', event)">${placeText ? '編輯店家記憶' : '補店名/評分'}</button>`
                    : '';
                const mapAction = mealId && placeText
                    ? `<button class="today-meal-place-action map" type="button" onclick="return openMealPlaceMap('${mealId}', '${ledgerDateKey}', event)">開地圖</button>`
                    : '';
                const revisitAction = mealId && placeText
                    ? `<button class="today-meal-place-action revisit" type="button" onclick="return selectMealRevisitPlan('${mealId}', '${ledgerDateKey}', event)">照這餐再吃</button>`
                    : '';
                const afterPhotoAction = hasBefore && !hasAfter && data.isToday
                    ? `<button class="today-meal-after-action" type="button" onclick="return startAfterPhotoForMeal(${Math.max(0, originalIndex)}, event)">補這餐飯後照</button>`
                    : '';
                return `
                    <div class="today-meal-ledger-row${isFocused ? ' focus' : ''}" role="button" tabindex="0" data-meal-id="${mealId}" onclick="openMealPhoto(${Math.max(0, originalIndex)})" onkeydown="if(event.key==='Enter'){openMealPhoto(${Math.max(0, originalIndex)})}">
                        <div class="today-meal-ledger-time">${getMealDisplayTime(meal)}</div>
                        <div>
                            <div class="today-meal-ledger-name">${meal.name || '餐點紀錄'}</div>
                            <div class="today-meal-ledger-sub">${slot} · ${macro}</div>
                            ${decisionMemory ? `<div class="today-meal-ledger-note">塔塔決策：${decisionMemory.title} · ${decisionMemory.focus}${decisionMemory.why ? `。${decisionMemory.why}` : ''}</div>` : ''}
                            ${placeText ? `<div class="place-memory-line"><strong>${placeText}</strong></div>` : ''}
                            <div class="today-meal-ledger-tags">
                                ${focusTag}
                                ${actionTag}
                                <span class="today-meal-ledger-tag">${hasBefore ? '有飯前照' : '未拍飯前'}</span>
                                <span class="today-meal-ledger-tag${hasAfter ? ' done' : todoClass}">${hasAfter ? '有飯後照' : '未補飯後'}</span>
                            </div>
                            ${statusNote ? `<div class="today-meal-ledger-note">${statusNote}</div>` : ''}
                            ${afterPhotoAction}
                            ${placeAction}${mapAction}${revisitAction}
                        </div>
                        <div class="today-meal-ledger-kcal">${meal.kcal || meal.calories || 0} kcal</div>
                    </div>
                `;
            }).join('');
            const waitingAfter = sorted.filter(meal => (meal.photoBefore || meal.photo) && !meal.photoAfter).length;
            const quickActions = data.isToday ? `
                <div class="today-meal-ledger-actions" aria-label="今日吃飯快捷">
                    <button class="today-meal-ledger-action primary" type="button" onclick="${waitingAfter ? "startLatestAfterPhoto(event)" : "openPhotoSourceSheet('before')"}">${waitingAfter ? '補最近飯後' : '拍下一餐'}</button>
                    <button class="today-meal-ledger-action" type="button" onclick="openMealDecisionCoach('等等吃什麼')">問吃什麼</button>
                    <button class="today-meal-ledger-action" type="button" onclick="focusTodayWaterQuick()">記喝水</button>
                </div>
            ` : "";
            card.innerHTML = `
                <div class="today-meal-ledger-top">
                    <div class="today-meal-ledger-title">${data.isToday ? '今日吃飯明細' : '這天吃飯明細'}</div>
                    <div class="today-meal-ledger-meta">${sorted.length} 筆 · ${data.photoCount || 0} 張 · ${data.total || 0} kcal</div>
                </div>
                ${quickActions}
                <div class="today-meal-ledger-list">${rows}</div>
                ${data.isToday && waitingAfter ? `<button class="today-photo-brief-action" style="margin-top:10px;" type="button" onclick="startLatestAfterPhoto(event)">補拍最近一餐飯後照</button>` : ''}
            `;
        }

        function getMealThumb(meal = {}) {
            return meal.photo || meal.photoBefore || meal.photoAfter || "";
        }

        function deleteTodayMeal(mealId = "", event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (!currentUser || !mealId) return false;
            const key = dailyKey('meals');
            const meals = safeJsonArray(localStorage.getItem(key));
            const nextMeals = meals.filter(meal => meal.id !== mealId);
            if (nextMeals.length === meals.length) {
                showToast("找不到這筆餐點，請重新整理。");
                return false;
            }
            localStorage.setItem(key, JSON.stringify(nextMeals));
            loadDailyStores();
            saveToStorage();
            updateUI(false);
            renderTodayDiarySummary();
            syncRemoteMealsForDate(todayKeyDate());
            showToast("已刪除這筆餐點，今日摘要已更新。");
            return false;
        }

        function renderTodayMealLedger(card, meals = [], data = {}) {
            if (!card) return;
            const ledgerDateKey = data.dateKey || memorySelectedDate || todayKeyDate();
            const isToday = data.isToday !== false && ledgerDateKey === todayKeyDate();
            const sorted = [...(meals || [])].sort((a, b) => {
                const aTime = new Date(a.capturedAt || a.createdAt || `${ledgerDateKey}T${a.time || "00:00"}`).getTime();
                const bTime = new Date(b.capturedAt || b.createdAt || `${ledgerDateKey}T${b.time || "00:00"}`).getTime();
                return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
            });
            const total = Math.round(sorted.reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0));
            const protein = Math.round(sorted.reduce((sum, meal) => sum + Number(meal.protein || 0), 0));
            const fiber = Math.round(sorted.reduce((sum, meal) => sum + Number(meal.fiber || 0), 0));
            if (!sorted.length) {
                card.innerHTML = `
                    <div class="today-meal-ledger-top">
                        <div class="today-meal-ledger-title">${isToday ? "今天吃了什麼" : "這天吃了什麼"}</div>
                        <div class="today-meal-ledger-meta">0 餐</div>
                    </div>
                    <div class="today-meal-ledger-empty">${isToday ? "今天還沒有餐點。拍第一餐後，這裡會自動列出照片、熱量和營養素。" : "這天沒有餐點紀錄。"}</div>
                    ${isToday ? `<div class="today-meal-ledger-actions"><button class="today-meal-ledger-action primary" type="button" onclick="openPhotoSourceSheet('before')">拍第一餐</button><button class="today-meal-ledger-action" type="button" onclick="openMealDecisionCoach('等等吃什麼')">問下一餐</button><button class="today-meal-ledger-action" type="button" onclick="focusTodayWaterQuick()">記喝水</button></div>` : ""}
                `;
                return;
            }
            const rows = sorted.map((meal) => {
                const originalIndex = meals.indexOf(meal);
                const mealId = meal.id || "";
                const thumb = getMealThumb(meal);
                const slot = meal.mealSlot || getMealSlot(new Date(meal.capturedAt || meal.createdAt || Date.now()));
                const kcal = Math.round(Number(meal.kcal || meal.calories || 0));
                const p = Math.round(Number(meal.protein || 0));
                const c = Math.round(Number(meal.carbs || 0));
                const f = Math.round(Number(meal.fat || 0));
                const fi = Math.round(Number(meal.fiber || 0));
                const source = getEstimateSourceLabel(meal.source || "manual");
                const safeId = p2SafeText(mealId);
                return `
                    <details class="today-meal-ledger-row p2-ledger-row" data-meal-id="${safeId}">
                        <summary>
                            <div class="today-meal-ledger-thumb">${thumb ? `<img src="${p2SafeText(thumb)}" alt="">` : `<span>${p2SafeText(slot.slice(0, 1) || "餐")}</span>`}</div>
                            <div class="today-meal-ledger-main">
                                <div class="today-meal-ledger-name">${p2SafeText(meal.name || meal.finalName || "餐點")}</div>
                                <div class="today-meal-ledger-sub">${p2SafeText(slot)} · ${p2SafeText(getMealDisplayTime(meal))} · ${p2SafeText(source)}</div>
                            </div>
                            <div class="today-meal-ledger-kcal">${kcal} kcal</div>
                        </summary>
                        <div class="today-meal-ledger-detail">
                            <div class="today-meal-ledger-tags">
                                <span class="today-meal-ledger-tag">蛋白質 ${p}g</span>
                                <span class="today-meal-ledger-tag">碳水 ${c}g</span>
                                <span class="today-meal-ledger-tag">脂肪 ${f}g</span>
                                <span class="today-meal-ledger-tag">纖維 ${fi}g</span>
                            </div>
                            <div class="today-meal-ledger-note">${p2SafeText(meal.nextAdvice || "儲存成功，下一餐建議會依今日總量即時更新。")}</div>
                            <div class="today-meal-ledger-detail-actions">
                                <button class="today-meal-ledger-action" type="button" onclick="openMealPhoto(${Math.max(0, originalIndex)})">看照片</button>
                                ${isToday ? `<button class="today-meal-ledger-action danger" type="button" onclick="return deleteTodayMeal('${safeId}', event)">刪除</button>` : ""}
                            </div>
                        </div>
                    </details>
                `;
            }).join("");
            card.innerHTML = `
                <div class="today-meal-ledger-top">
                    <div class="today-meal-ledger-title">今天吃了什麼</div>
                    <div class="today-meal-ledger-meta">${sorted.length} 餐 · ${total} kcal</div>
                </div>
                <div class="today-meal-ledger-summary">
                    <span>蛋白質 ${protein}g</span>
                    <span>纖維 ${fiber}g</span>
                    <span>${ledgerDateKey}</span>
                </div>
                ${isToday ? `<div class="today-meal-ledger-actions"><button class="today-meal-ledger-action primary" type="button" onclick="openPhotoSourceSheet('before')">拍下一餐</button><button class="today-meal-ledger-action" type="button" onclick="openMealDecisionCoach('等等吃什麼')">問下一餐</button><button class="today-meal-ledger-action" type="button" onclick="focusTodayWaterQuick()">記喝水</button></div>` : ""}
                <div class="today-meal-ledger-list">${rows}</div>
            `;
        }

        function getTodayCalorieBudgetSnapshot(meals = userData.dietRecords || []) {
            const total = (meals || []).reduce((sum, meal) => sum + Number(meal.kcal || meal.calories || 0), 0);
            const stepBurn = Math.round(Math.max(0, Number(userData.currentSteps || 0)) * 0.04);
            const target = Math.max(0, Math.round(Number(userData.targetCalories || 0)));
            const left = Math.max(0, Math.round(target - total + stepBurn));
            const over = Math.max(0, Math.round(total - target - stepBurn));
            const nextBudget = Math.max(220, Math.min(750, left || 450));
            return { total: Math.round(total), stepBurn, target, left, over, nextBudget };
        }

        function getSavedMealNutritionCoach(meal = {}, budget = getTodayCalorieBudgetSnapshot(), next = getNextMealSuggestion()) {
            const kcal = Math.round(Number(meal.kcal || meal.calories || 0));
            const protein = Math.round(Number(meal.protein || 0));
            const carbs = Math.round(Number(meal.carbs || meal.carb || 0));
            const fat = Math.round(Number(meal.fat || 0));
            const fiber = Math.round(Number(meal.fiber || 0));
            const sodium = Math.round(Number(meal.sodium || 0));
            const goal = userData.selectedTone || "slim";
            const status = next.status || getNutritionStatus(budget.left);
            const target = Math.max(1, Number(userData.targetCalories || 0));
            const proteinGood = protein >= 25 || protein >= Math.round(status.targets.protein * 0.35);
            const fiberGood = fiber >= 6;
            const kcalHeavy = kcal > Math.max(650, target * 0.42);
            const kcalLight = kcal > 0 && kcal < 280;
            const score = Math.max(45, Math.min(96,
                78
                + (proteinGood ? 8 : -8)
                + (fiberGood ? 6 : -6)
                - (kcalHeavy ? 12 : 0)
                - (budget.over ? 8 : 0)
                - (fat >= 35 ? 4 : 0)
            ));
            const good = proteinGood
                ? `蛋白質 ${protein}g 有幫到今天目標`
                : (fiberGood ? `纖維 ${fiber}g 有補到飽足感` : `已完成拍照和熱量記錄，這是最重要的一步`);
            const gap = budget.over
                ? `今天熱量已超出 ${budget.over} kcal`
                : (!proteinGood ? `蛋白質還要補，今天剩 ${Math.max(0, status.proteinGap)}g`
                : (!fiberGood ? `纖維偏少，今天剩 ${Math.max(0, status.fiberGap)}g`
                : (kcalLight ? `這餐偏輕，等等可能會餓` : `下一餐照 ${next.focus} 微調就好`)));
            let title = "塔塔營養師建議";
            let body = `本餐評分 ${score}/100。已估 ${kcal || 0} kcal，蛋白質 ${protein}g、碳水 ${carbs}g、脂肪 ${fat}g、纖維 ${fiber}g。優點：${good}。不足：${gap}。`;
            if (goal === "fitness") {
                title = "增肌建議";
                body += protein >= 30
                    ? ` 蛋白質表現不錯，下一餐再補 ${Math.max(0, status.proteinGap)}g 蛋白質，今天更容易達標。`
                    : ` 蛋白質偏少，下一餐優先選雞肉、魚、蛋、豆腐或乳清，目標再補 25-35g。`;
            } else if (goal === "maintain") {
                title = "維持體態建議";
                body += budget.over
                    ? ` 今天已超出 ${budget.over} kcal，下一餐把主食和醬料收一點，但保留蛋白質，讓體重區間穩住。`
                    : ` 今天還有 ${budget.left} kcal 空間，下一餐維持一掌蛋白質、兩拳蔬菜、半到一拳主食，不用硬餓也不用硬補。`;
            } else if (goal === "healthy") {
                title = "健康飲食建議";
                body += !fiberGood
                    ? ` 下一餐先把青菜、菇類、豆類或全穀補上，讓纖維和飽足感回來。`
                    : (sodium > 900 || status.sodiumOver > 0)
                        ? ` 這餐鈉可能偏高，下一餐少醬少湯底，先喝水並補原型蔬菜。`
                        : ` 這餐節奏不錯，下一餐繼續守住蛋白質、蔬菜和無糖飲，讓健康習慣穩定累積。`;
            } else if (goal === "gain") {
                title = "健康增重建議";
                body += budget.left > 450
                    ? ` 今天還有 ${budget.left} kcal 空間，下一餐可以正常加主食和蛋白質，不要只靠甜飲補熱量。`
                    : ` 今天熱量接近目標，下一餐以蛋白質和好油脂收尾，避免只是多吃零食。`;
            } else {
                title = "減脂控卡建議";
                body += budget.over
                    ? ` 今天已超出 ${budget.over} kcal，下一餐走輕量蛋白質、蔬菜和飯後 15-20 分鐘步行。`
                    : ` 今天還剩 ${budget.left} kcal，下一餐抓 ${next.suggestedKcal || budget.nextBudget} kcal，先補 ${next.focus}。`;
            }
            const nextLine = `下一餐：${next.slot} ${next.time}，建議 ${next.food}。${getAvoidanceText(next.priority)}`;
            return { title, body, nextLine, score, good, gap };
        }

        function renderTodaySavedPlaceMemory(meal, dateKey = todayKeyDate()) {
            if (!meal || !meal.id) return "";
            const mealId = meal.id;
            const placeName = meal.placeName || meal.restaurantName || "";
            const rating = Number(meal.placeRating || 0);
            if (placeName) {
                return `
                    <div class="today-saved-place-memory">
                        <div class="today-saved-place-memory-title">這餐已變成可回訪記憶</div>
                        <div class="today-saved-place-memory-body">已記住「${placeName}」${rating ? `，評分 ${rating}/5` : "，評分可之後補"}。下次可以從相簿開地圖，或照這餐再吃但重新拍照校正份量。</div>
                        <div class="today-saved-place-memory-actions">
                            <button class="today-saved-place-memory-action primary" type="button" onclick="return openMealPlaceMap('${mealId}', '${dateKey}', event)">開地圖回訪</button>
                            <button class="today-saved-place-memory-action" type="button" onclick="return selectMealRevisitPlan('${mealId}', '${dateKey}', event)">照這餐再吃</button>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="today-saved-place-memory">
                    <div class="today-saved-place-memory-title">順手補店名，下次找得到</div>
                    <div class="today-saved-place-memory-body">選填 10 秒：店名、評分、下次備註。補了之後，這張照片會進你的個人飲食地圖，不只是今天的熱量紀錄。</div>
                    <div class="today-saved-place-memory-actions">
                        <button class="today-saved-place-memory-action primary" type="button" onclick="return openPlaceQuickEdit('${mealId}', '${dateKey}', event)">補店名/評分</button>
                        <button class="today-saved-place-memory-action" type="button" onclick="switchTabById('tab-diet')">稍後在相簿補</button>
                    </div>
                </div>
            `;
        }

        function renderTodaySavedFollowup(card, meals = [], isToday = true) {
            if (!card) return;
            const meal = isToday && lastSavedMealFocusId
                ? (meals || []).find(item => item.id === lastSavedMealFocusId)
                : null;
            if (!meal) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const mealIndex = (meals || []).indexOf(meal);
            const hasAfter = Boolean(meal.photoAfter);
            const canAfter = (meal.photoBefore || meal.photo) && !hasAfter;
            const budget = getTodayCalorieBudgetSnapshot(meals);
            const next = getNextMealSuggestion(new Date(), budget.left);
            const leftLabel = budget.over ? `超 ${budget.over}` : budget.left;
            const leftCaption = budget.over ? "今日超出 kcal" : "今日還能吃 kcal";
            const suggestedKcal = next.suggestedKcal || budget.nextBudget;
            const actionLabel = canAfter ? "補這餐飯後" : "問下一餐";
            const actionCall = canAfter ? `startAfterPhotoForMeal(${Math.max(0, mealIndex)}, event)` : "askTataCoach('等等吃什麼')";
            const coach = getSavedMealNutritionCoach(meal, budget, next);
            const body = canAfter
                ? `「${meal.name || '這餐'}」已進今天明細。吃完可以補飯後照，會回到同一餐校正，不會變成新紀錄。今天目前${budget.over ? `已超出 ${budget.over} kcal` : `還剩 ${budget.left} kcal`}，下一餐先抓 ${suggestedKcal} kcal 左右。`
                : `「${meal.name || '這餐'}」已完成保存。今天目前${budget.over ? `已超出 ${budget.over} kcal` : `還剩 ${budget.left} kcal`}，下一餐先抓 ${suggestedKcal} kcal 左右，塔塔會依蛋白質、纖維、糖和鈉的缺口幫你選。`;
            card.classList.add('active');
            card.innerHTML = `
                <div class="today-saved-followup-top">
                    <div class="today-saved-followup-title">剛剛這餐已存好</div>
                    <div class="today-saved-followup-meta">${meal.kcal || meal.calories || 0} kcal</div>
                </div>
                <div class="today-saved-followup-body">${body}</div>
                <div class="today-saved-followup-budget">
                    <div class="today-saved-followup-budget-item ${budget.over ? 'warn' : ''}">
                        <strong>${leftLabel}</strong>
                        <span>${leftCaption}</span>
                    </div>
                    <div class="today-saved-followup-budget-item">
                        <strong>${budget.total}</strong>
                        <span>已吃 kcal</span>
                    </div>
                    <div class="today-saved-followup-budget-item">
                        <strong>${suggestedKcal}</strong>
                        <span>下一餐預算</span>
                    </div>
                </div>
                <div class="post-meal-decision-bridge">
                    <div class="post-meal-decision-head">
                        <div class="post-meal-decision-title">${coach.title}</div>
                        <div class="post-meal-decision-meta">${getGoalLabel()}</div>
                    </div>
                    <div class="post-meal-decision-body">${coach.body}</div>
                    <div class="post-meal-decision-body">${coach.nextLine}</div>
                    <button class="post-meal-decision-btn primary" type="button" onclick="startPostMealRecommendedPlan()">幫我排下一餐，等等直接拍</button>
                </div>
                ${renderTodaySavedPlaceMemory(meal, todayKeyDate())}
                <div class="today-saved-followup-actions">
                    <button class="today-saved-followup-action primary" type="button" onclick="${actionCall}">${actionLabel}</button>
                    <button class="today-saved-followup-action" type="button" onclick="askTataCoach('等等吃什麼')">問下一餐</button>
                    <button class="today-saved-followup-action" type="button" onclick="setTomorrowFirstMealPromise()">約明天</button>
                </div>
            `;
        }

        function startLatestAfterPhoto(event) {
            if (event) event.stopPropagation();
            const sourceRecords = getTodayMealRecordsForAfterPhoto();
            for (let index = sourceRecords.length - 1; index >= 0; index--) {
                const meal = sourceRecords[index];
                if ((meal.photoBefore || meal.photo) && !meal.photoAfter) {
                    return startAfterPhotoForMeal(index, event);
                }
            }
            showToast("目前沒有需要補拍飯後照的餐，先拍下一餐飯前照。");
            openPhotoSourceSheet('before');
            return false;
        }

        function renderTodayRecapCard(card, data) {
            if (!card || !data) return;
            const proteinGap = Math.max(0, Math.round((data.targets?.protein || 0) - data.protein));
            const fiberGap = Math.max(0, Math.round((data.targets?.fiber || 0) - data.fiber));
            const calorieOver = Math.max(0, data.total - (userData.targetCalories || 0));
            const sugarOver = Math.max(0, data.sugar - (data.targets?.sugar || 0));
            const sodiumOver = Math.max(0, data.sodium - (data.targets?.sodium || 0));
            const warnings = [];
            if (calorieOver > 0) warnings.push(`熱量超 ${calorieOver} kcal`);
            if (sugarOver > 0) warnings.push(`糖超 ${sugarOver}g`);
            if (sodiumOver > 0) warnings.push(`鈉超 ${sodiumOver}mg`);
            if (proteinGap >= 15) warnings.push(`蛋白質差 ${proteinGap}g`);
            if (fiberGap >= 8) warnings.push(`纖維差 ${fiberGap}g`);
            const hasMeals = data.meals.length > 0;
            const title = hasMeals
                ? (warnings.length ? "今日總結：還有一點可以拉回來" : "今日總結：節奏很漂亮")
                : (data.isToday ? "今日總結：等第一餐照片" : "這天沒有留下餐點");
            const body = hasMeals
                ? `今天留下 ${data.meals.length} 筆餐點、${data.photoCount} 張照片，共 ${data.total} kcal，步行已抵扣約 ${data.stepBurn} kcal。${warnings.length ? "下一步先處理：" + warnings.slice(0, 2).join("、") + "。" : "熱量和營養節奏都在可控範圍，下一餐照缺口微調就好。"}`
                : (data.isToday ? "先拍飯前照，塔塔才有今天的照片、熱量和下一餐建議可以回顧。" : "這天沒有照片回憶；之後每餐照片都會留在這裡。");
            const tags = hasMeals
                ? [
                    `${data.meals.length} 筆餐點`,
                    `${data.photoCount} 張照片`,
                    data.caloriesLeft > 0 ? `剩 ${data.caloriesLeft} kcal` : "熱量已用完",
                    warnings[0] || "狀態穩"
                ]
                : ["尚未記錄", "先拍飯前照"];
            card.classList.toggle('warn', warnings.length > 0);
            card.innerHTML = `
                <div class="today-recap-title">${title}</div>
                <div class="today-recap-body">${body}</div>
                <div class="today-recap-tags">${tags.map(tag => `<span class="today-recap-tag">${tag}</span>`).join('')}</div>
                <div class="today-recap-actions">
                    <button class="today-recap-action primary" type="button" onclick="${hasMeals ? `shareDailyRecap('${memorySelectedDate || todayKeyDate()}')` : "openPhotoPicker('before')"}">${hasMeals ? '分享今日回憶' : '拍第一餐'}</button>
                    <button class="today-recap-action" type="button" onclick="askTataCoach('等等吃什麼')">問下一餐</button>
                </div>
            `;
        }

        function shortNextAdvice(text) {
            const value = String(text || '').replace(/\s+/g, ' ').trim();
            if (!value) return '';
            return value.length > 62 ? `${value.slice(0, 62)}...` : value;
        }

        function formatPlaceMemory(meal = {}) {
            const name = meal.placeName || meal.restaurantName || "";
            const address = meal.placeAddress || meal.locationName || "";
            const rating = Number(meal.placeRating || 0);
            const note = meal.placeNote || meal.restaurantNote || "";
            const parts = [];
            if (name) parts.push(name);
            if (address) parts.push(address);
            if (rating > 0) parts.push(`${rating}/5`);
            if (note) parts.push(shortNextAdvice(note));
            return parts.join(" · ");
        }

        function updateMealPlaceMemory(mealId, dateKey = todayKeyDate(), patch = {}) {
            if (!currentUser || !mealId) return null;
            const key = dailyKey('meals', dateKey);
            const meals = safeJsonArray(localStorage.getItem(key));
            const index = meals.findIndex(meal => meal.id === mealId);
            if (index < 0) return null;
            const current = meals[index] || {};
            const has = (key) => Object.prototype.hasOwnProperty.call(patch, key);
            const ratingSource = has('placeRating') ? patch.placeRating : current.placeRating;
            const rating = Math.max(0, Math.min(5, Math.round(Number(ratingSource || 0))));
            const placeName = has('placeName') ? String(patch.placeName || "").trim() : (current.placeName || current.restaurantName || "");
            const placeAddress = has('placeAddress') ? String(patch.placeAddress || "").trim() : (current.placeAddress || current.locationName || "");
            const placeNote = has('placeNote') ? String(patch.placeNote || "").trim() : (current.placeNote || current.restaurantNote || "");
            const updated = {
                ...current,
                placeName,
                restaurantName: placeName,
                placeAddress,
                locationName: placeAddress,
                placeRating: rating,
                placeNote,
                restaurantNote: placeNote,
                updatedAt: new Date().toISOString()
            };
            meals[index] = updated;
            localStorage.setItem(key, JSON.stringify(meals));
            if (dateKey === todayKeyDate()) loadDailyStores();
            syncRemoteMealsForDate(dateKey);
            renderTodayDiarySummary();
            renderPlaceMemoryPassportCard();
            renderPlaceMemoryHealthCard();
            renderPlaceRevisitList();
            return updated;
        }

        function quickRateMealPlace(mealId, dateKey = todayKeyDate(), rating = 0, label = "", event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const cleanLabel = String(label || "").trim();
            const patch = { placeRating: rating };
            if (cleanLabel) patch.placeNote = `快速評分：${cleanLabel}`;
            const updated = updateMealPlaceMemory(mealId, dateKey, patch);
            if (!updated) {
                showToast("評分沒有存成功，先重新整理今天明細。");
                return false;
            }
            lastSavedMealFocusId = mealId;
            showToast(`已先記下這餐：${rating}/5 ${cleanLabel || "評分"}`);
            if (dateKey === todayKeyDate()) {
                loadDailyStores();
                updateUI(false);
            } else {
                renderTodayDiarySummary();
            }
            return false;
        }

        function editMealPlaceMemory(mealId, dateKey = memorySelectedDate || todayKeyDate(), event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            return openPlaceQuickEdit(mealId, dateKey, event);
        }

        function openPlaceQuickEdit(mealId, dateKey = memorySelectedDate || todayKeyDate(), event = null) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const meals = getMealsForDate(dateKey);
            const meal = meals.find(item => item.id === mealId);
            const panel = document.getElementById('placeQuickEditPanel');
            if (!meal) {
                showToast("找不到這餐，先重新整理今日回憶。");
                return false;
            }
            if (!panel) return false;
            activePlaceQuickEdit = { mealId, dateKey };
            const hint = document.getElementById('placeQuickEditHint');
            const nameInput = document.getElementById('placeQuickName');
            const ratingInput = document.getElementById('placeQuickRating');
            const addressInput = document.getElementById('placeQuickAddress');
            const noteInput = document.getElementById('placeQuickNote');
            if (hint) hint.innerText = `正在補「${meal.name || '這餐'}」的店家回憶。這不影響熱量，只是讓下次找得到。`;
            if (nameInput) nameInput.value = meal.placeName || meal.restaurantName || "";
            if (ratingInput) ratingInput.value = Number(meal.placeRating || 0) ? String(Number(meal.placeRating || 0)) : "";
            if (addressInput) addressInput.value = meal.placeAddress || meal.locationName || "";
            if (noteInput) noteInput.value = meal.placeNote || meal.restaurantNote || "";
            panel.classList.add('active');
            setTimeout(() => {
                try { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                catch (error) { panel.scrollIntoView(); }
                nameInput?.focus();
            }, 60);
            return false;
        }

        function closePlaceQuickEdit() {
            activePlaceQuickEdit = { mealId: "", dateKey: "" };
            const panel = document.getElementById('placeQuickEditPanel');
            if (panel) panel.classList.remove('active');
        }

        function savePlaceQuickEdit() {
            const { mealId, dateKey } = activePlaceQuickEdit || {};
            if (!mealId) {
                showToast("先選一餐再補店家回憶。");
                return false;
            }
            const placeName = document.getElementById('placeQuickName')?.value || "";
            const ratingRaw = document.getElementById('placeQuickRating')?.value || "";
            const placeAddress = document.getElementById('placeQuickAddress')?.value || "";
            const placeNote = document.getElementById('placeQuickNote')?.value || "";
            const cleanName = String(placeName || "").trim();
            const cleanNote = String(placeNote || "").trim();
            const cleanAddress = String(placeAddress || "").trim();
            const rating = Number(String(ratingRaw || "").trim() || 0);
            if (!cleanName && !cleanNote && !cleanAddress && !rating) {
                showToast("沒有輸入店家記憶，先不更新。");
                return false;
            }
            const updated = updateMealPlaceMemory(mealId, dateKey, {
                placeName: cleanName,
                placeAddress: cleanAddress,
                placeRating: Number.isFinite(rating) ? rating : 0,
                placeNote: cleanNote
            });
            if (updated) {
                lastSavedMealFocusId = mealId;
                showToast(cleanName ? `已記住 ${cleanName}。` : "已補上這餐店家備註。");
                closePlaceQuickEdit();
                goToMealMemoryDate(dateKey, mealId, 'todayMealLedger');
            } else {
                showToast("店家記憶更新失敗，請再試一次。");
            }
            return false;
        }

        function getPlaceRevisitSummaries(limit = 5) {
            const byPlace = new Map();
            const dateKeys = new Set([todayKeyDate(), memorySelectedDate, ...recentMemoryDates.map(item => item.date || item.key || item).filter(Boolean)]);
            dateKeys.forEach(dateKey => {
                const meals = getMealsForDate(dateKey);
                (meals || []).forEach(meal => {
                    const placeName = meal.placeName || meal.restaurantName || "";
                    if (!placeName) return;
                    const key = placeName.trim().toLowerCase();
                    const rating = Number(meal.placeRating || 0);
                    const current = byPlace.get(key) || {
                        name: placeName,
                        address: meal.placeAddress || meal.locationName || "",
                        count: 0,
                        ratingTotal: 0,
                        ratingCount: 0,
                        calories: 0,
                        lastDate: dateKey,
                        lastMeal: meal.name || "餐點",
                        note: meal.placeNote || meal.restaurantNote || "",
                        photo: meal.photoBefore || meal.photo || meal.photoAfter || "",
                        meals: []
                    };
                    current.meals.push({ ...meal, memoryDate: dateKey });
                    current.count += 1;
                    current.calories += Number(meal.kcal || meal.calories || 0);
                    if (rating > 0) {
                        current.ratingTotal += rating;
                        current.ratingCount += 1;
                    }
                    if (String(dateKey) >= String(current.lastDate || "")) {
                        current.lastDate = dateKey;
                        current.lastMeal = meal.name || current.lastMeal;
                        current.note = meal.placeNote || meal.restaurantNote || current.note;
                        current.address = meal.placeAddress || meal.locationName || current.address;
                        current.photo = meal.photoBefore || meal.photo || meal.photoAfter || current.photo;
                    }
                    byPlace.set(key, current);
                });
            });
            return [...byPlace.values()]
                .map(item => ({
                    ...item,
                    meals: (item.meals || []).sort((a, b) => String(b.memoryDate || "").localeCompare(String(a.memoryDate || ""))),
                    avgRating: item.ratingCount ? Number((item.ratingTotal / item.ratingCount).toFixed(1)) : 0,
                    avgCalories: item.count ? Math.round(item.calories / item.count) : 0
                }))
                .sort((a, b) => (b.avgRating - a.avgRating) || (b.count - a.count) || String(b.lastDate).localeCompare(String(a.lastDate)))
                .slice(0, limit);
        }

        function getPlaceRevisitAdvice(place = {}, status = getNutritionStatus()) {
            const avgCalories = Number(place.avgCalories || 0);
            const templates = getTataMealTemplates(status, getNextMealSuggestion(new Date(), status.caloriesLeft));
            const fallback = templates[0] || { foodName: "塔塔均衡餐盤", body: "一掌蛋白質、兩拳蔬菜、半份主食，先拍照再校正份量。" };
            let focus = "回訪可行";
            let body = `上次吃 ${place.lastMeal || "這家店"}，這次先照「${fallback.foodName}」方向點，飯前拍照再估份量。`;
            if ((place.avgRating || 0) >= 4 && place.count >= 2) {
                focus = "高信任店";
                body = `你已經吃過 ${place.count} 次、平均評分 ${place.avgRating}/5。下次可回訪，但先用飯前照確認份量。`;
            }
            if (avgCalories > Math.max(650, userData.targetCalories * 0.38)) {
                focus = "熱量偏高";
                body = `這家平均約 ${avgCalories} kcal，下次飯半份、醬汁分開，飲料無糖。`;
            }
            if (status.sodiumOver > 0 || /湯|鍋|拉麵|泡菜|滷/.test(place.lastMeal || "")) {
                focus = "少湯少醬";
                body = `今天鈉要控，這家下次湯底喝一半以下，醬料分開，優先吃料和蛋白質。`;
            } else if (status.proteinGap >= 18) {
                focus = "補蛋白";
                body = `今天蛋白質還差 ${status.proteinGap}g，回訪時先找雞、魚、蛋、豆腐，主食照熱量餘額調。`;
            } else if (status.fiberGap >= 8) {
                focus = "加菜";
                body = `今天纖維還差 ${status.fiberGap}g，回訪時加青菜、菇類或海帶，避免只吃肉和飯。`;
            }
            if (place.note) body += ` 你的備註：${shortNextAdvice(place.note)}`;
            return { focus, body, foodName: fallback.foodName || place.lastMeal || "塔塔回訪餐", targetKcal: Math.max(220, Math.min(750, avgCalories || status.caloriesLeft || 450)) };
        }

        function getPlaceMemoryInsight(place = {}, status = getNutritionStatus()) {
            const meals = Array.isArray(place.meals) ? place.meals : [];
            const avgCalories = Number(place.avgCalories || 0);
            const avgRating = Number(place.avgRating || 0);
            const targetCalories = Number(userData.targetCalories || 1800);
            const highMealLimit = Math.max(650, Math.round(targetCalories * 0.38));
            const photoCount = meals.reduce((total, meal) => total + (meal.photoBefore || meal.photo ? 1 : 0) + (meal.photoAfter ? 1 : 0), 0);
            const sortedMeals = [...meals].sort((a, b) => {
                const ratingDiff = Number(b.placeRating || 0) - Number(a.placeRating || 0);
                if (ratingDiff) return ratingDiff;
                return Number(a.kcal || a.calories || 9999) - Number(b.kcal || b.calories || 9999);
            });
            const bestMeal = sortedMeals[0] || meals[0] || {};
            const bestName = bestMeal.name || place.lastMeal || "這家店的回憶餐";
            const bestKcal = Number(bestMeal.kcal || bestMeal.calories || avgCalories || 0);
            const foodText = [place.lastMeal, place.note, ...meals.map(meal => `${meal.name || ""} ${meal.placeNote || meal.restaurantNote || ""}`)].join(" ");
            const soupOrSauceRisk = /湯|鍋|拉麵|泡菜|滷|羹|醬|咖哩|麻辣|鹹酥|炸|可樂|奶茶|含糖/.test(foodText);
            const tags = [];
            if (avgRating >= 4) tags.push("高評分可回訪");
            else if (avgRating > 0 && avgRating < 3) tags.push("低評分慎選");
            else tags.push("待補評分");
            if (avgCalories >= highMealLimit) tags.push("熱量偏高");
            if (soupOrSauceRisk || status.sodiumOver > 0) tags.push("少湯少醬");
            if (photoCount > 0) tags.push(`${photoCount} 張照片`);
            if (place.count >= 3) tags.push("熟店記憶");

            let caution = "份量差異會影響熱量，回訪時先拍飯前照，吃完可補飯後照校正。";
            if (avgCalories >= highMealLimit) {
                caution = `平均 ${avgCalories} kcal 偏高，這家適合把飯、麵或飲料先砍半。`;
            } else if (soupOrSauceRisk || status.sodiumOver > 0) {
                caution = "湯底、醬汁或含糖飲容易讓鈉和熱量失控，建議少喝湯、醬分開。";
            } else if (avgRating > 0 && avgRating < 3) {
                caution = "你之前評分偏低，除非真的方便，否則可以讓塔塔幫你換一家。";
            }

            let nextOrder = "照上次喜歡的主餐點，但加一份青菜，主食先半份，拍照後再決定要不要補。";
            if (status.proteinGap >= 18) nextOrder = "下次點法：先補雞、魚、蛋、豆腐其中一份，主食不要加大。";
            else if (status.fiberGap >= 8) nextOrder = "下次點法：青菜、菇類、海帶優先，主食半份，讓纖維先補起來。";
            else if (status.sodiumOver > 0 || soupOrSauceRisk) nextOrder = "下次點法：湯喝一半以下，醬料分開，飲料選水或無糖。";
            else if (avgCalories >= highMealLimit) nextOrder = "下次點法：飯半份、炸物換烤/滷/蒸，飲料不要含糖。";

            const title = avgRating >= 4 ? "店家回訪洞察：值得回去，但要會點" : "店家回訪洞察：先看今天缺什麼";
            const body = `這家吃過 ${place.count || meals.length || 1} 次，平均 ${avgCalories || bestKcal || 0} kcal。塔塔會把照片、評分、備註和今天缺口一起看，不再只像地圖收藏。`;
            return {
                title,
                body,
                tags,
                bestMeal: `${bestName}${bestKcal ? ` · ${bestKcal} kcal` : ""}`,
                caution,
                nextOrder,
                photoCount,
                score: avgRating ? `${avgRating}/5` : "待評分"
            };
        }

        function renderPlaceMemoryInsight(place = {}, status = getNutritionStatus(), options = {}) {
            const insight = getPlaceMemoryInsight(place, status);
            const compact = options.compact ? " compact" : "";
            const tagHtml = insight.tags.map(tag => `<span class="place-memory-insight-tag">${tag}</span>`).join('');
            return `
                <div class="place-memory-insight${compact}">
                    <div class="place-memory-insight-top">
                        <div class="place-memory-insight-title">${insight.title}</div>
                        <div class="place-memory-insight-score">${insight.score}</div>
                    </div>
                    <div class="place-memory-insight-body">${insight.body}</div>
                    <div class="place-memory-insight-grid">
                        <div class="place-memory-insight-cell"><strong>最佳回憶</strong><span>${shortNextAdvice(insight.bestMeal)}</span></div>
                        <div class="place-memory-insight-cell"><strong>風險提醒</strong><span>${shortNextAdvice(insight.caution)}</span></div>
                        <div class="place-memory-insight-cell"><strong>下次點法</strong><span>${shortNextAdvice(insight.nextOrder)}</span></div>
                    </div>
                    <div class="place-memory-insight-tags">${tagHtml}</div>
                </div>
            `;
        }

        function buildPlacePersonalGuide(place = {}, status = getNutritionStatus()) {
            const insight = getPlaceMemoryInsight(place, status);
            const advice = getPlaceRevisitAdvice(place, status);
            const avgCalories = Number(place.avgCalories || 0);
            const avgRating = Number(place.avgRating || 0);
            const repeatLabel = place.count >= 3 ? "熟店" : (place.count >= 2 ? "回訪過" : "新記憶");
            const fit = avgRating >= 4
                ? "適合回訪"
                : (avgRating > 0 && avgRating < 3 ? "先慎選" : "待評分");
            const kcalMood = avgCalories >= Math.max(650, (userData.targetCalories || 1800) * 0.38)
                ? "高熱量日別硬衝"
                : "一般日可安排";
            const whyOpen = `這家不是只收藏店名：拍拍吃 記住你吃過 ${place.count || 1} 次、平均 ${avgCalories || 0} kcal、評分 ${avgRating || "待補"}，下次能直接變成點餐策略。`;
            const orderMove = insight.nextOrder || advice.body;
            const avoidMove = insight.caution || "份量不同就先拍飯前照，吃完可補飯後照校正。";
            const whenToGo = status.caloriesLeft < 450 && avgCalories > 550
                ? "今天熱量不多，適合改天或點半份。"
                : (status.proteinGap >= 18 ? "今天缺蛋白，可回訪但主餐先選雞魚蛋豆。" : `${kcalMood}，到店先拍飯前照。`);
            return {
                title: `個人店家攻略：${place.name || "這家店"}`,
                meta: `${repeatLabel} · ${fit}`,
                body: whyOpen,
                whenToGo,
                orderMove,
                avoidMove,
                target: advice.targetKcal || avgCalories || status.caloriesLeft || 450
            };
        }

        function renderPlacePersonalGuide(place = {}, status = getNutritionStatus(), index = 0, options = {}) {
            const guide = buildPlacePersonalGuide(place, status);
            const compact = options.compact ? " compact" : "";
            return `
                <div class="place-personal-guide${compact}">
                    <div class="place-personal-guide-top">
                        <div class="place-personal-guide-title">${guide.title}</div>
                        <div class="place-personal-guide-meta">${guide.meta}</div>
                    </div>
                    <div class="place-personal-guide-body">${guide.body}</div>
                    <div class="place-personal-guide-grid">
                        <div class="place-personal-guide-cell"><strong>什麼時候去</strong><span>${shortNextAdvice(guide.whenToGo)}</span></div>
                        <div class="place-personal-guide-cell"><strong>下次怎麼點</strong><span>${shortNextAdvice(guide.orderMove)}</span></div>
                        <div class="place-personal-guide-cell"><strong>要避開什麼</strong><span>${shortNextAdvice(guide.avoidMove)}</span></div>
                    </div>
                    <div class="place-personal-guide-actions">
                        <button class="place-personal-guide-action primary" type="button" onclick="selectPlaceRevisitPlan(${index})">建立回訪點餐</button>
                        <a class="place-personal-guide-action" href="${buildPlaceMapsUrl(place)}" target="_blank" rel="noopener noreferrer">開地圖</a>
                    </div>
                </div>
            `;
        }

        function getPlaceMemoryHealth(placesInput = getPlaceRevisitSummaries(20)) {
            const places = Array.isArray(placesInput) ? placesInput : [];
            const scored = places.map(place => {
                const meals = Array.isArray(place.meals) ? place.meals : [];
                const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0) + (meal.photoAfter ? 1 : 0), 0);
                const checks = [
                    { key: "address", label: "補地點", done: Boolean(place.address) },
                    { key: "rating", label: "補評分", done: Number(place.avgRating || 0) > 0 },
                    { key: "note", label: "補下次備註", done: Boolean(place.note) },
                    { key: "photo", label: "補照片", done: photoCount > 0 },
                    { key: "revisit", label: "再吃一次確認", done: Number(place.count || 0) >= 2 }
                ];
                const doneCount = checks.filter(item => item.done).length;
                const missing = checks.filter(item => !item.done).map(item => item.label);
                return {
                    ...place,
                    photoCount,
                    healthScore: Math.round((doneCount / checks.length) * 100),
                    missing,
                    healthLabel: doneCount >= 4 ? "可當回訪記憶" : (doneCount >= 2 ? "記憶成形中" : "資料待補")
                };
            });
            const avgScore = scored.length ? Math.round(scored.reduce((sum, item) => sum + item.healthScore, 0) / scored.length) : 0;
            const readyCount = scored.filter(item => item.healthScore >= 80).length;
            const nextPlace = [...scored].sort((a, b) => a.healthScore - b.healthScore || String(b.lastDate || "").localeCompare(String(a.lastDate || "")))[0] || null;
            return { places: scored, avgScore, readyCount, nextPlace };
        }

        function getPlaceMemoryPassport(placesInput = getPlaceRevisitSummaries(20)) {
            const places = Array.isArray(placesInput) ? placesInput : [];
            const health = getPlaceMemoryHealth(places);
            const meals = places.flatMap(place => Array.isArray(place.meals) ? place.meals : []);
            const photoCount = meals.reduce((sum, meal) => sum + (meal.photoBefore || meal.photo ? 1 : 0) + (meal.photoAfter ? 1 : 0), 0);
            const ratedCount = places.filter(place => Number(place.avgRating || 0) > 0).length;
            const categoryCounts = getPlaceDietCategoryOptions().slice(1).map(option => ({
                ...option,
                count: places.filter(place => getPlaceDietCategories(place).some(category => category.key === option.key)).length
            }));
            const highTrust = [...places]
                .filter(place => Number(place.avgRating || 0) >= 4 || Number(place.count || 0) >= 2)
                .sort((a, b) => (Number(b.avgRating || 0) - Number(a.avgRating || 0)) || (Number(b.count || 0) - Number(a.count || 0)))[0] || places[0] || null;
            const newest = [...places].sort((a, b) => String(b.lastDate || "").localeCompare(String(a.lastDate || "")))[0] || null;
            const nextCandidate = highTrust || newest || null;
            const nextGuide = nextCandidate ? buildPlacePersonalGuide(nextCandidate, getNutritionStatus()) : null;
            const missing = health.nextPlace?.missing?.slice(0, 2).join("、") || "";
            return {
                places,
                placeCount: places.length,
                mealCount: meals.length,
                photoCount,
                ratedCount,
                readyCount: health.readyCount,
                avgScore: health.avgScore,
                categoryCounts,
                nextCandidate,
                nextGuide,
                missing
            };
        }

        function renderPlaceMemoryPassportCard() {
            const card = document.getElementById('placeMemoryPassportCard');
            if (!card) return;
            const passport = getPlaceMemoryPassport(getPlaceRevisitSummaries(20));
            if (!passport.placeCount) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const placeName = passport.nextCandidate?.name || "下一家店";
            const orderMove = passport.nextGuide?.orderMove || "下次吃飯先拍飯前照，塔塔會把店名、照片、熱量和評分串成記憶。";
            const missingLine = passport.missing ? `目前最值得補齊的是：${passport.missing}。` : "目前資料已足夠回訪。";
            const categoryLine = passport.categoryCounts
                .filter(item => item.count > 0)
                .map(item => `${item.label} ${item.count}`)
                .join(" · ") || "分類會隨餐點記憶出現";
            card.classList.add('active');
            card.innerHTML = `
                <div class="place-memory-passport-top">
                    <div class="place-memory-passport-title">個人飲食地圖護照</div>
                    <div class="place-memory-passport-meta">記憶 ${passport.avgScore}%</div>
                </div>
                <div class="place-memory-passport-body">TATA 正把你吃過的店、照片、評分與下一次點法整理成私人飲食地圖。它不是公開排行榜，而是只服務你的回訪記憶。</div>
                <div class="place-memory-passport-grid">
                    <div class="place-memory-passport-stat"><strong>${passport.placeCount}</strong><span>記住店家</span></div>
                    <div class="place-memory-passport-stat"><strong>${passport.photoCount}</strong><span>餐點照片</span></div>
                    <div class="place-memory-passport-stat"><strong>${passport.readyCount}</strong><span>可回訪</span></div>
                </div>
                <div class="place-memory-passport-highlight">下一個可用記憶：「${placeName}」。${shortNextAdvice(orderMove)} ${missingLine}<br>私人分類：${categoryLine}</div>
                <div class="place-memory-passport-actions">
                    <button class="place-memory-passport-action primary" type="button" onclick="togglePlaceRevisitHighOnly()">看值得回訪</button>
                    <button class="place-memory-passport-action" type="button" onclick="togglePlaceRevisitIncompleteOnly()">補齊地圖資料</button>
                </div>
            `;
        }

        function renderPlaceMemoryChecklist(place = {}, index = 0) {
            const health = getPlaceMemoryHealth([place]).places[0] || { healthScore: 0, missing: [] };
            const missingSet = new Set(health.missing || []);
            const items = [
                { label: "地點", done: !missingSet.has("補地點") },
                { label: "評分", done: !missingSet.has("補評分") },
                { label: "下次備註", done: !missingSet.has("補下次備註") },
                { label: "照片", done: !missingSet.has("補照片") },
                { label: "回訪確認", done: !missingSet.has("再吃一次確認") }
            ];
            const missingText = health.missing?.length ? health.missing.join("、") : "資料已足夠回訪";
            return `
                <div class="place-memory-checklist">
                    <div class="place-memory-checklist-top">
                        <div class="place-memory-checklist-title">補齊這家店的記憶</div>
                        <div class="place-memory-checklist-score">${health.healthScore || 0}%</div>
                    </div>
                    <div class="place-memory-checklist-grid">
                        ${items.map(item => `<div class="place-memory-checkitem ${item.done ? 'done' : 'todo'}">${item.done ? '完成' : '待補'}｜${item.label}</div>`).join('')}
                    </div>
                    <div class="place-memory-checklist-note">還缺：${missingText}。補齊後，這家店就更像你的個人美食地圖記憶。</div>
                    <div class="place-memory-checklist-actions">
                        <button class="place-memory-checklist-action primary" type="button" onclick="openPhotoPicker('before')">下次到店先拍</button>
                        <button class="place-memory-checklist-action" type="button" onclick="selectPlaceRevisitPlan(${index})">建立回訪計畫</button>
                    </div>
                </div>
            `;
        }

        function renderPlaceMemoryHealthCard() {
            const card = document.getElementById('placeMemoryHealthCard');
            if (!card) return;
            const health = getPlaceMemoryHealth(getPlaceRevisitSummaries(20));
            if (!health.places.length) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            const next = health.nextPlace;
            const missingText = next?.missing?.length ? next.missing.slice(0, 3).join("、") : "資料很完整";
            card.classList.add('active');
            card.innerHTML = `
                <div class="place-memory-health-top">
                    <div class="place-memory-health-title">店家記憶健康度</div>
                    <div class="place-memory-health-score">${health.avgScore}%</div>
                </div>
                <div class="place-memory-health-body">這是個人美食地圖的資料品質。照片、地址、評分、下次備註越完整，之後越能幫你找回值得去的店。</div>
                <div class="place-memory-health-grid">
                    <div class="place-memory-health-stat"><strong>${health.places.length}</strong><span>記住店家</span></div>
                    <div class="place-memory-health-stat"><strong>${health.readyCount}</strong><span>可回訪</span></div>
                    <div class="place-memory-health-stat"><strong>${next?.healthScore || 0}%</strong><span>待補店</span></div>
                </div>
                <div class="place-memory-health-next">${next ? `下一個補齊：「${next.name}」還缺 ${missingText}。下次到店先拍飯前照，吃完順手評分和寫一句下次備註。` : '目前店家記憶很完整。'}</div>
                <div class="place-memory-health-actions">
                    <button class="place-memory-health-action primary" type="button" onclick="openPhotoPicker('before')">下次到店先拍</button>
                    <button class="place-memory-health-action" type="button" onclick="togglePlaceRevisitIncompleteOnly()">看待補店家</button>
                </div>
            `;
        }

        function renderPhotoPlaceMemoryCard() {
            const card = document.getElementById('photoPlaceMemoryCard');
            if (!card) return;
            const places = getPlaceRevisitSummaries(3);
            if (!places.length) {
                card.classList.remove('active');
                card.innerHTML = "";
                return;
            }
            window.photoPlaceMemoryRendered = places;
            card.classList.add('active');
            card.innerHTML = `
                <div class="photo-place-memory-top">
                    <div class="photo-place-memory-title">最近店家，一鍵帶入</div>
                    <div class="photo-place-memory-meta">${places.length} 家</div>
                </div>
                <div class="photo-place-memory-list">
                    ${places.map((place, index) => {
                        const advice = getPlaceRevisitAdvice(place);
                        const insight = getPlaceMemoryInsight(place);
                        const health = getPlaceMemoryHealth([place]).places[0] || { healthScore: 0, missing: [] };
                        const missingHint = health.missing?.length ? health.missing[0].replace(/^補/, "") : "資料完整";
                        return `
                            <button class="photo-place-memory-item" type="button" onclick="selectPhotoPlaceMemory(${index})">
                                <strong>${place.name}</strong>
                                <span>${place.address ? `${place.address} · ` : ''}上次：${place.lastMeal} · ${place.avgCalories || 0} kcal。${advice.focus}：${shortNextAdvice(insight.nextOrder || advice.body)}</span>
                                <div class="photo-place-memory-health">
                                    <b>記憶 ${health.healthScore || 0}%</b>
                                    <em>下次順手補：${missingHint}</em>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        function selectPhotoPlaceMemory(index) {
            const places = Array.isArray(window.photoPlaceMemoryRendered) ? window.photoPlaceMemoryRendered : getPlaceRevisitSummaries(3);
            const place = places[index];
            if (!place) return;
            window.placeRevisitRendered = places;
            const health = getPlaceMemoryHealth([place]).places[0];
            const missingHint = health?.missing?.length ? `，這次順手${health.missing[0]}` : "";
            selectPlaceRevisitPlan(index);
            showToast(`已帶入 ${place.name}，到店先拍飯前照${missingHint}。`);
        }

        function getPlaceDietCategoryOptions() {
            return [
                { key: "all", label: "全部" },
                { key: "slim", label: "減脂友善" },
                { key: "protein", label: "高蛋白" },
                { key: "family", label: "親子友善" },
                { key: "sugar", label: "控糖友善" }
            ];
        }

        function getPlaceNutritionDataset(place = {}) {
            const meals = Array.isArray(place.meals) ? place.meals : [];
            const count = Math.max(1, meals.length || Number(place.count || 1));
            const avg = (field, fallback = 0) => {
                const total = meals.reduce((sum, meal) => sum + Number(meal[field] || 0), 0);
                const value = meals.length ? total / count : Number(fallback || 0);
                return Math.max(0, Math.round(value));
            };
            const calories = Number(place.avgCalories || avg("kcal", place.avgCalories || 0));
            const protein = avg("protein");
            const fiber = avg("fiber");
            const sugar = avg("sugar");
            const sodium = avg("sodium");
            return {
                count,
                calories,
                protein,
                fiber,
                sugar,
                sodium,
                warnings: {
                    calories: calories >= Math.max(650, Math.round((userData.targetCalories || 1800) * 0.38)),
                    protein: protein > 0 && protein < 18,
                    fiber: fiber > 0 && fiber < 5,
                    sugar: sugar >= 18,
                    sodium: sodium >= 900
                }
            };
        }

        function renderPlaceNutritionDataset(place = {}) {
            const data = getPlaceNutritionDataset(place);
            const cells = [
                { key: "calories", label: "平均 kcal", value: data.calories || 0 },
                { key: "protein", label: "蛋白 g", value: data.protein || 0 },
                { key: "fiber", label: "纖維 g", value: data.fiber || 0 },
                { key: "sugar", label: "糖 g", value: data.sugar || 0 },
                { key: "sodium", label: "鈉 mg", value: data.sodium || 0 }
            ];
            return `
                <div class="place-nutrition-dataset" aria-label="店家真實飲食數據">
                    ${cells.map(cell => `
                        <div class="place-nutrition-datum${data.warnings[cell.key] ? ' warn' : ''}">
                            <strong>${cell.value}</strong>
                            <span>${cell.label}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function getPlaceGoalFitScore(place = {}, goal = userData.selectedTone || "slim") {
            const data = getPlaceNutritionDataset(place);
            let score = 72;
            const reasons = [];
            const cautions = [];
            const add = (points, text) => { score += points; if (text) reasons.push(text); };
            const sub = (points, text) => { score -= points; if (text) cautions.push(text); };
            if (goal === "fitness") {
                if (data.protein >= 28) add(16, `蛋白約 ${data.protein}g，適合訓練日`);
                else if (data.protein >= 20) add(8, "蛋白質尚可");
                else sub(12, "蛋白質偏少");
                if (data.calories >= 450 && data.calories <= 780) add(6, "熱量可安排");
                if (data.sodium >= 1000) sub(10, "鈉偏高，湯醬要控");
            } else if (goal === "maintain") {
                if (data.calories >= 360 && data.calories <= 680) add(12, "熱量落在維持區間");
                else if (data.calories > 760) sub(14, "熱量偏高");
                if (data.protein >= 20) add(8, "蛋白質有接上");
                if (data.sugar >= 18 || data.sodium >= 1000) sub(10, "糖或鈉需要留意");
            } else if (goal === "healthy") {
                if (data.fiber >= 6) add(12, "纖維表現不錯");
                else if (data.fiber > 0 && data.fiber < 5) sub(10, "纖維偏少");
                if (data.sugar <= 10 && data.sodium <= 900) add(12, "糖與鈉相對穩");
                if (data.protein >= 20) add(6, "蛋白質足夠");
                if (data.sodium >= 1200) sub(14, "鈉偏高");
                if (data.sugar >= 20) sub(12, "糖偏高");
            } else if (goal === "gain") {
                if (data.calories >= 520) add(14, "熱量能幫助補足");
                else sub(8, "熱量可能偏低");
                if (data.protein >= 22) add(10, "蛋白質有助增重品質");
                if (data.sugar >= 24 || data.sodium >= 1200) sub(8, "別只靠糖鈉補熱量");
            } else {
                if (data.calories > 0 && data.calories <= 580) add(14, "平均熱量適合減脂");
                else if (data.calories >= 720) sub(16, "平均熱量偏高");
                if (data.protein >= 22) add(10, "蛋白質能保飽足");
                if (data.fiber >= 6) add(8, "纖維有幫助");
                if (data.sugar >= 18) sub(10, "糖偏高");
                if (data.sodium >= 1000) sub(10, "鈉偏高");
            }
            score = Math.max(0, Math.min(100, Math.round(score)));
            const label = score >= 82 ? "很適合" : (score >= 68 ? "可安排" : (score >= 52 ? "要會點" : "先慎選"));
            const nextMove = score >= 68
                ? "到店先拍飯前照，照這家店的優勢點餐。"
                : "若要吃，主食半份、醬料分開，再補蛋白質或蔬菜。";
            return {
                score,
                label,
                goal,
                goalLabel: getGoalLabel(goal),
                reasons,
                cautions,
                nextMove
            };
        }

        function renderPlaceGoalFit(place = {}, goal = userData.selectedTone || "slim") {
            const fit = getPlaceGoalFitScore(place, goal);
            const body = [...fit.reasons.slice(0, 2), ...fit.cautions.slice(0, 2)].join("；") || fit.nextMove;
            return `
                <div class="place-goal-fit${fit.score < 68 ? ' warn' : ''}" aria-label="依個人目標判斷店家適配度">
                    <div class="place-goal-fit-top">
                        <div class="place-goal-fit-title">${fit.goalLabel}適配：${fit.label}</div>
                        <div class="place-goal-fit-score">${fit.score}/100</div>
                    </div>
                    <div class="place-goal-fit-body">${body} ${fit.nextMove}</div>
                </div>
            `;
        }

        function getPlaceDietCategories(place = {}) {
            const meals = Array.isArray(place.meals) ? place.meals : [];
            const dataset = getPlaceNutritionDataset(place);
            const avgCalories = Number(dataset.calories || place.avgCalories || 0);
            const avgProtein = Number(dataset.protein || 0);
            const avgFiber = Number(dataset.fiber || 0);
            const avgSugar = Number(dataset.sugar || 0);
            const avgSodium = Number(dataset.sodium || 0);
            const text = [
                place.name,
                place.address,
                place.note,
                place.lastMeal,
                ...meals.map(meal => `${meal.name || ""} ${meal.placeNote || meal.restaurantNote || ""} ${meal.nextAdvice || ""}`)
            ].join(" ");
            const categories = [];
            const has = (pattern) => pattern.test(text);
            if ((avgCalories > 0 && avgCalories <= 580) || has(/減脂|瘦身|半飯|少飯|沙拉|舒肥|健康便當|清蒸|水煮/)) {
                categories.push({ key: "slim", label: "減脂友善", reason: avgCalories ? `平均 ${avgCalories} kcal` : "有減脂點餐線索" });
            }
            if (avgProtein >= 22 || has(/高蛋白|雞胸|雞肉|魚|鮭魚|鮪魚|蛋|豆腐|牛排|舒肥/)) {
                categories.push({ key: "protein", label: "高蛋白", reason: avgProtein ? `蛋白約 ${Math.round(avgProtein)}g` : "常見蛋白質主餐" });
            }
            if (has(/親子|小孩|兒童|家庭|推車|寬敞|座位|不辣/) || ((place.avgRating || 0) >= 4 && (place.count || 0) >= 2 && avgCalories <= 800)) {
                categories.push({ key: "family", label: "親子友善", reason: has(/親子|小孩|兒童|家庭|推車|寬敞|座位|不辣/) ? "備註含親子線索" : "熟悉且評分穩定" });
            }
            if ((avgSugar <= 8 && avgCalories > 0 && avgCalories <= 650 && avgSodium <= 1200) || has(/控糖|無糖|低糖|糖尿|零卡|少醬/)) {
                categories.push({ key: "sugar", label: "控糖友善", reason: avgSugar ? `糖約 ${Math.round(avgSugar)}g` : "有控糖點餐線索" });
            }
            if (avgFiber >= 6 && !categories.some(item => item.key === "slim")) {
                categories.push({ key: "slim", label: "減脂友善", reason: `纖維約 ${Math.round(avgFiber)}g` });
            }
            return categories;
        }

        function getPlaceSearchText(place = {}) {
            const meals = Array.isArray(place.meals) ? place.meals : [];
            const categoryText = getPlaceDietCategories(place).map(category => `${category.label} ${category.reason}`).join(" ");
            const mealText = meals.map(meal => [
                meal.name,
                meal.finalName,
                meal.mealSlot,
                meal.memoryDate,
                meal.date,
                meal.time,
                meal.placeNote,
                meal.restaurantNote,
                meal.nextAdvice,
                `${meal.kcal || meal.calories || 0}kcal`,
                meal.protein ? `蛋白${meal.protein}g` : "",
                meal.fiber ? `纖維${meal.fiber}g` : "",
                meal.sugar ? `糖${meal.sugar}g` : "",
                meal.sodium ? `鈉${meal.sodium}mg` : ""
            ].filter(Boolean).join(" ")).join(" ");
            return [
                place.name,
                place.address,
                place.note,
                place.lastMeal,
                place.lastDate,
                place.avgCalories ? `${place.avgCalories}kcal` : "",
                place.avgRating ? `${place.avgRating}分` : "",
                categoryText,
                mealText
            ].filter(Boolean).join(" ").toLowerCase();
        }

        function parsePlaceSearchIntent(query = "") {
            const raw = String(query || "").trim();
            const text = raw.toLowerCase();
            const categoryAliases = [
                { key: "slim", words: ["減脂", "瘦身", "低卡", "熱量低", "健康餐", "半飯", "少飯"] },
                { key: "protein", words: ["高蛋白", "蛋白", "增肌", "雞胸", "牛排", "魚", "豆腐"] },
                { key: "family", words: ["親子", "小孩", "兒童", "家庭", "推車", "座位", "寬敞", "不辣"] },
                { key: "sugar", words: ["控糖", "糖尿", "糖尿病", "低糖", "無糖", "少糖"] }
            ];
            const categories = categoryAliases
                .filter(group => group.words.some(word => text.includes(word.toLowerCase())))
                .map(group => group.key);
            const yearMatch = text.match(/(20\d{2}|19\d{2}|去年|前年|今年)/);
            let year = "";
            const currentYear = new Date().getFullYear();
            if (yearMatch) {
                if (yearMatch[1] === "去年") year = String(currentYear - 1);
                else if (yearMatch[1] === "前年") year = String(currentYear - 2);
                else if (yearMatch[1] === "今年") year = String(currentYear);
                else year = yearMatch[1];
            }
            const cityWords = ["台北", "新北", "桃園", "新竹", "苗栗", "台中", "臺中", "彰化", "南投", "雲林", "嘉義", "台南", "臺南", "高雄", "屏東", "宜蘭", "花蓮", "台東", "臺東", "基隆"];
            const city = cityWords.find(word => text.includes(word.toLowerCase())) || "";
            const foodWords = ["壽司", "牛排", "便當", "火鍋", "拉麵", "沙拉", "雞胸", "咖啡", "甜點", "早餐", "早午餐", "麵", "飯", "湯", "魚", "豆腐"];
            const foods = foodWords.filter(word => text.includes(word.toLowerCase()));
            const tokens = raw
                .split(/[\s,，、。/｜|]+/)
                .map(token => token.trim())
                .filter(Boolean)
                .filter(token => !["找", "搜尋", "適合", "餐廳", "店", "店家", "吃過", "的"].includes(token));
            return { raw, text, categories: [...new Set(categories)], year, city, foods: [...new Set(foods)], tokens };
        }

        function doesPlaceMatchSearchIntent(place = {}, intent = parsePlaceSearchIntent("")) {
            if (!intent.raw) return true;
            const searchText = getPlaceSearchText(place);
            const categories = getPlaceDietCategories(place).map(category => category.key);
            const meals = Array.isArray(place.meals) ? place.meals : [];
            if (intent.categories.length && !intent.categories.some(key => categories.includes(key))) return false;
            if (intent.year) {
                const hasYear = meals.some(meal => String(meal.memoryDate || meal.date || "").startsWith(intent.year)) || String(place.lastDate || "").startsWith(intent.year);
                if (!hasYear) return false;
            }
            if (intent.city && !searchText.includes(intent.city.toLowerCase())) return false;
            if (intent.foods.length && !intent.foods.some(food => searchText.includes(food.toLowerCase()))) return false;
            if (!intent.categories.length && !intent.year && !intent.city && !intent.foods.length) {
                return intent.tokens.every(token => searchText.includes(token.toLowerCase())) || searchText.includes(intent.text);
            }
            const looseTokens = intent.tokens
                .filter(token => token !== intent.year && token !== intent.city)
                .filter(token => !intent.foods.includes(token))
                .filter(token => !["減脂", "瘦身", "低卡", "高蛋白", "蛋白", "親子", "小孩", "控糖", "糖尿", "去年", "前年", "今年"].includes(token));
            if (looseTokens.length === 1 && (intent.categories.length || intent.year || intent.city || intent.foods.length)) {
                const token = looseTokens[0].toLowerCase();
                const covered = [intent.year, intent.city, ...intent.foods, ...intent.categories].filter(Boolean).some(value => token.includes(String(value).toLowerCase()));
                if (covered) return true;
            }
            return looseTokens.every(token => searchText.includes(token.toLowerCase()));
        }

        function getPlaceSearchIntentSummary(intent = parsePlaceSearchIntent("")) {
            const parts = [];
            if (intent.year) parts.push(`${intent.year} 年`);
            if (intent.city) parts.push(intent.city);
            if (intent.foods.length) parts.push(intent.foods.join("、"));
            const labels = getPlaceDietCategoryOptions()
                .filter(option => intent.categories.includes(option.key))
                .map(option => option.label);
            if (labels.length) parts.push(labels.join("、"));
            return parts.length ? `已理解：${parts.join(" · ")}` : "";
        }

        function getPlaceSearchMatches(place = {}, query = "") {
            const intent = parsePlaceSearchIntent(query);
            if (!intent.raw) return [];
            const needle = intent.text;
            const meals = Array.isArray(place.meals) ? place.meals : [];
            return meals
                .filter(meal => doesPlaceMatchSearchIntent({ ...place, meals: [meal] }, intent) || getPlaceSearchText({ ...place, meals: [meal] }).includes(needle))
                .slice(0, 2)
                .map(meal => `${meal.memoryDate || meal.date || '某天'} · ${meal.mealSlot || '餐點'} · ${meal.name || meal.finalName || place.name}`);
        }

        function renderPlaceRevisitList() {
            const card = document.getElementById('placeRevisitList');
            if (!card) return;
            const allPlaces = getPlaceRevisitSummaries(20);
            const query = String(placeRevisitQuery || "").trim().toLowerCase();
            const searchIntent = parsePlaceSearchIntent(placeRevisitQuery);
            const intentSummary = getPlaceSearchIntentSummary(searchIntent);
            const places = allPlaces
                .filter(place => {
                    if (placeRevisitHighOnly && (place.avgRating || 0) < 4) return false;
                    if (placeRevisitGoalFitOnly && getPlaceGoalFitScore(place).score < 68) return false;
                    if (placeRevisitIncompleteOnly) {
                        const health = getPlaceMemoryHealth([place]).places[0];
                        if (!health || health.healthScore >= 80) return false;
                    }
                    if (placeRevisitCategory !== "all" && !getPlaceDietCategories(place).some(category => category.key === placeRevisitCategory)) return false;
                    if (!query) return true;
                    return doesPlaceMatchSearchIntent(place, searchIntent) || getPlaceSearchText(place).includes(query);
                })
                .sort((a, b) => {
                    if (!placeRevisitGoalFitOnly) return 0;
                    const fitDiff = getPlaceGoalFitScore(b).score - getPlaceGoalFitScore(a).score;
                    if (fitDiff) return fitDiff;
                    return (b.avgRating || 0) - (a.avgRating || 0);
                })
                .slice(0, 5);
            window.placeRevisitRendered = places;
            const categoryButtons = getPlaceDietCategoryOptions().map(option => {
                const count = option.key === "all" ? allPlaces.length : allPlaces.filter(place => getPlaceDietCategories(place).some(category => category.key === option.key)).length;
                return `<button class="place-revisit-category${placeRevisitCategory === option.key ? ' active' : ''}" type="button" onclick="setPlaceRevisitCategory('${option.key}')">${option.label}${option.key === "all" ? '' : ` ${count}`}</button>`;
            }).join('');
            const tools = `
                <div class="place-revisit-tools">
                    <input id="placeRevisitSearch" type="search" value="${placeRevisitQuery || ''}" placeholder="搜尋：去年壽司、台中牛排、親子友善、高蛋白、控糖；也可搜尋店名、餐點、日期、備註" oninput="handlePlaceRevisitSearch(this.value)">
                    <button type="button" class="${placeRevisitGoalFitOnly ? 'active' : ''}" onclick="togglePlaceRevisitGoalFitOnly()">目標適合</button>
                    <button type="button" class="${placeRevisitHighOnly ? 'active' : ''}" onclick="togglePlaceRevisitHighOnly()">高評分</button>
                    <button type="button" class="${placeRevisitIncompleteOnly ? 'active' : ''}" onclick="togglePlaceRevisitIncompleteOnly()">待補資料</button>
                </div>
                ${intentSummary ? `<div class="place-revisit-advice">${intentSummary}</div>` : ''}
                <div class="place-revisit-category-row" aria-label="私人餐廳分類">${categoryButtons}</div>
            `;
            if (!places.length) {
                card.innerHTML = `
                    <div class="place-revisit-top">
                        <div class="place-revisit-title">餐廳回訪清單</div>
                        <div class="place-revisit-meta">${allPlaces.length ? '沒有符合' : '等第一家店'}</div>
                    </div>
                    ${tools}
                    <div class="place-revisit-empty">${allPlaces.length ? '換個關鍵字，或先關掉高評分/待補資料篩選。' : '記錄餐點時填店名或地點，之後這裡會整理你吃過、評分、下次備註和最近餐點。'}</div>
                `;
                return;
            }
            card.innerHTML = `
                <div class="place-revisit-top">
                    <div class="place-revisit-title">餐廳回訪清單</div>
                    <div class="place-revisit-meta">${placeRevisitGoalFitOnly ? `依${getGoalLabel()}排序 · ` : ''}${places.length}/${allPlaces.length} 家可回找</div>
                </div>
                ${tools}
                <div class="place-revisit-list">
                    ${places.map((place, index) => {
                        const revisitAdvice = getPlaceRevisitAdvice(place);
                        const insight = getPlaceMemoryInsight(place);
                        const health = getPlaceMemoryHealth([place]).places[0] || { healthScore: 0, healthLabel: "資料待補" };
                        const matches = getPlaceSearchMatches(place, query);
                        const dietTags = getPlaceDietCategories(place).slice(0, 3);
                        const matchLine = matches.length ? `<div class="place-revisit-advice">搜尋命中：${matches.join('、')}</div>` : "";
                        return `
                        <div class="place-revisit-item">
                            <div class="place-revisit-head">
                                <div class="place-revisit-name">${place.name}</div>
                                <div class="place-revisit-rating">${place.avgRating ? `${place.avgRating}/5` : "未評分"}</div>
                            </div>
                            <div class="place-revisit-body">${place.address ? `${place.address} · ` : ''}最近：${place.lastMeal} · ${place.lastDate || '今天'}。${place.note ? `下次：${shortNextAdvice(place.note)}` : '下次備註待補。'}</div>
                            ${renderPlaceNutritionDataset(place)}
                            ${renderPlaceGoalFit(place)}
                            ${matchLine}
                            <div class="place-revisit-advice">塔塔回訪建議：${revisitAdvice.focus}。${revisitAdvice.body}</div>
                            <div class="place-revisit-advice">店家回訪洞察：${shortNextAdvice(insight.nextOrder)} ${shortNextAdvice(insight.caution)}</div>
                            ${renderPlacePersonalGuide(place, getNutritionStatus(), index, { compact: true })}
                            <div class="place-revisit-tags">
                                <span class="place-revisit-tag">${place.count} 次</span>
                                <span class="place-revisit-tag">均 ${place.avgCalories} kcal</span>
                                <span class="place-revisit-tag">${place.ratingCount ? `${place.ratingCount} 筆評分` : '可補評分'}</span>
                                <span class="place-revisit-tag">記憶 ${health.healthScore}% · ${health.healthLabel}</span>
                                ${dietTags.map(tag => `<span class="place-revisit-tag">${tag.label} · ${shortNextAdvice(tag.reason)}</span>`).join('')}
                            </div>
                            <div class="place-revisit-actions">
                                <button class="place-revisit-action" type="button" onclick="openPlaceMemoryDetail(${index})">看吃過什麼</button>
                                <a class="place-revisit-action" href="${buildPlaceMapsUrl(place)}" target="_blank" rel="noopener noreferrer">開地圖回訪</a>
                                <button class="place-revisit-action primary" type="button" onclick="selectPlaceRevisitPlan(${index})">下次照這樣點</button>
                            </div>
                        </div>
                    `; }).join('')}
                </div>
            `;
        }

        function openPlaceMemoryDetail(index) {
            const places = Array.isArray(window.placeRevisitRendered) ? window.placeRevisitRendered : [];
            const place = places[index];
            const panel = document.getElementById('placeMemoryDetail');
            if (!place || !panel) return;
            selectedPlaceMemoryKey = String(place.name || "").trim().toLowerCase();
            const meals = Array.isArray(place.meals) ? place.meals : [];
            const photos = meals
                .flatMap((meal, mealIndex) => [
                    meal.photoBefore || meal.photo ? { src: meal.photoBefore || meal.photo, meal, mealIndex, label: "飯前" } : null,
                    meal.photoAfter ? { src: meal.photoAfter, meal, mealIndex, label: "飯後" } : null
                ])
                .filter(Boolean)
                .slice(0, 8);
            const advice = getPlaceRevisitAdvice(place);
            const mealRows = meals.slice(0, 6).map(meal => {
                const kcal = meal.kcal || meal.calories || 0;
                const rating = Number(meal.placeRating || 0);
                const note = meal.placeNote || meal.restaurantNote || "";
                return `
                    <div class="place-memory-meal">
                        <strong>${meal.memoryDate || todayKeyDate()} · ${meal.mealSlot || '餐點'} · ${meal.name || place.name}</strong>
                        ${kcal} kcal · 蛋白 ${meal.protein || 0}g · 纖維 ${meal.fiber || 0}g${rating ? ` · 評分 ${rating}/5` : ''}${note ? `<br>備註：${shortNextAdvice(note)}` : ''}
                    </div>
                `;
            }).join('');
            panel.classList.add('active');
            panel.innerHTML = `
                <div class="place-memory-detail-top">
                    <div>
                        <div class="place-memory-detail-title">${place.name}</div>
                        <div class="place-memory-detail-body">${place.address || '未填地點'} · 吃過 ${place.count} 次 · 平均 ${place.avgCalories} kcal${place.avgRating ? ` · ${place.avgRating}/5` : ''}</div>
                    </div>
                    <button class="place-memory-detail-close" type="button" onclick="closePlaceMemoryDetail()" aria-label="關閉店家回憶">×</button>
                </div>
                <div class="place-revisit-advice">吃飯打開 拍拍吃 的理由：這家店已經變成你的個人飲食回憶。${advice.body}</div>
                ${renderPlaceMemoryInsight(place, getNutritionStatus())}
                ${renderPlacePersonalGuide(place, getNutritionStatus(), index)}
                ${renderPlaceMemoryChecklist(place, index)}
                ${photos.length ? `<div class="place-memory-photo-rail">${photos.map(photo => `
                    <button class="place-memory-photo" type="button" onclick="openMealPhoto(${photo.mealIndex})">
                        <img src="${photo.src}" alt="${place.name}${photo.label}照片">
                        <span>${photo.label} · ${photo.meal.memoryDate || ''} · ${photo.meal.kcal || photo.meal.calories || 0} kcal</span>
                    </button>
                `).join('')}</div>` : '<div class="place-revisit-empty">這家店還沒有照片，下一餐拍飯前照就會留下回憶。</div>'}
                <div class="place-memory-meal-list">${mealRows || '<div class="place-revisit-empty">還沒有餐點明細。</div>'}</div>
                <div class="place-revisit-actions">
                    <a class="place-revisit-action" href="${buildPlaceMapsUrl(place)}" target="_blank" rel="noopener noreferrer">開地圖</a>
                    <button class="place-revisit-action primary" type="button" onclick="selectPlaceRevisitPlan(${index})">下次照這樣點</button>
                </div>
            `;
            try { panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (error) { panel.scrollIntoView(); }
        }

        function closePlaceMemoryDetail() {
            selectedPlaceMemoryKey = "";
            const panel = document.getElementById('placeMemoryDetail');
            if (!panel) return;
            panel.classList.remove('active');
            panel.innerHTML = "";
        }

        function selectPlaceRevisitPlan(index) {
            const places = Array.isArray(window.placeRevisitRendered) ? window.placeRevisitRendered : [];
            const place = places[index];
            if (!place) return;
            const status = getNutritionStatus();
            const advice = getNextMealSuggestion(new Date(), status.caloriesLeft);
            const revisitAdvice = getPlaceRevisitAdvice(place, status);
            currentMealPlan = {
                id: `place_plan_${Date.now()}`,
                route: "revisit",
                routeLabel: `回訪 ${place.name}`,
                foodName: revisitAdvice.foodName || place.lastMeal || place.name,
                focus: revisitAdvice.focus,
                targetKcal: revisitAdvice.targetKcal,
                mealSlot: advice.slot || getMealSlot(new Date()),
                time: advice.time || "",
                body: revisitAdvice.body,
                placeName: place.name,
                placeAddress: place.address || "",
                createdAt: new Date().toISOString()
            };
            if (currentUser) localStorage.setItem(dailyKey('currentMealPlan'), JSON.stringify(currentMealPlan));
            renderSelectedDecisionCard({ title: `回訪 ${place.name}`, body: revisitAdvice.body }, currentMealPlan.foodName, currentMealPlan);
            switchTabById('tab-photo');
            const quickInput = document.getElementById('quickFoodName');
            const manualInput = document.getElementById('manualFoodName');
            const placeInput = document.getElementById('mealPlaceName');
            const addressInput = document.getElementById('mealPlaceAddress');
            if (quickInput) quickInput.value = currentMealPlan.foodName;
            if (manualInput) manualInput.value = currentMealPlan.foodName;
            if (placeInput) placeInput.value = place.name || "";
            if (addressInput) addressInput.value = place.address || "";
            setCoachMessage(`已建立「${place.name}」回訪計畫：${revisitAdvice.body} 到店後先拍飯前照，塔塔會用實際份量校正熱量。`);
        }

        function handlePlaceRevisitSearch(value) {
            placeRevisitQuery = String(value || "");
            renderPlaceRevisitList();
        }

        function togglePlaceRevisitHighOnly() {
            placeRevisitHighOnly = !placeRevisitHighOnly;
            if (placeRevisitHighOnly) placeRevisitIncompleteOnly = false;
            renderPlaceRevisitList();
        }

        function togglePlaceRevisitGoalFitOnly() {
            placeRevisitGoalFitOnly = !placeRevisitGoalFitOnly;
            if (placeRevisitGoalFitOnly) placeRevisitIncompleteOnly = false;
            renderPlaceRevisitList();
        }

        function togglePlaceRevisitIncompleteOnly() {
            placeRevisitIncompleteOnly = !placeRevisitIncompleteOnly;
            if (placeRevisitIncompleteOnly) {
                placeRevisitHighOnly = false;
                placeRevisitGoalFitOnly = false;
            }
            renderPlaceRevisitList();
        }

        function setPlaceRevisitCategory(category = "all") {
            const valid = new Set(getPlaceDietCategoryOptions().map(option => option.key));
            placeRevisitCategory = valid.has(category) ? category : "all";
            renderPlaceRevisitList();
        }

        function renderMemoryPhotoTimeline(container, meals, isToday) {
            if (!container) return;
            const photos = [];
            (meals || []).forEach((meal, index) => {
                if (meal.photoBefore || meal.photo) {
                    photos.push({
                        index,
                        src: meal.photoBefore || meal.photo,
                        label: meal.photoBefore ? "飯前" : "餐點",
                        meal
                    });
                }
                if (meal.photoAfter) {
                    photos.push({
                        index,
                        src: meal.photoAfter,
                        label: "飯後",
                        meal,
                        after: true
                    });
                }
            });
            if (!photos.length) {
                container.innerHTML = `
                    <div class="memory-photo-title"><strong>照片回憶流</strong><span>${isToday ? '等第一張飯前照' : '這天沒有照片'}</span></div>
                    <div class="today-slot-empty">${isToday ? '拍下飯前照後，這裡會自動留下照片、餐別和熱量，之後能回看每一天吃過什麼。' : '這天沒有留下餐點照片。'}</div>
                `;
                return;
            }
            container.innerHTML = `
                <div class="memory-photo-title"><strong>照片回憶流</strong><span>${photos.length} 張照片</span></div>
                <div class="memory-photo-rail">
                    ${photos.map(photo => {
                        const meal = photo.meal || {};
                        const title = meal.name || "餐點照片";
                        const slot = meal.mealSlot || "餐點";
                        const compare = meal.photoBefore && meal.photoAfter ? "前後都有" : (photo.after ? "飯後保存" : "等飯後可補拍");
                        const planMeta = meal.mealPlan?.routeLabel ? `${meal.mealPlan.routeLabel} · ${meal.mealPlan.focus || '塔塔計畫'}` : "";
                        const placeMeta = formatPlaceMemory(meal);
                        return `
                            <button class="memory-photo-card" type="button" onclick="openMealPhoto(${photo.index})">
                                <img src="${photo.src}" alt="${title}${photo.label}照片">
                                <div class="memory-photo-card-body">
                                    <div class="memory-photo-card-title">${title}</div>
                                    <div class="memory-photo-card-meta">${slot} · ${meal.kcal || meal.calories || 0} kcal${placeMeta ? ` · ${placeMeta}` : ''}${planMeta ? ` · ${planMeta}` : ''}</div>
                                    <div class="memory-photo-badge-row">
                                        <span class="memory-photo-badge${photo.after ? ' after' : ''}">${photo.label}</span>
                                        <span class="memory-photo-badge">${compare}</span>
                                    </div>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        function renderTodaySlotDetail(slot, meals, isToday) {
            const slotMeals = meals
                .map((meal, index) => ({ meal, index }))
                .filter(entry => (entry.meal.mealSlot || "餐點") === slot);
            const total = slotMeals.reduce((sum, entry) => sum + Number(entry.meal.kcal || 0), 0);
            const filledClass = slotMeals.length ? ' filled' : '';
            if (!slotMeals.length) {
                const hint = isToday
                    ? `${slot}還沒留下照片。吃之前拍一張，塔塔才知道這餐實際份量。`
                    : `${slot}沒有留下餐點照片。`;
                return `
                    <div class="today-slot-detail">
                        <div class="today-slot-head">
                            <div class="today-slot-name">${slot}</div>
                            <div class="today-slot-total">未記錄</div>
                        </div>
                        <div class="today-slot-empty">${hint}</div>
                    </div>
                `;
            }
            const rows = slotMeals.map(({ meal, index }) => {
                const src = meal.photoBefore || meal.photo || meal.photoAfter || "";
                const thumb = src
                    ? `<img class="today-slot-thumb" src="${src}" alt="${meal.name}照片">`
                    : `<div class="today-slot-thumb" aria-hidden="true"></div>`;
                const photoState = meal.photoBefore && meal.photoAfter
                    ? (meal.comparisonReliable === false ? "飯後照已保存" : "已完成前後比對")
                    : (meal.photoBefore ? "已拍餐前照" : "已記錄餐點");
                const compareText = meal.comparisonNote ? ` · ${shortNextAdvice(meal.comparisonNote)}` : "";
                const planText = meal.mealPlan?.routeLabel ? ` · 依${meal.mealPlan.routeLabel}計畫` : "";
                const afterAction = isToday && (meal.photoBefore || meal.photo) && !meal.photoAfter
                    ? `<button class="today-slot-after-btn" type="button" onclick="return startAfterPhotoForMeal(${index}, event)">飯後補拍</button>`
                    : "";
                return `
                    <div class="today-slot-meal" onclick="openMealPhoto(${index})">
                        ${thumb}
                        <div>
                            <div class="today-slot-meal-title">${meal.name}</div>
                            <div class="today-slot-meal-meta">${photoState}${planText}${compareText}</div>
                            ${afterAction}
                        </div>
                        <div class="today-slot-total">${meal.kcal || 0} kcal</div>
                    </div>
                `;
            }).join('');
            return `
                <div class="today-slot-detail${filledClass}">
                    <div class="today-slot-head">
                        <div class="today-slot-name">${slot}</div>
                        <div class="today-slot-total">${total} kcal</div>
                    </div>
                    ${rows}
                </div>
            `;
        }

        function renderHistoryItem(record, index) {
            const coverPhoto = record.photoBefore || record.photo || record.photoAfter;
            const photo = coverPhoto ? `<img class="history-thumb" src="${coverPhoto}" alt="${record.name}照片">` : `<div class="history-thumb" aria-hidden="true"></div>`;
            const sourceText = record.source === 'ai_before_after'
                ? '餐前餐後比對'
                : (record.source === 'ai_before_after_photo_only' ? '飯後照已保存' : (record.source === 'ai_photo' ? 'AI 拍照估算' : '餐點紀錄'));
            const slotText = record.mealSlot ? `${record.mealSlot} · ` : '';
            const photoText = record.photoAfter ? ' · 已補飯後照' : (record.photoBefore ? ' · 餐前照' : '');
            const compareBadge = record.photoBefore && record.photoAfter
                ? `<span class="photo-status-badge">${record.comparisonReliable === false ? '飯後保存' : '前後比對'}</span>`
                : (record.photoBefore ? '<span class="photo-status-badge">餐前照</span>' : '');
            const nutritionText = `蛋白 ${record.protein || 0}g · 纖維 ${record.fiber || 0}g · 糖 ${record.sugar || 0}g · 鈉 ${record.sodium || 0}mg`;
            const compareLine = record.comparisonNote ? `<div style="font-size:11px; color:var(--color-muted); margin-top:4px;">${record.comparisonNote}</div>` : '';
            const planLine = record.mealPlan?.routeLabel ? `<div style="font-size:11px; color:var(--color-muted); margin-top:4px;">塔塔計畫：${record.mealPlan.routeLabel} · ${record.mealPlan.focus || '均衡'} · 目標 ${record.mealPlan.targetKcal || '待估'} kcal</div>` : '';
            const decisionMemory = getMealDecisionMemory(record);
            const decisionLine = decisionMemory?.why ? `<div style="font-size:11px; color:var(--color-muted); margin-top:4px;">當時理由：${decisionMemory.why}</div>` : '';
            const placeLine = formatPlaceMemory(record) ? `<div class="place-memory-line"><strong>${formatPlaceMemory(record)}</strong></div>` : '';
            const nextAdvice = shortNextAdvice(record.nextAdvice);
            const nextAdviceLine = nextAdvice ? `<div class="history-next-advice">餐後建議：${nextAdvice}</div>` : '';
            return `<div class="history-item with-photo" onclick="openMealPhoto(${index})">
                ${photo}
                <div><div style="font-weight:700;">${record.time ? `${record.time} · ` : ''}${slotText}${record.name}${compareBadge}</div><div style="font-size:12px; color:var(--color-muted);">${sourceText}${photoText}${record.corrected ? ' · 已修正' : ''}</div><div style="font-size:11px; color:var(--color-muted); margin-top:4px;">${nutritionText}</div>${placeLine}${planLine}${decisionLine}${compareLine}${nextAdviceLine}</div>
                <div style="color: var(--color-salmon-pink); font-weight:800;">+${record.kcal} kcal</div>
            </div>`;
        }

        function openMealPhoto(index) {
            const sourceRecords = memoryRenderedRecords.length ? memoryRenderedRecords : (userData.dietRecords || []);
            const record = sourceRecords[index];
            if (!record) return;
            const modal = document.getElementById('mealPhotoModal');
            const image = document.getElementById('photoModalImage');
            const gallery = document.getElementById('photoModalGallery');
            const photoPairs = [
                record.photoBefore ? { label: "開飯前", src: record.photoBefore } : null,
                record.photoAfter ? { label: "吃完後", src: record.photoAfter } : null
            ].filter(Boolean);
            const modalPhoto = record.photoBefore || record.photo || record.photoAfter;
            if (gallery && photoPairs.length >= 2) {
                gallery.innerHTML = photoPairs.map(photo => `<div class="photo-compare-card"><img src="${photo.src}" alt="${record.name}${photo.label}照片"><div class="photo-compare-label">${photo.label}</div></div>`).join('');
                gallery.style.display = 'grid';
                image.removeAttribute('src');
                image.style.display = 'none';
            } else {
                if (gallery) { gallery.innerHTML = ''; gallery.style.display = 'none'; }
                if (modalPhoto) { image.src = modalPhoto; image.style.display = 'block'; }
                else { image.removeAttribute('src'); image.style.display = 'none'; }
            }
            document.getElementById('photoModalTitle').innerText = record.name;
            const items = Array.isArray(record.items) && record.items.length
                ? record.items.map(item => `${item.name}（${item.portion || '份量未明'}）— ${item.calories || 0} kcal`).join('<br>')
                : '沒有照片品項明細。';
            const compare = record.beforeCalories
                ? `<br>${record.comparisonNote || `餐前估算 ${record.beforeCalories} kcal · 餐後剩餘 ${record.afterCalories || 0} kcal · 實際吃下 ${record.kcal} kcal`}`
                : '';
            const plan = record.mealPlan?.routeLabel
                ? `<br>塔塔計畫：${record.mealPlan.routeLabel} · ${record.mealPlan.focus || '均衡'} · 目標約 ${record.mealPlan.targetKcal || '待估'} kcal`
                : '';
            const decisionMemory = getMealDecisionMemory(record);
            const decision = decisionMemory
                ? `<br>當時理由：${decisionMemory.why || '依今日缺口建議'}${decisionMemory.photoCheck ? `<br>照片確認：${decisionMemory.photoCheck}` : ''}`
                : '';
            const advice = record.nextAdvice ? `<br>${record.nextAdvice}` : '';
            const place = formatPlaceMemory(record) ? `<br>餐廳記憶：${formatPlaceMemory(record)}` : '';
            const riskText = `${record.sugar || 0}g 糖 · ${record.sodium || 0}mg 鈉`;
            document.getElementById('photoModalDetails').innerHTML = `${record.mealSlot || '餐點'} ${record.time || ''}<br>${record.kcal} kcal · 蛋白質 ${record.protein || 0}g · 纖維 ${record.fiber || 0}g · 碳水 ${record.carbs || 0}g · 脂肪 ${record.fat || 0}g · ${riskText}${place}${compare}${plan}${decision}<br>${items}${advice}`;
            modal.style.display = 'flex';
        }

        const GERD_SAFE_MEAL_PLAN = [
            { day: 1, breakfast: "燕麥粥 + 水煮蛋 + 香蕉", lunch: "清蒸魚 + 白飯半碗 + 燙青菜", dinner: "雞胸蔬菜湯 + 地瓜" },
            { day: 2, breakfast: "吐司 + 蒸蛋 + 溫豆漿", lunch: "舒肥雞便當半飯 + 醬料分開", dinner: "豆腐青菜粥 + 燙菠菜" },
            { day: 3, breakfast: "白粥 + 荷包蛋 + 青菜", lunch: "烤魚定食少醬 + 味噌湯半碗", dinner: "雞肉湯麵少油 + 青菜" },
            { day: 4, breakfast: "地瓜 + 無糖優格少量 + 溫水", lunch: "雞胸飯糰 + 茶葉蛋 + 燙青菜", dinner: "蒸蛋 + 白飯半碗 + 菇菇湯" },
            { day: 5, breakfast: "燕麥 + 香蕉 + 水煮蛋", lunch: "清蒸雞腿去皮便當 + 少醬", dinner: "豆腐魚片粥 + 青菜" },
            { day: 6, breakfast: "吐司 + 雞蛋 + 溫豆漿", lunch: "烤魚 + 地瓜 + 燙青菜", dinner: "雞胸蔬菜盤 + 白飯少量" },
            { day: 7, breakfast: "白粥 + 蒸蛋 + 青菜", lunch: "舒肥雞沙拉 + 地瓜", dinner: "清湯豆腐 + 魚肉 + 燙青菜" }
        ];

        function getGerdModeKey() {
            return currentUser ? `paipachi:${currentUser}:gerdMode` : "paipachi:guest:gerdMode";
        }

        function isGerdModeEnabled() {
            try { return localStorage.getItem(getGerdModeKey()) === "1"; }
            catch (error) { return false; }
        }

        function setGerdMode(enabled) {
            try { localStorage.setItem(getGerdModeKey(), enabled ? "1" : "0"); } catch (error) {}
            renderGerdModeCard();
            renderGerdEstimateCard();
            renderTodayDecisionBrief(getNutritionStatus());
            renderMealCountdownCard(getNutritionStatus());
            showToast(enabled ? "已開啟溫和養胃，塔塔會優先提供低刺激餐食。" : "已關閉溫和養胃。");
        }

        function toggleGerdMode() {
            setGerdMode(!isGerdModeEnabled());
            return false;
        }

        function getGerdTextFromMeal(meal = {}) {
            return [
                meal.name,
                meal.finalName,
                meal.foodName,
                meal.notes,
                ...(Array.isArray(meal.items) ? meal.items.map(item => `${item.name || ""} ${item.portion || ""}`) : [])
            ].filter(Boolean).join(" ");
        }

        function classifyGerdSafety(input = "") {
            const text = String(input || "").toLowerCase();
            const avoid = [
                "辣", "麻辣", "酸辣", "泡菜", "咖哩", "番茄", "茄汁", "檸檬", "柑橘", "柳橙",
                "可樂", "汽水", "啤酒", "酒", "咖啡", "拿鐵", "奶茶", "巧克力", "薄荷",
                "炸", "鹹酥", "薯條", "雞排", "油條", "火鍋", "燒烤", "烤肉"
            ];
            const caution = [
                "滷", "醬", "湯", "拉麵", "牛肉麵", "羹", "起司", "奶油", "鮭魚", "牛肉",
                "豬肉", "排骨", "水餃", "炒", "便當", "甜點", "蛋糕", "餅乾"
            ];
            const safe = [
                "白粥", "粥", "燕麥", "地瓜", "白飯", "蒸蛋", "水煮蛋", "茶葉蛋", "豆腐",
                "雞胸", "舒肥雞", "清蒸", "烤魚", "魚", "燙青菜", "青菜", "菠菜", "菇",
                "香蕉", "吐司", "溫豆漿", "無糖豆漿", "清湯"
            ];
            if (avoid.some(word => text.includes(word))) {
                return { level: "avoid", label: "建議避開", reason: "含辛辣、酸、咖啡因、酒精、碳酸或高油脂線索，容易誘發逆流。", replacement: getGerdReplacement(text) };
            }
            if (caution.some(word => text.includes(word))) {
                return { level: "caution", label: "少量觀察", reason: "可能偏油、偏鹹或湯汁較多，建議少醬、少湯、份量放小。", replacement: getGerdReplacement(text) };
            }
            if (safe.some(word => text.includes(word))) {
                return { level: "safe", label: "相對友善", reason: "偏溫和、低刺激，較適合溫和養胃方向。", replacement: "" };
            }
            return { level: "caution", label: "先少量", reason: "塔塔還不確定刺激程度，先用少油、少醬、七分飽處理。", replacement: "可改成清蒸魚、雞胸、豆腐、白粥、地瓜或燙青菜。" };
        }

        function getGerdReplacement(text = "") {
            if (/可樂|汽水|啤酒|酒|咖啡|拿鐵|奶茶|巧克力|薄荷/.test(text)) return "改成溫水、無糖豆漿或不冰無糖茶。";
            if (/辣|麻辣|酸辣|泡菜|咖哩|番茄|檸檬|柑橘|柳橙/.test(text)) return "改成清湯、蒸蛋、豆腐或清蒸魚。";
            if (/炸|鹹酥|薯條|雞排|油條|燒烤|烤肉/.test(text)) return "改成清蒸、烤魚、舒肥雞或水煮蛋白質。";
            if (/湯|拉麵|牛肉麵|羹|火鍋/.test(text)) return "湯底少喝，主食半份，蛋白質和青菜保留。";
            return "可改成白粥、地瓜、蒸蛋、雞胸、豆腐或燙青菜。";
        }

        function applyGerdToMeal(meal = {}) {
            const safety = classifyGerdSafety(getGerdTextFromMeal(meal));
            const items = Array.isArray(meal.items) ? meal.items.map(item => {
                const itemSafety = classifyGerdSafety(`${item.name || ""} ${item.portion || ""}`);
                return { ...item, gerdSafe: itemSafety.level, gerdLabel: itemSafety.label };
            }) : [];
            const healthFlags = new Set(Array.isArray(meal.healthFlags) ? meal.healthFlags : []);
            if (safety.level === "avoid") healthFlags.add("gerd_avoid");
            if (safety.level === "caution") healthFlags.add("gerd_caution");
            return {
                ...meal,
                items,
                gerdSafe: safety.level,
                gerdLabel: safety.label,
                gerdReason: safety.reason,
                gerdReplacement: safety.replacement,
                healthFlags: [...healthFlags]
            };
        }

        function renderGerdModeCard() {
            const card = document.getElementById("gerdModeCard");
            if (!card) return;
            const enabled = isGerdModeEnabled();
            const todayPlan = GERD_SAFE_MEAL_PLAN[new Date().getDay()] || GERD_SAFE_MEAL_PLAN[0];
            card.classList.toggle("active", enabled);
            card.innerHTML = `
                <div class="gerd-mode-top">
                    <div>
                        <div class="gerd-mode-kicker">日常養身模式</div>
                        <div class="gerd-mode-title">${enabled ? "溫和養胃已開啟" : "需要吃得溫和一點嗎？"}</div>
                    </div>
                    <button class="gerd-mode-toggle${enabled ? " active" : ""}" type="button" onclick="toggleGerdMode()">${enabled ? "關閉" : "開啟"}</button>
                </div>
                <div class="gerd-mode-body">${enabled ? "塔塔會優先建議溫熱、柔軟、少油、少辣、少酸的餐食，並提供更溫和的替代吃法。" : "想讓這幾餐清爽、溫和、少刺激，可以開啟養胃方向；這是日常營養建議，不是治療模式。"}</div>
                <details class="gerd-plan-details">
                    <summary>查看 7 天溫和菜單</summary>
                    <div class="gerd-plan-grid">
                        ${GERD_SAFE_MEAL_PLAN.map(day => `<div class="gerd-plan-day"><strong>D${day.day}</strong><span>早：${day.breakfast}</span><span>午：${day.lunch}</span><span>晚：${day.dinner}</span></div>`).join("")}
                    </div>
                </details>
                <div class="gerd-mode-today">今日可走：${todayPlan.breakfast} / ${todayPlan.lunch} / ${todayPlan.dinner}</div>
            `;
        }

        function renderGerdEstimateCard() {
            const card = document.getElementById("gerdEstimateCard");
            if (!card) return;
            if (!isGerdModeEnabled() || !selectedMeal || !selectedMeal.name) {
                card.classList.remove("active", "safe", "caution", "avoid");
                card.innerHTML = "";
                return;
            }
            selectedMeal = applyGerdToMeal(selectedMeal);
            const level = selectedMeal.gerdSafe || "caution";
            card.className = `gerd-estimate-card active ${level}`;
            const replacement = selectedMeal.gerdReplacement ? `<div class="gerd-estimate-replace"><strong>替代：</strong>${selectedMeal.gerdReplacement}</div>` : "";
            card.innerHTML = `
                <div class="gerd-estimate-top">
                    <span>${selectedMeal.gerdLabel || "少量觀察"}</span>
                    <strong>GERD</strong>
                </div>
                <div class="gerd-estimate-body">${selectedMeal.gerdReason || "先少量、少油、少醬，吃完 2-3 小時內不要躺平。"}</div>
                ${replacement}
            `;
        }

        const originalEstimateFoodByTextForGerd = estimateFoodByText;
        estimateFoodByText = function estimateFoodByTextWithGerd(text) {
            const meal = originalEstimateFoodByTextForGerd(text);
            return meal ? applyGerdToMeal(meal) : meal;
        };

        const originalNormalizeMealEstimateForGerd = normalizeMealEstimate;
        normalizeMealEstimate = function normalizeMealEstimateWithGerd(payload, source) {
            return applyGerdToMeal(originalNormalizeMealEstimateForGerd(payload, source));
        };

        const originalGetTaiwanFoodDatabaseForGerd = getTaiwanFoodDatabase;
        getTaiwanFoodDatabase = function getTaiwanFoodDatabaseWithGerd() {
            return originalGetTaiwanFoodDatabaseForGerd().map(entry => {
                const safety = classifyGerdSafety([entry.name, ...(entry.aliases || [])].join(" "));
                return { ...entry, gerdSafe: safety.level };
            });
        };

        const originalGetTataMealTemplatesForGerd = getTataMealTemplates;
        getTataMealTemplates = function getTataMealTemplatesWithGerd(status, advice) {
            const templates = originalGetTataMealTemplatesForGerd(status, advice);
            if (!isGerdModeEnabled()) return templates;
            return templates
                .map(template => {
                    const safety = classifyGerdSafety(`${template.foodName || ""} ${template.body || ""}`);
                    if (safety.level !== "avoid") {
                        return {
                            ...template,
                            gerdSafe: safety.level,
                            body: `${template.body} 胃食道逆流模式：少油少醬，飯後 2-3 小時不要躺平。`
                        };
                    }
                    return {
                        ...template,
                        foodName: "清蒸魚豆腐青菜半飯",
                        body: `原建議可能刺激胃酸，改成清蒸魚或豆腐 + 燙青菜 + 半碗飯。${safety.replacement}`,
                        query: "胃食道逆流 清蒸 魚 豆腐 青菜",
                        gerdSafe: "safe"
                    };
                });
        };

        const originalGetNextMealSuggestionForGerd = getNextMealSuggestion;
        getNextMealSuggestion = function getNextMealSuggestionWithGerd(date, caloriesLeft, statusOverride) {
            const advice = originalGetNextMealSuggestionForGerd(date, caloriesLeft, statusOverride);
            if (!isGerdModeEnabled()) return advice;
            const safeFood = "清蒸魚、雞胸、豆腐、白粥、地瓜或燙青菜";
            return {
                ...advice,
                focus: `${advice.focus || "均衡"} + 護胃`,
                food: safeFood,
                text: `${advice.text || ""} 胃食道逆流模式已開啟：先避開辛辣、酸、咖啡、酒、碳酸和油炸，下一餐優先 ${safeFood}。`
            };
        };

        const originalSaveMealForGerd = saveMeal;
        saveMeal = function saveMealWithGerd(meal) {
            return originalSaveMealForGerd(applyGerdToMeal(meal));
        };

        const originalApplySelectedMealToUIForGerd = applySelectedMealToUI;
        applySelectedMealToUI = function applySelectedMealToUIWithGerd() {
            selectedMeal = applyGerdToMeal(selectedMeal);
            originalApplySelectedMealToUIForGerd();
            renderGerdEstimateCard();
        };

        const originalEnterMainApplicationForGerd = enterMainApplication;
        enterMainApplication = function enterMainApplicationWithGerd() {
            originalEnterMainApplicationForGerd();
            renderGerdModeCard();
            renderGerdEstimateCard();
        };

        window.toggleGerdMode = toggleGerdMode;
        window.setGerdMode = setGerdMode;

        initAuth();

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(console.warn);
            });
        }
