CREATE INDEX IF NOT EXISTS idx_transactions_active_history
  ON transactions(farm_id, occurred_on DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
