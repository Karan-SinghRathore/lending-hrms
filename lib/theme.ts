import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Deep navy brand colour; everything else stays neutral grey.
const brand: MantineColorsTuple = [
  "#eef3f9",
  "#dbe4ef",
  "#b4c6dd",
  "#8aa6cb",
  "#678bbb",
  "#5079b1",
  "#4370ad",
  "#355f98",
  "#2c5388",
  "#1f4677",
];

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 8,
  colors: { brand },
  fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
  headings: {
    fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "22px", lineHeight: "1.3" },
      h2: { fontSize: "18px", lineHeight: "1.35" },
      h3: { fontSize: "15px", lineHeight: "1.4" },
      h4: { fontSize: "14px", lineHeight: "1.4" },
    },
  },
  fontSizes: { xs: "12px", sm: "13px", md: "14px", lg: "16px", xl: "18px" },
  radius: { xs: "2px", sm: "4px", md: "6px", lg: "8px", xl: "12px" },
  defaultRadius: "sm",
  spacing: { xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px" },
  components: {
    Paper: { defaultProps: { radius: "md" } },
    Card: { defaultProps: { radius: "md", withBorder: true, padding: "md" } },
    Button: { defaultProps: { size: "sm", radius: "sm" } },
    TextInput: { defaultProps: { size: "sm" } },
    Select: { defaultProps: { size: "sm", allowDeselect: false } },
    NumberInput: { defaultProps: { size: "sm" } },
    Badge: {
      defaultProps: { radius: "sm", variant: "light", size: "sm" },
      styles: { label: { textTransform: "none", fontWeight: 600, letterSpacing: 0 } },
    },
    Table: { defaultProps: { fz: "sm", verticalSpacing: 8, horizontalSpacing: "sm" } },
    Tabs: { defaultProps: { radius: "sm" } },
    Modal: { defaultProps: { radius: "md", centered: true, overlayProps: { backgroundOpacity: 0.35 } } },
    Tooltip: { defaultProps: { withArrow: true, fz: "xs" } },
  },
});
