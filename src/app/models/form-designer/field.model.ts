/**
 * Field-related interfaces
 */

export interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  inputType?: 'text' | 'number' | 'email' | 'tel' |'textarea';
  options?: { label: string; value: string }[];
  subheading?: string;
  showCancelButton?: boolean;
  alignment?: 'left' | 'right';
  orientation?: 'horizontal' | 'vertical';
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  locked?: boolean;
  defaultImage?:string;
  imageWidth?: number; // in px
  imageHeight?: number; // in px
  altText?: string;
  [key: string]: any;
}

export interface FieldTypeDefinition {
  type: string;
  label: string;
  icon: string;
  component: any;
  defaultConfig: any;
  settingsConfig: FieldSettingDefinition[];
  generateCode: (field: FormField) => string;
  getAllValues?: (field: FormField) => any;

}

export interface FieldSettingDefinition {
  type: 'text' | 'checkbox' | 'select' | 'options' | 'image' | 'number';
  key: string;
  label: string;
  options?: OptionItem[];
  min?: number;
  max?: number;
  step?: number;
}

export interface OptionItem {
  label: string;
  value: string;
}
