'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './ProjectOptionSelect.module.css';

interface Option { value: string; label: string; icon?: ReactNode }

interface Props {
  id?: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  menuZIndex?: number;
  placeholder?: string;
  closeOnTab?: boolean;
}

export function ProjectOptionSelect({ id, label, value, options, onChange, disabled = false, menuZIndex, placeholder = 'Seleccionar', closeOnTab = false }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const optionButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex(option => option.value === value);
  const menuId = id ? `${id}-options` : undefined;

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
    } else if (event.key === 'Tab' && open && closeOnTab) {
      setOpen(false);
      if ((event.target as HTMLElement).closest('[role="option"]')) {
        event.preventDefault();
        const form = trigger.current?.closest('form');
        const focusables = [...(form?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])') ?? [])];
        const triggerIndex = trigger.current ? focusables.indexOf(trigger.current) : -1;
        const nextIndex = triggerIndex + (event.shiftKey ? -1 : 1);
        const next = focusables[nextIndex] ?? (event.shiftKey ? focusables.at(-1) : focusables[0]) ?? trigger.current;
        requestAnimationFrame(() => next?.focus());
      }
    } else if (open && options.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const current = optionButtons.current.findIndex(button => button === document.activeElement);
      const next = current < 0 ? Math.max(selectedIndex, 0) : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      optionButtons.current[next]?.focus();
    }
  }

  return (
    <div className={styles.root} onKeyDown={onKeyDown}>
      <button id={id} ref={trigger} type="button" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId} className={`${styles.trigger} ${open ? styles.open : ''}`} onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const menuHeight = Math.min(options.length * 37 + 10, 250);
        const top = window.innerHeight - rect.bottom < menuHeight + 10 && rect.top > menuHeight + 10 ? rect.top - menuHeight - 6 : rect.bottom + 6;
        setPosition({ top: Math.max(10, Math.min(top, window.innerHeight - menuHeight - 10)), left: rect.left, width: rect.width });
        setOpen(previous => !previous);
      }}>
        <span className={styles.triggerValue}>
          {options[selectedIndex]?.icon && <span className={styles.optionIcon}>{options[selectedIndex].icon}</span>}
          <span className={`${styles.optionLabel} ${selectedIndex < 0 ? styles.placeholder : ''}`}>{options[selectedIndex]?.label ?? placeholder}</span>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div id={menuId} ref={menu} role="listbox" aria-label={label} className={styles.menu} style={{ top: position.top, left: position.left, width: position.width, zIndex: menuZIndex }}>
          {options.map((option, index) => <button key={option.value} ref={element => { optionButtons.current[index] = element; }} type="button" role="option" aria-selected={option.value === value} className={`${styles.option} ${option.value === value ? styles.selected : ''}`} onClick={() => choose(option.value)}>
            <span className={styles.optionContent}>
              {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
              <span className={styles.optionLabel}>{option.label}</span>
            </span>
            {option.value === value && <Check size={14} aria-hidden="true" />}
          </button>)}
        </div>, document.body
      )}
    </div>
  );
}
