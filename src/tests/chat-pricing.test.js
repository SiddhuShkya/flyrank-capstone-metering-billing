const billingService = require('../services/billing.service');
const PRICING = require('../config/chat-pricing');

describe('BillingService.calculateCost — pinned pricing tests', () => {

    it('should return 0 cost for zero tokens', () => {
        expect(billingService.calculateCost(0, 0, 0, 0)).toBe(0);
    });

    it('should price only input tokens correctly', () => {
        // 1,000,000 input tokens × 1 micro-cent = 1,000,000 micro-cents = 1 cent
        expect(billingService.calculateCost(1_000_000, 0, 0, 0)).toBe(1);
    });

    it('should price only output tokens correctly', () => {
        // 1,000,000 output tokens × 4 micro-cents = 4,000,000 micro-cents = 4 cents
        expect(billingService.calculateCost(0, 0, 1_000_000, 0)).toBe(4);
    });

    it('should price output tokens higher than input tokens for the same quantity', () => {
        // Use 1,000,000 tokens so both costs survive Math.floor division.
        // 1,000,000 input  × 1 micro-cent = 1,000,000 micro-cents = 1 cent
        // 1,000,000 output × 4 micro-cents = 4,000,000 micro-cents = 4 cents
        // With only 1,000 tokens: input = 1,000 micro-cents and output = 4,000
        // micro-cents — both floor to 0, making them equal and the test meaningless.
        const inputCost  = billingService.calculateCost(1_000_000, 0, 0, 0);
        const outputCost = billingService.calculateCost(0, 0, 1_000_000, 0);
        expect(outputCost).toBeGreaterThan(inputCost);
    });

    it('should correctly add input and output token costs together', () => {
        // 500,000 input  × 1 micro-cent =   500,000 micro-cents
        // 500,000 output × 4 micro-cents = 2,000,000 micro-cents
        // Total = 2,500,000 micro-cents = 2 cents (floor)
        expect(billingService.calculateCost(500_000, 0, 500_000, 0)).toBe(2);
    });

    it('should use integer math — never return a float', () => {
        // 1 input token = 1 micro-cent, which is less than 1 cent → floors to 0
        const cost = billingService.calculateCost(1, 0, 0, 0);
        expect(Number.isInteger(cost)).toBe(true);
        expect(cost).toBe(0);
    });

    it('should floor sub-cent remainders, not round them', () => {
        // 999,999 input tokens × 1 micro-cent = 999,999 micro-cents → 0 cents (not 1)
        expect(billingService.calculateCost(999_999, 0, 0, 0)).toBe(0);
        // 1,000,001 input tokens × 1 micro-cent = 1,000,001 micro-cents → 1 cent (not 2)
        expect(billingService.calculateCost(1_000_001, 0, 0, 0)).toBe(1);
    });

    it('pinned constants test — alerts immediately if pricing config changes', () => {
        // This test intentionally pins the constant values.
        // If you change pricing, this test breaks so the change is reviewed.
        expect(PRICING.INPUT_TOKEN_MICRO_CENTS).toBe(1);
        expect(PRICING.CACHED_INPUT_TOKEN_MICRO_CENTS).toBe(0);
        expect(PRICING.OUTPUT_TOKEN_MICRO_CENTS).toBe(4);
        expect(PRICING.REASONING_TOKEN_MICRO_CENTS).toBe(4);
    });

    it('reasoning tokens should cost the same as output tokens (TASK.md §15)', () => {
        // TASK.md §15: "reasoning tokens count as output tokens, not a separate free category"
        // Both should produce 4 cents for 1,000,000 tokens.
        const outputCost    = billingService.calculateCost(0, 0, 1_000_000, 0);
        const reasoningCost = billingService.calculateCost(0, 0, 0, 1_000_000);
        expect(reasoningCost).toBe(outputCost);
        expect(reasoningCost).toBe(4);
    });

    it('cached input tokens should cost less than or equal to fresh input tokens', () => {
        // Cached input is cheaper than fresh input by design (TASK.md §4, §15).
        // At the current rate (0 micro-cents) cached input floors to 0 cents —
        // a simplification noted in DESIGN.md §2 (extended token types are out of scope).
        const freshInputCost  = billingService.calculateCost(1_000_000, 0, 0, 0);
        const cachedInputCost = billingService.calculateCost(0, 1_000_000, 0, 0);
        expect(cachedInputCost).toBeLessThanOrEqual(freshInputCost);
    });
});