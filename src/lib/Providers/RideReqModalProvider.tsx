import React, { createContext, ForwardedRef, useMemo, useRef } from "react";

import RequestNotificationModal from "~/components/RequestNotificationModal";

export type InputProps = {
  open: (props: any) => void; // TODO
  close: () => void;
};
const Context = createContext<InputProps>({
  open: function (): void {},
  close: function (): void {},
});
export const Provider: React.FC<React.PropsWithChildren<unknown>> = ({
  children,
}) => {
  const ref: ForwardedRef<InputProps> = useRef(null);

  const getContext: InputProps = useMemo(
    () => ({
      open: (options) => {
        ref.current?.open(options);
      },
      close: () => {
        ref.current?.close();
      },
    }),
    [],
  );

  return (
    <Context.Provider value={getContext}>
      <RequestNotificationModal ref={ref}>{children}</RequestNotificationModal>
    </Context.Provider>
  );
};
export const useRideReqModal = () => React.useContext(Context);
