import { useEffect } from 'react';

export const useScrollAnimation = (dependencies = []) => {
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });

        // Small delay to ensure DOM is updated
        setTimeout(() => {
            const elements = document.querySelectorAll('.reveal');
            elements.forEach((el) => observer.observe(el));
        }, 100);

        return () => {
            const elements = document.querySelectorAll('.reveal');
            elements.forEach((el) => observer.unobserve(el));
        };
    }, dependencies);
};
