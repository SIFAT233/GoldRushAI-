import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { translations } from '../../utils/translations';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const ContactSection = () => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: ''
    });
    const [status, setStatus] = useState('');
    const { language } = useLanguage();
    const t = translations[language].contact;
    useScrollAnimation();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('sending');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            if (response.ok) {
                setStatus('success');
                setFormData({ name: '', phone: '', email: '' });
                console.log(data.message);
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('Error:', error);
            setStatus('error');
        }
    };

    return (
        <section id="contact" className="py-24 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-primary-gold/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="container mx-auto px-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="reveal">
                        <h2 className="section-title !text-left mb-6">{t.title}</h2>
                        <p className="section-subtitle !text-left mb-12 max-w-lg">
                            {t.subtitle}
                        </p>

                        <div className="grid gap-8">
                            <div className="flex gap-6 items-start group">
                                <div className="w-14 h-14 rounded-2xl bg-[#1A1D21] border border-white/5 flex items-center justify-center text-2xl group-hover:border-primary-gold/50 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-black/20">
                                    📞
                                </div>
                                <div>
                                    <div className="text-gray-400 text-sm mb-1 font-medium">{t.call}</div>
                                    <div className="text-xl font-bold text-white group-hover:text-primary-gold transition-colors">01874126156</div>
                                </div>
                            </div>

                            <div className="flex gap-6 items-start group">
                                <div className="w-14 h-14 rounded-2xl bg-[#1A1D21] border border-white/5 flex items-center justify-center text-2xl group-hover:border-primary-gold/50 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-black/20">
                                    ✉️
                                </div>
                                <div>
                                    <div className="text-gray-400 text-sm mb-1 font-medium">{t.email}</div>
                                    <div className="text-xl font-bold text-white group-hover:text-primary-gold transition-colors">info@goldrushbd.com</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1A1D21] border border-white/10 rounded-3xl p-8 shadow-2xl reveal delay-200 relative">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-3xl pointer-events-none"></div>

                        <form onSubmit={handleSubmit} className="grid gap-6 relative z-10">
                            <div className="group">
                                <label className="block mb-2 text-sm font-medium text-gray-400 group-focus-within:text-primary-gold transition-colors">{t.form.name}</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3.5 bg-[#0B0D10] border border-white/10 rounded-xl text-white outline-none focus:border-primary-gold focus:ring-1 focus:ring-primary-gold/50 transition-all placeholder-gray-600"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div className="group">
                                <label className="block mb-2 text-sm font-medium text-gray-400 group-focus-within:text-primary-gold transition-colors">{t.form.phone}</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3.5 bg-[#0B0D10] border border-white/10 rounded-xl text-white outline-none focus:border-primary-gold focus:ring-1 focus:ring-primary-gold/50 transition-all placeholder-gray-600"
                                    placeholder="+880 1XXX XXXXXX"
                                />
                            </div>

                            <div className="group">
                                <label className="block mb-2 text-sm font-medium text-gray-400 group-focus-within:text-primary-gold transition-colors">{t.form.email}</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3.5 bg-[#0B0D10] border border-white/10 rounded-xl text-white outline-none focus:border-primary-gold focus:ring-1 focus:ring-primary-gold/50 transition-all placeholder-gray-600"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-gradient-to-r from-primary-gold to-yellow-600 text-darker-bg font-bold rounded-xl hover:shadow-lg hover:shadow-primary-gold/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mt-2"
                            >
                                {status === 'sending' ? t.form.sending : t.form.send}
                            </button>

                            {status === 'success' && (
                                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-center text-sm font-medium animate-fade-in">
                                    {t.form.success}
                                </div>
                            )}
                            {status === 'error' && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center text-sm font-medium animate-fade-in">
                                    {t.form.error}
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ContactSection;
