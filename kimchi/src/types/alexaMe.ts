import { MarketplaceId } from "../utils/amazon";

export interface EchoAccountInfo {
  countryOfResidence: string;
  effectiveMarketPlaceId: MarketplaceId;
  email: string;
  eulaAcceptance: boolean;
  features: string[];
  fullName: string;
  hasActiveDopplers: boolean;
  id: string;
  marketPlaceDomainName: string;
  marketPlaceId: MarketplaceId;
  marketPlaceLocale: string;
}
