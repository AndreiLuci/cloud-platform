import axios, { AxiosInstance, AxiosProxyConfig, AxiosResponse } from "axios";
import _ from "lodash";
import InitiateResponse from "../../types/initiate";
import {
  AccountError,
  AccountUnauthorized,
  KeyInvalidError,
  TurboIneligible,
  UnknownCheckoutError,
  UnknownInitiateError,
  UnknownSignError,
} from "./errors";
import { Account, PrismaClient } from ".prisma/client";
import { AccountType, OrderInfo, Product } from "../../types/internal";
import { logger, proxyToString, randomRange, sleep } from "../../utils/etc";
import {
  generateAmazonRID,
  generateAppUUID,
  MarketplaceId,
  TestProducts,
} from "../../utils/amazon";
import Proxies from "../../utils/proxies";
import Hosts from "../../utils/hosts";
import AccountCollection from "./collection";
import {
  getAccountType,
  getKeyData,
  getMaxAccountsFromKeyData,
} from "../../utils/auth";

export const maxPidCacheLifespan = 12 * 60 * 60 * 1000;

export const turboIneligblePurchaseStates = [
  "DESTINATION_NOT_SET",
  "PAYMENT_PLAN_NOT_SET",
  "BILLING_ADDRESS_NOT_SET",
];

export const getPurchaseInitiateURI = (marketplaceId: string, host: string) =>
  `https://${host}/marketplaces/${marketplaceId}/checkout/`;

export const getPurchaseSignURI = (
  marketplaceId: string,
  purchaseId: string,
  host: string
) => `https://${host}/marketplaces/${marketplaceId}/purchases/`;

export default class AccountHandler {
  private http: AxiosInstance;
  public currentProduct?: Product;
  public checkoutCreatedCache: OrderInfo[] = [];
  public cancelled: boolean = false;
  public hostname: string =
    Hosts.checkout[this.details.marketplaceId as MarketplaceId].next()!;

  constructor(
    public details: Account,
    private accountCollection: AccountCollection,
    public key: string
  ) {
    this.http = axios.create({
      validateStatus: null,
      timeout: 10000,
      headers: {
        "user-agent":
          "AMZN(SetTopBox/Amazon Fire TV Mantis/AKPGW064GI9HE,Android/7.1.2,ShopTV3P/release/2.0)",
      },
    });

    if (this.details.access_token) {
      this.http.defaults.headers.common["x-amz-access-token"] =
        this.details.access_token;
    }
  }

  public cancel() {
    this.cancelled = true;
  }

  public getCache(product: Product): OrderInfo | undefined {
    var cacheIndex = this.checkoutCreatedCache.findIndex(
      (cache) => cache.product.input === product.input
    );

    while (
      cacheIndex !== -1 &&
      Date.now() - this.checkoutCreatedCache[cacheIndex].createdAt >
        maxPidCacheLifespan
    ) {
      logger.yellow(
        "Removed stale pid",
        product.input,
        this.details.email,
        this.checkoutCreatedCache[cacheIndex].purchaseId
      );
      this.checkoutCreatedCache.splice(cacheIndex, 1);
      cacheIndex = this.checkoutCreatedCache.findIndex(
        (cache) => cache.product.input === product.input
      );
    }

    return cacheIndex !== -1
      ? this.checkoutCreatedCache[cacheIndex]
      : undefined;
  }

  private pidCacheExists(purchaseId: string): boolean {
    return (
      this.checkoutCreatedCache.findIndex(
        (cache) => cache.purchaseId === purchaseId
      ) !== -1
    );
  }

  private putCache(orderInfo: OrderInfo): void {
    if (this.pidCacheExists(orderInfo.purchaseId)) return;

    logger.green(
      "Put cache",
      orderInfo.product.input,
      this.details.email,
      orderInfo.purchaseId
    );
    this.checkoutCreatedCache.push(orderInfo);
  }

  private deleteCache(purchaseId: string): void {
    logger.green("Deleted cache", purchaseId, this.details.email);
    this.checkoutCreatedCache = this.checkoutCreatedCache.filter(
      (cache) => cache.purchaseId !== purchaseId
    );
  }

  private async error(
    error: AccountError,
    sendToWebhook: boolean = true
  ): Promise<void> {
    logger.red(
      "Error: " +
        error.message +
        (error.response?.status !== 503
          ? "\n" + JSON.stringify(error.response?.data)
          : ""),
      this.details.email,
      error.response?.status,
      error.response?.headers["x-amz-rid"]
    );

    this.randomizeProxyAndHost();

    if (!this.cancelled && sendToWebhook) {
      if (error.deleteAccount) this.cancel();

      this.accountCollection
        .error(
          this.details,
          error.message,
          error.sendToUserWebhook,
          error.deleteAccount,
          error.response
        )
        .catch((err) => {
          logger.red(
            "Error when sending ERROR webhook: " + err.message,
            this.details.email
          );
          console.error(err);
        });
    }

    logger.red(
      "Sleeping for 300-600 ms because of error",
      this.details.email,
      error.response?.status
    );
    await sleep(randomRange(100, 200));
  }

  private success(orderInfo: OrderInfo) {
    this.deleteCache(orderInfo.purchaseId);

    this.details.asins = this.details.asins.filter(
      (asin) => asin !== orderInfo.product.input
    );
    this.accountCollection
      .updateAsins(
        {
          email: this.details.email,
          marketplaceId: <MarketplaceId>this.details.marketplaceId,
        },
        this.details.asins
      )
      .catch((err) => {
        logger.red(
          "Failed to update asin list after success",
          this.details.email,
          orderInfo.product.input
        );
        console.error(err);
      });

    this.accountCollection.success(orderInfo, this.details).catch((err) => {
      logger.red(
        "Error when sending SUCCESS webhook: " + err.message,
        this.details.email
      );
      console.error(err);
    });

    logger.green(
      "Success",
      this.details.email,
      orderInfo.product.input,
      orderInfo.purchaseId
    );
  }

  public async ensureKeyValidity(): Promise<boolean> {
    const keyData = await getKeyData(this.key);
    if (!keyData) {
      console.log("Key Not Found", this.key);
      await this.error(new KeyInvalidError());
      return false;
    }

    const { maxAccounts, maxExtraAccounts } =
      getMaxAccountsFromKeyData(keyData);

    const userAccounts = this.accountCollection.getAccountsForUserId(
      this.details.userId
    );
    const accountType = getAccountType(this.details);

    const accountPartition = _.groupBy(userAccounts, (accountHandler) =>
      getAccountType(accountHandler.details)
    );
    if (
      accountType === AccountType.Default &&
      accountPartition[AccountType.Default]?.length > maxAccounts
    ) {
      console.log(
        `Account type - defualt - max accounts exceeded. Allowed: ${maxAccounts} Found: ${
          accountPartition[AccountType.Default]?.length
        }`,
        this.key
      );
      await this.error(new KeyInvalidError());
      return false;
    }

    if (
      accountType === AccountType.Extra &&
      accountPartition[AccountType.Extra]?.length > maxExtraAccounts
    ) {
      console.log(
        `Account type - extra - max accounts exceeded. Allowed: ${maxExtraAccounts} Found: ${
          accountPartition[AccountType.Extra]?.length
        }`,
        this.key
      );
      await this.error(new KeyInvalidError());
      return false;
    }
    return true;
  }

  public async ensureHealth(): Promise<boolean> {
    const keyValid = await this.ensureKeyValidity();
    if (!keyValid) return false;

    const testProduct =
      TestProducts[this.details.marketplaceId as MarketplaceId];

    const initiateResponse: AxiosResponse<InitiateResponse> =
      await this.initiateCheckout(testProduct, Proxies.etc.next());

    switch (initiateResponse.status) {
      case 403:
        await this.error(new AccountUnauthorized(initiateResponse));
        return false;
      case 201:
        const dataEntity = initiateResponse.data?.entity;
        if (
          turboIneligblePurchaseStates.some((state) =>
            dataEntity.purchaseState.includes(state)
          )
        ) {
          await this.error(new TurboIneligible(initiateResponse));
          return false;
        }

        logger.green(
          `Successful health check `,
          this.details.email,
          testProduct.input
        );
        return true;
      case 422:
        logger.yellow(
          `OOS on health check `,
          this.details.email,
          testProduct.input
        );
        return true;
      default:
        await this.error(new UnknownInitiateError(initiateResponse));
        return true;
    }
  }

  //#region Initiate
  private async processCreatedOrder(
    response: AxiosResponse<InitiateResponse>,
    product: Product
  ): Promise<boolean> {
    const dataEntity = response.data?.entity;
    if (
      turboIneligblePurchaseStates.some((state) =>
        dataEntity.purchaseState.includes(state)
      )
    ) {
      await this.error(new TurboIneligible(response));
      return false;
    } else if (dataEntity.purchaseState.includes("SHIPPING_OPTION_NOT_SET")) {
      // logger.yellow(
      //   "Got pid with bad purchase state",
      //   product.input,
      //   this.details.email,
      //   data.purchaseId,
      //   JSON.stringify(data.purchaseState),
      //   JSON.stringify(data.purchaseRestrictions)
      // );
      return false;
    } else if (
      dataEntity.purchaseRestrictions?.some(
        (restriction) => restriction.reason === "EXCEEDED_PERMITTED_QUANTITY"
      )
    ) {
      this.details.asins = this.details.asins.filter(
        (asin) => asin !== product.input
      );
      this.accountCollection
        .updateAsins(
          {
            email: this.details.email,
            marketplaceId: <MarketplaceId>this.details.marketplaceId,
          },
          this.details.asins
        )
        .catch((err) => {
          logger.red(
            "Failed to update asin list after success",
            this.details.email,
            product.input
          );
          console.error(err);
        });
      return false;
    }

    logger.yellow(
      "Order created",
      product.input,
      this.details.email,
      dataEntity.purchaseId,
      JSON.stringify(dataEntity.purchaseState),
      JSON.stringify(dataEntity.purchaseRestrictions)
    );

    const orderInfo: OrderInfo = {
      product,
      purchaseId: dataEntity.purchaseId,
      price: parseFloat(
        dataEntity.lineItems?.entity?.lineItems[0]?.price?.priceToPay?.amount ??
          "0"
      ),
      offerId:
        dataEntity.lineItems?.entity?.lineItems[0]?.offerListingId ?? "None",
      seller:
        dataEntity.lineItems?.entity?.lineItems[0]?.itemSeller?.entity
          ?.displayStringForSeller?.fragments[1]?.text ?? "None",
      total: parseFloat(
        dataEntity.purchaseTotals?.entity?.purchaseTotal?.amount?.amount ?? "0"
      ),
      deliveryEstimate:
        dataEntity.deliveryGroups?.entity?.deliveryGroups[0]?.lineItemGroups[0]
          ?.scheduledDeliveryPromise?.promiseString ?? "None",
      createdAt: Date.now(),
    };

    const resp = await this.signOrder(orderInfo);
    return this.proccessSignOrder(orderInfo, resp);
  }

  private async processCheckoutInitiation(
    response: AxiosResponse,
    product: Product
  ): Promise<boolean> {
    switch (response.status) {
      case 403:
        await this.error(new AccountUnauthorized(response));
        return false;
      case 201:
        return await this.processCreatedOrder(response, product);
      case 422:
        //logger.red(`OOS on initiate`, this.details.email, product.input);
        return false;
      default:
        await this.error(
          new UnknownInitiateError(response),
          response.status !== 503 && response.status !== 502
        );
        return false;
    }
  }

  public async initiateCheckout(
    product: Product,
    overrideProxy?: AxiosProxyConfig
  ): Promise<AxiosResponse> {
    return await this.http({
      method: "POST",
      url: getPurchaseInitiateURI(this.details.marketplaceId, this.hostname),
      headers: {
        "x-amzn-RequestId": generateAmazonRID(),
      },
      proxy: overrideProxy,
      data: {
        items: [
          {
            asin: product.input,
            offerId: product.extraData.offer,
            quantity: 1,
          },
        ],
      },
    });
  }
  //#endregion Initiate

  //#region Sign
  public async proccessSignOrder(
    orderInfo: OrderInfo,
    response: AxiosResponse
  ): Promise<boolean> {
    switch (response.status) {
      case 200:
        this.success(orderInfo);
        return true;
      case 422:
        logger.red(
          `Possible Success with 422`,
          this.details.email,
          orderInfo.product.input,
          orderInfo.purchaseId,
          response.status
        );
        // this.success(orderInfo);
        return false;
      case 403:
        // logger.red(
        //   `OOS on sign`,
        //   this.details.email,
        //   product.input,
        //   purchaseId,
        //   response.status
        // );
        this.putCache(orderInfo);
        return false;
      default:
        this.putCache(orderInfo);
        await this.error(
          new UnknownSignError(response),
          response.status !== 503 && response.status !== 502
        );
        return false;
    }
  }

  public async signOrder(
    orderInfo: OrderInfo,
    overrideProxy?: AxiosProxyConfig
  ): Promise<AxiosResponse> {
    return await this.http({
      method: "POST",
      url: getPurchaseSignURI(
        this.details.marketplaceId,
        orderInfo.purchaseId,
        this.hostname
      ),
      headers: {
        "purchase-id": orderInfo.purchaseId,
        "x-amzn-RequestId": generateAmazonRID(),
      },
      proxy: overrideProxy,
      data: "{}",
    });
  }
  //#endregion Sign

  public async checkout(product: Product): Promise<boolean> {
    ///const startTime = Date.now();
    var returnBool;
    const cache = this.getCache(product);

    if (cache) {
      const resp = await this.signOrder(cache);
      returnBool = await this.proccessSignOrder(cache, resp);

      // logger.yellow(
      //   "Finished cached checkout attempt in " +
      //     (Date.now() - startTime) +
      //     "ms",
      //   this.details.email,
      //   product.input,
      //   cache.purchaseId + " | " + cache.product.input
      // );
    } else {
      const initiate = await this.initiateCheckout(product);
      returnBool = await this.processCheckoutInitiation(initiate, product);

      // logger.yellow(
      //   "Finished fresh checkout attempt in " + (Date.now() - startTime) + "ms",
      //   this.details.email,
      //   product.input
      // );
    }

    return returnBool;
  }

  public async testCheckout(): Promise<boolean | string> {
    if (this.currentProduct) return "Busy";

    if (!this.http.defaults.proxy) {
      this.http.defaults.proxy = Proxies.checkout.next();
      logger.yellow(
        "Set test proxy (no proxy present before)",
        this.http.defaults.proxy
          ? proxyToString(this.http.defaults.proxy)
          : "No proxy"
      );
    }

    try {
      return await this.checkout(
        TestProducts[this.details.marketplaceId as MarketplaceId]
      );
    } catch (err) {
      return false;
    }
  }

  public randomizeProxyAndHost() {
    this.http.defaults.proxy = Proxies.checkout.next();
    this.hostname =
      Hosts.checkout[this.details.marketplaceId as MarketplaceId].next()!;
  }

  public async startCheckoutLoop(product: Product): Promise<void> {
    if (this.currentProduct) return;
    this.randomizeProxyAndHost();
    this.currentProduct = product;
    const timeToStop = Date.now() + 60 * 1000;

    logger.yellow(
      `Starting checkout loop ${Date.now() - product.ts}ms after found`,
      this.details.email,
      product.input,
      this.http.defaults.proxy ? "With proxy" : "No Proxy",
      this.http.defaults.proxy,
      this.hostname
    );

    do {
      try {
        await this.checkout(product);
      } catch (err: any) {
        if (["ECONNABORTED", "ECONNRESET"].includes(err.code)) {
          logger.red(
            "Randomizing proxy and host due to timeout",
            this.details.email,
            product.input
          );
          this.randomizeProxyAndHost();
          continue;
        }

        await this.error(new UnknownCheckoutError(undefined, err.message));
        logger.red(
          "Error when checking out: " + err.message,
          this.details.email,
          product.input
        );
        console.error(err);
      }
      //await sleep(randomRange(100, 200));
    } while (
      Date.now() < timeToStop &&
      this.cancelled !== true &&
      this.details.asins.includes(product.input)
    );

    logger.yellow(
      `Stopping checkout loop`,
      this.details.email,
      product.input
      // this.http.defaults.proxy
      //   ? proxyToString(this.http.defaults.proxy)
      //   : "No Proxy"
    );

    this.currentProduct = undefined;
  }
}
