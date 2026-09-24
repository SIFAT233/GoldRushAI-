import { useLanguage } from '../../context/LanguageContext';
import { translations } from '../../utils/translations';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const AboutSection = () => {
    const { language } = useLanguage();
    const t = translations[language].about;
    useScrollAnimation();

    return (
        <section id="about" className="py-24 bg-darker-bg">
            <div className="container mx-auto px-4 md:px-8">
                <h2 className="section-title reveal">{t.title}</h2>
                <p className="section-subtitle reveal">{t.subtitle}</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="bg-[#1A1D21] border border-primary-gold/30 rounded-2xl p-8 reveal shadow-lg shadow-primary-gold/5">
                        <h3 className="text-2xl mb-4 text-primary-gold font-bold">{t.company}</h3>
                        <p className="mb-8 text-gray-400 leading-relaxed">
                            {t.desc}
                        </p>
                        <div className="flex gap-3 flex-wrap">
                            {/* App list removed for rebranding */}
                        </div>
                    </div>

                    <div className="reveal stagger-delay-1 pl-0 lg:pl-10">
                        <div className="mb-12">
                            <h3 className="text-2xl font-bold mb-4 flex items-center gap-3 text-white">
                                <span className="text-3xl">🎯</span>
                                <span dangerouslySetInnerHTML={{ __html: t.missionTitle.replace('🎯 ', '') }} />
                            </h3>
                            <p className="text-gray-400 text-lg leading-relaxed">
                                {t.missionDesc}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
                                <span className="text-3xl">💎</span>
                                <span dangerouslySetInnerHTML={{ __html: t.whyTitle.replace('💎 ', '') }} />
                            </h3>
                            <ul className="grid gap-4">
                                {t.whyPoints.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <span className="text-primary-gold text-lg mt-1">✓</span>
                                        <span className="text-gray-300">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AboutSection;
