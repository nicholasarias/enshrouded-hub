import js from "@eslint/js";
import next from "eslint-config-next";

/**
 * ESLint config for Enshrouded Hub
 *
 * We intentionally allow `any` during active development.
 * This avoids blocking progress while APIs and schemas are still evolving.
 * We can tighten this later once things stabilize.
 */

export default [
  js.configs.recommended,
  ...next(),
  {
    rules: {
      // 🔧 Development-friendly rules
      "@typescript-eslint/no-explicit-any": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // Optional sanity rules (keep signal, low noise)
      "no-console": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];
