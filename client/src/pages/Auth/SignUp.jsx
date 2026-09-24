import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import LocationPicker from '../../components/LocationPicker';
import { useLanguage } from '../../context/LanguageContext';

const authTranslations = {
    EN: {
        signUpTitle: 'Start Your Journey',
        signUpSubtitle: 'Join Gold Rush to manage your jewellery business.',
        shopDetailsTitle: 'Setup Shop',
        shopDetailsSubtitle: 'Tell us about your jewellery business.',
        fullNamePlaceholder: 'Full Name',
        phonePlaceholder: 'Phone Number',
        confirmPasswordPlaceholder: 'Confirm Password',
        shopNamePlaceholder: 'Shop Name',
        branchCountPlaceholder: 'Number of Branches',
        emailPlaceholder: 'Email Address',
        passwordPlaceholder: 'Password',
        yesAccount: 'Already a member?',
        signUp: 'Create Account',
        next: 'Next Step',
        back: 'Back',
        signInLink: 'Sign In',
        tagline: 'Manage your Jewellery Shop with Confidence.'
    }
};
authTranslations.BN = authTranslations.EN;

const REQUIRED_DOCUMENTS = [
    { type: 'nid', label: 'National ID (NID)' },
    { type: 'trade_license', label: 'Trade License' },
    { type: 'etin_certificate', label: 'E-TIN Certificate' },
    { type: 'vat_bin_registration', label: 'VAT/BIN Registration' },
    { type: 'gold_license', label: 'Gold License' },
    { type: 'bajus_membership', label: 'BAJUS Membership' },
    { type: 'irc', label: 'IRC' }
];

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read selected file.'));
        reader.readAsDataURL(file);
    });

const SignUp = () => {
    const { language } = useLanguage();
    const t = authTranslations[language] || authTranslations.EN;

    const [step, setStep] = useState(1);
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [formData, setFormData] = useState({
        password: '',
        fullName: '',
        phone: '',
        confirmPassword: '',
        email: '',
        shop_name: ''
    });
    const [location, setLocation] = useState(null);
    const [documentSelections, setDocumentSelections] = useState([]);

    const navigate = useNavigate();
    const getIdentifier = () => {
        return formData.email.trim().toLowerCase();
    };

    const handleChange = (key) => (e) => {
        setFormError('');
        const raw = String(e.target.value || '');
        let nextValue = raw;
        if (key === 'phone') {
            nextValue = raw.replace(/\D/g, '').slice(0, 11);
        } else if (key === 'email') {
            nextValue = raw.replace(/\s+/g, '');
        }
        setFormData((prev) => ({ ...prev, [key]: nextValue }));
    };

    const handleDocumentBatchChange = async (e) => {
        setFormError('');
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const oversizeFiles = files.filter((file) => file.size > MAX_DOCUMENT_SIZE_BYTES);
        if (oversizeFiles.length > 0) {
            setFormError(`These files exceed 10MB: ${oversizeFiles.map((f) => f.name).join(', ')}`);
            e.target.value = '';
            return;
        }

        try {
            const uploaded = await Promise.all(files.map(async (file, idx) => {
                const fileData = await readFileAsDataUrl(file);

                return {
                    id: `${Date.now()}-${idx}-${file.name}`,
                    document_type: '',
                    document_label: '',
                    file_name: file.name,
                    mime_type: file.type || 'application/octet-stream',
                    file_size_bytes: file.size,
                    file_data: fileData
                };
            }));

            setDocumentSelections((prev) => {
                const merged = [...prev, ...uploaded];
                const seen = new Set();
                return merged.filter((doc) => {
                    const key = `${doc.file_name}|${doc.file_size_bytes}|${doc.mime_type}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            });
        } catch (err) {
            console.error('Document upload read error:', err);
            setFormError('Failed to process selected documents. Please try again.');
        } finally {
            e.target.value = '';
        }
    };

    const handleRemoveDocument = (id) => {
        setDocumentSelections((prev) => prev.filter((doc) => doc.id !== id));
    };

    const validateStep1 = () => {
        const email = formData.email.trim();
        const missing = !formData.fullName.trim() || !formData.phone.trim() || !email || !formData.password.trim() || !formData.confirmPassword.trim();
        if (missing) {
            setFormError('Please fill in all fields.');
            return false;
        }
        if (formData.phone.length !== 11) {
            setFormError('Phone number must be exactly 11 digits.');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFormError('Please enter a valid email address.');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setFormError('Passwords do not match.');
            return false;
        }
        setFormError('');
        return true;
    };

    const handleNext = (e) => {
        e.preventDefault();
        if (validateStep1()) {
            setStep(2);
        }
    };

    const handleBack = () => {
        setStep(1);
    };

    const isStep1Complete = !!(
        formData.fullName.trim() &&
        formData.phone.length === 11 &&
        formData.email.trim() &&
        formData.password.trim() &&
        formData.confirmPassword.trim()
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setFormError('');

        if (step === 1) {
            handleNext(e);
            return;
        }

        if (!formData.shop_name.trim()) {
            setFormError('Shop name is required.');
            return;
        }
        if (documentSelections.length === 0) {
            setFormError('Please upload at least one legal document.');
            return;
        }

        if (!location) {
            setFormError('Please select your shop location on the map.');
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: formData.fullName.trim(),
                    phone: formData.phone,
                    identifier: getIdentifier(),
                    password: formData.password,
                    shop_name: formData.shop_name.trim(),
                    latitude: location.lat,
                    longitude: location.lng,
                    documents: documentSelections.map((doc) => ({
                        document_type: doc.document_type,
                        document_label: doc.document_label,
                        file_name: doc.file_name,
                        mime_type: doc.mime_type,
                        file_size_bytes: doc.file_size_bytes,
                        file_data: doc.file_data
                    }))
                }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('pending_signup_user', JSON.stringify(data.user));
                navigate('/subscription', { state: { user: data.user } });
            } else {
                setFormError(data.error || 'Signup Failed');
            }
        } catch (error) {
            console.error('Error during signup:', error);
            setFormError('Something went wrong.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Bubble Animation Logic
    const [bubbles, setBubbles] = useState([]);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const mouseRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        const generateBubbles = () => {
            const newBubbles = [];
            for (let i = 0; i < 20; i++) {
                newBubbles.push({
                    id: i,
                    size: Math.random() * 60 + 20,
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    speedX: (Math.random() - 0.5) * 0.2,
                    speedY: (Math.random() - 0.5) * 0.2
                });
            }
            setBubbles(newBubbles);
        };
        generateBubbles();
    }, []);

    useEffect(() => {
        let frameId;
        const animateBubbles = () => {
            setBubbles(prevBubbles => prevBubbles.map(bubble => {
                let { x, y, speedX, speedY } = bubble;
                x += speedX;
                y += speedY;

                const dx = (x / 100 * window.innerWidth) - mouseRef.current.x;
                const dy = (y / 100 * window.innerHeight) - mouseRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 200) {
                    const force = (200 - distance) / 200;
                    x += (dx / distance) * force * 0.5;
                    y += (dy / distance) * force * 0.5;
                }

                if (x < -10) x = 110;
                if (x > 110) x = -10;
                if (y < -10) y = 110;
                if (y > 110) y = -10;

                return { ...bubble, x, y };
            }));
            frameId = requestAnimationFrame(animateBubbles);
        };
        frameId = requestAnimationFrame(animateBubbles);
        return () => cancelAnimationFrame(frameId);
    }, []);

    return (
        <div className="min-h-screen bg-[#050608] text-white flex items-center justify-center p-4 relative overflow-hidden selection:bg-primary-gold/30 selection:text-white">
            <div
                className="absolute pointer-events-none z-0 transition-opacity duration-500 hidden lg:block"
                style={{
                    background: `radial-gradient(1200px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(239, 182, 34, 0.05), transparent 40%)`,
                    inset: 0
                }}
            ></div>

            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
                {bubbles.map((bubble) => (
                    <div
                        key={bubble.id}
                        className="absolute rounded-full bubble-glow animate-float-around"
                        style={{
                            width: `${bubble.size}px`,
                            height: `${bubble.size}px`,
                            left: `${bubble.x}%`,
                            top: `${bubble.y}%`,
                            opacity: Math.min(0.95, 0.55 + bubble.size / 200),
                            willChange: 'transform, left, top'
                        }}
                    ></div>
                ))}
            </div>

            <div className="w-full max-w-[1280px] h-[min(760px,calc(100vh-2rem))] bg-[#F3F2EE] rounded-[40px] shadow-[0_0_90px_-10px_rgba(239,182,34,0.4)] flex relative overflow-hidden ring-1 ring-primary-gold/30 mx-auto">
                <div className="w-full lg:w-[45%] p-5 sm:p-6 lg:p-8 xl:p-10 flex flex-col justify-center relative z-10 bg-[#F3F2EE] overflow-x-hidden overflow-y-auto">
                    <div className="max-w-md mx-auto w-full min-w-0 space-y-4">
                        <div className="space-y-1.5 min-w-0">
                            <h2 className={`${step === 2 ? 'text-3xl sm:text-[2.2rem]' : 'text-3xl sm:text-4xl'} font-bold text-gray-900 tracking-tight animate-fade-in-up break-words`}>
                                {step === 1 ? t.signUpTitle : t.shopDetailsTitle}
                            </h2>
                            <p className={`text-gray-800 font-medium ${step === 2 ? 'text-base' : 'text-base'} animate-fade-in-up stagger-delay-1 break-words`}>
                                {step === 1 ? t.signUpSubtitle : t.shopDetailsSubtitle}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3 animate-fade-in-up stagger-delay-2 min-w-0" autoComplete="off">
                            {formError && (
                                <div className="rounded-xl border border-red-200/70 bg-red-50/90 text-red-800 px-3 py-2 text-xs font-semibold shadow-sm shadow-red-900/10 break-words">
                                    {formError}
                                </div>
                            )}

                            {step === 1 && (
                                <div className="space-y-3">
                                    <div className="group">
                                        <label className="text-sm font-bold text-gray-800 uppercase tracking-[0.12em] ml-1 mb-1 block">{t.fullNamePlaceholder}</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Michal"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black placeholder-black/55 focus:outline-none focus:border-primary-gold/50 focus:bg-white focus:ring-4 focus:ring-primary-gold/5 transition-all font-medium text-base hover:border-gray-300"
                                            value={formData.fullName}
                                            onChange={handleChange('fullName')}
                                        />
                                    </div>
                                    <div className="group">
                                        <label className="text-sm font-bold text-gray-800 uppercase tracking-[0.12em] ml-1 mb-1 block">{t.phonePlaceholder}</label>
                                        <input
                                            type="text"
                                            placeholder="01XXXXXXXXX"
                                            inputMode="numeric"
                                            maxLength={11}
                                            pattern="[0-9]{11}"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black placeholder-black/55 focus:outline-none focus:border-primary-gold/50 focus:bg-white focus:ring-4 focus:ring-primary-gold/5 transition-all font-medium text-base hover:border-gray-300"
                                            value={formData.phone}
                                            onChange={handleChange('phone')}
                                        />
                                        <p className="text-sm text-gray-600 mt-1">Exactly 11 digits required.</p>
                                    </div>
                                    <div className="group">
                                        <label className="text-sm font-bold text-gray-800 uppercase tracking-[0.12em] ml-1 mb-1 block">{t.emailPlaceholder}</label>
                                        <input
                                            type="email"
                                            placeholder="username@example.com"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black placeholder-black/55 focus:outline-none focus:border-primary-gold/50 focus:bg-white focus:ring-4 focus:ring-primary-gold/5 transition-all font-medium text-base hover:border-gray-300"
                                            value={formData.email}
                                            onChange={handleChange('email')}
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div className="group">
                                        <label className="text-sm font-bold text-gray-800 uppercase tracking-[0.12em] ml-1 mb-1 block">{t.passwordPlaceholder}</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="********"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 pr-11 py-3 text-black placeholder-black/55 focus:outline-none focus:border-primary-gold/50 focus:bg-white focus:ring-4 focus:ring-primary-gold/5 transition-all font-medium text-base hover:border-gray-300"
                                                value={formData.password}
                                                onChange={handleChange('password')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((prev) => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-gray-900"
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="group">
                                        <label className="text-sm font-bold text-gray-800 uppercase tracking-[0.12em] ml-1 mb-1 block">{t.confirmPasswordPlaceholder}</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="********"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 pr-11 py-3 text-black placeholder-black/55 focus:outline-none focus:border-primary-gold/50 focus:bg-white focus:ring-4 focus:ring-primary-gold/5 transition-all font-medium text-base hover:border-gray-300"
                                                value={formData.confirmPassword}
                                                onChange={handleChange('confirmPassword')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword((prev) => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-gray-900"
                                                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                            >
                                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-3">
                                    <div className="group">
                                        <label className="text-xs font-bold text-gray-800 uppercase tracking-[0.14em] ml-1 mb-1 block">{t.shopNamePlaceholder}</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. City Gold House"
                                            disabled={isSubmitting}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black placeholder-black/55 focus:outline-none focus:border-primary-gold/50 focus:bg-white focus:ring-4 focus:ring-primary-gold/5 transition-all font-medium text-base hover:border-gray-300"
                                            value={formData.shop_name}
                                            onChange={handleChange('shop_name')}
                                        />
                                    </div>

                                    <div className="rounded-xl border border-gray-200 bg-white/60 p-3 space-y-2">
                                        <p className="text-xs font-bold text-gray-800 uppercase tracking-[0.14em]">
                                            Required Documents
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            Upload all legal documents together. No need to assign document type.
                                        </p>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 space-y-1.5">
                                            {REQUIRED_DOCUMENTS.map((doc) => (
                                                <div key={`required-${doc.type}`} className="flex items-center justify-between gap-2 text-[11px]">
                                                    <span className="font-semibold text-gray-700">{doc.label}</span>
                                                    <span className="font-bold text-gray-500">Required</span>
                                                </div>
                                            ))}
                                        </div>
                                        <label className="inline-flex items-center justify-center rounded-lg border border-primary-gold/40 bg-primary-gold/10 px-3 py-2 text-xs font-semibold text-primary-gold cursor-pointer hover:bg-primary-gold/20 transition-colors">
                                            Choose Documents (Multiple)
                                            <input
                                                type="file"
                                                multiple
                                                accept=".pdf,image/*"
                                                className="hidden"
                                                disabled={isSubmitting}
                                                onChange={handleDocumentBatchChange}
                                            />
                                        </label>
                                        <p className="text-[11px] text-gray-500">
                                            {documentSelections.length > 0
                                                ? `${documentSelections.length} document(s) selected. They will be sent directly to Super Admin.`
                                                : 'Choose one or more legal documents to continue.'}
                                        </p>
                                        {documentSelections.length > 0 && (
                                            <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 bg-white px-2 py-1.5 space-y-1">
                                                {documentSelections.map((doc) => (
                                                    <div key={doc.id} className="flex items-center justify-between gap-2">
                                                        <p className="text-[11px] text-gray-700 truncate">{doc.file_name}</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDocument(doc.id)}
                                                            className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                            aria-label={`Remove ${doc.file_name}`}
                                                            title="Remove"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex gap-3">
                                {step === 2 && (
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        disabled={isSubmitting}
                                        className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-900 font-bold text-base rounded-xl transition-all duration-300 border border-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {t.back}
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 w-full bg-gradient-to-r from-[#C9971A] via-[#E3C15A] to-[#B67E12] hover:from-[#D2A62A] hover:via-[#E8CB69] hover:to-[#C68E20] text-[#1B1404] font-bold text-base py-2.5 rounded-xl shadow-[0_8px_24px_rgba(188,140,31,0.35)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="inline-block h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            Creating...
                                        </>
                                    ) : (step === 1 ? t.next : 'Submit for Approval')}
                                </button>
                            </div>

                            <p className={`text-center text-gray-500 font-medium ${step === 2 ? 'text-sm' : 'text-sm'} break-words`}>
                                {t.yesAccount}{' '}
                                <Link to="/signin" className="text-primary-gold hover:text-yellow-600 font-bold transition-colors ml-1 hover:underline underline-offset-4 decoration-primary-gold/50">
                                    {t.signInLink}
                                </Link>
                            </p>
                        </form>
                    </div>
                </div>

                <div className={`hidden lg:block w-[55%] relative overflow-hidden transition-all duration-700 ${step === 2 ? 'bg-[#ECEAE4]' : 'bg-black'}`}>
                    <div className="absolute top-0 bottom-0 left-[-1px] w-24 z-20 pointer-events-none">
                        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 0 H100 V100 H0 V0 Z" fill="transparent" />
                            <path d="M0 0 C40 20 60 40 60 50 C60 60 40 80 0 100 V0 Z" fill="#F3F2EE" />
                        </svg>
                    </div>

                    <div className="absolute inset-0 z-10">
                        {step === 2 ? (
                            <div className="w-full h-full relative">
                                <LocationPicker value={location} onLocationSelect={setLocation} />
                            </div>
                        ) : (
                            <div className="w-full h-full relative">
                                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(239,182,34,0.18), transparent 32%), radial-gradient(circle at 20% 70%, rgba(239,182,34,0.12), transparent 28%), linear-gradient(135deg, rgba(8,8,10,0.95), rgba(12,12,14,0.9) 45%, rgba(8,8,10,0.92))' }}></div>
                                <div className="absolute inset-0 bg-gradient-to-l from-black/90 via-black/75 to-black/50"></div>
                                <div className="absolute bottom-20 right-20 text-right space-y-4 max-w-lg p-8">
                                    <h2 className="text-5xl font-bold text-white leading-tight drop-shadow-xl">
                                        Crafting <br /> <span className="text-primary-gold">Elegance.</span>
                                    </h2>
                                    <p className="text-gray-200 text-lg drop-shadow-lg font-medium">
                                        Manage your inventory, sales, and customers with a system as precious as your products.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignUp;

