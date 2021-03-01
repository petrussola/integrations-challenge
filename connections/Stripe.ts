import {
  APIKeyCredentials,
  CardDetails,
  ParsedAuthorizationResponse,
  ParsedCancelResponse,
  ParsedCaptureResponse,
  ProcessorConnection,
  RawAuthorizationRequest,
  RawCancelRequest,
  RawCaptureRequest,
} from '@primer-io/app-framework';

// helpers
import { buildEncodedBody, errorHandling } from './helpers';

import HttpClient from '../common/HTTPClient';
import fetch from 'node-fetch';
require('dotenv').config({ path: './.env' });

// I had to modify the type of accountId and apiKey below from : string to :string | undefined for env variables wor work properly https://stackoverflow.com/a/45195359/3630417
const acct_id = process.env['ACCOUNT_ID'];
const apiKey = process.env['API_KEY'];

const StripeConnection: ProcessorConnection<APIKeyCredentials, CardDetails> = {
  name: 'STRIPE',

  website: 'stripe.com',

  configuration: {
    accountId: acct_id,
    apiKey: apiKey,
  },

  /**
   *
   * You should authorize a transaction and return an appropriate response
   */
  async authorize(
    request: RawAuthorizationRequest<APIKeyCredentials, CardDetails>,
  ): Promise<ParsedAuthorizationResponse> {
    try {
      ///////////////////////////
      // create payment intent //
      ///////////////////////////

      // construct the encoded body that come in the shape of object
      const encodedBodyPi = buildEncodedBody(request, 'pi');

      // create payment intent with manual authorize
      let res = await HttpClient.request(
        'https://api.stripe.com/v1/payment_intents',
        {
          method: 'post',
          headers: {
            'Authorization': `Bearer ${StripeConnection.configuration.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          // adding capture_method = manual because we want to only do authorization
          body: `${encodedBodyPi}capture_method=manual`,
        },
      );
      const idPi = errorHandling(res);

      ///////////////////////////
      // create payment method //
      ///////////////////////////

      // encode request
      const encodedBodyPm = buildEncodedBody(request, 'pm');
      // create payment method
      let resPm = await HttpClient.request(
        'https://api.stripe.com/v1/payment_methods',
        {
          method: 'post',
          headers: {
            'Authorization': `Bearer ${StripeConnection.configuration.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          // adding capture_method = manual because we want to only do authorization
          body: `type=card&${encodedBodyPm}`,
        },
      );

      const idPm = errorHandling(resPm);

      //////////////////////////////////////////
      // add payment method to payment intent //
      //////////////////////////////////////////

      const resUpdatedPi = await HttpClient.request(
        `https://api.stripe.com/v1/payment_intents/${idPi}`,
        {
          method: 'post',
          headers: {
            'Authorization': `Bearer ${StripeConnection.configuration.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          // payment_method id is added to the payment intent stripe object
          body: `payment_method=${idPm}`,
        },
      );

      errorHandling(resUpdatedPi);

      ////////////////////////////
      // confirm Payment Intent //
      ////////////////////////////

      const resConfirmedPi = await HttpClient.request(
        `https://api.stripe.com/v1/payment_intents/${idPi}/confirm`,
        {
          method: 'post',
          headers: {
            'Authorization': `Bearer ${StripeConnection.configuration.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: '',
        },
      );

      const confirmedPiId = errorHandling(resConfirmedPi);

      return {
        processorTransactionId: confirmedPiId,
        transactionStatus: 'AUTHORIZED',
      };
    } catch (error) {
      const { statusCode, responseText } = JSON.parse(error.message);
      const { message } = JSON.parse(responseText).error;
      let failedResponse;
      switch (statusCode) {
        case 402:
          failedResponse = {
            declineReason: message,
            transactionStatus: 'DECLINED',
          };
          break;
        default:
          failedResponse = {
            errorMessage: message,
            transactionStatus: 'FAILED',
          };
          break;
      }
      return failedResponse;
    }
  },

  /**
   * Capture a payment intent
   * This method should capture the funds on an authorized transaction
   */
  async capture(
    request: RawCaptureRequest<APIKeyCredentials>,
  ): Promise<ParsedCaptureResponse> {
    try {
      const res = await HttpClient.request(
        `https://api.stripe.com/v1/payment_intents/${request.processorTransactionId}/capture`,
        {
          method: 'post',
          headers: {
            Authorization: `Bearer ${request.processorConfig.apiKey}`,
          },
          body: '',
        },
      );

      errorHandling(res);

      return {
        transactionStatus: 'SETTLED',
      };
    } catch (error) {
      const { message } = error;
      const { responseText } = JSON.parse(message);
      const errorObject = JSON.parse(responseText);
      return {
        transactionStatus: 'FAILED',
        errorMessage: errorObject.message,
      };
    }
  },

  /**
   * Cancel a payment intent
   * This one should cancel an authorized transaction
   */
  async cancel(
    request: RawCancelRequest<APIKeyCredentials>,
  ): Promise<ParsedCancelResponse> {
    try {
      const res = await HttpClient.request(
        `https://api.stripe.com/v1/payment_intents/${request.processorTransactionId}/cancel`,
        {
          method: 'post',
          headers: {
            Authorization: `Bearer ${request.processorConfig.apiKey}`,
          },
          body: '',
        },
      );

      errorHandling(res);

      return {
        transactionStatus: 'CANCELLED',
      };
    } catch (error) {
      const { message } = error;
      const { responseText } = JSON.parse(message);
      const errorObject = JSON.parse(responseText);
      return {
        transactionStatus: 'FAILED',
        errorMessage: errorObject.message,
      };
    }
  },
};

export default StripeConnection;
