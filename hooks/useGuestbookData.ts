
import React, { useState, useEffect, useCallback } from 'react';
import { GuestbookEntry } from '../types';

const GUESTBOOK_STORAGE_KEY = 'guestbookData';

export const useGuestbookData = () => {
    const [entries, setEntries] = useState<GuestbookEntry[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        try {
            const savedEntries = localStorage.getItem(GUESTBOOK_STORAGE_KEY);
            if (savedEntries) {
                setEntries(JSON.parse(savedEntries));
            }
        } catch (error) {
            console.error("Failed to load guestbook data from local storage.", error);
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if(isLoaded) {
            try {
                localStorage.setItem(GUESTBOOK_STORAGE_KEY, JSON.stringify(entries));
            } catch (error) {
                console.error("Failed to save guestbook data to local storage.", error);
            }
        }
    }, [entries, isLoaded]);

    const addEntry = useCallback((name: string, message: string) => {
        const newEntry: GuestbookEntry = {
            id: `gb-${Date.now()}`,
            name,
            message,
            date: new Date().toISOString(),
        };
        setEntries(prevEntries => [newEntry, ...prevEntries]);
    }, []);
    
    return { entries, isLoaded, addEntry };
};


export const GuestbookContext = React.createContext<ReturnType<typeof useGuestbookData> | null>(null);

export const useGuestbook = () => {
    const context = React.useContext(GuestbookContext);
    if (!context) {
        throw new Error('useGuestbook must be used within a GuestbookContext.Provider');
    }
    return context;
};
