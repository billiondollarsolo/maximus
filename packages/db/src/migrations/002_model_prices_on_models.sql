-- Per-model offering rates (USD per 1M tokens). Null = fall back to model_prices patterns.
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS input_usd_per_1m numeric(12, 6),
  ADD COLUMN IF NOT EXISTS output_usd_per_1m numeric(12, 6);
