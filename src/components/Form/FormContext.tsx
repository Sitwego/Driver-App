import { createContext } from "react";
import { InputComponentBaseProps } from "./types";
type InputProps = Omit<InputComponentBaseProps, "InputComponent" | "inputID">;
export type RegisterInput = (
  inputID: string,
  shouldSubmitForm: boolean,
  inputProps: InputProps,
) => InputProps;
type FormContext = {
  registerInput: (
    inputID: string,
    shouldSubmitForm: boolean,
    inputProps: any,
  ) => InputProps;
};

export default createContext<FormContext>({
  registerInput: () => {
    throw new Error("Registered input should be wrapped with FormWrapper");
  },
});
