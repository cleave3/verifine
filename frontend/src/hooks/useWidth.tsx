import { useState, useEffect } from "react";

const SCREENS = {
    MOBILE: 768,
    TABLET: 820,
    DESKTOP: 1024
};


const getWidth = () => window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

const useWidth = () => {
    const [width, setWidth] = useState(getWidth());

    useEffect(() => {
        const resizeListener = () => {
            setWidth(getWidth());
        };

        window.addEventListener("resize", resizeListener);

        return () => {
            window.removeEventListener("resize", resizeListener);
        };
    }, []);

    const isMobile = width <= SCREENS.MOBILE;
    const isTablet = width <= SCREENS.TABLET;
    const isSmallScreen = width <= 360;

    const notDesktop = isMobile || isTablet || isSmallScreen;

    return { width, isMobile, isTablet, isSmallScreen, notDesktop };
};

export default useWidth;
