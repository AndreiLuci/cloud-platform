import axios from "axios";
import { AccountType, AccountWithAsins } from "../types/internal";
import { ExtraAccountAllowedAsins } from "./amazon";

export const getKeyData = async (key: string): Promise<any | undefined> => {
  const resp = await axios({
    validateStatus: null,
    url: "https://api.whop.com/api/v1/licenses/" + key,
    headers: {
      Authorization: `Bearer ${process.env.HYPER_API_KEY}`,
    },
  });

  return resp.status === 200 ? resp.data : undefined;
};

export const getMaxAccountsFromKeyData = (keyData: any) => {
  const maxAccounts = parseInt(keyData?.metadata?.max_cloud_accounts) || 1;
  const maxExtraAccounts =
    (parseInt(keyData?.metadata?.max_cloud_accounts_extra) || 0) + 10;
  return {
    maxAccounts,
    maxExtraAccounts,
  };
};

export const getAccountType = (
  account: Pick<AccountWithAsins, "asins">
): AccountType => {
  const isExtraAccount = account.asins.every((asin) =>
    ExtraAccountAllowedAsins.includes(asin)
  );

  if (isExtraAccount) return AccountType.Extra;

  return AccountType.Default;
};