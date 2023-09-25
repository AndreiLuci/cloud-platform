import { Joi } from "express-validation";
import { asinRegex, domainMap } from "./amazon";

export const CATCHALL_EMAIL = "*@*.*";

export const AccountFields = {
  email: Joi.string(),
  marketplaceId: Joi.string().equal(...Object.keys(domainMap)),
  websiteCookieString: Joi.string(),
  asins: Joi.array()
    .max(150)
    .items(
      Joi.string().regex(asinRegex, {
        name: "Amazon Standard Identification Number",
      })
    )
    .unique(),
};

export const accountInfoValidator = Joi.object({
  email: AccountFields.email.required(),
  marketplaceId: AccountFields.marketplaceId.required(),
});

export const fullAccountValidator = Joi.object({
  email: AccountFields.email.required(),
  marketplaceId: AccountFields.marketplaceId.required(),
  websiteCookieString: AccountFields.websiteCookieString.required(),
  asins: AccountFields.asins.required(),
});

export const accountInfoWithAsinValidator = Joi.object({
  email: AccountFields.email.required(),
  marketplaceId: AccountFields.marketplaceId.required(),
  asins: AccountFields.asins.required(),
});

export const settingsValidator = Joi.object({
  webhookURL: Joi.string().uri().allow(null).required(),
});
