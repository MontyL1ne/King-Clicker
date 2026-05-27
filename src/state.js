import vkBridge from '@vkontakte/vk-bridge';
import { updateUI, updateShopButtonsState } from './ui.js';

// Дефолтное состояние игры
export let gameData = {
    coins: 0,
    clickPower: 1,
    upgradeCost: 10,
    hiredFriends: {}, 
    invitedCount: 0,
    usedPromos: [], 
    cps: 0,
    isFirstLaunch: true,
    cachedUser: null,
    cachedFriends: null
};

// Списки данных из ВК (кэшируются здесь)
export let vkFriendsList = [];
export let vkLeaderboardCache = null;
export let isVkFriendsLoaded = false;

export function setVkFriends(list) {
    vkFriendsList = list;
    isVkFriendsLoaded = true;
}

export function setLeaderboardCache(cache) {
    vkLeaderboardCache = cache;
}

// Перезапись всего объекта данных (нужно при загрузке)
export function setGameData(newData) {
    // Объединяем старое состояние с загруженным
    gameData = { ...gameData, ...newData };

    // Защита структуры данных прямо внутри модуля управления состоянием
    if (!gameData.hiredFriends) gameData.hiredFriends = {};
    if (!gameData.invitedCount) gameData.invitedCount = 0;
    if (!gameData.usedPromos) gameData.usedPromos = [];
    if (gameData.isFirstLaunch === undefined) gameData.isFirstLaunch = true;
}

// Вычисление общего CPS
export function recalculateCPS() {
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

// Сохранение в облако VK
export function saveGame() {
    vkBridge.send("VKWebAppStorageSet", {
        key: "king_clicker_save",
        value: JSON.stringify(gameData)
    })
    .then(() => console.log("Прогресс сохранен в VK Storage"))
    .catch(err => console.error("Ошибка автосохранения:", err));
}

// Каждые 7 секунд сохраняем прогресс
setInterval(saveGame, 7000);

// Ежесекундное начисление пассивного дохода
setInterval(() => {
    if (gameData.cps > 0) {
        gameData.coins += gameData.cps;
        updateUI();
        const shopModal = document.getElementById('shop-modal');
        if (shopModal && !shopModal.classList.contains('hidden')) {
            updateShopButtonsState();
        }
    }
}, 1000);