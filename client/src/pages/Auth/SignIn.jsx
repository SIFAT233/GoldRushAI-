import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import goldRushBg from '../../assets/goldrush1.png';
import { useLanguage } from '../../context/LanguageContext';
import { Store, CheckCircle2 } from 'lucide-react';

const createEmptyPasscodeDigits = () => new Array(6).fill('');

const authTranslations = {
    EN: {
        title: 'Welcome Back!',
        subtitle: 'Sign in to access your shop dashboard.',
        emailPlaceholder: 'Email Address',
        passwordPlaceholder: 'Password',
        signIn: 'Sign In',
        forgotPassword: 'Forgot Password?',
        noAccount: 'New to Gold Rush?',
        signUp: 'Create Account',
        signInLink: 'Sign In',
        tagline: 'Manage your Jewellery Shop with Confidence.',
        signingIn: 'Signing you in...'
    }
};
authTranslations.BN = authTranslations.EN;

const SignIn = () => {
    const { language } = useLanguage();
    const t = authTranslations[language] || authTranslations.EN;
    const adminConfig = {
        user: import.meta.env.VITE_ADMIN_USER,
        password: import.meta.env.VITE_ADMIN_PASSWORD,
        userId: import.meta.env.VITE_ADMIN_USER_ID,
        shopownerId: import.meta.env.VITE_ADMIN_SHOPOWNER_ID
    };

    const [formError, setFormError] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [showBranchPicker, setShowBranchPicker] = useState(false);
    const [branchOptions, setBranchOptions] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [branchPickerStep, setBranchPickerStep] = useState('select');
    const [branchPasscodeDigits, setBranchPasscodeDigits] = useState(() => createEmptyPasscodeDigits());
    const [branchAuthContext, setBranchAuthContext] = useState({ userId: '', shopownerId: '' });
    const [branchPickerError, setBranchPickerError] = useState('');
    const [isBranchConfirming, setIsBranchConfirming] = useState(false);
    const [formData, setFormData] = useState({
        identifier: '',
        password: ''
    });

    const navigate = useNavigate();
    const handleChange = (key) => (e) => {
        setFormError('');
        const raw = e.target.value;
        setFormData((prev) => ({ ...prev, [key]: raw }));
    };

    const isMainBranch = (value) => value === true || value === 1 || String(value) === '1' || String(value).toLowerCase() === 'true';
    const normalizePasscode = (value) => {
        const bnMap = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
        return String(value || '')
            .split('')
            .map((ch) => bnMap[ch] ?? ch)
            .join('')
            .replace(/\D/g, '')
            .slice(0, 6);
    };

    const resolveBranchAndRoute = async ({ userId, shopownerId }) => {
        const queryParam = shopownerId
            ? `shopownerId=${encodeURIComponent(shopownerId)}`
            : `userId=${encodeURIComponent(userId)}`;
        const response = await fetch(`/api/branches?${queryParam}`);
        if (!response.ok) {
            throw new Error('Failed to load branches');
        }
        const data = await response.json();
        const branches = Array.isArray(data) ? data : [];

        if (branches.length === 0) {
            localStorage.setItem('activeBranch', 'Main Branch');
            localStorage.setItem('activeBranchIsMain', 'true');
            navigate('/shopowner/dashboard');
            return;
        }

        if (branches.length === 1) {
            localStorage.setItem('activeBranch', branches[0].name);
            localStorage.setItem('activeBranchIsMain', isMainBranch(branches[0].is_main) ? 'true' : 'false');
            navigate('/shopowner/dashboard');
            return;
        }

        const defaultBranch = branches.find((b) => isMainBranch(b.is_main)) || branches[0];
        setBranchOptions(branches);
        setSelectedBranchId(String(defaultBranch.id));
        setBranchPickerStep('select');
        setBranchPasscodeDigits(createEmptyPasscodeDigits());
        setBranchAuthContext({
            userId: userId ? String(userId) : '',
            shopownerId: shopownerId ? String(shopownerId) : ''
        });
        setBranchPickerError('');
        setIsBranchConfirming(false);
        setShowBranchPicker(true);
    };

    const handleBranchContinue = async () => {
        if (!selectedBranchId) return;
        const selected = branchOptions.find((branch) => String(branch.id) === String(selectedBranchId));
        if (!selected) {
            setBranchPickerError('Please select a valid branch.');
            return;
        }

        if (branchPickerStep === 'select') {
            setBranchPickerStep('passcode');
            setBranchPasscodeDigits(createEmptyPasscodeDigits());
            setBranchPickerError('');
            setTimeout(() => {
                passcodeInputRefs.current[0]?.focus();
            }, 80);
            return;
        }

        const normalizedPasscode = branchPasscodeDigits.join('');
        if (normalizedPasscode.length !== 6) {
            setBranchPickerError('Enter valid 6-digit passcode.');
            return;
        }

        try {
            setIsBranchConfirming(true);
            setBranchPickerError('');

            const verifyRes = await fetch('/api/branches/verify-passcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branchId: selected.id,
                    passcode: normalizedPasscode,
                    userId: branchAuthContext.userId || undefined,
                    shopownerId: branchAuthContext.shopownerId || undefined
                })
            });

            if (!verifyRes.ok) {
                const errData = await verifyRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Invalid passcode');
            }

            localStorage.setItem('activeBranch', selected.name);
            localStorage.setItem('activeBranchIsMain', isMainBranch(selected.is_main) ? 'true' : 'false');
            setShowBranchPicker(false);
            navigate('/shopowner/dashboard');
        } catch (err) {
            setBranchPickerError(err.message || 'Invalid passcode');
        } finally {
            setIsBranchConfirming(false);
        }
    };

    const handleBranchPasscodeDigitChange = (index, value) => {
        const normalized = normalizePasscode(value);
        if (value && normalized.length === 0) return;

        setBranchPickerError('');
        setBranchPasscodeDigits((prev) => {
            const next = [...prev];
            if (!normalized) {
                next[index] = '';
                return next;
            }

            const digits = normalized.split('');
            let cursor = index;
            digits.forEach((digit) => {
                if (cursor < 6) {
                    next[cursor] = digit;
                    cursor += 1;
                }
            });
            return next;
        });

        if (normalized.length > 0) {
            const nextFocusIndex = Math.min(index + normalized.length, 5);
            setTimeout(() => {
                passcodeInputRefs.current[nextFocusIndex]?.focus();
            }, 0);
        }
    };

    const handleBranchPasscodeInputKeyDown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!isBranchConfirming) handleBranchContinue();
            return;
        }

        if (e.key === 'Backspace') {
            e.preventDefault();
            setBranchPickerError('');
            setBranchPasscodeDigits((prev) => {
                const next = [...prev];
                if (next[index]) {
                    next[index] = '';
                    return next;
                }
                if (index > 0) {
                    next[index - 1] = '';
                    setTimeout(() => {
                        passcodeInputRefs.current[index - 1]?.focus();
                    }, 0);
                }
                return next;
            });
            return;
        }

        if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            passcodeInputRefs.current[index - 1]?.focus();
            return;
        }

        if (e.key === 'ArrowRight' && index < 5) {
            e.preventDefault();
            passcodeInputRefs.current[index + 1]?.focus();
        }
    };

    const handleBranchPasscodePaste = (e) => {
        e.preventDefault();
        const pasted = normalizePasscode(e.clipboardData.getData('text'));
        if (!pasted) return;

        const digits = pasted.split('').slice(0, 6);
        setBranchPickerError('');
        setBranchPasscodeDigits(() => {
            const next = createEmptyPasscodeDigits();
            digits.forEach((digit, idx) => {
                next[idx] = digit;
            });
            return next;
        });

        const focusIndex = Math.max(0, Math.min(digits.length, 6) - 1);
        setTimeout(() => {
            passcodeInputRefs.current[focusIndex]?.focus();
        }, 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isAuthenticating) return;
        setFormError('');
        setLoadingMessage(t.signingIn);
        setIsAuthenticating(true);

        try {
            if (
                adminConfig.user
                && adminConfig.password
                && adminConfig.userId
                && adminConfig.shopownerId
                && formData.identifier === adminConfig.user
                && formData.password === adminConfig.password
            ) {
                localStorage.setItem('shopowner_auth', 'true');
                localStorage.setItem('userId', adminConfig.userId);
                localStorage.setItem('shopownerId', adminConfig.shopownerId);
                await resolveBranchAndRoute({
                    userId: adminConfig.userId,
                    shopownerId: adminConfig.shopownerId
                });
                return;
            }

            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: formData.identifier, password: formData.password })
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (jsonError) {
                console.error("Failed to parse JSON:", text);
                throw new Error(text.substring(0, 50) || "Server Error (Non-JSON response)");
            }

            if (response.ok) {
                if (result.user.role === 'superadmin') {
                    navigate('/superadmin');
                } else {
                    localStorage.setItem('shopowner_auth', 'true');
                    localStorage.setItem('userId', result.user.id);
                    localStorage.setItem('shopownerId', result.user.shopowner_id);
                    await resolveBranchAndRoute({
                        userId: result.user.id,
                        shopownerId: result.user.shopowner_id
                    });
                }
            } else {
                setFormError(result.error || "Login failed");
            }
        } catch (e) {
            console.error(e);
            setFormError(e.message || "Login Error");
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handleBranchPickerCancel = () => {
        if (isBranchConfirming) return;
        setShowBranchPicker(false);
        setBranchPickerStep('select');
        setBranchPickerError('');
        setBranchPasscodeDigits(createEmptyPasscodeDigits());
        localStorage.removeItem('shopowner_auth');
        localStorage.removeItem('userId');
        localStorage.removeItem('shopownerId');
        localStorage.removeItem('activeBranch');
        localStorage.removeItem('activeBranchIsMain');
    };

    // Bubble Animation Logic
    const [bubbles, setBubbles] = useState([]);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const mouseRef = useRef({ x: 0, y: 0 });
    const passcodeInputRefs = useRef([]);

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
            for (let i = 0; i < 20; i++) { // Increased count
                newBubbles.push({
                    id: i,
                    size: Math.random() * 60 + 20, // 20px - 80px
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    speedX: (Math.random() - 0.5) * 0.2, // Drift speed
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

                // Add gentle drift
                x += speedX;
                y += speedY;

                // Mouse repulsion
                const dx = (x / 100 * window.innerWidth) - mouseRef.current.x;
                const dy = (y / 100 * window.innerHeight) - mouseRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 200) { // Repulsion range
                    const force = (200 - distance) / 200;
                    x += (dx / distance) * force * 0.5;
                    y += (dy / distance) * force * 0.5;
                }

                // Wrap around edges
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
            {isAuthenticating && (
                <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#121418] rounded-2xl border border-white/10 shadow-2xl px-6 py-4 flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full border-2 border-primary-gold border-t-transparent animate-spin"></div>
                        <span className="text-sm font-semibold text-white">{loadingMessage || t.signingIn}</span>
                    </div>
                </div>
            )}
            {showBranchPicker && (
                <div
                    className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={handleBranchPickerCancel}
                >
                    <div
                        className="w-full max-w-md bg-[#121418] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-5 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white">{branchPickerStep === 'select' ? 'Select Branch' : 'Enter Branch Passcode'}</h3>
                            <p className="text-sm text-gray-400 mt-1">
                                {branchPickerStep === 'select' ? 'Choose where you want to enter.' : 'Enter 6-digit passcode to continue.'}
                            </p>
                        </div>
                        <div className="p-4 space-y-3">
                            {branchPickerStep === 'select' ? (
                                <div className="space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar">
                                    {branchOptions.map((branch) => {
                                        const isSelected = String(selectedBranchId) === String(branch.id);
                                        return (
                                            <button
                                                key={branch.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedBranchId(String(branch.id));
                                                    setBranchPickerError('');
                                                }}
                                                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${isSelected ? 'bg-primary-gold/10 border-primary-gold/40 text-primary-gold' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Store className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-primary-gold' : 'text-gray-400'}`} />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold">{branch.name}</p>
                                                            {isMainBranch(branch.is_main) && (
                                                                <span className="inline-flex items-center rounded-full border border-primary-gold/30 bg-primary-gold/10 px-2 py-0.5 text-[10px] font-semibold text-primary-gold">
                                                                    Main
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-1">{branch.location || 'No location'}</p>
                                                    </div>
                                                </div>
                                                {isSelected && <CheckCircle2 className="w-5 h-5 text-primary-gold" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-400">
                                        Please enter the 6-digit admin passcode to switch to{' '}
                                        <span className="text-white font-bold">
                                            {branchOptions.find((b) => String(b.id) === String(selectedBranchId))?.name || 'selected branch'}
                                        </span>.
                                    </p>

                                    <div className="flex items-center justify-center gap-2 py-1">
                                        {branchPasscodeDigits.map((digit, index) => (
                                            <input
                                                key={index}
                                                ref={(el) => {
                                                    passcodeInputRefs.current[index] = el;
                                                }}
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                autoComplete="one-time-code"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck={false}
                                                translate="no"
                                                lang="en"
                                                dir="ltr"
                                                data-lpignore="true"
                                                data-1p-ignore="true"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleBranchPasscodeDigitChange(index, e.target.value)}
                                                onKeyDown={(e) => handleBranchPasscodeInputKeyDown(e, index)}
                                                onPaste={handleBranchPasscodePaste}
                                                className="w-12 h-12 bg-[#0B0D10] border border-white/10 rounded-lg text-center text-xl font-bold text-white focus:outline-none focus:border-primary-gold/60 transition-colors"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {branchPickerError && (
                                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{branchPickerError}</p>
                            )}
                        </div>
                        <div className="px-4 pb-4 flex gap-2">
                            {branchPickerStep === 'passcode' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isBranchConfirming) return;
                                        setBranchPickerStep('select');
                                        setBranchPasscodeDigits(createEmptyPasscodeDigits());
                                        setBranchPickerError('');
                                    }}
                                    disabled={isBranchConfirming}
                                    className="flex-1 bg-white/10 text-white font-semibold py-3 rounded-xl hover:bg-white/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleBranchContinue}
                                disabled={!selectedBranchId || isBranchConfirming || (branchPickerStep === 'passcode' && branchPasscodeDigits.join('').length !== 6)}
                                className={`${branchPickerStep === 'passcode' ? 'flex-1' : 'w-full'} bg-gradient-to-r from-[#C9971A] via-[#E3C15A] to-[#B67E12] hover:from-[#D2A62A] hover:via-[#E8CB69] hover:to-[#C68E20] text-[#1B1404] font-bold py-3 rounded-xl shadow-[0_8px_24px_rgba(188,140,31,0.35)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2`}
                            >
                                {isBranchConfirming && <span className="h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin"></span>}
                                {branchPickerStep === 'select' ? 'Continue' : 'Verify & Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mouse Follow Spotlight for Body */}
            <div
                className="absolute pointer-events-none z-0 transition-opacity duration-500 hidden lg:block"
                style={{
                    background: `radial-gradient(1200px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(239, 182, 34, 0.05), transparent 40%)`,
                    inset: 0
                }}
            ></div>

            {/* Background Texture & Animations (Gold Bubbles) */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>

                {/* Floating Gold Bubbles */}
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

            {/* Main Floating Card */}
            <div className="w-full max-w-[1280px] h-[760px] bg-[#F3F4F6] rounded-[40px] shadow-[0_0_90px_-10px_rgba(239,182,34,0.4)] flex relative overflow-hidden ring-1 ring-primary-gold/30 mx-auto">

                {/* Left Side: Form Section */}
                <div className="w-full lg:w-[45%] p-10 lg:p-14 flex flex-col justify-center relative z-10 bg-[#F3F4F6]">
                    <div className="max-w-md mx-auto w-full space-y-8">
                        {/* Logo */}
                        <div className="mb-4">
                            <Link to="/" className="inline-flex items-center gap-4 group">
                                <img
                                    src={goldRushBg}
                                    alt="Gold Rush"
                                    className="h-12 w-auto object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.18)] rounded-lg"
                                />
                                <h1 className="text-2xl font-bold tracking-widest text-gray-900 group-hover:text-primary-gold transition-colors duration-300 uppercase font-outfit">
                                    GOLD RUSH
                                </h1>
                            </Link>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight animate-fade-in-up">
                                {t.title}
                            </h2>
                            <p className="text-gray-800 font-medium text-lg animate-fade-in-up stagger-delay-1">
                                {t.subtitle}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up stagger-delay-2" autoComplete="off">
                            {formError && (
                                <div className="rounded-2xl border border-red-200/70 bg-red-50/90 text-red-800 px-4 py-3 text-sm font-semibold shadow-sm shadow-red-900/10">
                                    {formError}
                                </div>
                            )}

                            <div className="space-y-5">
                                <div className="group">
                                    <label className="text-xs font-bold text-gray-800 uppercase tracking-widest ml-1 mb-2 block">{t.emailPlaceholder}</label>
                                    <input
                                        type="text"
                                        placeholder="name@example.com"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-black placeholder-black/55 focus:outline-none focus:border-primary-gold/50 focus:bg-white focus:ring-4 focus:ring-primary-gold/5 transition-all font-medium text-base hover:border-gray-300"
                                        value={formData.identifier}
                                        onChange={handleChange('identifier')}
                                        autoComplete="off"
                                        disabled={isAuthenticating}
                                    />
                                </div>
                                <div className="group">
                                    <div className="flex justify-between items-center ml-1 mb-2">
                                        <label className="text-xs font-bold text-gray-800 uppercase tracking-widest block">{t.passwordPlaceholder}</label>
                                        <a href="#" className="text-xs font-bold text-primary-gold hover:text-yellow-600 transition-colors">{t.forgotPassword}</a>
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-black placeholder-black/55 focus:outline-none focus:border-primary-gold/50 focus:bg-white focus:ring-4 focus:ring-primary-gold/5 transition-all font-medium text-base hover:border-gray-300"
                                        value={formData.password}
                                        onChange={handleChange('password')}
                                        disabled={isAuthenticating}
                                    />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-6 flex gap-4">
                                <button
                                    type="submit"
                                    disabled={isAuthenticating}
                                    className="flex-1 w-full bg-gradient-to-r from-[#C9971A] via-[#E3C15A] to-[#B67E12] hover:from-[#D2A62A] hover:via-[#E8CB69] hover:to-[#C68E20] text-[#1B1404] font-bold text-lg py-4 rounded-2xl shadow-[0_8px_24px_rgba(188,140,31,0.35)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    {isAuthenticating ? (
                                        <span className="inline-flex items-center gap-2">
                                            <span className="h-4 w-4 rounded-full border-2 border-black/40 border-t-black animate-spin"></span>
                                            {t.signingIn}
                                        </span>
                                    ) : (
                                        t.signIn
                                    )}
                                </button>
                            </div>

                            <p className="text-center text-gray-800 font-medium text-sm">
                                {t.noAccount}{' '}
                                <Link to="/signup" className="text-primary-gold hover:text-yellow-600 font-bold transition-colors ml-1 hover:underline underline-offset-4 decoration-primary-gold/50">
                                    {t.signUp}
                                </Link>
                            </p>
                        </form>
                    </div>
                </div>

                {/* Right Side: Visual / Map Area */}
                <div className={`hidden lg:block w-[55%] relative overflow-hidden transition-all duration-700 bg-black`}>

                    {/* Curved Divider Overlay */}
                    <div className="absolute top-0 bottom-0 left-[-1px] w-24 z-20 pointer-events-none">
                        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 0 H100 V100 H0 V0 Z" fill="transparent" />
                            <path d="M0 0 C40 20 60 40 60 50 C60 60 40 80 0 100 V0 Z" fill="#F3F4F6" />
                        </svg>
                    </div>

                    {/* Content Layer */}
                    <div className="absolute inset-0 z-10">
                        <div className="w-full h-full relative">
                            {/* Background Image */}
                            <div
                                className="absolute inset-0"
                                style={{
                                    background: 'radial-gradient(circle at 70% 30%, rgba(239,182,34,0.18), transparent 32%), radial-gradient(circle at 20% 70%, rgba(239,182,34,0.12), transparent 28%), linear-gradient(135deg, rgba(8,8,10,0.95), rgba(12,12,14,0.9) 45%, rgba(8,8,10,0.92))'
                                }}
                            ></div>
                            <div className="absolute inset-0 bg-gradient-to-l from-black/90 via-black/75 to-black/50"></div>

                            {/* Text Content */}
                            <div className="absolute bottom-20 right-20 text-right space-y-4 max-w-lg p-8">
                                <h2 className="text-5xl font-bold text-white leading-tight drop-shadow-xl">
                                    Crafting <br />
                                    <span className="text-primary-gold">Elegance.</span>
                                </h2>
                                <p className="text-gray-200 text-lg drop-shadow-lg font-medium">
                                    Manage your inventory, sales, and customers with a system as precious as your products.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignIn;

