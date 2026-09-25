import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../utils/translations';

const Header = () => {
    const [scrolled, setScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { language, toggleLanguage } = useLanguage();
    const t = translations[language].nav;
    const location = useLocation();
    const isHome = location.pathname === '/';

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location]);

    // Prevent scroll when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMenuOpen]);

    const navLinks = [
        { name: t.about, href: '#about' },
        { name: t.features, href: '#features' },
        { name: t.demo, href: '#contact' },
        { name: t.blog, href: '#blog' },
        { name: t.contact, href: '#contact' },
    ];

    // Function to handle smooth scroll for anchor links
    const handleNavClick = (e, href) => {
        if (!isHome) return; // Let Link handle navigation if not on home
        e.preventDefault();
        const element = document.querySelector(href);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setIsMenuOpen(false);
        }
    };

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'py-4 bg-[#0B0D10]/90 backdrop-blur-lg border-b border-white/5 shadow-lg shadow-black/20' : 'py-6 bg-transparent'
            }`}>
            <div className="container mx-auto px-4 md:px-8">
                <div className="flex justify-between items-center">
                    <Link to="/" className="text-2xl font-bold text-primary-gold relative z-50">
                        GOLD RUSH
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8">
                        <ul className="flex gap-8">
                            {navLinks.map((link) => (
                                <li key={link.name}>
                                    {isHome ? (
                                        <a
                                            href={link.href}
                                            onClick={(e) => handleNavClick(e, link.href)}
                                            className="text-text-light font-medium transition-colors hover:text-primary-gold"
                                        >
                                            {link.name}
                                        </a>
                                    ) : (
                                        <Link
                                            to={`/${link.href}`}
                                            className="text-text-light font-medium transition-colors hover:text-primary-gold"
                                        >
                                            {link.name}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleLanguage}
                                className="bg-transparent border border-primary-gold text-primary-gold px-4 py-2 rounded-full cursor-pointer font-semibold hover:bg-primary-gold hover:text-darker-bg transition-all"
                            >
                                {language === 'EN' ? '🇺🇸 EN' : '🇧🇩 BN'}
                            </button>

                            <Link
                                to="/signup"
                                className="border border-primary-gold text-primary-gold px-6 py-2 rounded-full font-bold hover:bg-primary-gold hover:text-darker-bg transition-all"
                            >
                                Sign Up
                            </Link>

                            <Link
                                to="/signin"
                                className="bg-gradient-to-r from-primary-gold via-yellow-200 to-primary-gold text-darker-bg px-6 py-2 rounded-full font-bold shadow-lg shadow-primary-gold/20 hover:shadow-primary-gold/30 hover:-translate-y-0.5 transition-all"
                            >
                                Sign In
                            </Link>
                        </div>
                    </nav>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden text-white z-50 p-2"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>

                    {/* Mobile Menu Overlay */}
                    <div className={`fixed inset-0 bg-[#050608]/95 backdrop-blur-xl z-40 flex flex-col items-center justify-center transition-all duration-300 ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                        <ul className="flex flex-col gap-8 text-center mb-8">
                            {navLinks.map((link) => (
                                <li key={link.name}>
                                    {isHome ? (
                                        <a
                                            href={link.href}
                                            onClick={(e) => handleNavClick(e, link.href)}
                                            className="text-2xl text-text-light font-medium transition-colors hover:text-primary-gold"
                                        >
                                            {link.name}
                                        </a>
                                    ) : (
                                        <Link
                                            to={`/${link.href}`}
                                            className="text-2xl text-text-light font-medium transition-colors hover:text-primary-gold"
                                            onClick={() => setIsMenuOpen(false)}
                                        >
                                            {link.name}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-col items-center gap-6">
                            <button
                                onClick={toggleLanguage}
                                className="bg-transparent border border-primary-gold text-primary-gold px-6 py-2 rounded-full cursor-pointer font-semibold hover:bg-primary-gold hover:text-darker-bg transition-all text-lg"
                            >
                                {language === 'EN' ? '🇺🇸 EN' : '🇧🇩 BN'}
                            </button>

                            <Link
                                to="/signup"
                                className="border border-primary-gold text-primary-gold px-8 py-3 rounded-full font-bold hover:bg-primary-gold hover:text-darker-bg transition-all text-lg"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Sign Up
                            </Link>

                            <Link
                                to="/signin"
                                className="bg-gradient-to-r from-primary-gold via-yellow-200 to-primary-gold text-darker-bg px-8 py-3 rounded-full font-bold shadow-lg shadow-primary-gold/20 hover:shadow-primary-gold/30 transition-all text-lg"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
