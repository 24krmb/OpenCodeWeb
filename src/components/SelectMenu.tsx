import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

export type SelectOption = {
  value: string
  label: string
  hint?: string
  group?: string
  disabled?: boolean
}

type SelectMenuProps = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder: string
  icon?: ReactNode
  searchable?: boolean
  align?: 'up' | 'down'
  className?: string
  disabled?: boolean
  ariaLabel?: string
  emptyLabel?: string
}

export function SelectMenu({
  value,
  options,
  onChange,
  placeholder,
  icon,
  searchable = false,
  align = 'down',
  className = '',
  disabled = false,
  ariaLabel,
  emptyLabel = '没有可选项',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = options.find((option) => option.value === value) ?? null

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options
    return options.filter((option) =>
      `${option.label} ${option.hint ?? ''} ${option.group ?? ''}`.toLowerCase().includes(term),
    )
  }, [options, query])

  const groups = useMemo(() => {
    const map = new Map<string, SelectOption[]>()
    for (const option of filtered) {
      const key = option.group ?? ''
      const bucket = map.get(key)
      if (bucket) bucket.push(option)
      else map.set(key, [option])
    }
    return [...map.entries()]
  }, [filtered])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const handlePointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    if (searchable) {
      const frame = window.requestAnimationFrame(() => searchRef.current?.focus())
      return () => {
        window.cancelAnimationFrame(frame)
        document.removeEventListener('pointerdown', handlePointer)
        document.removeEventListener('keydown', handleKey)
      }
    }
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, searchable])

  return (
    <div ref={wrapperRef} className={`select-menu ${className}`.trim()}>
      <button
        type="button"
        className={`select-trigger ${open ? 'is-open' : ''}`.trim()}
        onClick={() => !disabled && setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        disabled={disabled}
        title={selected?.hint ?? selected?.label ?? placeholder}
      >
        {icon && <span className="select-icon">{icon}</span>}
        <span className={`select-value ${selected ? '' : 'is-placeholder'}`.trim()}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className="select-chevron" />
      </button>

      {open && (
        <div className={`select-panel ${align === 'up' ? 'select-panel-up' : ''}`} role="listbox">
          {searchable && (
            <div className="select-search">
              <Search size={14} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索…"
                spellCheck={false}
              />
            </div>
          )}
          <div className="select-options">
            {groups.length === 0 && <div className="select-empty">{emptyLabel}</div>}
            {groups.map(([group, items]) => (
              <div className="select-group" key={group || 'default'}>
                {group && <span className="select-group-label">{group}</span>}
                {items.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={`select-option ${option.value === value ? 'is-selected' : ''}`.trim()}
                    onClick={() => {
                      if (option.disabled) return
                      onChange(option.value)
                      setOpen(false)
                    }}
                    disabled={option.disabled}
                    role="option"
                    aria-selected={option.value === value}
                  >
                    <span className="select-option-copy">
                      <span>{option.label}</span>
                      {option.hint && <small>{option.hint}</small>}
                    </span>
                    {option.value === value && <Check size={14} />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
