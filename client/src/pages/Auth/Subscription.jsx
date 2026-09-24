import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import goldRushBg from '../../assets/goldrush1.png';

const PENDING_SIGNUP_USER_KEY = 'pending_signup_user';

const Subscription = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [user] = useState(() => {
        if (location.state?.user) return location.state.user;
        const cached = localStorage.getItem(PENDING_SIGNUP_USER_KEY);
        if (!cached) return null;
        try {
            return JSON.parse(cached);
        } catch {
            localStorage.removeItem(PENDING_SIGNUP_USER_KEY);
            return null;
        }
    });

    useEffect(() => {
        if (location.state?.user) {
            localStorage.setItem(PENDING_SIGNUP_USER_KEY, JSON.stringify(location.state.user));
        }
        if (!user) {
            localStorage.removeItem(PENDING_SIGNUP_USER_KEY);
            navigate('/signin', { replace: true });
        }
    }, [location.state, navigate, user]);

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#050608] text-white flex items-center justify-center p-4 relative overflow-hidden selection:bg-primary-gold/30 selection:text-white">
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
                <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-primary-gold/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-gold/10 rounded-full blur-[100px]"></div>
            </div>

            <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-[#121418]/85 backdrop-blur-xl p-8 sm:p-10 text-center shadow-2xl">
                <img src={goldRushBg} alt="Gold Rush" className="h-14 mx-auto mb-6" />
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Waiting for Approval</h1>
                <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
                    Your shop setup and legal documents were submitted successfully.
                    Super Admin will review your documents before activating the account.
                </p>
                <p className="text-primary-gold mt-4 font-semibold">
                    After approval, a 7-day free trial will be activated automatically.
                </p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                        to="/signin"
                        className="py-3 rounded-xl bg-primary-gold text-black font-bold hover:bg-yellow-400 transition-colors"
                    >
                        Go to Sign In
                    </Link>
                    <Link
                        to="/"
                        className="py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-colors"
                    >
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Subscription;
