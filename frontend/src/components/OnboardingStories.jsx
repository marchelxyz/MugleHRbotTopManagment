// frontend/src/components/OnboardingStories.jsx (ФИНАЛЬНАЯ ВЕРСИЯ)

import React, { useState } from 'react';
import Lottie from 'lottie-react';
import { completeOnboarding } from '../api';
import styles from './OnboardingStories.module.css';

// --- НАЧАЛО ИЗМЕНЕНИЙ ---
// Мы будем импортировать файлы "безопасно"
let sticker1, sticker2, sticker3;
try {
  sticker1 = require('../assets/AnimatedSticker1.json');
  sticker2 = require('../assets/AnimatedSticker3.json');
  sticker3 = require('../assets/AnimatedSticker2.json');
} catch (error) {
  console.error("Could not load sticker animations. Check files in src/assets/", error);
  // Если файлы не найдены, переменные останутся undefined
}
// --- КОНЕЦ ИЗМЕНЕНИЙ ---


const stories = [
  {
    animation: sticker1,
    title: 'Добро пожаловать!',
    text: '«Спасибо» — это пространство для благодарности коллегам. Отправляйте "спасибки" и получайте их в ответ!',
  },
  {
    animation: sticker2,
    title: 'Копите и тратьте',
    text: 'Накопленные "спасибки" можно обменять на мерч, сертификаты и другие приятные бонусы в нашем Магазине.',
  },
  {
    animation: sticker3,
    title: 'Соревнуйтесь',
    text: 'Следите за своим прогрессом в Рейтинге. Станьте самым щедрым или самым признанным сотрудником!',
  },
];

function OnboardingStories({ onComplete }) {
  // ... (весь остальной код функции остается без изменений) ...
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < stories.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await completeOnboarding();
      onComplete();
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      onComplete();
    }
  };

  const currentStory = stories[currentStep];

  return (
    <div className={styles.container}>
       {currentStep === 0 && (
        <button onClick={handleComplete} className={styles.skipButton}>
          Пропустить
        </button>
      )}
      <div className={styles.content}>
        <div className={styles.stickerContainer}>
            {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
            {/* Показываем анимацию, только если она успешно загрузилась */}
            {currentStory.animation ? (
              <Lottie
                animationData={currentStory.animation}
                loop={true}
                className={styles.sticker}
              />
            ) : (
              // Иначе показываем заглушку
              <p style={{ fontSize: '50px' }}>🖼️</p>
            )}
            {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}
        </div>
        <h1 className={styles.title}>{currentStory.title}</h1>
        <p className={styles.text}>{currentStory.text}</p>
      </div>

      <div className={styles.footer}>
        <div className={styles.dots}>
          {stories.map((_, index) => (
            <div
              key={index}
              className={`${styles.dot} ${index === currentStep ? styles.activeDot : ''}`}
            />
          ))}
        </div>
        <button onClick={handleNext} className={styles.nextButton}>
          {currentStep < stories.length - 1 ? 'Дальше' : 'Начать!'}
        </button>
      </div>
    </div>
  );
}

export default OnboardingStories;
