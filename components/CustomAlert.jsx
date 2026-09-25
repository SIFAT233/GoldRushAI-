
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const CustomAlert = ({ isOpen, onClose, title, message, type = 'info', onConfirm }) => {
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAnimate(true);
        } else {
            setAnimate(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay">
            <div className={`modal-container max-w-sm ${animate ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} transition-all duration-300 p-0`} onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center space-y-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${type === 'danger' ? 'bg-red-500/10 text-red-500' :
                        type === 'success' ? 'bg-green-500/10 text-green-500' :
                            'bg-primary-gold/10 text-primary-gold'
                        }`}>
                        {type === 'danger' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        ) : type === 'success' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                        )}
                    </div>

                    <h3 className="modal-title text-center">{title}</h3>
                    <p className="text-gray-400 text-sm">{message}</p>

                    <div className="flex gap-3 w-full justify-center pt-2">
                        {onConfirm ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="modal-btn-cancel py-2 text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { onConfirm(); onClose(); }}
                                    className={`modal-btn-primary py-2 text-sm shadow-lg ${type === 'danger' ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' :
                                        'bg-primary-gold text-black hover:bg-yellow-400 shadow-primary-gold/20'
                                        }`}
                                >
                                    Confirm
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onClose}
                                className="modal-btn-primary w-full py-2 text-sm"
                            >
                                Okay
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CustomAlert;
