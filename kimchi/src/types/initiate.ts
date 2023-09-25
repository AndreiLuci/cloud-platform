export default interface InitiateResponse {
  resource: Resource;
  type: string;
  entity: CheckoutEntity;
}

export interface CheckoutEntity {
  purchaseId: string;
  purchaseState: string[];
  purchaseRestrictions?: { reason: string }[];
  paymentMethods: PaymentMethods;
  destinations: Destinations;
  deliveryGroups: DeliveryGroups;
  lineItems: LineItems;
  purchaseTotals: PurchaseTotals;
  policyMessages: PolicyMessages;
  payingCustomer: PayingCustomer;
  purchaseLevelMessages: LegalEntityTaxRegistration;
  subscribeAndSave: LegalEntityTaxRegistration;
  paymentsRelatedMessages: LegalEntityTaxRegistration;
  legalEntityTaxRegistration: LegalEntityTaxRegistration;
}

export interface DeliveryGroups {
  resource: Resource;
  type: string;
  entity: DeliveryGroupsEntity;
}

export interface DeliveryGroupsEntity {
  deliveryGroups: DeliveryGroup[];
}

export interface DeliveryGroup {
  id: string;
  splitPreferences: SplitPreference[];
  deliveryOptions: DeliveryOption[];
  lineItems: LineItem[];
  lineItemGroups: LineItemGroup[];
  fulfiller: Fulfiller;
  destination: Destination;
}

export interface DeliveryOption {
  id: string;
  deliveryPromise: DeliveryPromise;
  deliveryDuration: Issuer;
  displayString: string;
  displayName: string;
  displayPrice: string;
  selected: boolean;
}

export interface Issuer {
  displayString: string;
}

export interface DeliveryPromise {
  displayString: string;
  startDate: Date;
  endDate: Date;
  type: string;
}

export interface Destination {
  id: string;
  displayString: string;
  city: string;
  name: string;
  address: BillingAddress;
  prop65Destination: boolean;
}

export interface BillingAddress {
  resource: Resource;
}

export interface Resource {
  url: string;
  types: any[];
}

export interface Fulfiller {
  displayString: string;
  amazonFulfilled: boolean;
}

export interface LineItemGroup {
  groupIndex: number;
  lineItems: LineItem[];
  scheduledDeliveryPromise: ScheduledDeliveryPromise;
}

export interface LineItem {
  resource: Resource;
  type: string;
  entity: EntityElement;
}

export interface EntityElement {
  id: string;
  asin: string;
  offerListingId: string;
  quantity: number;
  merchant: Merchant;
  condition: string;
  seller: Seller;
  product: BillingAddress;
  markedAsGift: boolean;
  price: Price;
  giftable: boolean;
  itemSeller: ItemSeller;
}

export interface ItemSeller {
  resource: Resource;
  type: string;
  entity: ItemSellerEntity;
}

export interface ItemSellerEntity {
  displayStringForSeller: DisplayStringForSeller;
}

export interface DisplayStringForSeller {
  fragments: DisplayInfo[];
}

export interface DisplayInfo {
  text: string;
}

export interface Merchant {
  encryptedMerchantId: string;
  sku: string;
}

export interface Price {
  priceToPay: Amount;
}

export interface Amount {
  displayString: string;
  amount: string;
  currencyCode: CurrencyCode;
}

export enum CurrencyCode {
  Usd = "USD",
}

export interface Seller {
  displayStringForSeller: DisplayStringForSeller;
  displayString: string;
}

export interface ScheduledDeliveryPromise {
  displayString: string;
  prefixString: string;
  promiseString: string;
  promiseType: string;
  guaranteeCutoff: Date;
}

export interface SplitPreference {
  splitPreference: string;
  displayString: string;
  selected: boolean;
}

export interface Destinations {
  resource: Resource;
  type: string;
  entity: DestinationsEntity;
}

export interface DestinationsEntity {
  destinations: Destination[];
}

export interface LegalEntityTaxRegistration {
  resource: Resource;
  type: string;
  entity: BreakdownClass;
}

export interface BreakdownClass {}

export interface LineItems {
  resource: Resource;
  type: string;
  entity: LineItemsEntity;
}

export interface LineItemsEntity {
  lineItems: EntityElement[];
}

export interface PayingCustomer {
  resource: Resource;
  type: string;
  entity: PayingCustomerEntity;
}

export interface PayingCustomerEntity {
  fullName: string;
}

export interface PaymentMethods {
  resource: Resource;
  type: string;
  entity: PaymentMethodsEntity;
}

export interface PaymentMethodsEntity {
  creditOrDebitCard: CreditOrDebitCard;
  giftAndPromo: GiftAndPromo;
  walletBalances: WalletBalances;
}

export interface CreditOrDebitCard {
  id: string;
  requiresAddressChallenge: boolean;
  endingIn: string;
  issuer: Issuer;
  expiry: Expiry;
  nameOnCard: string;
  billingAddress: BillingAddress;
}

export interface Expiry {
  month: number;
  year: number;
  displayString: string;
  expired: boolean;
}

export interface GiftAndPromo {
  giftCard: Combined;
  combined: Combined;
}

export interface Combined {
  balance: Amount;
  coversPurchaseValue: boolean;
}

export interface WalletBalances {
  balancesInWallet: BalancesInWallet[];
}

export interface BalancesInWallet {
  giftCard: GiftCard;
}

export interface GiftCard {
  displayMessage: DisplayInfo;
}

export interface PolicyMessages {
  resource: Resource;
  type: string;
  entity: PolicyMessagesEntity;
}

export interface PolicyMessagesEntity {
  orderSummary: GenericPolicyMessage[];
  orderConfirmation: GenericPolicyMessage[];
  genericPolicyMessages: GenericPolicyMessage[];
  messages: Message[];
}

export interface GenericPolicyMessage {
  fragments: GenericPolicyMessageFragment[];
}

export interface GenericPolicyMessageFragment {
  displayString: string;
  url?: string;
}

export interface Message {
  primaryPolicyMessage: PrimaryPolicyMessage;
}

export interface PrimaryPolicyMessage {
  type: string;
  content: Content;
}

export interface Content {
  fragments: ContentFragment[];
}

export interface ContentFragment {
  text?: string;
  link?: Link;
}

export interface Link {
  url: string;
  content: DisplayStringForSeller;
}

export interface PurchaseTotals {
  resource: Resource;
  type: string;
  entity: PurchaseTotalsEntity;
}

export interface PurchaseTotalsEntity {
  purchaseTotal: Total;
  subtotals: Subtotal[];
  alternateCurrencyPurchaseTotals: AlternateCurrencyPurchaseTotal[];
  currencies: AlternateCurrencyPurchaseTotal[];
}

export interface AlternateCurrencyPurchaseTotal {
  grandTotal: Total;
  subtotals: Subtotal[];
}

export interface Total {
  displayString: string;
  displayInfo: DisplayInfo;
  amount: Amount;
  breakdown: BreakdownClass;
}

export interface Subtotal {
  type: string;
  displayString: string;
  displayInfo: DisplayInfo;
  amount: Amount;
  groupIndex: number;
}
