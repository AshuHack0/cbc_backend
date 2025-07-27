// stripePriceMap.js

const STRIPE_PRICES = {
  // One-time processing fees
  processingFees: {
    110: "price_1RocFvQNbvJj6Af2v04W5orG",
    220: "price_1RocIPQNbvJj6Af2Hipq6Fxo",
  },

  // Subscriptions by membership type and plan    
  subscriptions: {
    Family: {
      monthly: "price_1RocLlQNbvJj6Af2vOPycBll",
      yearly: "price_1RocLlQNbvJj6Af2qDtaA223",
    },
    Individual: {
      monthly: "price_1RocQbQNbvJj6Af2AZeuGxM6",
      yearly: "price_1RocQbQNbvJj6Af2S72GEyBJ",
      trial: "price_1RocQbQNbvJj6Af2QAprYPWz",
    },
    Junior: {
      monthly: "price_1RnI5OCocYcK9qneTTN49bZM",
      yearly: "price_1RnI5tCocYcK9qne6fYPV6pt",
      trial: "price_1RnI6oCocYcK9qnePM2eDbr4",
    },
    Senior: {
      monthly: "price_1RnI6oCocYcK9qnePM2eDbr4",
      yearly: "price_1RnI6oCocYcK9qnePM2eDbr4",
      trial: "price_1RnI6oCocYcK9qnePM2eDbr4",
    },
    "Young Adult": {
      monthly: "price_1RnI6oCocYcK9qnePM2eDbr4",
      yearly: "price_1RnI6oCocYcK9qnePM2eDbr4",
      trial: "price_1RnI6oCocYcK9qnePM2eDbr4",
    },
  },
};

export default STRIPE_PRICES;
