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
  };
}

export default function IndividualNode({ data }: IndividualNodeProps) {
  const { individual, isSelected, isHighlighted } = data;

  return (
    <div
      className={cn(
        'px-4 py-3 shadow-sm rounded-lg border transition-all duration-300 w-[200px]',
        individual.gender === 'M' 
          ? 'bg-blue-50/30 border-blue-200/50' 
          : 'bg-rose-50/30 border-rose-200/50',
        isSelected ? 'border-primary-olive border-2 shadow-md bg-white' : '',
        isHighlighted && 'ring-4 ring-accent-tan/50 border-primary-olive shadow-xl scale-105'
      )}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-accent-tan border-none" />
      
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2 truncate">
            <div className={cn(
              "w-2 h-2 rounded-full shrink-0",
              individual.gender === 'M' ? "bg-blue-500" : "bg-rose-500"
            )} />
            <p className="text-[13px] font-bold text-ink truncate leading-tight">
              {individual.name}
            </p>
          </div>
          {individual.is_verified && (
            <div 
              className="w-3.5 h-3.5 bg-verified-green rounded-full flex items-center justify-center shrink-0 cursor-help"
              title={`Verified by: ${individual.verified_by || 'System'}`}
            >
              <div className="w-1.5 h-1 border-l-1.5 border-b-1.5 border-white -rotate-45 mt-[-1px]" />
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
          {individual.ref_code && (
            <span className="text-[8px] font-mono font-bold bg-accent-tan/20 text-primary-olive px-1 rounded border border-accent-tan/30 uppercase">
              {individual.ref_code}
            </span>
          )}
          <p className="text-[10px] text-ink-light font-medium">
            {individual.birth_date ? new Date(individual.birth_date).getFullYear() : '????'} 
            {' - '} 
            {individual.death_date ? new Date(individual.death_date).getFullYear() : 'Sekarang'}
          </p>
        </div>

        {individual.is_verified && individual.verified_by && (
          <p className="text-[7px] text-verified-green font-bold uppercase tracking-tighter mt-0.5 italic">
            v: {individual.verified_by}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-accent-tan border-none" />
    </div>
  );
}
