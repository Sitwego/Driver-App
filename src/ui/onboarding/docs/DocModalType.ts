export interface IABottomSheetProvider {
  show: (props: IABottomSheetProps) => void;
  hide: () => void;
}

export type IABottomSheetProps = {
  itemHeight?: number;
  headerHeight?: number;
  hasCancel?: boolean;
  type?: InputViewType;
  children?: React.ReactElement | React.ReactNode | null;
  snaps?: (string | number)[];
  onClose?: (props?: InputViewType) => void;
  enableContentPanningGesture?: boolean;
  hasBackDrop: boolean;
  enablePanDownToClose: boolean;
  detached?: boolean;
};

export type DriverLicenseInputType = {
  driverLicense: string;
  dlExpiry: string;
};

export type DocSetStateType<T extends object> = React.Dispatch<
  React.SetStateAction<T>
>;

export type InputViewType =
  | "DriverLicense"
  | "CertificateOfGoodConduct"
  | "IndentityDocs"
  | "PsvBadge"
  | "InspectionSticker"
  | "Insurance"
  | "Kra";
