import { Handle, Position } from '@xyflow/react';
import { Individual } from '@/types';
import { User, CheckCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IndividualNodeProps {
  data: {
    individual: Individual;
    isSelected?: boolean;
    isHighlighted?: boolean;
    isInLineage?: boolean;
  };
}

export default function IndividualNode({ data }: IndividualNodeProps) {
  const { individual, isSelected, isHighlighted, isInLineage } = data;

  return (
    <div
      className={cn(
        'px-4 py-3 shadow-sm rounded-lg border transition-all duration-300 w-[240px]',
        individual.gender === 'M' 
          ? 'bg-blue-50/30 border-blue-200/50' 
          : 'bg-rose-50/30 border-rose-200/50',
        isInLineage && !isSelected && 'border-emerald-500/80 bg-emerald-50/20 shadow-md ring-2 ring-emerald-500/10',
        isSelected ? 'border-primary-olive border-2 shadow-xl bg-white ring-4 ring-primary-olive/20 z-20 scale-105' : '',
        isHighlighted && !isSelected && 'ring-8 ring-primary-olive/30 border-primary-olive shadow-2xl scale-110 z-10'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-accent-tan border-none" />
      
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0 shadow-sm",
            individual.gender === 'M' ? "bg-blue-500 border border-blue-600" : "bg-rose-400 border border-rose-500"
          )} />
          <p className="text-[13px] font-bold text-ink truncate leading-tight flex-1">
            {individual.name}
          </p>
          {individual.is_verified && (
            <div 
              className="w-3.5 h-3.5 bg-verified-green rounded-full flex items-center justify-center shrink-0 shadow-sm"
              title={`Verified by: ${individual.verified_by || 'Admin Pusat'}`}
            >
              <CheckCircle className="text-white w-2.5 h-2.5" />
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-0.5 mt-1">
          <div className="flex items-center gap-1.5">
            {individual.ref_code && (
              <span className="text-[9px] font-bold text-primary-olive uppercase bg-primary-olive/5 px-1.5 py-0.5 rounded border border-primary-olive/10">
                {individual.ref_code} {(individual.ref_code.startsWith('G') || !isNaN(Number(individual.ref_code))) ? '(generasi)' : ''}
              </span>
            )}
          </div>
          <p className="text-[10px] text-ink-light font-bold flex items-center gap-1">
            <span className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              (individual.is_alive === false || individual.death_date) ? "bg-zinc-400" : "bg-emerald-500"
            )} />
            {(individual.is_alive === false || individual.death_date) ? 'Sudah Wafat' : 'Masih Hidup'}
            <span className="opacity-30">•</span>
            <span className="truncate">{individual.current_location || individual.death_place || 'Sampurnan'}</span>
          </p>
        </div>

        {individual.is_verified && (
          <p className="text-[8px] text-verified-green font-black uppercase tracking-widest mt-1 opacity-80">
            v: {individual.verified_by || 'Admin Pusat'}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-accent-tan border-none" />
    </div>
  );
}
