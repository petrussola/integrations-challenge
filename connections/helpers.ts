// request information is passed as object
// stripe expects request x-www-form-urlencoded
// there are 2 additional complications:
// 1. the request object contains information that needs to be used at different stages of a payment intent confirmation
// 2. the properties passed by Primer have different name as the ones accepted by Stripe i.e. currencyCode vs currency
// this method aims to encode the object passed into an object acceptable by stripe
export const buildEncodedBody = (
  request: object,
  stripeObject: string,
): string => {
  // for payment intent we only need amount and currency
  // for payment method we need a nested object
  let data: object = {};
  if (stripeObject === 'pi') {
    data = request;
  } else {
    data = request['paymentMethod'];
  }
  const body = Object.keys(data).reduce((accumulator: Array<string>, key) => {
    // filter by keys that are needed for the stripe object we are dealing with
    if (key in convertStripeProperties[stripeObject]) {
      // build the encoded key value pair
      let keyPair: string = '';
      if (stripeObject === 'pi') {
        keyPair = convertStripeProperties[stripeObject][key];
      } else {
        // data is passed inside the card property of stripe's payment method object
        keyPair = `card[${convertStripeProperties[stripeObject][key]}]`;
      }
      const valuePair = data[key];
      const keyValuePair: string = `${keyPair}=${valuePair}&`;
      // push string to accumulator
      accumulator.push(keyValuePair);
    }
    return accumulator;
  }, []);
  // return string with the encoded request
  return body.join('');
};

// Primer property names translated into Strip Object property names
// pi = Payment Intents
// pm = Payment Methods
const convertStripeProperties = {
  pi: {
    amount: 'amount',
    currencyCode: 'currency',
  },
  pm: {
    expiryMonth: 'exp_month',
    expiryYear: 'exp_year',
    cvv: 'cvc',
    cardNumber: 'number',
  },
};

// after each api call, we need to inspect the object returned by Primer and force an error if status code is not 200. When error is forced, catch in the main async function will be activated
export const errorHandling = (response) => {
  if (response.statusCode !== 200) {
    throw new Error(JSON.stringify(response));
  } else {
      // if status 200, we return id of the object as this is what stripe needs when going through the process of confirming a payment intent
      // this works irrespective of Stripe's endpoint being called i.e. payment intent, payment method
    const stripeObject = JSON.parse(response.responseText);
    const objectId = stripeObject.id;
    return objectId;
  }
};
