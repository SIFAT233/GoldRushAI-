import { useLanguage } from '../../context/LanguageContext';
import { translations } from '../../utils/translations';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const FeaturesSection = () => {
    const { language } = useLanguage();
    const t = translations[language].features;
    useScrollAnimation();

    const icons = [
        { emoji: "⚖️", bg: "bg-yellow-500/10" },
        { emoji: "🏢", bg: "bg-blue-500/10" },
        { emoji: "💻", bg: "bg-green-500/10" },
        { emoji: "👥", bg: "bg-purple-500/10" },
        { emoji: "📒", bg: "bg-orange-500/10" },
        { emoji: "🔒", bg: "bg-red-500/10" },
        { emoji: "🔨", bg: "bg-gray-500/10" },
        { emoji: "📦", bg: "bg-indigo-500/10" },
        { emoji: "👔", bg: "bg-pink-500/10" },
        { emoji: "📊", bg: "bg-cyan-500/10" },
        { emoji: "📱", bg: "bg-teal-500/10" },
        { emoji: "💰", bg: "bg-yellow-600/10" }
    ];

    return (
        <section id="features" className="py-24 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-primary-gold/5 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] animate-pulse animation-delay-2000"></div>
            </div>

            <div className="container mx-auto px-4 md:px-8 relative z-10">
                <h2 className="section-title reveal">{t.title}</h2>
                <p className="section-subtitle reveal">{t.subtitle}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {t.list.map((feature, index) => {
                        return (
                            <div
                                key={index}
                                className="relative p-8 rounded-3xl transition-all duration-500 group overflow-hidden bg-[#1A1D21]/60 backdrop-blur-xl border border-white/5 hover:border-primary-gold/30 hover:bg-[#1A1D21]/80 hover:shadow-2xl hover:shadow-primary-gold/5 hover:-translate-y-2"
                                style={{ transitionDelay: `${(index % 4) * 0.05}s` }}
                            >
                                {/* Hover Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                                <div className="w-16 h-16 mb-6 rounded-2xl flex items-center justify-center text-3xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 bg-white/5 border border-white/5 group-hover:border-primary-gold/20 group-hover:bg-primary-gold/10">
                                    <span className="drop-shadow-lg filter">{icons[index].emoji}</span>
                                </div>

                                <h3 className="mb-3 font-bold text-xl transition-colors duration-300 text-white group-hover:text-primary-gold">
                                    {feature.title}
                                </h3>

                                <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">
                                    {feature.desc}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;
