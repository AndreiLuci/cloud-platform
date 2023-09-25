import { PrismaClient } from "@prisma/client";
import AccountCollection from "../structures/account/collection";
import { MarketplaceId } from "../utils/amazon";
import { Express } from "express-serve-static-core";

export interface Product {
  instock: boolean;
  input: string;
  site: string;
  ts: number;
  extraData: ExtraData;
}

export interface ExtraData {
  productString: string;
  condition: boolean;
  price: number;
  seller: string;
  offer: string;
  shipping: number;
  imageURL: string;
  marketplaceId: MarketplaceId;
}

export interface OrderInfo {
  product: Product;
  purchaseId: string; // response.entity.purchaseId
  offerId: string; // response.entity.lineItems.entity.lineItems[0].offerListingId
  price: number; // response.entity.lineItems.entity.lineItems[0].price.priceToPay.amount
  seller: string; // response.entity.lineItems.entity.lineItems[0].itemSeller.entity.displayStringForSeller.fragments[1].text
  total: number; // response.entity.purchaseTotals.entity.purchaseTotal.amount.amount
  deliveryEstimate: string; // response.entity.deliveryGroups.entity.deliveryGroups[0].lineItemGroups[0].scheduledDeliveryPromise.promiseString

  createdAt: number;
}
export interface AccountInfo {
  email: string;
  marketplaceId: MarketplaceId;
}
export interface AccountWithAsins extends AccountInfo {
  asins: string[];
}

export interface FullAccount extends AccountInfo {
  websiteCookieString: string;
  asins: string[];
  access_token?: string;
}

export interface RouterArgs {
  prisma: PrismaClient;
  accountCollection: AccountCollection;
  app: Express;
}

export enum AccountType {
  Default = "Default",
  Extra = "Extra",
}
