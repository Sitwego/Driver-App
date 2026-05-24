import { FormValue } from "~/components/Form/types";

export type BaseForm = {
  /** Controls the loading state of the form */
  isLoading?: boolean;
};

export type FormValues<T extends string> = Record<T, FormValue>;
export type Form<
  T extends string = string,
  TFormValues extends FormValues<T> = FormValues<T>,
> = TFormValues & BaseForm;

export default Form;
