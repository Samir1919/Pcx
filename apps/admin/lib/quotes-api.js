"use client";

import { apiRequest } from "./api-client.js";

export { ApiError as QuotesApiError, csrfToken } from "./api-client.js";

export const quotesApi = Object.freeze({
  list: () => apiRequest("/api/v1/admin/indicative-prices"),
  setQuote: (body) => apiRequest("/api/v1/admin/indicative-prices", { method: "POST", body })
});
