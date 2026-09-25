import { useState, useEffect } from 'react';

const CountUp = ({ end, duration = 2000, prefix = '', suffix = '' }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime = null;
        const startValue = 0;

        // Parse end value (remove commas if string)
        const endValue = typeof end === 'string' ? parseFloat(end.replace(/,/g, '')) : end;

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            // Easing function (easeOutExpo)
            const easeOut = (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);

            const currentCount = Math.floor(easeOut(progress) * (endValue - startValue) + startValue);
            setCount(currentCount);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [end, duration]);

    return (
        <span>
            {prefix}{count.toLocaleString()}{suffix}
        </span>
    );
};

export default CountUp;
