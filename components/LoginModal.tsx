
import React, { useState } from 'react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleLogin = () => {
        // In a real app, this would be an API call.
        // Here we use simple hardcoded credentials for demonstration.
        if (username === 'admin' && password === 'password') {
            setError('');
            onLoginSuccess();
            onClose();
        } else {
            setError('Username atau password salah.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={onClose}>
            <div className="bg-base-200 rounded-lg shadow-xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-white mb-6 text-center">Admin Login</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md p-2 text-white"
                            placeholder="admin"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md p-2 text-white"
                            placeholder="password"
                        />
                    </div>
                    {error && <p className="text-error text-sm text-center">{error}</p>}
                    <button
                        onClick={handleLogin}
                        className="w-full bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        Login
                    </button>
                </div>
            </div>
        </div>
    );
};
