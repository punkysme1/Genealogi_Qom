
import React from 'react';
import { TreeIcon } from './Icons';

export const AboutPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4 md:p-8 flex items-center justify-center" style={{minHeight: 'calc(100vh - 250px)'}}>
      <div className="bg-base-200 p-8 rounded-lg shadow-xl max-w-2xl text-center">
        <div className="flex justify-center mb-4">
            <TreeIcon className="w-16 h-16 text-accent"/>
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">Tentang Aplikasi Silsilah</h1>
        <p className="text-lg text-gray-300 mb-6">
          Aplikasi Silsilah Keluarga Interaktif ini dirancang untuk membantu Anda mengelola, memvisualisasikan, dan menjelajahi sejarah keluarga dengan cara yang modern dan intuitif.
        </p>
        <div className="bg-base-300/50 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold text-white">Di Bawah Naungan</h2>
            <p className="text-xl text-accent font-bold mt-2">
                TPPKP Qomaruddin
            </p>
            <p className="text-gray-400 mt-2">
                (Tim Pelaksana Program Kepedulian Pondok Pesantren Qomaruddin)
            </p>
            <p className="mt-4 text-gray-300">
                Proyek ini merupakan bagian dari upaya digitalisasi dan pelestarian data silsilah keluarga besar Pondok Pesantren Qomaruddin, Sampurnan, Bungah, Gresik.
            </p>
        </div>
      </div>
    </div>
  );
};
