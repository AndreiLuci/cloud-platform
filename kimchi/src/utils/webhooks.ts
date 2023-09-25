import { Account } from "@prisma/client";
import axios, { AxiosResponse } from "axios";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { Request, Response } from "express";
import { OrderInfo, Product } from "../types/internal";
import { domainMap, MarketplaceId, TestProducts } from "./amazon";
import { codeBlock, logger } from "./etc";
import Proxies from "./proxies";

export enum DecimalColors {
  success = 16324472,
  error = 7229949,
}

export const getEmbed = (color: DecimalColors): MessageBuilder =>
  new MessageBuilder()
    .setFooter("Cloud-Structure")
    .setTimestamp()
    .setColor(color);

export const globalWebhooks = {
  private: {
    success: new Webhook(""),
    error: new Webhook(""),
  },
  public: {
    success: new Webhook(""),
  },
};

export const sendApiError = (
  err: any,
  request: Request,
  response: Response
) => {
  const embed = getEmbed(DecimalColors.error)
    .setText("@everyone")
    .setTitle("Internal Server Error")
    .addField("Message", err.message ?? "None")
    .addField("Authorization", request.header("authorization") ?? "None", true)
    .addField(
      "Identity",
      response.getHeader("x-identity")?.toString() ?? "None",
      true
    )
    .addField("Request", request.method + " " + request.url)
    .addField(
      "Incoming Headers",
      codeBlock(
        "json",
        JSON.stringify(request.headers, null, 4).substr(0, 1024)
      )
    )
    .addField(
      "Incoming Data",
      codeBlock(
        "json",
        JSON.stringify(request.body ?? "", null, 4).substr(0, 1024)
      )
    )
    .addField("Stack", codeBlock("none", err.stack ?? "None"));

  globalWebhooks.private.error
    .send(embed)
    .catch((err) => logger.red("Couldn't send global webhook", err.message));
};

export const sendErrorWebhook = (
  account: Account,
  action: string,
  reason: string,
  discordId?: string,
  userWebhookUrl?: string,
  response?: AxiosResponse
) => {
  const responseData = response?.data
    ? JSON.stringify(response.data).substr(0, 1024)
    : "None";
  const responseStatus = response?.status.toString() ?? "None";

  const safeMessage = getEmbed(DecimalColors.error)
    .setText(discordId ? `<@${discordId}>` : "Failed to find discord identity")
    .setTitle("Error Detected")
    .addField(
      "Site",
      "amazon/" + domainMap[account.marketplaceId as MarketplaceId],
      true
    )
    .addField("Action", action, true)
    .addField("Reason", reason, true)
    .addField("Profile", `||${account.email}||`);

  const unsafeMessage = getEmbed(DecimalColors.error)
    .setText(discordId ? `<@${discordId}>` : "Failed to find discord identity")
    .setTitle("Error Detected")
    .addField(
      "Site",
      "amazon/" + domainMap[account.marketplaceId as MarketplaceId],
      true
    )
    .addField("Action", action, true)
    .addField("Reason", reason, true)
    .addField("Profile", `||${account.email}||`)
    .addField("Status Code", codeBlock("json", responseStatus));
  //.addField("Response Data", codeBlock("json", responseData));

  if (userWebhookUrl) {
    axios({
      url: userWebhookUrl,
      method: "POST",
      data: safeMessage.getJSON(),
      proxy: Proxies.etc.next(),
    }).catch((err) =>
      logger.red("Couldn't send user webhook: " + userWebhookUrl, err.message)
    );
  }

  globalWebhooks.private.error
    .send(unsafeMessage)
    .catch((err) => logger.red("Couldn't send global webhook", err.message));
};

export const sendPrivateGlobalWebhook = (
  orderInfo: OrderInfo,
  account: Account,
  discordId?: string
) => {
  const message = getEmbed(DecimalColors.success)
    .setText(discordId ? `<@${discordId}>` : "Failed to find discord identity")
    .setTitle("**Successful Checkout**")
    .setThumbnail(orderInfo.product.extraData.imageURL)
    .addField("Product", orderInfo.product.extraData.productString)
    .addField(
      "Site",
      "amazon/" + domainMap[account.marketplaceId as MarketplaceId],
      true
    )
    .addField("SKU", orderInfo.product.input, true)
    .addField("Price", `$${orderInfo.price}`, true)
    .addField("Total", `$${orderInfo.total}`, true)
    .addField("Delivery Estimate", orderInfo.deliveryEstimate, true)
    .addField("Seller", orderInfo.seller, true)
    .addField("Profile", `||${account.email}||`)
    .addField("OfferId", "```" + orderInfo.offerId + "```")
    .addField(
      "Note",
      "This ASIN has been removed from the account's list to prevent multiple checkouts. Please add it back once your item ships."
    );

  globalWebhooks.private.success
    .send(message)
    .catch((err) =>
      logger.red("Couldn't send global private webhook", err.message)
    );
};

export const sendPublicGlobalWebhook = (
  orderInfo: OrderInfo,
  account: Account,
  discordId?: string
) => {
  const message = getEmbed(DecimalColors.success)
    .setText(discordId ? `<@${discordId}>` : "Failed to find discord identity")
    .setTitle("**Successful Checkout**")
    .setThumbnail(orderInfo.product.extraData.imageURL)
    .addField("Product", orderInfo.product.extraData.productString)
    .addField(
      "Site",
      "amazon/" + domainMap[account.marketplaceId as MarketplaceId],
      true
    )
    .addField("SKU", orderInfo.product.input, true)
    .addField("Price", `$${orderInfo.price}`, true)
    .addField("Total", `$${orderInfo.total}`, true)
    .addField("Delivery Estimate", orderInfo.deliveryEstimate, true)
    .addField("Seller", orderInfo.seller, true);

  globalWebhooks.public.success
    .send(message)
    .catch((err) =>
      logger.red("Couldn't send global public webhook", err.message)
    );
};

export const sendSuccessWebhook = (
  orderInfo: OrderInfo,
  account: Account,
  discordId?: string,
  userWebhookUrl?: string
) => {
  const message = getEmbed(DecimalColors.success)
    .setText(discordId ? `<@${discordId}>` : "Failed to find discord identity")
    .setTitle("**Successful Checkout**")
    .setThumbnail(orderInfo.product.extraData.imageURL)
    .addField("Product", orderInfo.product.extraData.productString)
    .addField(
      "Site",
      "amazon/" + domainMap[account.marketplaceId as MarketplaceId],
      true
    )
    .addField("SKU", orderInfo.product.input, true)
    .addField("Price", `$${orderInfo.price}`, true)
    .addField("Total", `$${orderInfo.total}`, true)
    .addField("Delivery Estimate", orderInfo.deliveryEstimate, true)
    .addField("Seller", orderInfo.seller, true)
    .addField("Profile", `||${account.email}||`)
    .addField(
      "Note",
      "This ASIN has been removed from the account's list to prevent multiple checkouts. Please add it back once your item ships."
    );

  if (userWebhookUrl) {
    axios({
      url: userWebhookUrl,
      method: "POST",
      data: message.getJSON(),
      proxy: Proxies.etc.next(),
    }).catch((err) =>
      logger.red("Couldn't send user webhook: " + userWebhookUrl, err.message)
    );
  }

  sendPrivateGlobalWebhook(orderInfo, account, discordId);

  if (
    Object.values(TestProducts).every(
      (product) => product.input !== orderInfo.product.input
    )
  ) {
    sendPublicGlobalWebhook(orderInfo, account, discordId);
  }
};
