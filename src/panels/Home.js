import React, { useState, useEffect } from 'react';
import { Panel, PanelHeader, Header, Button, Group, Cell, Div, Avatar, Spacing } from '@vkontakte/vkui';
import bridge from '@vkontakte/vk-bridge';
import './Home.css'; // Если файла Home.css нет, можно удалить эту строку

export const Home = ({ id }) => {
  // --- СОСТОЯНИЕ ИГРЫ ---
  const [coins, setCoins] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [upgradeCost, setUpgradeCost] = useState(10);
  
  // Данные пользователя VK
  const [vkUser, setVkUser] = useState(null);
  // Массив для хранения летающих цифр (+1, +2 и т.д.)
  const [floatingTexts, setFloatingTexts] = useState([]);

  // --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАПУСКЕ ---
  useEffect(() => {
    // Инициализируем мост и собираем данные цепочкой
    bridge.send("VKWebAppInit")
      .then(() => {
        console.log("VK SDK инициализирован");
        return bridge.send("VKWebAppGetUserInfo");
      })
      .then((data) => {
        if (data.id) setVkUser(data);
        return bridge.send("VKWebAppStorageGet", { keys: ["king_clicker_save"] });
      })
      .then((data) => {
        if (data.keys && data.keys[0].value) {
          const gameData = JSON.parse(data.keys[0].value);
          if (gameData.coins !== undefined) setCoins(gameData.coins);
          if (gameData.clickPower !== undefined) setClickPower(gameData.clickPower);
          if (gameData.upgradeCost !== undefined) setUpgradeCost(gameData.upgradeCost);
        }
      })
      .catch((err) => {
        console.log("Ошибка работы в ВК (возможно, запуск в обычном браузере):", err);
      });
  }, []);

  // --- ФУНКЦИЯ СОХРАНЕНИЯ ---
  const saveGame = (currentCoins, currentPower, currentCost) => {
    bridge.send("VKWebAppStorageSet", {
      key: "king_clicker_save",
      value: JSON.stringify({
        coins: currentCoins,
        clickPower: currentPower,
        upgradeCost: currentCost
      })
    })
    .then(() => console.log("Игра сохранена в облако ВК"))
    .catch(err => console.log("Ошибка облачного сохранения:", err));
  };

  // --- АВТОСОХРАНЕНИЕ КАЖДЫЕ 7 СЕКУНД ---
  useEffect(() => {
    const interval = setInterval(() => {
      // Используем актуальные значения из состояния через колбэк
      setCoins((currentCoins) => {
        setClickPower((currentPower) => {
          setUpgradeCost((currentCost) => {
            if (currentCoins > 0) {
              saveGame(currentCoins, currentPower, currentCost);
            }
            return currentCost;
          });
          return currentPower;
        });
        return currentCoins;
      });
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  // --- ЛОГИКА КЛИКА И ЦИФР ---
  const handlePointerDown = (e) => {
    const nextCoins = coins + clickPower;
    setCoins(nextCoins);

    // Координаты клика для красивых цифр
    const x = e.pageX;
    const y = e.pageY;
    const id = Date.now() + Math.random();

    setFloatingTexts((prev) => [...prev, { id, x, y, text: `+${clickPower}` }]);

    // Удаляем цифру через 600мс, чтобы не засорять память
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((item) => item.id !== id));
    }, 600);
  };

  // --- ПОКУПКА УЛУЧШЕНИЙ ---
  const handleUpgrade = () => {
    if (coins >= upgradeCost) {
      const nextCoins = coins - upgradeCost;
      const nextPower = clickPower + 1;
      const nextCost = Math.round(upgradeCost * 1.6);

      setCoins(nextCoins);
      setClickPower(nextPower);
      setUpgradeCost(nextCost);
      
      saveGame(nextCoins, nextPower, nextCost); // Разовое сохранение при апгрейде
    } else {
      bridge.send("VKWebAppTapticNotificationOccurred", { type: "error" }).catch(() => {});
      alert("Вам нужно больше корон!");
    }
  };

  // --- РЕКЛАМА ЗА ВОЗНАГРАЖДЕНИЕ ---
  const handleShowAds = () => {
    bridge.send("VKWebAppShowNativeAds", { ad_format: "reward" })
      .then((data) => {
        if (data.result) {
          setCoins((prev) => {
            const nextCoins = prev + 500;
            saveGame(nextCoins, clickPower, upgradeCost);
            return nextCoins;
          });
        }
      })
      .catch(() => alert("Видео-бонус временно недоступен."));
  };

  // --- ПУБЛИКАЦИЯ НА СТЕНУ ---
  const handleShare = () => {
    bridge.send("VKWebAppShowWallPostBox", {
      message: `👑 Я собрал уже ${coins} корон в игре "ВК Король Кликер"! Сможешь отобрать у меня трон?`,
      attachments: "https://vk.com/appXXXXXXX" // Сюда позже вставите ID своего приложения
    });
  };

  return (
    <Panel id={id}>
      <PanelHeader>Король Кликер 👑</PanelHeader>

      {/* Вывод профиля игрока из ВК */}
      {vkUser && (
        <Group>
          <Cell
            before={<Avatar src={vkUser.photo_100} />}
            subtitle="Претендент на трон"
          >
            {`${vkUser.first_name} ${vkUser.last_name}`}
          </Cell>
        </Group>
      )}

      {/* Игровой интерфейс */}
      <Group header={<Header mode="secondary">Тронный зал</Header>}>
        <Div style={{ textAlign: 'center', position: 'relative' }}>
          
          <h1 style={{ fontSize: '32px', margin: '10px 0' }}>Короны: {coins}</h1>
          <p style={{ color: 'gray' }}>Сила клика: {clickPower}</p>

          {/* НАШ КОРОЛЬ (ОБЪЕКТ ДЛЯ КЛИКА) */}
          <div
            onPointerDown={handlePointerDown}
            style={{
              width: '160px',
              height: '160px',
              background: 'linear-gradient(135deg, #ffd700, #ffa500)',
              borderRadius: '50%',
              margin: '30px auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '64px',
              cursor: 'pointer',
              userSelect: 'none',
              boxShadow: '0 10px 20px rgba(0,0,0,0.15)',
              transition: 'transform 0.05s active'
            }}
          >
            👑
          </div>

          {/* КНОПКИ ДЕЙСТВИЙ */}
          <Spacing size={16} />
          <Button size="l" appearance="accent" stretched onClick={handleUpgrade}>
            Прокачать клик (Цена: {upgradeCost})
          </Button>
          
          <Spacing size={10} />
          <Button size="l" appearance="positive" stretched onClick={handleShowAds}>
            +500 корон за рекламу 📺
          </Button>

          <Spacing size={10} />
          <Button size="l" appearance="overlay" stretched onClick={handleShare}>
            Рассказать на стене 📢
          </Button>
        </Div>
      </Group>

      {/* РЕНДЕР ЛЕТАЮЩИХ ЦИФР */}
      {floatingTexts.map((item) => (
        <div
          key={item.id}
          className="floating-text"
          style={{
            position: 'absolute',
            left: `${item.x - 20}px`,
            top: `${item.y - 40}px`,
            pointerEvents: 'none',
            color: '#ffc107',
            fontWeight: 'bold',
            fontSize: '24px',
            animation: 'floatUp 0.6s ease-out forwards',
            zIndex: 9999
          }}
        >
          {item.text}
        </div>
      ))}
    </Panel>
  );
};