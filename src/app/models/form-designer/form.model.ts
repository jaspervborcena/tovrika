import { FormField } from '@app/models/form-designer/field.model';

export interface FormColumn {
  id: string;
  span: number; // Tailwind-style grid span (e.g., 6 or 12)
  fields: FormField[];
}

export interface FormRow {
  id: string;
  columns: FormColumn[];
}
