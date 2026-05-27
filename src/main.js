import vkBridge from '@vkontakte/vk-bridge';

// ==========================================
// 1. СОСТОЯНИЕ ИГРЫ (STATE)
// ==========================================
let gameData = {
    coins: 0,
    clickPower: 1,
    upgradeCost: 10,
    hiredFriends: {}, 
    invitedCount: 0,
    usedPromos: [], 
    cps: 0 
};

// Кэш данных из API ВКонтакте
let vkFriendsList = [];
let vkLeaderboardCache = null;
let isVkFriendsLoaded = false;

// ==========================================
// 2. ЭЛЕМЕНТЫ ИНТЕРФЕЙСА (DOM)
// ==========================================
const clickObject = document.getElementById('click-object');
const coinsText = document.getElementById('coins');
const upgradeBtn = document.getElementById('upgrade-btn');
const upgradeCostText = document.getElementById('upgrade-cost');
const usernameText = document.getElementById('username');
const avatarImg = document.getElementById('avatar');
const leaderboardBtn = document.getElementById('leaderboard-btn');

const shopModal = document.getElementById('shop-modal');
const shopOpenBtn = document.getElementById('shop-open-btn');
const shopCloseBtn = document.getElementById('shop-close-btn');
const friendsContainer = document.getElementById('friends-list-container');

const promoInput = document.getElementById('promo-input');
const promoCheckBtn = document.getElementById('promo-check-btn');

const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
const leaderboardContainer = document.getElementById('leaderboard-list-container');

// ==========================================
// 3. ЛОГИКА ОБНОВЛЕНИЯ ИНТЕРФЕЙСА (UI РЕНДЕРИНГ)
// ==========================================
function updateUI() {
    if (coinsText) coinsText.innerText = Math.floor(gameData.coins);
    if (upgradeCostText) upgradeCostText.innerText = gameData.upgradeCost;
    
    if (upgradeBtn) {
        if (gameData.coins >= gameData.upgradeCost) {
            upgradeBtn.classList.add('active');
        } else {
            upgradeBtn.classList.remove('active');
        }
    }
}

function createFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.innerText = text;
    el.style.position = 'absolute';
    el.style.left = `${x - 20}px`;
    el.style.top = `${y - 40}px`;
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
}

function updateShopButtonsState() {
    if (!friendsContainer) return;
    const buttons = friendsContainer.querySelectorAll('.buy-worker-btn:not(#invite-friend-action-btn)');
    buttons.forEach(btn => {
        const cost = parseInt(btn.getAttribute('data-cost'), 10);
        if (gameData.coins >= cost) {
            if (btn.classList.contains('locked')) {
                btn.classList.remove('locked');
                btn.classList.add('available');
            }
        } else {
            if (btn.classList.contains('available')) {
                btn.classList.remove('available');
                btn.classList.add('locked');
            }
        }
    });
}

function renderFriendsList() {
    if (!friendsContainer) return;
    
    // Сразу очищаем контейнер от дефолтной надписи "Загрузка..."
    friendsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // 1. Отрисовка реальных друзей (если ВК их отдал)
    if (vkFriendsList && vkFriendsList.length > 0) {
        vkFriendsList.forEach(friend => {
            const isPlaying = friend.user_apps === true;
            const cost = isPlaying ? 22900 : 9000;
            const incomeText = isPlaying ? "12 500 корон/час" : "6 800 корон/час";
            const typeKey = isPlaying ? "active" : "newbie";
            const isHired = gameData.hiredFriends[friend.id] !== undefined;

            const island = document.createElement('div');
            island.className = 'friend-island';
            island.innerHTML = `
                <div class="friend-info">
                    <div>${friend.first_name} ${friend.last_name}</div>
                    <div style="font-size:12px; color:#888888; font-weight:normal; margin-top:4px;">Доход: +${incomeText}</div>
                </div>
            `;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'friend-actions';

            if (isHired) {
                actionsDiv.innerHTML = '<span class="worker-owned">Куплен</span>';
            } else {
                actionsDiv.innerHTML = `<span class="friend-cost">${cost} 👑</span>`;
                const buyBtn = document.createElement('button');
                buyBtn.className = `buy-worker-btn ${gameData.coins >= cost ? 'available' : 'locked'}`;
                buyBtn.innerText = 'Купить';
                buyBtn.setAttribute('data-cost', cost);
                buyBtn.onclick = () => {
                    if (gameData.coins >= cost) {
                        gameData.coins -= cost;
                        gameData.hiredFriends[friend.id] = typeKey;
                        recalculateCPS();
                        updateUI();
                        renderFriendsList();
                        saveGame();
                    }
                };
                actionsDiv.appendChild(buyBtn);
            }
            island.appendChild(actionsDiv);
            fragment.appendChild(island);
        });
    } else {
        // Если друзей нет (тестовая группа или пустой профиль) — выводим красивый текст вместо вечной загрузки
        const noFriendsDiv = document.createElement('div');
        noFriendsDiv.className = 'shop-loading';
        noFriendsDiv.style.padding = '10px 0';
        noFriendsDiv.style.fontSize = '14px';
        noFriendsDiv.style.color = '#ccc';
        noFriendsDiv.innerText = 'Доступных друзей не найдено. Нанимайте рекрутов ниже!';
        fragment.appendChild(noFriendsDiv);
    }

    // 2. Блок найма рекрута (должен быть ВСЕГДА)
    const invitedCount = gameData.invitedCount || 0;
    const inviteCost = 5000 + (invitedCount * 2500);

    const inviteIsland = document.createElement('div');
    inviteIsland.className = 'friend-island invite-special-island';
    inviteIsland.style.border = '1px dashed #ffd700';
    inviteIsland.innerHTML = `
        <div class="friend-info">
            <div style="color: #ffd700;">➕ Нанять рекрута</div>
            <div style="font-size:12px; color:#aaa; font-weight:normal; margin-top:4px;">Доход: +4 500 корон/час</div>
        </div>
        <div class="friend-actions">
            <span class="friend-cost" style="color: #ffd700;">${inviteCost} 👑</span>
            <button class="buy-worker-btn" id="invite-friend-action-btn" style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: #000;">
                Позвать
            </button>
        </div>
    `;
    fragment.appendChild(inviteIsland);

    friendsContainer.appendChild(fragment);

    // Привязка логики к кнопке рекрута
    const inviteBtn = document.getElementById('invite-friend-action-btn');
    if (inviteBtn) {
        if (gameData.coins >= inviteCost) {
            inviteBtn.classList.add('available');
        } else {
            inviteBtn.classList.add('locked');
            inviteBtn.style.opacity = '0.6';
        }

        inviteBtn.onclick = () => {
            if (gameData.coins < inviteCost) {
                vkBridge.send("VKWebAppTapticNotificationOccurred", { type: "error" }).catch(() => {});
                alert("Не хватает корон для найма рекрута!");
                return;
            }

            vkBridge.send("VKWebAppShowInviteBox", {})
                .then((data) => {
                    if (data.success) {
                        gameData.coins -= inviteCost;
                        gameData.invitedCount += 1;
                        gameData.hiredFriends[`invited_rec_${Date.now()}`] = 'newbie';
                        recalculateCPS();
                        updateUI();
                        renderFriendsList();
                        saveGame();
                        vkBridge.send("VKWebAppTapticNotificationOccurred", { type: "success" }).catch(() => {});
                    }
                })
                .catch(err => console.log("Окно закрыто в тест-режиме:", err));
        };
    }
}

function renderLeaderboardList(players) {
    if (!leaderboardContainer) return;

    if (!players || players.length === 0) {
        leaderboardContainer.innerHTML = '<div class="shop-loading">Список лидеров пуст.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    players.forEach((player, index) => {
        const island = document.createElement('div');
        island.className = 'friend-island'; 

        let name = "Игрок ВК";
        if (player.user) {
            name = `${player.user.first_name || ''} ${player.user.last_name || ''}`.trim();
        }

        const rank = player.place || (index + 1);
        const score = player.score || player.value || 0;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'friend-info';
        infoDiv.innerHTML = `<div><span style="color:#ffd700; margin-right:8px;">#${rank}</span> ${name}</div>`;
        island.appendChild(infoDiv);

        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'friend-cost';
        scoreDiv.innerText = `${Math.floor(score).toLocaleString()} 👑`;
        island.appendChild(scoreDiv);

        fragment.appendChild(island);
    });

    leaderboardContainer.innerHTML = '';
    leaderboardContainer.appendChild(fragment);
}

// ==========================================
// 4. ИГРОВАЯ МЕХАНИКА И РАСЧЕТЫ
// ==========================================
function recalculateCPS() {
    let totalCps = 0;
    for (let id in gameData.hiredFriends) {
        let type = gameData.hiredFriends[id];
        if (type === 'newbie') {
            totalCps += 6800 / 3600;
        } else if (type === 'active') {
            totalCps += 12500 / 3600;
        }
    }
    gameData.cps = totalCps;
}

function saveGame() {
    vkBridge.send("VKWebAppStorageSet", {
        key: "king_clicker_save",
        value: JSON.stringify(gameData)
    })
    .then(() => console.log("Прогресс сохранен в VK Storage"))
    .catch(err => console.error("Ошибка автосохранения:", err));
}

// ==========================================
// 5. ИНИЦИАЛИЗАЦИЯ И ЗАГРУЗКА ПРИЛОЖЕНИЯ
// ==========================================
vkBridge.send("VKWebAppInit", {})
    .then(() => vkBridge.send("VKWebAppStorageGet", { keys: ["king_clicker_save"] }))
    .then(saveResult => {
        let hasSave = false;

        if (saveResult && saveResult.keys && saveResult.keys[0] && saveResult.keys[0].value) {
            gameData = JSON.parse(saveResult.keys[0].value);
            if (!gameData.hiredFriends) gameData.hiredFriends = {};
            if (!gameData.invitedCount) gameData.invitedCount = 0;
            if (!gameData.usedPromos) gameData.usedPromos = [];
            recalculateCPS();
            updateUI();
            hasSave = true;
        }

        if (hasSave && gameData.cachedUser && gameData.isFirstLaunch === false) {
            if (usernameText) usernameText.innerText = gameData.cachedUser.name;
            if (avatarImg && gameData.cachedUser.photo) avatarImg.src = gameData.cachedUser.photo;
            if (gameData.cachedFriends) {
                vkFriendsList = gameData.cachedFriends;
                isVkFriendsLoaded = true;
            }
            return; 
        }

        return Promise.all([
            vkBridge.send("VKWebAppGetUserInfo").catch(() => null),
            vkBridge.send("VKWebAppGetFriends").catch(() => ({ users: [] }))
        ]).then(([user, friendsResult]) => {
            gameData.cachedUser = { name: "Король Кликов", photo: "" };

            if (user) {
                const fullName = `${user.first_name} ${user.last_name}`;
                if (usernameText) usernameText.innerText = fullName;
                if (avatarImg && user.photo_100) avatarImg.src = user.photo_100;
                gameData.cachedUser.name = fullName;
                gameData.cachedUser.photo = user.photo_100 || "";
            }

            if (friendsResult && friendsResult.users) {
                vkFriendsList = friendsResult.users;
                isVkFriendsLoaded = true;
                gameData.cachedFriends = friendsResult.users; 
            } else {
                isVkFriendsLoaded = true;
            }

            gameData.isFirstLaunch = false;
            saveGame();
        });
    })
    .catch(err => {
        console.error("Ошибка инициализации:", err);
        if (usernameText) usernameText.innerText = "Король Кликов";
    });

// Таймеры игрового цикла
setInterval(() => {
    if (gameData.cps > 0) {
        gameData.coins += gameData.cps;
        updateUI();
        if (shopModal && !shopModal.classList.contains('hidden')) {
            updateShopButtonsState();
        }
    }
}, 1000);

setInterval(saveGame, 7000);

// ==========================================
// 6. СЛУШАТЕЛИ СОБЫТИЙ (ОКНА И КНОПКИ)
// ==========================================

// Магазин
if (shopOpenBtn) {
    shopOpenBtn.addEventListener('click', () => {
        if (shopModal) shopModal.classList.remove('hidden');
        renderFriendsList();
    });
}
if (shopCloseBtn) {
    shopCloseBtn.addEventListener('click', () => {
        if (shopModal) shopModal.classList.add('hidden');
    });
}

// Лидерборд
if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
        if (leaderboardModal) leaderboardModal.classList.remove('hidden');
        
        if (vkLeaderboardCache) {
            renderLeaderboardList(vkLeaderboardCache);
        } else {
            if (leaderboardContainer) leaderboardContainer.innerHTML = '<div class="shop-loading">Загрузка таблицы лидеров...</div>';
        }

        // Пытаемся обновить очки, но если мы в тестовой среде — ловим ошибку
        vkBridge.send("VKWebAppSetLeaderboardBox", { value: Math.floor(gameData.coins) })
            .then(() => vkBridge.send("VKWebAppGetLeaderboard", { global: 1, count: 10 }))
            .then(data => {
                if (data && data.items) {
                    vkLeaderboardCache = data.items;
                    renderLeaderboardList(data.items);
                } else {
                    // Если ВК вернул пустой ответ без ошибки
                    if (leaderboardContainer) leaderboardContainer.innerHTML = '<div class="shop-loading">В этой версии нет активных игроков.</div>';
                }
            })
            .catch(err => {
                console.error("Ошибка API лидерборда:", err);
                // Заглушка вместо бесконечной загрузки:
                if (leaderboardContainer) {
                    leaderboardContainer.innerHTML = `
                        <div class="shop-loading" style="color: #ffb700; padding: 10px;">
                            🏆 Таблица лидеров будет доступна после официальной публикации аппа!
                        </div>`;
                }
            });
    });
}
if (leaderboardCloseBtn) {
    leaderboardCloseBtn.addEventListener('click', () => {
        if (leaderboardModal) leaderboardModal.classList.add('hidden');
    });
}

// Прокачка клика
if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
        if (gameData.coins >= gameData.upgradeCost) {
            gameData.coins -= gameData.upgradeCost;
            gameData.clickPower += 1;
            gameData.upgradeCost = Math.round(gameData.upgradeCost * 1.6);
            updateUI();
            saveGame();
        } else {
            vkBridge.send("VKWebAppTapticNotificationOccurred", { type: "error" }).catch(() => {});
            alert("Вам нужно больше корон!");
        }
    });
}

// Промокоды
if (promoCheckBtn && promoInput) {
    promoCheckBtn.addEventListener('click', () => {
        const code = promoInput.value.trim().toUpperCase();
        if (promoCheckBtn.classList.contains('btn-error') || promoCheckBtn.classList.contains('btn-success')) return;

        if (code === "" || !gameData.usedPromos) {
            triggerPromoError();
            return;
        }

        if (gameData.usedPromos.includes(code)) {
            vkBridge.send("VKWebAppTapticNotificationOccurred", { type: "error" }).catch(() => {});
            alert("Вы уже активировали этот промокод!");
            promoInput.value = "";
            return;
        }

        if (code === "KING2026") {
            gameData.coins += 50000;
            showRewardModal("КОРОЛЕВСКИЙ ДАР", "Вам успешно начислено 50 000 👑!");
            applySuccessfulPromo(code);
        } else if (code === "CLICKPOWER") {
            gameData.clickPower += 5;
            showRewardModal("ОСТРИЕ МЕЧА", "Ваша сила клика увеличена на +5 👑!");
            applySuccessfulPromo(code);
        } else if (code === "CPSBOOST") {
            gameData.hiredFriends[`promo_w_${Date.now()}`] = 'newbie'; 
            recalculateCPS();
            showRewardModal("ВЕРНЫЙ РЕКРУТ", "Вы бесплатно наняли Рекрута (+6 800 корон/час)!");
            renderFriendsList();
            applySuccessfulPromo(code);
        } else {
            triggerPromoError();
        }
    });
}

function triggerPromoError() {
    vkBridge.send("VKWebAppTapticNotificationOccurred", { type: "error" }).catch(() => {});
    promoCheckBtn.classList.add('btn-error');
    setTimeout(() => promoCheckBtn.classList.remove('btn-error'), 2000);
}

function applySuccessfulPromo(code) {
    vkBridge.send("VKWebAppTapticNotificationOccurred", { type: "success" }).catch(() => {});
    gameData.usedPromos.push(code);
    promoCheckBtn.classList.add('btn-success');
    promoInput.value = ""; 
    updateUI();
    saveGame();
    setTimeout(() => promoCheckBtn.classList.remove('btn-success'), 2000);
}

function showRewardModal(title, text) {
    const overlay = document.createElement('div');
    overlay.className = 'promo-reward-overlay';
    overlay.innerHTML = `<h2>${title}</h2><p>${text}</p><button id="close-reward-btn">Забрать</button>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#close-reward-btn').onclick = () => overlay.remove();
}

// Физика клика и удержания
let isHolding = false;
let isRotatingMode = false; 
let currentSpeed = 0;      
let currentAngle = 0;      
let scoreInterval = null;   
let holdTimeout = null;     

const MAX_SPEED = 5;       
const ACCELERATION = 0.05; 
const DECELERATION = 0.1;  

function animateRotation() {
    if (isRotatingMode && isHolding) {
        if (currentSpeed < MAX_SPEED) currentSpeed += ACCELERATION;
    } else {
        if (currentSpeed > 0) {
            currentSpeed -= DECELERATION;
            if (currentSpeed < 0) currentSpeed = 0;
        }
    }

    if (currentSpeed > 0 && clickObject && !clickObject.classList.contains('clicking')) {
        currentAngle = (currentAngle + currentSpeed) % 360;
        clickObject.style.transform = `rotate(${currentAngle}deg)`;
    } else if (currentSpeed === 0 && clickObject && !clickObject.classList.contains('clicking') && !isHolding) {
        if (currentAngle > 0) {
            if (currentAngle > 180) {
                let distance = 360 - currentAngle;
                let step = Math.max(distance * 0.1, 0.2); 
                currentAngle += step;
                if (currentAngle >= 360) currentAngle = 0;
            } else {
                let distance = currentAngle;
                let step = Math.max(distance * 0.1, 0.2);
                currentAngle -= step;
                if (currentAngle <= 0) currentAngle = 0;
            }
            clickObject.style.transform = currentAngle === 0 ? 'none' : `rotate(${currentAngle}deg)`;
        }
    }
    requestAnimationFrame(animateRotation);
}
requestAnimationFrame(animateRotation);

if (clickObject) {
    clickObject.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (isHolding) return; 
        isHolding = true;
        isRotatingMode = false;
        clickObject.classList.add('clicking');

        gameData.coins += gameData.clickPower;
        updateUI();
        createFloatingText(e.pageX, e.pageY, `+${gameData.clickPower}`);

        holdTimeout = setTimeout(() => {
            if (isHolding) {
                isRotatingMode = true;
                clickObject.classList.remove('clicking'); 
                scoreInterval = setInterval(() => {
                    gameData.coins += 1; 
                    updateUI();
                    createFloatingText(e.pageX + (Math.random() * 40 - 20), e.pageY + (Math.random() * 40 - 20), `+1`); 
                }, 50);
            }
        }, 200); 
    });

    const stopHolding = () => {
        if (!isHolding) return;
        isHolding = false;
        if (holdTimeout) clearTimeout(holdTimeout);
        if (scoreInterval) {
            clearInterval(scoreInterval);
            scoreInterval = null;
        }
        clickObject.classList.remove('clicking');
        isRotatingMode = false;
    };
    window.addEventListener('pointerup', stopHolding);
    window.addEventListener('pointercancel', stopHolding);
}

// Дополнительные кнопки ВК
const adBtn = document.getElementById('ad-btn');
if (adBtn) {
    adBtn.addEventListener('click', () => {
        vkBridge.send("VKWebAppShowNativeAds", { ad_format: "reward" })
            .then(data => {
                if (data.result) {
                    gameData.coins += 500;
                    updateUI();
                    saveGame();
                }
            })
            .catch(() => alert("Видео-бонус временно недоступен."));
    });
}

const shareBtn = document.getElementById('share-btn');
if (shareBtn) {
    shareBtn.addEventListener('click', () => {
        vkBridge.send("VKWebAppShowWallPostBox", {
            message: `👑 Я собрал уже ${Math.floor(gameData.coins)} корон в игре "ВК Король Кликер"!`,
            attachments: `https://vk.com/app54607037`
        });
    });
}