'use client';

import { Check, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import styles from './MultiSelectDropdown.module.css';

export type MultiSelectDropdownOption = { value: string; label: string };

export function MultiSelectDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecciona espacios',
  disabled = false,
}: {
  label: string;
  value: string[];
  options: MultiSelectDropdownOption[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const selected = new Set(value);
  const selectedLabels = options.filter((option) => selected.has(option.value)).map((option) => option.label);
  const summary = selectedLabels.length === 1
    ? selectedLabels[0]
    : selectedLabels.length > 1
      ? `${selectedLabels.length} espacios seleccionados`
      : placeholder;

  function toggle(optionValue: string, checked: boolean) {
    onChange(checked
      ? [...value, optionValue]
      : value.filter((item) => item !== optionValue));
  }

  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>
      <button type="button" aria-label={`${label}: ${summary}`} className={styles.trigger} disabled={disabled || options.length === 0}>
        <span className={styles.value}>{summary}</span>
        {value.length > 0 && <span className={styles.count}>{value.length}</span>}
        <ChevronDown size={15} aria-hidden="true" className={styles.chevron} />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={styles.menu} sideOffset={6} align="start" collisionPadding={12}>
        <DropdownMenu.Label className={styles.menuLabel}>{label}</DropdownMenu.Label>
        <div className={styles.menuHint}>Elige uno o varios espacios</div>
        <DropdownMenu.Separator className={styles.separator} />
        {options.map((option) => <DropdownMenu.CheckboxItem
          key={option.value}
          checked={selected.has(option.value)}
          onCheckedChange={(checked) => toggle(option.value, checked === true)}
          onSelect={(event) => event.preventDefault()}
          className={styles.option}
        >
          <span className={styles.check}>{selected.has(option.value) && <Check size={13} aria-hidden="true" />}</span>
          <span className={styles.optionLabel}>{option.label}</span>
        </DropdownMenu.CheckboxItem>)}
        {options.length === 0 && <div className={styles.empty}>No hay espacios disponibles.</div>}
        <DropdownMenu.Separator className={styles.separator} />
        <div className={styles.menuFooter}>{value.length} seleccionados</div>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
