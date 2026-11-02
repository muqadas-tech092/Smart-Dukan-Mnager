/* ============================================================================
   Smart Dukaan Manager - white-label configuration
   ----------------------------------------------------------------------------
   Edit this file for each customer deployment. Nothing else needs to change.
   Values here are the defaults; the shop owner can still adjust shop name,
   logo, colours, currency and language from Settings inside the app.
   ============================================================================ */
window.SDM_CONFIG = {
  // Product identity shown in the sidebar, browser tab and receipts
  productName: "Smart Dukaan Manager",
  tagline: "Retail management for your shop",
  version: "2.1.2",

  // Your company (the reseller). Shown on the About screen and receipt footer.
  vendor: {
    name: "",            // e.g. "Techxant"
    phone: "",           // e.g. "0300-1234567"
    website: "",         // e.g. "https://example.com"
    supportEmail: "",    // e.g. "support@example.com"
  },

  // Storage namespace: change per customer when several shops share one browser/device.
  storageKey: "sdm",

  // Theme defaults (the owner can override primary colour and logo in Settings)
  theme: {
    primary: "#087F5B",
    primaryDark: "#066A4C",
    text: "#142D27",
    background: "#F5F7F6",
    radius: "12px",
    logo: "assets/logo.png",
  },

  // Business defaults applied when a new shop is set up
  defaults: {
    language: "en",                 // "en" or "ur"
    currencySymbol: "Rs.",
    lowStockThreshold: 10,
    invoicePrefix: "INV",
    receiptFooter: "Thank you for shopping with us.",
    paymentMethods: ["Cash", "JazzCash", "EasyPaisa", "Bank Transfer", "Card"],
    creditMethod: "Credit (Udhaar)",
    expenseCategories: ["Rent", "Utilities", "Salaries", "Transport", "Purchases", "Maintenance", "Marketing", "Other"],
    units: ["pcs", "kg", "g", "L", "ml", "pack", "box", "bag", "bottle", "dozen"],
  },

  // Feature switches: turn modules off for cheaper plans
  features: {
    pos: true,
    inventory: true,
    customers: true,
    khata: true,
    sales: true,
    expenses: true,
    reports: true,
    urdu: true,
    demoData: true,       // offer sample data during onboarding
    csvImport: true,
    backup: true,
  },

  // Optional licence notice shown in Settings > About (purely informational)
  licence: {
    plan: "Standard",
    licensedTo: "",
    expires: "",
  },
};
