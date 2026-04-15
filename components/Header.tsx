
import React, { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useFamily } from '../hooks/useFamilyData';
import { TreeIcon, UserIcon, DownloadIcon, UploadIcon, LoginIcon, LogoutIcon, RelationshipIcon, AdminIcon, GuestbookIcon } from './Icons';

interface HeaderProps {
    isAdmin: boolean;
    onLoginClick: () => void;
    onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isAdmin, onLoginClick, onLogout }) => {
    const { exportData, importData } = useFamily();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            importData(file);
        }
    };

    const navLinkClasses = "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200";
    const activeNavLink = "bg-primary text-white";
    const inactiveNavLink = "text-gray-300 hover:bg-base-300 hover:text-white";

    return (
        <header className="bg-base-200 shadow-lg sticky top-0 z-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-4">
                        <NavLink to="/" className="flex items-center space-x-2 text-xl font-bold text-white">
                             <TreeIcon className="w-8 h-8 text-accent"/>
                             <span>Silsilah</span>
                        </NavLink>
                        <nav className="hidden md:flex items-center space-x-2">
                             <NavLink to="/" className={({isActive}) => `${navLinkClasses} ${isActive ? activeNavLink : inactiveNavLink}`}>
                                <UserIcon className="w-5 h-5 mr-2"/>
                                Individu
                            </NavLink>
                            <NavLink to="/tree" className={({isActive}) => `${navLinkClasses} ${isActive ? activeNavLink : inactiveNavLink}`}>
                                <TreeIcon className="w-5 h-5 mr-2"/>
                                Pohon Keluarga
                            </NavLink>
                            <NavLink to="/relationship-finder" className={({isActive}) => `${navLinkClasses} ${isActive ? activeNavLink : inactiveNavLink}`}>
                                <RelationshipIcon className="w-5 h-5 mr-2"/>
                                Cari Hubungan
                            </NavLink>
                            <NavLink to="/guestbook" className={({isActive}) => `${navLinkClasses} ${isActive ? activeNavLink : inactiveNavLink}`}>
                                <GuestbookIcon className="w-5 h-5 mr-2"/>
                                Buku Tamu
                            </NavLink>
                             {isAdmin && (
                                <NavLink to="/admin" className={({isActive}) => `${navLinkClasses} ${isActive ? activeNavLink : inactiveNavLink}`}>
                                    <AdminIcon className="w-5 h-5 mr-2"/>
                                    Admin
                                </NavLink>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={exportData} className="p-2 rounded-full hover:bg-base-300 transition-colors" title="Export Data">
                           <DownloadIcon className="w-6 h-6 text-gray-400"/>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                        <button onClick={handleImportClick} className="p-2 rounded-full hover:bg-base-300 transition-colors" title="Import Data">
                           <UploadIcon className="w-6 h-6 text-gray-400"/>
                        </button>
                        
                        {isAdmin ? (
                            <button onClick={onLogout} className="p-2 rounded-full hover:bg-base-300 transition-colors" title="Logout">
                                <LogoutIcon className="w-6 h-6 text-error"/>
                            </button>
                        ) : (
                            <button onClick={onLoginClick} className="p-2 rounded-full hover:bg-base-300 transition-colors" title="Admin Login">
                                <LoginIcon className="w-6 h-6 text-gray-400"/>
                            </button>
                        )}
                    </div>
                </div>
                 {/* Mobile Navigation */}
                <div className="md:hidden flex justify-around py-2 border-t border-base-300">
                    <NavLink to="/" className={({isActive}) => `flex flex-col items-center ${isActive ? 'text-accent' : 'text-gray-400'}`}>
                        <UserIcon className="w-6 h-6"/>
                        <span className="text-xs">Individu</span>
                    </NavLink>
                    <NavLink to="/tree" className={({isActive}) => `flex flex-col items-center ${isActive ? 'text-accent' : 'text-gray-400'}`}>
                        <TreeIcon className="w-6 h-6"/>
                         <span className="text-xs">Pohon</span>
                    </NavLink>
                    <NavLink to="/relationship-finder" className={({isActive}) => `flex flex-col items-center ${isActive ? 'text-accent' : 'text-gray-400'}`}>
                        <RelationshipIcon className="w-6 h-6"/>
                         <span className="text-xs">Hubungan</span>
                    </NavLink>
                     <NavLink to="/guestbook" className={({isActive}) => `flex flex-col items-center ${isActive ? 'text-accent' : 'text-gray-400'}`}>
                        <GuestbookIcon className="w-6 h-6"/>
                         <span className="text-xs">Tamu</span>
                    </NavLink>
                     {isAdmin && (
                        <NavLink to="/admin" className={({isActive}) => `flex flex-col items-center ${isActive ? 'text-accent' : 'text-gray-400'}`}>
                            <AdminIcon className="w-6 h-6"/>
                            <span className="text-xs">Admin</span>
                        </NavLink>
                    )}
                </div>
            </div>
        </header>
    );
};
