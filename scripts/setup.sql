-- 1. menus 테이블 생성
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  price INTEGER NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. orders 테이블 생성
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number INTEGER NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  phone_number VARCHAR(15) NOT NULL,
  items JSONB NOT NULL,
  total_price INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  sms_status VARCHAR(20) DEFAULT 'NOT_SENT',
  last_sms_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE menus;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 4. RLS 정책 (anon 사용자 전체 접근 허용 - 축제용 비인증 앱)
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to menus" ON menus FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to orders" ON orders FOR ALL USING (true) WITH CHECK (true);

-- 5. 더미 메뉴 데이터 삽입
INSERT INTO menus (name, price, is_available, sort_order) VALUES
  ('돈가스', 8000, true, 1),
  ('어린이 정식', 8000, true, 2),
  ('떡볶이', 5000, true, 3),
  ('음료수', 2000, true, 4);
