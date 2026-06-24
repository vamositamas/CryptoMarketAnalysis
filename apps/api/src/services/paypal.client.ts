interface PayPalOrderResponse {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string; method: string }>;
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    payments: {
      captures: Array<{ id: string; status: string }>;
    };
  }>;
}

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class PayPalClient {
  private readonly baseUrl: string;

  constructor(
    private readonly clientId: string = process.env['PAYPAL_CLIENT_ID'] ?? '',
    private readonly clientSecret: string = process.env['PAYPAL_CLIENT_SECRET'] ?? '',
    mode: string = process.env['PAYPAL_MODE'] ?? 'sandbox',
  ) {
    this.baseUrl =
      mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`PayPal auth failed: ${response.status}`);
    }

    const data = (await response.json()) as PayPalTokenResponse;
    return data.access_token;
  }

  async createOrder(params: {
    amount: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; approvalUrl: string }> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: params.currency,
              value: params.amount.toFixed(2),
            },
            description: 'BitWLab Platform Support',
          },
        ],
        application_context: {
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
          brand_name: 'BitWLab',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`PayPal create order failed: ${response.status}`);
    }

    const data = (await response.json()) as PayPalOrderResponse;
    const approvalLink = data.links.find((l) => l.rel === 'approve');

    if (!approvalLink) {
      throw new Error('PayPal approval URL not found in response');
    }

    return { id: data.id, approvalUrl: approvalLink.href };
  }

  async captureOrder(orderId: string): Promise<{ transactionId: string; status: string }> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `capture-${orderId}`,
      },
    });

    if (!response.ok) {
      throw new Error(`PayPal capture failed: ${response.status}`);
    }

    const data = (await response.json()) as PayPalCaptureResponse;

    if (data.status !== 'COMPLETED') {
      throw new Error(`PayPal capture status was not COMPLETED: ${data.status}`);
    }

    const capture = data.purchase_units[0]?.payments?.captures?.[0];

    if (!capture) {
      throw new Error('PayPal capture details not found in response');
    }

    return { transactionId: capture.id, status: capture.status };
  }
}
