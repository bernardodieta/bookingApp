-- Enforce idempotency for provider-backed payments (Stripe session id)
CREATE UNIQUE INDEX "Payment_tenantId_provider_providerReference_key"
ON "Payment"("tenantId", "provider", "providerReference");
