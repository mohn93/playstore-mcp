// Google Play Developer API resource types
// Reference: https://developers.google.com/android-publisher/api-ref

export interface AppDetails {
  defaultLanguage: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
}

export interface Listing {
  language: string;
  title: string;
  fullDescription: string;
  shortDescription: string;
  video?: string;
}

export interface Track {
  track: string;
  releases?: Release[];
}

export interface Release {
  name?: string;
  versionCodes?: string[];
  status: "completed" | "draft" | "halted" | "inProgress";
  userFraction?: number;
  releaseNotes?: LocalizedText[];
}

export interface LocalizedText {
  language: string;
  text: string;
}

export interface Review {
  reviewId: string;
  authorName: string;
  comments: Comment[];
}

export interface Comment {
  userComment?: UserComment;
  developerComment?: DeveloperComment;
}

export interface UserComment {
  text: string;
  lastModified: { seconds: string; nanos?: number };
  starRating: number;
  reviewerLanguage: string;
  device?: string;
  androidOsVersion?: number;
  appVersionCode?: number;
  appVersionName?: string;
  thumbsUpCount?: number;
  thumbsDownCount?: number;
}

export interface DeveloperComment {
  text: string;
  lastModified: { seconds: string; nanos?: number };
}

export interface InAppProduct {
  packageName: string;
  sku: string;
  status: string;
  purchaseType: "managedUser" | "subscription";
  defaultPrice: {
    priceMicros: string;
    currency: string;
  };
  listings?: Record<string, { title: string; description: string }>;
  defaultLanguage?: string;
}

export interface Subscription {
  productId: string;
  packageName: string;
  basePlans?: BasePlan[];
  listings?: SubscriptionListing[];
}

export interface BasePlan {
  basePlanId: string;
  state: "active" | "inactive" | "draft";
  autoRenewingBasePlanType?: {
    billingPeriodDuration: string;
  };
  prepaidBasePlanType?: {
    billingPeriodDuration: string;
  };
}

export interface SubscriptionListing {
  languageCode: string;
  title: string;
  description?: string;
  benefits?: string[];
}

export interface Testers {
  googleGroups?: string[];
}
