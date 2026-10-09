'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Layers3, UsersRound } from 'lucide-react';
import styles from './DateTimePickers.module.css';

interface Option { value: string; label: string }

interface Props {
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  kind: 'workspace' | 'team';
}

export function CalendarSelect({ label, placeholder, value, options, onChange, kind }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={root} className={styles.picker} onKeyDown={event => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      } else if (open && options.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const current = optionButtons.current.findIndex(button => button === document.activeElement);
        const next = current < 0 ? Math.max(selectedIndex, 0) : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        optionButtons.current[next]?.focus();
      }
    }}>
      <button ref={trigger} type="button" className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`} aria-label={label} aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(previous => !previous)}>
        {kind === 'workspace' ? <Layers3 size={16} aria-hidden="true" /> : <UsersRound size={16} aria-hidden="true" />}
        <span className={!value ? styles.placeholder : undefined}>{options[selectedIndex]?.label ?? placeholder}</span>
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.selectMenu} role="listbox" aria-label={label}>
          {options.length ? options.map((option, index) => (
            <button key={option.value} ref={element => { optionButtons.current[index] = element; }} type="button" role="option" aria-selected={option.value === value} className={`${styles.selectOption} ${option.value === value ? styles.selectedOption : ''}`} onClick={() => choose(option.value)}>
              <span>{option.label}</span>
              {option.value === value && <Check size={15} aria-hidden="true" />}
            </button>
          )) : <div className={styles.selectEmpty}>No hay {kind === 'workspace' ? 'espacios' : 'equipos'} disponibles.</div>}
        </div>
      )}
    </div>
  );
}
