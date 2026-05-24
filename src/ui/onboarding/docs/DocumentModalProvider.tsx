/* eslint-disable react/display-name */
import React, { ForwardedRef, useContext, useMemo, useRef } from "react";
import DocumentModal from "./DocumentModal";
import { IABottomSheetProvider } from "./DocModalType";

const Context = React.createContext<IABottomSheetProvider>({
  show: function (): void {},
  hide: function (): void {},
});
const { Provider } = Context;
export const useDocuments = () => useContext(Context);
export default React.memo(
  ({ children }: { children: React.ReactElement | React.ReactElement[] }) => {
    const ref: ForwardedRef<IABottomSheetProvider> = useRef(null);

    const getContext: IABottomSheetProvider = useMemo(
      () => ({
        show: (options) => {
          ref.current?.show(options);
        },
        hide: () => {
          ref.current?.hide();
        },
      }),
      [],
    );

    return (
      <Provider value={getContext}>
        <DocumentModal ref={ref}>{children}</DocumentModal>
      </Provider>
    );
  },
);
