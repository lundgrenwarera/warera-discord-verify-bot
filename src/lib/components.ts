export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
} as const;

export const ButtonStyle = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
  Link: 5,
} as const;

export interface Button {
  type: typeof ComponentType.Button;
  style: number;
  label: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  emoji?: { name: string };
}

export interface StringSelectOption {
  label: string;
  value: string;
  description?: string;
  default?: boolean;
  emoji?: { name: string };
}

export interface ActionRow {
  type: typeof ComponentType.ActionRow;
  components: unknown[];
}

export function row(...components: unknown[]): ActionRow {
  return { type: ComponentType.ActionRow, components };
}

export function button(opts: {
  custom_id: string;
  label: string;
  style?: number;
  disabled?: boolean;
  emoji?: string;
}): Button {
  return {
    type: ComponentType.Button,
    style: opts.style ?? ButtonStyle.Secondary,
    label: opts.label,
    custom_id: opts.custom_id,
    disabled: opts.disabled,
    emoji: opts.emoji ? { name: opts.emoji } : undefined,
  };
}

export function roleSelect(opts: {
  custom_id: string;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
}) {
  return {
    type: ComponentType.RoleSelect,
    custom_id: opts.custom_id,
    placeholder: opts.placeholder,
    min_values: opts.min_values,
    max_values: opts.max_values,
  };
}

export function stringSelect(opts: {
  custom_id: string;
  placeholder?: string;
  options: StringSelectOption[];
  min_values?: number;
  max_values?: number;
}) {
  return {
    type: ComponentType.StringSelect,
    custom_id: opts.custom_id,
    placeholder: opts.placeholder,
    options: opts.options.slice(0, 25),
    min_values: opts.min_values,
    max_values: opts.max_values,
  };
}

export function textInput(opts: {
  custom_id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  min_length?: number;
  max_length?: number;
  style?: 1 | 2;
  value?: string;
}) {
  return {
    type: ComponentType.TextInput,
    custom_id: opts.custom_id,
    label: opts.label,
    placeholder: opts.placeholder,
    required: opts.required ?? true,
    min_length: opts.min_length,
    max_length: opts.max_length,
    style: opts.style ?? 1,
    value: opts.value,
  };
}

export function modal(opts: {
  custom_id: string;
  title: string;
  inputs: ReturnType<typeof textInput>[];
}) {
  return {
    custom_id: opts.custom_id,
    title: opts.title,
    components: opts.inputs.map((i) => row(i)),
  };
}
