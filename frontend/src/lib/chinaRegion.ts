import rawChinaAreaData from "china-area-data/data.json";

type RegionMap = Record<string, string>;
type RegionData = Record<string, RegionMap>;

export interface RegionOption {
  code: string;
  label: string;
}

export interface RegionSelection {
  provinceCode: string;
  cityCode: string;
  districtCode: string;
}

const ROOT_CODE = "86";
const GENERIC_CITY_NAMES = new Set([
  "市辖区",
  "县",
  "省直辖县级行政区划",
  "自治区直辖县级行政区划",
]);

const chinaAreaData = rawChinaAreaData as RegionData;
const provinceMap = chinaAreaData[ROOT_CODE] || {};

function mapToOptions(map: RegionMap | undefined): RegionOption[] {
  if (!map) return [];
  return Object.entries(map)
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => Number(a.code) - Number(b.code));
}

function normalizeRegionName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/特别行政区/g, "")
    .replace(/自治区/g, "")
    .replace(/自治州/g, "")
    .replace(/自治县/g, "")
    .replace(/地区/g, "")
    .replace(/盟/g, "")
    .replace(/省/g, "")
    .replace(/市/g, "")
    .replace(/区/g, "")
    .replace(/县/g, "");
}

function nameMatches(a: string, b: string): boolean {
  if (a === b) return true;
  return normalizeRegionName(a) === normalizeRegionName(b);
}

function findCodeByName(map: RegionMap | undefined, target: string): string {
  if (!map || !target.trim()) return "";
  for (const [code, label] of Object.entries(map)) {
    if (nameMatches(label, target)) return code;
  }
  return "";
}

function formatCityName(provinceCode: string, cityCode: string): string {
  const cityName = (chinaAreaData[provinceCode] || {})[cityCode] || "";
  if (!cityName) return "";
  if (GENERIC_CITY_NAMES.has(cityName)) {
    return provinceMap[provinceCode] || cityName;
  }
  return cityName;
}

function splitRegionTokens(value: string): string[] {
  return value
    .split(/[\/／|｜]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findCityAcrossProvince(cityName: string): { provinceCode: string; cityCode: string } {
  if (!cityName.trim()) return { provinceCode: "", cityCode: "" };
  for (const provinceCode of Object.keys(provinceMap)) {
    const cityCode = findCodeByName(chinaAreaData[provinceCode], cityName);
    if (cityCode) return { provinceCode, cityCode };
  }
  return { provinceCode: "", cityCode: "" };
}

export function getProvinceOptions(): RegionOption[] {
  return mapToOptions(provinceMap);
}

export function getCityOptions(provinceCode: string): RegionOption[] {
  return mapToOptions(chinaAreaData[provinceCode]);
}

export function getDistrictOptions(cityCode: string): RegionOption[] {
  return mapToOptions(chinaAreaData[cityCode]);
}

export function getAllCityNames(): string[] {
  const set = new Set<string>();
  for (const provinceCode of Object.keys(provinceMap)) {
    const cityMap = chinaAreaData[provinceCode] || {};
    for (const cityCode of Object.keys(cityMap)) {
      const cityName = formatCityName(provinceCode, cityCode);
      if (!cityName || GENERIC_CITY_NAMES.has(cityName)) continue;
      set.add(cityName);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

export function parseRegionSelection(value: string): RegionSelection {
  const tokens = splitRegionTokens(value || "");
  if (tokens.length === 0) {
    return { provinceCode: "", cityCode: "", districtCode: "" };
  }

  let provinceCode = findCodeByName(provinceMap, tokens[0]);
  let cityCode = "";
  let districtCode = "";
  let cityTokenIndex = 1;
  let districtTokenIndex = 2;

  if (!provinceCode) {
    const cityMatched = findCityAcrossProvince(tokens[0]);
    provinceCode = cityMatched.provinceCode;
    cityCode = cityMatched.cityCode;
    cityTokenIndex = 0;
    districtTokenIndex = 1;
  }

  if (!provinceCode) {
    return { provinceCode: "", cityCode: "", districtCode: "" };
  }

  if (!cityCode && tokens.length > cityTokenIndex) {
    cityCode = findCodeByName(chinaAreaData[provinceCode], tokens[cityTokenIndex]);
    if (!cityCode) {
      const cityOptions = getCityOptions(provinceCode);
      const onlyCity = cityOptions.length === 1 ? cityOptions[0] : null;
      if (onlyCity && nameMatches(tokens[cityTokenIndex], provinceMap[provinceCode] || "")) {
        cityCode = onlyCity.code;
      }
    }
  }

  if (cityCode && tokens.length > districtTokenIndex) {
    districtCode = findCodeByName(chinaAreaData[cityCode], tokens[districtTokenIndex]);
  }

  return { provinceCode, cityCode, districtCode };
}

export function buildRegionValue(provinceCode: string, cityCode = "", districtCode = ""): string {
  if (!provinceCode) return "";
  const provinceName = provinceMap[provinceCode] || "";
  const cityName = cityCode ? formatCityName(provinceCode, cityCode) : "";
  const districtName = districtCode ? (chinaAreaData[cityCode] || {})[districtCode] || "" : "";
  return [provinceName, cityName, districtName].filter(Boolean).join(" / ");
}
