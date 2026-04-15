
import React from 'react';
import { Link } from 'react-router-dom';
import { InfoIcon } from './Icons';

export const Footer: React.FC = () => {
    return (
        <footer className="bg-base-200 mt-8 py-6 border-t border-base-300">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
                <p>&copy; {new Date().getFullYear()} Silsilah Keluarga Interaktif. All rights reserved.</p>
                <div className="flex justify-center items-center space-x-4 mt-2">
                    <Link to="/about" className="flex items-center text-sm hover:text-accent transition-colors">
                        <InfoIcon className="w-4 h-4 mr-1"/>
                        Tentang Aplikasi
                    </Link>
                </div>
                 <p className="text-xs mt-2">Di bawah naungan TPPKP Qomaruddin</p>
            </div>
        </footer>
    );
};
