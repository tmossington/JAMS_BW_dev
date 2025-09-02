import { useEffect } from 'react';

const useAutoScroll = (dependency, ref) => {
    useEffect(() => {
        if (ref?.current && process.env.NODE_ENV !== 'production') {  // Ensure it's not running during packaging
            requestAnimationFrame(() => {  // Replace setTimeout with requestAnimationFrame
                ref.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            });
        }
    }, [dependency, ref]);
};

export default useAutoScroll;
