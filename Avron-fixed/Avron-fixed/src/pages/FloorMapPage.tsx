import { useState, useEffect, useCallback } from 'react';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { cn } from '../lib/utils';
import { FLOORS, type Department } from '../types';

const FLOOR_CONFIG: Record<string, {
  color: string; bg: string; border: string;
  icon: string; description: string;
}> = {
  'Basement':     { color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', icon: '🏗️', description: 'Diagnostics & Support Services' },
  'Ground Floor': { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800', icon: '🚪', description: 'Entry & Emergency Services' },
  '1st Floor':    { color: 'text-brand-blue-700 dark:text-brand-blue-400', bg: 'bg-brand-blue-50 dark:bg-brand-blue-900/10', border: 'border-brand-blue-200 dark:border-brand-blue-800', icon: '🏥', description: 'Outpatient Department' },
  '2nd Floor':    { color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-900/10', border: 'border-sky-200 dark:border-sky-800', icon: '🛏️', description: 'General Ward — 16 Beds' },
  '3rd Floor':    { color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/10', border: 'border-cyan-200 dark:border-cyan-800', icon: '🛏️', description: 'General Ward — 16 Beds' },
  '4th Floor':    { color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/10', border: 'border-teal-200 dark:border-teal-800', icon: '🚪', description: 'Rooms 401–407 & Suite 408' },
  '5th Floor':    { color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/10', border: 'border-violet-200 dark:border-violet-800', icon: '🏨', description: 'Rooms 501–507 & Suite 508' },
  '6th Floor':    { color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/10', border: 'border-rose-200 dark:border-rose-800', icon: '💊', description: 'ICU 1 & ICU 2 — Critical Care' },
  '7th Floor':    { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', icon: '🔬', description: 'Operation Theatres & Recovery' },
  '8th Floor':    { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800', icon: '🏢', description: 'Administration & Management' },
  'Terrace':      { color: 'text-lime-700 dark:text-lime-400', bg: 'bg-lime-50 dark:bg-lime-900/10', border: 'border-lime-200 dark:border-lime-800', icon: '⚙️', description: 'Utilities & Infrastructure' },
};

const ACCESS_BADGE: Record<string, 'success'|'warning'|'danger'|'neutral'> = {
  'Ground Floor': 'success', '1st Floor': 'success',
  '6th Floor': 'danger', '7th Floor': 'danger',
  '8th Floor': 'warning', 'Terrace': 'warning',
};

export function FloorMapPage() {
  const [depts, setDepts]         = useState<Department[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set(FLOORS.slice(0, 3)));

  const fetchDepts = useCallback(async () => {
    const { data } = await supabase.from('departments').select('*').order('floor').order('name');
    setDepts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const toggle = (floor: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });
  };

  const deptsByFloor = (floor: string) => depts.filter(d => d.floor === floor);

  if (loading) return (
    <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hospital Floor Map</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            AVRON HOSPITALS — {FLOORS.length} floors · {depts.length} departments
          </p>
        </div>
      </div>

      {/* Building visualizer */}
      <div className="card p-5">
        <div className="flex items-start gap-6">
          <div className="hidden sm:block flex-shrink-0">
            <img src="/assets/images/image copy copy.png" alt="Avron Hospitals" className="h-12 w-auto mb-3" />
            <div className="flex flex-col-reverse gap-1 items-center">
              {FLOORS.map(floor => {
                const cfg = FLOOR_CONFIG[floor] ?? FLOOR_CONFIG['Ground Floor'];
                const count = deptsByFloor(floor).length;
                return (
                  <button
                    key={floor}
                    onClick={() => toggle(floor)}
                    className={cn(
                      'w-24 h-7 rounded text-[10px] font-medium transition-all border',
                      cfg.bg, cfg.border, cfg.color,
                      expanded.has(floor) && 'ring-2 ring-brand-blue-400',
                    )}
                    title={floor}
                  >
                    {floor.replace(' Floor', '')} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 space-y-2">
            {[...FLOORS].reverse().map(floor => {
              const cfg = FLOOR_CONFIG[floor] ?? FLOOR_CONFIG['Ground Floor'];
              const floorDepts = deptsByFloor(floor);
              const isOpen = expanded.has(floor);
              const accessVariant = ACCESS_BADGE[floor] ?? 'neutral';

              return (
                <div
                  key={floor}
                  className={cn('rounded-xl border transition-all overflow-hidden', cfg.border)}
                >
                  <button
                    onClick={() => toggle(floor)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      cfg.bg,
                    )}
                  >
                    <span className="text-lg leading-none flex-shrink-0">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-sm font-semibold', cfg.color)}>{floor}</span>
                        <Badge variant={accessVariant} className="text-[10px]">
                          {accessVariant === 'danger' ? 'Restricted' :
                           accessVariant === 'warning' ? 'Limited Access' : 'Open'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cfg.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Building2 size={12} />
                        <span>{floorDepts.length}</span>
                      </div>
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {isOpen && floorDepts.length > 0 && (
                    <div className="bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700
                                    px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {floorDepts.map(d => (
                        <div
                          key={d.id}
                          className="flex items-center gap-2 p-2.5 rounded-lg
                                     bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100
                                     dark:hover:bg-slate-700 transition-colors"
                        >
                          <div className={cn(
                            'h-2 w-2 rounded-full flex-shrink-0',
                            d.is_active ? 'bg-emerald-400' : 'bg-slate-300',
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                              {d.name}
                            </p>
                            {d.description && (
                              <p className="text-[10px] text-slate-500 truncate">{d.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isOpen && floorDepts.length === 0 && (
                    <div className="bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700
                                    px-4 py-3 text-xs text-slate-400 text-center">
                      No departments mapped to this floor
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
