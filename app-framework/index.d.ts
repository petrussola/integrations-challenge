export type TransactionStatus =
  | 'AUTHORIZED'
  | 'DECLINED'
  | 'FAILED'
  | 'SETTLING'
  | 'SETTLED'
  | 'CANCELLED';

export type DeclineReason = 'DO_NOT_HONOR' | 'INSUFFICIENT_FUNDS' | 'UNKNOWN';

export interface CardDetails {
  cardNumber: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
}

interface PayPalOrder {
  orderId: string;
}

interface APIKeyCredentials {
  apiKey: string | undefined;
}

interface ClientIDSecretCredentials {
  clientId: string;
  clientSecret: string;
}

type ProcessorConfig<T> = T & {
  accountId: string | undefined;
};

interface IProcessorRequest<T> {
  processorConfig: ProcessorConfig<T>;
}

export interface RawAuthorizationRequest<T, U> extends IProcessorRequest<T> {
  amount: number;
  currencyCode: string;
  paymentMethod: U;
  merchantReference?: string;
}

type IAuthResponse<T, U extends TransactionStatus> = T & {
  transactionStatus: U;
};

export type ParsedAuthorizationResponse =
  | IAuthResponse<
      { processorTransactionId: string },
      'AUTHORIZED' | 'CANCELLED' | 'SETTLING' | 'SETTLED'
    >
  | IAuthResponse<{ declineReason: DeclineReason }, 'DECLINED'>
  | IAuthResponse<{ errorMessage: string }, 'FAILED'>;

export interface RawCaptureRequest<T> extends IProcessorRequest<T> {
  processorTransactionId: string;
  merchantReference?: string;
}

export interface ParsedCaptureResponse {
  transactionStatus: TransactionStatus;
  declineReason?: DeclineReason;
  errorMessage?: string;
}

export interface RawCancelRequest<T> extends IProcessorRequest<T> {
  processorTransactionId: string;
  merchantReference?: string;
}

export interface ParsedCancelResponse {
  transactionStatus: TransactionStatus;
  errorMessage?: string;
}

export interface ProcessorConnection<T, U> {
  name: string;
  website: string;
  configuration: ProcessorConfig<T>;
  authorize(
    rawAuthRequest: RawAuthorizationRequest<T, U>,
  ): Promise<ParsedAuthorizationResponse>;
  capture(
    rawCaptureRequest: RawCaptureRequest<T>,
  ): Promise<ParsedCaptureResponse>;
  cancel(rawCancelRequest: RawCancelRequest<T>): Promise<ParsedCancelResponse>;
}

interface TransactionInfo {
  processorTransactionId: string;
}
