import { PrismaClient, User } from ".prisma/client";
import { Account } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { ObjectSchema } from "joi";
import { AccountInfo } from "../types/internal";
import { getAccountType, getKeyData, getMaxAccountsFromKeyData } from "./auth";
import RateLimit from "express-rate-limit";
import { logger } from "./etc";
import { sendApiError } from "./webhooks";

const enum Plans {
  Renewalx25 = "prod_HiNLhTsHY34FUA",
  Renewalx35 = "prod_ILKOTrrJzt27xk",
  Staff = "prod_IQ5tASmjEWzZEm",
  GroupBuy = "prod_ILKUk6dI7IJ8eX",
  Giveaway = "prod_ILKUWDnTQOVivc",
}

const AllowedPlanIds = [
  Plans.Renewalx25,
  Plans.Renewalx35,
  Plans.Staff,
  Plans.GroupBuy,
  Plans.Giveaway,
];

declare module "express-serve-static-core" {
  interface Request {
    user: User;
    isAdmin: boolean;
    maxAccounts: number;
    maxExtraAccounts: number;
  }
}

export const joiValidator =
  (resourceSchema: ObjectSchema<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const resource = req.body;

    try {
      await resourceSchema.validateAsync(resource);
      next();
    } catch (e: any) {
      const errors = e.details?.map((detail: any) => detail.message);
      logger.red("Failed to validate: " + JSON.stringify(errors), req.user.key);
      return res.status(400).json(makeError(errors));
    }
  };

export const makeRatelimiter = (windowMs: number, max: number) =>
  RateLimit({
    windowMs,
    max,
    handler: (req, res /*next*/) =>
      res.status(429).json(makeError(["Too many requests"])),
    keyGenerator: (req): string => req.user?.key ?? req.ip,
    skip: (req): boolean => req.isAdmin ?? false,
    skipFailedRequests: true,
  });

export const masterApiKey = process.env.MASTER_API_KEY;

export const authMiddleware = (prisma: PrismaClient) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const hwid = req.headers["x-hwid"];
    const isAdmin = req.headers["api-key"] === masterApiKey;

    if (
      typeof req.headers.authorization !== "string" ||
      !req.headers.authorization.includes("Bearer ")
    ) {
      return res.status(403).json(makeError(["Missing authorization"]));
    } else if (typeof hwid !== "string" && !isAdmin) {
      return res.status(403).json(makeError(["Missing hwid"]));
    }

    const key = req.headers.authorization.split(" ")[1].toUpperCase();

    const keyCountInDb = await prisma.user.count({ where: { key } });
    const keyData = await getKeyData(key);
    res.header(
      "x-identity",
      `${encodeURIComponent(keyData?.discord?.username)} (${
        keyData?.discord?.discord_account_id
      })`
    );

    if (!(isAdmin && keyCountInDb === 1)) {
      if (!keyData) {
        return res.status(404).json(makeError(["Key not found"]));
      } else if (typeof keyData?.discord?.discord_account_id !== "string") {
        return res
          .status(401)
          .json(makeError(["Key is not binded to a discord account"]));
      } else if (keyData.metadata.hwid !== hwid && !isAdmin) {
        return res.status(403).json(makeError(["Forbidden from key"]));
      }

      // else if (keyData.metadata.cloud_access === "false" && !isAdmin) {
      //   return res.status(403).json(makeError(["Not allowed"]));
      // } else if (
      //   !AllowedPlanIds.includes(keyData.plan.product) &&
      //   keyData.metadata.cloud_access !== "true" &&
      //   !isAdmin
      // ) {
      //   return res.status(403).json(makeError(["Key plan not allowed"]));
      // }
    }

    const { maxAccounts, maxExtraAccounts } =
      getMaxAccountsFromKeyData(keyData);
    req.isAdmin = isAdmin;
    req.user = await prisma.user.upsert({
      create: {
        key,
        maxAccounts,
        discordId: keyData?.discord?.discord_account_id,
      },
      where: { key },
      update: { maxAccounts, discordId: keyData?.discord?.discord_account_id },
    });
    req.maxAccounts = maxAccounts;
    req.maxExtraAccounts = maxExtraAccounts;

    next();
  };
};

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    sendApiError(err, req, res);
  } catch (err: any) {
    try {
      logger.red("Error when sending API error: " + err.message ?? err);
      console.error(err);
    } catch {}
  }
  return res.status(500).json(makeError(["Internal Server Error"]));
};

export const makeError = (errors: string[]) => {
  return { errors };
};

export const makeSuccess = (success: string) => {
  return { success };
};

export const sanitizeRequestAccount = <AccountType extends AccountInfo>(
  account: AccountType
): AccountType => {
  account.email = account.email.toLowerCase();
  return account;
};

export const sanitizeResponseAccount = (
  account: Account,
  includeAsins: boolean = false
) => {
  const accountType = getAccountType(account);
  const copy: any = {
    email: account.email,
    marketplaceId: account.marketplaceId,
    type: accountType.toLowerCase(),
  };

  if (includeAsins) {
    copy.asins = account.asins;
  }
  return copy;
};
