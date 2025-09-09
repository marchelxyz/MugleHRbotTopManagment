// frontend/src/components/DinoGame.jsx
// (НОВЫЙ ФАЙЛ)

import React, { useRef, useEffect } from 'react';
import styles from './DinoGame.module.css';

function DinoGame() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    let score = 0;
    let highscore = 0;
    let dino;
    let gravity = 1;
    let obstacles = [];
    // --- ИЗМЕНЕНИЕ 1: Уменьшаем начальную скорость ---
    let gameSpeed = 2; // Было: 5
    let keys = {};
    let isGameOver = false;

    // --- АССЕТЫ ---
    const dinoImg = new Image();
    // --- ИСПРАВЛЕНИЕ: Используем спрайт-лист для анимации бега ---
    dinoImg.src = 'https://i.postimg.cc/Nj4z32R7/dino-sprite.png'; 
    const cactusImg = new Image();
    cactusImg.src = 'https://i.postimg.cc/zX005Sts/cactus.png';

    // --- ОБРАБОТЧИКИ ВВОДА ---
    document.addEventListener('keydown', (e) => keys[e.code] = true);
    document.addEventListener('keyup', (e) => keys[e.code] = false);
    canvas.addEventListener('touchstart', () => keys['Space'] = true, { passive: true });
    canvas.addEventListener('touchend', () => keys['Space'] = false, { passive: true });

    // --- КЛАССЫ ИГРОВЫХ ОБЪЕКТОВ ---
    class Dino {
      constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.dy = 0; // vertical velocity
        this.jumpForce = 15; // Уменьшим силу прыжка для лучшей игры
        this.originalHeight = h;
        this.grounded = false;
        this.frame = 0; // Для анимации бега
        this.frameRate = 5; // Скорость смены кадров
        this.frameCounter = 0;
        this.frames = 2; // Количество кадров анимации бега
      }

      draw() {
        // Вырезаем нужный кадр из спрайта
        const spriteX = this.frame * this.w; 
        ctx.drawImage(dinoImg, spriteX, 0, this.w, this.h, this.x, this.y, this.w, this.h);
      }

      jump() {
        if (this.grounded) {
          this.dy = -this.jumpForce;
          this.grounded = false;
        }
      }

      update(canvasHeight) {
        // --- ИСПРАВЛЕНИЕ: Прыжок ТОЛЬКО если нажата кнопка "Space" ---
        if (keys['Space']) {
          this.jump();
        }
        
        if (!this.grounded) {
          this.dy += gravity;
        }
        this.y += this.dy;

        if (this.y + this.h >= canvasHeight - 20) {
          this.y = canvasHeight - this.h - 20;
          this.dy = 0;
          this.grounded = true;
        }
        
        // --- Анимация бега ---
        this.frameCounter++;
        if (this.frameCounter >= this.frameRate) {
            this.frameCounter = 0;
            this.frame = (this.frame + 1) % this.frames; // Переключаем кадры
        }

        this.draw();
      }
    }

    class Obstacle {
        constructor(x, y, w, h) {
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
        }

        draw() {
            ctx.drawImage(cactusImg, this.x, this.y, this.w, this.h);
        }

        update() {
            this.x -= gameSpeed;
            this.draw();
        }
    }

    // --- ФУНКЦИИ ИГРЫ ---
    function spawnObstacle() {
        const size = Math.random() * (60 - 30) + 30; // Random size
        const type = Math.round(Math.random()); // 0 or 1
        let obstacle = new Obstacle(canvas.width + size, canvas.height - size - 20, size, size);
        obstacles.push(obstacle);
    }

    function restartGame() {
        dino = new Dino(25, canvas.height - 170, 50, 50);
        obstacles = [];
        score = 0;
        gameSpeed = 2;
        isGameOver = false;
        requestAnimationFrame(gameLoop);
    }
    
    let initialSpawnTimer = 200;
    let spawnTimer = initialSpawnTimer;

    // --- ГЛАВНЫЙ ИГРОВОЙ ЦИКЛ ---
    function gameLoop() {
      if (isGameOver) {
        ctx.font = "20px 'Inter', sans-serif";
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.fillText("Игра окончена", canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText("Нажмите, чтобы начать заново", canvas.width / 2, canvas.height / 2 + 10);
        
        canvas.addEventListener('click', restartGame, { once: true });
        canvas.addEventListener('touchstart', restartGame, { once: true, passive: true });
        
        return;
      }
      
      requestAnimationFrame(gameLoop);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Ground line
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 20);
      ctx.lineTo(canvas.width, canvas.height - 20);
      ctx.stroke();

      // Spawn obstacles
      spawnTimer--;
      if (spawnTimer <= 0) {
        spawnObstacle();
        spawnTimer = initialSpawnTimer - gameSpeed * 8;
        if (spawnTimer < 60) spawnTimer = 60;
      }
      
      // Update obstacles
      for (let i = obstacles.length - 1; i >= 0; i--) {
        let o = obstacles[i];
        if (o.x + o.w < 0) {
          obstacles.splice(i, 1);
        }

        // Collision detection
        if (dino.x < o.x + o.w &&
            dino.x + dino.w > o.x &&
            dino.y < o.y + o.h &&
            dino.y + dino.h > o.y) {
                isGameOver = true;
                if (score > highscore) highscore = score;
        }
        o.update();
      }

      dino.update(canvas.height);

 // Score
      score++;
// --- ИЗМЕНЕНИЕ 2: Значительно уменьшаем ускорение ---
      gameSpeed += 0.001; // Было: 0.003
      ctx.font = "20px 'Inter', sans-serif";
      ctx.fillStyle = "black";
      ctx.textAlign = "left";
      ctx.fillText("Счет: " + score, 10, 30);
      ctx.fillText("Рекорд: " + highscore, 10, 55);
    }
    
    // --- ЗАПУСК ---
    dino = new Dino(25, canvas.height - 170, 50, 50);
    gameLoop();

    // Cleanup
    return () => {
        document.removeEventListener('keydown', (e) => keys[e.code] = true);
        document.removeEventListener('keyup', (e) => keys[e.code] = false);
    };

  }, []);

  return (
    <div className={styles.gameContainer}>
        <canvas ref={canvasRef} width={380} height={250}></canvas>
    </div>
  );
}

export default DinoGame;
