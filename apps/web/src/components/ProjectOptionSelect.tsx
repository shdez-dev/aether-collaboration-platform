'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import styles from './ProjectOptionSelect.module.css';

interface Option { value: string; label: string }

interface Props {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  menuZIndex?: number;
}

export function ProjectOptionSelect({ label, value, options, onChange, disabled = false, menuZIndex }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const optionButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = Math.min(options.length * 37 + 10, 250);
      const below = window.innerHeight - rect.bottom;
      const top = below < menuHeight + 10 && rect.top > menuHeight + 10
        ? rect.top - menuHeight - 6
        : rect.bottom + 6;
      setPosition({ top: Math.max(10, Math.min(top, window.innerHeight - menuHeight - 10)), left: rect.left, width: rect.width });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, options.length]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    trigger.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
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
  }

  return (
    <div className={styles.root} onKeyDown={onKeyDown}>
      <button ref={trigger} type="button" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} className={`${styles.trigger} ${open ? styles.open : ''}`} onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const menuHeight = Math.min(options.length * 37 + 10, 250);
        const top = window.innerHeight - rect.bottom < menuHeight + 10 && rect.top > menuHeight + 10 ? rect.top - menuHeight - 6 : rect.bottom + 6;
        setPosition({ top: Math.max(10, Math.min(top, window.innerHeight - menuHeight - 10)), left: rect.left, width: rect.width });
        setOpen(previous => !previous);
      }}>
        <span>{options[selectedIndex]?.label ?? 'Seleccionar'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={menu} role="listbox" aria-label={label} className={styles.menu} style={{ top: position.top, left: position.left, width: position.width, zIndex: menuZIndex }}>
          {options.map((option, index) => <button key={option.value} ref={element => { optionButtons.current[index] = element; }} type="button" role="option" aria-selected={option.value === value} className={`${styles.option} ${option.value === value ? styles.selected : ''}`} onClick={() => choose(option.value)}>
            <span>{option.label}</span>
            {option.value === value && <Check size={14} aria-hidden="true" />}
          </button>)}
        </div>, document.body
      )}
    </div>
  );
}
