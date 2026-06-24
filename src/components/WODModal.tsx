import React, { useEffect, useRef, useState } from 'react';
import workouts from '../data/workouts.json';

interface WODModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTION_HEADS = /^(W\/U|W\/D|MAIN|SUPER MAIN|FINISHER)(\s*[–—].*)?$/i;

function todayIdx() {
  const anchor = new Date('2026-04-20T00:00-04:00');
  const today = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor((today.getTime() - anchor.getTime()) / msPerDay);
  return ((daysSince % workouts.length) + workouts.length) % workouts.length;
}

function formatPostedAt(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} · ${time}`;
}

function classifyLine(line: string): 'head' | 'note' | 'blank' | 'set' {
  const t = line.trim();
  if (t === '') return 'blank';
  if (SECTION_HEADS.test(t)) return 'head';
  if (t.startsWith('*')) return 'note';
  return 'set';
}

type Phase = 'idle' | 'typing' | 'visible';

export const WODModal: React.FC<WODModalProps> = ({ isOpen, onClose }) => {
  const [idx, setIdx] = useState(todayIdx);
  const [phase, setPhase] = useState<Phase>('idle');
  const [animKey, setAnimKey] = useState(0);
  // How many items have been revealed (0 = nothing yet)
  const [visibleCount, setVisibleCount] = useState(0);

  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTyping(newIdx: number) {
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (lineTimerRef.current)  clearInterval(lineTimerRef.current);
    setIdx(newIdx);
    setVisibleCount(0);
    setPhase('typing');
    phaseTimerRef.current = setTimeout(() => {
      setAnimKey(k => k + 1);
      setPhase('visible');
    }, 900);
  }

  // Start revealing lines once visible
  useEffect(() => {
    if (phase !== 'visible') return;
    setVisibleCount(0);
    const lines = workouts[idx].text.split('\n');
    // Items: 1 header + N lines + 1 timestamp = lines.length + 2
    const total = lines.length + 2;
    lineTimerRef.current = setInterval(() => {
      setVisibleCount(c => {
        if (c + 1 >= total) clearInterval(lineTimerRef.current!);
        return c + 1;
      });
    }, 100);
    return () => { if (lineTimerRef.current) clearInterval(lineTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  useEffect(() => {
    if (isOpen) {
      startTyping(todayIdx());
    } else {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (lineTimerRef.current)  clearInterval(lineTimerRef.current);
      setPhase('idle');
    }
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (lineTimerRef.current)  clearInterval(lineTimerRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  function pickDifferent() {
    let next: number;
    do { next = Math.floor(Math.random() * workouts.length); }
    while (next === idx && workouts.length > 1);
    startTyping(next);
  }

  const workout = workouts[idx];
  const lines = workout.text.split('\n');
  // total renderable items: header (0), text lines (1…N), timestamp (N+1)
  const totalItems = lines.length + 2;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[49] lg:hidden transition-opacity duration-500 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Desktop map overlay */}
      <div
        className={`fixed top-0 bottom-0 left-[460px] right-0 bg-black/50 backdrop-blur-sm z-[49] hidden lg:block transition-opacity duration-500 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className={`
          fixed z-50
          inset-0
          lg:inset-auto lg:bottom-0 lg:w-[400px]
          lg:left-[calc(50%+230px)] lg:-translate-x-1/2
          bg-white dark:bg-slate-800
          shadow-2xl rounded-t-2xl
          overflow-y-auto
          lg:max-h-[90vh]
          transition-transform duration-500 ease-out
          flex flex-col
          ${isOpen ? 'translate-y-0 pointer-events-auto' : 'translate-y-full pointer-events-none'}
        `}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 z-10 flex-shrink-0">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Gianni Bot · Workout of the Day</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors p-1 -mr-1"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-5 flex flex-col gap-0">

          {phase === 'typing' && (
            <div className="flex items-center gap-1.5 py-2">
              <span className="wod-tdot" />
              <span className="wod-tdot" />
              <span className="wod-tdot" />
            </div>
          )}

          {phase === 'visible' && (
            <>
              {/* Item 0: name + distance */}
              {visibleCount > 0 && (
                <div className="wod-line flex items-baseline justify-between gap-3 mb-4">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{workout.name}</h3>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap flex-shrink-0">
                    {workout.distance.toLocaleString()} m
                  </span>
                </div>
              )}

              {/* Items 1…N: workout lines */}
              <div className="text-sm leading-relaxed">
                {lines.map((line, i) => {
                  if (visibleCount <= i + 1) return null;
                  const kind = classifyLine(line);
                  if (kind === 'blank') return <div key={i} className="h-3" />;
                  if (kind === 'head') return (
                    <div key={i} className="wod-line text-[#13a4ec] text-xs font-semibold uppercase tracking-widest pt-1">
                      {line.trim()}
                    </div>
                  );
                  if (kind === 'note') return (
                    <div key={i} className="wod-line text-slate-400 dark:text-slate-500 text-xs italic">
                      {line.trim().slice(1)}
                    </div>
                  );
                  return (
                    <div key={i} className="wod-line text-slate-700 dark:text-slate-300">
                      {line}
                    </div>
                  );
                })}
              </div>

              {/* Typing dots — shown below last line while still populating */}
              {visibleCount < totalItems && (
                <div className="flex items-center gap-1.5 py-2">
                  <span className="wod-tdot" />
                  <span className="wod-tdot" />
                  <span className="wod-tdot" />
                </div>
              )}

              {/* Item N+1: timestamp + button */}
              {visibleCount >= totalItems && (
                <div className="wod-line mt-4 flex flex-col gap-3">
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    Originally from {formatPostedAt(workout.postedAt)}
                  </div>
                  <button
                    onClick={pickDifferent}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-[#13a4ec]/10 dark:bg-[#13a4ec]/20 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-[#13a4ec] hover:text-white transition-colors duration-200 ease-in-out"
                  >
                    Give me a different workout
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};
