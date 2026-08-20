/**
 * Token pricing constants — all values are in MICRO-CENTS (millionths of a cent).
 * Using integers avoids floating-point rounding bugs in money math.
 *
 * Conversion: final cost in cents = sum_of_micro_cents / 1_000_000
 *
 * Design decision: The system tracks two token types (input and output)
 * matching the usage_events schema in DESIGN.md. Pricing is applied
 * separately per category because input and output tokens have different rates.
 */
const PRICING = {
    INPUT_TOKEN_MICRO_CENTS: 1,   // 1 micro-cent per input token
    OUTPUT_TOKEN_MICRO_CENTS: 4,  // 4 micro-cents per output token (generation costs more)
};

module.exports = PRICING;