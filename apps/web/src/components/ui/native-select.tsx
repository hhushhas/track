import * as React from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import { cn } from "#/lib/utils"

type NativeSelectChangeEvent = {
  currentTarget: { value: string }
  target: { value: string }
}

type NativeSelectProps = React.AriaAttributes & {
  autoComplete?: string
  autoFocus?: boolean
  children: React.ReactNode
  className?: string
  disabled?: boolean
  form?: string
  id?: string
  name?: string
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
  onChange?: (event: NativeSelectChangeEvent) => void
  onFocus?: React.FocusEventHandler<HTMLButtonElement>
  required?: boolean
  size?: "sm" | "default"
  tabIndex?: number
  title?: string
  value: string
}

type NativeSelectOptionProps = {
  children: React.ReactNode
  disabled?: boolean
  value: string
}

type SelectOption = {
  disabled: boolean
  key: React.Key
  label: React.ReactNode
  labelText: string
  value: string
}

function NativeSelect({
  "aria-describedby": ariaDescribedBy,
  "aria-errormessage": ariaErrorMessage,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  autoComplete,
  autoFocus,
  children,
  className,
  disabled,
  form,
  id,
  name,
  onBlur,
  onChange,
  onFocus,
  required,
  size = "default",
  tabIndex,
  title,
  value,
}: NativeSelectProps) {
  const options = collectOptions(children)
  const selectedOption = options.find((option) => option.value === value) ?? null

  return (
    <div
      className={cn("group/native-select relative w-fit", className)}
      data-size={size}
      data-slot="native-select-wrapper"
    >
      <Select
        autoComplete={autoComplete}
        disabled={disabled}
        form={form}
        id={id}
        isItemEqualToValue={(option, selected) => option.value === selected.value}
        itemToStringLabel={(option) => option.labelText}
        itemToStringValue={(option) => option.value}
        name={name}
        onValueChange={(nextOption) => {
          if (nextOption === null) return
          const eventTarget = { value: nextOption.value }
          onChange?.({ currentTarget: eventTarget, target: eventTarget })
        }}
        required={required}
        value={selectedOption}
      >
        <SelectTrigger
          aria-describedby={ariaDescribedBy}
          aria-errormessage={ariaErrorMessage}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-required={required || undefined}
          autoFocus={autoFocus}
          className="w-full"
          data-slot="native-select"
          onBlur={onBlur}
          onFocus={onFocus}
          size={size}
          tabIndex={tabIndex}
          title={title}
        >
          <SelectValue>{selectedOption?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem disabled={option.disabled} key={option.key} value={option}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function collectOptions(children: React.ReactNode): Array<SelectOption> {
  const options: Array<SelectOption> = []

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === React.Fragment) {
      const fragment = child as React.ReactElement<{ children?: React.ReactNode }>
      options.push(...collectOptions(fragment.props.children))
      return
    }
    if (child.type !== NativeSelectOption) return

    const props = child.props as NativeSelectOptionProps
    options.push({
      disabled: Boolean(props.disabled),
      key: child.key ?? props.value,
      label: props.children,
      labelText: typeof props.children === "string" ? props.children : props.value,
      value: props.value,
    })
  })

  return options
}

function NativeSelectOption(_props: NativeSelectOptionProps) {
  return null
}

export { NativeSelect, NativeSelectOption }
