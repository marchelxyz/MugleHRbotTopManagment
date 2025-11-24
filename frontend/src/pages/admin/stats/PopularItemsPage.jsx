// frontend/src/pages/admin/stats/PopularItemsPage.jsx

import React, { useState, useEffect } from 'react';
import { getPopularItemsStats } from '../../../api';
import styles from './PopularItemsPage.module.css';

const PopularItemsPage = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await getPopularItemsStats();
                setItems(response.data.items);
            } catch (err) {
                setError('Не удалось загрузить данные о товарах.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return <p>Загрузка популярных товаров...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    return (
        <div>
            <h2>Популярные товары</h2>
            {items && items.length > 0 ? (
                <ul className={styles.itemList}>
                    {items.map(({ item, purchase_count }, index) => (
                        <li key={item.id} className={styles.itemCard}>
                            <span className={styles.rank}>{index + 1}</span>
                            <img 
                                src={item.image_url || 'https://via.placeholder.com/60/E9EEF2/6E7A85?text=...'} 
                                alt={item.name} 
                                className={styles.itemImage}
                                loading="lazy"
                            />
                            <div className={styles.itemInfo}>
                                <div className={styles.itemName}>{item.name}</div>
                                <div className={styles.itemPrice}>{item.price} спасибок</div>
                            </div>
                            <div className={styles.purchaseInfo}>
                                <div className={styles.purchaseCount}>{purchase_count}</div>
                                <div className={styles.purchaseLabel}>покупок</div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Покупок в магазине еще не было.</p>
            )}
        </div>
    );
};

export default PopularItemsPage;
