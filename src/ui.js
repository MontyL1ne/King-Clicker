import vkBridge from '@vkontakte/vk-bridge';
// Добавили vkLeaderboardCache в импорт, чтобы логика дефолтного кэша работала
import { gameData, vkFriendsList, vkLeaderboardCache, isVkFriendsLoaded, recalculateCPS, saveGame } from './state.js';

const coinsText = document.getElementById('coins');
const upgradeBtn = document.getElementById('upgrade-btn');
const upgradeCostText = document.getElementById('upgrade-cost');
const friendsContainer = document.getElementById('friends-list-container');
const leaderboardContainer = document.getElementById('leaderboard-list-container');

export function updateUI() {
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

// Всплывающий текст над кликом
export function createFloatingText(x, y, text) {
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

// Обновление состояния доступности кнопок в магазине
export function updateShopButtonsState() {
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

// Отрисовка списка друзей в магазине
export function renderFriendsList() {
    if (!friendsContainer) return;
    const fragment = document.createDocumentFragment();

    if (vkFriendsList.length > 0) {
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
                const costSpan = document.createElement('span');
                costSpan.className = 'friend-cost';
                costSpan.innerText = `${cost} 👑`;
                actionsDiv.appendChild(costSpan);

                const buyBtn = document.createElement('button');
                buyBtn.className = 'buy-worker-btn';
                buyBtn.innerText = 'Купить';
                buyBtn.setAttribute('data-cost', cost); 
                buyBtn.classList.add(gameData.coins >= cost ? 'available' : 'locked');

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
    }

    // Кнопка "Позвать рекрута"
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
            <button class="buy-worker-btn" id="invite-friend-action-btn" style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: #000;">Позвать</button>
        </div>
    `;
    fragment.appendChild(inviteIsland);

    const inviteBtn = inviteIsland.querySelector('#invite-friend-action-btn');
    if (inviteBtn) {
        inviteBtn.classList.add(gameData.coins >= inviteCost ? 'available' : 'locked');
        if (gameData.coins < inviteCost) inviteBtn.style.opacity = '0.6';

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
                .catch(err => console.log("Окно закрыто:", err));
        };
    }

    friendsContainer.innerHTML = '';
    friendsContainer.appendChild(fragment);

    if (vkFriendsList.length === 0 && isVkFriendsLoaded) {
        const emptyNotify = document.createElement('div');
        emptyNotify.className = 'shop-loading';
        emptyNotify.style.margin = '15px 0';
        emptyNotify.innerText = 'Доступных друзей не найдено. Позовите их кнопкой ниже!';
        friendsContainer.insertBefore(emptyNotify, inviteIsland);
    }
}

// Отрисовка списка кастомного лидерборда
export function renderLeaderboardList(players = null) {
    if (!leaderboardContainer) return;
    
    const listToRender = players || vkLeaderboardCache;

    if (!listToRender || listToRender.length === 0) {
        leaderboardContainer.innerHTML = '<div class="shop-loading">Загрузка таблицы лидеров...</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    listToRender.forEach((player, index) => {
        const island = document.createElement('div');
        island.className = 'friend-island'; 

        let name = "Игрок ВК";
        if (player.user) {
            name = `${player.user.first_name || ''} ${player.user.last_name || ''}`.trim();
        }

        const rank = player.place || (index + 1);
        const score = player.score || player.value || 0;

        island.innerHTML = `
            <div class="friend-info">
                <div><span style="color:#ffd700; margin-right:8px;">#${rank}</span> ${name}</div>
            </div>
            <div class="friend-cost">${Math.floor(score).toLocaleString()} 👑</div>
        `;
        fragment.appendChild(island);
    });

    leaderboardContainer.innerHTML = '';
    leaderboardContainer.appendChild(fragment);
}