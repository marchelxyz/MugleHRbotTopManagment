// frontend/src/components/OnboardingStories.jsx (ТЕСТОВАЯ ВЕРСИЯ)

import React, { useState } from 'react';
// import Lottie from 'lottie-react'; // Временно отключаем
import { completeOnboarding } from '../api';
import styles from './OnboardingStories.module.css';

// import sticker1 from '../assets/Sticker1.json'; // Временно отключаем
// import sticker2 from '../assets/Sticker2.json';
// import sticker3 from '../assets/Sticker3.json';

const stories = [
  {
    // animation: sticker1,
    title: 'Добро пожаловать!',
    text: '«Спасибо» — это пространство для благодарности коллегам...',
  },
  {
    // animation: sticker2,
    title: 'Копите и тратьте',
    text: 'Накопленные "спасибки" можно обменять на мерч...',
  },
  {
    // animation: sticker3,
    title: 'Соревнуйтесь',
    text: 'Следите за своим прогрессом в Рейтинге...',
  },
];

function OnboardingStories({ onComplete }) {
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
      <div className={styles.content}>
        <div className={styles.stickerContainer}>
            {/* Вместо анимации ставим простую заглушку */}
            <p style={{ fontSize: '50px' }}>🖼️</p>
        </div>
        <h1 className={styles.title}>{currentStory.title}</h1>
        <p className={styles.text}>{currentStory.text}</p>
      </div>
      <div className={styles.footer}>
        {/* ... остальная часть без изменений ... */}
        <div className={styles.dots}>
          {stories.map((_, index) => (
            <div key={index} className={`${styles.dot} ${index === currentStep ? styles.activeDot : ''}`} />
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
