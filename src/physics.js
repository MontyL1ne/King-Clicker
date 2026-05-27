import { gameData } from './state.js';
import { updateUI, createFloatingText } from './ui.js';

const clickObject = document.getElementById('click-object');

let isHolding = false;
let isRotatingMode = false; 
let currentSpeed = 0;      
let currentAngle = 0;      
let scoreInterval = null;   
let holdTimeout = null;     

const MAX_SPEED = 5;       
const ACCELERATION = 0.05; 
const DECELERATION = 0.1;  

export function initClickPhysics() {
    if (!clickObject) return;

    requestAnimationFrame(animateRotation);

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
                    const randomX = e.pageX + (Math.random() * 40 - 20);
                    const randomY = e.pageY + (Math.random() * 40 - 20);
                    createFloatingText(randomX, randomY, `+1`); 
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