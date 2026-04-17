import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aintritsiqliscexdqqp.supabase.co";
const supabaseAnonKey = "sb_publishable_W0EoyxRC2WscV-UmFB3GPA_u88DkwfF";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedMenus() {
  const menus = [
    { name: "돈가스", price: 8000, is_available: true, sort_order: 1 },
    { name: "어린이 정식", price: 8000, is_available: true, sort_order: 2 },
    { name: "떡볶이", price: 5000, is_available: true, sort_order: 3 },
    { name: "음료수", price: 2000, is_available: true, sort_order: 4 },
  ];

  const { data, error } = await supabase.from("menus").insert(menus).select();

  if (error) {
    console.error("메뉴 삽입 실패:", error.message);
  } else {
    console.log("메뉴 삽입 성공:", data);
  }
}

seedMenus();
