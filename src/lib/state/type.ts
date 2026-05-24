export type Driver = {
  profile_id: string;
  token: string;
  isLoggedIn?: boolean;
  activated?: boolean;
  hasOnboarded?: boolean;
  first_name?: string;
  last_name?: string;
  [key: string]: any; //TODO: specify more fields
};

export interface SimpleDriverProfileResponse {
  driver_id: string;
  photo_id: string;
  phone: string;
  email: string;
  first_name?: string | null;
  is_new?: boolean | null;
  verified?: boolean | null;
  sub_id?: string | null;
  is_on_free_trial?: boolean | null;
  free_trial_end_date?: string | null;
  is_logged_in?: boolean | null;
  has_onboarded?: boolean | null;
  rating?: number | string | null;
  activated?: boolean | null;
  amount_due?: number | string | null;
  total_earnings?: number | string | null;
  is_plan_active?: boolean | null;
  last_billed_at?: string | null;
  plan_end_date?: string | null;
  categories?: string[] | null;
  total_rides?: number | string | null;
  plan_id?: string | null;
}

export type DriverStateApiContext = {
  createAccount: (
    props: CreateAccountType,
  ) => Promise<Omit<Driver, "isLoggedIn">>;
  login: (props: {
    phone_number: string;
    password: string;
    authFactorToken?: string | undefined;
    device_id?: string | undefined;
  }) => Promise<void>;
  logout: () => void;
  deleteAccount: (account: Driver) => void;
  completeOnBoarding: (
    arg: Partial<Driver> & { hasOnboarded: boolean },
  ) => Promise<void>;
  updateProfile: (profile: Partial<Driver>) => void;
};

export type CreateAccountType = {
  contact_data: {
    email: string;
    phone_number: string;
  };
  first_name: string;
  last_name: string;
  gender: string;
  password: string;
  mobile_country_code: string;
};
