// Client acceptance testing sends real notifications while keeping test orders
// separate from production. This opt-in has no effect on production deployments.
export function clientTestEmailsEnabled() {
  return process.env.VERCEL_ENV === "preview"
    && process.env.KASTELYDOMB_MODE !== "production"
    && process.env.CLIENT_TEST_EMAILS_ENABLED === "true";
}

export function emailRecipients(guestEmail: string, isTest: boolean) {
  const clientTest = isTest && clientTestEmailsEnabled();
  const suppressed = isTest && !clientTest;
  return {
    guest_email: suppressed ? "tippanzsolt@gmail.com" : guestEmail,
    restaurant_email: suppressed ? "tippanzsolt@gmail.com" : "fenyocsaba@gmail.com",
    email_bcc: clientTest ? "tippanzsolt@gmail.com" : "",
    client_test: clientTest,
    original_guest_email_suppressed: suppressed,
  };
}
