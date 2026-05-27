import vkBridge from '@vkontakte/vk-bridge';
import { gameData, saveGame, recalculateCPS } from './state.js';
import { updateUI, renderFriendsList } from './ui.js';

const promoInput = document.getElementById('promo-input');
const promoCheckBtn = document.getElementById('promo-check-btn');

// 1. ДЕКЛАРАТИВНАЯ БАЗА ПРОМОКОДОВ (Всё в одном месте!)
const PROMO_CODES = {
    "KING2026": () => {
        gameData.coins += 5043000;
        return { title: "КОРОЛЕВСКИЙ ДАР", text: "Вам успешно начислено 50 000 👑!" };
    },
    "CLICKPOWER": () => {
        gameData.clickPower += 5;
        return { title: "ОСТРИЕ МЕЧА", text: "Ваша сила клика увеличена на +5 👑!" };
    },
    "CPSBOOST": () => {
        gameData.hiredFriends[`promo_w_${Date.now()}`] = 'newbie';
        recalculateCPS();
        if (document.getElementById('shop-modal')?.classList.contains('hidden') === false) {
            renderFriendsList();
        }
        return { title: "ВЕРНЫЙ РЕКРУТ", text: "Вы бесплатно наняли Рекрута (+6 800 корон/час)!" };
    }
};

// 2. ЕДИНАЯ И УПРОЩЕННАЯ ЛОГИКА ПРОВЕРКИ
export function initPromoSystem() {
    if (!promoCheckBtn || !promoInput) return;

    promoCheckBtn.addEventListener('click', () => {
        const code = promoInput.value.trim().toUpperCase();

        // Защита от спама анимаций
        if (promoCheckBtn.className.includes('btn-')) return;

        // Быстрые проверки: пусто или уже использован
        if (code === "") return triggerPromoState('btn-error');
        if (gameData.usedPromos?.includes(code)) {
            vkBridge.send("VKWebAppTNotificationOccurred", { type: "error" }).catch(() => {});
            alert("Вы уже активировали этот промокод!");
            promoInput.value = "";
            return;
        }

        // Поиск кода в нашем словаре наград
        const rewardFunction = PROMO_CODES[code];

        if (rewardFunction) {
            // Если код есть — запускаем его функцию и получаем данные для окна
            const reward = rewardFunction();
            
            // Фиксируем использование
            if (!gameData.usedPromos) gameData.usedPromos = [];
            gameData.usedPromos.push(code);

            // Визуальный отклик успеха
            showRewardModal(reward.title, reward.text);
            triggerPromoState('btn-success');
            promoInput.value = "";
            
            updateUI();
            saveGame();
        } else {
            // Если кода нет в словаре — ошибка
            triggerPromoState('btn-error');
        }
    });
}

// Объединенная функция для переключения состояний кнопки (Успех / Ошибка)
function triggerPromoState(className) {
    const type = className === 'btn-success' ? 'success' : 'error';
    vkBridge.send("VKWebAppTapticNotificationOccurred", { type }).catch(() => {});
    
    promoCheckBtn.classList.add(className);
    setTimeout(() => promoCheckBtn.classList.remove(className), 2000);
}

// Окно награды
function showRewardModal(title, text) {
    const overlay = document.createElement('div');
    overlay.className = 'promo-reward-overlay';
    overlay.innerHTML = `<h2>${title}</h2><p>${text}</p><button id="close-reward-btn">Забрать</button>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#close-reward-btn').onclick = () => overlay.remove();
}