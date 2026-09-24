import { useLanguage } from '../../context/LanguageContext';
import { translations } from '../../utils/translations';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { Check, Star, Zap, Crown, Clock } from 'lucide-react';

const PricingSection = () => {
    const { language } = useLanguage();
    const t = translations[language].pricing;
    useScrollAnimation();

    const getPlanIcon = (index) => {
        switch (index) {
            case 0: return <Clock className="w-8 h-8 text-blue-400" />;
            case 1: return <Zap className="w-8 h-8 text-green-400" />;
            case 2: return <Star className="w-8 h-8 text-primary-gold" />;
            case 3: return <Crown className="w-8 h-8 text-purple-400" />;
            default: return <Star className="w-8 h-8 text-primary-gold" />;
        }
    };

    const getCardStyles = (index) => {
        switch (index) {
            case 0: // Free Trial
                return "bg-[#1A1D21]/60 border-white/5 hover:border-blue-400/30";
            case 1: // Monthly
                return "bg-[#1A1D21]/60 border-white/5 hover:border-green-400/30";
            case 2: // Yearly (Popular)
                return "bg-gradient-to-b from-[#1A1D21]/90 to-[#1A1D21] border-primary-gold/50 shadow-2xl shadow-primary-gold/10 transform scale-105 z-10";
            case 3: // Lifetime
                return "bg-gradient-to-b from-[#1A1D21]/80 to-[#2A1D31]/80 border-purple-500/30 hover:border-purple-500/50 shadow-lg shadow-purple-500/10";
            default:
                return "bg-[#1A1D21]/60 border-white/5";
        }
    };

    return (
        <section id="pricing" className="py-24 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-primary-gold/5 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] animate-pulse animation-delay-2000"></div>
                <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px] animate-pulse animation-delay-1000"></div>
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="section-title reveal">{t.title}</h2>
                    <p className="section-subtitle reveal text-lg">{t.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-start">
                    {t.plans.map((plan, index) => (
                        <div
                            key={index}
                            className={`relative p-6 rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:-translate-y-2 flex flex-col h-full ${getCardStyles(index)}`}
                        >
                            {index === 2 && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-gold text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg uppercase tracking-wider">
                                    {t.popular}
                                </div>
                            )}

                            <div className="mb-6">
                                <div className="mb-4 p-3 bg-white/5 rounded-xl w-fit">
                                    {getPlanIcon(index)}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                                <p className="text-gray-400 text-xs mb-6 min-h-[40px]">{plan.desc}</p>
                                <div className="flex items-baseline gap-1 bg-white/5 p-3 rounded-lg">
                                    <span className={`text-2xl font-bold ${index === 2 ? 'text-primary-gold' : 'text-white'}`}>
                                        {plan.price}
                                    </span>
                                    <span className="text-gray-500 text-sm">{plan.duration}</span>
                                </div>
                            </div>

                            <div className="flex-grow mb-8">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                                    {t.features}
                                </p>
                                <ul className="space-y-3">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-gray-300 text-sm">
                                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${index === 2 ? 'text-primary-gold' :
                                                    index === 3 ? 'text-purple-400' :
                                                        'text-gray-500'
                                                }`} />
                                            <span className="leading-tight">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button className={`w-full py-3 px-6 rounded-xl font-bold text-sm transition-all duration-300
                                ${index === 2
                                    ? 'bg-primary-gold text-black hover:bg-yellow-400 hover:shadow-lg hover:shadow-primary-gold/20'
                                    : index === 3
                                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
                                        : 'bg-white/5 text-white hover:bg-white/10 border border-white/5 hover:border-white/10'
                                }
                            `}>
                                {t.getStarted}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default PricingSection;
