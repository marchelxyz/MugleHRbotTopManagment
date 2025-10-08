// frontend/src/components/OnboardingStories.jsx
// (НОВЫЙ ФАЙЛ)

import React, { useState } from 'react';
import { completeOnboarding } from '../api';
import styles from './OnboardingStories.module.css';

// Здесь ты можешь определить свои "истории"
const stories = [
  {
    image: 'https://i.postimg.cc/d1wL9d7g/step1.png',
    title: 'Добро пожаловать!',
    text: '«Спасибо» — это пространство для благодарности коллегам. Отправляйте "спасибки" и получайте их в ответ!',
  },
  {
    image: 'https://i.postimg.cc/SKxgyj0h/step2.png',
    title: 'Копите и тратьте',
    text: 'Накопленные "спасибки" можно обменять на мерч, сертификаты и другие приятные бонусы в нашем Магазине.',
  },
  {
    image: 'https://i.postimg.cc/SRvN2f00/step3.png',
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
      // Когда пользователь на последнем шаге, завершаем обучение
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await completeOnboarding(); // Отправляем запрос на бэкенд
      onComplete(); // Вызываем функцию из App.jsx для обновления состояния
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      // Если произошла ошибка, все равно позволяем пользователю войти
      onComplete();
    }
  };

  const currentStory = stories[currentStep];

  return (
    <div className={styles.container}>
      {/* Кнопка "Пропустить" появляется только на первом шаге */}
      {currentStep === 0 && (
        <button onClick={handleComplete} className={styles.skipButton}>
          Пропустить
        </button>
      )}

      <div className={styles.content}>
        <img src={currentStory.image} alt={currentStory.title} className={styles.image} />
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
