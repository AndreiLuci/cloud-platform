import { Account, PrismaClient } from ".prisma/client";
import { AxiosResponse } from "axios";
import { AccountInfo, OrderInfo, Product } from "../../types/internal";
import { MarketplaceId } from "../../utils/amazon";
import { logger, shuffleArray } from "../../utils/etc";
import { sendErrorWebhook, sendSuccessWebhook } from "../../utils/webhooks";
import { APISafeError } from "./errors";
import AccountHandler from "./index";

const DefaultMaxWorkerCount = 600;

// const ProductMaxWorkerCount: Record<string, number> = {
//   B08FC6MR62: 225,
//   B08FC5L3RG: 225,
//   B08H75RTZ8: 225,
//   B09DP86ZDH: 225,
//   B09B6DL81D: 225,
// };

const getMaxWorkerCount = (product: Product): number => {
  return DefaultMaxWorkerCount;
};

const HealthCheckInterval = 1000 * 3;

export default class AccountCollection {
  private list: AccountHandler[] = [];
  public processingOffer: boolean = false;

  constructor(public prisma: PrismaClient) {
    const checkAccount = async (index: number = 0): Promise<any> => {
      const account = this.list[index % this.list.length];

      if (!account) {
        logger.yellow("No accounts to health check");
        return setTimeout(checkAccount, HealthCheckInterval);
      }

      await account.ensureHealth().catch((err) => {
        logger.red(
          "Error while performing health check: " + err.message,
          account.details.email
        );
      });

      return setTimeout(
        () => checkAccount(++index % this.list.length),
        HealthCheckInterval
      );
    };

    setTimeout(checkAccount, HealthCheckInterval);
  }

  public get length(): number {
    return this.list.length;
  }

  public getAccountsForUserId(userId: number) {
    return this.list.filter((account) => account.details.userId === userId);
  }

  public async success(orderInfo: OrderInfo, account: Account) {
    const user = await this.prisma.user.findFirst({
      where: { accounts: { some: { id: account.id } } },
    });

    sendSuccessWebhook(
      orderInfo,
      account,
      user?.discordId ? user?.discordId : undefined,
      user?.webhookURL ?? undefined
    );
  }
  public async error(
    account: Account,
    reason: string,
    sendToUser: boolean,
    removeAccount: boolean,
    response?: AxiosResponse
  ) {
    const user = await this.prisma.user.findFirst({
      where: { accounts: { some: { id: account.id } } },
    });

    if (removeAccount) {
      this.delete(account.email, account.marketplaceId).catch((err) => {
        logger.red(
          `Error when removing account from fatal error`,
          account.email
        );
        console.error(err);
      });
    }

    sendErrorWebhook(
      account,
      removeAccount ? "Account Removed" : "None",
      reason,
      user?.discordId ? user?.discordId : undefined,
      sendToUser ? user?.webhookURL ?? undefined : undefined,
      response
    );
  }

  public exists(email: string, marketplaceId: string): boolean {
    return (
      this.list.findIndex(
        (handler) =>
          handler.details.email === email &&
          handler.details.marketplaceId === marketplaceId
      ) !== -1
    );
  }

  public get(email: string, marketplaceId: string): AccountHandler | undefined {
    return this.list.find(
      (handler) =>
        handler.details.email === email &&
        handler.details.marketplaceId === marketplaceId
    );
  }

  public updateAsinListForUser(
    userId: number,
    marketplaceId: MarketplaceId,
    asins: string[]
  ): void {
    for (let i = 0; i < this.list.length; i++) {
      if (
        this.list[i].details.userId === userId &&
        this.list[i].details.marketplaceId === marketplaceId
      ) {
        this.list[i].details.asins = asins;
      }
    }
  }

  public async updateAsins(
    account: AccountInfo,
    asins: string[]
  ): Promise<void> {
    const current = this.get(account.email, account.marketplaceId);

    if (!current) {
      throw new Error("Attempted to edit unknown account");
    }

    current.details.asins = asins;

    await this.prisma.account.updateMany({
      where: { email: account.email, marketplaceId: account.marketplaceId },
      data: {
        asins: asins,
      },
    });
  }

  public add(account: Account, key: string): void {
    if (this.exists(account.email, account.marketplaceId)) {
      throw new Error("Attempted to add duplicate account");
    }

    this.list.push(new AccountHandler(account, this, key));
  }

  public async delete(
    email: string,
    marketplaceId: string,
    removeFromDB: boolean = true
  ): Promise<void> {
    const indexOf = this.list.findIndex(
      (handler) =>
        handler.details.email === email &&
        handler.details.marketplaceId === marketplaceId
    );

    if (indexOf === -1) {
      throw new APISafeError("Account doesn't exist");
    }

    this.list[indexOf].cancel();

    this.list.splice(indexOf, 1);

    if (removeFromDB) {
      await this.prisma.account.deleteMany({
        where: { email, marketplaceId },
      });
    }
  }

  public getIdleSubscribedAccounts(
    asin: string,
    marketplaceId: string
  ): AccountHandler[] {
    return this.list.filter(
      (handler) =>
        handler.details.asins.includes(asin) &&
        handler.details.marketplaceId === marketplaceId &&
        !handler.currentProduct
    );
  }

  public getWorkingCount(
    product: Product,
    marketplaceId: MarketplaceId
  ): number {
    return this.list.filter(
      (account) =>
        account.currentProduct?.input === product.input &&
        account.details.marketplaceId === marketplaceId
    ).length;
  }

  public async testCheckout(
    email: string,
    marketplaceId: MarketplaceId
  ): Promise<boolean | string> {
    const account = this.get(email, marketplaceId);

    if (!account) {
      return "Account doesn't exist";
    }

    return await account.testCheckout();
  }

  public startAccountsLoop(product: Product): void {
    if (this.processingOffer) return;
    this.processingOffer = true;
    const currentWorkingCount = this.getWorkingCount(
      product,
      product.extraData.marketplaceId
    );
    const maxWorkerCount = getMaxWorkerCount(product);

    if (currentWorkingCount < maxWorkerCount) {
      const maxNewAccountCount = maxWorkerCount - currentWorkingCount;

      const availableAccounts = shuffleArray(
        this.getIdleSubscribedAccounts(
          product.input,
          product.extraData.marketplaceId
        )
      );

      var eligbleAccounts = availableAccounts
        .filter((account) => account.getCache(product) != undefined)
        .slice(0, maxNewAccountCount);

      var totalWithPid = eligbleAccounts.length;
      var totalWithoutPid = 0;

      if (eligbleAccounts.length < maxNewAccountCount) {
        const maxNoPidCount = maxNewAccountCount - eligbleAccounts.length;

        const noPidAccounts = availableAccounts
          .filter((account) => account.getCache(product) == undefined)
          .slice(0, maxNoPidCount);

        totalWithoutPid = noPidAccounts.length;

        eligbleAccounts = eligbleAccounts.concat(noPidAccounts);
      }

      for (var i = 0; i < eligbleAccounts.length; i++) {
        eligbleAccounts[i].startCheckoutLoop(product);
      }

      logger.green(
        `Started ${eligbleAccounts.length} (+${currentWorkingCount}) random accounts [W/ ${totalWithPid}] - [W/O ${totalWithoutPid}]`,
        product.input
      );
    }
    this.processingOffer = false;
    return;
  }
}
