// Default to client testing. Real operations require an explicit later mode change.
export function isTestMode() {
  return process.env.KASTELYDOMB_MODE !== "production";
}
export function acceptsOrders() {
  return isTestMode()
    ? process.env.CLIENT_TEST_ORDERS_ENABLED === "true"
    : process.env.ORDER_INTAKE_ENABLED === "true";
}
