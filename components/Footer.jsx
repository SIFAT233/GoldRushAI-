import { useLanguage } from '../context/LanguageContext';
import { translations } from '../utils/translations';

const Footer = () => {
    const { language } = useLanguage();
    const t = translations[language].footer;
    const navT = translations[language].nav;

    return (
        <footer className="bg-[#0B0D10] py-16 border-t border-white/5 relative">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary-gold/30 to-transparent"></div>
            <div className="container mx-auto px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    <div>
                        <h3 className="text-primary-gold text-2xl mb-4">GOLD RUSH</h3>
                        <p className="text-text-dim text-sm">
                            {t.desc}
                        </p>
                    </div>

                    <div>
                        <h4 className="text-text-light mb-4 font-semibold">{t.quickLinks}</h4>
                        <ul className="grid gap-2">
                            {[
                                { name: navT.about, href: '#about' },
                                { name: navT.features, href: '#features' },
                                { name: navT.blog, href: '#blog' },
                                { name: navT.contact, href: '#contact' }
                            ].map(link => (
                                <li key={link.name}>
                                    <a href={link.href} className="text-text-dim text-sm hover:text-primary-gold transition-colors">
                                        {link.name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-text-light mb-4 font-semibold">{t.contact}</h4>
                        <ul className="grid gap-2 text-text-dim text-sm">
                            <li>01874126156</li>
                            <li>info@goldrushbd.com</li>
                            <li>Dhaka, Bangladesh</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-text-light mb-4 font-semibold">{t.follow}</h4>
                        <div className="flex gap-4">
                            {['Facebook', 'LinkedIn', 'Twitter'].map(social => (
                                <a key={social} href="#" className="text-text-dim hover:text-primary-gold transition-colors">
                                    {social}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="text-center pt-8 border-t border-glass-border text-text-dim text-xs">
                    &copy; {new Date().getFullYear()} {t.rights}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
