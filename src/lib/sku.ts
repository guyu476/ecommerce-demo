// SKU 规格工具：规格定义/取值的解析、展示文本、笛卡尔组合生成
// 均为纯函数（契约层），接口校验、前端选择器、单测共用

export interface SpecDefinition {
  name: string;
  values: string[];
}

export interface SkuSpecValue {
  name: string;
  value: string;
}

/** 解析商品规格定义 JSON（空/损坏返回空数组） */
export function parseSpecs(json: string | null): SpecDefinition[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SpecDefinition =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as SpecDefinition).name === "string" &&
          Array.isArray((item as SpecDefinition).values),
      )
      .map((item) => ({ name: item.name, values: item.values.filter((v) => typeof v === "string") }));
  } catch {
    return [];
  }
}

/** 解析 SKU 规格取值 JSON */
export function parseSkuSpecs(json: string): SkuSpecValue[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SkuSpecValue =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SkuSpecValue).name === "string" &&
        typeof (item as SkuSpecValue).value === "string",
    );
  } catch {
    return [];
  }
}

/** SKU 规格展示文本：「黑色 / 8+128」 */
export function skuSpecText(specs: SkuSpecValue[]): string {
  return specs.map((spec) => spec.value).join(" / ");
}

/** 笛卡尔积生成全部规格组合（商家端「生成组合」按钮用） */
export function cartesianSpecCombinations(defs: SpecDefinition[]): SkuSpecValue[][] {
  if (defs.length === 0) return [];
  return defs.reduce<SkuSpecValue[][]>(
    (acc, def) => acc.flatMap((combo) => def.values.map((value) => [...combo, { name: def.name, value }])),
    [[]],
  );
}

/** 校验 SKU 取值是否都在规格定义内（name 存在且 value 属于 values） */
export function validateSkuAgainstSpecs(
  skuSpecs: SkuSpecValue[],
  defs: SpecDefinition[],
): boolean {
  return skuSpecs.every((spec) =>
    defs.some((def) => def.name === spec.name && def.values.includes(spec.value)),
  );
}
