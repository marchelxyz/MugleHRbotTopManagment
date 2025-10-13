// frontend/src/components/LoadingScreen.jsx

import React from 'react';
import Lottie from 'react-lottie-player';
import styles from './LoadingScreen.module.css';
import animationData from '../assets/AnimatedSticker5.json'; // Убедись, что файл лежит здесь

function LoadingScreen() {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.content}>
        <Lottie
          animationData={animationData}
          loop={true}
          play={true}
          style={{ width: 200, height: 200 }}
        />
        <div className={styles.loadingBar}>
          <div className={styles.loadingBarInner}></div>
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;
