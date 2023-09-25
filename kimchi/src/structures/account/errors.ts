import { AxiosResponse } from "axios";

export class APISafeError extends Error {
  apiSafe: boolean = true;
}
export abstract class AccountError extends Error {
  sendToUserWebhook: boolean = false;
  deleteAccount: boolean = false;
  constructor(
    readonly response?: AxiosResponse,
    public message: string = "Error"
  ) {
    super();
  }
}

export class AccountUnauthorized extends AccountError {
  sendToUserWebhook = true;
  deleteAccount = true;
  constructor(readonly response?: AxiosResponse) {
    super(response, "Expired Cookies");
  }
}

export class TurboIneligible extends AccountError {
  sendToUserWebhook = true;
  deleteAccount = true;
  constructor(readonly response?: AxiosResponse) {
    super(response, "Invalid OneClick Settings");
  }
}

export class UnknownInitiateError extends AccountError {
  constructor(readonly response?: AxiosResponse) {
    super(response, "Unknown Initaite Error");
  }
}

export class UnknownSignError extends AccountError {
  constructor(readonly response?: AxiosResponse) {
    super(response, "Unknown Place Error");
  }
}

export class UnknownCheckoutError extends AccountError {
  constructor(readonly response?: AxiosResponse, message?: string) {
    super(response, message ?? "Unknown Checkout Error");
  }
}

export class KeyInvalidError extends AccountError {
  sendToUserWebhook = true;
  deleteAccount = true;
  constructor(readonly response?: AxiosResponse) {
    super(response, "Key Invalid");
  }
}
