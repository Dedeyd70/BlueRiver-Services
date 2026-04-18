

# Investigation needed before patching

The user says service fields are not being converted to line items, but `computeQuote()` in `pricingEngine.ts` (lines 117-129) already does exactly that mapping. I need to verify the actual runtime behavior before patching.
