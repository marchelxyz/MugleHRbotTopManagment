// frontend/src/components/OnboardingStories.jsx (ФИНАЛЬНАЯ ВЕРСИЯ)

import React, { useState, lazy, Suspense } from 'react';
import { completeOnboarding } from '../api';
import styles from './OnboardingStories.module.css';

// Lazy loading для Lottie - загружается только при показе onboarding
const Lottie = lazy(() => import('react-lottie-player'));

// --- ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЙ, СТАНДАРТНЫЙ ИМПОРТ ---
import sticker1 from '../assets/AnimatedSticker1.json';
import sticker2 from '../assets/AnimatedSticker3.json';
import sticker3 from '../assets/AnimatedSticker2.json';
import sticker4 from '../assets/TgDuckX_AgADaFEAAtd-MEs.json';


const stories = [
  {
    animation: sticker1,
    title: 'Добро пожаловать!',
    text: '«Спасибо» — это пространство для благодарности коллегам. Отправляйте "спасибки" и получайте их в ответ!',
  },
  {
    animation: sticker2,
    title: 'Копите и тратьте',
    text: 'Накопленные "спасибки" можно обменять на мерч, сертификаты и другие приятные бонусы в нашем Кафетерии.',
  },
  {
    animation: sticker4,
    title: 'Отправляйте и вращайте',
    text: 'Получайте частички билетиков за отправленные "спасибки", собирайте их в билеты и вращайте рулетку!',
  },
  {
    animation: sticker3,
    title: 'Соревнуйтесь',
    text: 'Следите за своим прогрессом в Рейтинге. Станьте самым щедрым или самым признанным сотрудником!',
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
       {currentStep === 0 && (
        <button onClick={handleComplete} className={styles.skipButton}>
          Пропустить
        </button>
      )}
      <div className={styles.content}>
        <div className={styles.stickerContainer}>
          <Suspense fallback={<div className={styles.sticker} />}>
            <Lottie
              animationData={currentStory.animation}
              loop
              play
              className={styles.sticker}
            />
          </Suspense>
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
