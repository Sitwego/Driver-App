import { createContext, useContext } from "react";

import { toSimpleDateString } from "~/utils/dates/simpleDateString";
export type DocTypes =
  | "idImageFront"
  | "idImageBack"
  | "driverLicense"
  | "certificateOfGoodConductFromDCI"
  | "psvBadge";

export type FileUploadResponseType = {
  id: string;
  nonce: number[];
  encrypted_key: number[];
};
export type ControlsContextType = {
  next: () => void;
  previous: () => void;
  finish: () => void;
  hasPrev: boolean;
  totalSteps: number;
  activeStep: "vehicle_details" | "docs" | "finish"; //| "services" | "driver_docs";
  activeStepIndex: number;
  vehicleDetails: {
    vehicle_type: string;
    make: string;
    model: string;
    year: number;
    vin?: string;
    capacity: number;
    license_plate: string;
    color: string;
  };
  docs: {
    profileImage: FileUploadResponseType;
    idType: string;
    idNo: string;
    idImageFront: FileUploadResponseType;
    idImageBack: FileUploadResponseType;
    driverLicense: FileUploadResponseType;
    dlExpiry: string;
    certificateOfGoodConductFromDCI: FileUploadResponseType;
    certificateOfGoodConductExpiry: string;
    psvBadge: FileUploadResponseType;
    psvBadgeExpiry: string;
    // kraFile: FileUploadResponseType;
    inspection?: FileUploadResponseType;
    inspectionExpiry?: string;
    psvInsurance?: FileUploadResponseType;
    psvInsuranceExpiry?: string;
  };
};
export type DocFormType = Pick<ControlsContextType, "docs">;
export type OnboardingActions =
  | {
      type: "next";
    }
  | {
      type: "previous";
    }
  | {
      type: "finish";
    }
  | {
      type: "setVehicleDetails";
      vehicleDetails: ControlsContextType["vehicleDetails"];
      apiResponse: any;
    }
  | {
      type: "setDocs";
      docs: ControlsContextType["docs"];
      apiResponse: any;
    };

export const initialState: ControlsContextType = {
  next: () => {},
  previous: () => {},
  finish: () => {},
  hasPrev: false,
  totalSteps: 3,
  activeStep: "vehicle_details",
  activeStepIndex: 0,
  vehicleDetails: {
    vehicle_type: "",
    make: "",
    model: "",
    year: 2014,
    capacity: 0,
    license_plate: "",
    color: "",
  },
  docs: {
    profileImage: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    idType: "",
    idNo: "",
    idImageFront: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    idImageBack: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    driverLicense: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    dlExpiry: toSimpleDateString(new Date()),
    certificateOfGoodConductFromDCI: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    // kraFile: {
    //   id: "",
    //   nonce: [],
    // },
    certificateOfGoodConductExpiry: toSimpleDateString(new Date()),
    psvBadge: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    psvBadgeExpiry: toSimpleDateString(new Date()),
  },
};

export const OnboardingControlsContext = createContext<{
  state: ControlsContextType;
  dispatch: React.Dispatch<OnboardingActions>;
}>({
  state: { ...initialState },
  dispatch: () => {},
});

export const reducer = (
  state: ControlsContextType,
  act: OnboardingActions,
): ControlsContextType => {
  let next = { ...state };

  switch (act.type) {
    case "next": {
      if (state.activeStep === "vehicle_details") {
        next.activeStep = "docs";
        next.activeStepIndex = 1;
      } else if (state.activeStep === "docs") {
        next.activeStep = "finish";
        next.activeStepIndex = 3;
      }
      break;
    }
    case "previous": {
      if (state.activeStep === "docs") {
        next.activeStep = "vehicle_details";
        next.activeStepIndex = 1;
      } else if (state.activeStep === "finish") {
        next.activeStep = "docs";
        next.activeStepIndex = 2;
      }
      break;
    }
    case "finish": {
      next = initialState;
      break;
    }
    case "setDocs": {
      next.docs = act.docs;
      break;
    }
    case "setVehicleDetails": {
      next.vehicleDetails = act.vehicleDetails;
      break;
    }
  }

  return {
    ...next,
    hasPrev: next.activeStep !== "vehicle_details",
  };
};
export function useOnboardingControls() {
  const context = useContext(OnboardingControlsContext);
  if (!context) {
    throw new Error(
      "useOnboardingControls must be used within an OnboardingControlsProvider",
    );
  }
  return context;
}
export const OnboardingControlsProvider = OnboardingControlsContext.Provider;
