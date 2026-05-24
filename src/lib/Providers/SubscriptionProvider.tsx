import React, { createContext, ForwardedRef, useMemo, useRef } from "react";
import {
  SubProps,
  SubscriptionPlansModal,
} from "~/components/SubscriptionModal";

const Context = createContext<SubProps>({
  open: function (): void {},
  close: function (): void {},
});
export const SubscriptionProvider: React.FC<
  React.PropsWithChildren<unknown>
> = ({ children }) => {
  const ref: ForwardedRef<SubProps> = useRef(null);

  const getContext = useMemo(
    () => ({
      open: () => {
        ref.current?.open();
      },
      close: () => {
        ref.current?.close();
      },
    }),
    [],
  );

  return (
    <Context.Provider value={getContext}>
      <SubscriptionPlansModal ref={ref}>{children}</SubscriptionPlansModal>
    </Context.Provider>
  );
};
export const useSubscriptionModal = () => React.useContext(Context);
