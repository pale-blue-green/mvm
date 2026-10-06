import { describe, expect, it } from "vitest";
import { formatNumber } from "./numfmt";

describe("formatNumber", () => {
  it("General は有効数字を整えて表示する", () => {
    expect(formatNumber(42, "General")).toBe("42");
    expect(formatNumber(3.14159, undefined)).toBe("3.14159");
    expect(formatNumber(0.1 + 0.2, "General")).toBe("0.3");
  });

  it("桁区切り・小数桁・パーセント", () => {
    expect(formatNumber(1234.5, "#,##0")).toBe("1,235");
    expect(formatNumber(1234.5, "0.00")).toBe("1234.50");
    expect(formatNumber(1234567, "#,##0.0")).toBe("1,234,567.0");
    expect(formatNumber(0.256, "0%")).toBe("26%");
    expect(formatNumber(-5, "0")).toBe("-5");
  });

  it("引用符のリテラルと通貨記号を残す", () => {
    expect(formatNumber(1234, '"¥"#,##0')).toBe("¥1,234");
    expect(formatNumber(30, '0"円"')).toBe("30円");
  });

  it("日付 (シリアル値 45000 = 2023-03-15)", () => {
    expect(formatNumber(45000, "yyyy/m/d")).toBe("2023/3/15");
    expect(formatNumber(45000, "yyyy-mm-dd")).toBe("2023-03-15");
    expect(formatNumber(45000, 'yyyy"年"m"月"d"日"')).toBe("2023年3月15日");
  });

  it("時刻と、h の隣の m は「分」として扱う", () => {
    expect(formatNumber(0.5, "h:mm")).toBe("12:00");
    expect(formatNumber(45000.75, "yyyy/m/d h:mm")).toBe("2023/3/15 18:00");
  });
});
