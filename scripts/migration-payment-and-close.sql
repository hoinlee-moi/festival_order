-- 결제수단 컬럼 추가 (CASH | CARD)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'CASH';

-- 마감 시점 컬럼 추가 (NULL = 현재 영업 세션, 값 있음 = 마감된 세션)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- 마감 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON orders(closed_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
