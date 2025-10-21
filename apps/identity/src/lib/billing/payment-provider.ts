import { env } from "@ma/core";

export interface PaymentProvider {
  syncCustomer(options: { organizationId: string }): Promise<void>;
  syncPaymentMethod(options: {
    organizationId: string;
    paymentMethodId: string;
  }): Promise<void>;
  handleWebhook?(payload: unknown, signature?: string): Promise<void>;
}

class NoopPaymentProvider implements PaymentProvider {
  async syncCustomer(): Promise<void> {
    return;
  }

  async syncPaymentMethod(): Promise<void> {
    return;
  }

  async handleWebhook(): Promise<void> {
    return;
  }
}

export const createPaymentProvider = (): PaymentProvider => {
  const provider = env.IDENTITY_PAYMENT_PROVIDER?.toLowerCase();

  switch (provider) {
    case "stripe":
      // Stripe adapter placeholder
      return new NoopPaymentProvider();
    default:
      return new NoopPaymentProvider();
  }
};
