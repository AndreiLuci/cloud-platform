import { Router, json, Request } from "express";
import {
  accountInfoValidator,
  accountInfoWithAsinValidator,
  fullAccountValidator,
} from "../../utils/validators";
import {
  joiValidator,
  makeError,
  makeRatelimiter,
  makeSuccess,
  sanitizeRequestAccount,
  sanitizeResponseAccount,
} from "../../utils/middleware";
import AmazonLogin from "../../utils/login";
import {
  ExtraAccountAllowedAsins,
  getAccountFromCookies,
  MarketplaceId,
} from "../../utils/amazon";
import {
  AccountInfo,
  FullAccount,
  AccountWithAsins,
  RouterArgs,
  AccountType,
} from "../../types/internal";
import { getAccountType } from "../../utils/auth";
import { cookiesCanCheckout } from "../../utils/checkout";

export default function ({ prisma, accountCollection }: RouterArgs) {
  const router = Router();

  const hasDuplicateAccount = async (
    account: AccountWithAsins
  ): Promise<boolean> => {
    const duplicateCount = await prisma.account.count({
      where: { email: account.email, marketplaceId: account.marketplaceId },
    });

    return duplicateCount > 0;
  };

  const hasReachedAccountLimit = async (
    account: AccountWithAsins,
    req: Request
  ): Promise<boolean> => {
    if (req.isAdmin) return false;
    const allAccounts = await prisma.account.findMany({
      where: { userId: req.user.id },
    });

    const accountType = getAccountType(account);

    if (accountType == AccountType.Extra) {
      const extraAccounts = allAccounts.filter((account) =>
        account.asins.every((asin) => ExtraAccountAllowedAsins.includes(asin))
      );

      return extraAccounts.length >= req.maxExtraAccounts;
    }

    const defaultAccounts = allAccounts.filter((account) =>
      account.asins.some((asin) => !ExtraAccountAllowedAsins.includes(asin))
    );

    return defaultAccounts.length >= req.maxAccounts;
  };

  router.use(json());

  // Get All
  router.get("/accounts", makeRatelimiter(1000, 5), async (req, res) => {
    const accounts = await prisma.account.findMany({
      where: { userId: req.user.id },
    });
    return res
      .status(200)
      .json(
        accounts.map((account) =>
          sanitizeResponseAccount(account, req.query.asins === "true")
        )
      );
  });

  // Delete
  router.delete(
    "/accounts",
    makeRatelimiter(2 * 1000, 5),
    joiValidator(accountInfoValidator),
    async (req, res) => {
      const account = sanitizeRequestAccount<AccountInfo>(req.body);

      if (!accountCollection.exists(account.email, account.marketplaceId)) {
        return res.status(404).json(makeError(["Account Does Not Exist"]));
      }

      await accountCollection.delete(account.email, account.marketplaceId);

      return res.status(200).json(makeSuccess("Account Deleted"));
    }
  );

  // Create
  router.put(
    "/accounts",
    makeRatelimiter(15 * 1000, 1),
    joiValidator(fullAccountValidator),
    async (req, res) => {
      //return res.status(403).json(makeError(["Account addition is disabled"]));
      const account = sanitizeRequestAccount<FullAccount>(req.body);
      const accountType = getAccountType(account);
      if (await hasReachedAccountLimit(account, req)) {
        return res
          .status(409)
          .json(makeError([accountType + " Account Limit Reached"]));
      }
      if (await hasDuplicateAccount(account)) {
        return res.status(409).json(makeError(["Account Already Exists"]));
      }
      const accountInfo = await getAccountFromCookies(
        account.websiteCookieString,
        account.marketplaceId
      );
      if (typeof accountInfo?.email !== "string") {
        return res
          .status(409)
          .json(makeError(["Account cookie are invalid (0x1)"]));
      }
      if (accountInfo.email.toLowerCase().trim() !== account.email.trim()) {
        console.log(
          accountInfo.email.toLowerCase().trim() +
            " doesn't match " +
            account.email.trim()
        );
        return res
          .status(409)
          .json(makeError(["Account email does not match one provided"]));
      }
      if (accountInfo.effectiveMarketPlaceId !== account.marketplaceId) {
        return res
          .status(409)
          .json(
            makeError(["Primary account region does not match one provided"])
          );
      }
      const loginSession = new AmazonLogin(
        account.websiteCookieString,
        account.marketplaceId
      );
      try {
        const resp = await loginSession.login();
        if (!resp.tokens?.website_cookies) {
          console.log(
            "Account got no website cookies",
            account.email,
            req.user.key
          );
          return res
            .status(409)
            .json(
              makeError([
                "Account is blacklisted and is not reversible, please add another account",
              ])
            );
        }
        account.websiteCookieString = resp.tokens.website_cookies
          .map((cookie) => `${cookie.Name}=${cookie.Value}`)
          .join("; ");
        account.access_token = resp.tokens.bearer?.access_token;
        console.log(
          "Logged in on Account ID: " + resp.customer_id,
          account.email,
          req.user.key
        );
      } catch (err: any) {
        console.log(
          "When logging in: " + err.message,
          account.email,
          req.user.key
        );
        return res
          .status(409)
          .json(makeError(["Account cookies are invalid (0x2)"]));
      }
      const accountCanCheckout = await cookiesCanCheckout(
        account.email,
        account.marketplaceId,
        account.websiteCookieString,
        account.access_token
      );
      console.log(account.websiteCookieString, account.access_token);
      if (!accountCanCheckout) {
        return res
          .status(409)
          .json(makeError(["Account couldn't checkout test item"]));
      }
      const accountInDb = await prisma.account.create({
        data: { userId: req.user.id, ...account },
      });
      accountCollection.add(accountInDb, req.user.key);
      return res
        .status(201)
        .json(makeSuccess("Created " + accountType + " Account"));
    }
  );

  // Update

  router.patch(
    "/accounts",
    makeRatelimiter(30 * 1000, 2),
    joiValidator(accountInfoWithAsinValidator),
    async (req, res) => {
      const requestedAccount = sanitizeRequestAccount<AccountWithAsins>(
        req.body
      );

      const foundAccount = accountCollection.get(
        requestedAccount.email,
        requestedAccount.marketplaceId
      );

      if (!foundAccount) {
        return res.status(404).json(makeError(["Account Does Not Exist"]));
      }

      const requestedAccountType = getAccountType(requestedAccount);

      const existingAccountType = getAccountType(foundAccount.details);

      if (requestedAccountType !== existingAccountType) {
        return res
          .status(409)
          .json(
            makeError([
              "Account Type Is " +
                existingAccountType +
                " Not " +
                requestedAccountType,
            ])
          );
      }

      await accountCollection.updateAsins(
        {
          email: foundAccount.details.email,
          marketplaceId: <MarketplaceId>foundAccount.details.marketplaceId,
        },
        requestedAccount.asins
      );

      return res.status(200).json(makeSuccess("Account Modified"));
    }
  );

  router.post(
    "/accounts",
    makeRatelimiter(5 * 60 * 60 * 1000, 5),
    joiValidator(accountInfoValidator),
    async (req, res) => {
      const account = sanitizeRequestAccount<AccountInfo>(req.body);

      const countCheck = await prisma.account.count({
        where: {
          userId: req.user.id,
          email: account.email,
          marketplaceId: account.marketplaceId,
        },
      });

      if (countCheck !== 1) {
        return res.status(404).json(makeError(["Account Not Found"]));
      }

      const testCheckout = await accountCollection.testCheckout(
        account.email,
        account.marketplaceId
      );

      if (typeof testCheckout === "string") {
        return res.status(409).json(makeError([testCheckout]));
      }

      if (testCheckout) {
        return res.status(200).json(makeSuccess("Successfully Checked Out"));
      }

      return res.status(409).json(makeError(["Failed To Check Out"]));
    }
  );

  return router;
}
