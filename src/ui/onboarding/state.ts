import { createContext, useContext } from "react";

import { toSimpleDateString } from "~/utils/dates/simpleDateString";
export type DocTypes =
  | "idImageFront"
  | "idImageBack"
  | "driverLicense"
  | "certificateOfGoodConductFromDCI"
  | "psvBadge"
  | "insurance"
  | "kraPin";

/**
 * Two/three-wheelers (boda & tuk-tuk) have a different required-document set
 * than cars: they skip the PSV badge and inspection sticker but must provide
 * motorcycle/auto insurance.
 */
export function isTwoOrThreeWheeler(vehicleType: string): boolean {
  return vehicleType === "Bike" || vehicleType === "Auto";
}

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
    inspection: FileUploadResponseType;
    inspectionExpiry: string;
    // Motorcycle / auto insurance — required for boda & tuk-tuk only.
    insurance: FileUploadResponseType;
    insuranceExpiry: string;
    // KRA PIN certificate — optional for all vehicle types.
    kraPin: FileUploadResponseType;
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
    year: 2013,
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
    certificateOfGoodConductExpiry: toSimpleDateString(new Date()),
    psvBadge: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    inspection: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    inspectionExpiry: toSimpleDateString(new Date()),
    psvBadgeExpiry: toSimpleDateString(new Date()),
    insurance: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
    insuranceExpiry: toSimpleDateString(new Date()),
    kraPin: {
      id: "",
      nonce: [],
      encrypted_key: [],
    },
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
