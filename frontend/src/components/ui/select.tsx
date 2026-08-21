import * as React from 'react'
import ReactSelect, {
  components as RSComponents,
  type DropdownIndicatorProps,
  type OptionProps,
  type SingleValueProps,
  type ValueContainerProps,
} from 'react-select'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Drop-in replacement for the old Radix-based shadcn Select, powered by
 * react-select. Keeps the exact same declarative API (Select/SelectTrigger/
 * SelectContent/SelectItem/SelectValue/...) so every existing call site in
 * the app keeps working unchanged. SelectTrigger/SelectContent/SelectItem/etc
 * are never actually mounted — `Select` walks its `children` tree to pull
 * out the option list + trigger config, then renders a single styled
 * `react-select` instance.
 */

type SelectOptionData = {
  value: string
  label: React.ReactNode
  searchText: string
  disabled?: boolean
}

function isElementOfType<P>(
  node: React.ReactNode,
  type: React.ComponentType<P>
): node is React.ReactElement<P> {
  return React.isValidElement(node) && node.type === type
}

function findElement<P>(
  children: React.ReactNode,
  type: React.ComponentType<P>
): React.ReactElement<P> | undefined {
  let found: React.ReactElement<P> | undefined
  React.Children.forEach(children, (child) => {
    if (found || !React.isValidElement(child)) return
    if (isElementOfType(child, type)) {
      found = child
      return
    }
    const childProps = (child as React.ReactElement).props as {
      children?: React.ReactNode
    }
    if (childProps?.children) {
      found = findElement(childProps.children, type)
    }
  })
  return found
}

// Strips accents so typing "credito" matches an option labeled "Crédito" —
// Spanish text (client names, "Crédito", "Depreciación", etc.) is everywhere
// in this app and users don't reliably type diacritics.
function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function nodeToText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join(' ')
  if (React.isValidElement(node)) {
    const p = node.props as { children?: React.ReactNode }
    return nodeToText(p?.children)
  }
  return ''
}

function collectOptions(node: React.ReactNode): SelectOptionData[] {
  const out: SelectOptionData[] = []
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return
    if (isElementOfType(child, SelectItem)) {
      const p = child.props as {
        value: string
        children?: React.ReactNode
        disabled?: boolean
      }
      out.push({
        value: p.value,
        label: p.children,
        searchText: normalizeSearch(nodeToText(p.children)),
        disabled: p.disabled,
      })
      return
    }
    if (isElementOfType(child, SelectSeparator)) return
    const p = (child as React.ReactElement).props as {
      children?: React.ReactNode
    }
    if (p?.children) out.push(...collectOptions(p.children))
  })
  return out
}

function Option(props: OptionProps<SelectOptionData, false>) {
  return (
    <RSComponents.Option {...props}>
      <span className='absolute inset-e-2 flex size-3.5 items-center justify-center'>
        {props.isSelected && <CheckIcon className='size-4' />}
      </span>
      {props.data.label}
    </RSComponents.Option>
  )
}

function SingleValue(props: SingleValueProps<SelectOptionData, false>) {
  const override = (props.selectProps as { valueOverride?: React.ReactNode })
    .valueOverride
  return (
    <RSComponents.SingleValue {...props}>
      {override ?? props.data.label}
    </RSComponents.SingleValue>
  )
}

function DropdownIndicator(props: DropdownIndicatorProps<SelectOptionData, false>) {
  return (
    <RSComponents.DropdownIndicator {...props}>
      <ChevronDownIcon className='size-4 opacity-50' />
    </RSComponents.DropdownIndicator>
  )
}

// react-select's own renderValue() has a hard `if (inputValue) return null`
// (no prop to override it) — the instant you type, SingleValue unmounts and
// only the tiny search input remains. On a content-sized control that made
// the whole box visibly collapse on every keystroke. First fix sized the box
// to the widest of *every* option to guarantee it never moved — but that
// blows up for selects with long option text (grows past its row, overlaps
// neighboring fields). Narrower fix: stack an invisible copy of only the
// *currently selected* label (or the placeholder) behind the real content,
// in the same CSS grid cell. That's the same width the closed control would
// have anyway, so typing/searching never changes it — capped by max-w-80 +
// truncate below so one long selected label still can't blow out the row.
function ValueContainer(props: ValueContainerProps<SelectOptionData, false>) {
  const { placeholder } = props.selectProps as { placeholder?: React.ReactNode }
  const selected = props.getValue()[0]
  const ghost = selected ? selected.label : placeholder
  return (
    <RSComponents.ValueContainer
      {...props}
      className={cn(props.className, 'relative grid')}
    >
      {ghost && (
        <span
          aria-hidden='true'
          className='invisible col-start-1 row-start-1 truncate'
        >
          {ghost}
        </span>
      )}
      <div className='col-start-1 row-start-1 flex min-w-0 items-center gap-2 overflow-hidden'>
        {props.children}
      </div>
    </RSComponents.ValueContainer>
  )
}

// react-select keeps a "functional" font-size: inherit rule on control/input/
// option/etc even in unstyled mode (it needs a resolved font-size to measure
// the autosize input). That rule is emitted via emotion after Tailwind's own
// stylesheet, so it wins any same-specificity utility class in the cascade —
// text-sm silently loses, everything renders at the inherited 16px instead of
// 14px, and the autosize input measures text at the wrong size (visible as
// the input jumping/shrinking while typing). Force it with !important.
const selectClassNames = (size: 'sm' | 'default', triggerClassName?: string) => ({
  control: (state: { isFocused: boolean; isDisabled: boolean }) =>
    cn(
      'flex !min-h-0 w-fit min-w-40 max-w-80 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 !text-sm shadow-xs transition-[color,box-shadow] dark:bg-input/30',
      size === 'sm' ? 'h-8' : 'h-9',
      state.isFocused && 'border-ring ring-[3px] ring-ring/50',
      state.isDisabled && 'cursor-not-allowed opacity-50',
      !state.isDisabled && !state.isFocused && 'dark:hover:bg-input/50',
      triggerClassName
    ),
  valueContainer: () => 'flex flex-1 min-w-0 items-center gap-2 overflow-hidden p-0',
  input: () => 'm-0 p-0 !text-sm text-foreground',
  // truncate (overflow-hidden + text-ellipsis + nowrap), never line-clamp-*:
  // line-clamp forces display:-webkit-box, which conflicts with the `flex`
  // needed here for icon+text labels (company selector, sort icons, etc)
  // and was silently corrupting/clipping the rendered text.
  placeholder: () => 'truncate !text-sm text-muted-foreground',
  singleValue: () =>
    'flex min-w-0 items-center gap-2 truncate !text-sm text-foreground',
  indicatorsContainer: () => 'flex items-center gap-1',
  dropdownIndicator: () => 'p-0 text-muted-foreground',
  clearIndicator: () => 'cursor-pointer p-0 text-muted-foreground',
  indicatorSeparator: () => 'hidden',
  menuPortal: () => 'z-100',
  // react-select sizes the menu to exactly match the control's width (via
  // its own width:100% rule). Options reserve extra right padding for the
  // check icon, so anything longer than the control wraps. min-w-max lets
  // the menu grow to fit its widest option instead (CSS min-width always
  // wins over a smaller width, no !important fight needed here).
  menu: () =>
    'z-100 mt-1 min-w-max overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
  menuList: () => 'max-h-72 overflow-y-auto p-1',
  option: (state: { isFocused: boolean; isDisabled: boolean; isSelected: boolean }) =>
    cn(
      'relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 ps-2 pe-8 !text-sm whitespace-nowrap select-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
      state.isFocused && 'bg-accent text-accent-foreground',
      state.isDisabled && 'pointer-events-none opacity-50'
    ),
  noOptionsMessage: () => 'px-2 py-4 text-center !text-sm text-muted-foreground',
  loadingMessage: () => 'px-2 py-4 text-center !text-sm text-muted-foreground',
})

type SelectProps = {
  value?: string
  defaultValue?: string
  // Method shorthand keeps this bivariant like Radix's own typing, so
  // callers can pass narrower handlers such as (v: 'asc' | 'desc') => void.
  onValueChange?(value: string): void
  disabled?: boolean
  name?: string
  children?: React.ReactNode
}

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  children,
}: SelectProps) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = isControlled ? value : internalValue

  const options = React.useMemo(() => {
    const content = findElement(children, SelectContent)
    return content ? collectOptions(content.props.children) : []
  }, [children])

  const triggerEl = findElement(children, SelectTrigger)
  const triggerProps = (triggerEl?.props ?? {}) as {
    className?: string
    disabled?: boolean
    size?: 'sm' | 'default'
    children?: React.ReactNode
  }
  const valueEl = triggerProps.children
    ? findElement(triggerProps.children, SelectValue)
    : undefined
  const valueProps = (valueEl?.props ?? {}) as {
    placeholder?: React.ReactNode
    children?: React.ReactNode
  }

  const size = triggerProps.size ?? 'default'
  const selectedOption = options.find((o) => o.value === currentValue) ?? null

  const handleChange = (opt: SelectOptionData | null) => {
    const next = opt?.value ?? ''
    if (!isControlled) setInternalValue(next)
    onValueChange?.(next)
  }

  return (
    <ReactSelect<SelectOptionData, false>
      inputId={name}
      name={name}
      unstyled
      isDisabled={disabled ?? triggerProps.disabled}
      isClearable={false}
      isSearchable
      options={options}
      isOptionDisabled={(o) => !!o.disabled}
      getOptionValue={(o) => o.value}
      getOptionLabel={(o) => o.searchText || String(o.value)}
      filterOption={(candidate, input) =>
        !input || candidate.data.searchText.includes(normalizeSearch(input))
      }
      value={selectedOption}
      onChange={(opt) => handleChange(opt)}
      placeholder={valueProps.placeholder ?? ''}
      // @ts-expect-error -- custom prop forwarded via selectProps to SingleValue
      valueOverride={valueProps.children}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition='fixed'
      components={{ Option, SingleValue, DropdownIndicator, ValueContainer }}
      classNames={selectClassNames(size, triggerProps.className)}
    />
  )
}

function SelectGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

type MarkerProps<T = unknown> = T & {
  className?: string
  id?: string
  children?: React.ReactNode
  [key: string]: unknown
}

function SelectValue(_props: MarkerProps<{ placeholder?: React.ReactNode }>) {
  return null
}

function SelectTrigger(
  _props: MarkerProps<{ size?: 'sm' | 'default'; disabled?: boolean }>
) {
  return null
}

function SelectContent(
  _props: MarkerProps<{ align?: 'start' | 'end' | 'center'; side?: 'top' | 'bottom' }>
) {
  return null
}

function SelectLabel({ children }: MarkerProps) {
  return <>{children}</>
}

function SelectItem(_props: MarkerProps<{ value: string; disabled?: boolean }>) {
  return null
}

function SelectSeparator() {
  return null
}

function SelectScrollUpButton() {
  return null
}

function SelectScrollDownButton() {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
